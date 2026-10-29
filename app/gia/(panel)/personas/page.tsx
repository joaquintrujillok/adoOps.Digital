import Link from "next/link";
import Matriz from "@/components/gia/Matriz";
import { fichasEnVivo } from "@/lib/gia/datos";
import { fmt, matrizCombinada, porNivel, totalPersonas } from "@/lib/gia/agregados";
import { CAMPOS, arquetipoPorId, campoDe } from "@/lib/gia/modelo";
import { FICHAS, RUTAS_FORMACION } from "@/lib/gia/semilla";

export const dynamic = "force-dynamic";

export default async function Personas() {
  const vivas = await fichasEnVivo();
  const matriz = matrizCombinada(vivas);
  const niveles = porNivel(vivas);

  const tarjetas = [
    ...vivas.map((f) => ({ href: `/gia/personas/${f.id}`, nombre: f.nombre, cargo: f.cargo, gerencia: f.gerencia, a: f.analisis, vivo: true })),
    ...FICHAS.map((f) => ({ href: `/gia/personas/${f.id}`, nombre: f.nombre, cargo: f.cargo, gerencia: f.gerencia, a: f.analisis, vivo: false })),
  ];

  return (
    <>
      <header>
        <div className="small muted">Perfil de adopción de cada colaborador, generado del análisis de su entrevista</div>
        <h1>Personas</h1>
      </header>

      <Matriz matriz={matriz} total={totalPersonas(vivas)} />

      <section className="card">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <h2>Fichas</h2>
          <span className="small muted">Cada perfil viene con la cita que lo respalda y la persona lo confirma</span>
        </div>
        <div className="grid" style={{ ["--min" as string]: "280px", gap: 14 }}>
          {tarjetas.map((t) => {
            const p = arquetipoPorId(t.a.perfil.principal);
            const horas = t.a.tareas.reduce((s, x) => s + (x.horasMes ?? 0), 0);
            return (
              <Link key={t.href} href={t.href} className="card" style={{ textDecoration: "none", color: "inherit", padding: 18, gap: 10, borderColor: t.vivo ? "#2E9E63" : undefined, borderWidth: t.vivo ? 2 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  {t.vivo ? <span className="pill t-verde vivo">Entrevista en vivo</span> : <span className="pill t-gris">Ejemplo</span>}
                  <span className="small muted">{t.gerencia}</span>
                </div>
                <div className="sora" style={{ fontSize: 19, fontWeight: 600 }}>{t.nombre}</div>
                <div className="small muted">{t.cargo}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <span className="pill t-verde">{p?.nombre}</span>
                  <span className="pill t-azul">Nivel {t.a.perfil.madurez}</span>
                  {horas > 0 && <span className="pill t-gris">{horas} h/mes repetitivas</span>}
                  {t.a.alertas.length > 0 && <span className="pill t-rojo">Alerta de gobierno</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="row">
        <div className="card">
          <h2>Rutas de formación por madurez</h2>
          {RUTAS_FORMACION.map((r) => {
            const n = r.niveles.reduce((s, k) => s + niveles[k - 1], 0);
            return (
              <div key={r.t} style={{ borderTop: "1px solid var(--g-linea2)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{r.t}</strong><span className="small muted">{fmt(n)} personas</span>
                </div>
                <span className="small" style={{ color: "var(--g-suave)" }}>{r.d}</span>
              </div>
            );
          })}
        </div>
        <div className="card">
          <h2>Rutas por campo de arquetipo</h2>
          {CAMPOS.map((c) => {
            const n = Object.entries(matriz)
              .filter(([id]) => campoDe(id as never).id === c.id)
              .reduce((s, [, celdas]) => s + celdas.reduce((x, k) => x + k.base + k.vivo, 0), 0);
            return (
              <div key={c.id} style={{ borderTop: "1px solid var(--g-linea2)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{c.nombre} · {c.ruta}</strong><span className="small muted">{fmt(n)} personas</span>
                </div>
                <span className="small" style={{ color: "var(--g-suave)" }}>Entregable: {c.entregable}.</span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
