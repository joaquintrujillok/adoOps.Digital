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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/framework`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/cafecito-ia`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  ];

  const ediciones = await edicionesParaSitemap();

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
