import Flujo from "@/components/gia/Flujo";

export default function PaginaFlujo() {
  return (
    <>
      <header>
        <div className="small muted">Etapa 1 · Lo que las entrevistas dicen de la organización, no solo de cada persona</div>
        <h1>Flujo entre unidades</h1>
        <p style={{ margin: "8px 0 0", maxWidth: 760, color: "var(--g-suave)" }}>
          Cada entrevista cuenta qué recibe una persona, qué hace con eso y a quién se lo pasa. Juntas muestran cómo se mueve el trabajo entre áreas, dónde se hace a mano y qué tareas se repiten en unidades que no se hablan.
        </p>
      </header>
      <Flujo />
    </>
  );
}
