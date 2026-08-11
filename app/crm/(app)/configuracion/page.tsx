import { Badge, Card, Lectura, PageHeader, btnPrimario } from "@/components/crm/ui";
import { accionGuardarConfiguracion } from "@/lib/crm/acciones";
import { requireSession } from "@/lib/crm/auth.actions";
import { DESCRIPCION_UMBRALES, umbralesActuales } from "@/lib/crm/insights";
import { narradorDisponible } from "@/lib/crm/narrador";
import { DESCRIPCION_FACTORES, pesosActuales } from "@/lib/crm/scoring";
import { CLAVES, leerTodo } from "@/lib/crm/settings";
import { veTodo } from "@/lib/crm/session";
import { estadoCandados } from "@/lib/crm/whatsapp-dispatch";

export const dynamic = "force-dynamic";

export default async function Configuracion() {
  const sesion = await requireSession();
  const puedeEditar = veTodo(sesion);

  const [ajustes, pesos, umbrales, candados] = await Promise.all([
    leerTodo(),
    pesosActuales(),
    umbralesActuales(),
    estadoCandados(),
  ]);

  const sumaPesos =
    pesos.recencia + pesos.frecuencia + pesos.monto + pesos.engagement + pesos.potencial;

  return (
    <>
      <PageHeader
        titulo="Configuración"
        bajada="Todo lo que decide cómo se comporta el CRM se edita acá. Sin tocar código y sin depender de nadie."
      />

      <div className="mb-6">
        <Lectura
          titulo="Por qué esto está acá"
          resumen="Pesos, umbrales e interruptores viven en la base, no en el código"
        >
          <p>
            Un CRM que necesita un consultor para cambiar un umbral no es tuyo. Los pesos
            del puntaje, los umbrales de las alertas y los interruptores de WhatsApp viven
            en la base de datos, no en el código: cambiarlos surte efecto en la siguiente
            pantalla que abras.
          </p>
        </Lectura>
      </div>

      <form action={accionGuardarConfiguracion} className="space-y-5">
        <Card titulo="General">
          <label className="block max-w-md text-[13px]">
            <span className="mb-1 block font-medium text-[var(--crm-ink-2)]">
              Nombre de la empresa
            </span>
            <input
              name="empresa"
              defaultValue={ajustes[CLAVES.empresa] ?? ""}
              disabled={!puedeEditar}
              className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 outline-none focus:border-[var(--crm-brand)] disabled:bg-[#f4f5f7]"
            />
            <span className="mt-1 block text-[12px] text-[var(--crm-muted)]">
              Aparece en la barra lateral y reemplaza {"{{empresa}}"} en las plantillas de
              WhatsApp.
            </span>
          </label>
        </Card>

        <Card
          titulo="WhatsApp"
          descripcion="Los candados que deciden si un mensaje sale de verdad"
        >
          <div className="space-y-4 text-[13px]">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="waSimulado"
                defaultChecked={ajustes[CLAVES.waSimulado] === "true"}
                disabled={!puedeEditar}
                className="mt-1"
              />
              <span>
                <strong className="text-[14px]">Modo simulado</strong>
                <span className="block text-[var(--crm-ink-2)]">
                  Los mensajes se registran con estado «Simulado» y no tocan la red. Es el
                  modo correcto para demostrar el flujo completo sin escribirle a nadie.
                  Apagarlo hace que los envíos salgan de verdad por WaSender.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="waHabilitado"
                defaultChecked={ajustes[CLAVES.waHabilitado] === "true"}
                disabled={!puedeEditar}
                className="mt-1"
              />
              <span>
                <strong className="text-[14px]">Envío habilitado</strong>
                <span className="block text-[var(--crm-ink-2)]">
                  El corte general. Apagado, ningún mensaje sale —ni siquiera simulado— y
                  todos quedan retenidos con el motivo visible en el hilo. Es la forma de
                  frenar en seco sin apagar el sistema entero.
                </span>
              </span>
            </label>

            <div className="rounded-lg border border-[var(--crm-grid)] bg-[#f9f9f7] px-4 py-3">
              <div className="mb-1 font-medium">Lista blanca de destinatarios</div>
              <p className="text-[var(--crm-ink-2)]">
                Se configura con la variable de entorno{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-[12px]">
                  CRM_WHATSAPP_ALLOWLIST
                </code>{" "}
                (números separados por coma). Vive fuera de la interfaz a propósito: es el
                último candado antes de la red, y no debe poder abrirse con un clic.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {candados.autorizados === 0 ? (
                  <Badge tono="critico" icono="⛔">
                    Vacía — en modo real no saldría ningún mensaje
                  </Badge>
                ) : (
                  <>
                    <Badge tono="bueno" icono="✓">
                      {candados.autorizados} números autorizados
                    </Badge>
                    {candados.numeros.map((n) => (
                      <Badge key={n} tono="neutro">
                        +{n}
                      </Badge>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card
          titulo="Puntaje de potencial"
          descripcion={`Cuánto pesa cada factor. Suman ${sumaPesos} — no tienen que sumar 100, se normalizan.`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(pesos) as (keyof typeof pesos)[]).map((k) => (
              <label key={k} className="block text-[13px]">
                <span className="mb-1 flex items-baseline justify-between font-medium capitalize text-[var(--crm-ink-2)]">
                  {k}
                  <span className="crm-num text-[var(--crm-ink)]">{pesos[k]}</span>
                </span>
                <input
                  type="number"
                  name={`peso_${k}`}
                  defaultValue={pesos[k]}
                  min={0}
                  max={100}
                  disabled={!puedeEditar}
                  className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 disabled:bg-[#f4f5f7]"
                />
                <span className="mt-1 block text-[12px] text-[var(--crm-muted)]">
                  {DESCRIPCION_FACTORES[k]}
                </span>
              </label>
            ))}
          </div>
        </Card>

        <Card
          titulo="Umbrales de las alertas"
          descripcion="Cuándo el motor considera que algo amerita avisar"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(umbrales) as (keyof typeof umbrales)[]).map((k) => (
              <label key={k} className="block text-[13px]">
                <span className="mb-1 block font-medium text-[var(--crm-ink-2)]">
                  {DESCRIPCION_UMBRALES[k]}
                </span>
                <input
                  type="number"
                  name={`umbral_${k}`}
                  defaultValue={umbrales[k]}
                  min={0}
                  disabled={!puedeEditar}
                  className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 disabled:bg-[#f4f5f7]"
                />
              </label>
            ))}
          </div>
        </Card>

        <Card
          titulo="Asistente de redacción"
          descripcion="Quién escribe los párrafos de lectura de cada pantalla"
        >
          <label className="flex items-start gap-3 text-[13px]">
            <input
              type="checkbox"
              name="narradorIa"
              defaultChecked={ajustes[CLAVES.narradorIa] === "true"}
              disabled={!puedeEditar || !narradorDisponible()}
              className="mt-1"
            />
            <span>
              <strong className="text-[14px]">Redactar los resúmenes con IA</strong>
              <span className="block text-[var(--crm-ink-2)]">
                Las cifras siempre las calcula el CRM con reglas determinísticas; el modelo
                solo redacta el párrafo que las acompaña y tiene prohibido agregar números
                que no estén en el resumen. Si se apaga —o si el modelo falla— los textos
                se arman con plantillas sobre los mismos datos.
              </span>
              {!narradorDisponible() && (
                <span className="mt-1 block">
                  <Badge tono="alerta" icono="!">
                    Sin API key configurada (ZAI_API_KEY u OPENAI_API_KEY)
                  </Badge>
                </span>
              )}
            </span>
          </label>
        </Card>

        {puedeEditar ? (
          <button type="submit" className={btnPrimario}>
            Guardar configuración
          </button>
        ) : (
          <p className="text-[13px] text-[var(--crm-ink-2)]">
            Tu rol es de vendedor: puedes ver la configuración pero no cambiarla.
          </p>
        )}
      </form>
    </>
  );
}
