// Segmentación RFM: Recencia (cuánto hace de la última compra), Frecuencia
// (cuántas compras) y Monto (cuánto compró en total), cada una de 1 a 5.
//
// **La recencia es absoluta; frecuencia y monto, relativos.** Frecuencia y
// monto se puntúan por quintiles dentro de la propia base: "18 compras" es
// mucho o poco según quién sea el cliente típico de Vanni. La recencia no:
// esta es una campaña de reactivación, la base entera son clientes que dejaron
// de comprar, y puntuarla por quintiles haría que el menos inactivo de todos
// saliera "Campeón" aunque no compre hace cinco meses. En días:
//
//   ≤ 30 → 5 · ≤ 90 → 4 · ≤ 180 → 3 · ≤ 365 → 2 · más de un año → 1

export interface InsumoRfm {
  id: number;
  ultimaCompra: string | Date | null;
  nCompras: number | null;
  montoTotal: number | null;
}

export interface PuntajeRfm {
  id: number;
  rScore: number | null;
  fScore: number | null;
  mScore: number | null;
  segmento: string;
}

/** Los segmentos, en el orden en que se muestran. */
export const SEGMENTOS = [
  { nombre: "Campeones", descripcion: "Compran seguido, mucho y hace poco" },
  { nombre: "Leales", descripcion: "Compran seguido y siguen activos" },
  { nombre: "No se pueden perder", descripcion: "Compraban mucho y seguido, hace tiempo" },
  { nombre: "En riesgo", descripcion: "Buenos clientes que se enfriaron" },
  { nombre: "Necesitan atención", descripcion: "Compras medias, hace meses" },
  { nombre: "Prometedores", descripcion: "Compraron hace poco, pocas veces" },
  { nombre: "Hibernando", descripcion: "Compras bajas y esporádicas" },
  { nombre: "Perdidos", descripcion: "Hace mucho que no compran" },
  { nombre: "Sin historial", descripcion: "Sin datos de compra en la planilla" },
] as const;

export type NombreSegmento = (typeof SEGMENTOS)[number]["nombre"];

export function segmentoDe(r: number, f: number, m: number): NombreSegmento {
  if (r >= 4 && f >= 4 && m >= 4) return "Campeones";
  if (r >= 4 && f >= 3) return "Leales";
  if (r <= 2 && f >= 4 && m >= 4) return "No se pueden perder";
  if (r <= 2 && f >= 3) return "En riesgo";
  if (r >= 4 && f <= 2) return "Prometedores";
  if (r === 3) return "Necesitan atención";
  if (r === 1 && f <= 2 && m <= 2) return "Perdidos";
  return "Hibernando";
}

/** Puntaje 1–5 por quintil dentro de la base: el valor más alto saca 5. Empates, mismo puntaje. */
function quintiles(valores: number[]): (v: number) => number {
  const orden = [...valores].sort((a, b) => a - b);
  const n = orden.length;
  return (v: number) => {
    if (n === 0) return 3;
    let menores = 0;
    while (menores < n && orden[menores] < v) menores++;
    return Math.min(5, Math.floor((menores / n) * 5) + 1);
  };
}

export function calcularRfm(contactos: InsumoRfm[], hoy = new Date()): PuntajeRfm[] {
  const conDatos = contactos.filter(
    (c) => c.ultimaCompra && c.nCompras !== null && c.montoTotal !== null,
  );
  const dias = (d: string | Date) =>
    Math.max(0, Math.round((hoy.getTime() - new Date(d).getTime()) / 86_400_000));

  const puntuarR = (d: number) => (d <= 30 ? 5 : d <= 90 ? 4 : d <= 180 ? 3 : d <= 365 ? 2 : 1);
  const puntuarF = quintiles(conDatos.map((c) => c.nCompras!));
  const puntuarM = quintiles(conDatos.map((c) => c.montoTotal!));

  return contactos.map((c) => {
    if (!c.ultimaCompra || c.nCompras === null || c.montoTotal === null) {
      return { id: c.id, rScore: null, fScore: null, mScore: null, segmento: "Sin historial" };
    }
    const r = puntuarR(dias(c.ultimaCompra));
    const f = puntuarF(c.nCompras);
    const m = puntuarM(c.montoTotal);
    return { id: c.id, rScore: r, fScore: f, mScore: m, segmento: segmentoDe(r, f, m) };
  });
}
