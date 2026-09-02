// Puesta en marcha del demo de Dashboard360, ejecutada dentro del despliegue.
//
// **Por qué existe.** La cadena de conexión de Neon está guardada como variable
// cifrada en Vercel, y Vercel las entrega en un solo sentido: se escriben, no se
// leen. Desde una máquina sin el `.env.local` original no hay forma de correr un
// script contra la base. Acá sí, porque el runtime la tiene.
//
// Autenticación propia —el proxy deja pasar /api/dashboard360/cron sin sesión—:
// `Authorization: Bearer $D360_SETUP_SECRET`. **Sin esa variable devuelve 503**,
// que es también la forma de apagar este endpoint: se borra la variable en
// Vercel y queda inerte. Falla cerrado, nunca abierto.
//
// Todo lo que hace es aditivo sobre tablas con prefijo `d360_`. El único borrado
// posible es `?limpiar=1`, y solo alcanza a las tablas de este módulo.
//
//   curl -X POST "$URL/api/dashboard360/cron/setup" -H "Authorization: Bearer $SECRET"

import { NextResponse } from "next/server";
import { crearTablas, sembrarDemo } from "@/lib/dashboard360/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const secreto = process.env.D360_SETUP_SECRET;
  if (!secreto) {
    return NextResponse.json(
      { error: "D360_SETUP_SECRET no configurada" },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limpiar = url.searchParams.get("limpiar") === "1";
  // `soloTablas=1` aplica el DDL y las migraciones sin sembrar nada.
  //
  // Existe porque este endpoint hacía las dos cosas juntas, y con datos reales
  // ya cargados eso deja de ser una comodidad y pasa a ser una trampa: correrlo
  // para agregar una columna habría reemplazado la inversión real del cliente
  // por datos inventados.
  const soloTablas = url.searchParams.get("soloTablas") === "1";

  try {
    const sentencias = await crearTablas();
    if (soloTablas) {
      return NextResponse.json({ ok: true, sentencias, soloTablas: true });
    }
    const seed = await sembrarDemo({
      usuario: process.env.D360_DEMO_USER ?? "demo",
      clave: process.env.D360_DEMO_PASS ?? "dashboard360",
      limpiar,
    });
    return NextResponse.json({ ok: true, sentencias, limpiar, ...seed });
  } catch (e) {
    // El mensaje se devuelve tal cual a propósito: este endpoint lo llama quien
    // tiene el secreto, y un "error interno" genérico obligaría a ir a buscar
    // los logs de Vercel para saber qué pasó.
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
