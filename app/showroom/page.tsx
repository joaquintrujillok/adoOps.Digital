import type { Metadata } from "next";
import FormularioShowroom from "@/components/crm/FormularioShowroom";
import { interesesDisponibles } from "@/lib/crm/showroom";
import { CLAVES, leer } from "@/lib/crm/settings";
import "../crm/crm.css";

// Página PÚBLICA: la abre el visitante escaneando el QR del mostrador. Vive
// fuera de /crm justamente para que el proxy no le pida sesión.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Déjanos tus datos",
  // No se indexa: es una página de uso interno del local, no contenido público.
  robots: { index: false, follow: false },
};

const BOUTIQUES = ["Alonso de Córdova", "Casa Costanera", "Viña del Mar"];

export default async function Showroom({
  searchParams,
}: {
  searchParams: Promise<{ b?: string; evento?: string }>;
}) {
  const { b, evento } = await searchParams;
  const [intereses, empresa] = await Promise.all([
    interesesDisponibles(),
    leer(CLAVES.empresa),
  ]);

  // El QR de cada boutique lleva su parámetro, así el visitante no tiene que
  // elegir dónde está parado.
  const boutique = b && BOUTIQUES.includes(b) ? b : undefined;

  return (
    <div className="crm-root flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-[440px]">
        <header className="mb-7 text-center">
          <div className="text-[22px] font-semibold text-[var(--crm-ink)]">
            {empresa ?? "Nuestra boutique"}
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--crm-ink-2)]">
            {evento
              ? `Gracias por acompañarnos en ${evento}. Déjanos tus datos y te contamos las novedades primero.`
              : "Déjanos tus datos y un ejecutivo te acompañará con lo que estás buscando."}
          </p>
          {boutique && (
            <p className="mt-1 text-[13px] text-[var(--crm-muted)]">Boutique {boutique}</p>
          )}
        </header>

        <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-[0_1px_3px_rgba(11,11,11,0.06)]">
          <FormularioShowroom
            intereses={intereses}
            boutiques={BOUTIQUES}
            empresa={empresa ?? "la boutique"}
            boutiquePorDefecto={boutique}
            evento={evento}
          />
        </div>

        <p className="mt-5 text-center text-[12px] leading-relaxed text-[var(--crm-muted)]">
          Tus datos se usan solo para contactarte por parte de{" "}
          {empresa ?? "la boutique"}. No se comparten con terceros.
        </p>
      </div>
    </div>
  );
}
