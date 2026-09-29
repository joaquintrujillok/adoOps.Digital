import CambioDeClave from "@/components/vanni/CambioDeClave";
import { requireSesion } from "@/lib/vanni/auth.actions";

export const dynamic = "force-dynamic";

export default async function Cuenta() {
  const s = await requireSesion();
  return (
    <>
      <div className="vn-top">
        <div>
          <h1>Mi cuenta</h1>
          <p>{s.nombre} · {s.username} · {s.rol === "admin" ? "Administrador" : s.rol === "caja" ? "Caja" : "Ejecutiva"}</p>
        </div>
      </div>
      <section className="vn-card" style={{ maxWidth: 440 }}>
        <h2>Cambiar contraseña</h2>
        <div style={{ marginTop: 12 }}><CambioDeClave /></div>
      </section>
    </>
  );
}
