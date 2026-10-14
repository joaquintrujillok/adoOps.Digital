"use client";

// Lo que ve cada persona en su celular.
//
// Orden deliberado: primero las cinco preguntas, después su resultado y su
// punto en el mapa, y recién al final —si quiere— sus datos para recibirlo.
// Pedir el correo al comienzo convierte un juego de sala en un formulario, y la
// mitad de la sala se queda mirando el techo.
//
// Mientras el celular sigue abierto consulta la fase cada pocos segundos: cuando
// Nelson abre el cierre, la pantalla cambia sola a las dos preguntas finales.

import { useCallback, useEffect, useRef, useState } from "react";
import Mapa from "@/components/pulso/Mapa";
import {
  CUADRANTES,
  EXPECTATIVA,
  FRENOS,
  PREGUNTAS_CIERRE,
  PREGUNTAS_INICIO,
  ROLES,
  USO,
  type Cuadrante,
  type EstadoSala,
} from "@/lib/pulso/modelo";

type Fase = "inicio" | "cierre" | "cerrada";
type Pantalla = "cargando" | "intro" | "preguntas" | "resultado" | "cierre" | "contraste" | "cerrada";

interface Yo {
  id: number;
  cuadrante: Cuadrante;
  respondioCierre: boolean;
  dejoDatos: boolean;
}

function nuevoToken(): string {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// localStorage puede fallar (modo privado, WebView de LinkedIn): sin él, la
// persona igual responde; solo pierde poder retomar si recarga.
function leerToken(codigo: string): string {
  const k = `pulso:${codigo}`;
  try {
    const t = localStorage.getItem(k);
    if (t) return t;
    const n = nuevoToken();
    localStorage.setItem(k, n);
    return n;
  } catch {
    return nuevoToken();
  }
}

export default function Participante({
  codigo,
  organizacion,
  relator,
  faseInicial,
}: {
  codigo: string;
  organizacion: string;
  relator: string;
  faseInicial: Fase;
}) {
  const token = useRef<string>("");
  const [fase, setFase] = useState<Fase>(faseInicial);
  const [pantalla, setPantalla] = useState<Pantalla>("cargando");
  const [yo, setYo] = useState<Yo | null>(null);
  const [sala, setSala] = useState<EstadoSala | null>(null);

  // Respuestas en curso
  const [paso, setPaso] = useState(0);
  const [uso, setUso] = useState<string | null>(null);
  const [tarea, setTarea] = useState("");
  const [freno, setFreno] = useState<string | null>(null);
  const [expectativa, setExpectativa] = useState<number | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [pasoCierre, setPasoCierre] = useState(0);
  const [expCierre, setExpCierre] = useState<number | null>(null);
  const [frenoCierre, setFrenoCierre] = useState<string | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback(async () => {
    const r = await fetch(`/api/pulso/${codigo}?t=${token.current}`, { cache: "no-store" });
    if (!r.ok) return null;
    const d = (await r.json()) as { sala: EstadoSala; yo: Yo | null };
    setSala(d.sala);
    setFase(d.sala.fase);
    setYo(d.yo);
    return d;
  }, [codigo]);

  // Primera carga: decide en qué pantalla retomar.
  useEffect(() => {
    token.current = leerToken(codigo);
    consultar().then((d) => {
      if (!d) return setPantalla("intro");
      if (d.sala.fase === "cerrada") return setPantalla(d.yo ? "resultado" : "cerrada");
      if (!d.yo) return setPantalla("intro");
      if (d.sala.fase === "cierre" && !d.yo.respondioCierre) return setPantalla("cierre");
      setPantalla(d.yo.respondioCierre ? "contraste" : "resultado");
    });
  }, [codigo, consultar]);

  // Con el resultado a la vista, escucha si se abre el cierre.
  useEffect(() => {
    if (pantalla !== "resultado" && pantalla !== "contraste") return;
    const id = setInterval(async () => {
      const d = await consultar();
      if (d && d.sala.fase === "cierre" && d.yo && !d.yo.respondioCierre && pantalla === "resultado") {
        setPantalla("cierre");
      }
    }, 6000);
    return () => clearInterval(id);
  }, [pantalla, consultar]);

  async function enviar(body: Record<string, unknown>) {
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch(`/api/pulso/${codigo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.current, ...body }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "No pudimos guardar tu respuesta. Intenta de nuevo.");
        return null;
      }
      return d;
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      return null;
    } finally {
      setEnviando(false);
    }
  }

  async function terminarInicio(rolElegido: string) {
    const d = await enviar({ accion: "inicio", uso, tarea, freno, expectativa, rol: rolElegido });
    if (!d) return;
    await consultar();
    setPantalla(fase === "cierre" ? "cierre" : "resultado");
  }

  async function terminarCierre(frenoElegido: string) {
    const d = await enviar({ accion: "cierre", expectativaCierre: expCierre, frenoCierre: frenoElegido });
    if (!d) return;
    await consultar();
    setPantalla("contraste");
  }

  // ── Pantallas ──

  if (pantalla === "cargando") {
    return <main className="pz-movil" aria-busy="true" />;
  }

  if (pantalla === "cerrada") {
    return (
      <main className="pz-movil">
        <span className="eyebrow">Pulso IA · {organizacion}</span>
        <h1>Esta sesión ya cerró.</h1>
        <p className="lede">Gracias por pasar. Si quieres saber más, escríbenos en adoops.digital.</p>
        <Firma relator={relator} />
      </main>
    );
  }

  if (pantalla === "intro") {
    return (
      <main className="pz-movil">
        <div className="pz-paso">
          <span className="eyebrow">Pulso IA · {organizacion}</span>
          <h1>
            ¿Cómo está la <span className="ia">IA</span> en esta sala?
          </h1>
          <p className="lede">
            Cinco preguntas, un minuto. Tu respuesta aparece en la pantalla como un punto, sin tu nombre.
          </p>
          <div>
            <button className="btn btn-primary arrow" onClick={() => setPantalla("preguntas")}>
              Empezar
            </button>
          </div>
        </div>
        <Firma relator={relator} />
      </main>
    );
  }

  if (pantalla === "preguntas") {
    const p = PREGUNTAS_INICIO[paso];
    const avanzar = () => setPaso((n) => n + 1);
    return (
      <main className="pz-movil">
        <Progreso total={5} actual={paso} />
        <div className="pz-paso" key={paso}>
          <span className="pz-num">
            {String(paso + 1).padStart(2, "0")} / 05
          </span>
          <h2>{p.titulo}</h2>

          {p.clave === "uso" && (
            <Opciones
              opciones={USO}
              elegida={uso}
              onElegir={(v) => {
                setUso(v);
                setTimeout(avanzar, 180);
              }}
            />
          )}

          {p.clave === "tarea" && (
            <>
              <textarea
                value={tarea}
                maxLength={280}
                onChange={(e) => setTarea(e.target.value)}
                placeholder="Ej: armar el informe de cierre de mes"
                aria-label={p.titulo}
              />
              <div className="pz-acciones">
                <button className="btn btn-text" onClick={() => { setTarea(""); avanzar(); }}>
                  Saltar
                </button>
                <button className="btn btn-primary arrow" onClick={avanzar}>
                  Siguiente
                </button>
              </div>
            </>
          )}

          {p.clave === "freno" && (
            <Opciones
              opciones={FRENOS}
              elegida={freno}
              onElegir={(v) => {
                setFreno(v);
                setTimeout(avanzar, 180);
              }}
            />
          )}

          {p.clave === "expectativa" && (
            <Escala
              elegida={expectativa}
              onElegir={(v) => {
                setExpectativa(v);
                setTimeout(avanzar, 180);
              }}
            />
          )}

          {p.clave === "rol" && (
            <>
              <Opciones
                opciones={ROLES}
                elegida={rol}
                deshabilitado={enviando}
                onElegir={(v) => {
                  setRol(v);
                  terminarInicio(v);
                }}
              />
              {enviando && <p className="muted">Ubicándote en el mapa…</p>}
            </>
          )}

          {error && <p className="pz-error">{error}</p>}
          {paso > 0 && !enviando && (
            <div>
              <button className="btn btn-text" onClick={() => setPaso((n) => n - 1)}>
                ← Volver
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (pantalla === "cierre") {
    const p = PREGUNTAS_CIERRE[pasoCierre];
    return (
      <main className="pz-movil">
        <Progreso total={2} actual={pasoCierre} />
        <div className="pz-paso" key={`c${pasoCierre}`}>
          <span className="eyebrow">Cierre · lo mismo, después de la charla</span>
          <h2>{p.titulo}</h2>
          {p.clave === "expectativaCierre" && (
            <Escala
              elegida={expCierre}
              onElegir={(v) => {
                setExpCierre(v);
                setTimeout(() => setPasoCierre(1), 180);
              }}
            />
          )}
          {p.clave === "frenoCierre" && (
            <Opciones
              opciones={FRENOS}
              elegida={frenoCierre}
              deshabilitado={enviando}
              onElegir={(v) => {
                setFrenoCierre(v);
                terminarCierre(v);
              }}
            />
          )}
          {error && <p className="pz-error">{error}</p>}
        </div>
      </main>
    );
  }

  // resultado | contraste
  const c = yo ? CUADRANTES[yo.cuadrante] : null;
  const pct = sala && yo && sala.total ? Math.round((sala.cuadrantes[yo.cuadrante] / sala.total) * 100) : null;

  return (
    <main className="pz-movil">
      {pantalla === "contraste" && sala && (
        <div className="pz-paso">
          <span className="eyebrow">Antes y después</span>
          <h2>La sala, al terminar</h2>
          {sala.expectativaInicio != null && sala.expectativaCierre != null && (
            <p className="lede">
              La expectativa promedio pasó de <b>{sala.expectativaInicio.toFixed(1)}</b> a{" "}
              <b className="ia">{sala.expectativaCierre.toFixed(1)}</b> de 5, entre las {sala.conCierre} personas que
              respondieron el cierre.
            </p>
          )}
        </div>
      )}

      {c && (
        <div className="pz-resultado pz-paso">
          <span className="eyebrow">Tu perfil</span>
          <div className="pz-perfil">{c.nombre}</div>
          <div className="pz-lema">{c.lema}</div>
          <p style={{ marginTop: 6 }}>{c.lectura}</p>
          {pct != null && (
            <p className="muted" style={{ fontSize: 14 }}>
              En esta sala, el {pct}% quedó en el mismo cuadrante que tú.
            </p>
          )}
        </div>
      )}

      {sala && yo && (
        <Mapa puntos={sala.puntos} cuadrantes={sala.cuadrantes} yo={yo.id} cierre={pantalla === "contraste"} />
      )}

      {pantalla === "resultado" && fase !== "cerrada" && (
        <p className="pz-aviso">Mira la pantalla: tu punto acaba de aparecer. Deja esta página abierta; al final de la charla hay dos preguntas más.</p>
      )}

      {c && (
        <div className="pz-verde">
          <div className="k">Tu siguiente paso</div>
          <p>{c.siguiente}</p>
        </div>
      )}

      {yo && !yo.dejoDatos && fase !== "cerrada" && (
        <FormularioDatos
          enviando={enviando}
          error={error}
          onEnviar={async (datos) => {
            const d = await enviar({ accion: "contacto", ...datos });
            if (d) setYo((y) => (y ? { ...y, dejoDatos: true } : y));
          }}
        />
      )}

      {yo?.dejoDatos && (
        <p className="pz-aviso">Listo. Tu resultado te llega al terminar la charla.</p>
      )}

      <Firma relator={relator} />
    </main>
  );
}

// ── Piezas ──────────────────────────────────────────────────────────────────

function Progreso({ total, actual }: { total: number; actual: number }) {
  return (
    <div className="pz-progreso" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i <= actual ? "on" : ""} />
      ))}
    </div>
  );
}

function Opciones({
  opciones,
  elegida,
  onElegir,
  deshabilitado,
}: {
  opciones: { valor: string; texto: string }[];
  elegida: string | null;
  onElegir: (v: string) => void;
  deshabilitado?: boolean;
}) {
  return (
    <div className="pz-opciones" role="radiogroup">
      {opciones.map((o, i) => (
        <button
          key={o.valor}
          role="radio"
          aria-checked={elegida === o.valor}
          disabled={deshabilitado}
          className={`pz-opcion ${elegida === o.valor ? "on" : ""}`}
          onClick={() => onElegir(o.valor)}
        >
          <span>{o.texto}</span>
          <b>{String.fromCharCode(65 + i)}</b>
        </button>
      ))}
    </div>
  );
}

function Escala({ elegida, onElegir }: { elegida: number | null; onElegir: (v: number) => void }) {
  return (
    <div className="pz-escala" role="radiogroup">
      {EXPECTATIVA.map((o) => (
        <button
          key={o.valor}
          role="radio"
          aria-checked={elegida === o.valor}
          className={elegida === o.valor ? "on" : ""}
          onClick={() => onElegir(o.valor)}
        >
          {o.valor}
          <small>{o.texto}</small>
        </button>
      ))}
    </div>
  );
}

function FormularioDatos({
  enviando,
  error,
  onEnviar,
}: {
  enviando: boolean;
  error: string | null;
  onEnviar: (d: Record<string, unknown>) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [consiente, setConsiente] = useState(false);
  const [cerrado, setCerrado] = useState(false);

  if (cerrado) return null;

  return (
    <form
      className="pz-tarjeta"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar({ nombre, cargo, email, telefono, consiente });
      }}
    >
      <span className="eyebrow">Para llevártelo</span>
      <h2 style={{ fontSize: 22 }}>¿Te mandamos tu resultado?</h2>
      <p className="muted" style={{ fontSize: 14.5 }}>
        Te llega tu perfil, cómo quedó la sala y dos casos pensados para tu perfil. Es opcional: tu punto ya está en el
        mapa igual.
      </p>
      <div className="field">
        <label htmlFor="pz-nombre">Nombre</label>
        <input id="pz-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" required />
      </div>
      <div className="field">
        <label htmlFor="pz-cargo">Cargo</label>
        <input id="pz-cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} autoComplete="organization-title" />
      </div>
      <div className="field">
        <label htmlFor="pz-tel">WhatsApp</label>
        <input id="pz-tel" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" placeholder="+56 9 …" required />
      </div>
      <div className="field">
        <label htmlFor="pz-email">Correo (opcional)</label>
        <input id="pz-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <label className="pz-check">
        <input type="checkbox" checked={consiente} onChange={(e) => setConsiente(e.target.checked)} />
        <span>Acepto que adoOps me envíe mi resultado y me escriba de vez en cuando sobre IA. Puedo darme de baja cuando quiera.</span>
      </label>
      {error && <p className="pz-error">{error}</p>}
      <div className="pz-acciones">
        <button type="button" className="btn btn-text" onClick={() => setCerrado(true)}>
          No, gracias
        </button>
        <button type="submit" className="btn btn-primary arrow" disabled={enviando || !consiente}>
          {enviando ? "Enviando…" : "Enviármelo"}
        </button>
      </div>
    </form>
  );
}

function Firma({ relator }: { relator: string }) {
  return (
    <p className="pz-firma">
      <b>{relator}</b> · adoops.digital
    </p>
  );
}
