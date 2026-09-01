"use server";

// Subir un documento de conocimiento desde la pantalla.
//
// ── Por qué existe además de la ruta de API ──────────────────────────────────
//
// La ruta se pensó para un script, y el script no puede autenticarse: firma la
// sesión con el `D360_SESSION_SECRET` local y el de producción es otro —y no se
// puede leer de vuelta, está documentado en AGENTS.md—. La salida no es
// compartir el secreto entre máquinas: es que la persona suba el archivo con la
// sesión que ya tiene abierta.
//
// Termina siendo mejor por otra razón: actualizar la base deja de necesitar una
// terminal. Se edita el markdown, se arrastra a la pantalla, y la próxima
// reunión usa lo nuevo.

import { revalidatePath } from "next/cache";
import { ingerir } from "@/lib/conocimiento";
import { cuentaPorId, resolverCuenta } from "@/lib/cuentas";
import { getSession } from "@/lib/dashboard360/session";

const PANTALLA = "/dashboard360/reuniones/conocimiento";

export type ResultadoSubida = {
  ok?: string;
  error?: string;
};

export async function subirConocimientoAction(
  _prev: ResultadoSubida,
  formData: FormData,
): Promise<ResultadoSubida> {
  const sesion = await getSession();
  if (!sesion) return { error: "No autenticado" };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Falta el archivo." };
  }

  // La cuenta de destino se puede elegir, pero solo entre las permitidas: cargar
  // material de Soho en la base de adoOps es exactamente el cruce que las
  // cuentas existen para evitar.
  const pedida = cuentaPorId(String(formData.get("cuenta") ?? ""));
  const activa = resolverCuenta(sesion.cuenta, sesion.cuentas);
  const permitidas = sesion.cuentas;
  const destino =
    pedida && (!permitidas || permitidas.length === 0 || permitidas.includes(pedida.id))
      ? pedida
      : activa;

  const markdown = await archivo.text();
  if (markdown.trim().length < 100) {
    return { error: "El documento viene vacío o es demasiado corto." };
  }

  try {
    const r = await ingerir(destino.id, archivo.name, markdown);
    revalidatePath(PANTALLA);

    if (r.trozos === 0) {
      return {
        error:
          "No se encontró ninguna sección. El documento tiene que usar encabezados markdown (##, ###).",
      };
    }

    return {
      ok:
        `${archivo.name} → ${destino.nombre}: ${r.trozos} trozos, ` +
        `${r.siempre} marcados "siempre", ~${r.tokens.toLocaleString("es-CL")} tokens` +
        (r.reemplazados ? ` · ${r.reemplazados} anteriores reemplazados` : ""),
    };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    // El error crudo de Postgres cuando falta la tabla es una consulta SQL
    // entera, ilegible para quien solo quería subir un archivo. Se traduce al
    // único arreglo que existe. Es el mismo criterio que `disponible()` en el
    // resto del repo: un módulo que no está desplegado lo dice, no revienta.
    if (/conocimiento_trozos/.test(mensaje) && /does not exist|no existe/i.test(mensaje)) {
      return {
        error:
          "La tabla de conocimiento no está creada en esta base. Corre: node scripts/conocimiento-setup.mjs",
      };
    }
    return { error: mensaje };
  }
}
