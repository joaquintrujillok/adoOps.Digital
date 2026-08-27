"use client";

// Borde de error del módulo.
//
// Existe por una razón concreta: las acciones de este sistema lanzan cuando
// alguien intenta algo que su rol no permite —`requireAdmin`, `requireMaestras`,
// `requireEnvioAlAgricultor`—. Sin este archivo, esa negativa perfectamente
// deliberada le llega a la persona como una pantalla de error 500, y una
// negativa que parece una caída del sistema hace que alguien llame por teléfono
// a reportar un problema que no existe.
//
// **No muestra `error.message`.** El mensaje puede venir de la base de datos o
// del runtime y filtrar nombres de tablas o de columnas. Los mensajes de
// permisos ya se muestran donde corresponde: en la pantalla que los evalúa.

export default function ErrorTuniche({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-[520px] space-y-4 py-6">
      <h1 className="text-[22px] font-semibold" style={{ color: "var(--tun-ink)" }}>
        No se pudo completar
      </h1>
      <p className="text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
        O la acción no corresponde a tu rol, o algo falló al procesarla. Si estabas
        cargando una visita, no se guardó: vuelve a intentarlo. Si se repite,
        avísale a quien administra el sistema.
      </p>
      <button type="button" onClick={reset} className="tun-boton">
        Reintentar
      </button>
    </div>
  );
}
