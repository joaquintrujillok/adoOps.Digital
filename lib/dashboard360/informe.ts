// Redacción del informe al directorio.
//
// **Por qué esto no llama a un modelo.**
//
// El informe se genera con reglas sobre los datos, no con un LLM. Tres razones,
// en orden de peso:
//
// 1. En una reunión de venta, una llamada de red que se demora o falla arruina
//    la demostración. Esto responde en milisegundos y no depende de nadie.
// 2. Un modelo que redacta sobre cifras puede equivocarse en una cifra. En un
//    documento que va al directorio, ese error cuesta la cuenta.
// 3. Las conclusiones acá son deterministas de verdad: «la inversión subió 12%
//    y los leads bajaron 4%, por lo tanto el costo por lead empeoró» no
//    requiere inteligencia, requiere aritmética y un buen párrafo.
//
// Dónde sí entra un modelo, más adelante: en pulir el tono y en redactar el
// apartado de contexto cualitativo que hoy queda como plantilla. La variable
// D360_NARRADOR_MODEL está reservada para eso. Lo que nunca debería hacer un
// modelo acá es calcular.

import {
  clp,
  costoPorLead,
  ctr,
  num,
  pct,
  porCampania,
  porFuente,
  rangoPrevio,
  reconciliacion,
  resumen,
  variacion,
  type Rango,
} from "./metricas";

/** Redondea el juicio: bajo 0,5% no hay noticia que contar. */
function tendencia(v: number | null, invertido = false): "mejor" | "peor" | "plano" | "sin base" {
  if (v === null) return "sin base";
  if (Math.abs(v) < 0.5) return "plano";
  const sube = v > 0;
  return (invertido ? !sube : sube) ? "mejor" : "peor";
}

function signo(v: number | null): string {
  if (v === null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export interface InformeGenerado {
  titulo: string;
  cuerpoMd: string;
}

export async function componerInforme(rango: Rango): Promise<InformeGenerado> {
  const previo = rangoPrevio(rango);

  const [actual, anterior, fuentes, campanias, recon] = await Promise.all([
    resumen(rango),
    resumen(previo),
    porFuente(rango),
    porCampania(rango, 50),
    reconciliacion(rango),
  ]);

  const vInversion = variacion(actual.inversionClp, anterior.inversionClp);
  const vLeads = variacion(actual.leadsReales, anterior.leadsReales);
  const cplA = costoPorLead(actual);
  const cplP = costoPorLead(anterior);
  const vCpl = cplA !== null && cplP !== null ? variacion(cplA, cplP) : null;
  const vCtr = variacion(ctr(actual), ctr(anterior));

  const ads = fuentes.filter((f) => f.tipo === "ads" && f.inversionClp > 0);
  const conCpl = ads
    .filter((f) => f.leadsPlataforma > 0)
    .map((f) => ({ ...f, cpl: f.inversionClp / f.leadsPlataforma }))
    .sort((a, b) => a.cpl - b.cpl);

  const mejorCanal = conCpl[0];
  const peorCanal = conCpl.length > 1 ? conCpl[conCpl.length - 1] : undefined;

  // Campañas que consumieron presupuesto sin devolver un solo lead. Es el
  // hallazgo que más veces justifica la reunión.
  const sinRetorno = campanias
    .filter((c) => c.inversionClp > 0 && c.leads === 0)
    .sort((a, b) => b.inversionClp - a.inversionClp)
    .slice(0, 5);
  const gastoSinRetorno = sinRetorno.reduce((s, c) => s + c.inversionClp, 0);

  // ── Titular ────────────────────────────────────────────────────────────────

  const tCpl = tendencia(vCpl, true);
  const titular =
    tCpl === "mejor"
      ? `El período cierra mejor: se consiguieron ${num(actual.leadsReales)} leads a ${cplA ? clp(cplA) : "—"} cada uno, ${signo(vCpl)} respecto del período anterior.`
      : tCpl === "peor"
        ? `El período cierra peor en eficiencia: el costo por lead subió ${signo(vCpl)} hasta ${cplA ? clp(cplA) : "—"}, con ${num(actual.leadsReales)} leads conseguidos.`
        : `El período cierra estable: ${num(actual.leadsReales)} leads a ${cplA ? clp(cplA) : "—"} cada uno, sin variación relevante en eficiencia.`;

  // ── Cuerpo ─────────────────────────────────────────────────────────────────

  const partes: string[] = [];

  partes.push(`## Lo esencial

${titular}

- **Inversión:** ${clp(actual.inversionClp)} (${signo(vInversion)})
- **Leads reales:** ${num(actual.leadsReales)} (${signo(vLeads)})
- **Costo por lead:** ${cplA ? clp(cplA) : "—"} (${signo(vCpl)})
- **CTR:** ${pct(ctr(actual))} (${signo(vCtr)})

Período analizado: ${rango.desde} al ${rango.hasta}. Comparación contra ${previo.desde} al ${previo.hasta}.`);

  // ── Lectura del resultado ──────────────────────────────────────────────────

  const tInv = tendencia(vInversion);
  const tLeads = tendencia(vLeads);

  let lectura: string;
  if (tInv === "mejor" && tLeads === "peor") {
    lectura = `Se invirtió más y se consiguió menos. Es el escenario que hay que corregir primero: el presupuesto adicional no está comprando resultado, y sostenerlo un período más multiplica la pérdida.`;
  } else if (tInv === "peor" && tLeads === "mejor") {
    lectura = `Se invirtió menos y se consiguió más. La eficiencia mejoró por mérito propio, no por presupuesto, que es la clase de mejora que se sostiene.`;
  } else if (tInv === "mejor" && tLeads === "mejor") {
    lectura = `Subieron inversión y resultado a la vez. La pregunta relevante no es si funcionó, sino si el resultado creció más rápido que el gasto: el costo por lead ${tCpl === "mejor" ? "mejoró, así que sí" : tCpl === "peor" ? "empeoró, así que el crecimiento salió caro" : "quedó plano, así que se compró volumen a la misma eficiencia"}.`;
  } else if (tInv === "peor" && tLeads === "peor") {
    lectura = `Bajaron inversión y resultado. Antes de leerlo como un problema conviene confirmar si la baja de presupuesto fue una decisión propia; si lo fue, lo que importa es el costo por lead, que ${tCpl === "mejor" ? "mejoró" : tCpl === "peor" ? "empeoró" : "se mantuvo"}.`;
  } else {
    lectura = `El período no muestra movimientos relevantes respecto del anterior. Con la operación estable, el foco pasa a las campañas individuales más que al total.`;
  }

  partes.push(`## Cómo leer el resultado

${lectura}`);

  // ── Canales ────────────────────────────────────────────────────────────────

  if (mejorCanal) {
    const lineas = [
      `**${mejorCanal.nombre}** es el canal más eficiente del período: ${clp(mejorCanal.cpl)} por lead sobre ${clp(mejorCanal.inversionClp)} invertidos.`,
    ];
    if (peorCanal && peorCanal.slug !== mejorCanal.slug) {
      const veces = peorCanal.cpl / mejorCanal.cpl;
      lineas.push(
        `**${peorCanal.nombre}** es el más caro: ${clp(peorCanal.cpl)} por lead, ${veces.toFixed(1)} veces el de ${mejorCanal.nombre}.`,
      );
      if (veces >= 2) {
        lineas.push(
          `Una brecha de esa magnitud rara vez se explica sola por la plataforma. Antes de mover presupuesto conviene verificar que ambos canales estén midiendo el mismo evento como lead.`,
        );
      }
    }
    partes.push(`## Canales\n\n${lineas.join("\n\n")}`);
  }

  // ── Hallazgo accionable ────────────────────────────────────────────────────

  if (sinRetorno.length) {
    const detalle = sinRetorno
      .map((c) => `- ${c.campania} — ${clp(c.inversionClp)}`)
      .join("\n");
    partes.push(`## Presupuesto sin retorno

${sinRetorno.length} ${sinRetorno.length === 1 ? "campaña consumió" : "campañas consumieron"} ${clp(gastoSinRetorno)} sin generar un solo lead en el período.

${detalle}

Equivale al ${pct((gastoSinRetorno / (actual.inversionClp || 1)) * 100, 1)} de la inversión total. Es la primera decisión que este informe pone sobre la mesa: pausar, corregir la medición, o aceptar que son campañas de marca y sacarlas del cálculo de costo por lead.`);
  }

  // ── Cuadratura ─────────────────────────────────────────────────────────────

  partes.push(`## Nota metodológica sobre el conteo de leads

Las plataformas reportan **${num(recon.segunPlataformas)}** leads en conjunto. Tras deduplicar por persona quedan **${num(recon.personasUnicas)}**: la diferencia de ${num(recon.sobreconteo)} son contactos que más de un canal se atribuye.

De esas personas, **${num(recon.enCrm)}** están cargadas en el CRM. Las ${num(recon.faltanEnCrm)} restantes son un pendiente comercial, no un error de medición.

Todos los costos por lead de este informe se calculan sobre personas distintas.`);

  // ── Qué falta ──────────────────────────────────────────────────────────────

  partes.push(`## Qué no responde este informe

Los datos disponibles cubren inversión, alcance y generación de leads. No cubren qué pasó con esos leads después: cuántos se convirtieron en oportunidad, cuántos cerraron y por cuánto. Sin ese tramo, «costo por lead» es lo más lejos que se puede llegar, y no alcanza para decidir dónde crecer.

Cerrar ese circuito requiere conectar las etapas del CRM al tablero.`);

  const titulo = `Informe de rendimiento · ${rango.desde} al ${rango.hasta}`;

  return { titulo, cuerpoMd: partes.join("\n\n") };
}
