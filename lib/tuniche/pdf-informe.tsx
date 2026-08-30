/**
 * El informe de visita como PDF, generado en el servidor.
 *
 * **Existe aparte de la página de `/tuniche/informes/[id]`** porque son dos
 * cosas distintas: esa se mira e imprime desde el navegador de quien trabaja
 * adentro; esta se genera en el servidor para poder **adjuntarla al WhatsApp del
 * agricultor**, que fue lo que pidieron.
 *
 * Se usa `@react-pdf/renderer` y no un navegador headless, por la misma razón
 * por la que lo eligió el CRM de CDC de donde viene esta pieza: Puppeteer en
 * Vercel pesa unos 50 MB, hay que mantenerlo al día con Chromium y arranca
 * lento. Esto es JavaScript puro y produce el mismo documento.
 *
 * **Contrapartida honesta:** react-pdf tiene su propio sistema de estilos, así
 * que esta maqueta se mantiene aparte de la de la pantalla. Si cambia una hay
 * que cambiar la otra. Lo que sí está compartido es el contenido —los dos leen
 * el mismo snapshot congelado— así que lo que puede divergir es la forma, nunca
 * el dato.
 */

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ContenidoVisita } from "@/db/tuniche";

const TINTA = "#16211a";
const GRIS = "#47584d";
const SUAVE = "#7d8c82";
const LINEA = "#dde5df";
const VERDE = "#2f6f4e";
const AMBAR = "#b45309";
const ROJO = "#a4262c";

const s = StyleSheet.create({
  pagina: { paddingTop: 42, paddingBottom: 46, paddingHorizontal: 46, fontSize: 9.5, color: TINTA },

  cabecera: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1.5,
    borderBottomColor: VERDE,
    paddingBottom: 12,
  },
  marca: { fontSize: 13, fontFamily: "Helvetica-Bold", color: VERDE },
  area: { fontSize: 8, color: SUAVE, letterSpacing: 0.9, marginTop: 3 },
  rotulo: { fontSize: 7, color: SUAVE, letterSpacing: 0.8, textAlign: "right" },
  titulo: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 2, textAlign: "right" },
  fecha: { fontSize: 8.5, color: GRIS, marginTop: 2, textAlign: "right" },

  quien: { paddingTop: 16, paddingBottom: 14, borderBottomWidth: 0.7, borderBottomColor: LINEA },
  agricultor: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  sitio: { fontSize: 9.5, color: GRIS, marginTop: 3 },

  grilla: { flexDirection: "row", flexWrap: "wrap", paddingTop: 14 },
  celda: { width: "33.33%", marginBottom: 12, paddingRight: 10 },
  celdaAncha: { width: "50%", marginBottom: 12, paddingRight: 10 },
  k: { fontSize: 6.8, color: SUAVE, letterSpacing: 0.7 },
  v: { fontSize: 10, marginTop: 2.5 },

  resumen: {
    marginTop: 4,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#f2f7f4",
    borderLeftWidth: 2.5,
    borderLeftColor: VERDE,
    fontSize: 10.5,
    lineHeight: 1.5,
  },

  notaCaja: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 16 },
  notaCifra: { fontSize: 26, fontFamily: "Helvetica-Bold" },
  notaK: { fontSize: 7, color: SUAVE, letterSpacing: 0.8 },

  seccion: { fontSize: 7.5, color: SUAVE, letterSpacing: 1, marginTop: 6, marginBottom: 8,
    borderTopWidth: 0.7, borderTopColor: LINEA, paddingTop: 12 },

  fotos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  foto: { width: 152 },
  img: { width: 152, height: 114, objectFit: "cover", borderRadius: 3 },
  hueco: {
    width: 152, height: 114, borderRadius: 3, borderWidth: 0.7, borderColor: LINEA,
    alignItems: "center", justifyContent: "center", backgroundColor: "#f6f8f6",
  },
  huecoT: { fontSize: 7.5, color: SUAVE },
  pieFoto: { fontSize: 7.5, color: SUAVE, marginTop: 3, textTransform: "capitalize" },

  pie: {
    position: "absolute", bottom: 26, left: 46, right: 46,
    borderTopWidth: 0.7, borderTopColor: LINEA, paddingTop: 8,
    fontSize: 7.5, color: SUAVE, flexDirection: "row", justifyContent: "space-between",
  },
});

function colorNota(n: number): string {
  if (n >= 80) return VERDE;
  if (n >= 60) return AMBAR;
  return ROJO;
}

const fechaLarga = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(iso),
  );

/** Foto ya resuelta a algo que react-pdf sabe dibujar, o su motivo de ausencia. */
interface FotoLista {
  tipo: string;
  src: string | null;
  /** Por qué no se pudo incrustar. Un hueco sin motivo hace dudar del informe. */
  motivo?: string;
}

/**
 * Baja cada foto y la deja como data URI.
 *
 * **Se descargan acá y no se le pasa la URL a react-pdf** por dos razones: la
 * librería haría la petición sin límite de tiempo —y un blob lento dejaría el
 * envío colgado— y además hay que mirar el tipo real. Solo entran PNG y JPEG:
 * las fotos de demostración son SVG, que react-pdf no dibuja, y pasárselas
 * reventaría el documento entero por una imagen de mentira.
 *
 * Una foto que no se puede bajar no cancela el informe: deja su hueco rotulado.
 * Un informe sin una foto sigue sirviendo; uno que no se generó, no.
 */
async function resolverFotos(fotos: { url: string; tipo: string }[]): Promise<FotoLista[]> {
  return Promise.all(
    fotos.map(async (f) => {
      try {
        if (f.url.startsWith("data:image/")) {
          const ok = /^data:image\/(png|jpe?g);base64,/.test(f.url);
          return { tipo: f.tipo, src: ok ? f.url : null, motivo: ok ? undefined : "foto de demostración" };
        }
        const res = await fetch(f.url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return { tipo: f.tipo, src: null, motivo: "no se pudo bajar" };
        const tipoMime = (res.headers.get("content-type") ?? "").toLowerCase();
        if (!/^image\/(png|jpe?g)/.test(tipoMime)) return { tipo: f.tipo, src: null, motivo: "formato no admitido" };
        const buf = Buffer.from(await res.arrayBuffer());
        return { tipo: f.tipo, src: `data:${tipoMime.split(";")[0]};base64,${buf.toString("base64")}` };
      } catch {
        return { tipo: f.tipo, src: null, motivo: "no se pudo bajar" };
      }
    }),
  );
}

function Informe({
  c,
  fotos,
  demo,
  pie,
}: {
  c: ContenidoVisita;
  fotos: FotoLista[];
  demo: boolean;
  pie: string;
}) {
  return (
    <Document
      title={`Visita ${c.lote} · ${c.agricultor}`}
      author="Semillas Tuniche"
      subject="Informe de visita a campo"
    >
      <Page size="A4" style={s.pagina}>
        {/* La marca de demostración va DENTRO del documento y no solo en la
            pantalla: un PDF se descarga, se reenvía y se imprime, y fuera del
            sistema nada más lo distingue de uno real. */}
        {demo && (
          <View
            style={{
              marginBottom: 14, padding: 8, borderWidth: 1, borderColor: AMBAR,
              borderRadius: 3, backgroundColor: "#fdf3e3",
            }}
          >
            <Text style={{ fontSize: 8, color: AMBAR, fontFamily: "Helvetica-Bold", letterSpacing: 0.8 }}>
              DOCUMENTO DE DEMOSTRACIÓN
            </Text>
            <Text style={{ fontSize: 8, color: AMBAR, marginTop: 3 }}>
              El agricultor, el lote y las observaciones son inventados. No corresponden a
              ningún campo real y esta hoja no debe enviarse a nadie.
            </Text>
          </View>
        )}

        <View style={s.cabecera}>
          <View>
            <Text style={s.marca}>Semillas Tuniche</Text>
            <Text style={s.area}>VISITAS A CAMPO</Text>
          </View>
          <View>
            <Text style={s.rotulo}>INFORME DE VISITA</Text>
            <Text style={s.titulo}>{c.lote}</Text>
            <Text style={s.fecha}>{fechaLarga(c.fecha)}</Text>
          </View>
        </View>

        <View style={s.quien}>
          <Text style={s.agricultor}>{c.agricultor}</Text>
          <Text style={s.sitio}>
            {[c.localidad, c.cultivo, c.variedad, c.hectareas ? `${c.hectareas} ha` : null]
              .filter(Boolean)
              .join("  ·  ")}
          </Text>
        </View>

        {c.resumen ? <Text style={s.resumen}>{c.resumen}</Text> : <View style={{ height: 14 }} />}

        {c.notaAgronomica != null && (
          <View style={s.notaCaja}>
            <Text style={{ ...s.notaCifra, color: colorNota(c.notaAgronomica) }}>
              {c.notaAgronomica}%
            </Text>
            <Text style={s.notaK}>NOTA AGRONÓMICA</Text>
          </View>
        )}

        <View style={s.grilla}>
          {c.etapa && (
            <View style={s.celda}>
              <Text style={s.k}>ETAPA</Text>
              <Text style={s.v}>{c.etapa}</Text>
            </View>
          )}
          {c.campos.map((campo) => (
            <View key={campo.etiqueta} style={campo.valor.length > 40 ? s.celdaAncha : s.celda}>
              <Text style={s.k}>{campo.etiqueta.toUpperCase()}</Text>
              <Text style={s.v}>{campo.valor}</Text>
            </View>
          ))}
        </View>

        {fotos.length > 0 && (
          <View>
            <Text style={s.seccion}>REGISTRO FOTOGRÁFICO</Text>
            <View style={s.fotos}>
              {fotos.map((f, i) => (
                <View key={i} style={s.foto} wrap={false}>
                  {f.src ? (
                    <Image style={s.img} src={f.src} />
                  ) : (
                    <View style={s.hueco}>
                      <Text style={s.huecoT}>{f.motivo ?? "no disponible"}</Text>
                    </View>
                  )}
                  <Text style={s.pieFoto}>{f.tipo}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={s.pie} fixed>
          <Text>{pie}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function generarPdfInforme(p: {
  contenido: ContenidoVisita;
  demo: boolean;
  generadoPor: string | null;
  aprobadoPor: string | null;
}): Promise<Buffer> {
  const fotos = await resolverFotos(p.contenido.fotos ?? []);
  const pie = [
    `Visita realizada por ${p.contenido.zonal}`,
    p.aprobadoPor ? `Visto bueno de ${p.aprobadoPor}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return renderToBuffer(
    <Informe c={p.contenido} fotos={fotos} demo={p.demo} pie={pie} />,
  );
}

/** El nombre del archivo que ve el agricultor en su teléfono. */
export function nombrePdf(c: ContenidoVisita): string {
  const fecha = new Date(c.fecha).toISOString().slice(0, 10);
  const lote = c.lote.replace(/[^A-Za-z0-9-]/g, "");
  return `Visita-${lote}-${fecha}.pdf`;
}
