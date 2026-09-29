import Image from "next/image";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { vanniOportunidades, vanniPedidos } from "@/db/vanni";
import CambioDeClave from "@/components/vanni/CambioDeClave";
import Nav, { type GrupoNav } from "@/components/vanni/Nav";
import { logoutAction, requireSesion } from "@/lib/vanni/auth.actions";
import { esAdmin } from "@/lib/vanni/session";
import { modoWhatsApp } from "@/lib/vanni/wa";

// Sin caché: la sesión se contrasta contra la base en cada carga.
export const dynamic = "force-dynamic";

export default async function VanniAppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requireSesion();

  // Los contadores del menú son lo que espera acción: interesados por llamar y
  // pedidos pagados que hay que preparar.
  const [[porLlamar], [porPreparar]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(vanniOportunidades)
      .where(sql`${vanniOportunidades.estado} = 'por_llamar' and ${vanniOportunidades.ejemplo} = false`),
    db.select({ n: sql<number>`count(*)::int` }).from(vanniPedidos).where(eq(vanniPedidos.estado, "pagado")),
  ]);

  const grupos: GrupoNav[] = [
    { titulo: "General", items: [{ href: "/vanni", etiqueta: "Resumen" }] },
    {
      titulo: "Campaña #Ofertas",
      items: [
        { href: "/vanni/contactos", etiqueta: "Contactos y segmentos" },
        { href: "/vanni/campanas", etiqueta: "Campañas" },
        { href: "/vanni/oportunidades", etiqueta: "Por llamar", contador: porLlamar?.n },
      ],
    },
    {
      titulo: "Captura en tienda",
      items: [{ href: "/vanni/captura", etiqueta: "QR, RUT y descuentos" }],
    },
    {
      titulo: "Tienda #tienda-whatsapp",
      items: [
        { href: "/vanni/tienda/productos", etiqueta: "Productos" },
        { href: "/vanni/tienda/pedidos", etiqueta: "Pedidos", contador: porPreparar?.n },
      ],
    },
    {
      titulo: "Motor WhatsApp",
      items: [
        { href: "/vanni/conversaciones", etiqueta: "Conversaciones" },
        { href: "/vanni/simulador", etiqueta: "Simulador" },
        ...(esAdmin(sesion) ? [{ href: "/vanni/equipo", etiqueta: "Equipo" }] : []),
      ],
    },
  ];

  const modo = modoWhatsApp();

  return (
    <div className="vn-shell">
      <aside className="vn-side">
        <div className="vn-brand">
          {/* El logo es gris sobre transparente: sobre el fondo oscuro no se lee, por eso va en su placa clara. */}
          <div className="vn-brand-placa">
            <Image src="/clientes/vanni-logo.png" alt="Vanni" width={160} height={63} priority />
          </div>
          <span>Backoffice WhatsApp</span>
        </div>
        {!sesion.debeCambiarClave && <Nav grupos={grupos} />}
        <div className="vn-nav-cuenta">
          <span className={`vn-chip ${modo === "real" ? "vn-chip-teal" : "vn-chip-aviso"}`} title="Modo de envío de WhatsApp">
            WhatsApp {modo === "real" ? "conectado" : "simulado"}
          </span>
          <div style={{ marginTop: 10 }}>
            <a href="/vanni/cuenta" style={{ color: "#d7e2de", textDecoration: "none" }}>{sesion.nombre}</a>
          </div>
          <form action={logoutAction}>
            <button type="submit">Cerrar sesión</button>
          </form>
        </div>
      </aside>
      <main className="vn-main">
        {sesion.debeCambiarClave ? (
          <div style={{ maxWidth: 440, margin: "32px auto" }}>
            <h1 style={{ fontSize: 24, fontWeight: 600 }}>Elige tu contraseña</h1>
            <p style={{ color: "var(--vn-muted)", margin: "4px 0 16px" }}>Es el último paso antes de entrar.</p>
            <div className="vn-card"><CambioDeClave /></div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
