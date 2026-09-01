// Cortar un documento de conocimiento en trozos.
//
// ── Por qué por encabezados y no por caracteres ──────────────────────────────
//
// La tubería de RAG por defecto parte el texto cada N caracteres con un poco de
// solape. Acá eso sería un error caro: estos documentos ya vienen cortados en
// 125 subsecciones `###`, y cada una es una solución del catálogo completa —qué
// es, para quién, qué incluye, cómo se cobra—. Partir a ciegas cortaría una
// solución por la mitad y el copiloto devolvería media respuesta con cara de
// completa, que es peor que no responder.
//
// **Cuando el documento tiene estructura, la estructura es el mejor criterio de
// corte que existe.** Estos la tienen, así que se usa.
//
// ── Por qué cada trozo lleva su camino adentro ───────────────────────────────
//
// El texto que se embebe y el que se le muestra al modelo empiezan con la
// jerarquía completa: "Base Soho › 2. Cómo se nos compra › 2.3 Fábrica de
// software". Un trozo suelto que dice "los tres modelos funcionan igual" no le
// dice nada a nadie; con su camino, se sabe de qué modelos habla. Y en la
// búsqueda ayuda igual: el camino trae las palabras que el cuerpo da por
// supuestas.

export type Trozo = {
  ruta: string;
  titulo: string;
  /** Lo que se embebe y lo que se le muestra al modelo, con el camino adentro. */
  texto: string;
  /** 1 si va en todas las pasadas sin pasar por la búsqueda. */
  siempre: number;
};

/** Un encabezado sin cuerpo ocupa un vector y no responde nada. */
const MINIMO_CARACTERES = 40;

export function trocear(markdown: string): Trozo[] {
  const trozos: Trozo[] = [];
  let h1 = "";
  let h2 = "";
  let actual: { titulo: string; padre: string; lineas: string[] } | null = null;

  const cerrar = () => {
    if (!actual) return;
    const cuerpo = actual.lineas.join("\n").trim();
    if (cuerpo.length >= MINIMO_CARACTERES) {
      const ruta = [h1, actual.padre, actual.titulo].filter(Boolean).join(" › ");
      trozos.push({
        ruta,
        titulo: actual.titulo,
        texto: `${ruta}\n\n${cuerpo}`,
        // La sección 0 de estas bases es "Cómo usar esta base (instrucciones
        // para el agente en vivo)": no es material de consulta, es política, y
        // si dependiera de la búsqueda el copiloto operaría sin sus reglas justo
        // cuando la conversación se va a un tema que no las menciona.
        siempre: /^0[.\s]/.test(actual.padre || actual.titulo) ? 1 : 0,
      });
    }
    actual = null;
  };

  for (const linea of markdown.split("\n")) {
    const m1 = linea.match(/^# (.+)$/);
    const m2 = linea.match(/^## (.+)$/);
    const m3 = linea.match(/^### (.+)$/);

    if (m1) {
      cerrar();
      h1 = m1[1].trim();
      h2 = "";
      continue;
    }
    if (m2) {
      cerrar();
      h2 = m2[1].trim();
      // Se abre un trozo con la sección por si no tiene subsecciones. Si las
      // tiene, este se cierra casi vacío y lo descarta el umbral.
      actual = { titulo: h2, padre: "", lineas: [] };
      continue;
    }
    if (m3) {
      cerrar();
      actual = { titulo: m3[1].trim(), padre: h2, lineas: [] };
      continue;
    }
    if (actual) actual.lineas.push(linea);
  }
  cerrar();

  return trozos;
}
