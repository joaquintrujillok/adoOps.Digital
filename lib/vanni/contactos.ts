// Carga de contactos: planilla (.xlsx o .csv) o uno por uno, y el RFM.
//
// Las planillas reales no tienen nombres de columna fijos: "Celular", "Fono",
// "WhatsApp" y "Teléfono" son la misma columna. Se reconocen por alias y el
// resto se ignora. Una fila sin teléfono válido no se carga, y se informa cuál
// y por qué: una fila que desaparece en silencio es un cliente que nadie llama.

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { vanniContactos } from "@/db/vanni";
import { calcularRfm, SEGMENTO_DEMO } from "./rfm";
import { normalizarTelefono } from "./telefono";

type Campo =
  | "telefono"
  | "nombre"
  | "razonSocial"
  | "rut"
  | "email"
  | "sucursal"
  | "categoriaHabitual"
  | "ultimaCompra"
  | "nCompras"
  | "montoTotal";

const ALIAS: Record<Campo, string[]> = {
  telefono: ["telefono", "teléfono", "celular", "movil", "móvil", "fono", "whatsapp", "wsp", "numero", "número"],
  nombre: ["nombre", "contacto", "nombre contacto", "cliente"],
  razonSocial: ["razon social", "razón social", "empresa", "negocio"],
  rut: ["rut"],
  email: ["email", "correo", "mail", "e-mail"],
  sucursal: ["sucursal", "tienda", "local"],
  categoriaHabitual: ["categoria", "categoría", "categoria habitual", "categoría habitual", "rubro", "familia"],
  ultimaCompra: ["ultima compra", "última compra", "fecha ultima compra", "fecha última compra", "ultima_compra"],
  nCompras: ["n compras", "compras", "numero de compras", "número de compras", "frecuencia", "n_compras"],
  montoTotal: ["monto", "monto total", "total comprado", "monto_total", "venta total"],
};

function limpio(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapearEncabezados(encabezados: unknown[]): Partial<Record<Campo, number>> {
  const mapa: Partial<Record<Campo, number>> = {};
  encabezados.forEach((h, i) => {
    const e = limpio(h);
    for (const [campo, alias] of Object.entries(ALIAS) as [Campo, string[]][]) {
      if (mapa[campo] === undefined && alias.some((a) => limpio(a) === e)) mapa[campo] = i;
    }
  });
  return mapa;
}

function fecha(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/); // dd-mm-aaaa, el formato chileno
  if (m) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${anio}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  // Número de serie de Excel (días desde 1899-12-30).
  if (/^\d{5}$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 86_400_000).toISOString().slice(0, 10);
  return null;
}

function numero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  const s = String(v ?? "").replace(/[$\s.]/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function texto(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

/** CSV con `;` o `,` (Excel en Chile guarda con `;`). Soporta comillas. */
export function parsearCsv(contenido: string): string[][] {
  const t = contenido.replace(/^﻿/, "");
  const primera = t.split(/\r?\n/)[0] ?? "";
  const sep = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  if (celda || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((x) => x.trim()));
}

export interface ResultadoCarga {
  nuevos: number;
  actualizados: number;
  rechazadas: { fila: number; motivo: string }[];
  sinTelefonoColumna?: boolean;
}

export async function cargarFilas(filas: unknown[][], ejemplo = false): Promise<ResultadoCarga> {
  const r: ResultadoCarga = { nuevos: 0, actualizados: 0, rechazadas: [] };
  if (filas.length < 2) {
    r.rechazadas.push({ fila: 1, motivo: "La planilla no tiene filas de datos" });
    return r;
  }
  const mapa = mapearEncabezados(filas[0]);
  if (mapa.telefono === undefined) {
    r.sinTelefonoColumna = true;
    r.rechazadas.push({ fila: 1, motivo: "No encontré una columna de teléfono (Teléfono, Celular, WhatsApp…)" });
    return r;
  }
  const col = (f: unknown[], c: Campo) => (mapa[c] === undefined ? undefined : f[mapa[c]!]);

  const vistos = new Set<string>();
  for (let i = 1; i < filas.length; i++) {
    const f = filas[i];
    const tel = normalizarTelefono(col(f, "telefono"));
    if (!tel) {
      r.rechazadas.push({ fila: i + 1, motivo: `Teléfono no válido: "${String(col(f, "telefono") ?? "")}"` });
      continue;
    }
    if (vistos.has(tel)) {
      r.rechazadas.push({ fila: i + 1, motivo: `Teléfono repetido en la planilla (${tel})` });
      continue;
    }
    vistos.add(tel);

    const datos = {
      nombre: texto(col(f, "nombre")),
      razonSocial: texto(col(f, "razonSocial")),
      rut: texto(col(f, "rut")),
      email: texto(col(f, "email")),
      sucursal: texto(col(f, "sucursal")),
      categoriaHabitual: texto(col(f, "categoriaHabitual")),
      ultimaCompra: fecha(col(f, "ultimaCompra")),
      nCompras: numero(col(f, "nCompras")),
      montoTotal: numero(col(f, "montoTotal")),
    };
    const [existe] = await db
      .select({ id: vanniContactos.id })
      .from(vanniContactos)
      .where(eq(vanniContactos.telefono, tel))
      .limit(1);
    if (existe) {
      // Solo se pisan los campos que la planilla trae con valor: una columna
      // vacía no borra lo que ya se sabía. El estado (una baja) nunca se toca.
      const cambios = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== null));
      await db
        .update(vanniContactos)
        .set({ ...cambios, updatedAt: new Date() })
        .where(eq(vanniContactos.id, existe.id));
      r.actualizados++;
    } else {
      await db.insert(vanniContactos).values({ telefono: tel, ...datos, origen: "planilla", ejemplo });
      r.nuevos++;
    }
  }
  await recalcularRfm(ejemplo);
  return r;
}

/** Recalcula el RFM de toda la base (reales y ejemplo por separado: no se comparan entre sí). */
export async function recalcularRfm(ejemplo: boolean): Promise<void> {
  const todos = await db
    .select({
      id: vanniContactos.id,
      ultimaCompra: vanniContactos.ultimaCompra,
      nCompras: vanniContactos.nCompras,
      montoTotal: vanniContactos.montoTotal,
    })
    .from(vanniContactos)
    // Los de demostración tienen su segmento puesto a mano: no se recalculan.
    .where(and(eq(vanniContactos.ejemplo, ejemplo), ne(vanniContactos.segmento, SEGMENTO_DEMO)));
  const puntajes = calcularRfm(todos);
  // Agrupados por combinación para hacer pocas escrituras aunque la base sea grande.
  const grupos = new Map<string, number[]>();
  for (const p of puntajes) {
    const k = `${p.rScore}|${p.fScore}|${p.mScore}|${p.segmento}`;
    grupos.set(k, [...(grupos.get(k) ?? []), p.id]);
  }
  for (const [k, ids] of grupos) {
    const [r, f, m, segmento] = k.split("|");
    const n = (x: string) => (x === "null" ? null : Number(x));
    for (let i = 0; i < ids.length; i += 500) {
      await db
        .update(vanniContactos)
        .set({ rScore: n(r), fScore: n(f), mScore: n(m), segmento })
        .where(inArray(vanniContactos.id, ids.slice(i, i + 500)));
    }
  }
}

export async function agregarContacto(d: {
  telefono: string;
  nombre?: string | null;
  razonSocial?: string | null;
  sucursal?: string | null;
  email?: string | null;
  categoriaHabitual?: string | null;
  ejecutivaId?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const tel = normalizarTelefono(d.telefono);
  if (!tel) return { ok: false, error: "El teléfono no es válido. Usa el formato +56 9 1234 5678." };
  const [existe] = await db.select({ id: vanniContactos.id }).from(vanniContactos).where(eq(vanniContactos.telefono, tel));
  if (existe) return { ok: false, error: "Ese teléfono ya está en la base." };
  await db.insert(vanniContactos).values({
    telefono: tel,
    nombre: d.nombre || null,
    razonSocial: d.razonSocial || null,
    sucursal: d.sucursal || null,
    email: d.email || null,
    categoriaHabitual: d.categoriaHabitual || null,
    ejecutivaId: d.ejecutivaId ?? null,
    origen: "manual",
  });
  return { ok: true };
}

export async function sucursales(ejemplo: boolean): Promise<string[]> {
  const r = await db
    .selectDistinct({ s: vanniContactos.sucursal })
    .from(vanniContactos)
    .where(and(eq(vanniContactos.ejemplo, ejemplo), sql`${vanniContactos.sucursal} is not null`));
  return r.map((x) => x.s!).sort();
}
