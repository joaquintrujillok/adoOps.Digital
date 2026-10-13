"use client";

// La pantalla proyectada. Consulta la sala cada 2,5 s: en Vercel no hay
// websockets y para una sala de 15 a 150 personas no hacen falta.
//
// Inicio: el mapa se llena en vivo, con los frenos y las palabras al lado.
// Cierre: el mapa muestra cómo se movió la expectativa y el contraste antes/después.

import Image from "next/image";
import { useEffect, useState } from "react";
import Mapa from "@/components/pulso/Mapa";
import type { EstadoSala } from "@/lib/pulso/modelo";

export default function Pantalla({ inicial, qr, enlace }: { inicial: EstadoSala; qr: string; enlace: string }) {
  const [sala, setSala] = useState<EstadoSala>(inicial);
  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    let vivo = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/pulso/${inicial.codigo}`, { cache: "no-store" });
        if (r.ok && vivo) setSala((await r.json()).sala);
      } catch {
        /* la próxima vuelta lo intenta de nuevo */
      }
    };
    const id = setInterval(tick, 2500);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [inicial.codigo]);

  useEffect(() => {
    const id = setInterval(() => setTicker((n) => n + 1), 4000);
    return () => clearInterval(id);
  }, []);

  const enCierre = sala.fase !== "inicio" && sala.conCierre > 0;
  const max = Math.max(1, ...sala.frenos.map((f) => Math.max(f.inicio, f.cierre)));
  const frenos = [...sala.frenos].filter((f) => f.inicio + f.cierre > 0).sort((a, b) => b.inicio - a.inicio);
  const topFreno = frenos[0]?.valor;
  const maxPalabra = Math.max(1, ...sala.palabras.map((p) => p.n));
  const tarea = sala.tareas.length ? sala.tareas[ticker % sala.tareas.length] : null;

  return (
    <div className="pz-pantalla">
      <header className="pz-cab">
        <div className="izq">
          <Image src="/logo.png" alt="adoOps" width={110} height={32} className="brand-img" />
          <div>
            <span className="eyebrow">Pulso IA · {sala.organizacion}</span>
            <h1>
              {enCierre ? (
                <>¿Qué cambió en <span className="ia">esta sala</span>?</>
              ) : (
                <>¿Cómo está la <span className="ia">IA</span> en esta sala?</>
              )}
            </h1>
          </div>
        </div>
        {sala.fase !== "cerrada" && (
          <div className="pz-qr">
            <div className="svg" dangerouslySetInnerHTML={{ __html: qr }} />
            <div>
              <span>Escanea y responde</span>
              <b>{enlace}</b>
              <span>{sala.fase === "cierre" ? "2 preguntas · cierre" : "5 preguntas · 1 minuto"}</span>
            </div>
          </div>
        )}
      </header>

      <div className="pz-cuerpo">
        <Mapa puntos={sala.puntos} cuadrantes={sala.cuadrantes} grande cierre={enCierre} />

        <aside className="pz-lado">
          <div className="pz-total">
            <b>{enCierre ? sala.conCierre : sala.total}</b>
            <span className="pz-vivo">{enCierre ? `de ${sala.total} respondieron el cierre` : "personas en el mapa"}</span>
          </div>

          {enCierre && sala.expectativaInicio != null && sala.expectativaCierre != null && (
            <div className="pz-bloque">
              <span className="eyebrow">Expectativa promedio · de 1 a 5</span>
              <div className="pz-contraste">
                <div>
                  <small>Antes</small>
                  <b className="de">{sala.expectativaInicio.toFixed(1)}</b>
                </div>
                <b className="de">→</b>
                <div>
                  <small>Después</small>
                  <b className="a">{sala.expectativaCierre.toFixed(1)}</b>
                </div>
              </div>
            </div>
          )}

          {frenos.length > 0 && (
            <div className="pz-bloque">
              <span className="eyebrow">{enCierre ? "Lo que frena · antes y después" : "Lo que más frena"}</span>
              {frenos.map((f) => (
                <div className="pz-barra" key={f.valor}>
                  <span className="t">{f.texto}</span>
                  <div>
                    {enCierre && (
                      <div className="b" style={{ marginBottom: 3 }}>
                        <i className="antes" style={{ width: `${(f.inicio / max) * 100}%` }} />
                      </div>
                    )}
                    <div className="b">
                      <i
                        className={f.valor === topFreno && !enCierre ? "alto" : enCierre ? "alto" : ""}
                        style={{ width: `${((enCierre ? f.cierre : f.inicio) / max) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="v">{enCierre ? `${f.inicio}→${f.cierre}` : f.inicio}</span>
                </div>
              ))}
            </div>
          )}

          {!enCierre && sala.palabras.length > 0 && (
            <div className="pz-bloque">
              <span className="eyebrow">Lo que no quieren volver a hacer a mano</span>
              <div className="pz-nube">
                {sala.palabras.slice(0, 12).map((p, i) => (
                  <span
                    key={p.palabra}
                    className={i < 3 ? "top" : ""}
                    style={{ fontSize: `${15 + (p.n / maxPalabra) * 19}px` }}
                  >
                    {p.palabra}
                  </span>
                ))}
              </div>
              {tarea && (
                <p className="pz-ticker" key={ticker}>
                  “{tarea}”
                </p>
              )}
            </div>
          )}
        </aside>
      </div>

      <footer className="pz-pie">
        <span>
          <b>{sala.relator}</b> · adoops.digital
        </span>
        <span>{sala.fase === "cerrada" ? "Sesión cerrada" : "En vivo"}</span>
      </footer>
    </div>
  );
}
