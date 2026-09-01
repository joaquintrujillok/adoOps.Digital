// El estado de cada perfil conectado: quién puede publicar hoy y quién no.
//
// ── Por qué esta pantalla existe ─────────────────────────────────────────────
//
// El motor vigila cuota y warm-up porque le escribe a desconocidos. Acá no hay
// nada de eso: publicar en el perfil propio no quema ninguna cuenta.
//
// Lo que sí se puede romper —y se rompe callado— es la autorización. Los tokens
// de LinkedIn duran 60 días y los refresh programáticos están limitados a
// partners, así que **ninguna tarea programada los renueva sola**. Con varios
// emisores hay varios relojes corriendo en paralelo, y el síntoma de uno vencido
// no es un error: es un perfil que deja de publicar y nadie lo nota hasta que
// alguien pregunta por qué hace dos semanas que no sale nada.
//
// De ahí el margen de 14 días. Es el mismo criterio del freno automático del
// motor: cuando una persona lee la alerta, la publicación ya no salió. Avisar el
// día 60 no sirve — hay que coordinar a una persona real para que reautorice, y
// eso no pasa en 24 horas.

import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Días de margen antes del vencimiento en que el emisor pasa a "por vencer". */
export const MARGEN_AVISO_DIAS = 14;

export type EstadoEmisor =
  | "conectado"
  | "por vencer"
  | "vencido"
  | "sin conectar"
  | "pausado";

export interface FilaEmisorContenido {
  id: number;
  nombre: string;
  tipo: string;
  rol: string | null;
  /** Null si nunca se conectó. */
  autorUrn: string | null;
  estado: EstadoEmisor;
  /** Cómo se pinta el chip. Mismo vocabulario que `FilaEmisor` del motor. */
  tono: "ok" | "warn" | "risk";
  /** Días hasta que venza el token. Negativo si ya venció, null si no hay token. */
  diasRestantes: number | null;
  /** Qué hacer con esta fila, en una línea. Vacío si no hay nada que hacer. */
  sugerencia: string;
  /** Título y fecha de lo último que salió. Detecta el silencio. */
  ultimaPublicacion: { titulo: string; en: Date } | null;
  /** Lo siguiente que le toca según el programa. */
  proximaPieza: { titulo: string; fecha: string | null } | null;
}

type Cruda = {
  id: number;
  nombre: string;
  tipo: string;
  rol: string | null;
  autor_urn: string | null;
  tiene_token: number;
  token_vence_en: string | null;
  pausado: number;
  ultima_titulo: string | null;
  ultima_en: string | null;
  proxima_titulo: string | null;
  proxima_fecha: string | null;
};

/**
 * Una sola consulta para toda la pantalla.
 *
 * Los `LATERAL` traen la última publicación y la próxima pieza sin abrir dos
 * consultas por emisor. Con cuatro emisores daría igual; con veinte, no — y la
 * forma correcta cuesta lo mismo escribirla ahora.
 *
 * **El token no se selecciona.** Se pregunta si existe, no cuánto vale: este
 * resultado viaja a un componente de servidor que renderiza HTML, y un token en
 * el árbol de React es un token a un `console.log` de distancia de una fuga.
 */
export async function estadoEmisores(ahora = new Date()): Promise<FilaEmisorContenido[]> {
  const r = await db.execute<Cruda>(sql`
    SELECT e.id,
           e.nombre,
           e.tipo,
           e.rol,
           e.autor_urn,
           (e.token IS NOT NULL)::int AS tiene_token,
           e.token_vence_en,
           e.pausado,
           u.titulo       AS ultima_titulo,
           u.publicada_en AS ultima_en,
           p.titulo       AS proxima_titulo,
           p.fecha_objetivo AS proxima_fecha
      FROM contenido_emisores e
      LEFT JOIN LATERAL (
           SELECT pz.titulo, pub.publicada_en
             FROM contenido_publicaciones pub
             JOIN contenido_piezas pz ON pz.id = pub.pieza_id
            WHERE pub.emisor_id = e.id AND pub.urn IS NOT NULL
            ORDER BY pub.publicada_en DESC
            LIMIT 1
      ) u ON true
      LEFT JOIN LATERAL (
           SELECT pz.titulo, pz.fecha_objetivo
             FROM contenido_piezas pz
            WHERE pz.emisor_id = e.id
              AND pz.estado IN ('borrador', 'revision', 'aprobada', 'programada')
            ORDER BY pz.fecha_objetivo ASC NULLS LAST, pz.slot ASC NULLS LAST
            LIMIT 1
      ) p ON true
     ORDER BY e.token_vence_en ASC NULLS FIRST, e.id ASC
  `);

  return r.rows.map((f) => clasificar(f, ahora));
}

function clasificar(f: Cruda, ahora: Date): FilaEmisorContenido {
  const vence = f.token_vence_en ? new Date(f.token_vence_en) : null;
  const conectado = f.tiene_token === 1 && !!f.autor_urn;

  // Se redondea hacia arriba: si faltan 30 horas, quedan 2 días, no 1. Redondear
  // hacia abajo hace que el último día se muestre como 0 y se lea como vencido.
  //
  // La columna es `timestamp` sin zona —como todas las del repo— así que al
  // leerla se interpreta en la zona del servidor y puede correrse unas horas
  // respecto del instante real. Es deliberado no pelearlo: el umbral que decide
  // algo son 14 días, y unas horas no mueven esa cuenta. Si algún día esto
  // gobernara algo con granularidad de horas, hay que pasar la columna a
  // `timestamptz` antes que ajustar este cálculo.
  const diasRestantes = vence
    ? Math.ceil((vence.getTime() - ahora.getTime()) / 86_400_000)
    : null;

  const base = {
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo,
    rol: f.rol,
    autorUrn: f.autor_urn,
    diasRestantes,
    ultimaPublicacion: f.ultima_titulo && f.ultima_en
      ? { titulo: f.ultima_titulo, en: new Date(f.ultima_en) }
      : null,
    proximaPieza: f.proxima_titulo
      ? { titulo: f.proxima_titulo, fecha: f.proxima_fecha }
      : null,
  };

  if (!conectado) {
    // La página de empresa se distingue de una persona sin conectar: su bloqueo
    // no se resuelve pidiéndole a alguien que autorice, sino destrabando un
    // producto en el portal. Decirlo acá evita que alguien lo intente y se
    // estrelle contra un 403 sin explicación.
    const esPagina = f.tipo === "organizacion";
    return {
      ...base,
      estado: "sin conectar",
      tono: "risk",
      sugerencia: esPagina
        ? "Publicar como la página exige w_organization_social, que no es autoservicio: viene con Community Management API"
        : "Falta que esta persona autorice la app",
    };
  }

  if (diasRestantes !== null && diasRestantes <= 0) {
    return {
      ...base,
      estado: "vencido",
      tono: "risk",
      sugerencia: "El token venció. Nada sale de este perfil hasta que reautorice",
    };
  }

  // El pausado se evalúa después del vencimiento: una cuenta pausada Y vencida
  // es un problema de token, y mostrarla como "pausada" escondería el aviso.
  if (f.pausado === 1) {
    return { ...base, estado: "pausado", tono: "warn", sugerencia: "Pausado a mano" };
  }

  if (diasRestantes !== null && diasRestantes <= MARGEN_AVISO_DIAS) {
    return {
      ...base,
      estado: "por vencer",
      tono: "warn",
      sugerencia: `Reautorizar dentro de ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"}`,
    };
  }

  return { ...base, estado: "conectado", tono: "ok", sugerencia: "" };
}

/** Para el badge del menú: emisores que exigen que alguien haga algo. */
export function conProblema(filas: FilaEmisorContenido[]): number {
  return filas.filter((f) => f.tono !== "ok").length;
}
