// Cola de envío de campañas.
//
// **Por qué una cola y no un bucle.** WaSender acepta un mensaje cada ~5 s. Una
// base de 1.200 contactos son casi dos horas, y ninguna función de Vercel vive
// tanto. Lanzar la campaña solo encola; `procesarCola()` manda lo que alcanza en
// su ventana de tiempo y se vuelve a llamar (ver /api/vanni/cron). Si algo se
// corta a la mitad, lo pendiente sigue pendiente: nada se manda dos veces
// porque cada fila se toma con un UPDATE atómico antes de enviarla.
//
// **Los contactos de ejemplo nunca salen.** Un teléfono inventado puede ser el
// de una persona real. Sus envíos se marcan enviados en modo simulado.

import { and, asc, eq, inArray, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  vanniCampanas,
  vanniContactos,
  vanniEnvios,
  vanniVariantes,
  type VanniEnvio,
} from "@/db/vanni";
import { renderPlantilla } from "./formato";
import { guardarMensaje, guardarSesion } from "./motor/conversacion";
import { entregaDeCodigo, enviarTexto, estadoMensaje } from "./wa";

/** Encola a los contactos que calzan con la campaña. Devuelve cuántos entraron. */
export async function encolarCampana(campanaId: number): Promise<number> {
  const [campana] = await db.select().from(vanniCampanas).where(eq(vanniCampanas.id, campanaId));
  if (!campana) throw new Error("Campaña no encontrada");
  const variantes = await db
    .select()
    .from(vanniVariantes)
    .where(eq(vanniVariantes.campanaId, campanaId))
    .orderBy(asc(vanniVariantes.codigo));
  if (!variantes.length) throw new Error("La campaña no tiene mensajes");

  // Quien dijo que no a las ofertas en el QR no entra; `null` (nunca se le
  // preguntó, la base de Vanni) sí.
  const filtros = [eq(vanniContactos.estado, "activo"), or(isNull(vanniContactos.consentimiento), eq(vanniContactos.consentimiento, true))!];
  if (campana.segmentos.length) filtros.push(inArray(vanniContactos.segmento, campana.segmentos));
  if (campana.sucursales.length) filtros.push(inArray(vanniContactos.sucursal, campana.sucursales));
  // Una campaña de ejemplo solo toca contactos de ejemplo, y una real solo reales.
  filtros.push(eq(vanniContactos.ejemplo, campana.ejemplo));
  const contactos = await db.select().from(vanniContactos).where(and(...filtros)).orderBy(asc(vanniContactos.id));

  if (!contactos.length) return 0;
  // Las variantes se reparten en orden (A, B, C, A, B…), no al azar: con bases
  // chicas el azar deja una variante con el doble que otra y la comparación miente.
  const filas = contactos.map((c, i) => {
    const v = variantes[i % variantes.length];
    return {
      campanaId,
      contactoId: c.id,
      varianteId: v.id,
      telefono: c.telefono,
      texto: renderPlantilla(v.plantilla, {
        nombre: (c.nombre ?? "").split(" ")[0],
        promocion: campana.promocion,
        categoria: c.categoriaHabitual ?? "tus productos habituales",
        sucursal: c.sucursal,
      }),
    };
  });
  let insertados = 0;
  for (let i = 0; i < filas.length; i += 200) {
    const r = await db
      .insert(vanniEnvios)
      .values(filas.slice(i, i + 200))
      .onConflictDoNothing()
      .returning({ id: vanniEnvios.id });
    insertados += r.length;
  }

  await db
    .update(vanniCampanas)
    .set({ estado: "enviando", iniciadaAt: campana.iniciadaAt ?? new Date() })
    .where(eq(vanniCampanas.id, campanaId));
  return insertados;
}

/** Toma el siguiente envío pendiente de una campaña activa, de forma atómica. */
async function tomarSiguiente(): Promise<VanniEnvio | null> {
  const r = await db.execute(sql`
    update vanni_envios set estado = 'enviando', intentos = intentos + 1, tomado_at = now()
    where id = (
      select e.id from vanni_envios e
      join vanni_campanas c on c.id = e.campana_id
      where e.estado = 'pendiente' and c.estado = 'enviando'
      order by e.id
      limit 1
      for update skip locked
    )
    returning id`);
  const id = (r.rows[0] as { id?: number } | undefined)?.id;
  if (!id) return null;
  const [e] = await db.select().from(vanniEnvios).where(eq(vanniEnvios.id, id));
  return e ?? null;
}

export interface ResultadoCola {
  enviados: number;
  errores: number;
  pendientes: number;
}

export async function procesarCola(maxMs = 45_000): Promise<ResultadoCola> {
  const inicio = Date.now();
  let enviados = 0;
  let errores = 0;

  // Envíos que quedaron "enviando" por una función que murió a la mitad vuelven a la cola.
  await db
    .update(vanniEnvios)
    .set({ estado: "pendiente" })
    .where(
      and(
        eq(vanniEnvios.estado, "enviando"),
        lt(vanniEnvios.intentos, 3),
        sql`${vanniEnvios.tomadoAt} < now() - interval '5 minutes'`,
      ),
    );

  while (Date.now() - inicio < maxMs) {
    const envio = await tomarSiguiente();
    if (!envio) break;
    const [contacto] = await db.select().from(vanniContactos).where(eq(vanniContactos.id, envio.contactoId));

    // Entre que se encoló y ahora, pudo haber pedido la baja.
    if (!contacto || contacto.estado === "baja") {
      await db.update(vanniEnvios).set({ estado: "cancelado" }).where(eq(vanniEnvios.id, envio.id));
      continue;
    }

    const r = contacto.ejemplo
      ? { ok: true, simulado: true, msgId: `sim-${envio.id}`, error: undefined }
      : await enviarTexto(envio.telefono, envio.texto);

    if (r.ok) {
      enviados++;
      await db
        .update(vanniEnvios)
        .set({
          estado: "enviado",
          entrega: r.simulado ? null : "enviado",
          waMsgId: r.msgId ?? null,
          enviadoAt: new Date(),
          error: null,
        })
        .where(eq(vanniEnvios.id, envio.id));
      await guardarMensaje({
        telefono: envio.telefono,
        flujo: "ofertas",
        direccion: "out",
        texto: envio.texto,
        simulado: r.simulado,
        waMsgId: r.msgId ?? null,
      });
      // La respuesta de este teléfono tiene que caer en `ofertas` y en esta campaña.
      await guardarSesion({
        telefono: envio.telefono,
        flujo: "ofertas",
        contactoId: envio.contactoId,
        campanaId: envio.campanaId,
        estado: { carrito: [] },
      });
    } else {
      errores++;
      await db
        .update(vanniEnvios)
        .set({ estado: "error", entrega: "error", error: r.error ?? "Error desconocido" })
        .where(eq(vanniEnvios.id, envio.id));
    }
  }

  // Campañas sin pendientes quedan terminadas (siguen recibiendo respuestas).
  await db.execute(sql`
    update vanni_campanas c set estado = 'terminada', terminada_at = now()
    where c.estado = 'enviando'
      and not exists (select 1 from vanni_envios e where e.campana_id = c.id and e.estado in ('pendiente','enviando'))`);

  const [p] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(vanniEnvios)
    .innerJoin(vanniCampanas, eq(vanniCampanas.id, vanniEnvios.campanaId))
    .where(and(eq(vanniEnvios.estado, "pendiente"), eq(vanniCampanas.estado, "enviando")));
  return { enviados, errores, pendientes: p?.n ?? 0 };
}

/** Aplica un código de estado de WhatsApp a un envío. Nunca retrocede (leído no vuelve a entregado). */
export async function aplicarEstado(envio: VanniEnvio, codigo: number, keyId?: string): Promise<void> {
  const entrega = entregaDeCodigo(codigo);
  if (!entrega) return;
  const orden = { enviado: 1, entregado: 2, leido: 3, error: 0 } as const;
  const actual = (envio.entrega ?? "enviado") as keyof typeof orden;
  if (entrega !== "error" && orden[entrega] <= orden[actual] && !keyId) return;
  const ahora = new Date();
  await db
    .update(vanniEnvios)
    .set({
      entrega: entrega === "error" || orden[entrega] > orden[actual] ? entrega : envio.entrega,
      ...(keyId ? { waKeyId: keyId } : {}),
      ...(entrega === "entregado" && !envio.entregadoAt ? { entregadoAt: ahora } : {}),
      ...(entrega === "leido" ? { leidoAt: envio.leidoAt ?? ahora, entregadoAt: envio.entregadoAt ?? ahora } : {}),
    })
    .where(eq(vanniEnvios.id, envio.id));
}

/**
 * Consulta a WaSender el estado de los envíos recientes que todavía no se leen.
 * Es el respaldo del webhook: no depende de cruzar `key.id` con `msgId`.
 */
export async function actualizarEstados(limite = 40): Promise<number> {
  const pendientes = await db
    .select()
    .from(vanniEnvios)
    .where(
      and(
        eq(vanniEnvios.estado, "enviado"),
        isNotNull(vanniEnvios.waMsgId),
        notInArray(vanniEnvios.entrega, ["leido", "error"]),
        sql`${vanniEnvios.enviadoAt} > now() - interval '3 days'`,
        sql`${vanniEnvios.waMsgId} not like 'sim-%'`,
      ),
    )
    .orderBy(asc(vanniEnvios.enviadoAt))
    .limit(limite);
  let actualizados = 0;
  for (const e of pendientes) {
    const info = await estadoMensaje(e.waMsgId!);
    if (info?.status === undefined) continue;
    await aplicarEstado(e, info.status, info.keyId);
    actualizados++;
  }
  return actualizados;
}

/** Webhook `messages.update`: busca el envío por `key.id` o, si coincide, por `msgId`. */
export async function estadoDesdeWebhook(keyId: string, codigo: number): Promise<boolean> {
  const [e] = await db
    .select()
    .from(vanniEnvios)
    .where(or(eq(vanniEnvios.waKeyId, keyId), eq(vanniEnvios.waMsgId, keyId)))
    .limit(1);
  if (!e) return false;
  await aplicarEstado(e, codigo);
  return true;
}

/** Un único recordatorio a quien no respondió en las horas que define la campaña. */
export async function enviarRecordatorios(limite = 10): Promise<number> {
  const filas = await db
    .select({ envio: vanniEnvios, campana: vanniCampanas, contacto: vanniContactos })
    .from(vanniEnvios)
    .innerJoin(vanniCampanas, eq(vanniCampanas.id, vanniEnvios.campanaId))
    .innerJoin(vanniContactos, eq(vanniContactos.id, vanniEnvios.contactoId))
    .where(
      and(
        eq(vanniEnvios.estado, "enviado"),
        isNull(vanniEnvios.respondioAt),
        isNull(vanniEnvios.recordatorioAt),
        isNotNull(vanniCampanas.recordatorioHoras),
        eq(vanniContactos.estado, "activo"),
        sql`${vanniEnvios.enviadoAt} < now() - make_interval(hours => ${vanniCampanas.recordatorioHoras})`,
      ),
    )
    .limit(limite);

  let n = 0;
  for (const { envio, campana, contacto } of filas) {
    const nombre = (contacto.nombre ?? "").split(" ")[0];
    const texto = `Hola${nombre ? ` ${nombre}` : ""}, ¿alcanzaste a ver la promoción? *${campana.promocion}*. Si te interesa, respóndeme y una ejecutiva te contacta.`;
    const r = contacto.ejemplo ? { ok: true, simulado: true, msgId: undefined } : await enviarTexto(envio.telefono, texto);
    await db.update(vanniEnvios).set({ recordatorioAt: new Date() }).where(eq(vanniEnvios.id, envio.id));
    if (r.ok) {
      n++;
      await guardarMensaje({ telefono: envio.telefono, flujo: "ofertas", direccion: "out", texto, simulado: r.simulado, waMsgId: r.msgId ?? null });
    }
  }
  return n;
}
