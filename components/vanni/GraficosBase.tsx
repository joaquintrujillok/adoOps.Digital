// Gráficos de la base de contactos. Todos son de una sola serie o de una
// escala secuencial de un solo tono (el verde de acción): la identidad la dan
// las etiquetas, no el color, y el valor exacto está siempre en el texto o en
// el tooltip.

import { clp, miles, pct } from "@/lib/vanni/formato";
import type { CeldaRfm, FilaConversion, FilaSegmentoBase } from "@/lib/vanni/metricas";

// ─── Composición: contactos y monto por segmento ─────────────────────────────

/**
 * Dos barras por segmento con escalas separadas: qué parte de la base son y qué
 * parte del monto histórico concentran. La diferencia entre las dos es el
 * punto: un segmento chico que concentra mucho monto es el que no se puede perder.
 */
export function ComposicionSegmentos({
  filas,
  descripcion,
}: {
  filas: FilaSegmentoBase[];
  descripcion: Map<string, string>;
}) {
  const total = filas.reduce((s, f) => s + f.n, 0);
  const montoTotal = filas.reduce((s, f) => s + f.monto, 0);
  const maxN = Math.max(1, ...filas.map((f) => f.n / Math.max(1, total)));
  const maxM = Math.max(0.0001, ...filas.map((f) => f.monto / Math.max(1, montoTotal)));
  if (!filas.length) return <p className="vn-vacio">Sin contactos.</p>;
  return (
    <div>
      <div className="vn-comp-cabecera">
        <span />
        <span>% de contactos</span>
        <span>% del monto histórico</span>
      </div>
      {filas.map((f) => {
        const pn = f.n / Math.max(1, total);
        const pm = montoTotal ? f.monto / montoTotal : 0;
        return (
          <div key={f.segmento} className="vn-comp-fila">
            <div className="vn-barra-nombre" style={{ width: "auto" }}>
              <b>{f.segmento}</b>
              <span>{descripcion.get(f.segmento)}</span>
            </div>
            <div className="vn-barra-pista" title={`${f.segmento}: ${miles(f.n)} contactos (${pct(f.n, total)})`}>
              <div className="vn-barra" style={{ width: `${(pn / maxN) * 72}%` }} />
              <em>{pct(f.n, total)}</em>
              <span className="vn-comp-abs">{miles(f.n)}</span>
            </div>
            <div className="vn-barra-pista" title={`${f.segmento}: ${clp(f.monto)} (${pct(f.monto, montoTotal)} del monto)`}>
              <div className="vn-barra vn-barra-naranjo" style={{ width: `${(pm / maxM) * 72}%` }} />
              <em>{montoTotal ? pct(f.monto, montoTotal) : "—"}</em>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Mapa RFM ────────────────────────────────────────────────────────────────

/** Rampa secuencial de un tono, de claro a oscuro. */
const RAMPA = ["#e9f3ef", "#c5e1d6", "#8fc3b0", "#4f9c83", "#17705b"];

function tono(n: number, max: number): { fondo: string; tinta: string } {
  if (n === 0) return { fondo: "#f3f0ea", tinta: "#8a9399" };
  const i = Math.min(RAMPA.length - 1, Math.floor((n / max) * RAMPA.length - 1e-9));
  return { fondo: RAMPA[i], tinta: i >= 3 ? "#fdfcfa" : "#1b2a2f" };
}

const ETIQUETA_R: Record<number, string> = {
  5: "≤ 1 mes",
  4: "1–3 meses",
  3: "3–6 meses",
  2: "6–12 meses",
  1: "> 1 año",
};

export function MapaRfm({ celdas }: { celdas: CeldaRfm[] }) {
  const max = Math.max(1, ...celdas.map((c) => c.n));
  const de = (r: number, f: number) => celdas.find((c) => c.r === r && c.f === f);
  if (!celdas.length) return <p className="vn-vacio">Hace falta el historial de compras (última compra, compras y monto) para armar el mapa.</p>;
  return (
    <div>
      <div className="vn-rfm">
        <div className="vn-rfm-eje-y">Recencia · última compra</div>
        <div className="vn-rfm-grilla">
          {[5, 4, 3, 2, 1].map((r) => (
            <div key={r} className="vn-rfm-fila">
              <div className="vn-rfm-etq">{ETIQUETA_R[r]}</div>
              {[1, 2, 3, 4, 5].map((f) => {
                const c = de(r, f);
                const n = c?.n ?? 0;
                const t = tono(n, max);
                return (
                  <div
                    key={f}
                    className="vn-rfm-celda"
                    style={{ background: t.fondo, color: t.tinta }}
                    title={`Recencia ${r} · Frecuencia ${f}: ${miles(n)} contactos${c ? ` · ${clp(c.monto)} históricos` : ""}`}
                  >
                    {n ? miles(n) : ""}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="vn-rfm-fila">
            <div className="vn-rfm-etq" />
            {[1, 2, 3, 4, 5].map((f) => (
              <div key={f} className="vn-rfm-etq-x">{f === 1 ? "1 · poca" : f === 5 ? "5 · mucha" : f}</div>
            ))}
          </div>
          <div className="vn-rfm-eje-x">Frecuencia de compra (quintil dentro de la base)</div>
        </div>
      </div>
      <div className="vn-rfm-leyenda" aria-hidden="true">
        <span>Menos contactos</span>
        {RAMPA.map((c) => <i key={c} style={{ background: c }} />)}
        <span>Más</span>
      </div>
      <p className="vn-ayuda" style={{ marginTop: 6 }}>
        Arriba a la derecha: compran seguido y hace poco. Abajo a la derecha: compraban seguido y se fueron — es donde está la reactivación que más vale.
      </p>
    </div>
  );
}

// ─── Conversión por segmento ─────────────────────────────────────────────────

/** Con menos envíos que esto, una tasa es anécdota: la fila se atenúa. */
const MUESTRA_MINIMA = 10;

function Tasa({ parte, total, max }: { parte: number; total: number; max: number }) {
  const t = total ? parte / total : 0;
  return (
    <div className="vn-tasa" title={`${miles(parte)} de ${miles(total)}`}>
      <div className="vn-tasa-pista">
        <div className="vn-barra" style={{ width: `${max ? (t / max) * 100 : 0}%`, height: 12 }} />
      </div>
      <span>{pct(parte, total)}</span>
    </div>
  );
}

export function ConversionSegmentos({ filas, orden }: { filas: FilaConversion[]; orden: string[] }) {
  const conDatos = filas
    .filter((f) => f.enviados > 0)
    .sort((a, b) => orden.indexOf(a.segmento) - orden.indexOf(b.segmento));
  if (!conDatos.length) return <p className="vn-vacio">Aparece cuando una campaña tenga envíos.</p>;
  // La escala de cada columna la fijan solo las filas con muestra suficiente.
  const confiables = conDatos.filter((f) => f.enviados >= MUESTRA_MINIMA);
  const base = confiables.length ? confiables : conDatos;
  const max = (k: keyof FilaConversion) => Math.max(0.0001, ...base.map((f) => Number(f[k]) / f.enviados));
  const mR = max("respondieron");
  const mI = max("interesados");
  const mC = max("cotizando");
  const tot = conDatos.reduce(
    (s, f) => ({
      enviados: s.enviados + f.enviados,
      respondieron: s.respondieron + f.respondieron,
      interesados: s.interesados + f.interesados,
      cotizando: s.cotizando + f.cotizando,
    }),
    { enviados: 0, respondieron: 0, interesados: 0, cotizando: 0 },
  );
  return (
    <div className="vn-scroll">
      <table className="vn-tabla">
        <thead>
          <tr>
            <th>Segmento</th>
            <th className="vn-num">Enviados</th>
            <th>Respondió</th>
            <th>Interesado</th>
            <th>En cotización</th>
          </tr>
        </thead>
        <tbody>
          {conDatos.map((f) => (
            <tr key={f.segmento} style={f.enviados < MUESTRA_MINIMA ? { opacity: 0.55 } : undefined}>
              <td>
                <b>{f.segmento}</b>
                {f.enviados < MUESTRA_MINIMA && <div style={{ fontSize: 11.5, color: "var(--vn-muted)" }}>muestra chica</div>}
              </td>
              <td className="vn-num">{miles(f.enviados)}</td>
              <td><Tasa parte={f.respondieron} total={f.enviados} max={mR} /></td>
              <td><Tasa parte={f.interesados} total={f.enviados} max={mI} /></td>
              <td><Tasa parte={f.cotizando} total={f.enviados} max={mC} /></td>
            </tr>
          ))}
          <tr style={{ background: "var(--vn-bg)" }}>
            <td><b>Total</b></td>
            <td className="vn-num"><b>{miles(tot.enviados)}</b></td>
            <td><b>{pct(tot.respondieron, tot.enviados)}</b></td>
            <td><b>{pct(tot.interesados, tot.enviados)}</b></td>
            <td><b>{pct(tot.cotizando, tot.enviados)}</b></td>
          </tr>
        </tbody>
      </table>
      <p className="vn-ayuda" style={{ marginTop: 6 }}>Cada tasa es sobre los enviados de ese segmento. La barra más larga de cada columna es la mejor tasa; las filas con menos de {MUESTRA_MINIMA} envíos se atenúan.</p>
    </div>
  );
}
