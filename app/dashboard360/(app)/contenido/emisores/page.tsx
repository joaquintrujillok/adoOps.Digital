// Perfiles conectados: quién puede publicar hoy y a quién se le está venciendo.
//
// Va en el grupo "Datos" y responde una sola pregunta: ¿va a salir lo que está
// programado? Con varios emisores, la respuesta no depende de la cola sino de
// varios tokens con vencimientos distintos.
//
// ── Por qué la columna que manda es una fecha ────────────────────────────────
//
// El resto de esta pantalla es contexto. Lo único que puede romper el programa
// en silencio es un token vencido: LinkedIn los emite a 60 días y no hay refresh
// programático fuera del programa de partners. Un perfil vencido no da error en
// ninguna pantalla — simplemente deja de publicar.
//
// Por eso las filas vienen ordenadas por vencimiento y no por nombre: lo que
// urge queda arriba sin que nadie tenga que buscarlo.

import {
  Badge,
  Card,
  PageHeader,
  Vacio,
  btnPrimario,
  btnSecundario,
} from "@/components/dashboard360/ui";
import { panelEmisores } from "@/lib/dashboard360/contenido";
import { MARGEN_AVISO_DIAS } from "@/lib/contenido/emisores";
import {
  crearEmisorAction,
  desconectarEmisorAction,
  pausarEmisorAction,
} from "@/lib/contenido/emisores.actions";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import { puedePublicar } from "@/lib/dashboard360/session";

export const dynamic = "force-dynamic";

const FMT = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short" });

// El callback vuelve con ?li=<estado>. Se traduce acá y no en la ruta para que
// el mensaje viva junto a la pantalla que lo muestra.
const AVISOS: Record<string, { texto: string; tono: "ok" | "err" }> = {
  ok: { texto: "Perfil conectado.", tono: "ok" },
  cancelado: { texto: "La persona canceló en la pantalla de permisos.", tono: "err" },
  "estado-invalido": {
    texto: "La respuesta no corresponde a esta sesión. Vuelve a intentarlo desde acá.",
    tono: "err",
  },
  "no-autorizado": { texto: "Conectar un perfil requiere permisos de gerencia.", tono: "err" },
  "emisor-inexistente": { texto: "Ese emisor ya no existe.", tono: "err" },
  error: { texto: "LinkedIn rechazó el canje. Revisa el client id y la redirect URL.", tono: "err" },
};

export default async function EmisoresContenido({
  searchParams,
}: {
  searchParams: Promise<{ li?: string }>;
}) {
  const sesion = await requireSession();
  const conecta = puedePublicar(sesion);
  const { li } = await searchParams;
  const aviso = li ? AVISOS[li] : undefined;
  const { disponible, emisores, problemas } = await panelEmisores();

  return (
    <>
      <PageHeader
        titulo="Perfiles conectados"
        bajada="Quién puede publicar hoy. Un token vencido no da error: el perfil deja de publicar y nadie se entera."
      />

      {aviso ? (
        <div
          className={`mb-4 rounded-lg border p-3 text-[13px] ${
            aviso.tono === "ok"
              ? "border-[#b7dfc4] bg-[#eefaf1] text-[#1c6b39]"
              : "border-[#f0c2c2] bg-[#fdf1f1] text-[#8f2c2c]"
          }`}
        >
          {aviso.texto}
        </div>
      ) : null}

      <Card
        titulo="Emisores"
        descripcion={
          emisores.length === 0
            ? "Ninguno todavía"
            : problemas > 0
              ? `${problemas} de ${emisores.length} necesitan que alguien haga algo`
              : `${emisores.length} conectados y al día`
        }
      >
        {!disponible ? (
          <Vacio
            mensaje="La máquina de contenido no está desplegada acá"
            sugerencia="Faltan las tablas contenido_*. Corre node scripts/contenido-setup.mjs."
          />
        ) : emisores.length === 0 ? (
          <Vacio
            mensaje="No hay perfiles conectados"
            sugerencia="Agrega uno abajo. Cada persona autoriza por separado: el permiso para publicar es por miembro, no por empresa."
          />
        ) : (
          <div className="space-y-3">
            {emisores.map((e) => (
              <div key={e.id} className="rounded-lg border border-[var(--d360-border)] p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[14px] font-semibold text-[var(--d360-ink)]">
                      {e.nombre}
                      {e.rol ? (
                        <span className="ml-2 text-[11.5px] font-normal text-[var(--d360-muted)]">
                          {e.rol}
                        </span>
                      ) : null}
                    </div>
                    <div className="d360-num text-[11.5px] text-[var(--d360-muted)]">
                      {e.tipo === "organizacion" ? "página" : "perfil"}
                      {e.diasRestantes !== null
                        ? ` · ${
                            e.diasRestantes > 0
                              ? `token vence en ${e.diasRestantes} ${e.diasRestantes === 1 ? "día" : "días"}`
                              : "token vencido"
                          }`
                        : " · sin token"}
                    </div>
                  </div>
                  <Badge
                    tono={e.tono === "risk" ? "critico" : e.tono === "warn" ? "alerta" : "bueno"}
                  >
                    {e.estado}
                  </Badge>
                </div>

                {e.sugerencia ? (
                  <p className="mb-2 text-[12.5px] text-[var(--d360-ink-2)]">{e.sugerencia}</p>
                ) : null}

                <div className="d360-num mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[11.5px] text-[var(--d360-muted)]">
                  <span>
                    Última:{" "}
                    {e.ultimaPublicacion
                      ? `${e.ultimaPublicacion.titulo} · ${FMT.format(e.ultimaPublicacion.en)}`
                      : "nunca publicó"}
                  </span>
                  <span>
                    Próxima:{" "}
                    {e.proximaPieza
                      ? `${e.proximaPieza.titulo}${e.proximaPieza.fecha ? ` · ${e.proximaPieza.fecha}` : ""}`
                      : "nada asignado"}
                  </span>
                </div>

                {conecta ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Un enlace y no un form: el OAuth es una navegación del
                        navegador hacia LinkedIn, no un envío de datos. */}
                    <a className={btnPrimario} href={`/api/linkedin/conectar?emisor=${e.id}`}>
                      {e.estado === "sin conectar" ? "Conectar" : "Reautorizar"}
                    </a>
                    <form action={pausarEmisorAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <button className={btnSecundario} type="submit">
                        {e.estado === "pausado" ? "Reanudar" : "Pausar"}
                      </button>
                    </form>
                    {e.estado !== "sin conectar" ? (
                      <form action={desconectarEmisorAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <button className={btnSecundario} type="submit">
                          Desconectar
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      {conecta && disponible ? (
        <Card
          className="mt-6"
          titulo="Agregar un emisor"
          descripcion="Primero se da de alta la fila, después esa persona autoriza"
        >
          <form action={crearEmisorAction} className="flex flex-wrap items-end gap-3">
            <label className="text-[12px] text-[var(--d360-ink-2)]">
              <span className="mb-1 block">Nombre</span>
              <input
                name="nombre"
                required
                className="w-56 rounded-md border border-[var(--d360-border)] px-3 py-2 text-[13px]"
                placeholder="Nombre de la persona"
              />
            </label>
            <label className="text-[12px] text-[var(--d360-ink-2)]">
              <span className="mb-1 block">Rol editorial</span>
              <input
                name="rol"
                className="w-56 rounded-md border border-[var(--d360-border)] px-3 py-2 text-[13px]"
                placeholder="E1 · socio legal"
              />
            </label>
            <label className="text-[12px] text-[var(--d360-ink-2)]">
              <span className="mb-1 block">Tipo</span>
              <select
                name="tipo"
                className="rounded-md border border-[var(--d360-border)] px-3 py-2 text-[13px]"
              >
                <option value="persona">Perfil de persona</option>
                <option value="organizacion">Página de empresa</option>
              </select>
            </label>
            <button className={btnPrimario} type="submit">
              Agregar
            </button>
          </form>
        </Card>
      ) : null}

      <Card
        className="mt-6"
        titulo="Por qué se avisa con anticipación"
        descripcion={`Un emisor pasa a "por vencer" ${MARGEN_AVISO_DIAS} días antes`}
      >
        <p className="text-[13px] leading-relaxed text-[var(--d360-ink-2)]">
          LinkedIn emite los tokens a 60 días y los refresh programáticos están
          limitados a partners aprobados, así que ninguna tarea programada los
          renueva sola: hay que pedirle a una persona que vuelva a autorizar.
          Avisar el día 60 no alcanza — coordinar a alguien real no pasa en 24
          horas. Es el mismo criterio del freno automático del motor: cuando una
          persona lee la alerta, la publicación ya no salió.
        </p>
      </Card>
    </>
  );
}
