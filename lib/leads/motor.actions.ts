"use server";

// Las acciones del panel de despacho.
//
// Todas empiezan por `requireDespachador()` y no por `requireSesionMotor()`: son
// las acciones con destinatario externo —alguien va a recibir un mensaje— y se
// reservan igual que publicar un informe al directorio en el tablero. Un
// analista mira la cola y carga señales; no dispara.
//
// El proxy es una primera barrera, no la autorización: cada acción vuelve a
// pedir la sesión.

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { encenderMotor } from "./config";
import { tick } from "./despacho";
import { inscribir } from "./planificador";
import { registrarSenal, tipoSenal, vencerSenales } from "./senales";
import { requireDespachador, requireSesionMotor } from "./sesion";
import type { LeadOrigen } from "@/db/leads";

const RUTA = "/dashboard360/motor";

function refrescar() {
  revalidatePath(RUTA);
  revalidatePath(`${RUTA}/senales`);
  revalidatePath(`${RUTA}/emisores`);
}

export interface EstadoAccion {
  error?: string;
  ok?: string;
}

// ─── Candado 1 · aprobación por lote ─────────────────────────────────────────

/**
 * Aprueba todo lo que está pendiente y vencido para hoy.
 *
 * **Por lote y no por mensaje.** Un candado que exige aprobar de a uno no
 * escala, y un candado que no escala se termina desactivando "por esta vez" —
 * que es la forma más común de que un control deje de existir en la práctica.
 *
 * Queda registrado quién aprobó y cuándo: si mañana alguien pregunta por un
 * mensaje puntual, la respuesta no puede ser "lo aprobó el sistema".
 */
export async function aprobarLoteAction(formData: FormData): Promise<void> {
  const sesion = await requireDespachador();
  const ids = formData
    .getAll("accion")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length > 0) {
    await db.execute(sql`
      UPDATE lead_acciones
         SET estado = 'aprobada', aprobada_por = ${sesion.userId}, aprobada_en = NOW(),
             motivo = NULL
       WHERE estado = 'pendiente'
         AND id = ANY(${sql.raw(`ARRAY[${ids.join(",")}]::int[]`)})
    `);
  } else {
    // Sin selección explícita se aprueba la cola visible del día. Es el camino
    // normal: se revisa la pantalla y se aprueba lo que está ahí.
    await db.execute(sql`
      UPDATE lead_acciones
         SET estado = 'aprobada', aprobada_por = ${sesion.userId}, aprobada_en = NOW(),
             motivo = NULL
       WHERE estado = 'pendiente'
         AND fecha_chile <= (NOW() AT TIME ZONE 'America/Santiago')::date
    `);
  }

  refrescar();
}

/** Devuelve una acción aprobada a pendiente, para sacarla del lote sin cancelarla. */
export async function desaprobarAccionAction(formData: FormData): Promise<void> {
  await requireDespachador();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await db.execute(sql`
    UPDATE lead_acciones
       SET estado = 'pendiente', aprobada_por = NULL, aprobada_en = NULL
     WHERE id = ${id} AND estado = 'aprobada'
  `);
  refrescar();
}

/**
 * Cancela una acción para siempre.
 *
 * Distinto de frenarla: una frenada vuelve sola cuando cambia la condición
 * —mañana hay cuota otra vez—; una cancelada no vuelve. Por eso el motivo se
 * escribe a mano y no lo pone `motivo.ts`.
 */
export async function cancelarAccionAction(formData: FormData): Promise<void> {
  const sesion = await requireDespachador();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await db.execute(sql`
    UPDATE lead_acciones
       SET estado = 'cancelada', motivo = ${`cancelada:Cancelada por ${sesion.nombre}`.slice(0, 60)}
     WHERE id = ${id} AND estado IN ('pendiente', 'aprobada', 'frenada')
  `);
  refrescar();
}

// ─── Candado 3 · el interruptor general ──────────────────────────────────────

export async function alternarMotorAction(formData: FormData): Promise<void> {
  await requireDespachador();
  await encenderMotor(formData.get("encender") === "1");
  refrescar();
}

/**
 * Activa o pausa una campaña.
 *
 * Apagar `simulado` es una acción aparte y a propósito: activar una campaña es
 * decir "esto ya está listo"; apagar el simulado es decir "y además puede tocar
 * la red". Juntarlas en un botón haría que el primer clic mandara mensajes.
 */
export async function estadoCampanaAction(formData: FormData): Promise<void> {
  await requireDespachador();
  const id = Number(formData.get("id"));
  const estado = String(formData.get("estado") ?? "");
  if (!Number.isInteger(id) || !["borrador", "activa", "pausada", "terminada"].includes(estado)) {
    return;
  }
  await db.execute(sql`UPDATE lead_campanas SET estado = ${estado} WHERE id = ${id}`);
  refrescar();
}

export async function simuladoCampanaAction(formData: FormData): Promise<void> {
  await requireDespachador();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const simulado = formData.get("simulado") === "1";
  await db.execute(sql`UPDATE lead_campanas SET simulado = ${simulado} WHERE id = ${id}`);
  refrescar();
}

// ─── Correr el tick a mano ───────────────────────────────────────────────────

/**
 * Ejecuta un tick ahora, sin esperar al cron.
 *
 * Sirve para dos cosas: ver la banda C poblada el primer día, y comprobar
 * después de un cambio que la cola hace lo que uno cree. No saltea ningún
 * candado — es exactamente lo mismo que corre Vercel.
 */
export async function correrTickAction(): Promise<void> {
  await requireDespachador();
  await vencerSenales();
  await tick();
  refrescar();
}

// ─── Señales ─────────────────────────────────────────────────────────────────

export async function crearSenalAction(
  _prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  await requireSesionMotor();

  const empresaId = Number(formData.get("empresaId"));
  const tipo = String(formData.get("tipo") ?? "");
  const resumen = String(formData.get("resumen") ?? "").trim();
  const url = String(formData.get("evidenciaUrl") ?? "").trim();
  const fecha = String(formData.get("fechaHecho") ?? "").trim();

  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    return { error: "Elegí una empresa de la lista" };
  }
  const t = tipoSenal(tipo);
  if (!t) return { error: "Elegí un tipo de señal" };

  // El resumen es lo que termina EN EL MENSAJE, así que se valida como texto y
  // no como campo. Un resumen de tres palabras produce una frase absurda.
  if (resumen.length < 10) {
    return { error: "El resumen es lo que se cita en el mensaje: escribí una frase completa" };
  }
  if (resumen.length > 200) {
    return { error: "El resumen tiene que caber en una línea del mensaje: máximo 200 caracteres" };
  }

  // "Otra" exige URL: es el único tipo que no viene de una fuente conocida, y
  // una señal que nadie puede verificar no sostiene el interés legítimo.
  if (tipo === "otra" && !url) {
    return { error: "Una señal de tipo «otra» necesita el enlace que la prueba" };
  }
  if (url && !/^https?:\/\//i.test(url)) {
    return { error: "El enlace tiene que empezar con http:// o https://" };
  }

  if (!fecha) return { error: "Falta la fecha del hecho" };
  const fechaHecho = new Date(`${fecha}T12:00:00Z`);
  if (Number.isNaN(fechaHecho.getTime())) return { error: "La fecha no se entiende" };
  if (fechaHecho > new Date()) {
    return { error: "La fecha del hecho no puede estar en el futuro" };
  }

  // Todo lo que entra por esta pantalla es `manual`, aunque el hecho venga de
  // ChileCompra: la procedencia registra CÓMO llegó el dato a la base, no de
  // dónde lo copió la persona. Cuando el cron lo traiga solo, va a escribir
  // `chilecompra`, y esa diferencia es la que permite auditar la ingesta.
  const origen: LeadOrigen = "manual";
  const { venceEn } = await registrarSenal({
    empresaId,
    tipo,
    resumen,
    evidenciaUrl: url || null,
    fechaHecho,
    origen,
  });

  refrescar();

  const dias = Math.ceil((venceEn.getTime() - Date.now()) / 86_400_000);
  return {
    ok:
      dias > 0
        ? `Señal registrada. Vence en ${dias} día${dias === 1 ? "" : "s"} — después de eso deja de habilitar un primer contacto.`
        : "Señal registrada, pero su ventana ya venció: no va a habilitar ningún primer contacto.",
  };
}

// ─── Inscribir ───────────────────────────────────────────────────────────────

/**
 * Inscribe en la campaña a todas las personas de una empresa con señal vigente.
 *
 * Se inscribe por empresa y no por persona porque la señal es de la empresa: es
 * el hecho que habilita el contacto con cualquiera de sus decisores.
 */
export async function inscribirEmpresaAction(
  _prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  await requireDespachador();

  const empresaId = Number(formData.get("empresaId"));
  const campanaId = Number(formData.get("campanaId"));
  if (!Number.isInteger(empresaId) || !Number.isInteger(campanaId)) {
    return { error: "Falta la empresa o la campaña" };
  }

  const personas = await db.execute<{ id: number }>(sql`
    SELECT id FROM lead_personas
     WHERE empresa_id = ${empresaId} AND suprimido_en IS NULL
  `);
  if (personas.rows.length === 0) {
    return {
      error:
        "Esa empresa no tiene contactos cargados. Hay que enriquecerla antes de que la señal venza.",
    };
  }

  const r = await inscribir(
    personas.rows.map((p) => p.id),
    campanaId,
  );
  refrescar();

  const partes: string[] = [];
  if (r.inscritos) partes.push(`${r.inscritos} inscrito${r.inscritos === 1 ? "" : "s"}`);
  if (r.yaInscritos) partes.push(`${r.yaInscritos} ya estaba${r.yaInscritos === 1 ? "" : "n"}`);
  if (r.sinSenal) partes.push(`${r.sinSenal} sin señal vigente`);
  if (r.sinCarril) partes.push(`${r.sinCarril} sin canal disponible`);

  if (r.errores.length) return { error: r.errores.join(" · ") };
  return { ok: partes.join(" · ") || "No había nada que inscribir" };
}

// ─── Emisores ────────────────────────────────────────────────────────────────

/**
 * Ajusta un emisor.
 *
 * Ninguno de estos números va en el código, y es deliberado: LinkedIn no publica
 * sus límites y los modula por cuenta —la detección opera sobre la desviación
 * respecto del baseline de cada cuenta, no sobre umbrales absolutos—. Cien
 * invitaciones a la semana son enormes para una cuenta nueva y rutina para una
 * de cinco años con 8.000 conexiones. Son configuración, no constantes.
 *
 * El techo duro de 25 sí está en el código, y es lo único que no se puede subir
 * desde la pantalla: es el punto donde el consenso deja de existir y empieza la
 * anécdota.
 */
export async function actualizarEmisorAction(formData: FormData): Promise<void> {
  await requireDespachador();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const cuota = Math.max(1, Math.min(25, Number(formData.get("cuotaDiaria")) || 5));
  const warmup = Math.max(1, Number(formData.get("diaWarmup")) || 1);
  const inicio = Math.max(0, Math.min(23, Number(formData.get("ventanaInicio")) || 9));
  const fin = Math.max(inicio + 1, Math.min(24, Number(formData.get("ventanaFin")) || 18));
  const estado = String(formData.get("estado") ?? "warmup");
  const unipile = String(formData.get("unipileAccountId") ?? "").trim() || null;

  if (!["activo", "warmup", "frenado", "pausado", "restringido"].includes(estado)) return;

  await db.execute(sql`
    UPDATE lead_emisores
       SET cuota_diaria = ${cuota}, dia_warmup = ${warmup},
           ventana_inicio = ${inicio}, ventana_fin = ${fin},
           estado = ${estado}, unipile_account_id = ${unipile}
     WHERE id = ${id}
  `);
  refrescar();
}

export async function crearEmisorAction(
  _prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  await requireDespachador();

  const tipo = String(formData.get("tipo") ?? "linkedin");
  const identificador = String(formData.get("identificador") ?? "").trim();
  if (!["linkedin", "email", "whatsapp"].includes(tipo)) return { error: "Tipo no válido" };
  if (identificador.length < 3) {
    return { error: "Poné el perfil de LinkedIn o el buzón que va a emitir" };
  }

  // Nace en warm-up con 5 al día. No es un default conservador por prudencia
  // genérica: una cuenta nueva que arranca en 20 es la forma más rápida de
  // perderla, y el historial de la cuenta no se puede recuperar después.
  await db.execute(sql`
    INSERT INTO lead_emisores (tipo, identificador, cuota_diaria, dia_warmup, estado)
    VALUES (${tipo}, ${identificador}, 5, 1, 'warmup')
  `);
  refrescar();
  return { ok: `Emisor creado en warm-up: 5 envíos al día la primera semana.` };
}
