"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tunicheAgricultores } from "@/db/tuniche";
import { normalizarTelefono } from "@/lib/crm/telefono";
import { requireSesion } from "./auth.actions";
import { alcanceDe } from "./session";

export interface Resultado {
  error?: string;
  ok?: string;
}

/**
 * Carga o corrige los datos de contacto de un agricultor.
 *
 * **Lo puede hacer cualquiera que tenga a ese agricultor en su alcance, incluido
 * un zonal.** No es una excepción al modelo de permisos: el teléfono del
 * agricultor lo tiene el zonal en su propio celular —es la persona que lo llama
 * todas las semanas— y obligarlo a pedírselo a su jefe para cargar un número es
 * exactamente la fricción que hace que un sistema se deje de usar.
 *
 * La línea está en **qué** se puede editar. Contacto, teléfono y correo son datos
 * de operación: cambian solos, los conoce quien trabaja con esa persona, y
 * equivocarse se arregla escribiendo de nuevo. La razón social, el área y el
 * zonal a cargo son maestra: definen de quién es el campo y quién lo ve, y esos
 * siguen siendo de `admin`.
 */
export async function guardarContactoAction(
  _prev: Resultado,
  fd: FormData,
): Promise<Resultado> {
  const s = await requireSesion();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Agricultor inválido" };

  const a = alcanceDe(s);
  const condiciones = [eq(tunicheAgricultores.id, id)];
  if (!a.todo) {
    condiciones.push(eq(tunicheAgricultores.area, a.area ?? ""));
    if (a.soloUsuarioId != null) {
      condiciones.push(eq(tunicheAgricultores.zonalId, a.soloUsuarioId));
    }
  }
  const [ag] = await db
    .select()
    .from(tunicheAgricultores)
    .where(and(...condiciones))
    .limit(1);
  if (!ag) return { error: "Ese agricultor no está en tu alcance" };

  const contacto = ((fd.get("nombreContacto") as string) ?? "").trim();
  const correo = ((fd.get("email") as string) ?? "").trim();
  const telefonoCrudo = ((fd.get("telefono") as string) ?? "").trim();

  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return { error: "El correo no tiene un formato válido" };
  }

  // Un número que no se puede normalizar se rechaza en vez de guardarse tal
  // cual: guardado como texto libre, el informe saldría hacia un destinatario
  // que WhatsApp no puede resolver, y el fallo aparecería recién al enviarlo.
  let telefono: string | null = null;
  if (telefonoCrudo) {
    telefono = normalizarTelefono(telefonoCrudo);
    if (!telefono) {
      return {
        error: `No pude interpretar el teléfono «${telefonoCrudo}». Escríbelo como +56 9 1234 5678`,
      };
    }
  }

  await db
    .update(tunicheAgricultores)
    .set({
      nombreContacto: contacto || null,
      email: correo || null,
      telefono,
    })
    .where(eq(tunicheAgricultores.id, id));

  revalidatePath("/tuniche/agricultores");
  revalidatePath("/tuniche/informes", "layout");
  return {
    ok: telefono
      ? `Contacto guardado. Ya se le puede enviar el informe a ${ag.razonSocial}.`
      : "Contacto guardado.",
  };
}
