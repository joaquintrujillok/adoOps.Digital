import type { MetadataRoute } from "next";
import { edicionesParaSitemap } from "@/lib/cafecito/consultas";
import { SITE_URL as BASE } from "@/lib/site";


/**
 * Sitemap dinámico.
 *
 * Las ediciones de Cafecito IA salen de la base, no de una lista fija: se
 * publican tres veces por semana desde fuera de este repo, y un sitemap
 * hardcodeado quedaría obsoleto a los dos días.
 *
 * Se revalida cada hora. Un sitemap que se regenera en cada request es una
 * consulta a la base por cada visita de rastreador, y no gana nada: Google no
 * lo lee tan seguido.
 */
export const revalidate = 3600;

// ── Por qué estas fechas están escritas a mano ──────────────────────────────
//
// Antes las tres páginas estáticas emitían `lastModified: new Date()`, o sea la
// hora en que se regeneró el sitemap. Eso le dice a Google que la portada cambió
// cada hora, todos los días, para siempre. Google aprende rápido que ese dato no
// vale nada y deja de usarlo —también para las páginas donde SÍ vale, que son
// las ediciones—.
//
// Son fechas de contenido, no de despliegue: se actualizan cuando el texto de
// esas páginas cambie de verdad, no cuando se toque una clase de CSS. Si dudas,
// no las muevas: un `lastmod` viejo no cuesta nada, uno falso sí.
const CAMBIO_HOME = new Date("2026-06-22T01:40:54Z");
const CAMBIO_FRAMEWORK = new Date("2026-06-22T01:40:54Z");
const CAMBIO_CAFECITO = new Date("2026-09-07T16:10:35Z");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ediciones = await edicionesParaSitemap();

  // `/cafecito-ia` es el archivo: cambia cuando sale una edición, no cuando se
  // edita su archivo .tsx. Su fecha sale de la edición más reciente, y así se
  // mantiene sola. Si la base no responde queda la fecha de respaldo, que es
  // vieja pero cierta —mejor que decir "cambió recién" sin saberlo—.
  const ultimaEdicion = ediciones.reduce<Date | null>(
    (max, e) => (!max || e.actualizadaEn > max ? e.actualizadaEn : max),
    null,
  );

  const estaticas: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: CAMBIO_HOME, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/framework`, lastModified: CAMBIO_FRAMEWORK, changeFrequency: "monthly", priority: 0.8 },
    {
      url: `${BASE}/cafecito-ia`,
      lastModified: ultimaEdicion ?? CAMBIO_CAFECITO,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  return [
    ...estaticas,
    ...ediciones.map((e) => ({
      url: `${BASE}/cafecito-ia/${e.slug}`,
      lastModified: e.actualizadaEn,
      changeFrequency: "monthly" as const,
      // Las ediciones recientes valen más: es contenido noticioso.
      priority: 0.7,
    })),
  ];
}
