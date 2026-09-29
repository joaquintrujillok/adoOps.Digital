// Datos de ejemplo para mostrar el tablero antes de tener la base real.
//
// Todo lo que se crea acá lleva `ejemplo = true`: la pantalla lo marca, las
// métricas no lo mezclan con lo real, la cola nunca le manda un WhatsApp (sus
// teléfonos 569000XXXXX son inventados y podrían ser de alguien) y se borra
// entero con un botón. Los números son estables: la misma semilla, el mismo
// tablero.

import { eq, inArray, like } from "drizzle-orm";
import { db } from "@/db";
import {
  vanniCampanas,
  vanniContactos,
  vanniEnvios,
  vanniMensajes,
  vanniOportunidades,
  vanniSesiones,
  vanniVariantes,
} from "@/db/vanni";
import { recalcularRfm } from "./contactos";
import { renderPlantilla } from "./formato";

function generador(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const NEGOCIOS = [
  "Restaurante", "Pastelería", "Sushi", "Cafetería", "Panadería", "Food truck", "Picada",
  "Hotel", "Casino", "Pizzería", "Fuente de soda", "Heladería", "Banquetería", "Minimarket",
];
const NOMBRES = [
  "Carolina", "Marcela", "Rodrigo", "Pedro", "Javiera", "Andrés", "Paula", "Felipe", "Camila",
  "Cristián", "Daniela", "Matías", "Valentina", "Sebastián", "Francisca", "Ignacio", "Loreto",
];
const APELLIDOS = ["Muñoz", "Rojas", "Díaz", "Soto", "Contreras", "Silva", "Morales", "Fuentes", "Araya", "Vargas"];
const LUGARES = ["El Roble", "Los Andes", "Del Puerto", "La Vega", "San Pedro", "El Parrón", "Las Acacias", "Don Tito", "La Esquina", "Santa Rosa"];
const SUCURSALES = ["Centro", "Norte", "Sur", "Oriente", "Poniente"];
const CATEGORIAS = [
  "Bandejas y blondas", "Servilletas y toallas", "Bolsas plásticas", "Aluminios",
  "Envases de papel y kraft", "Vasos, potes y copas", "Artículos de aseo",
];

const VARIANTES = [
  {
    codigo: "A",
    nombre: "Descuento directo",
    plantilla: "Hola {nombre}, este mes tienes {promocion} en {categoria}. ¿Te llama tu ejecutiva de Vanni?",
  },
  {
    codigo: "B",
    nombre: "Novedades del mes",
    plantilla: "Hola {nombre}, llegaron novedades en {categoria} y tenemos {promocion} para ti. ¿Quieres que una ejecutiva te cuente?",
  },
  {
    codigo: "C",
    nombre: "Recordatorio de cuenta",
    plantilla: "Hola {nombre}, hace tiempo no te vemos en Vanni. Te guardamos {promocion}. ¿Te contactamos?",
  },
];

/** Probabilidad de interés por segmento: los mejores clientes responden más. */
const INTERES: Record<string, number> = {
  "No se pueden perder": 0.27,
  "En riesgo": 0.17,
  "Necesitan atención": 0.12,
  Leales: 0.2,
  Campeones: 0.25,
  Prometedores: 0.1,
  Hibernando: 0.07,
  Perdidos: 0.05,
  "Sin historial": 0.06,
};

export async function cargarEjemplo(): Promise<{ contactos: number; envios: number }> {
  await borrarEjemplo();
  const azar = generador(20260928);
  const elegir = <T,>(xs: T[]) => xs[Math.floor(azar() * xs.length)];
  const hoy = Date.now();

  // Una base de inactivos: la última compra fue hace entre 3 meses y casi 2 años.
  const filas = Array.from({ length: 320 }, (_, i) => {
    const dias = Math.round(95 + Math.pow(azar(), 0.9) * 600);
    const compras = Math.max(1, Math.round(Math.pow(azar(), 1.8) * 45));
    return {
      telefono: `569000${String(10000 + i).slice(-5)}`,
      nombre: `${elegir(NOMBRES)} ${elegir(APELLIDOS)}`,
      razonSocial: `${elegir(NEGOCIOS)} ${elegir(LUGARES)}`,
      sucursal: SUCURSALES[Math.min(4, Math.floor(Math.pow(azar(), 1.3) * 5))],
      categoriaHabitual: elegir(CATEGORIAS),
      ultimaCompra: new Date(hoy - dias * 86_400_000).toISOString().slice(0, 10),
      nCompras: compras,
      montoTotal: Math.round((compras * (35_000 + azar() * 180_000)) / 1000) * 1000,
      origen: "planilla",
      ejemplo: true,
    };
  });
  await db.insert(vanniContactos).values(filas);
  await recalcularRfm(true);
  const contactos = await db.select().from(vanniContactos).where(eq(vanniContactos.ejemplo, true));

  const [campana] = await db
    .insert(vanniCampanas)
    .values({
      nombre: "Reactivación septiembre (ejemplo)",
      promocion: "15% de descuento",
      condiciones: "Válido hasta el 31 de octubre en compras sobre $50.000. No acumulable con otras promociones.",
      estado: "terminada",
      recordatorioHoras: 48,
      ejemplo: true,
      iniciadaAt: new Date(hoy - 12 * 86_400_000),
      terminadaAt: new Date(hoy - 12 * 86_400_000 + 3 * 3_600_000),
    })
    .returning();
  const variantes = await db
    .insert(vanniVariantes)
    .values(VARIANTES.map((v) => ({ ...v, campanaId: campana.id })))
    .returning();

  // La A (oferta concreta) convierte más que la genérica, como suele pasar.
  const pesoVariante: Record<string, number> = { A: 1.5, B: 1.0, C: 0.6 };
  const resultados = contactos.map((c, i) => {
    const v = variantes[i % variantes.length];
    const enviadoAt = new Date(hoy - 12 * 86_400_000 + i * 6_000);
    const entregado = azar() < 0.93;
    const leido = entregado && azar() < 0.76;
    const pInteres = Math.min(0.9, (INTERES[c.segmento] ?? 0.08) * pesoVariante[v.codigo]);
    // Quien se interesa necesariamente leyó y respondió; el resto responde a veces.
    const interesado = leido && azar() < pInteres / 0.76;
    const r = azar();
    const otro = !interesado && leido && r < 0.3 ? (r < 0.07 ? "baja" : r < 0.13 ? "pregunta" : "no_interesado") : null;
    const resultado = interesado ? "interesado" : otro;
    return {
      c,
      v,
      resultado,
      fila: {
        campanaId: campana.id,
        contactoId: c.id,
        varianteId: v.id,
        telefono: c.telefono,
        texto: renderPlantilla(v.plantilla, {
          nombre: (c.nombre ?? "").split(" ")[0],
          promocion: campana.promocion,
          categoria: c.categoriaHabitual,
        }),
        estado: "enviado",
        entrega: leido ? "leido" : entregado ? "entregado" : "enviado",
        waMsgId: `sim-ej-${c.id}`,
        enviadoAt,
        entregadoAt: entregado ? new Date(enviadoAt.getTime() + 60_000) : null,
        leidoAt: leido ? new Date(enviadoAt.getTime() + 3_600_000) : null,
        respondioAt: resultado ? new Date(enviadoAt.getTime() + 5_400_000) : null,
        resultado,
      },
    };
  });

  const envios = await db
    .insert(vanniEnvios)
    .values(resultados.map((r) => r.fila))
    .returning({ id: vanniEnvios.id, contactoId: vanniEnvios.contactoId });
  const envioDe = new Map(envios.map((e) => [e.contactoId, e.id]));

  const bajas = resultados.filter((r) => r.resultado === "baja").map((r) => r.c.id);
  if (bajas.length) {
    await db.update(vanniContactos).set({ estado: "baja", bajaAt: new Date() }).where(inArray(vanniContactos.id, bajas));
  }

  const oportunidades = resultados
    .filter((r) => r.resultado === "interesado")
    .map((r) => {
      const e = azar();
      return {
        contactoId: r.c.id,
        campanaId: campana.id,
        envioId: envioDe.get(r.c.id) ?? null,
        interes: `${r.c.categoriaHabitual} para ${r.c.razonSocial?.split(" ")[0]?.toLowerCase() ?? "su negocio"}`,
        resumen: `Respondió a la variante ${r.v.codigo}; quiere retomar compras de ${r.c.categoriaHabitual?.toLowerCase()}.`,
        estado: e < 0.16 ? "por_llamar" : e < 0.45 ? "llamado" : e < 0.85 ? "cotizando" : "ganada",
        notificadaAt: new Date(r.fila.enviadoAt.getTime() + 5_500_000),
        ejemplo: true,
      };
    });
  if (oportunidades.length) await db.insert(vanniOportunidades).values(oportunidades);

  return { contactos: contactos.length, envios: envios.length };
}

export async function borrarEjemplo(): Promise<void> {
  const telefonos = (
    await db.select({ t: vanniContactos.telefono }).from(vanniContactos).where(eq(vanniContactos.ejemplo, true))
  ).map((x) => x.t);
  // Envíos y oportunidades caen en cascada con el contacto y la campaña.
  await db.delete(vanniCampanas).where(eq(vanniCampanas.ejemplo, true));
  await db.delete(vanniContactos).where(eq(vanniContactos.ejemplo, true));
  if (telefonos.length) {
    await db.delete(vanniMensajes).where(inArray(vanniMensajes.telefono, telefonos));
    await db.delete(vanniSesiones).where(inArray(vanniSesiones.telefono, telefonos));
  }
  // Teléfonos del simulador (prefijo inventado) que no quedaron como contacto.
  await db.delete(vanniMensajes).where(like(vanniMensajes.telefono, "569000%"));
  await db.delete(vanniSesiones).where(like(vanniSesiones.telefono, "569000%"));
}
