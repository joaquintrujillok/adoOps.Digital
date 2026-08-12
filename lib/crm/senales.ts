// Motor de señales de conversación.
//
// El problema del ejecutivo no es a quién contactar —esa lista la da el RFM—
// sino **qué decirle** que no suene a "hola, ¿cómo estás?". Una señal es un
// hecho concreto que justifica un contacto hoy, y trae tres cosas:
//
//   · motivo     — qué pasó, en una línea
//   · evidencia  — el dato que lo sostiene; sin esto es una corazonada
//   · borrador   — el mensaje listo para editar y mandar
//
// Dos reglas de diseño que sostienen todo lo demás:
//
//   1. **Una señal se acciona o se descarta, nunca se acumula.** Un panel que
//      solo crece se convierte en otra bandeja que nadie mira. Por eso cada
//      señal vence: un cumpleaños de marzo no sirve en junio.
//   2. **El borrador nunca se manda solo.** El sistema propone, la persona
//      edita y decide. Un mensaje automático a un cliente que gasta millones es
//      la forma más rápida de que la relación se sienta industrial.

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { crmContacts, crmSenales } from "@/db/crm";
import { calcularRfm, clientesAnaliticos, SEGMENTOS, type ClienteRfm } from "./analitica";
import { CLAVES, leer } from "./settings";

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

export type TipoSenal =
  | "recompra"
  | "aniversario"
  | "complemento"
  | "mantencion"
  | "cumpleanos"
  | "reactivacion"
  | "novedad_marca";

export const TIPOS: Record<TipoSenal, { nombre: string; descripcion: string }> = {
  recompra: {
    nombre: "Ventana de recompra",
    descripcion: "Pasó el tiempo que suele pasar entre sus compras.",
  },
  aniversario: {
    nombre: "Aniversario de compra",
    descripcion: "Se cumple un año de una pieza que compró.",
  },
  complemento: {
    nombre: "Complemento",
    descripcion: "Clientes como él suelen sumar algo que él todavía no tiene.",
  },
  mantencion: {
    nombre: "Mantención pendiente",
    descripcion: "Su pieza cumple el plazo de servicio recomendado.",
  },
  cumpleanos: {
    nombre: "Cumpleaños",
    descripcion: "Cumple años en los próximos días.",
  },
  reactivacion: {
    nombre: "Reactivación",
    descripcion: "Era un buen cliente y dejó de venir.",
  },
  novedad_marca: {
    nombre: "Novedad de su marca",
    descripcion: "Llegó algo de una marca que ya compró.",
  },
};

interface SenalCalculada {
  clave: string;
  contactId: number;
  tipo: TipoSenal;
  prioridad: "alta" | "media" | "baja";
  titulo: string;
  evidencia: string;
  borrador: string;
  productId?: number | null;
  ownerId?: number | null;
  venceEn: Date;
}

const enDias = (n: number) => new Date(Date.now() + n * 86_400_000);
const nombrePila = (completo: string) => completo.trim().split(/\s+/)[0];

// ─── Reglas ──────────────────────────────────────────────────────────────────

/**
 * Ventana de recompra: pasó su propio ciclo, no un promedio general.
 *
 * Un cliente que compra cada seis meses y otro que compra cada dos años no se
 * atrasan el mismo día. Mandarles el mismo recordatorio en la misma fecha es
 * exactamente el ruido que hace que la gente silencie a una marca.
 */
function reglaRecompra(clientes: ClienteRfm[], empresa: string): SenalCalculada[] {
  return clientes
    .filter((c) => c.cicloDias !== null && c.recencia !== null)
    .filter((c) => c.recencia! > c.cicloDias! * 1.15 && c.recencia! < c.cicloDias! * 3)
    .map((c) => {
      const atraso = c.recencia! - c.cicloDias!;
      return {
        clave: `recompra:${c.contactId}:${Math.floor(atraso / 30)}`,
        contactId: c.contactId,
        tipo: "recompra" as const,
        prioridad: (c.monto > 20_000_000 ? "alta" : "media") as "alta" | "media",
        titulo: `${c.nombre} lleva ${atraso} días más de lo habitual sin comprar`,
        evidencia:
          `Compra cada ${c.cicloDias} días en promedio y van ${c.recencia}. ` +
          `${c.compras} compras por ${clp(c.monto)}${c.categoriaPrincipal ? `, sobre todo ${c.categoriaPrincipal.toLowerCase()}` : ""}.`,
        borrador:
          `Hola ${nombrePila(c.nombre)}, le escribo de ${empresa}. ` +
          `${c.categoriaPrincipal ? `Llegaron piezas nuevas de ${c.categoriaPrincipal.toLowerCase()} que creo que le van a interesar. ` : "Llegaron piezas nuevas que creo que le van a interesar. "}` +
          `¿Le reservo una cita para que las vea con calma?`,
        ownerId: c.ownerId,
        venceEn: enDias(21),
      };
    });
}

/** Aniversario: un año redondo desde una compra. Excusa perfecta y honesta. */
function reglaAniversario(clientes: ClienteRfm[], empresa: string): SenalCalculada[] {
  const senales: SenalCalculada[] = [];

  for (const c of clientes) {
    if (!c.primeraCompra) continue;
    const anios = Math.floor(
      (Date.now() - c.primeraCompra.getTime()) / (365.25 * 86_400_000),
    );
    if (anios < 1) continue;

    // Cuántos días faltan (o pasaron) para el aniversario de este año.
    const aniversario = new Date(c.primeraCompra);
    aniversario.setFullYear(new Date().getFullYear());
    const dias = Math.round((aniversario.getTime() - Date.now()) / 86_400_000);
    if (dias < -3 || dias > 10) continue;

    senales.push({
      clave: `aniversario:${c.contactId}:${new Date().getFullYear()}`,
      contactId: c.contactId,
      tipo: "aniversario",
      prioridad: "baja",
      titulo: `${c.nombre} cumple ${anios} ${anios === 1 ? "año" : "años"} como cliente`,
      evidencia: `Su primera compra fue el ${c.primeraCompra.toLocaleDateString("es-CL")}. Desde entonces lleva ${c.compras} compras por ${clp(c.monto)}.`,
      borrador:
        `Hola ${nombrePila(c.nombre)}, le escribo de ${empresa}. ` +
        `Se cumplen ${anios} ${anios === 1 ? "año" : "años"} desde que confió en nosotros por primera vez, y quería agradecérselo. ` +
        `Si quiere que revisemos su pieza o ver las novedades de la temporada, quedo a su disposición.`,
      ownerId: c.ownerId,
      venceEn: enDias(14),
    });
  }

  return senales;
}

/**
 * Complemento: lo que compra gente parecida y este cliente todavía no tiene.
 *
 * Se calcula dentro de su segmento RFM y no sobre toda la base: lo que suma un
 * campeón no es lo que suma alguien que compró una vez, y recomendar según el
 * promedio general produce sugerencias que no le calzan a nadie.
 */
function reglaComplemento(clientes: ClienteRfm[], empresa: string): SenalCalculada[] {
  const senales: SenalCalculada[] = [];

  // Qué categorías son frecuentes dentro de cada segmento.
  const porSegmento = new Map<string, Map<string, number>>();
  for (const c of clientes) {
    const mapa = porSegmento.get(c.segmento) ?? new Map<string, number>();
    for (const cat of c.categorias) mapa.set(cat, (mapa.get(cat) ?? 0) + 1);
    porSegmento.set(c.segmento, mapa);
  }

  for (const c of clientes) {
    // Solo a quien ya volvió: sugerirle un complemento a alguien que compró una
    // sola vez hace dos años es adivinar, no recomendar.
    if (c.compras < 2 || (c.recencia ?? 9999) > 400) continue;

    const mapa = porSegmento.get(c.segmento);
    if (!mapa) continue;
    const total = clientes.filter((x) => x.segmento === c.segmento).length || 1;

    const faltante = [...mapa.entries()]
      .filter(([cat]) => !c.categorias.includes(cat))
      .map(([cat, n]) => ({ cat, penetracion: (n / total) * 100 }))
      .sort((a, b) => b.penetracion - a.penetracion)[0];

    // Bajo el 35% no es un patrón, es ruido: recomendarlo enseña a desconfiar.
    if (!faltante || faltante.penetracion < 35) continue;

    senales.push({
      clave: `complemento:${c.contactId}:${faltante.cat}`,
      contactId: c.contactId,
      tipo: "complemento",
      prioridad: "baja",
      titulo: `${c.nombre} no tiene nada de ${faltante.cat.toLowerCase()}`,
      evidencia: `El ${Math.round(faltante.penetracion)}% de los clientes de su mismo perfil (${SEGMENTOS[c.segmento].nombre.toLowerCase()}) sí compró ${faltante.cat.toLowerCase()}. Él lleva ${c.compras} compras y nunca lo hizo.`,
      borrador:
        `Hola ${nombrePila(c.nombre)}, le escribo de ${empresa}. ` +
        `Pensando en lo que ya tiene, creo que le puede interesar ver nuestra selección de ${faltante.cat.toLowerCase()}. ` +
        `¿Le muestro un par de opciones?`,
      ownerId: c.ownerId,
      venceEn: enDias(45),
    });
  }

  return senales;
}

/**
 * Mantención: la pieza cumple el plazo de servicio.
 *
 * En relojería el servicio es la excusa de contacto más natural que existe: no
 * está vendiendo nada, está cuidando lo que el cliente ya compró. Y de paso el
 * cliente vuelve a entrar a la boutique.
 */
async function reglaMantencion(clientes: ClienteRfm[], empresa: string): Promise<SenalCalculada[]> {
  const filas = await db.execute(sql`
    SELECT o.contact_id AS "contactId", MAX(o.fecha) AS "ultimaPieza"
    FROM crm_orders o
    JOIN crm_order_items i ON i.order_id = o.id
    JOIN crm_products p ON p.id = i.product_id
    WHERE o.contact_id IS NOT NULL
      AND p.categoria IN ('Alta relojería', 'Relojes deportivos', 'Relojes clásicos')
    GROUP BY o.contact_id
  `);

  // Quién ya hizo un servicio, y cuándo.
  const servicios = await db.execute(sql`
    SELECT o.contact_id AS "contactId", MAX(o.fecha) AS "ultimoServicio"
    FROM crm_orders o
    JOIN crm_order_items i ON i.order_id = o.id
    JOIN crm_products p ON p.id = i.product_id
    WHERE o.contact_id IS NOT NULL AND p.categoria = 'Servicios'
    GROUP BY o.contact_id
  `);

  const ultimoServicio = new Map(
    (servicios.rows as unknown as { contactId: number; ultimoServicio: string }[]).map((f) => [
      Number(f.contactId),
      new Date(f.ultimoServicio).getTime(),
    ]),
  );
  const porId = new Map(clientes.map((c) => [c.contactId, c]));
  const senales: SenalCalculada[] = [];

  for (const f of filas.rows as unknown as { contactId: number; ultimaPieza: string }[]) {
    const c = porId.get(Number(f.contactId));
    if (!c) continue;

    const compraReloj = new Date(f.ultimaPieza).getTime();
    const mesesDesdeCompra = (Date.now() - compraReloj) / (30 * 86_400_000);
    if (mesesDesdeCompra < 14) continue;

    // Si ya hizo servicio después de comprar el reloj, está al día.
    const servicio = ultimoServicio.get(c.contactId);
    if (servicio && servicio > compraReloj && (Date.now() - servicio) / (30 * 86_400_000) < 14) {
      continue;
    }

    senales.push({
      clave: `mantencion:${c.contactId}:${Math.floor(mesesDesdeCompra / 12)}`,
      contactId: c.contactId,
      tipo: "mantencion",
      prioridad: "media",
      titulo: `La pieza de ${c.nombre} cumple el plazo de mantención`,
      evidencia: `Compró su reloj hace ${Math.round(mesesDesdeCompra)} meses y ${servicio ? "el último servicio fue antes de esa compra" : "no registra ningún servicio desde entonces"}.`,
      borrador:
        `Hola ${nombrePila(c.nombre)}, le escribo de ${empresa}. ` +
        `Ya se cumple el plazo recomendado para la mantención de su pieza. ` +
        `Si quiere, la agendamos y se la dejamos como nueva. ¿Le acomoda que coordinemos esta semana?`,
      ownerId: c.ownerId,
      venceEn: enDias(60),
    });
  }

  return senales;
}

/** Cumpleaños dentro de los próximos siete días. */
async function reglaCumpleanos(clientes: ClienteRfm[], empresa: string): Promise<SenalCalculada[]> {
  const filas = await db.execute(sql`
    SELECT id AS "contactId", cumpleanos
    FROM crm_contacts
    WHERE cumpleanos IS NOT NULL
      AND (
        (EXTRACT(DOY FROM cumpleanos) - EXTRACT(DOY FROM NOW())) BETWEEN 0 AND 7
        OR (EXTRACT(DOY FROM cumpleanos) - EXTRACT(DOY FROM NOW())) BETWEEN -358 AND -351
      )
  `);

  const porId = new Map(clientes.map((c) => [c.contactId, c]));
  const senales: SenalCalculada[] = [];

  for (const f of filas.rows as unknown as { contactId: number; cumpleanos: string }[]) {
    const c = porId.get(Number(f.contactId));
    // Solo a clientes activos: un saludo de cumpleaños a alguien que compró una
    // vez hace tres años se lee como lo que es, un correo automático.
    if (!c || (c.recencia ?? 9999) > 540) continue;

    const dia = new Date(f.cumpleanos);
    senales.push({
      clave: `cumpleanos:${c.contactId}:${new Date().getFullYear()}`,
      contactId: c.contactId,
      tipo: "cumpleanos",
      prioridad: "baja",
      titulo: `${c.nombre} cumple años el ${dia.getDate()} de ${dia.toLocaleDateString("es-CL", { month: "long" })}`,
      evidencia: `Cliente desde ${c.primeraCompra?.getFullYear() ?? "hace tiempo"}, ${c.compras} compras por ${clp(c.monto)}.`,
      borrador:
        `Hola ${nombrePila(c.nombre)}, de parte de todo el equipo de ${empresa}, ` +
        `que tenga un muy feliz cumpleaños. Un gusto tenerlo entre nuestros clientes.`,
      ownerId: c.ownerId,
      venceEn: enDias(8),
    });
  }

  return senales;
}

/** Reactivación: era bueno y se fue. La llamada la hace el ejecutivo, no un correo. */
function reglaReactivacion(clientes: ClienteRfm[], empresa: string): SenalCalculada[] {
  return clientes
    .filter((c) => ["no_perder", "en_riesgo"].includes(c.segmento))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 25)
    .map((c) => ({
      clave: `reactivacion:${c.contactId}:${new Date().toISOString().slice(0, 7)}`,
      contactId: c.contactId,
      tipo: "reactivacion" as const,
      prioridad: (c.segmento === "no_perder" ? "alta" : "media") as "alta" | "media",
      titulo: `${c.nombre} está en «${SEGMENTOS[c.segmento].nombre}» y no hay que perderlo`,
      evidencia: `Compró ${c.compras} veces por ${clp(c.monto)} y lleva ${c.recencia} días sin volver. Su ticket promedio es ${clp(c.ticketPromedio)}.`,
      borrador:
        `Hola ${nombrePila(c.nombre)}, le escribo de ${empresa}. ` +
        `Hace un tiempo que no conversamos y quería saber cómo ha estado. ` +
        `Tenemos novedades que creo que van con lo que a usted le gusta. ¿Le parece si coordinamos una visita sin apuro?`,
      ownerId: c.ownerId,
      venceEn: enDias(30),
    }));
}

// ─── Ejecución ───────────────────────────────────────────────────────────────

export async function recalcularSenales(): Promise<{ generadas: number; nuevas: number }> {
  const empresa = (await leer(CLAVES.empresa)) ?? "la boutique";
  const rfm = calcularRfm(await clientesAnaliticos());

  const grupos = await Promise.all([
    Promise.resolve(reglaRecompra(rfm, empresa)),
    Promise.resolve(reglaAniversario(rfm, empresa)),
    Promise.resolve(reglaComplemento(rfm, empresa)),
    reglaMantencion(rfm, empresa),
    reglaCumpleanos(rfm, empresa),
    Promise.resolve(reglaReactivacion(rfm, empresa)),
  ]);

  // Tope por tipo, priorizando al cliente que más vale.
  //
  // Sin esto el motor produce cientos de señales y la bandeja deja de ser una
  // lista de trabajo para convertirse en un archivo — que es exactamente lo que
  // este módulo existe para evitar. El tope obliga a que lo que aparece sea lo
  // que de verdad conviene hacer esta semana, no todo lo que técnicamente
  // aplica.
  const valorPorContacto = new Map(rfm.map((c) => [c.contactId, c.monto]));
  const TOPE_POR_TIPO = 30;

  const todas = grupos.flatMap((grupo) =>
    [...grupo]
      .sort(
        (a, b) =>
          (valorPorContacto.get(b.contactId) ?? 0) - (valorPorContacto.get(a.contactId) ?? 0),
      )
      .slice(0, TOPE_POR_TIPO),
  );
  if (todas.length === 0) return { generadas: 0, nuevas: 0 };

  // Idempotente por clave: correr esto todos los días no duplica nada, y una
  // señal ya accionada o descartada no revive.
  const existentes = await db
    .select({ clave: crmSenales.clave })
    .from(crmSenales)
    .where(inArray(crmSenales.clave, todas.map((s) => s.clave)));
  const yaEstaban = new Set(existentes.map((e) => e.clave));

  const nuevas = todas.filter((s) => !yaEstaban.has(s.clave));
  if (nuevas.length > 0) {
    await db
      .insert(crmSenales)
      .values(
        nuevas.map((s) => ({
          clave: s.clave,
          contactId: s.contactId,
          tipo: s.tipo,
          prioridad: s.prioridad,
          titulo: s.titulo,
          evidencia: s.evidencia,
          borrador: s.borrador,
          productId: s.productId ?? null,
          ownerId: s.ownerId ?? null,
          venceEn: s.venceEn,
        })),
      )
      .onConflictDoNothing({ target: crmSenales.clave });
  }

  // Las vencidas se cierran solas: una señal que ya no aplica ocupando la
  // bandeja enseña a ignorar la bandeja.
  await db
    .update(crmSenales)
    .set({ estado: "descartada", resueltaEn: new Date() })
    .where(and(eq(crmSenales.estado, "pendiente"), sql`${crmSenales.venceEn} < NOW()`));

  return { generadas: todas.length, nuevas: nuevas.length };
}

export interface SenalListada {
  id: number;
  tipo: string;
  prioridad: string;
  titulo: string;
  evidencia: string | null;
  borrador: string | null;
  contactId: number;
  contacto: string;
  telefono: string | null;
  optIn: boolean;
  ownerId: number | null;
  generadaEn: Date;
  venceEn: Date | null;
}

export async function listarSenales(opciones?: {
  ownerId?: number | null;
  tipo?: string;
}): Promise<SenalListada[]> {
  const condiciones = [eq(crmSenales.estado, "pendiente")];
  if (opciones?.ownerId != null) condiciones.push(eq(crmSenales.ownerId, opciones.ownerId));
  if (opciones?.tipo) condiciones.push(eq(crmSenales.tipo, opciones.tipo));

  const filas = await db
    .select({
      s: crmSenales,
      contacto: crmContacts.nombre,
      telefono: crmContacts.telefono,
      optIn: crmContacts.optInWhatsapp,
    })
    .from(crmSenales)
    .innerJoin(crmContacts, eq(crmContacts.id, crmSenales.contactId))
    .where(and(...condiciones))
    .orderBy(
      sql`case ${crmSenales.prioridad} when 'alta' then 0 when 'media' then 1 else 2 end`,
      desc(crmSenales.generadaEn),
    )
    .limit(150);

  return filas.map((f) => ({
    id: f.s.id,
    tipo: f.s.tipo,
    prioridad: f.s.prioridad,
    titulo: f.s.titulo,
    evidencia: f.s.evidencia,
    borrador: f.s.borrador,
    contactId: f.s.contactId,
    contacto: f.contacto,
    telefono: f.telefono,
    optIn: f.optIn,
    ownerId: f.s.ownerId,
    generadaEn: f.s.generadaEn,
    venceEn: f.s.venceEn,
  }));
}

export async function resumirSenales() {
  const filas = await db.execute(sql`
    SELECT tipo, prioridad, COUNT(*)::int AS n
    FROM crm_senales WHERE estado = 'pendiente'
    GROUP BY tipo, prioridad
  `);
  const datos = filas.rows as unknown as { tipo: string; prioridad: string; n: number }[];

  const porTipo = new Map<string, number>();
  let altas = 0;
  let total = 0;
  for (const f of datos) {
    porTipo.set(f.tipo, (porTipo.get(f.tipo) ?? 0) + Number(f.n));
    if (f.prioridad === "alta") altas += Number(f.n);
    total += Number(f.n);
  }

  return {
    total,
    altas,
    porTipo: [...porTipo.entries()]
      .map(([tipo, n]) => ({
        tipo,
        nombre: TIPOS[tipo as TipoSenal]?.nombre ?? tipo,
        descripcion: TIPOS[tipo as TipoSenal]?.descripcion ?? "",
        senales: n,
      }))
      .sort((a, b) => b.senales - a.senales),
  };
}

export async function cambiarEstadoSenal(
  id: number,
  estado: "accionada" | "descartada",
): Promise<void> {
  await db
    .update(crmSenales)
    .set({ estado, resueltaEn: new Date() })
    .where(eq(crmSenales.id, id));
}
