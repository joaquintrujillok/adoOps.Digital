/**
 * La marca de fila de demostración.
 *
 * **Por qué va en la fila y no en un aviso arriba.** Un banner en la cabecera se
 * pierde al tercer clic, que es justo cuando alguien deja de saber qué está
 * mirando. La confusión que esto evita es una sola: mirar una ficha y no saber
 * si detrás hay un agricultor de verdad.
 *
 * `enDocumento` la hace grande y **la deja imprimirse**. Un informe se imprime y
 * se manda; si la marca desapareciera en el papel, una hoja de demostración
 * podría llegar a manos de un cliente sin nada que la distinga de una real —
 * exactamente el error que este repo ya pagó una vez.
 */
export default function Demo({ enDocumento = false }: { enDocumento?: boolean }) {
  if (enDocumento) {
    return (
      <div
        className="mb-5 rounded-lg border px-4 py-3"
        style={{
          borderColor: "var(--tun-alerta)",
          background: "var(--tun-alerta-soft)",
          color: "var(--tun-alerta)",
        }}
      >
        <div className="text-[13px] font-bold uppercase tracking-[0.18em]">
          Documento de demostración
        </div>
        <div className="mt-1 text-[13px]">
          El agricultor, el lote y las observaciones de esta hoja son inventados. No
          corresponden a ningún campo real y esta hoja no debe enviarse a nadie.
        </div>
      </div>
    );
  }

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider"
      style={{ background: "var(--tun-alerta-soft)", color: "var(--tun-alerta)" }}
      title="Ficha de demostración: no corresponde a un agricultor real."
    >
      Demo
    </span>
  );
}
