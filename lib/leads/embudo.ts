// El estado del motor, en dos preguntas.
//
// 1. ¿Dónde está cada prospecto? — el embudo
// 2. ¿Qué falta para que el motor pueda arrancar? — la lista de bloqueos
//
// La segunda es la que importa hoy y la que ningún CRM muestra: un panel que
// solo enseña un embudo vacío no dice POR QUÉ está vacío. Acá cada bloqueo sale
// de un conteo real, no de una casilla que alguien marca a mano.

import { isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  leadCampanas,
  leadEmisores,
  leadEmpresas,
  leadInscripciones,
  leadPersonas,
  leadSenales,
} from "@/db/leads";

/** Las etapas, en el orden del recorrido. La supresión no es una etapa: es una salida. */
export const ETAPAS = [
  { id: "pendiente", nombre: "Pendientes", que: "Inscritos, esperando su primer toque" },
  { id: "invitado", nombre: "Invitados", que: "Invitación enviada, sin aceptar todavía" },
  { id: "conectado", nombre: "Conectados", que: "Aceptaron. Acá empieza la secuencia" },
  { id: "en_secuencia", nombre: "En secuencia", que: "Recibiendo los toques 2 a 5" },
  { id: "respondio", nombre: "Respondieron", que: "Salieron de la automatización. Los atiende una persona" },
  { id: "calificado", nombre: "Calificados", que: "Pasan a /crm como oportunidad" },
] as const;

export interface Embudo {
  base: number;
  alcanzables: number;
  porEtapa: Record<string, number>;
  suprimidos: number;
  senalesVigentes: number;
}

export async function embudo(): Promise<Embudo> {
  // No se cuenta el total de personas: lo que importa no es cuánta gente hay en
  // la base, es a cuánta se le puede escribir.
  const [empresas, alcanzables, suprimidos, etapas, senales] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(leadEmpresas),
    // Alcanzable = hay por dónde escribirle. Sin email ni perfil de LinkedIn,
    // una persona en la base no es un prospecto: es una fila.
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(leadPersonas)
      .where(sql`(lead_personas.email is not null or lead_personas.member_urn is not null)
                 and lead_personas.suprimido_en is null`),
    db.select({ n: sql<number>`count(*)::int` }).from(leadPersonas).where(isNotNull(leadPersonas.suprimidoEn)),
    db
      .select({ estado: leadInscripciones.estado, n: sql<number>`count(*)::int` })
      .from(leadInscripciones)
      .groupBy(leadInscripciones.estado),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(leadSenales)
      .where(sql`lead_senales.vence_en > now() and lead_senales.estado = 'vigente'`),
  ]);

  const porEtapa: Record<string, number> = {};
  for (const e of ETAPAS) porEtapa[e.id] = 0;
  for (const fila of etapas) porEtapa[fila.estado] = fila.n;

  return {
    base: empresas[0].n,
    alcanzables: alcanzables[0].n,
    porEtapa,
    suprimidos: suprimidos[0].n,
    senalesVigentes: senales[0].n,
  };
}

export interface Bloqueo {
  titulo: string;
  detalle: string;
  listo: boolean;
  /** Lo que hay que hacer, si no está listo. */
  accion?: string;
  href?: string;
}

/**
 * Lo que falta para poder mandar el primer mensaje, en orden de dependencia.
 *
 * El orden no es estético: cada uno depende del anterior. Sin dominio no hay
 * email, sin email ni perfil no hay a quién escribirle, sin señal el mensaje no
 * tiene qué decir, y sin emisor no hay por dónde salir.
 */
export async function bloqueos(): Promise<Bloqueo[]> {
  const [empresas, sinDominio, alcanzables, senales, emisores, campanas] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(leadEmpresas),
    db.select({ n: sql<number>`count(*)::int` }).from(leadEmpresas).where(isNull(leadEmpresas.dominio)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(leadPersonas)
      .where(sql`lead_personas.email is not null or lead_personas.member_urn is not null`),
    db.select({ n: sql<number>`count(*)::int` }).from(leadSenales),
    db.select({ n: sql<number>`count(*)::int` }).from(leadEmisores),
    db.select({ n: sql<number>`count(*)::int` }).from(leadCampanas),
  ]);

  const total = empresas[0].n;
  const conDominio = total - sinDominio[0].n;

  return [
    {
      titulo: "Empresas en la base",
      detalle: total === 0 ? "Ninguna cargada todavía" : `${total} cargadas`,
      listo: total > 0,
      accion: "Cargar un CSV",
      href: "/leads/cargar",
    },
    {
      titulo: "Con dominio web",
      detalle:
        total === 0
          ? "—"
          : `${conDominio} de ${total}. Sin dominio, ningún proveedor de enriquecimiento encuentra nada`,
      listo: total > 0 && conDominio / total >= 0.6,
      accion: "Completar dominios y volver a cargar el CSV",
      href: "/leads/prospectos?sin=dominio",
    },
    {
      titulo: "Personas alcanzables",
      detalle:
        alcanzables[0].n === 0
          ? "Nadie con email ni perfil de LinkedIn"
          : `${alcanzables[0].n} con email o perfil`,
      listo: alcanzables[0].n > 0,
      accion: "Enriquecer con Prospeo o FullEnrich y cargar el resultado",
      href: "/leads/cargar",
    },
    {
      titulo: "Señales de compra",
      detalle:
        senales[0].n === 0
          ? "Ninguna. Ningún primer contacto sale sin una señal verificable"
          : `${senales[0].n} registradas`,
      listo: senales[0].n > 0,
      accion: "Falta conectar ChileCompra (requiere el ticket)",
    },
    {
      titulo: "Emisor configurado",
      detalle:
        emisores[0].n === 0
          ? "Ninguno. Sin emisor no hay cuota ni warm-up, y sin eso se queman cuentas"
          : `${emisores[0].n} configurado(s)`,
      listo: emisores[0].n > 0,
      accion: "Falta conectar la cuenta de LinkedIn vía Unipile",
    },
    {
      titulo: "Campaña activa",
      detalle: campanas[0].n === 0 ? "Ninguna creada" : `${campanas[0].n} creada(s)`,
      listo: campanas[0].n > 0,
      accion: "Se crea cuando los pasos anteriores estén listos",
    },
  ];
}
