"use client";

import { useActionState, useEffect, useState } from "react";
import { perfilar, type PerfilState } from "@/lib/cafecito/actions";
import { evento } from "@/lib/cafecito/analitica";
import { TAZAS, type CafecitoTaza } from "@/db/cafecito";
import { mascara, type NombreIcono } from "@/lib/cafecito/iconos";
import { PAIS_POR_DEFECTO, PAISES, paisPorIso } from "@/lib/cafecito/telefono";

const INITIAL: PerfilState = { status: "idle" };

const ORDEN: CafecitoTaza[] = ["expreso_directivo", "expreso_builder", "flat_white"];

const ICONO: Record<CafecitoTaza, NombreIcono> = {
  expreso_directivo: "briefcase",
  expreso_builder: "terminal",
  flat_white: "book-open",
};

export default function CafecitoPerfil({
  token,
  tazaActual,
  datos,
}: {
  token: string;
  tazaActual: CafecitoTaza | null;
  datos: { nombre: string | null; empresa: string | null; rol: string | null; telefono: string | null };
}) {
  const [state, action, pending] = useActionState(perfilar, INITIAL);
  // Sin valor por defecto, a propósito. Antes arrancaba en `expreso_directivo`,
  // y como el borde verde se pinta contra este estado, la pregunta no se veía
  // como pregunta: se veía como algo ya respondido. Quien bajaba a llenar nombre
  // y empresa sin volver a subir enviaba expreso directivo sin haber elegido
  // nunca. Pasó en producción el 04-09-2026.
  //
  // El beneficio de fondo es que `taza = NULL` vuelve a significar algo: "no
  // eligió", que es distinto de "eligió el primero". El fallback de la API pasa
  // a describir un caso real en vez de tapar este bug.
  const [taza, setTaza] = useState<CafecitoTaza | null>(tazaActual);

  // Un teléfono ya guardado viene en E.164 (`+56912345678`). Se parte en las dos
  // piezas del formulario para que quien vuelve a este enlace vea su número
  // donde lo dejó, y no un campo vacío que parece haberlo perdido.
  const guardado = PAISES.find((pa) => datos.telefono?.startsWith(`+${pa.codigo}`));
  const [pais, setPais] = useState(guardado?.iso ?? PAIS_POR_DEFECTO);
  const [numero, setNumero] = useState(
    guardado && datos.telefono ? datos.telefono.slice(guardado.codigo.length + 1) : "",
  );
  const paisElegido = paisPorIso(pais);

  // La taza va como parámetro: es lo que dice qué audiencia se está atrayendo,
  // y la distancia contra `suscripcion_iniciada` es la tasa de abandono del
  // doble opt-in, que hoy no se mide en ninguna parte.
  useEffect(() => {
    if (state.status === "success") {
      evento("suscripcion_confirmada", { taza: state.taza });
    }
  }, [state.status, state.status === "success" ? state.taza : null]);

  if (state.status === "success") {
    const t = TAZAS[state.taza];
    return (
      <div className="cf-listo">
        <span className="cf-ico" aria-hidden>
          <i style={mascara("coffee", "var(--accent-ink)")} />
        </span>
        <h2>Quedaste dentro</h2>
        <p className="cf-txt">
          Te sirvo un <strong>{t.nombre.toLowerCase()}</strong> los
          lunes, miércoles y viernes a las 9 de la mañana. Puedes volver a este
          enlace cuando quieras si te cambias de taza.
        </p>
        <a href="/cafecito-ia" className="btn btn-primary arrow">
          Leer la última edición
        </a>
      </div>
    );
  }

  // Los estilos son los de la web pública (`.v2`, app/_web/sitio.css): este
  // formulario solo se renderiza dentro de `Sitio`.
  return (
    <form action={action} className="cf-perfil">
      <input type="hidden" name="token" value={token} />
      {/* Vacío cuando no se eligió. `perfilar` lo rechaza con "Elige una de las
          tres tazas", que es la red por si alguien envía sin pasar por el botón. */}
      <input type="hidden" name="taza" value={taza ?? ""} />

      <div>
        <span className="cf-etq">¿Cómo lo tomas?</span>
        <div className="cf-opciones">
          {ORDEN.map((valor) => {
            const t = TAZAS[valor];
            const activo = taza === valor;
            return (
              <button
                key={valor} type="button" onClick={() => setTaza(valor)} aria-pressed={activo}
                className={activo ? "cf-opcion cf-on" : "cf-opcion"}
              >
                <span className="cf-ico">
                  <i style={mascara(ICONO[valor], activo ? "var(--accent-ink)" : "var(--ink-2)")} />
                </span>
                <span>
                  <span className="cf-taza-nom">
                    {t.nombre}
                    <span className="cf-min">{t.minutos}</span>
                  </span>
                  <span className="cf-taza-det">{t.detalle}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="cf-campos">
        <div>
          <label className="cf-etq" htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" defaultValue={datos.nombre ?? ""} placeholder="Cómo te llamamos" />
        </div>
        <div className="cf-dos">
          <div>
            <label className="cf-etq" htmlFor="empresa">Empresa</label>
            <input id="empresa" name="empresa" defaultValue={datos.empresa ?? ""} placeholder="Dónde trabajas" />
          </div>
          <div>
            <label className="cf-etq" htmlFor="rol">Rol</label>
            <input id="rol" name="rol" defaultValue={datos.rol ?? ""} placeholder="A qué te dedicas" />
          </div>
        </div>

        {/* País y número van separados a propósito. Un solo campo obliga a la
            persona a saber el formato internacional; separados, el código lo
            pone la lista y ella escribe el número como lo escribe siempre.
            Cambiar de país no borra lo tecleado: son dos controles distintos. */}
        <div>
          <label className="cf-etq" htmlFor="telefono">
            Teléfono <em>(opcional)</em>
          </label>
          {/* `auto-fit` en vez de dos columnas fijas: en el teléfono el par
              quedaba en 134px y 117px —"República Dominicana — +1" truncado y
              un campo donde no se ve el número que se escribe—. Así se apilan
              solos cuando no caben en 170px cada uno, sin media query. */}
          <div className="cf-tel">
            <select
              name="telefonoPais"
              aria-label="País del teléfono"
              value={pais}
              onChange={(e) => setPais(e.target.value)}
              style={{ cursor: "pointer" }}
            >
              {PAISES.map((pa) => (
                <option key={pa.iso} value={pa.iso}>
                  {pa.nombre} — +{pa.codigo}
                </option>
              ))}
            </select>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              maxLength={18}
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder={paisElegido?.ejemplo ?? ""}
            />
          </div>
          <p className="cf-fino" style={{ marginTop: 7 }}>
            Solo para avisarte de algo importante. Nunca para llamarte a vender.
          </p>
        </div>
      </div>

      <div>
        <button
          type="submit" disabled={pending || !taza}
          className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}
        >
          {pending ? "Guardando…" : "Guardar preferencias"}
        </button>
        {!taza && (
          <p className="cf-fino cf-centro" style={{ marginTop: 12, fontSize: 13.5 }}>
            Elige una taza para continuar.
          </p>
        )}
        {state.status === "error" && (
          <p className="form-error" style={{ marginTop: 12 }}>{state.message}</p>
        )}
        <p className="cf-fino cf-centro" style={{ marginTop: 12 }}>
          Todo esto es opcional. Tu suscripción ya está hecha: si no guardas nada,
          igual te llega el boletín.
        </p>
      </div>
    </form>
  );
}
