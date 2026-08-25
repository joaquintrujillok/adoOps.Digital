import { llevaChip, moduloDe, moduloPorId, type Modulo } from "@/lib/modulos";

// El chip que un módulo usa para decir qué es, dentro de sí mismo.
//
// **Por qué fijo en la esquina y no en el encabezado.** Un encabezado se
// desplaza al hacer scroll, y la confusión no ocurre en la primera pantalla:
// ocurre tres clics adentro, cuando alguien ya se olvidó de por dónde entró.
// Fijo abajo a la izquierda queda siempre a la vista sin taparle nada al
// contenido —esa esquina está vacía en todos los tableros del repo— y no
// compite con los botones de acción, que viven arriba y a la derecha.
//
// **Por qué discreto y no una franja roja.** Estas pantallas se muestran en
// reuniones de venta. Una advertencia agresiva sugiere que algo anda mal, y no
// anda mal: es un demo, y decirlo es parte de mostrarlo bien. Lo que no puede
// pasar es lo contrario, que un módulo con datos sembrados se vea idéntico a
// uno con clientes de verdad.

const ESTILO: Record<string, { fondo: string; borde: string; texto: string; etiqueta: string }> = {
  demo: {
    fondo: "bg-amber-50/95",
    borde: "border-amber-300",
    texto: "text-amber-800",
    etiqueta: "Demo",
  },
  interno: {
    fondo: "bg-slate-100/95",
    borde: "border-slate-300",
    texto: "text-slate-600",
    etiqueta: "Interno",
  },
  archivado: {
    fondo: "bg-slate-100/95",
    borde: "border-slate-300",
    texto: "text-slate-500",
    etiqueta: "Archivado",
  },
};

/**
 * La segunda línea del chip. Es la que carga el peso: el estado dice cómo se
 * trata el módulo, pero lo que decide si alguien se puede confundir es de dónde
 * salieron los datos que está mirando.
 */
function origen(m: Modulo): string {
  switch (m.datos) {
    case "sembrados":
      return "datos de ejemplo";
    case "mixtos":
      return "datos de ejemplo · puede recibir entradas reales";
    case "reales":
      return "datos reales";
    case "ninguno":
      return "sin datos guardados";
  }
}

/**
 * Se le pasa `id` cuando la pantalla sabe a qué módulo pertenece —que es casi
 * siempre— o `ruta` cuando quien pinta es un layout compartido y depende del
 * pathname. Si el módulo no está en el registro no pinta nada: un chip
 * inventado sería peor que ninguno.
 */
export default function ChipModulo({ id, ruta }: { id?: string; ruta?: string }) {
  const modulo = id ? moduloPorId(id) : ruta ? moduloDe(ruta) : undefined;
  if (!modulo || !llevaChip(modulo)) return null;

  const estilo = ESTILO[modulo.estado];
  if (!estilo) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 z-50 rounded-full border px-3.5 py-1.5 shadow-sm backdrop-blur ${estilo.fondo} ${estilo.borde}`}
      title={modulo.nota}
    >
      <span className={`text-[11px] font-semibold uppercase tracking-wider ${estilo.texto}`}>
        {estilo.etiqueta}
      </span>
      <span className={`ml-2 text-[11px] ${estilo.texto} opacity-80`}>{origen(modulo)}</span>
    </div>
  );
}
