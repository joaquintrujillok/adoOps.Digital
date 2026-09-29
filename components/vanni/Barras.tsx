// Barras horizontales de una sola serie: el valor va en la punta y el título
// del panel dice qué se mide, así que no llevan leyenda.

export interface FilaBarra {
  nombre: string;
  detalle?: string;
  valor: number;
  etiqueta: string;
  dato?: React.ReactNode;
  suave?: boolean;
}

export default function Barras({
  filas,
  maximo,
  anchoNombre,
  apilado,
}: {
  filas: FilaBarra[];
  maximo?: number;
  anchoNombre?: number;
  /** Nombre arriba y barra abajo: para paneles angostos. */
  apilado?: boolean;
}) {
  const max = maximo ?? Math.max(1, ...filas.map((f) => f.valor));
  if (!filas.length) return <p className="vn-vacio">Todavía no hay datos.</p>;
  if (apilado) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {filas.map((f) => (
          <div key={f.nombre}>
            <div style={{ fontSize: 14 }}>{f.nombre}</div>
            <div className="vn-barra-pista" title={`${f.nombre}: ${f.etiqueta}`}>
              <div className={`vn-barra ${f.suave ? "vn-barra-suave" : ""}`} style={{ width: `${Math.max(0, (f.valor / max) * 100) * 0.82}%` }} />
              <em>{f.etiqueta}</em>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div>
      {filas.map((f) => (
        <div key={f.nombre} className="vn-barra-fila">
          <div className="vn-barra-nombre" style={anchoNombre ? { width: anchoNombre } : undefined}>
            <b>{f.nombre}</b>
            {f.detalle && <span>{f.detalle}</span>}
          </div>
          <div className="vn-barra-pista" title={`${f.nombre}: ${f.etiqueta}`}>
            <div className={`vn-barra ${f.suave ? "vn-barra-suave" : ""}`} style={{ width: `${Math.max(0, (f.valor / max) * 100) * 0.8}%` }} />
            <em>{f.etiqueta}</em>
          </div>
          {f.dato !== undefined && <div className="vn-barra-dato">{f.dato}</div>}
        </div>
      ))}
    </div>
  );
}
