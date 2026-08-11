# CRM adoOps — `/crm`

CRM comercial para salir a vender. Vive dentro de la web corporativa (mismo
repo, mismo deploy, misma base de Neon) bajo la ruta `/crm`, detrás de login.

## Qué resuelve

Está construido contra una lista concreta de necesidades de mercado: no basta
con administrar contactos y automatizaciones, el CRM tiene que estar conectado
con ventas y la información tiene que servir para decidir.

| Módulo | Ruta | Qué resuelve |
|---|---|---|
| Visión general | `/crm` | El estado comercial con su lectura, no un muro de gráficos |
| Oportunidades | `/crm/oportunidades` | Tablero de pipeline, ficha con productos, stock y bitácora |
| Pipeline y KPIs | `/crm/pipeline` | La revisión: qué entró, la semana contra las ocho anteriores, y el mix |
| Cuentas y contactos | `/crm/cuentas` | Cartera + ficha 360 (compras, oportunidades, recorrido de marketing) |
| Productos e inventario | `/crm/productos` | Catálogo con disponibilidad real y qué negocios dependen de reponer |
| Alertas y acciones | `/crm/inteligencia` | Lo que el sistema detecta solo, cada cosa con su acción ejecutable |
| Segmentos y recompra | `/crm/segmentos` | Segmentos guardables, ventana de recompra por cuenta, cross-selling |
| Marketing y origen | `/crm/marketing` | Trazabilidad campaña → oportunidad → venta, con CAC y ROI |
| Reportes | `/crm/reportes` | Los números del trimestre con lectura de negocio, imprimibles |
| Conversaciones | `/crm/conversaciones` | Bandeja de 3 columnas · respuestas rápidas con `/` · candados de envío |
| Configuración | `/crm/configuracion` | Pesos, umbrales e interruptores editables sin tocar código |

## Arquitectura

```
proxy.ts                         Auth de /crm y /api/crm (Next 16 llama proxy al middleware)
app/crm/layout.tsx               Layout mínimo + tokens de color (crm.css)
app/crm/login/                   Pantalla de acceso · Server Action
app/crm/(app)/                   Todo lo demás, detrás de requireSession()
db/crm.ts                        Esquema Drizzle (18 tablas, prefijo crm_)
lib/crm/
  session.ts                     Cookie HMAC-SHA256 + contraseñas scrypt
  auth.actions.ts                login / logout / requireSession / requireGerencia
  acciones.ts                    TODAS las Server Actions del CRM
  etapas.ts                      El embudo y los canales, en un solo lugar
  cuentas.ts                     Cartera y ficha 360
  pipeline.ts                    Tablero, ficha de oportunidad, movimientos
  productos.ts                   Catálogo, disponibilidad, riesgo de stock, sustitutos
  marketing.ts                   Atribución, embudo, ROI por campaña
  scoring.ts                     Puntaje explicable con pesos editables
  insights.ts                    Motor de reglas → alertas con acción
  segmentos.ts                   Segmentos, recompra, cross-selling
  reportes.ts                    Indicadores del negocio
  narrador.ts                    Redacta los resúmenes (GLM/OpenAI) con respaldo por plantilla
  whatsapp.ts                    Bandeja, hilos, ficha lateral, plantillas, preparación masiva
  whatsapp-dispatch.ts           ÚNICO punto de salida · aplica los candados
  respuestas-rapidas.ts          Catálogo del `/` del hilo · los huecos [así] son a propósito
  panel-pipeline.ts              Las tres vistas de /crm/pipeline (periodo, KPIs, mix)
app/crm/(app)/@modal/            Rutas interceptoras: contacto y oportunidad en modal
components/crm/                  ui.tsx (primitivas, incluida Plegable), charts.tsx (SVG), Nav
                                 Modal.tsx (<dialog> nativo · cierra con router.back)
                                 HiloConversacion.tsx y FormularioContacto.tsx (bandeja de 3 columnas)
                                 CategoriaEnLinea.tsx (categoría editable en la tabla de pipeline)
scripts/crm-create-tables.mjs    Crea las tablas (idempotente, solo CREATE IF NOT EXISTS)
scripts/crm-migrar-bandeja.mjs   Agrega leido_en y destacada a crm_wa_conversations
scripts/crm-migrar-pipeline.mjs  Agrega categoria a crm_deals
scripts/crm-usuario.mjs          Crea o actualiza un usuario
scripts/crm-seed.mjs             Base de demostración (determinística)
app/api/crm/cron/alertas/        Recálculo de alertas por cron (Bearer CRON_SECRET)
```

## Puesta en marcha

```bash
node scripts/crm-create-tables.mjs
node scripts/crm-usuario.mjs joaquin <clave> admin "Joaquín Trujillo"
node scripts/crm-seed.mjs          # base de demostración (opcional)
```

Después entra a `/crm`, ve a **Alertas y acciones** y aprieta **Volver a
analizar** para que el motor corra por primera vez.

### Variables de entorno

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | La misma de la web. Las tablas del CRM llevan prefijo `crm_` |
| `CRM_SESSION_SECRET` | Firma de la cookie de sesión. Mínimo 32 caracteres (`openssl rand -hex 32`). **Sin esto el CRM devuelve 500 en vez de dejar entrar** |
| `ZAI_API_KEY` / `OPENAI_API_KEY` | Redacción de los resúmenes. Si falta, los textos salen por plantilla |
| `CRM_WHATSAPP_ALLOWLIST` | Números autorizados a recibir WhatsApp en modo real, separados por coma. Vacía = no sale nada |
| `WASENDER_API_KEY` | Solo si se apaga el modo simulado |
| `CRON_SECRET` | Protege el recálculo automático de alertas |

## Decisiones que conviene conocer antes de tocar el código

**Los montos son enteros en pesos.** No hay `numeric`: el CLP no tiene
decimales y `numeric` vuelve como string desde Drizzle, lo que obliga a parsear
en cada suma.

**Las subconsultas correlacionadas nombran su tabla en texto plano**
(`crm_accounts.id`, no `${crmAccounts.id}`). Drizzle solo califica la columna
con su tabla cuando la consulta tiene joins; sin joins escribe `"id"` a secas, y
dentro de la subconsulta ese `"id"` se resuelve contra la tabla de la
subconsulta. La consulta corre sin error y devuelve cifras equivocadas — pasó
durante el desarrollo y las 28 cuentas puntuaban idéntico.

**Las cifras las calculan reglas, no el modelo.** El narrador recibe un resumen
ya cerrado y solo lo redacta; tiene prohibido agregar números. Si el modelo no
está disponible, el texto sale de una plantilla sobre los mismos datos y la
pantalla dice cuál de las dos cosas ocurrió.

**La narración nunca bloquea la pantalla.** Medido en producción antes del
arreglo: la portada tardaba 7.157 / 14.413 / 6.398 ms en tres cargas seguidas,
mientras que las siete consultas a la base juntas tardaban 430 ms. El 95% del
tiempo era la llamada a GLM, además errática — y cada visita consumía un prompt
del plan para reescribir el mismo párrafo sobre las mismas cifras.

Dos defensas, y conviene no sacar ninguna:

1. **Caché por huella** (`crm_narraciones`): el texto se reusa mientras el hash
   de las cifras coincida y no pasen 24 h. Cambia un número, se vuelve a
   redactar. Un fallo del caché no rompe nada: como mucho se paga la llamada.
2. **`<Suspense>`**: la narración vive en `components/crm/LecturaNarrada.tsx`,
   fuera del cuerpo de la página, así el resto se pinta de inmediato.

Resultado en producción:

| | Página visible | Párrafo listo |
|---|---|---|
| Caché caliente | ~350 ms | ~400 ms |
| Caché frío (cifras nuevas) | 348 ms | 5.280 ms |

Si agregas una pantalla con narración, pásale una `clave` distinta a `narrar()`
y envuélvela en `<Suspense>`. Sin `clave` no se cachea y la pantalla vuelve a
pagar seis segundos por visita.

**Nada de WhatsApp sale sin cruzar cuatro candados**, y el orden importa:
aprobación humana → conversación sin BAJA → interruptor general → lista blanca.
El modo simulado corta antes de la red. `lib/crm/whatsapp-dispatch.ts` es el
único módulo que importa el cliente de WaSender: esa es la propiedad que hace
auditable la promesa.

**Un clic en una alerta no autoriza envíos.** "Preparar mensajes para N cuentas"
crea borradores; alguien tiene que leerlos y aprobarlos.

**El puntaje es explicable a propósito.** Cada score viene con sus cinco
factores, sus pesos y la evidencia de cada uno. Un número que sale de una caja
negra no cambia el comportamiento de un vendedor.

## La base de demostración

`scripts/crm-seed.mjs` simula **Andes Supply**, distribuidora B2B de
equipamiento y consumibles para gastronomía. Es determinística (semilla fija):
dos ejecuciones producen los mismos datos, así la demo se puede ensayar.

Trae 28 cuentas con arquetipos distintos (fieles, grandes, esporádicas,
atrasadas, perdidas, prospectos), 14 productos, 8 campañas con costo, ~115
órdenes históricas, 42 oportunidades, y cuatro conversaciones de WhatsApp
—incluida una donde el contacto escribió BAJA, para poder mostrar el candado
funcionando.

Casos plantados a propósito, porque sin ellos no hay nada que demostrar:
- un refrigerador con 2 unidades comprometido en varias oportunidades
- oportunidades sin actividad por semanas
- cuentas que pasaron su ventana de recompra
- una campaña con retorno negativo

`node scripts/crm-seed.mjs --limpiar` borra los datos de demostración sin tocar
usuarios ni configuración.
