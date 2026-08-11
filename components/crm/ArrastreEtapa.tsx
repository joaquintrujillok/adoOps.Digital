"use client";

// Arrastrar una oportunidad de una columna a otra en el tablero.
//
// Se agrega ENCIMA del selector de etapa, no en su lugar. El selector sigue
// siendo el único camino que funciona con teclado, con lector de pantalla y en
// un teléfono —la API de arrastre de HTML no existe en táctil—, así que sacarlo
// dejaría el tablero inoperable justo para quien más lo necesita. El arrastre es
// el atajo para el mouse; el selector es la garantía.
//
// Se usa la API nativa (`draggable` + `dataTransfer`) y no una librería: mover
// una tarjeta entre cuatro columnas es exactamente lo que esa API hace, y una
// dependencia de arrastre pesa más que toda la pantalla.
//
// El dato viaja por `dataTransfer` y no por un estado compartido: es lo que hace
// que la columna que recibe sepa qué le soltaron sin que las dos mitades tengan
// que conocerse.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { accionMoverEtapa } from "@/lib/crm/acciones";

/** Tipo propio para que el tablero no acepte cualquier cosa que se arrastre. */
const TIPO = "application/x-crm-deal";

export function TarjetaArrastrable({
  dealId,
  etapa,
  children,
}: {
  dealId: number;
  etapa: string;
  children: React.ReactNode;
}) {
  const [arrastrando, setArrastrando] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(TIPO, JSON.stringify({ dealId, etapa }));
        e.dataTransfer.effectAllowed = "move";
        setArrastrando(true);
      }}
      onDragEnd={() => setArrastrando(false)}
      className={`cursor-grab active:cursor-grabbing ${
        arrastrando ? "opacity-40" : ""
      }`}
    >
      {children}
    </div>
  );
}

export function ColumnaSoltable({
  etapa,
  children,
}: {
  etapa: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [encima, setEncima] = useState(false);
  const [pendiente, empezar] = useTransition();

  const leer = (e: React.DragEvent): { dealId: number; etapa: string } | null => {
    const crudo = e.dataTransfer.getData(TIPO);
    if (!crudo) return null;
    try {
      return JSON.parse(crudo);
    } catch {
      return null;
    }
  };

  return (
    <div
      onDragOver={(e) => {
        // Sin `preventDefault` el navegador no deja soltar. Y solo se acepta el
        // tipo propio: arrastrar un archivo o un texto cualquiera sobre el
        // tablero no puede parecer que va a mover algo.
        if (!e.dataTransfer.types.includes(TIPO)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setEncima(true);
      }}
      onDragLeave={(e) => {
        // Solo cuando el puntero sale de la columna entera: al pasar sobre una
        // tarjeta de adentro salta un `dragleave` del hijo y la columna dejaría
        // de marcarse a la mitad del gesto.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setEncima(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        const datos = leer(e);
        if (!datos) return;
        // Soltar una tarjeta en su propia columna no es un movimiento: escribir
        // una actividad de "movió de propuesta a propuesta" ensucia la bitácora
        // que después alimenta las alertas de estancamiento.
        if (datos.etapa === etapa) return;

        const formData = new FormData();
        formData.set("dealId", String(datos.dealId));
        formData.set("etapa", etapa);

        // "Perdido" exige motivo, igual que en el selector: cerrar un negocio
        // sin decir por qué es exactamente el dato que después falta para
        // mejorar la tasa.
        if (etapa === "perdido") {
          const motivo = window.prompt(
            "¿Por qué se perdió? (Precio, Competencia, Sin presupuesto, Sin respuesta, …)",
          );
          if (motivo === null) return;
          formData.set("motivo", motivo);
        }

        empezar(async () => {
          await accionMoverEtapa(formData);
          router.refresh();
        });
      }}
      className={`min-h-[6rem] rounded-xl border-2 border-dashed transition ${
        encima
          ? "border-[var(--crm-brand)] bg-[var(--crm-brand-soft)]"
          : "border-transparent"
      } ${pendiente ? "opacity-60" : ""}`}
    >
      {children}
    </div>
  );
}
