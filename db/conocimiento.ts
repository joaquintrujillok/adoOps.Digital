// =============================================================================
// Base de conocimiento del copiloto — esquema
// =============================================================================
//
// Una tabla: los trozos del material comercial, con su vector, por cuenta.
//
// ── Por qué se recupera en vez de inyectar todo ──────────────────────────────
//
// Se midió antes de decidir. Las bases de Soho y adoOps son ~57.000 y ~52.000
// tokens. El copiloto razona cada 20 segundos, o sea unas 180 veces por hora:
// mandar la base entera en cada pasada costaría US$1,40 la hora —más que la
// transcripción— y daría PEORES respuestas, porque enterraría la conversación
// bajo cincuenta mil tokens de catálogo.
//
// Con recuperación son ~4.300 tokens por pasada y US$0,12 la hora. La diferencia
// no es solo de precio: el modelo ve lo que importa en vez de todo.
//
// ── Por qué los trozos son las subsecciones, sin inventar el corte ───────────
//
// Los documentos ya vienen cortados: 125 subsecciones `###` de unos 1.100 tokens
// cada una, y cada una es una solución del catálogo completa. Partir por
// caracteres —lo que hace la mayoría de las tuberías de RAG— habría cortado una
// solución por la mitad y devuelto media respuesta. Cuando el documento tiene
// estructura, la estructura es el mejor criterio de corte que hay.
//
// ── Los dos niveles ──────────────────────────────────────────────────────────
//
// No todo el material se recupera. La sección 0 de cada base es "Cómo usar esta
// base (instrucciones para el agente en vivo)": no es material de consulta, es
// política, y tiene que estar SIEMPRE presente o el copiloto opera sin sus
// reglas. Por eso `siempre` es una columna y no una convención: la decisión
// viaja con el trozo.

import {
  index,
  integer,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

/**
 * Dimensiones de `text-embedding-3-small`. Está acá y no repartido porque
 * cambiar de modelo de embeddings obliga a recrear la columna: los vectores de
 * dos modelos distintos no se comparan, y mezclarlos daría resultados que se
 * ven plausibles y son ruido.
 */
export const DIMENSIONES = 1536;

export const conocimientoTrozos = pgTable(
  "conocimiento_trozos",
  {
    id: serial("id").primaryKey(),
    /** Id de cuenta: `soho`, `adoops`… Ver `lib/cuentas.ts`. */
    cuenta: varchar("cuenta", { length: 40 }).notNull(),
    /** De qué archivo salió. Para poder reingerir uno sin tocar el otro. */
    origen: varchar("origen", { length: 200 }).notNull(),

    /**
     * La jerarquía completa: "2. Cómo se nos compra › 2.3 Fábrica de software".
     * Se guarda armada y no se reconstruye al vuelo porque es lo que se le
     * muestra al modelo junto al texto: un trozo sin su camino se lee fuera de
     * contexto, y el modelo no sabe si "los tres modelos" son de servicio o de IA.
     */
    ruta: text("ruta").notNull(),
    titulo: text("titulo").notNull(),
    texto: text("texto").notNull(),

    /** Posición en el documento. Para poder mostrar los trozos en orden. */
    orden: integer("orden").notNull().default(0),
    /**
     * 1 si va en todas las pasadas sin pasar por la búsqueda. Ver la nota de los
     * dos niveles en la cabecera.
     */
    siempre: smallint("siempre").notNull().default(0),

    /**
     * El vector. Null si el trozo se cargó sin embedding —pasa si la ingesta se
     * corta a la mitad—, y en ese caso simplemente no se recupera: es preferible
     * un trozo invisible a uno que se compara contra un vector inventado.
     */
    vector: vector("vector", { dimensions: DIMENSIONES }),
    tokens: integer("tokens"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("conocimiento_trozos_cuenta_idx").on(t.cuenta),
    index("conocimiento_trozos_siempre_idx").on(t.siempre),
  ],
);

export type ConocimientoTrozo = typeof conocimientoTrozos.$inferSelect;
