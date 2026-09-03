// Markdown → HTML para las ediciones de Cafecito IA.
//
// Sin dependencias a propósito: el informe lo escribimos nosotros con un
// subconjunto conocido de Markdown (títulos, negrita, cursiva, links, listas,
// imágenes, citas, tablas y separadores). Traer un parser completo agrega
// superficie de ataque —XSS por HTML embebido— para cubrir sintaxis que este
// contenido nunca usa.
//
// El texto se escapa SIEMPRE antes de aplicar el formato. Ninguna ruta permite
// que el contenido inyecte etiquetas.

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Solo http(s). Corta `javascript:` y `data:` en links e imágenes. */
const urlSegura = (u: string) => (/^https?:\/\//i.test(u) ? u : "#");

function inline(t: string): string {
  return esc(t)
    .replace(
      /!\[([^\]]*)\]\(([^)\s]+)\)/g,
      (_m, alt: string, src: string) =>
        `<img src="${urlSegura(src)}" alt="${alt}" loading="lazy" />`,
    )
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_m, txt: string, href: string) =>
        `<a href="${urlSegura(href)}" target="_blank" rel="noopener noreferrer">${txt}</a>`,
    )
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

export function markdownAHtml(md: string): string {
  const out: string[] = [];
  const lineas = md.replace(/\r/g, "").split("\n");
  let i = 0;
  let lista: "ul" | "ol" | null = null;

  const cerrarLista = () => {
    if (lista) {
      out.push(`</${lista}>`);
      lista = null;
    }
  };
  const abrirLista = (tag: "ul" | "ol") => {
    if (lista !== tag) {
      cerrarLista();
      out.push(`<${tag}>`);
      lista = tag;
    }
  };

  while (i < lineas.length) {
    const l = lineas[i];

    if (!l.trim()) {
      cerrarLista();
      i++;
      continue;
    }

    if (/^---+$/.test(l.trim())) {
      cerrarLista();
      out.push("<hr />");
      i++;
      continue;
    }

    // Imagen sola en su línea: va como figura con pie.
    const img = l.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (img) {
      cerrarLista();
      const [, pie, src] = img;
      out.push(
        `<figure><img src="${urlSegura(src)}" alt="${esc(pie)}" loading="lazy" />` +
          (pie ? `<figcaption>${inline(pie)}</figcaption>` : "") +
          `</figure>`,
      );
      i++;
      continue;
    }

    let m: RegExpMatchArray | null;
    if ((m = l.match(/^###\s+(.*)/))) {
      cerrarLista();
      out.push(`<h3>${inline(m[1])}</h3>`);
      i++;
      continue;
    }
    if ((m = l.match(/^##\s+(.*)/))) {
      cerrarLista();
      out.push(`<h2>${inline(m[1])}</h2>`);
      i++;
      continue;
    }
    if ((m = l.match(/^#\s+(.*)/))) {
      cerrarLista();
      out.push(`<h2>${inline(m[1])}</h2>`); // el h1 de la página es el título
      i++;
      continue;
    }

    if ((m = l.match(/^>\s?(.*)/))) {
      cerrarLista();
      const buf = [m[1]];
      while (i + 1 < lineas.length && /^>\s?/.test(lineas[i + 1])) {
        buf.push(lineas[++i].replace(/^>\s?/, ""));
      }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      i++;
      continue;
    }

    // Tabla
    if (/^\|/.test(l) && i + 1 < lineas.length && /^\|[\s:|-]+\|?$/.test(lineas[i + 1])) {
      cerrarLista();
      const celdas = (r: string) =>
        r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = celdas(l);
      i += 2;
      const filas: string[][] = [];
      while (i < lineas.length && /^\|/.test(lineas[i])) filas.push(celdas(lineas[i++]));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` +
          `<tbody>${filas
            .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`,
      );
      continue;
    }

    if ((m = l.match(/^\s*[-*]\s+(.*)/))) {
      abrirLista("ul");
      out.push(`<li>${inline(m[1])}</li>`);
      i++;
      continue;
    }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) {
      abrirLista("ol");
      out.push(`<li>${inline(m[1])}</li>`);
      i++;
      continue;
    }

    cerrarLista();
    const buf = [l];
    while (
      i + 1 < lineas.length &&
      lineas[i + 1].trim() &&
      !/^(#{1,3}\s|>|\s*[-*]\s|\s*\d+[.)]\s|\||---+$|\s*!\[)/.test(lineas[i + 1])
    ) {
      buf.push(lineas[++i]);
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
    i++;
  }

  cerrarLista();
  return out.join("\n");
}

/** Minutos de lectura. 220 palabras por minuto, sin contar URLs. */
export function minutosDeLectura(md: string): string {
  const palabras = md.replace(/https?:\/\/\S+/g, "").split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(palabras / 220))} min de lectura`;
}

/** El primer `# ` del documento. Es el titular de la edición. */
export function extraerTitulo(md: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "Cafecito IA";
}

/** La primera línea suelta después del título: sirve de bajada y de description. */
export function extraerBajada(md: string): string {
  const lineas = md.split("\n").map((l) => l.trim());
  const iTitulo = lineas.findIndex((l) => /^#\s+/.test(l));
  for (const l of lineas.slice(iTitulo + 1)) {
    if (l && !/^[#*>|!-]/.test(l)) return l.slice(0, 400);
  }
  return "";
}

/** Quita el `# titular` del cuerpo: la página lo muestra como <h1>. */
export function cuerpoSinTitulo(md: string): string {
  return md.replace(/^#\s+.*$/m, "").trimStart();
}
