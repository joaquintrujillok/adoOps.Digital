import OpcionesGemini from "@/components/gia/OpcionesGemini";

export default function Gemini() {
  return (
    <>
      <header>
        <div className="small muted">Gemini ya está pagado: adoptarlo bien es el primer valor. Los agentes entran donde Gemini no llega.</div>
        <h1>Gemini y agentes: caso de negocio</h1>
      </header>
      <OpcionesGemini />
      <p className="small muted" style={{ margin: 0 }}>
        Valores de la empresa demo. Valor anual = horas cubiertas × costo hora promedio; costo = formación, licencias adicionales, construcción y operación de agentes.
      </p>
    </>
  );
}
