"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitLead, type LeadFormState } from "@/lib/actions";

const INITIAL: LeadFormState = { status: "idle" };

/**
 * El mismo formulario de contacto de la portada (misma server action, mismas
 * columnas en `leads`), con el marcado del rediseño. Si cambia la acción,
 * cambia en los dos formularios a la vez.
 */
export default function ContactFormV2() {
  const [state, action, pending] = useActionState(submitLead, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  if (state.status === "success") {
    return (
      <div className="form-ok" role="status">
        <span className="eyebrow">Solicitud recibida</span>
        <h3 className="display h-md">Gracias por su interés.</h3>
        <p className="lede">Un especialista de adoOps se comunicará en menos de 24 horas hábiles.</p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="form" id="leadForm">
      <div className="field"><label htmlFor="v2-nombre">Nombre *</label><input id="v2-nombre" name="nombre" type="text" placeholder="Nombre completo" required /></div>
      <div className="field"><label htmlFor="v2-email">Email corporativo *</label><input id="v2-email" name="email" type="email" placeholder="nombre@empresa.cl" required /></div>
      <div className="field"><label htmlFor="v2-empresa">Empresa *</label><input id="v2-empresa" name="empresa" type="text" placeholder="Nombre de la empresa" required /></div>
      <div className="field"><label htmlFor="v2-rol">Rol</label><input id="v2-rol" name="rol" type="text" placeholder="Cargo" /></div>
      <div className="field full"><label htmlFor="v2-tipo">Tipo de solicitud</label><select id="v2-tipo" name="tipo" defaultValue="Assessment"><option>Assessment</option><option>Diagnóstico</option></select></div>
      <div className="field full"><label htmlFor="v2-mensaje">Mensaje</label><textarea id="v2-mensaje" name="mensaje" placeholder="Describa brevemente su contexto y objetivos" /></div>
      {state.status === "error" && <p className="form-error full" role="alert">{state.message}</p>}
      <div className="full"><button className="btn btn-primary arrow" type="submit" disabled={pending} style={{ width: "100%", justifyContent: "center" }}>{pending ? "Enviando…" : "Solicitar Assessment"}</button></div>
    </form>
  );
}
