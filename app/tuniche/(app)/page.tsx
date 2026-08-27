import Link from "next/link";
import { nombreArea } from "@/lib/tuniche/areas";
import { alcanceActual, requireSesion } from "@/lib/tuniche/auth.actions";
import { puedeEnviarAlAgricultor, puedeGestionarUsuarios } from "@/lib/tuniche/session";
import { listarAgricultores, visitasRecientes } from "@/lib/tuniche/visitas";

export const dynamic = "force-dynamic";

function Cifra({
  valor,
  etiqueta,
  href,
  alerta,
}: {
  valor: number;
  etiqueta: string;
  href: string;
  alerta?: boolean;
}) {
  return (
    <Link href={href} className="tun-tarjeta block p-5 transition hover:border-[var(--tun-brand)]">
      <div
        className="text-[28px] font-semibold leading-none"
        style={{ color: alerta && valor > 0 ? "var(--tun-alerta)" : "var(--tun-ink)" }}
      >
        {valor}
      </div>
      <div className="mt-2 text-[13px]" style={{ color: "var(--tun-ink-2)" }}>
        {etiqueta}
      </div>
    </Link>
  );
}

export default async function InicioTuniche() {
  const s = await requireSesion();
  const alcance = await alcanceActual();

  const [agricultores, visitas] = await Promise.all([
    listarAgricultores(alcance),
    visitasRecientes(alcance, 200),
  ]);

  const pendientes = visitas.filter((v) => v.estado === "pendiente").length;
  const sinLote = visitas.filter((v) => !v.loteId).length;
  const lotes = agricultores.reduce((n, a) => n + a.lotes.length, 0);
  const sinTelefono = agricultores.filter((a) => !a.telefono).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--tun-ink)" }}>
          Hola, {s.nombre.split(" ")[0]}
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          {alcance.todo
            ? "Ves las dos áreas y administras las cuentas."
            : alcance.soloUsuarioId
              ? `Ves tus agricultores de ${nombreArea(s.area)}.`
              : `Ves ${nombreArea(s.area)} completa.`}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra valor={pendientes} etiqueta="Visitas por validar" href="/tuniche/visitas" alerta />
        <Cifra valor={visitas.length} etiqueta="Visitas registradas" href="/tuniche/visitas" />
        <Cifra valor={agricultores.length} etiqueta="Agricultores" href="/tuniche/agricultores" />
        <Cifra valor={lotes} etiqueta="Lotes" href="/tuniche/agricultores" />
      </div>

      {/* Una visita sin lote es un audio que se levantó y no llegó a ningún
          historial. Es la única falla del flujo que se recupera a mano, así que
          va acá arriba y no enterrada en una lista. */}
      {sinLote > 0 && (
        <p
          className="rounded-lg border px-3.5 py-2.5 text-[13px]"
          style={{
            borderColor: "var(--tun-alerta)",
            background: "var(--tun-alerta-soft)",
            color: "var(--tun-alerta)",
          }}
        >
          <b>{sinLote} {sinLote === 1 ? "visita quedó" : "visitas quedaron"} sin lote asignado.</b>{" "}
          El sistema prefirió no adivinar a cuál campo correspondía. Asígnalo en{" "}
          <Link href="/tuniche/visitas" className="underline">
            Visitas
          </Link>{" "}
          o no van a aparecer en el historial de nadie.
        </p>
      )}

      <section className="tun-tarjeta p-5">
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--tun-muted)" }}
        >
          Cómo se carga una visita
        </h2>
        <ol className="mt-3 space-y-2 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          <li>
            <b style={{ color: "var(--tun-ink)" }}>1.</b> Mandas un audio por WhatsApp desde tu
            número registrado, apenas terminas de recorrer el campo.
          </li>
          <li>
            <b style={{ color: "var(--tun-ink)" }}>2.</b> El sistema te devuelve el borrador
            estructurado por el mismo WhatsApp.
          </li>
          <li>
            <b style={{ color: "var(--tun-ink)" }}>3.</b> Respondes <b>OK</b> y recién ahí entra al
            historial del agricultor. Las fotos que mandes después se pegan solas.
          </li>
        </ol>
      </section>

      {puedeGestionarUsuarios(s) && sinTelefono > 0 && (
        <section className="tun-tarjeta p-5">
          <h2
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--tun-muted)" }}
          >
            Lo que falta para cerrar el flujo
          </h2>
          <p className="mt-3 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
            <b>{sinTelefono} de {agricultores.length} agricultores no tienen teléfono.</b> Ninguna
            de las dos planillas lo traía: la de MN mandó las columnas de contacto vacías y la de
            Altué venía anonimizada. Se puede registrar la visita, pero todavía no hay a quién
            mandarle el informe.
          </p>
        </section>
      )}

      {!puedeEnviarAlAgricultor(s) && (
        <p className="text-[13px]" style={{ color: "var(--tun-muted)" }}>
          El envío del informe al agricultor lo hace la jefatura de tu área.
        </p>
      )}
    </div>
  );
}
