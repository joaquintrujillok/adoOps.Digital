import { requireSesion } from "@/lib/vanni/auth.actions";

// Plantilla de carga en CSV con `;`, que es como Excel en español la abre en
// columnas sin pasar por el asistente de importación. El BOM es para que las
// tildes se vean bien.
export async function GET() {
  await requireSesion();
  const filas = [
    ["Teléfono", "Nombre", "Razón social", "RUT", "Email", "Sucursal", "Categoría habitual", "Última compra", "N compras", "Monto total"],
    ["+56 9 1234 5678", "Carolina Muñoz", "Pastelería El Roble", "76.123.456-7", "contacto@ejemplo.cl", "Centro", "Bandejas y blondas", "15-03-2026", "18", "2450000"],
  ];
  const csv = "﻿" + filas.map((f) => f.join(";")).join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-contactos-vanni.csv"',
    },
  });
}
