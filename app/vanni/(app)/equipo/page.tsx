import { asc } from "drizzle-orm";
import { db } from "@/db";
import { vanniUsuarios } from "@/db/vanni";
import FormUsuario from "@/components/vanni/FormUsuario";
import { activarUsuarioAction } from "@/lib/vanni/backoffice.actions";
import { requireAdmin } from "@/lib/vanni/auth.actions";
import { fechaHora } from "@/lib/vanni/formato";
import { formatoTelefono } from "@/lib/vanni/telefono";

export const dynamic = "force-dynamic";

export default async function Equipo() {
  const yo = await requireAdmin();
  const usuarios = await db.select().from(vanniUsuarios).orderBy(asc(vanniUsuarios.nombre));
  return (
    <>
      <div className="vn-top">
        <div>
          <h1>Equipo</h1>
          <p>Quién entra al backoffice. Las ejecutivas reciben por WhatsApp y correo a los interesados de sus campañas.</p>
        </div>
      </div>
      <div className="vn-grid vn-grid-2">
        <section className="vn-card">
          <h2>Cuentas</h2>
          <table className="vn-tabla" style={{ marginTop: 8 }}>
            <thead><tr><th>Nombre</th><th>Rol</th><th>Avisos a</th><th>Último ingreso</th><th></th></tr></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.nombre}</b><div style={{ fontSize: 12.5, color: "var(--vn-muted)" }}>{u.username}</div></td>
                  <td>{u.rol === "admin" ? "Administrador" : u.rol === "caja" ? "Caja" : "Ejecutiva"}</td>
                  <td style={{ fontSize: 13 }}>{u.telefono ? formatoTelefono(u.telefono) : "—"}<br />{u.email ?? ""}</td>
                  <td>{fechaHora(u.ultimoIngreso)}</td>
                  <td>
                    {u.id !== yo.userId && (
                      <form action={activarUsuarioAction.bind(null, u.id, !u.activo)}>
                        <button className="vn-btn vn-btn-sm vn-btn-sec">{u.activo ? "Desactivar" : "Activar"}</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="vn-card"><h2>Nueva cuenta</h2><div style={{ marginTop: 10 }}><FormUsuario /></div></section>
      </div>
    </>
  );
}
