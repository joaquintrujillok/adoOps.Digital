// Lecturas y escrituras de Pulso IA.
//
// Todo lo que sale hacia las pantallas públicas pasa por `estadoSala()`, que
// nunca incluye nombre, correo ni teléfono. Los datos de contacto solo los ve
// el panel, detrás de sesión.

import { and, asc, desc, eq, ilike, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { leadEmpresas, leadPersonas, leadSenales } from "@/db/leads";
import { ventaContactos, ventaEmpresas } from "@/db/venta";
import { pulsoRespuestas, pulsoSesiones, type PulsoFase, type PulsoSesion } from "@/db/pulso";
import { normalizarEmail, normalizarRut } from "@/lib/leads/normalizar";
import { normalizarTelefono } from "@/lib/crm/telefono";
import { url } from "@/lib/site";
import {
  CUADRANTES,
  EXPECTATIVA,
  FRENOS,
  ROLES,
  USO,
  cuadranteDe,
  ejeExpectativa,
  ejeUso,
  posicion,
  palabrasFrecuentes,
  type Cuadrante,
  type EstadoSala,
} from "./modelo";

const VALORES_USO = new Set(USO.map((o) => Number(o.valor)));
const VALORES_FRENO = new Set(FRENOS.map((o) => o.valor));
const VALORES_ROL = new Set(ROLES.map((o) => o.valor));
const VALORES_EXP = new Set(EXPECTATIVA.map((o) => o.valor));

export function codigoValido(codigo: string): boolean {
  return /^[A-Z0-9]{3,12}$/.test(codigo);
}

export function tokenValido(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{16,40}$/.test(token);
}

export async function sesionPorCodigo(codigo: string): Promise<PulsoSesion | null> {
  const c = codigo.toUpperCase();
  if (!codigoValido(c)) return null;
  const [s] = await db.select().from(pulsoSesiones).where(eq(pulsoSesiones.codigo, c)).limit(1);
  return s ?? null;
}

// ─── La sala, agregada ───────────────────────────────────────────────────────

export async function estadoSala(codigo: string): Promise<EstadoSala | null> {
  const s = await sesionPorCodigo(codigo);
  if (!s) return null;

  const filas = await db
    .select({
      id: pulsoRespuestas.id,
      uso: pulsoRespuestas.uso,
      expectativa: pulsoRespuestas.expectativa,
      expectativaCierre: pulsoRespuestas.expectativaCierre,
      freno: pulsoRespuestas.freno,
      frenoCierre: pulsoRespuestas.frenoCierre,
      rol: pulsoRespuestas.rol,
      cuadrante: pulsoRespuestas.cuadrante,
      tarea: pulsoRespuestas.tarea,
    })
    .from(pulsoRespuestas)
    .where(eq(pulsoRespuestas.sesionId, s.id))
    .orderBy(asc(pulsoRespuestas.id));

  const cuadrantes: Record<Cuadrante, number> = { observador: 0, curioso: 0, practico: 0, impulsor: 0 };
  // Cuántos van ya en cada celda: el índice dentro de la celda decide la espiral.
  const ocupadas = new Map<string, number>();
  const turno = (u: number, e: number) => {
    const clave = `${u}:${e}`;
    const k = ocupadas.get(clave) ?? 0;
    ocupadas.set(clave, k + 1);
    return k;
  };
  const puntos = filas.map((f) => {
    const q = f.cuadrante as Cuadrante;
    cuadrantes[q] = (cuadrantes[q] ?? 0) + 1;
    const p = posicion(f.uso, f.expectativa, turno(f.uso, f.expectativa));
    const c = f.expectativaCierre ? posicion(f.uso, f.expectativaCierre, turno(f.uso, f.expectativaCierre)) : null;
    return { id: f.id, x: p.x, y: p.y, rol: f.rol, cuadrante: q, yCierre: c ? c.y : null };
  });

  const conCierre = filas.filter((f) => f.expectativaCierre != null);
  const promedio = (xs: number[]) =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

  const frenos = FRENOS.map((o) => ({
    valor: o.valor,
    texto: o.texto,
    inicio: filas.filter((f) => f.freno === o.valor).length,
    cierre: filas.filter((f) => f.frenoCierre === o.valor).length,
  }));

  const tareas = filas.map((f) => f.tarea?.trim()).filter((t): t is string => !!t);

  return {
    codigo: s.codigo,
    titulo: s.titulo,
    organizacion: s.organizacion,
    relator: s.relator,
    fase: s.fase as PulsoFase,
    total: filas.length,
    conCierre: conCierre.length,
    puntos,
    cuadrantes,
    frenos,
    // Comparables: el promedio de inicio se calcula sobre quienes respondieron
    // el cierre, si hay alguno. Si no, el contraste mezclaría salas distintas
    // (los que se fueron antes con los que se quedaron).
    expectativaInicio: promedio(
      (conCierre.length ? conCierre : filas).map((f) => f.expectativa),
    ),
    expectativaCierre: promedio(conCierre.map((f) => f.expectativaCierre!)),
    palabras: palabrasFrecuentes(tareas),
    tareas: tareas.slice(-12).reverse(),
  };
}

// ─── Lo que manda el celular ─────────────────────────────────────────────────

export interface MiRespuesta {
  id: number;
  cuadrante: Cuadrante;
  respondioCierre: boolean;
  dejoDatos: boolean;
}

export async function miRespuesta(sesionId: number, token: string): Promise<MiRespuesta | null> {
  const [r] = await db
    .select({
      id: pulsoRespuestas.id,
      cuadrante: pulsoRespuestas.cuadrante,
      cierreEn: pulsoRespuestas.cierreEn,
      contactoEn: pulsoRespuestas.contactoEn,
    })
    .from(pulsoRespuestas)
    .where(and(eq(pulsoRespuestas.sesionId, sesionId), eq(pulsoRespuestas.token, token)))
    .limit(1);
  if (!r) return null;
  return {
    id: r.id,
    cuadrante: r.cuadrante as Cuadrante,
    respondioCierre: !!r.cierreEn,
    dejoDatos: !!r.contactoEn,
  };
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

export async function guardarInicio(
  sesion: PulsoSesion,
  token: string,
  d: { uso: unknown; tarea: unknown; freno: unknown; expectativa: unknown; rol: unknown },
): Promise<Resultado<{ id: number; cuadrante: Cuadrante }>> {
  if (sesion.fase === "cerrada") return { ok: false, error: "Esta sesión ya cerró." };
  const uso = Number(d.uso);
  const expectativa = Number(d.expectativa);
  const freno = String(d.freno ?? "");
  const rol = String(d.rol ?? "");
  if (!VALORES_USO.has(uso) || !VALORES_EXP.has(expectativa) || !VALORES_FRENO.has(freno) || !VALORES_ROL.has(rol)) {
    return { ok: false, error: "Falta responder alguna pregunta." };
  }
  const tarea = typeof d.tarea === "string" ? d.tarea.trim().slice(0, 280) || null : null;
  const cuadrante = cuadranteDe(uso, expectativa);

  // Upsert por (sesión, token): si recarga y vuelve a responder, corrige su
  // punto en vez de sumar otro.
  const [fila] = await db
    .insert(pulsoRespuestas)
    .values({ sesionId: sesion.id, token, uso, tarea, freno, expectativa, rol, cuadrante })
    .onConflictDoUpdate({
      target: [pulsoRespuestas.sesionId, pulsoRespuestas.token],
      set: { uso, tarea, freno, expectativa, rol, cuadrante },
    })
    .returning({ id: pulsoRespuestas.id });
  return { ok: true, valor: { id: fila.id, cuadrante } };
}

export async function guardarCierre(
  sesion: PulsoSesion,
  token: string,
  d: { expectativaCierre: unknown; frenoCierre: unknown },
): Promise<Resultado<null>> {
  if (sesion.fase !== "cierre") return { ok: false, error: "El cierre todavía no está abierto." };
  const e = Number(d.expectativaCierre);
  const f = String(d.frenoCierre ?? "");
  if (!VALORES_EXP.has(e) || !VALORES_FRENO.has(f)) return { ok: false, error: "Falta responder alguna pregunta." };
  const r = await db
    .update(pulsoRespuestas)
    .set({ expectativaCierre: e, frenoCierre: f, cierreEn: new Date() })
    .where(and(eq(pulsoRespuestas.sesionId, sesion.id), eq(pulsoRespuestas.token, token)))
    .returning({ id: pulsoRespuestas.id });
  if (!r.length) return { ok: false, error: "No encontramos tus respuestas del inicio." };
  return { ok: true, valor: null };
}

/**
 * Los datos de contacto, al final de la dinámica. Sin consentimiento no se
 * guarda nada: la casilla no es decoración, es la base para escribirle después.
 */
export async function guardarContacto(
  sesion: PulsoSesion,
  token: string,
  d: { nombre: unknown; cargo: unknown; email: unknown; telefono: unknown; consiente: unknown },
): Promise<Resultado<{ id: number; cuadrante: Cuadrante; email: string | null; nombre: string }>> {
  if (d.consiente !== true) return { ok: false, error: "Necesitamos tu autorización para escribirte." };
  const nombre = typeof d.nombre === "string" ? d.nombre.trim().slice(0, 160) : "";
  const cargo = typeof d.cargo === "string" ? d.cargo.trim().slice(0, 200) || null : null;
  const email = normalizarEmail(typeof d.email === "string" ? d.email : null);
  const telefono = normalizarTelefono(typeof d.telefono === "string" ? d.telefono : null);
  if (!nombre) return { ok: false, error: "Cuéntanos tu nombre." };
  if (!email && !telefono) return { ok: false, error: "Déjanos un correo o un WhatsApp." };

  const [fila] = await db
    .update(pulsoRespuestas)
    .set({ nombre, cargo, email, telefono, consiente: true, contactoEn: new Date() })
    .where(and(eq(pulsoRespuestas.sesionId, sesion.id), eq(pulsoRespuestas.token, token)))
    .returning({ id: pulsoRespuestas.id, cuadrante: pulsoRespuestas.cuadrante });
  if (!fila) return { ok: false, error: "No encontramos tus respuestas." };

  // Al motor de prospección. Si falla, el contacto igual quedó guardado acá y
  // se puede pasar después: no se le muestra un error a alguien en plena charla.
  try {
    const personaId = await registrarEnMotor(sesion, { nombre, cargo, email, telefono });
    if (personaId) {
      await db.update(pulsoRespuestas).set({ leadPersonaId: personaId }).where(eq(pulsoRespuestas.id, fila.id));
    }
  } catch (e) {
    console.error("[pulso] no se pudo pasar al motor:", e);
  }

  // Y a Contactos del CRM, que es donde el equipo mira a la gente con la que
  // ya habló. Mismo trato que el motor: si falla, no se le muestra a nadie.
  try {
    await registrarEnCrm(sesion, { nombre, cargo, email, telefono }, fila.cuadrante as Cuadrante);
  } catch (e) {
    console.error("[pulso] no se pudo pasar al CRM:", e);
  }

  return { ok: true, valor: { id: fila.id, cuadrante: fila.cuadrante as Cuadrante, email, nombre } };
}

// ─── El CRM ──────────────────────────────────────────────────────────────────

/**
 * Deja a la persona en Contactos del CRM (`venta_contactos`), bajo la
 * organización de la charla.
 *
 * No crea una oportunidad: dejar los datos al final de una charla es permiso
 * para que te escriban, no un negocio. La oportunidad la abre una persona del
 * equipo cuando hay algo que vender; mientras tanto el contacto aparece en la
 * lista con la nota de dónde salió.
 *
 * Se busca por correo y, si no dio correo, por teléfono: la misma persona en
 * dos charlas —o volviendo a enviar el formulario— no debe quedar dos veces. Al
 * encontrarla solo se rellenan huecos, y la nota nueva se agrega a la anterior.
 */
async function registrarEnCrm(
  sesion: PulsoSesion,
  p: { nombre: string; cargo: string | null; email: string | null; telefono: string | null },
  cuadrante: Cuadrante,
): Promise<void> {
  const organizacion = sesion.organizacion.trim();
  let empresaId: number | null = null;
  if (organizacion) {
    const [e] = await db
      .select({ id: ventaEmpresas.id })
      .from(ventaEmpresas)
      .where(sql`lower(${ventaEmpresas.nombre}) = lower(${organizacion})`)
      .limit(1);
    empresaId = e
      ? e.id
      : (await db.insert(ventaEmpresas).values({ nombre: organizacion.slice(0, 200) }).returning({ id: ventaEmpresas.id }))[0].id;
  }

  const nota =
    `Pulso IA · charla "${sesion.titulo}" (${sesion.fecha.toLocaleDateString("es-CL")}). ` +
    `Perfil: ${CUADRANTES[cuadrante]?.nombre ?? cuadrante}. Autorizó que le escribamos.`;

  const [existe] = p.email
    ? await db
        .select({ id: ventaContactos.id })
        .from(ventaContactos)
        .where(sql`lower(${ventaContactos.email}) = ${p.email}`)
        .limit(1)
    : await db
        .select({ id: ventaContactos.id })
        .from(ventaContactos)
        .where(eq(ventaContactos.telefono, p.telefono!))
        .limit(1);

  if (existe) {
    await db
      .update(ventaContactos)
      .set({
        empresaId: sql`coalesce(${ventaContactos.empresaId}, ${empresaId})`,
        cargo: sql`coalesce(${ventaContactos.cargo}, ${p.cargo})`,
        email: sql`coalesce(${ventaContactos.email}, ${p.email})`,
        telefono: sql`coalesce(${ventaContactos.telefono}, ${p.telefono})`,
        notas: sql`case when ${ventaContactos.notas} is null then ${nota}
                        when position(${nota} in ${ventaContactos.notas}) > 0 then ${ventaContactos.notas}
                        else ${ventaContactos.notas} || E'\n' || ${nota} end`,
      })
      .where(eq(ventaContactos.id, existe.id));
    return;
  }

  await db.insert(ventaContactos).values({
    nombre: p.nombre,
    empresaId,
    cargo: p.cargo ? p.cargo.slice(0, 160) : null,
    email: p.email,
    telefono: p.telefono,
    notas: nota,
  });
}

// ─── El motor de prospección ─────────────────────────────────────────────────

/**
 * Resuelve la organización de la charla en `lead_empresas`: por RUT si se dio,
 * si no por razón social exacta (sin mayúsculas). Si no existe, la crea con
 * origen `manual`: quien la escribió fue el equipo, en el panel.
 */
export async function resolverEmpresa(organizacion: string, rutCrudo?: string | null): Promise<number> {
  const rut = normalizarRut(rutCrudo ?? null);
  if (rut) {
    const [e] = await db.select({ id: leadEmpresas.id }).from(leadEmpresas).where(eq(leadEmpresas.rut, rut)).limit(1);
    if (e) return e.id;
  }
  const [porNombre] = await db
    .select({ id: leadEmpresas.id })
    .from(leadEmpresas)
    .where(ilike(leadEmpresas.razonSocial, organizacion.trim()))
    .limit(1);
  if (porNombre) return porNombre.id;
  const [nueva] = await db
    .insert(leadEmpresas)
    .values({ razonSocial: organizacion.trim(), rut, origen: "manual" })
    .returning({ id: leadEmpresas.id });
  return nueva.id;
}

async function registrarEnMotor(
  sesion: PulsoSesion,
  p: { nombre: string; cargo: string | null; email: string | null; telefono: string | null },
): Promise<number | null> {
  if (!sesion.empresaId) return null;
  const ahora = new Date();
  if (p.email) {
    const [existe] = await db
      .select({ id: leadPersonas.id })
      .from(leadPersonas)
      .where(and(eq(leadPersonas.empresaId, sesion.empresaId), eq(leadPersonas.email, p.email)))
      .limit(1);
    if (existe) {
      // Solo rellena huecos, igual que la ingesta: nunca pisa un dato que ya estaba.
      await db
        .update(leadPersonas)
        .set({
          cargo: sql`coalesce(${leadPersonas.cargo}, ${p.cargo})`,
          telefono: sql`coalesce(${leadPersonas.telefono}, ${p.telefono})`,
        })
        .where(eq(leadPersonas.id, existe.id));
      return existe.id;
    }
  }
  const [nueva] = await db
    .insert(leadPersonas)
    .values({
      empresaId: sesion.empresaId,
      nombre: p.nombre,
      cargo: p.cargo,
      email: p.email,
      emailOrigen: p.email ? "charla" : null,
      emailObtenidoEn: p.email ? ahora : null,
      telefono: p.telefono,
      telefonoOrigen: p.telefono ? "charla" : null,
      telefonoObtenidoEn: p.telefono ? ahora : null,
    })
    .returning({ id: leadPersonas.id });
  return nueva.id;
}

/**
 * Al cerrar la sesión deja una señal en el motor: el hecho verificable que
 * justifica volver a escribirle a esa organización. Vence a los 90 días, que es
 * lo que tarda en promedio una decisión de este tipo.
 */
export async function dejarSenal(sesionId: number): Promise<void> {
  const [s] = await db.select().from(pulsoSesiones).where(eq(pulsoSesiones.id, sesionId)).limit(1);
  if (!s || !s.empresaId || s.senalId) return;
  const estado = await estadoSala(s.codigo);
  if (!estado || estado.total === 0) return;

  const dominante = (Object.entries(estado.cuadrantes) as [Cuadrante, number][]).sort((a, b) => b[1] - a[1])[0];
  const freno = [...estado.frenos].sort((a, b) => b.inicio - a.inicio)[0];
  const contactos = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(pulsoRespuestas)
    .where(and(eq(pulsoRespuestas.sesionId, s.id), isNotNull(pulsoRespuestas.contactoEn)));
  const temas = estado.palabras.slice(0, 3).map((p) => p.palabra).join(", ");

  const resumen =
    `Charla "${s.titulo}" de ${s.relator}: ${estado.total} personas respondieron el Pulso IA ` +
    `(${contactos[0]?.n ?? 0} dejaron sus datos). Perfil dominante: ${CUADRANTES[dominante[0]].nombre}. ` +
    `Freno principal: ${freno.texto.toLowerCase()}.` +
    (temas ? ` Quieren automatizar: ${temas}.` : "");

  const vence = new Date(s.fecha.getTime() + 90 * 24 * 3600 * 1000);
  const [senal] = await db
    .insert(leadSenales)
    .values({
      empresaId: s.empresaId,
      tipo: "charla",
      resumen,
      evidenciaUrl: url(`/pulso/${s.codigo}`),
      fechaHecho: s.fecha,
      venceEn: vence,
      origen: "charla",
    })
    .returning({ id: leadSenales.id });
  await db.update(pulsoSesiones).set({ senalId: senal.id }).where(eq(pulsoSesiones.id, s.id));
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export async function listarSesiones() {
  return db
    .select({
      id: pulsoSesiones.id,
      codigo: pulsoSesiones.codigo,
      titulo: pulsoSesiones.titulo,
      organizacion: pulsoSesiones.organizacion,
      relator: pulsoSesiones.relator,
      fase: pulsoSesiones.fase,
      fecha: pulsoSesiones.fecha,
      senalId: pulsoSesiones.senalId,
      respuestas: sql<number>`(select count(*)::int from pulso_respuestas r where r.sesion_id = ${pulsoSesiones.id})`,
      contactos: sql<number>`(select count(*)::int from pulso_respuestas r where r.sesion_id = ${pulsoSesiones.id} and r.contacto_en is not null)`,
    })
    .from(pulsoSesiones)
    .orderBy(desc(pulsoSesiones.fecha));
}

export async function contactosDe(sesionId: number) {
  return db
    .select({
      id: pulsoRespuestas.id,
      nombre: pulsoRespuestas.nombre,
      cargo: pulsoRespuestas.cargo,
      email: pulsoRespuestas.email,
      telefono: pulsoRespuestas.telefono,
      rol: pulsoRespuestas.rol,
      cuadrante: pulsoRespuestas.cuadrante,
      tarea: pulsoRespuestas.tarea,
      freno: pulsoRespuestas.freno,
      leadPersonaId: pulsoRespuestas.leadPersonaId,
      resultadoEnviadoEn: pulsoRespuestas.resultadoEnviadoEn,
      contactoEn: pulsoRespuestas.contactoEn,
    })
    .from(pulsoRespuestas)
    .where(and(eq(pulsoRespuestas.sesionId, sesionId), isNotNull(pulsoRespuestas.contactoEn)))
    .orderBy(asc(pulsoRespuestas.contactoEn));
}

export function nuevoCodigo(): string {
  // Sin 0/O ni 1/I: se dicta en voz alta en una sala.
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 5; i++) c += abc[Math.floor(Math.random() * abc.length)];
  return c;
}
