// Feed RSS de Cafecito IA.
//
// Sirve para lectores de feeds, pero sobre todo es una señal: un feed con
// entradas fechadas y regulares le dice a los agregadores —y a Google Discover—
// que esto es una publicación periódica y no una página que cambia sola.

import { edicionesParaFeed } from "@/lib/cafecito/consultas";
import { SITE_URL as BASE } from "@/lib/site";


export const revalidate = 3600;

/** XML no perdona: & sin escapar rompe el feed entero. */
const esc = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function GET() {
  const ediciones = await edicionesParaFeed();

  const items = ediciones
    .map(
      (e) => `    <item>
      <title>${esc(e.titulo)}</title>
      <link>${BASE}/cafecito-ia/${e.slug}</link>
      <guid isPermaLink="true">${BASE}/cafecito-ia/${e.slug}</guid>
      <pubDate>${e.publicadaEn.toUTCString()}</pubDate>
      ${e.bajada ? `<description>${esc(e.bajada)}</description>` : ""}
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Cafecito IA — el boletín de IA de adoOps</title>
    <link>${BASE}/cafecito-ia</link>
    <description>Lo que pasó en inteligencia artificial, cada dos días y en cinco minutos.</description>
    <language>es-CL</language>
    <atom:link href="${BASE}/cafecito-ia/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
