// La base de conocimiento del copiloto: qué material tiene cargado cada cuenta.
//
// ── Por qué se recupera y no se inyecta entera ───────────────────────────────
//
// Se midió antes de decidir. Las bases reales son de ~50.000 tokens cada una, y
// el copiloto razona cada 20 segundos: mandarla completa costaría más que la
// transcripción y daría peores respuestas, porque enterraría la conversación
// bajo cincuenta mil tokens de catálogo. Con búsqueda se mandan tres secciones y
// las instrucciones, unos 4.300 tokens.
//
// ── Por qué es por cuenta ────────────────────────────────────────────────────
//
// Lo que ofrece adoOps no tiene nada que ver con lo que se conversa en Soho. Una
// sola base sirviendo a las dos le daría al copiloto vocabulario de un mundo
// para preguntar en el otro — y fue justamente lo que hizo evidente que hacían
// falta cuentas.

import { Card, PageHeader, Tabla, Vacio } from "@/components/dashboard360/ui";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import { CUENTAS, resolverCuenta } from "@/lib/cuentas";
import { resumen } from "@/lib/conocimiento";
import Subir from "./Subir";

export const dynamic = "force-dynamic";

export default async function ConocimientoPage() {
  const sesion = await requireSession();
  const activa = resolverCuenta(sesion.cuenta, sesion.cuentas);

  const permitidas =
    sesion.cuentas && sesion.cuentas.length > 0
      ? CUENTAS.filter((c) => sesion.cuentas!.includes(c.id))
      : CUENTAS;

  // Se muestra el estado de TODAS las cuentas a las que se tiene acceso, no solo
  // la activa: la pregunta que se hace acá es "¿está cargado todo?", y para eso
  // hay que ver el conjunto.
  const resumenes = await Promise.all(permitidas.map((c) => resumen(c.id)));

  return (
    <>
      <PageHeader
        titulo="Base de conocimiento"
        bajada="Lo que el copiloto sabe de lo que ofreces. Se consulta por búsqueda, no se manda entera."
      />

      <Card titulo="Cargar un documento" descripcion="Markdown con encabezados ## y ###">
        <Subir cuentas={permitidas} activa={activa} />
        <p className="mt-4 border-t border-[var(--d360-border)] pt-3 text-[12.5px] leading-relaxed text-[var(--d360-ink-2)]">
          {/* Estas dos reglas no son detalles de formato: son las que deciden si
              la base sirve. Van en la pantalla y no solo en la documentación
              porque quien sube el archivo es quien las tiene que cumplir. */}
          El documento se corta por sus encabezados, así que cada sección{" "}
          <code className="text-[12px]">###</code> tiene que poder leerse sola —
          es lo que el copiloto va a recibir cuando esa sección sea la
          pertinente. Y una sección numerada <strong>0</strong> se trata como
          instrucciones al agente: viaja en todas las pasadas sin pasar por la
          búsqueda.
        </p>
        <p className="mt-2 text-[12.5px] text-[var(--d360-muted)]">
          Volver a subir el mismo archivo lo reemplaza, no lo duplica.
        </p>
      </Card>

      <Card className="mt-6" titulo="Cargado" descripcion="Por cuenta y por archivo">
        {resumenes.every((r) => r.total === 0) ? (
          <Vacio
            mensaje="Ninguna cuenta tiene base todavía"
            sugerencia="Sin base, el copiloto sigue funcionando: solo que sus preguntas no van a apuntar a lo que ofreces."
          />
        ) : (
          <div className="space-y-5">
            {resumenes.map((r, i) => {
              const cuenta = permitidas[i];
              return (
                <div key={r.cuenta}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: cuenta.color }}
                    />
                    <h3 className="text-[13px] font-semibold text-[var(--d360-ink)]">
                      {cuenta.nombre}
                    </h3>
                    <span className="d360-num text-[11.5px] text-[var(--d360-muted)]">
                      {r.total === 0
                        ? "sin base"
                        : `${r.total} ${r.total === 1 ? "trozo" : "trozos"}`}
                    </span>
                  </div>

                  {r.origenes.length === 0 ? (
                    <p className="pl-4 text-[12.5px] text-[var(--d360-muted)]">
                      Nada cargado.
                    </p>
                  ) : (
                    <Tabla>
                      <thead>
                        <tr>
                          <th>Archivo</th>
                          <th>Trozos</th>
                          <th>Siempre</th>
                          <th>Tokens</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.origenes.map((o) => (
                          <tr key={o.origen}>
                            <td className="text-[var(--d360-ink)]">{o.origen}</td>
                            <td className="d360-num">{o.trozos}</td>
                            <td className="d360-num">
                              {/* Cero acá es un aviso: significa que el documento
                                  no trae sección 0, o sea que el copiloto va a
                                  operar sin instrucciones propias. */}
                              <span
                                className={
                                  o.siempre === 0 ? "text-[#8a6d1f]" : undefined
                                }
                              >
                                {o.siempre}
                              </span>
                            </td>
                            <td className="d360-num">
                              {o.tokens.toLocaleString("es-CL")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Tabla>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
