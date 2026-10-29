// La empresa demo más las entrevistas en vivo, sumadas para el back office.
//
// Las entrevistas en vivo se suman a la matriz y a los conteos para que quien
// se acaba de entrevistar se vea aparecer. Los KPIs de horas no se tocan: 7.980
// h/mes de una empresa de 356 personas no cambian de forma visible con una
// persona más, y sumarlas haría que la cifra deje de calzar con los procesos.

import { ARQUETIPOS, type ArquetipoId } from "./modelo";
import { EMPRESA, MATRIZ } from "./semilla";
import type { FichaEnVivo } from "./datos";

export interface CeldaMatriz {
  base: number;
  vivo: number;
}

export function matrizCombinada(vivas: FichaEnVivo[]): Record<ArquetipoId, CeldaMatriz[]> {
  const m = {} as Record<ArquetipoId, CeldaMatriz[]>;
  for (const a of ARQUETIPOS) m[a.id] = MATRIZ[a.id].map((base) => ({ base, vivo: 0 }));
  for (const f of vivas) {
    const fila = m[f.analisis.perfil.principal];
    const celda = fila?.[f.analisis.perfil.madurez - 1];
    if (celda) celda.vivo += 1;
  }
  return m;
}

export function totalPersonas(vivas: FichaEnVivo[]): number {
  return EMPRESA.entrevistas + vivas.length;
}

/** Personas por nivel de madurez (1 a 5), sumando las en vivo. */
export function porNivel(vivas: FichaEnVivo[]): number[] {
  const out = [0, 0, 0, 0, 0];
  for (const a of ARQUETIPOS) MATRIZ[a.id].forEach((v, i) => (out[i] += v));
  for (const f of vivas) out[f.analisis.perfil.madurez - 1] += 1;
  return out;
}

export function fmt(n: number): string {
  return n.toLocaleString("es-CL");
}
