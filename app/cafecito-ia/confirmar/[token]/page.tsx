import type { Metadata } from "next";
import Link from "next/link";
import CafecitoPerfil from "@/components/CafecitoPerfil";
import { abrirEnlaceDeConfirmacion } from "@/lib/cafecito/confirmar";
import { mascara } from "@/lib/cafecito/iconos";
import Sitio from "../../../_web/Sitio";

// Nada de esto se cachea ni se indexa: es una página personal por token.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirma tu suscripción — Cafecito IA",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <Sitio foco>
      <main id="top" className="cf-foco">
        <div className="cf-tarjeta">{children}</div>
      </main>
    </Sitio>
  );
}

export default async function Confirmar({ params }: Props) {
  const { token } = await params;

  // Abrir el enlace confirma el correo. No es una lectura: es el segundo paso
  // del doble opt-in. Ver `lib/cafecito/confirmar.ts`.
  const r = await abrirEnlaceDeConfirmacion(token);

  if (r.estado === "invalido") {
    return (
      <Marco>
        <h1>
          Este enlace no es válido
        </h1>
        <p className="cf-txt">
          Puede que ya lo hayas usado, que esté incompleto o que te hayas dado de
          baja. Vuelve a suscribirte y te mandamos uno nuevo.
        </p>
        <Link href="/cafecito-ia#suscribirse" className="btn btn-primary arrow">
          Ir a suscribirme
        </Link>
      </Marco>
    );
  }

  if (r.estado === "vencido") {
    return (
      <Marco>
        <h1>
          El enlace venció
        </h1>
        <p className="cf-txt">
          Los enlaces de confirmación duran 7 días. Vuelve a dejar tu correo y te
          llega uno nuevo al instante.
        </p>
        <Link href="/cafecito-ia#suscribirse" className="btn btn-primary arrow">
          Pedir otro enlace
        </Link>
      </Marco>
    );
  }

  const s = r.suscriptor;
  const recien = r.estado === "recien";

  return (
    <Marco>
      {/* La suscripción ya está hecha en este punto, y el aviso lo dice antes
          que nada. Lo de abajo es opcional: quien cierre acá igual recibe el
          boletín, que es exactamente lo que antes no pasaba. */}
      <div className="cf-aviso">
        <i aria-hidden style={mascara("check", "var(--accent-ink)")} />
        <p>
          {recien ? (
            <>
              <strong>Listo, tu correo quedó confirmado.</strong> Ya estás suscrito
              aunque cierres esta página.
            </>
          ) : (
            <>
              <strong>Ya estás suscrito.</strong> Desde acá puedes cambiar de taza
              o corregir tus datos cuando quieras.
            </>
          )}
        </p>
      </div>

      <h1>
        {recien ? "¿Cómo lo tomas?" : "Ajusta tu cafecito"}
      </h1>
      <p className="cf-txt">
        {recien
          ? "Elige el tamaño de tu taza y cuéntanos brevemente a qué te dedicas, para afinar lo que te llega. Si no eliges, te sirvo el expreso directivo."
          : "Cambia lo que quieras y guarda. Nada de esto afecta tu suscripción."}
      </p>

      <CafecitoPerfil
        token={token}
        tazaActual={s.taza}
        datos={{ nombre: s.nombre, empresa: s.empresa, rol: s.rol, telefono: s.telefono }}
      />
    </Marco>
  );
}
