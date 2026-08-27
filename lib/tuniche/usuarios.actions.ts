"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tunicheUsuarios, type TunicheRol } from "@/db/tuniche";
import { normalizarTelefono } from "@/lib/crm/telefono";
import { esAreaValida, type AreaId } from "./areas";
import { requireAdmin, requireSesion } from "./auth.actions";
import {
  crearSesion,
  hashPassword,
  problemaDeClave,
  verifyPassword,
} from "./session";

const RUTA_USUARIOS = "/tuniche/usuarios";

export interface Resultado {
  error?: string;
  ok?: string;
  /** Clave recién generada. Se muestra una vez y no vuelve a estar disponible. */
  clave?: string;
}

const ROLES: TunicheRol[] = ["admin", "jefe", "zonal"];

// ─── Clave temporal ──────────────────────────────────────────────────────────

// Sin I, l, 1, O ni 0: esta clave se dicta por teléfono, y la mitad de los
// problemas de "no me funciona" son un uno que se escuchó como ele.
const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Una clave para entrar la primera vez y nada más.
 *
 * La genera el sistema en vez de dejar que el administrador la invente porque
 * un administrador apurado escribe `tuniche2026` catorce veces. Se muestra una
 * sola vez en pantalla; después solo existe su hash.
 */
function claveTemporal(): string {
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  const cuerpo = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
  return `${cuerpo.slice(0, 4)}-${cuerpo.slice(4, 8)}-${cuerpo.slice(8, 12)}`;
}

// ─── Validación compartida ───────────────────────────────────────────────────

interface Campos {
  username: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  rol: TunicheRol;
  area: AreaId | null;
}

/**
 * Lee y valida el formulario. Devuelve el problema en vez de lanzarlo: son
 * errores de quien escribe, no fallas del sistema, y se muestran en el mismo
 * formulario.
 */
function leerCampos(fd: FormData): { campos?: Campos; error?: string } {
  const username = ((fd.get("username") as string) ?? "").trim().toLowerCase();
  const nombre = ((fd.get("nombre") as string) ?? "").trim();
  const emailCrudo = ((fd.get("email") as string) ?? "").trim();
  const telefonoCrudo = ((fd.get("telefono") as string) ?? "").trim();
  const rol = (fd.get("rol") as string) ?? "";
  const areaCruda = ((fd.get("area") as string) ?? "").trim();

  if (!/^[a-z0-9._-]{3,60}$/.test(username)) {
    return {
      error:
        "El usuario va en minúsculas, sin espacios ni tildes, entre 3 y 60 caracteres",
    };
  }
  if (nombre.length < 3) return { error: "Escribe el nombre completo de la persona" };
  if (!ROLES.includes(rol as TunicheRol)) return { error: "Elige un rol válido" };

  // Un admin con área daría a entender que su alcance está limitado, y no lo
  // está. Un jefe o un zonal sin área no tendría ninguna fila que ver.
  let area: AreaId | null = null;
  if (rol === "admin") {
    area = null;
  } else {
    if (!esAreaValida(areaCruda)) return { error: "Elige el área a la que pertenece" };
    area = areaCruda;
  }

  if (emailCrudo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCrudo)) {
    return { error: "El correo no tiene un formato válido" };
  }

  // El teléfono es la identidad en WhatsApp, así que un número que no se puede
  // normalizar se rechaza en vez de guardarse como texto: guardarlo tal cual
  // significaría que el audio de esa persona nunca la va a encontrar.
  let telefono: string | null = null;
  if (telefonoCrudo) {
    telefono = normalizarTelefono(telefonoCrudo);
    if (!telefono) {
      return { error: `No pude interpretar el teléfono «${telefonoCrudo}». Escríbelo como +56 9 1234 5678` };
    }
  }

  return {
    campos: { username, nombre, email: emailCrudo || null, telefono, rol: rol as TunicheRol, area },
  };
}

/** Traduce el choque de un índice único a algo que se pueda leer. */
function traducirConflicto(err: unknown, campos: Campos): string {
  const m = err instanceof Error ? err.message : String(err);
  if (m.includes("tuniche_usuarios_username_idx")) {
    return `Ya existe un usuario «${campos.username}»`;
  }
  if (m.includes("tuniche_usuarios_telefono_idx")) {
    return `Ese teléfono ya está registrado en otra cuenta. Un número identifica a una sola persona en WhatsApp.`;
  }
  console.error("tuniche/usuarios:", err);
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

// ─── Acciones ────────────────────────────────────────────────────────────────

export async function crearUsuarioAction(
  _prev: Resultado,
  fd: FormData,
): Promise<Resultado> {
  const admin = await requireAdmin();
  const { campos, error } = leerCampos(fd);
  if (!campos) return { error };

  const clave = claveTemporal();

  try {
    await db.insert(tunicheUsuarios).values({
      username: campos.username,
      nombre: campos.nombre,
      email: campos.email,
      telefono: campos.telefono,
      passwordHash: hashPassword(clave),
      rol: campos.rol,
      area: campos.area,
      activo: true,
      debeCambiarClave: true,
      creadoPor: admin.userId,
    });
  } catch (err) {
    return { error: traducirConflicto(err, campos) };
  }

  revalidatePath(RUTA_USUARIOS);
  return {
    ok: `Cuenta creada para ${campos.nombre}.`,
    clave,
  };
}

export async function actualizarUsuarioAction(
  _prev: Resultado,
  fd: FormData,
): Promise<Resultado> {
  const admin = await requireAdmin();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Usuario inválido" };

  const { campos, error } = leerCampos(fd);
  if (!campos) return { error };

  // Quitarse el propio rol de administrador deja el sistema sin nadie que
  // pueda devolvérselo. Se bloquea acá y no en la pantalla porque la pantalla
  // se puede saltar.
  if (id === admin.userId && campos.rol !== "admin") {
    return { error: "No puedes quitarte a ti mismo el rol de administrador" };
  }
  if (campos.rol !== "admin" && (await ultimoAdmin(id))) {
    return { error: "Es el último administrador activo. Nombra otro antes de cambiarle el rol." };
  }

  try {
    await db
      .update(tunicheUsuarios)
      .set({
        username: campos.username,
        nombre: campos.nombre,
        email: campos.email,
        telefono: campos.telefono,
        rol: campos.rol,
        area: campos.area,
      })
      .where(eq(tunicheUsuarios.id, id));
  } catch (err) {
    return { error: traducirConflicto(err, campos) };
  }

  revalidatePath(RUTA_USUARIOS);
  return { ok: `${campos.nombre} actualizado.` };
}

/**
 * Activa o desactiva una cuenta. **Nunca se borra un usuario**: sus visitas
 * quedan firmadas con su id, y una fila huérfana convierte el historial de un
 * agricultor en un informe sin autor.
 */
export async function alternarActivoAction(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const [u] = await db
    .select()
    .from(tunicheUsuarios)
    .where(eq(tunicheUsuarios.id, id))
    .limit(1);
  if (!u) return;

  if (u.activo) {
    if (id === admin.userId) throw new Error("No puedes desactivar tu propia cuenta");
    if (await ultimoAdmin(id)) {
      throw new Error("Es el último administrador activo. Nombra otro antes de desactivarlo.");
    }
  }

  await db
    .update(tunicheUsuarios)
    .set({ activo: !u.activo })
    .where(eq(tunicheUsuarios.id, id));

  revalidatePath(RUTA_USUARIOS);
}

/** Devuelve una clave nueva de un solo uso. La anterior deja de servir. */
export async function resetearClaveAction(
  _prev: Resultado,
  fd: FormData,
): Promise<Resultado> {
  await requireAdmin();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Usuario inválido" };

  const [u] = await db
    .select({ nombre: tunicheUsuarios.nombre })
    .from(tunicheUsuarios)
    .where(eq(tunicheUsuarios.id, id))
    .limit(1);
  if (!u) return { error: "Ese usuario ya no existe" };

  const clave = claveTemporal();
  await db
    .update(tunicheUsuarios)
    .set({ passwordHash: hashPassword(clave), debeCambiarClave: true })
    .where(eq(tunicheUsuarios.id, id));

  revalidatePath(RUTA_USUARIOS);
  return { ok: `Clave nueva para ${u.nombre}.`, clave };
}

/**
 * Cambio de contraseña propia. Pide la actual aunque haya sesión viva: una
 * pantalla desatendida no debería alcanzar para quedarse con la cuenta.
 */
export async function cambiarMiClaveAction(
  _prev: Resultado,
  fd: FormData,
): Promise<Resultado> {
  const s = await requireSesion();
  const actual = (fd.get("actual") as string) ?? "";
  const nueva = (fd.get("nueva") as string) ?? "";
  const repetida = (fd.get("repetida") as string) ?? "";

  const [u] = await db
    .select()
    .from(tunicheUsuarios)
    .where(eq(tunicheUsuarios.id, s.userId))
    .limit(1);
  if (!u) return { error: "Tu cuenta ya no existe. Vuelve a entrar." };

  if (!verifyPassword(actual, u.passwordHash)) {
    return { error: "La contraseña actual no coincide" };
  }
  if (nueva !== repetida) return { error: "Las dos contraseñas nuevas no coinciden" };

  const problema = problemaDeClave(nueva);
  if (problema) return { error: problema };
  if (verifyPassword(nueva, u.passwordHash)) {
    return { error: "La contraseña nueva tiene que ser distinta de la actual" };
  }

  await db
    .update(tunicheUsuarios)
    .set({ passwordHash: hashPassword(nueva), debeCambiarClave: false })
    .where(eq(tunicheUsuarios.id, u.id));

  // La cookie lleva `debeCambiarClave` adentro, así que hay que reemitirla o la
  // persona seguiría viendo la pantalla de cambio obligatorio hasta que expire.
  await crearSesion({ ...s, debeCambiarClave: false });

  revalidatePath("/tuniche", "layout");
  return { ok: "Contraseña actualizada." };
}

/** ¿Sacar a este usuario del rol admin dejaría el sistema sin administradores? */
async function ultimoAdmin(id: number): Promise<boolean> {
  const otros = await db
    .select({ id: tunicheUsuarios.id })
    .from(tunicheUsuarios)
    .where(
      and(
        eq(tunicheUsuarios.rol, "admin"),
        eq(tunicheUsuarios.activo, true),
        ne(tunicheUsuarios.id, id),
      ),
    )
    .limit(1);
  return otros.length === 0;
}

/**
 * El área desde la que un administrador manda sus audios de prueba.
 *
 * Existe porque un admin **no tiene área** —cruza las dos a propósito— y un
 * audio sin área no tiene plantilla contra la cual estructurarse. En vez de
 * adivinar cuál, se le pregunta. Para un jefe o un zonal esto no aplica: su
 * área ya responde la pregunta, y ofrecerles el selector les sugeriría que
 * pueden mirar la otra.
 */
export async function guardarAreaAudioAction(fd: FormData): Promise<void> {
  const s = await requireSesion();
  if (s.rol !== "admin") throw new Error("Solo un administrador declara su área de audio");

  const area = ((fd.get("areaAudio") as string) ?? "").trim();
  if (area && !esAreaValida(area)) throw new Error("Área inválida");

  await db
    .update(tunicheUsuarios)
    .set({ areaAudio: area || null })
    .where(eq(tunicheUsuarios.id, s.userId));

  revalidatePath("/tuniche/cuenta");
}
