"use server";

// Acciones del backoffice de Vanni. Cada una vuelve a pedir la sesión: el
// proxy evita el parpadeo, pero la autorización se decide acá.

import { readSheet } from "read-excel-file/node";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  VANNI_ESTADOS_PEDIDO,
  vanniCampanas,
  vanniContactos,
  vanniOportunidades,
  vanniProductos,
  vanniPromociones,
  vanniUsuarios,
  vanniVariantes,
  type VanniEstadoPedido,
} from "@/db/vanni";
import { requireAdmin, requireSesion } from "./auth.actions";
import { dispararCola, origenActual } from "./cola";
import { cargarBaseMaestra, type ResultadoBase } from "./captura";
import { agregarContacto, cargarFilas, parsearCsv, type ResultadoCarga } from "./contactos";
import { borrarEjemplo, cargarEjemplo } from "./ejemplo";
import { actualizarEstados, debeEncadenar, encolarCampana, procesarCola } from "./envios";
import { renderPlantilla } from "./formato";
import { guardarMensaje } from "./motor/conversacion";
import { cambiarEstadoPedido } from "./pedidos";
import { hashPassword, problemaDeClave } from "./session";
import { normalizarTelefono } from "./telefono";
import { enviarImagen, enviarTexto } from "./wa";

// ─── Contactos ───────────────────────────────────────────────────────────────

export async function subirPlanillaAction(
  _prev: ResultadoCarga | { error: string } | null,
  formData: FormData,
): Promise<ResultadoCarga | { error: string }> {
  await requireAdmin();
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige un archivo .xlsx o .csv" };
  if (archivo.size > 10 * 1024 * 1024) return { error: "El archivo pesa más de 10 MB" };

  const nombre = archivo.name.toLowerCase();
  let filas: unknown[][];
  try {
    if (nombre.endsWith(".xlsx")) {
      filas = (await readSheet(Buffer.from(await archivo.arrayBuffer()))) as unknown[][];
    } else if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) {
      filas = parsearCsv(await archivo.text());
    } else if (nombre.endsWith(".xls")) {
      return { error: "El formato .xls antiguo no se puede leer. Guárdalo como .xlsx o .csv desde Excel." };
    } else {
      return { error: "Formato no soportado. Usa .xlsx o .csv" };
    }
  } catch (err) {
    console.error("[vanni] no se pudo leer la planilla", err);
    return { error: "No pude leer el archivo. ¿Está abierto en otro programa o dañado?" };
  }
  const r = await cargarFilas(filas);
  revalidatePath("/vanni", "layout");
  return r;
}

export async function agregarContactoAction(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  await requireSesion();
  const r = await agregarContacto({
    telefono: String(formData.get("telefono") ?? ""),
    nombre: String(formData.get("nombre") ?? "").trim() || null,
    razonSocial: String(formData.get("razonSocial") ?? "").trim() || null,
    sucursal: String(formData.get("sucursal") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    categoriaHabitual: String(formData.get("categoria") ?? "").trim() || null,
  });
  if (r.ok) revalidatePath("/vanni/contactos");
  return r;
}

export async function cambiarEstadoContactoAction(id: number, estado: "activo" | "baja"): Promise<void> {
  await requireSesion();
  await db
    .update(vanniContactos)
    .set({ estado, bajaAt: estado === "baja" ? new Date() : null, updatedAt: new Date() })
    .where(eq(vanniContactos.id, id));
  revalidatePath("/vanni/contactos");
}

export async function cargarEjemploAction(): Promise<void> {
  await requireAdmin();
  await cargarEjemplo();
  revalidatePath("/vanni", "layout");
  redirect("/vanni?datos=ejemplo");
}

export async function borrarEjemploAction(): Promise<void> {
  await requireAdmin();
  await borrarEjemplo();
  revalidatePath("/vanni", "layout");
  redirect("/vanni");
}

// ─── Campañas ────────────────────────────────────────────────────────────────

/** Solo URLs de nuestro Blob: el campo es oculto, pero igual viene del navegador. */
function imagenDeFormulario(formData: FormData): string | null {
  const url = String(formData.get("imagenUrl") ?? "").trim();
  return /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/vanni\/campanas\//.test(url) ? url : null;
}

export async function guardarImagenCampanaAction(id: number, formData: FormData): Promise<void> {
  await requireAdmin();
  await db.update(vanniCampanas).set({ imagenUrl: imagenDeFormulario(formData) }).where(eq(vanniCampanas.id, id));
  revalidatePath(`/vanni/campanas/${id}`);
}

export async function crearCampanaAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const promocion = String(formData.get("promocion") ?? "").trim();
  if (!nombre || !promocion) return { error: "La campaña necesita nombre y promoción" };

  const variantes = ["A", "B", "C"]
    .map((codigo) => ({
      codigo,
      nombre: String(formData.get(`nombre${codigo}`) ?? "").trim() || `Variante ${codigo}`,
      plantilla: String(formData.get(`plantilla${codigo}`) ?? "").trim(),
    }))
    .filter((v) => v.plantilla);
  if (!variantes.length) return { error: "Escribe al menos un mensaje (variante A)" };

  const horas = Number(formData.get("recordatorioHoras") || 0);
  const ejecutivaId = Number(formData.get("ejecutivaId") || 0) || null;
  const [c] = await db
    .insert(vanniCampanas)
    .values({
      nombre,
      promocion,
      condiciones: String(formData.get("condiciones") ?? "").trim() || null,
      ejecutivaId,
      segmentos: formData.getAll("segmentos").map(String),
      sucursales: formData.getAll("sucursales").map(String),
      recordatorioHoras: horas > 0 ? horas : null,
      imagenUrl: imagenDeFormulario(formData),
      ejemplo: formData.get("ejemplo") === "1",
    })
    .returning();
  await db.insert(vanniVariantes).values(variantes.map((v) => ({ ...v, campanaId: c.id })));
  redirect(`/vanni/campanas/${c.id}`);
}

export async function lanzarCampanaAction(id: number): Promise<void> {
  await requireAdmin();
  const encolados = await encolarCampana(id);
  const origen = await origenActual();
  if (encolados > 0) {
    // El primer tramo corre acá mismo, después de responder; los siguientes los
    // encadena el endpoint de la cola.
    after(async () => {
      const r = await procesarCola(45_000);
      if (debeEncadenar(r)) await dispararCola(origen);
    });
  }
  revalidatePath(`/vanni/campanas/${id}`);
}

export async function pausarCampanaAction(id: number, pausar: boolean): Promise<void> {
  await requireAdmin();
  await db
    .update(vanniCampanas)
    .set({ estado: pausar ? "pausada" : "enviando", pausaMotivo: null })
    .where(eq(vanniCampanas.id, id));
  if (!pausar) {
    const origen = await origenActual();
    after(() => dispararCola(origen));
  }
  revalidatePath(`/vanni/campanas/${id}`);
}

export async function actualizarEstadosAction(id: number): Promise<void> {
  await requireSesion();
  await actualizarEstados(60);
  revalidatePath(`/vanni/campanas/${id}`);
}

/** Manda la variante elegida a un número de prueba, sin que cuente en la campaña. */
export async function enviarPruebaAction(
  _prev: { ok?: string; error?: string } | null,
  formData: FormData,
): Promise<{ ok?: string; error?: string }> {
  await requireSesion();
  const id = Number(formData.get("campanaId"));
  const tel = normalizarTelefono(formData.get("telefono"));
  if (!tel) return { error: "Teléfono no válido" };
  const [c] = await db.select().from(vanniCampanas).where(eq(vanniCampanas.id, id));
  const [v] = await db
    .select()
    .from(vanniVariantes)
    .where(and(eq(vanniVariantes.campanaId, id), eq(vanniVariantes.codigo, String(formData.get("codigo") || "A"))));
  if (!c || !v) return { error: "No encontré la campaña o la variante" };
  const texto = renderPlantilla(v.plantilla, {
    nombre: String(formData.get("nombre") || "Joaquín"),
    promocion: c.promocion,
    categoria: "bandejas y envases",
  });
  const r = c.imagenUrl ? await enviarImagen(tel, c.imagenUrl, `[Prueba] ${texto}`) : await enviarTexto(tel, `[Prueba] ${texto}`);
  await guardarMensaje({ telefono: tel, flujo: "ofertas", direccion: "out", texto, imagenUrl: c.imagenUrl, simulado: r.simulado, waMsgId: r.msgId ?? null });
  if (!r.ok) return { error: r.error ?? "No se pudo enviar" };
  return { ok: r.simulado ? "Enviado en modo simulado (sin VANNI_WASENDER_API_KEY)" : `Enviado a +${tel}` };
}

// ─── Oportunidades ───────────────────────────────────────────────────────────

export async function actualizarOportunidadAction(formData: FormData): Promise<void> {
  await requireSesion();
  const id = Number(formData.get("id"));
  const estado = String(formData.get("estado") ?? "");
  const monto = Number(String(formData.get("monto") ?? "").replace(/\D/g, "")) || null;
  await db
    .update(vanniOportunidades)
    .set({
      estado: ["por_llamar", "llamado", "cotizando", "ganada", "perdida"].includes(estado) ? estado : undefined,
      notas: String(formData.get("notas") ?? "").trim() || null,
      montoCotizado: monto,
      updatedAt: new Date(),
    })
    .where(eq(vanniOportunidades.id, id));
  revalidatePath("/vanni/oportunidades");
  revalidatePath("/vanni");
}

// ─── Tienda ──────────────────────────────────────────────────────────────────

export async function actualizarProductoAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const precio = Number(String(formData.get("precio") ?? "").replace(/\D/g, ""));
  const stock = Number(String(formData.get("stock") ?? "").replace(/\D/g, ""));
  await db
    .update(vanniProductos)
    .set({
      ...(Number.isFinite(precio) && precio > 0 ? { precio } : {}),
      ...(Number.isFinite(stock) ? { stock } : {}),
      activo: formData.get("activo") === "on",
      destacado: formData.get("destacado") === "on",
      updatedAt: new Date(),
    })
    .where(eq(vanniProductos.id, id));
  revalidatePath("/vanni/tienda/productos");
}

export async function cambiarEstadoPedidoAction(formData: FormData): Promise<void> {
  await requireSesion();
  const id = Number(formData.get("id"));
  const estado = String(formData.get("estado")) as VanniEstadoPedido;
  if (!VANNI_ESTADOS_PEDIDO.includes(estado)) throw new Error("Estado no válido");
  await cambiarEstadoPedido(id, estado);
  revalidatePath("/vanni/tienda/pedidos");
  revalidatePath(`/vanni/tienda/pedidos/${id}`);
}

// ─── Equipo ──────────────────────────────────────────────────────────────────

export async function crearUsuarioAction(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  await requireAdmin();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const clave = String(formData.get("clave") ?? "");
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return { error: `“${username}” no sirve como usuario: usa 3 a 40 letras minúsculas o números, sin espacios, tildes ni @ (ej: ejecutiva).` };
  }
  if (!nombre) return { error: "Falta el nombre" };
  const problema = problemaDeClave(clave);
  if (problema) return { error: problema };
  const telefono = String(formData.get("telefono") ?? "").trim();
  const tel = telefono ? normalizarTelefono(telefono) : null;
  if (telefono && !tel) return { error: "El teléfono no es válido" };
  try {
    await db.insert(vanniUsuarios).values({
      username,
      nombre,
      email: String(formData.get("email") ?? "").trim() || null,
      telefono: tel,
      rol: formData.get("rol") === "admin" ? "admin" : formData.get("rol") === "caja" ? "caja" : "ejecutiva",
      passwordHash: hashPassword(clave),
      debeCambiarClave: true,
    });
  } catch {
    return { error: "Ese usuario ya existe" };
  }
  revalidatePath("/vanni/equipo");
  return { ok: `Cuenta creada. ${nombre} deberá cambiar la clave al entrar.` };
}

/** Nombre y datos de contacto. Así los avisos pasan a otra persona sin crear otra cuenta. */
export async function editarUsuarioAction(
  id: number,
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  await requireAdmin();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { error: "Falta el nombre" };
  const telefono = String(formData.get("telefono") ?? "").trim();
  const tel = telefono ? normalizarTelefono(telefono) : null;
  if (telefono && !tel) return { error: "El teléfono no es válido" };
  await db
    .update(vanniUsuarios)
    .set({ nombre, telefono: tel, email: String(formData.get("email") ?? "").trim() || null })
    .where(eq(vanniUsuarios.id, id));
  revalidatePath("/vanni/equipo");
  return { ok: "Guardado" };
}

export async function activarUsuarioAction(id: number, activo: boolean): Promise<void> {
  const s = await requireAdmin();
  if (s.userId === id && !activo) throw new Error("No puedes desactivar tu propia cuenta");
  await db.update(vanniUsuarios).set({ activo }).where(eq(vanniUsuarios.id, id));
  revalidatePath("/vanni/equipo");
}

// ─── Captura en tienda ───────────────────────────────────────────────────────

export async function subirBaseMaestraAction(
  _prev: ResultadoBase | { error: string } | null,
  formData: FormData,
): Promise<ResultadoBase | { error: string }> {
  await requireAdmin();
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige un archivo .xlsx o .csv" };
  if (archivo.size > 20 * 1024 * 1024) return { error: "El archivo pesa más de 20 MB" };
  const nombre = archivo.name.toLowerCase();
  let filas: unknown[][];
  try {
    if (nombre.endsWith(".xlsx")) filas = (await readSheet(Buffer.from(await archivo.arrayBuffer()))) as unknown[][];
    else if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) filas = parsearCsv(await archivo.text());
    else return { error: "Formato no soportado. Usa .xlsx o .csv (el .xls antiguo hay que guardarlo como .xlsx)." };
  } catch (err) {
    console.error("[vanni] no se pudo leer la base maestra", err);
    return { error: "No pude leer el archivo. ¿Está abierto en otro programa o dañado?" };
  }
  const r = await cargarBaseMaestra(filas);
  revalidatePath("/vanni/captura");
  return r;
}

export async function guardarPromocionAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id") || 0);
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) return;
  const valores = {
    titulo,
    detalle: String(formData.get("detalle") ?? "").trim() || null,
    activa: formData.get("activa") === "on",
    orden: Number(formData.get("orden") || 0),
  };
  if (id) await db.update(vanniPromociones).set(valores).where(eq(vanniPromociones.id, id));
  else await db.insert(vanniPromociones).values(valores);
  revalidatePath("/vanni/captura");
}

export async function borrarPromocionAction(id: number): Promise<void> {
  await requireAdmin();
  await db.delete(vanniPromociones).where(eq(vanniPromociones.id, id));
  revalidatePath("/vanni/captura");
}
