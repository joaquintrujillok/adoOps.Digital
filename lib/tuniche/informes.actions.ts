"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tunicheAgricultores, tunicheInformes, type ContenidoVisita } from "@/db/tuniche";
import { esAreaValida, type AreaId } from "./areas";
import { requireEnvioAlAgricultor, requireSesion } from "./auth.actions";
import { generarDeVisita, generarMensual, textoWhatsApp } from "./informes";
import { alcanceDe } from "./session";
import { enviarWhatsApp } from "./whatsapp";

const RUTA = "/tuniche/informes";

/** Comprueba que el informe esté al alcance de quien actúa, y lo devuelve. */
async function informeEnAlcance(id: number) {
  const s = await requireSesion();
  const [x] = await db.select().from(tunicheInformes).where(eq(tunicheInformes.id, id)).limit(1);
  if (!x) throw new Error("Ese informe no existe");
  const a = alcanceDe(s);
  if (!a.todo && x.area !== a.area) throw new Error("Ese informe no está en tu alcance");
  return { s, informe: x };
}

/**
 * Genera el informe de una visita validada. Es un borrador: no sale nada.
 *
 * Puede hacerlo cualquiera con la visita a la vista, incluido el zonal que la
 * levantó — generar un borrador no es una decisión, es preparar el documento
 * para que alguien lo mire. La decisión es el visto bueno.
 */
export async function generarInformeAction(fd: FormData): Promise<void> {
  const s = await requireSesion();
  const visitaId = Number(fd.get("visitaId"));
  if (!Number.isInteger(visitaId) || visitaId <= 0) return;

  const { id } = await generarDeVisita(visitaId, s.userId);
  revalidatePath("/tuniche/visitas");
  revalidatePath(RUTA);
  redirect(`${RUTA}/${id}`);
}

export async function generarMensualAction(fd: FormData): Promise<void> {
  const s = await requireEnvioAlAgricultor();
  const cliente = ((fd.get("cliente") as string) ?? "").trim();
  const areaCruda = ((fd.get("area") as string) ?? "").trim();
  const desdeCrudo = (fd.get("desde") as string) ?? "";
  const hastaCrudo = (fd.get("hasta") as string) ?? "";

  if (!cliente) throw new Error("Elige el cliente del informe");
  if (!esAreaValida(areaCruda)) throw new Error("Área inválida");

  const a = alcanceDe(s);
  if (!a.todo && areaCruda !== a.area) throw new Error("Esa área no está en tu alcance");

  const desde = new Date(`${desdeCrudo}T00:00:00`);
  // El día 'hasta' entra completo: quien escribe 31 de marzo espera que las
  // visitas del 31 de marzo aparezcan, no que se corten a la medianoche previa.
  const hasta = new Date(`${hastaCrudo}T23:59:59`);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
    throw new Error("Las fechas del periodo no son válidas");
  }
  if (desde > hasta) throw new Error("El periodo empieza después de terminar");

  const id = await generarMensual({
    cliente,
    area: areaCruda as AreaId,
    desde,
    hasta,
    usuarioId: s.userId,
  });

  revalidatePath(RUTA);
  redirect(`${RUTA}/${id}`);
}

/**
 * El visto bueno. **Es lo único que habilita que un informe salga de Tuniche.**
 *
 * Se da sobre el documento completo, que es lo que la pantalla muestra al lado
 * del botón: aprobar una tarjeta resumida sería aprobar algo distinto de lo que
 * se envía. Queda registrado con nombre y fecha — un visto bueno sin nombre no
 * es un visto bueno.
 */
export async function aprobarInformeAction(fd: FormData): Promise<void> {
  const s = await requireEnvioAlAgricultor();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const { informe } = await informeEnAlcance(id);
  if (informe.estado === "enviado") return; // ya salió; aprobar de nuevo no significa nada

  await db
    .update(tunicheInformes)
    .set({ estado: "aprobado", aprobadoPor: s.userId, aprobadoEn: new Date() })
    .where(eq(tunicheInformes.id, id));

  revalidatePath(RUTA);
  revalidatePath(`${RUTA}/${id}`);
}

/**
 * Retira el visto bueno, mientras el informe **no haya salido**.
 *
 * Un visto bueno que no se puede retirar es una trampa: quien aprueba de más se
 * queda sin salida y aprende a no aprobar. Una vez enviado ya no sirve —el
 * agricultor lo tiene en su teléfono— y ahí se bloquea en vez de fingir que se
 * deshizo.
 */
export async function retirarInformeAction(fd: FormData): Promise<void> {
  await requireEnvioAlAgricultor();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const { informe } = await informeEnAlcance(id);
  if (informe.estado === "enviado") {
    throw new Error("Este informe ya salió. El visto bueno no se puede retirar.");
  }

  await db
    .update(tunicheInformes)
    .set({ estado: "borrador", aprobadoPor: null, aprobadoEn: null })
    .where(eq(tunicheInformes.id, id));

  revalidatePath(RUTA);
  revalidatePath(`${RUTA}/${id}`);
}

/**
 * Envía el informe de visita al agricultor por WhatsApp.
 *
 * Tres barreras, y ninguna es ceremonia: **rol** de jefatura, **visto bueno**
 * dado, y **teléfono** del agricultor. La tercera es la que hoy detiene todo:
 * ninguna de las dos planillas trajo el contacto.
 *
 * `enviado_en` se marca **después** de que WhatsApp aceptó el mensaje. Marcarlo
 * antes dejaría informes que el sistema cree enviados y el agricultor nunca
 * recibió, que es la peor de las dos mentiras posibles.
 */
export async function enviarInformeAction(fd: FormData): Promise<void> {
  const s = await requireEnvioAlAgricultor();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const { informe } = await informeEnAlcance(id);
  if (informe.tipo !== "visita") {
    throw new Error("El informe mensual no sale por WhatsApp. Márcalo como enviado cuando lo despaches.");
  }
  if (informe.estado === "enviado") return;
  if (informe.estado !== "aprobado") {
    throw new Error("Este informe no tiene visto bueno. Nada sale de Tuniche sin él.");
  }

  const [ag] = await db
    .select({ telefono: tunicheAgricultores.telefono, nombre: tunicheAgricultores.razonSocial })
    .from(tunicheAgricultores)
    .where(eq(tunicheAgricultores.id, informe.agricultorId!))
    .limit(1);

  if (!ag?.telefono) {
    throw new Error(
      `${ag?.nombre ?? "Este agricultor"} no tiene teléfono registrado. Sin eso no hay a quién enviarle el informe.`,
    );
  }

  await enviarWhatsApp(ag.telefono, textoWhatsApp(informe.contenido as unknown as ContenidoVisita));

  await db
    .update(tunicheInformes)
    .set({ estado: "enviado", enviadoPor: s.userId, enviadoEn: new Date(), enviadoA: ag.telefono })
    .where(eq(tunicheInformes.id, id));

  revalidatePath(RUTA);
  revalidatePath(`${RUTA}/${id}`);
}

/**
 * Deja constancia de que un informe mensual se despachó, y a quién.
 *
 * El mensual va al cliente en el extranjero, y hoy no tenemos su canal: René lo
 * manda por su cuenta. En vez de inventar una integración que nadie pidió, el
 * sistema registra el hecho —quién lo despachó, cuándo y a qué destinatario—,
 * que es lo que hoy no queda escrito en ninguna parte.
 */
export async function marcarEnviadoAction(fd: FormData): Promise<void> {
  const s = await requireEnvioAlAgricultor();
  const id = Number(fd.get("id"));
  const destinatario = ((fd.get("destinatario") as string) ?? "").trim();
  if (!Number.isInteger(id) || id <= 0) return;
  if (!destinatario) throw new Error("Anota a quién se le envió");

  const { informe } = await informeEnAlcance(id);
  if (informe.estado !== "aprobado") {
    throw new Error("Este informe no tiene visto bueno. Nada sale de Tuniche sin él.");
  }

  await db
    .update(tunicheInformes)
    .set({ estado: "enviado", enviadoPor: s.userId, enviadoEn: new Date(), enviadoA: destinatario })
    .where(eq(tunicheInformes.id, id));

  revalidatePath(RUTA);
  revalidatePath(`${RUTA}/${id}`);
}
