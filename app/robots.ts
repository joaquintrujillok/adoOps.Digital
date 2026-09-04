import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://adoops.digital";

/**
 * robots.txt
 *
 * Las secciones bloqueadas no son secretas: son páginas por token (confirmar una
 * suscripción, darse de baja) y consolas internas. No aportan nada en un
 * buscador y sí ensucian el índice con URLs irrepetibles.
 *
 * Las páginas por token ya llevan `robots: { index: false }` en su metadata. Esto
 * es la segunda capa: evita que un rastreador siquiera las visite, que importa
 * porque algunos escáneres siguen enlaces de correos.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/cafecito-ia/confirmar/",
          "/cafecito-ia/baja/",
          "/crm",
          "/dashboard360",
          "/leads",
          "/torrecontrol",
          "/admin",
          "/mix/",
          "/tv/",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
