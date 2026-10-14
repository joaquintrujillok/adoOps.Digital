// A qué cartera pertenece una fila del CRM.
//
// El CRM del tablero lo abren dos cuentas: **adoOps**, que es el pipeline real
// del negocio, y **Demo**, que es lo que se le muestra a un tercero en una
// reunión. Tienen que ver cosas distintas: Demo no puede abrir el pipeline
// propio —montos, nombres y correos de clientes reales— delante de un
// prospecto.
//
// Por eso las tres tablas con cara (`venta_empresas`, `venta_contactos`,
// `venta_oportunidades`) llevan una columna `cuenta`, y toda consulta y toda
// acción de `lib/venta` filtra por ella. Las actividades no la llevan: cuelgan
// de una oportunidad y heredan la suya.
//
// **Esto sí aísla datos, a diferencia del resto de las cuentas.** La cabecera
// de `lib/cuentas.ts` dice que una cuenta declara intención y no es una
// frontera; acá se decidió que lo sea, y se hace de verdad: el filtro está en
// la consulta, no en el menú. Lo que NO cambia es que la base sigue siendo una
// sola —una consulta nueva que olvide el filtro mezcla las dos carteras—.

import { getSession } from "@/lib/dashboard360/session";
import { resolverCuenta } from "@/lib/cuentas";

export type CuentaVenta = "adoops" | "demo";

/**
 * La cartera de la sesión activa. Todo lo que no es Demo cae en `adoops`: es el
 * valor por defecto de la columna y el único otro mundo que tiene CRM.
 */
export async function cuentaVenta(): Promise<CuentaVenta> {
  const s = await getSession();
  return resolverCuenta(s?.cuenta, s?.cuentas).id === "demo" ? "demo" : "adoops";
}
