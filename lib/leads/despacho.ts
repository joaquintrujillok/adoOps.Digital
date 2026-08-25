// ═════════════════════════════════════════════════════════════════════════════
//  PUNTO ÚNICO DE SALIDA DEL MOTOR
//
//  Este es el ÚNICO módulo del motor autorizado a importar un cliente de red
//  —Unipile para LinkedIn, Brevo para email—. Esa invariante es lo que hace
//  auditable la promesa de a quién se le escribe, y se verifica con un comando:
//
//    grep -rn "unipile" lib app --include=*.ts | grep -v node_modules
//
//  Debe devolver solo este archivo.
//
//  Para Brevo el grep no sirve tal cual: `lib/email.ts` ya lo importa desde
//  antes, para el formulario de contacto de la web corporativa. Ese módulo le
//  escribe a adoOps, no a prospectos, y no toca ninguna tabla `lead_*` — pero
//  conviene saberlo antes de correr el grep y asustarse. Si el motor manda
//  emails, los manda desde acá.
//
//  Es el mismo patrón que `whatsapp-dispatch.ts` en el CRM de CDC, y la razón
//  por la que ahí se puede responder con certeza "¿a quién le mandamos?"
//  mirando un solo archivo.
// ═════════════════════════════════════════════════════════════════════════════
//
// Nada sale sin cruzar los cuatro candados, y el orden importa: los evalúa
// `lib/leads/motivo.ts`, no este archivo. Acá solo se obedece el veredicto.

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { fechaChile } from "./reloj";
import { evaluarFreno, type ContextoDespacho, type Freno } from "./motivo";
import { aAccionAEvaluar, contexto, proximaAccion, type FilaCola } from "./cola";
import { agendarSiguiente } from "./planificador";

export interface ResultadoDespacho {
  /** Qué pasó, en una línea, para el log del cron y para `?simular=1`. */
  resumen: string;
  accionId: number | null;
  enviada: boolean;
  freno: Freno | null;
  simulado: boolean;
}

// ─── La red ──────────────────────────────────────────────────────────────────

/**
 * El envío real. **Todavía no está conectado y es deliberado.**
 *
 * Mientras `lead_campanas.simulado` esté en `true` —que es el default del
 * esquema— el candado 3 corta antes de llegar acá, así que el motor completo se
 * puede construir, aprobar y recorrer sin una cuenta de LinkedIn. Cuando entren
 * las credenciales, lo único que cambia es el cuerpo de esta función.
 *
 * Lo que va a ir acá:
 *   · invitacion  → POST /users/invite            (Unipile)
 *   · mensaje     → POST /chats                   (Unipile)
 *   · inmail      → POST /chats con inmail: true  (Unipile)
 *   · email       → POST /v3/smtp/email           (Brevo)
 */
async function enviarPorLaRed(
  accion: FilaCola,
): Promise<{ ok: boolean; externalId: string | null; detalle: string }> {
  throw new Error(
    `No se puede despachar la acción ${accion.id} (${accion.carril}): el envío real no ` +
      `está conectado. La campaña "${accion.campanaNombre}" tiene que quedarse en modo ` +
      `simulado hasta configurar Unipile — ver docs/motor-nurturing.md`,
  );
}

// ─── Registro ────────────────────────────────────────────────────────────────

async function marcarFrenada(accionId: number, freno: Freno): Promise<void> {
  // El motivo se guarda como `tipo:texto` para que la banda C pueda agrupar por
  // tipo y a la vez mostrar el texto con sus cifras adentro.
  const motivo = `${freno.tipo}:${freno.texto}`.slice(0, 60);
  await db.execute(sql`
    UPDATE lead_acciones
       SET estado = 'frenada', motivo = ${motivo}
     WHERE id = ${accionId}
  `);
}

async function registrarEnvio(
  a: FilaCola,
  emisorId: number | null,
  externalId: string | null,
  detalle: string,
): Promise<void> {
  await db.execute(sql`
    UPDATE lead_acciones
       SET estado = 'enviada', motivo = NULL, resultado = ${detalle},
           ejecutada_en = NOW(), intentos = intentos + 1
     WHERE id = ${a.id}
  `);

  await db.execute(sql`
    INSERT INTO lead_mensajes
      (persona_id, inscripcion_id, accion_id, emisor_id, canal, direccion, cuerpo, external_id)
    VALUES (${a.personaId}, ${a.inscripcionId}, ${a.id}, ${emisorId},
            ${a.canal}, 'saliente', ${a.cuerpo ?? ""}, ${externalId})
    ON CONFLICT (canal, external_id) DO NOTHING
  `);

  // El estado avanza según lo que se acaba de mandar. Una invitación deja la
  // inscripción en `invitado` —esperando aceptación— y cualquier otra cosa la
  // pone en secuencia.
  const nuevoEstado = a.tipo === "invitacion" ? "invitado" : "en_secuencia";
  await db.execute(sql`
    UPDATE lead_inscripciones
       SET estado = ${nuevoEstado},
           paso_actual = paso_actual + 1,
           toques_totales = toques_totales + 1,
           invitada_en = CASE WHEN ${a.tipo} = 'invitacion' THEN NOW() ELSE invitada_en END,
           actualizado_en = NOW()
     WHERE id = ${a.inscripcionId}
  `);

  // Una invitación NO agenda el paso siguiente: la secuencia arranca recién
  // cuando la persona acepta. Agendarlo acá le mandaría el mensaje 1 a alguien
  // que todavía no es contacto — y ese mensaje simplemente no llega.
  if (a.tipo !== "invitacion") {
    await agendarSiguiente(a.inscripcionId);
  }
}

// ─── El despacho ─────────────────────────────────────────────────────────────

/**
 * Despacha UNA acción. Devuelve qué pasó, siempre — nunca lanza por un freno.
 *
 * **Un freno nunca consume cupo.** El candado 4, que es el único que mira la
 * cuota, se evalúa al final; si algo lo detuvo antes, el emisor no gastó turno.
 */
export async function despacharUna(
  ahora = new Date(),
  ctx?: ContextoDespacho,
): Promise<ResultadoDespacho> {
  const contextoUsado = ctx ?? (await contexto(ahora));

  const fila = await proximaAccion(ahora);
  if (!fila) {
    return {
      resumen: "No hay acciones aprobadas y vencidas en la cola",
      accionId: null,
      enviada: false,
      freno: null,
      simulado: false,
    };
  }

  // La consulta ya trae todo lo que el evaluador necesita; se rearma el crudo
  // desde la fila para no hacer un segundo viaje a la base.
  const crudo = await db.execute(sql`
    SELECT a.emisor_id, a.aprobada_en, i.paso_actual, i.toques_totales,
           i.estado AS inscripcion_estado, c.estado AS campana_estado,
           p.suprimido_en, p.suprimido_motivo
      FROM lead_acciones a
      JOIN lead_inscripciones i ON i.id = a.inscripcion_id
      JOIN lead_personas p ON p.id = a.persona_id
      JOIN lead_campanas c ON c.id = i.campana_id
     WHERE a.id = ${fila.id}
  `);

  const freno = evaluarFreno(aAccionAEvaluar(fila, crudo.rows[0]), contextoUsado);

  if (freno) {
    // El modo simulado es un freno con registro: se marca como frenada con su
    // motivo, igual que cualquier otro, y así la banda C muestra exactamente
    // cuántas habrían salido si estuviera conectado.
    await marcarFrenada(fila.id, freno);
    return {
      resumen: `${fila.nombre}: ${freno.texto}`,
      accionId: fila.id,
      enviada: false,
      freno,
      simulado: freno.tipo === "simulado",
    };
  }

  const emisorId = (crudo.rows[0] as { emisor_id: number | null } | undefined)?.emisor_id ?? null;

  try {
    const r = await enviarPorLaRed(fila);
    if (!r.ok) {
      await db.execute(sql`
        UPDATE lead_acciones
           SET estado = 'fallida', resultado = ${r.detalle}, intentos = intentos + 1
         WHERE id = ${fila.id}
      `);
      return {
        resumen: `${fila.nombre}: la red rechazó el envío · ${r.detalle}`,
        accionId: fila.id,
        enviada: false,
        freno: null,
        simulado: false,
      };
    }

    await registrarEnvio(fila, emisorId, r.externalId, r.detalle);
    return {
      resumen: `${fila.nombre}: enviado por ${fila.carril}`,
      accionId: fila.id,
      enviada: true,
      freno: null,
      simulado: false,
    };
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    await db.execute(sql`
      UPDATE lead_acciones
         SET estado = 'fallida', resultado = ${detalle}, intentos = intentos + 1
       WHERE id = ${fila.id}
    `);
    return {
      resumen: `${fila.nombre}: falló el envío · ${detalle}`,
      accionId: fila.id,
      enviada: false,
      freno: null,
      simulado: false,
    };
  }
}

/**
 * Evalúa y marca TODA la cola vencida, y despacha como mucho una.
 *
 * Marcar el resto es lo que mantiene la banda C al día sin esperar a que a cada
 * acción le llegue su turno: si no, el panel diría "37 pendientes" durante horas
 * sin explicar que 22 de ellas no van a salir hoy.
 */
export async function tick(ahora = new Date()): Promise<{
  evaluadas: number;
  frenadas: number;
  despacho: ResultadoDespacho;
}> {
  const ctx = await contexto(ahora);
  const hoy = fechaChile(ahora);

  const vencidas = await db.execute(sql`
    SELECT a.id, a.emisor_id, a.aprobada_en, a.estado, a.tipo, a.canal, a.persona_id,
           i.paso_actual, i.toques_totales, i.estado AS inscripcion_estado,
           c.estado AS campana_estado, c.simulado AS campana_simulado,
           p.suprimido_en, p.suprimido_motivo,
           s.vence_en AS senal_vence_en
      FROM lead_acciones a
      JOIN lead_inscripciones i ON i.id = a.inscripcion_id
      JOIN lead_personas p ON p.id = a.persona_id
      JOIN lead_campanas c ON c.id = i.campana_id
      LEFT JOIN lead_senales s ON s.id = i.senal_id
     WHERE a.estado IN ('pendiente', 'aprobada')
       AND a.fecha_chile <= ${hoy}
     LIMIT 500
  `);

  let frenadas = 0;
  for (const r of vencidas.rows as Array<Record<string, unknown>>) {
    const freno = evaluarFreno(
      {
        id: Number(r.id),
        personaId: Number(r.persona_id),
        tipo: String(r.tipo),
        canal: String(r.canal),
        emisorId: r.emisor_id ? Number(r.emisor_id) : null,
        estado: String(r.estado),
        pasoActual: Number(r.paso_actual ?? 0),
        toquesTotales: Number(r.toques_totales ?? 0),
        inscripcionEstado: String(r.inscripcion_estado ?? "pendiente"),
        personaSuprimidaEn: r.suprimido_en ? new Date(String(r.suprimido_en)) : null,
        personaSuprimidaMotivo: r.suprimido_motivo ? String(r.suprimido_motivo) : null,
        senalVenceEn: r.senal_vence_en ? new Date(String(r.senal_vence_en)) : null,
        campanaEstado: String(r.campana_estado ?? "borrador"),
        campanaSimulada: Boolean(r.campana_simulado),
        aprobadaEn: r.aprobada_en ? new Date(String(r.aprobada_en)) : null,
      },
      ctx,
    );

    // `sin_aprobar` no se marca como frenada: esperar aprobación es el estado
    // normal de una acción recién agendada, no un problema que reportar.
    if (freno && freno.tipo !== "sin_aprobar") {
      await marcarFrenada(Number(r.id), freno);
      frenadas++;
    }
  }

  const despacho = await despacharUna(ahora, ctx);
  return { evaluadas: vencidas.rows.length, frenadas, despacho };
}
