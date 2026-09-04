import type { MetadataRoute } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cafecitoEdiciones } from "@/db/schema";
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

  try {
    const ediciones = await db
      .select({
        slug: cafecitoEdiciones.slug,
        actualizadaEn: cafecitoEdiciones.actualizadaEn,
      })
      .from(cafecitoEdiciones)
      .where(eq(cafecitoEdiciones.publicada, true))
      .orderBy(desc(cafecitoEdiciones.slug))
      .limit(1000);

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
  } catch (err) {
    // Si la base no responde, se sirve el sitemap estático antes que un 500.
    // Un sitemap incompleto es un problema menor; uno caído hace que Google
    // deje de pedirlo.
    console.error("sitemap: error al leer ediciones:", err);
    return estaticas;
  }
}
