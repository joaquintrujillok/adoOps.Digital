// Despacho de WhatsApp — el ÚNICO módulo que puede hacer salir un mensaje.
//
// La lógica está portada del CRM de CDC, donde corre contra pacientes reales de
// un laboratorio. Ahí la cadena de candados no era una precaución teórica: es lo
// que separa una demo de mandarle mensajes a gente que no lo pidió.
//
// Todo envío atraviesa los mismos controles, en este orden:
//
//   1. El mensaje fue aprobado (su estado ya no es 'draft').
//   2. La conversación no está dada de baja (alguien escribió BAJA).
//   3. El interruptor `whatsapp.envio_habilitado` está encendido en BD.
//   4. El destinatario pasa la lista blanca (falla cerrado).
//   5. En modo simulado, se registra y NO se toca la red.
//
// Concentrarlo acá es lo que hace auditable la promesa "solo estos números
// reciben mensajes": basta revisar quién importa `@/lib/wasender`.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { crmWaConversations, crmWaMessages } from "@/db/crm";
import { sendText } from "@/lib/wasender";
import { CLAVES, leerBooleano } from "./settings";
import { normalizarTelefono } from "./telefono";

export type Resultado =
  | { estado: "sent"; waMessageId: string | null }
  | { estado: "simulado" }
  | { estado: "retenido"; motivo: string }
  | { estado: "failed"; motivo: string };

// ─── Lista blanca ────────────────────────────────────────────────────────────

/**
 * Destinatarios autorizados, desde `CRM_WHATSAPP_ALLOWLIST` (separados por coma).
 *
 * Se lee en cada llamada, no al cargar el módulo: corregir la variable en medio
 * de una demo no debería exigir reiniciar el proceso.
 */
export function listaBlanca(): string[] {
  return (process.env.CRM_WHATSAPP_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => normalizarTelefono(s))
    .filter((s): s is string => s !== null);
}

export type Veredicto =
  | { permitido: true; destino: string }
  | { permitido: false; motivo: string };

/**
 * Único juez de si un número puede recibir un mensaje real.
 *
 * Falla cerrado a propósito: lista vacía, variable ausente o mal escrita
 * significan "no sale nada", jamás "sale todo". La configuración por descuido
 * tiene que degradar hacia el silencio.
 *
 * En modo simulado esta función ni siquiera se consulta para bloquear —el
 * mensaje no llega a la red— pero se sigue evaluando para mostrar en pantalla
 * qué habría pasado en modo real.
 */
export function puedeEnviarA(telefono: string): Veredicto {
  const destino = normalizarTelefono(telefono);
  if (!destino) return { permitido: false, motivo: `Teléfono inválido: ${telefono}` };

  const lista = listaBlanca();
  if (lista.length === 0) {
    return {
      permitido: false,
      motivo:
        "Sin lista blanca configurada (CRM_WHATSAPP_ALLOWLIST vacía): en modo real no saldría nada",
    };
  }
  if (!lista.includes(destino)) {
    return { permitido: false, motivo: `${destino} no está en la lista blanca` };
  }
  return { permitido: true, destino };
}

// ─── Envío ───────────────────────────────────────────────────────────────────

async function enviarCrudo(telefono: string, texto: string): Promise<Resultado> {
  if (!(await leerBooleano(CLAVES.waHabilitado))) {
    return {
      estado: "retenido",
      motivo: "El envío de WhatsApp está apagado en Configuración",
    };
  }

  const simulado = await leerBooleano(CLAVES.waSimulado);
  if (simulado) {
    // Modo simulado: el mensaje se da por entregado sin tocar la red. Es el modo
    // por defecto, y el que permite mostrar el flujo completo sin el riesgo de
    // escribirle a alguien de verdad.
    return { estado: "simulado" };
  }

  const veredicto = puedeEnviarA(telefono);
  if (!veredicto.permitido) {
    return { estado: "retenido", motivo: veredicto.motivo };
  }

  const ok = await sendText(veredicto.destino, texto);
  if (!ok) return { estado: "failed", motivo: "WaSender rechazó el mensaje" };
  return { estado: "sent", waMessageId: null };
}

/**
 * Despacha un mensaje que ya fue aprobado por una persona.
 *
 * Solo acepta 'pending' o 'failed'. Un borrador nunca llega acá —nadie lo
 * aprobó— y uno ya enviado no se reenvía por reintentar la acción dos veces.
 */
export async function despacharMensaje(messageId: number): Promise<Resultado> {
  const [m] = await db
    .select({
      id: crmWaMessages.id,
      cuerpo: crmWaMessages.cuerpo,
      estado: crmWaMessages.estado,
      conversationId: crmWaMessages.conversationId,
      telefono: crmWaConversations.telefono,
      baja: crmWaConversations.baja,
    })
    .from(crmWaMessages)
    .innerJoin(
      crmWaConversations,
      eq(crmWaConversations.id, crmWaMessages.conversationId),
    )
    .where(eq(crmWaMessages.id, messageId))
    .limit(1);

  if (!m) return { estado: "failed", motivo: "El mensaje no existe" };

  if (m.estado !== "pending" && m.estado !== "failed") {
    return {
      estado: "failed",
      motivo: `El mensaje está en '${m.estado}': no corresponde despacharlo`,
    };
  }

  if (m.baja) {
    const motivo = "El contacto pidió no recibir más mensajes (BAJA)";
    await marcar(messageId, "retenido", motivo);
    return { estado: "retenido", motivo };
  }

  const resultado = await enviarCrudo(m.telefono, m.cuerpo);

  switch (resultado.estado) {
    case "sent":
      await marcar(messageId, "sent", null, resultado.waMessageId);
      break;
    case "simulado":
      await marcar(messageId, "simulado", "Modo simulado: no salió a la red");
      break;
    case "retenido":
      await marcar(messageId, "retenido", resultado.motivo);
      break;
    case "failed":
      await marcar(messageId, "failed", resultado.motivo);
      break;
  }

  await db
    .update(crmWaConversations)
    .set({ ultimoMensajeEn: new Date() })
    .where(eq(crmWaConversations.id, m.conversationId));

  return resultado;
}

async function marcar(
  messageId: number,
  estado: string,
  motivo: string | null = null,
  waMessageId: string | null = null,
): Promise<void> {
  await db
    .update(crmWaMessages)
    .set({
      estado,
      motivo,
      waMessageId,
      enviadoEn: estado === "sent" || estado === "simulado" ? new Date() : null,
    })
    .where(eq(crmWaMessages.id, messageId));
}

/** Resumen del estado de los candados, para mostrarlo en pantalla. */
export async function estadoCandados() {
  const [habilitado, simulado] = await Promise.all([
    leerBooleano(CLAVES.waHabilitado),
    leerBooleano(CLAVES.waSimulado),
  ]);
  const lista = listaBlanca();
  return {
    habilitado,
    simulado,
    autorizados: lista.length,
    numeros: lista,
  };
}
