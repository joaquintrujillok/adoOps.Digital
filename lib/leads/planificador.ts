// Inscribir prospectos y agendar sus pasos.
//
// Es lo que llena la cola que después despacha `despacho.ts`. Dos reglas
// gobiernan todo lo de acá:
//
//   1. **Ningún primer toque sin señal vigente.** No es una regla de estilo: es
//      lo que sube la tasa de aceptación —la métrica que decide si LinkedIn te
//      deja operar— y lo que sostiene el interés legítimo bajo la Ley 21.719.
//      Un prospecto sin señal no entra a la campaña; se queda en la base.
//
//   2. **Un solo toque por persona y por día, sumando canales.** La garantiza el
//      índice único parcial de `lead_acciones`. Acá se maneja el conflicto
//      corriendo la fecha, en vez de dejar que el insert reviente.

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { conJitter, fechaChile, sumarDiasHabiles } from "./reloj";
import { elegirCarril } from "./escalera";
import { renderizarPaso, PlantillaInvalida } from "./plantillas";

export interface ResultadoInscripcion {
  inscritos: number;
  sinSenal: number;
  sinCarril: number;
  yaInscritos: number;
  errores: string[];
}

// El índice abierto lo exige `db.execute<T>`: neon-http tipa las filas como
// `Record<string, unknown>` y una interfaz cerrada no lo satisface.
interface Paso {
  orden: number;
  esperaDias: number;
  canal: string;
  tipo: string;
  plantilla: string;
  [columna: string]: unknown;
}

/** Cuántos días hacia adelante se busca hueco antes de rendirse. */
const MAX_CORRIMIENTO = 10;

/**
 * Agenda una acción respetando el tope de una por persona y por día.
 *
 * El índice único rechaza el segundo insert del mismo día. En vez de propagar
 * el error, se corre al siguiente día hábil: el prospecto no pierde su lugar en
 * la secuencia, solo se atrasa un día. Rendirse después de diez intentos evita
 * un bucle si algo más está mal.
 */
async function agendarAccion(a: {
  inscripcionId: number;
  personaId: number;
  emisorId: number | null;
  tipo: string;
  canal: string;
  cuerpo: string;
  desde: Date;
  esperaDias: number;
  ventana: { inicio: number; fin: number };
}): Promise<Date | null> {
  let dia = sumarDiasHabiles(a.desde, a.esperaDias);

  for (let intento = 0; intento < MAX_CORRIMIENTO; intento++) {
    const programada = conJitter(dia, a.ventana);
    const fecha = fechaChile(programada);

    try {
      await db.execute(sql`
        INSERT INTO lead_acciones
          (inscripcion_id, persona_id, emisor_id, tipo, canal, programada_en, fecha_chile, estado, cuerpo)
        VALUES (${a.inscripcionId}, ${a.personaId}, ${a.emisorId}, ${a.tipo}, ${a.canal},
                ${programada}, ${fecha}, 'pendiente', ${a.cuerpo})
      `);
      return programada;
    } catch (e) {
      // 23505 = unique_violation. Cualquier otro error sí es un problema real.
      const msg = e instanceof Error ? e.message : String(e);
      if (!/duplicate key|23505|un_toque_dia/i.test(msg)) throw e;
      dia = sumarDiasHabiles(dia, 1);
    }
  }

  return null;
}

/**
 * Inscribe personas en una campaña y les agenda el primer paso.
 *
 * La señal que se usa es la MÁS RECIENTE vigente de su empresa, y queda anclada
 * en `lead_inscripciones.senal_id`: es la que se cita en el primer mensaje y la
 * que hay que poder mostrar si alguien pregunta por qué se le escribió.
 */
export async function inscribir(
  personaIds: number[],
  campanaId: number,
): Promise<ResultadoInscripcion> {
  const r: ResultadoInscripcion = {
    inscritos: 0,
    sinSenal: 0,
    sinCarril: 0,
    yaInscritos: 0,
    errores: [],
  };
  if (personaIds.length === 0) return r;

  const campana = await db.execute<{
    id: number;
    emisor_id: number | null;
    ventana_inicio: number | null;
    ventana_fin: number | null;
  }>(sql`
    SELECT c.id, c.emisor_id, e.ventana_inicio, e.ventana_fin
      FROM lead_campanas c
      LEFT JOIN lead_emisores e ON e.id = c.emisor_id
     WHERE c.id = ${campanaId}
  `);
  if (!campana.rows[0]) {
    r.errores.push("La campaña no existe");
    return r;
  }
  const emisorId = campana.rows[0].emisor_id;
  const ventana = {
    inicio: campana.rows[0].ventana_inicio ?? 9,
    fin: campana.rows[0].ventana_fin ?? 18,
  };

  const pasos = await db.execute<Paso>(sql`
    SELECT orden, espera_dias AS "esperaDias", canal, tipo, plantilla
      FROM lead_secuencias
     WHERE campana_id = ${campanaId}
     ORDER BY orden ASC
  `);
  const primerPaso = pasos.rows[0];
  if (!primerPaso) {
    r.errores.push("La campaña no tiene pasos definidos");
    return r;
  }

  // Una consulta para todas las personas: la señal vigente más reciente de su
  // empresa, más los datos que necesita la escalera para elegir carril.
  const datos = await db.execute<{
    id: number;
    nombre: string;
    cargo: string | null;
    member_urn: string | null;
    email: string | null;
    email_verificado: boolean | null;
    es_open_profile: boolean | null;
    network_distance: number | null;
    razon_social: string | null;
    senal_id: number | null;
    senal_resumen: string | null;
    ya_inscrita: number;
  }>(sql`
    SELECT p.id, p.nombre, p.cargo, p.member_urn, p.email, p.email_verificado,
           p.es_open_profile, p.network_distance,
           emp.razon_social,
           s.id AS senal_id, s.resumen AS senal_resumen,
           (SELECT count(*)::int FROM lead_inscripciones i
             WHERE i.persona_id = p.id AND i.campana_id = ${campanaId}) AS ya_inscrita
      FROM lead_personas p
      LEFT JOIN lead_empresas emp ON emp.id = p.empresa_id
      LEFT JOIN LATERAL (
        SELECT sx.id, sx.resumen
          FROM lead_senales sx
         WHERE sx.empresa_id = p.empresa_id
           AND sx.estado = 'vigente'
           AND sx.vence_en > NOW()
         ORDER BY sx.fecha_hecho DESC
         LIMIT 1
      ) s ON TRUE
     WHERE p.id = ANY(${sql.raw(`ARRAY[${personaIds.map(Number).join(",") || "NULL"}]::int[]`)})
       AND p.suprimido_en IS NULL
  `);

  for (const p of datos.rows) {
    if (p.ya_inscrita > 0) {
      r.yaInscritos++;
      continue;
    }
    if (!p.senal_id) {
      r.sinSenal++;
      continue;
    }

    const carril = elegirCarril({
      memberUrn: p.member_urn,
      email: p.email,
      emailVerificado: p.email_verificado,
      esOpenProfile: p.es_open_profile,
      networkDistance: p.network_distance,
    });
    if (!carril) {
      r.sinCarril++;
      continue;
    }

    let cuerpo: string;
    try {
      cuerpo = renderizarPaso(carril.tipo, primerPaso.plantilla, {
        nombre: p.nombre,
        empresa: p.razon_social,
        senal: p.senal_resumen,
        cargo: p.cargo,
      });
    } catch (e) {
      if (e instanceof PlantillaInvalida) {
        r.errores.push(`${p.nombre}: ${e.message}`);
        continue;
      }
      throw e;
    }

    const creada = await db.execute<{ id: number }>(sql`
      INSERT INTO lead_inscripciones (persona_id, campana_id, senal_id, estado, paso_actual)
      VALUES (${p.id}, ${campanaId}, ${p.senal_id}, 'pendiente', 0)
      ON CONFLICT (persona_id, campana_id) DO NOTHING
      RETURNING id
    `);
    const inscripcionId = creada.rows[0]?.id;
    if (!inscripcionId) {
      r.yaInscritos++;
      continue;
    }

    // El carril elegido manda sobre el `tipo` de la secuencia: el paso 1 dice
    // "invitacion" porque es el caso más común, pero si la persona ya es
    // contacto de primer grado gastar una invitación sería absurdo.
    const programada = await agendarAccion({
      inscripcionId,
      personaId: p.id,
      emisorId,
      tipo: carril.tipo,
      canal: carril.canal,
      cuerpo,
      desde: new Date(),
      esperaDias: primerPaso.esperaDias ?? 0,
      ventana,
    });

    if (!programada) {
      r.errores.push(`${p.nombre}: no encontré día libre en ${MAX_CORRIMIENTO} días hábiles`);
      continue;
    }

    await db.execute(sql`
      UPDATE lead_inscripciones SET proximo_paso_en = ${programada} WHERE id = ${inscripcionId}
    `);
    r.inscritos++;
  }

  return r;
}

/**
 * Agenda el paso siguiente de una inscripción que acaba de recibir un toque.
 *
 * Se llama después de un envío exitoso. Si ya no hay más pasos, la inscripción
 * queda en `agotado`: cinco toques sin respuesta es donde termina la secuencia,
 * y seguir insistiendo no mejora la conversión.
 */
export async function agendarSiguiente(inscripcionId: number): Promise<Date | null> {
  const info = await db.execute<{
    persona_id: number;
    campana_id: number;
    paso_actual: number;
    emisor_id: number | null;
    ventana_inicio: number | null;
    ventana_fin: number | null;
    nombre: string;
    cargo: string | null;
    razon_social: string | null;
    senal_resumen: string | null;
  }>(sql`
    SELECT i.persona_id, i.campana_id, i.paso_actual, c.emisor_id,
           e.ventana_inicio, e.ventana_fin,
           p.nombre, p.cargo, emp.razon_social, s.resumen AS senal_resumen
      FROM lead_inscripciones i
      JOIN lead_campanas c ON c.id = i.campana_id
      JOIN lead_personas p ON p.id = i.persona_id
      LEFT JOIN lead_emisores e ON e.id = c.emisor_id
      LEFT JOIN lead_empresas emp ON emp.id = p.empresa_id
      LEFT JOIN lead_senales s ON s.id = i.senal_id
     WHERE i.id = ${inscripcionId}
  `);
  const i = info.rows[0];
  if (!i) return null;

  const siguiente = await db.execute<Paso>(sql`
    SELECT orden, espera_dias AS "esperaDias", canal, tipo, plantilla
      FROM lead_secuencias
     WHERE campana_id = ${i.campana_id} AND orden = ${i.paso_actual + 1}
     LIMIT 1
  `);
  const paso = siguiente.rows[0];

  if (!paso) {
    await db.execute(sql`
      UPDATE lead_inscripciones
         SET estado = 'agotado', proximo_paso_en = NULL, actualizado_en = NOW()
       WHERE id = ${inscripcionId}
    `);
    return null;
  }

  const cuerpo = renderizarPaso(paso.tipo, paso.plantilla, {
    nombre: i.nombre,
    empresa: i.razon_social,
    senal: i.senal_resumen,
    cargo: i.cargo,
  });

  const programada = await agendarAccion({
    inscripcionId,
    personaId: i.persona_id,
    emisorId: i.emisor_id,
    tipo: paso.tipo,
    canal: paso.canal,
    cuerpo,
    desde: new Date(),
    esperaDias: paso.esperaDias ?? 0,
    ventana: { inicio: i.ventana_inicio ?? 9, fin: i.ventana_fin ?? 18 },
  });

  if (programada) {
    await db.execute(sql`
      UPDATE lead_inscripciones
         SET proximo_paso_en = ${programada}, actualizado_en = NOW()
       WHERE id = ${inscripcionId}
    `);
  }
  return programada;
}

/**
 * Una respuesta detiene TODO y abre hilo humano.
 *
 * Es la diferencia entre nurturing y una máquina de spam, y por eso cancela las
 * acciones pendientes en vez de solo marcar la inscripción: si quedaran
 * agendadas, el paso 3 saldría igual tres días después de que la persona
 * contestó.
 */
export async function marcarRespondio(personaId: number): Promise<void> {
  await db.execute(sql`
    UPDATE lead_inscripciones
       SET estado = 'respondio', respondio_en = NOW(), proximo_paso_en = NULL,
           actualizado_en = NOW()
     WHERE persona_id = ${personaId}
       AND estado IN ('pendiente', 'invitado', 'conectado', 'en_secuencia')
  `);
  await db.execute(sql`
    UPDATE lead_acciones
       SET estado = 'cancelada', motivo = 'ya_respondio:Respondió · salió de la automatización'
     WHERE persona_id = ${personaId}
       AND estado IN ('pendiente', 'aprobada')
  `);
}
