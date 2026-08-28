"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tunicheAgricultores, tunicheLotes } from "@/db/tuniche";
import type { AreaId } from "./areas";
import { requireSesion } from "./auth.actions";
import { etapaPorId, etapasDe } from "./plantillas";
import { alcanceDe, puedeEnviarAlAgricultor, type SesionTuniche } from "./session";

export interface Resultado {
  error?: string;
  ok?: string;
}

/** El lote, si está en el alcance de quien actúa. */
async function loteEnAlcance(id: number, s: SesionTuniche) {
  const a = alcanceDe(s);
  const condiciones = [eq(tunicheLotes.id, id)];
  if (!a.todo) {
    condiciones.push(eq(tunicheLotes.area, a.area ?? ""));
    if (a.soloUsuarioId != null) {
      condiciones.push(eq(tunicheAgricultores.zonalId, a.soloUsuarioId));
    }
  }
  const [fila] = await db
    .select({ lote: tunicheLotes })
    .from(tunicheLotes)
    .innerJoin(tunicheAgricultores, eq(tunicheLotes.agricultorId, tunicheAgricultores.id))
    .where(and(...condiciones))
    .limit(1);
  return fila?.lote ?? null;
}

/**
 * Guarda los hitos de una etapa.
 *
 * **Los hitos no salen del audio y nunca iban a salir.** El audio captura la
 * visita —lo que se ve cada vez que alguien pisa el campo—; los hitos son las
 * fechas y cifras de un momento del ciclo, que en Altué ya viven en el SIA y en
 * MN se anotan en la planilla. Sin esta pantalla no había forma de cargarlos:
 * la sábana los mostraba y solo se llenaban con lo que trajo la importación.
 *
 * **Lo puede hacer cualquiera con el lote en su alcance, incluido un zonal.** Es
 * lo que se observa en terreno: la fecha de trasplante y la población a 30 días
 * las cuenta la persona que fue al campo, no su jefe.
 *
 * Se guarda **por etapa**: cada envío reemplaza solo los campos de esa etapa y
 * deja intactos los de las demás. Guardar el objeto completo haría que abrir el
 * formulario de floración borrara lo que alguien acababa de cargar en trasplante.
 */
export async function guardarHitosAction(
  _prev: Resultado,
  fd: FormData,
): Promise<Resultado> {
  const s = await requireSesion();
  const id = Number(fd.get("id"));
  const etapaId = ((fd.get("etapa") as string) ?? "").trim();
  if (!Number.isInteger(id) || id <= 0) return { error: "Lote inválido" };

  const lote = await loteEnAlcance(id, s);
  if (!lote) return { error: "Ese lote no está en tu alcance" };

  const etapa = etapaPorId(lote.area as AreaId, etapaId);
  if (!etapa) return { error: "Esa etapa no existe en esta área" };

  const hitos = { ...((lote.hitos ?? {}) as Record<string, unknown>) };

  for (const c of etapa.campos) {
    const bruto = ((fd.get(c.id) as string) ?? "").trim();
    if (!bruto) {
      // Vaciar un campo es una edición legítima: alguien se equivocó y lo borra.
      delete hitos[c.id];
      continue;
    }
    if (c.tipo === "numero" || c.tipo === "porcentaje") {
      const n = Number(bruto.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(n)) {
        return { error: `«${c.etiqueta}» tiene que ser un número` };
      }
      if (c.tipo === "porcentaje" && (n < 0 || n > 100)) {
        return { error: `«${c.etiqueta}» va de 0 a 100` };
      }
      hitos[c.id] = n;
      continue;
    }
    if (c.tipo === "fecha" && !/^\d{4}-\d{2}-\d{2}$/.test(bruto)) {
      return { error: `«${c.etiqueta}» tiene que ser una fecha` };
    }
    hitos[c.id] = bruto;
  }

  // La etapa actual del lote avanza sola al cargar hitos de una etapa posterior:
  // es el dato que la sábana muestra, y dejarlo desactualizado obligaría a
  // mantenerlo a mano en un segundo lugar.
  const orden = etapasDe(lote.area as AreaId);
  const actual = orden.find((e) => e.id === lote.etapaActual);
  const avanza = !actual || etapa.orden >= actual.orden;

  await db
    .update(tunicheLotes)
    .set({ hitos, ...(avanza ? { etapaActual: etapa.id } : {}) })
    .where(eq(tunicheLotes.id, id));

  revalidatePath(`/tuniche/lotes/${id}`);
  revalidatePath("/tuniche/sabana");
  return { ok: `${etapa.nombre} guardada.` };
}

/**
 * Corrige los datos de identificación del lote.
 *
 * A diferencia de los hitos, esto **no se observa en el campo**: viene de
 * Comercial o del SIA —superficie contratada, variedad, objetivo en kilos—. Por
 * eso queda en jefatura: un zonal que corrige la superficie de un contrato está
 * cambiando un dato que no le consta.
 *
 * El **código no se edita**: es la identidad del lote y lo que enlaza sus
 * visitas, sus informes y su historial. Cambiarlo sería crear otro lote con la
 * historia del anterior colgando.
 */
export async function guardarIdentificacionAction(
  _prev: Resultado,
  fd: FormData,
): Promise<Resultado> {
  const s = await requireSesion();
  if (!puedeEnviarAlAgricultor(s)) {
    return { error: "Los datos del contrato los corrige la jefatura del área." };
  }

  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Lote inválido" };
  const lote = await loteEnAlcance(id, s);
  if (!lote) return { error: "Ese lote no está en tu alcance" };

  const t = (k: string) => ((fd.get(k) as string) ?? "").trim() || null;

  const haStr = t("hectareas");
  if (haStr && !Number.isFinite(Number(haStr.replace(",", ".")))) {
    return { error: "La superficie tiene que ser un número" };
  }

  await db
    .update(tunicheLotes)
    .set({
      temporada: t("temporada"),
      cultivo: t("cultivo"),
      variedad: t("variedad"),
      relacionHm: t("relacionHm"),
      hectareas: haStr ? haStr.replace(",", ".") : null,
      objetivo: t("objetivo"),
      clienteFinal: t("clienteFinal"),
      idase: t("idase"),
      tipoSemilla: t("tipoSemilla"),
    })
    .where(eq(tunicheLotes.id, id));

  revalidatePath(`/tuniche/lotes/${id}`);
  revalidatePath("/tuniche/sabana");
  return { ok: "Datos del lote guardados." };
}
