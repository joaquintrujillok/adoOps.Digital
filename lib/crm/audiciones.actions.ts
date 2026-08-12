"use server";

// Acciones del cierre de audición.
//
// La acción hace dos cosas en una: registra la audición **y** guarda las
// respuestas a las preguntas que el motor propuso. Van juntas a propósito — si
// fueran dos pasos, el segundo no lo haría nadie.

import { revalidatePath } from "next/cache";
import { requireSession } from "./auth.actions";
import { registrarAudicion } from "./audiciones";
import { registrarRespuesta } from "./preguntas";

export interface EstadoCierre {
  ok?: boolean;
  error?: string;
  audicionId?: number;
  respuestasGuardadas?: number;
}

export async function accionCerrarAudicion(
  _prev: EstadoCierre,
  formData: FormData,
): Promise<EstadoCierre> {
  const sesion = await requireSession();

  const salaId = Number(formData.get("salaId"));
  if (!salaId) return { ok: false, error: "Elige en qué sala fue la audición" };

  const contactIdRaw = formData.get("contactId");
  const contactId = contactIdRaw ? Number(contactIdRaw) : null;
  if (!contactId) {
    return { ok: false, error: "Elige a quién atendiste. Sin persona, la audición no sirve para nada." };
  }

  // El monto llega como texto con puntos: "12.500.000". Se limpia todo lo que
  // no sea dígito en vez de pedirle al vendedor que escriba sin formato.
  const presupuestoTexto = String(formData.get("presupuesto") || "").replace(/\D/g, "");
  const presupuesto = presupuestoTexto ? Number(presupuestoTexto) : null;

  const proximoPasoEnTexto = String(formData.get("proximoPasoEn") || "");

  const audicionId = await registrarAudicion({
    contactId,
    salaId,
    conCita: formData.get("conCita") === "on",
    duracionMinutos: Number(formData.get("duracion")) || null,
    acompanantes: Number(formData.get("acompanantes")) || 0,
    queDijo: String(formData.get("queDijo") || "").trim() || null,
    leGusto: String(formData.get("leGusto") || "").trim() || null,
    descarto: String(formData.get("descarto") || "").trim() || null,
    presupuestoMencionado: presupuesto,
    proximoPaso: String(formData.get("proximoPaso") || "").trim() || null,
    proximoPasoEn: proximoPasoEnTexto ? new Date(proximoPasoEnTexto) : null,
    atendidoPor: sesion.userId,
  });

  // Las respuestas a las preguntas propuestas. Vienen como `respuesta.<clave>`,
  // y un valor especial "__no_tiene" para la respuesta que más vale de todas:
  // preguntamos y confirmó que no lo tiene.
  let respuestasGuardadas = 0;
  for (const [campo, valor] of formData.entries()) {
    if (!campo.startsWith("respuesta.")) continue;
    const texto = String(valor).trim();
    if (!texto) continue;

    const clave = campo.slice("respuesta.".length);
    const noTiene = texto === "__no_tiene";

    await registrarRespuesta({
      contactId,
      clave,
      valor: noTiene ? null : texto,
      estado: noTiene ? "no_tiene" : "conocido",
      // Confianza 2: lo dijo la persona y alguien lo anotó. No es 3 porque no
      // hay documento — eso queda reservado para lo que sale de una venta.
      confianza: 2,
      origen: "audicion",
      origenId: audicionId,
      registradoPor: sesion.userId,
    });
    respuestasGuardadas++;
  }

  // El presupuesto mencionado también es un dato de perfil, no solo de esta
  // audición: es lo que después acota el rango de cualquier recomendación.
  if (presupuesto) {
    await registrarRespuesta({
      contactId,
      clave: "intencion.presupuesto",
      valor: String(presupuesto),
      confianza: 2,
      origen: "audicion",
      origenId: audicionId,
      registradoPor: sesion.userId,
    });
  }

  revalidatePath("/crm/audiciones");
  revalidatePath(`/crm/contactos/${contactId}`);
  revalidatePath("/crm/clientes");

  return { ok: true, audicionId, respuestasGuardadas };
}
