"use client";

// La categoría de la oportunidad, editable dentro de la tabla.
//
// Envía al cambiar el valor y no con un botón de guardar: es un solo campo, y
// una tabla de treinta filas con treinta botones de guardar es una pantalla que
// nadie usa. El `<select>` queda deshabilitado mientras la acción corre para que
// dos cambios seguidos no se pisen.
//
// El formulario funciona igual sin JavaScript —es un `<form action>` con un
// submit visible solo para ese caso—, así que la tabla no depende de que el
// hidratado haya terminado para poder corregir algo.

import { useFormStatus } from "react-dom";
import { accionCategoriaOportunidad } from "@/lib/crm/acciones";

function Selector({
  categorias,
  categoria,
  heredada,
  corregida,
}: {
  categorias: string[];
  /** La que manda hoy: la corrección si existe, si no la heredada. */
  categoria: string;
  /** La que sale de las piezas. Es a lo que se vuelve al elegir la opción vacía. */
  heredada: string;
  corregida: boolean;
}) {
  const { pending } = useFormStatus();
  const seleccion = corregida ? categoria : "";

  return (
    <>
      <select
        name="categoria"
        // `key` con el valor del servidor: React no actualiza el `defaultValue`
        // de un select que ya existe, así que tras guardar el DOM se quedaría
        // mostrando la opción anterior mientras las etiquetas ya cambiaron —y la
        // fila diría una cosa y la base otra.
        key={seleccion}
        defaultValue={seleccion}
        disabled={pending}
        aria-busy={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`w-[13.5rem] max-w-full rounded-lg border px-2 py-1 text-[12px] outline-none disabled:opacity-50 ${
          corregida
            ? "border-[var(--crm-brand)] text-[var(--crm-ink)]"
            : "border-[var(--crm-border)] text-[var(--crm-ink-2)]"
        }`}
        title={
          corregida
            ? `Corregida a mano. Las piezas dicen ${heredada}.`
            : "Heredada de la pieza más cara. Elegir una la fija."
        }
      >
        {/* La opción vacía es "sin corregir", y muestra SIEMPRE la categoría de
            las piezas —no la efectiva—: con una corrección puesta, volver a la
            herencia significa volver a otra cosa, y la etiqueta tiene que decir
            a cuál. El sufijo tampoco es decorativo: la heredada casi siempre
            existe también en la lista de abajo, y dos opciones con el mismo
            texto son dos cosas distintas que se ven idénticas. */}
        <option value="">{heredada} · heredada</option>
        {categorias.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="mt-1 text-[11px] underline">
          Guardar
        </button>
      </noscript>
    </>
  );
}

export default function CategoriaEnLinea({
  dealId,
  categoria,
  heredada,
  corregida,
  categorias,
}: {
  dealId: number;
  categoria: string;
  heredada: string;
  corregida: boolean;
  categorias: string[];
}) {
  return (
    <form action={accionCategoriaOportunidad}>
      <input type="hidden" name="dealId" value={dealId} />
      <Selector
        categorias={categorias}
        categoria={categoria}
        heredada={heredada}
        corregida={corregida}
      />
    </form>
  );
}
