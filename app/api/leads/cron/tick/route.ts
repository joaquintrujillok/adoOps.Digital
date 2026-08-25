// El tick del motor. Lo llama el cron de Vercel.
//
// ── Una acción por invocación ────────────────────────────────────────────────
//
// No es una limitación: es lo que hace que el ritmo lo manden las cuotas y no la
// frecuencia del cron. Diez envíos con espaciado real son más minutos de reloj
// de los que dura una función de Vercel, así que intentar despachar la cola
// entera en una invocación termina en un timeout a mitad de la tanda — con
// algunos mensajes mandados, otros no, y ninguna forma limpia de saber cuáles.
//
// ── El cron corre acotado, y es por costo ────────────────────────────────────
//
// Neon apaga el cómputo tras 5 minutos sin actividad. Un cron cada 15 minutos
// las 24 horas la despierta 96 veces al día y no la deja dormir nunca: en el CRM
// de CDC eso agotó la cuota del plan gratuito y tumbó el login con un 500 que no
// era del código. Acotado a la ventana laboral y a días hábiles baja de ~2.900
// invocaciones al mes a ~220.
//
// El horario del cron está en UTC porque Vercel no acepta otra cosa, y cubre la
// UNIÓN de las dos estaciones de Chile: 12–22 UTC contiene 09:00–18:00 tanto en
// verano (−3) como en invierno (−4). La ventana real la decide
// `dentroDeVentana()` contra America/Santiago, que es lo único que sobrevive al
// cambio de hora.
//
//   GET /api/leads/cron/tick            · Authorization: Bearer $CRON_SECRET
//   GET /api/leads/cron/tick?simular=1  · no despacha nada, describe la cola

import { NextResponse } from "next/server";
import { tick } from "@/lib/leads/despacho";
import { simular } from "@/lib/leads/cola";
import { vencerSenales } from "@/lib/leads/senales";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return NextResponse.json({ error: "CRON_SECRET no configurada" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);

  // El modo simulación no toca nada y devuelve lo que PASARÍA con cada acción.
  // Es la forma de diagnosticar una cola detenida: el cron responde 200 igual
  // cuando no manda nada, así que "el cron corre" no prueba absolutamente nada.
  if (url.searchParams.get("simular") === "1") {
    const filas = await simular();
    return NextResponse.json({
      ok: true,
      simulado: true,
      enCola: filas.length,
      saldrian: filas.filter((f) => !f.freno).length,
      detalle: filas.map((f) => ({
        accion: f.fila.id,
        persona: f.fila.nombre,
        carril: f.fila.carril,
        paso: `${f.fila.paso} de ${f.fila.totalPasos}`,
        freno: f.freno ? { candado: f.freno.candado, motivo: f.freno.texto } : null,
      })),
    });
  }

  try {
    // Vencer las señales primero: si una ventana se cerró anoche, la acción que
    // depende de ella no debe salir hoy. Es barato y evita el caso raro de un
    // primer contacto justificado por un hecho que ya no está vigente.
    const vencidas = await vencerSenales();
    const r = await tick();

    return NextResponse.json({
      ok: true,
      senalesVencidas: vencidas,
      evaluadas: r.evaluadas,
      frenadas: r.frenadas,
      despacho: r.despacho.resumen,
      enviada: r.despacho.enviada,
    });
  } catch (e) {
    // El detalle va en la respuesta: lo llama quien tiene el secreto, y un error
    // genérico obliga a ir a buscar los logs de Vercel para saber qué pasó.
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
