# Sistema propio de adquisición de leads vía LinkedIn
## Estudio de factibilidad

**Preparado por adoOps** · agosto de 2026
**Alcance:** adquisición, levantamiento de prospectos, nurturing y capa de InMail · mercado Chile / LatAm hispano
**Decisión que este documento habilita:** go / no-go, y sobre qué exactamente

---

## Veredicto en una página

**Es factible construirlo. No es factible construir lo que las referencias sugieren.**

Las tres referencias que trajiste —CoPilot AI, Apollo, Prozer— y el video de Clay describen un producto que, al mirarlo por dentro, resulta ser tres cosas distintas pegadas con cinta: una base de datos gringa, un motor de secuencias, y una capa de automatización de LinkedIn que **ningún proveedor del mercado tiene autorizada**. El video, además, propone armar todo eso sobre Clay, que es la peor herramienta posible para Chile por una razón económica concreta que explico más abajo.

Tres hallazgos ordenan la decisión:

**1. No existe ninguna API oficial de LinkedIn que permita prospección fría dirigida.** Ni conexiones, ni mensajes 1:1, ni InMail nominal, ni búsqueda de personas. El programa de Sales Navigator (SNAP) está cerrado a nuevos partners con texto explícito. Las Communication APIs existen pero están restringidas a partners aprobados y su documentación **prohíbe expresamente los eventos automatizados o programados**. Toda la industria —CoPilot AI incluido— opera fuera de los términos de servicio. No es una zona gris: es el artículo 8.2 del User Agreement, y LinkedIn ganó o liquidó a su favor cuatro juicios en cuatro años, en dos de ellos demandando a los fundadores como personas naturales.

**2. Ese riesgo tiene dos precios completamente distintos según a quién se lo vendas.** Para uso interno, el riesgo máximo es perder una cuenta de LinkedIn. Es un costo de operación. Para un SaaS multi-tenant, adOps pasa a ser *"quien desarrolla, soporta o provee software"* para violar el 8.2 —el sujeto exacto de la cláusula— y hereda el precedente Proxycurl: demanda, acuerdo, destrucción de datos, obligación de notificar a los propios clientes, y cierre. En marzo de 2026 LinkedIn eliminó la página corporativa de HeyReach y baneó los perfiles personales de su CEO, CTO, CRO y CMO. **Interno y SaaS no son dos fases del mismo proyecto: son dos proyectos con perfiles de riesgo separados por un orden de magnitud.**

**3. Y sin embargo hay un foso real, y no está donde lo buscabas.** Chile publica gratis, con API y en formato abierto, lo que ZoomInfo cobra USD 32.000 al año y aun así no tiene: la nómina completa de personas jurídicas del SII —con tramo de ventas, número de trabajadores, rubro y región— y el histórico OCDS de Mercado Público, 4,9 millones de licitaciones y 5 millones de proveedores bajo licencia CC0. Ninguno de los trece competidores que revisamos integra una sola fuente chilena. Ninguno menciona la Ley 21.719. **La ventaja competitiva de adOps en este mercado no es automatizar LinkedIn mejor que HeyReach —eso es imposible y es un commodity de USD 79— sino saber, antes que nadie, qué empresa chilena acaba de ganar una licitación, cuánto factura y quién la constituyó el mes pasado.**

**Recomendación: GO condicionado**, a un producto reformulado —motor de señales de compra chilenas con LinkedIn como *un* canal, no como el producto—, con uso interno primero, y con una fase 0 de validación de dos semanas y ~USD 200 que puede matar el proyecto barato antes de escribir una línea del motor.

---

## El hallazgo que hay que nombrar antes de empezar

El proyecto, tal como está planteado, tiene un supuesto silencioso: que existe una forma legítima de conectarse a LinkedIn y enviar mensajes. No existe.

Esto es lo que hay, verificado contra la documentación oficial de Microsoft/LinkedIn:

| Acción | ¿API oficial? | Detalle |
|---|---|---|
| Enviar solicitud de conexión | ⚠️ Solo partners aprobados | `/v2/invitations` existe, pero el programa no está en el catálogo público |
| Enviar mensaje 1:1 | ⚠️ Solo partners, **solo a contactos de 1er grado**, y con acción humana explícita | La doc dice literalmente: *"Member actions do not include an automated or scheduled event"* |
| **Enviar InMail a un perfil concreto** | ❌ **No existe endpoint programático** | Solo vía módulo de UI de SNAP (un iframe que renderiza LinkedIn, con una persona haciendo clic) — y SNAP está cerrado |
| Entregar un InMail publicitario a un **segmento** | ⚠️ Sí, pero no es 1:1 | **Message Ads**: `POST /rest/inMailContents/` en la Marketing API. Requiere cuenta de ads y permiso `rw_ads`. Se entrega en la bandeja de InMail, pero por audiencia, con revisión de creativos y CTA "Not Interested" obligatorio. **No sirve para escribirle a una persona identificada** |
| Leer bandeja de entrada | ❌ | Solo Compliance API, cuyo acceso *"is closed and may not be requested"* |
| Buscar personas | ❌ | No existe endpoint de people search |
| Leer un perfil arbitrario | ❌ | Solo el del usuario autenticado |
| Leer leads de Lead Gen Forms | ✅ | **Lead Sync API** — pero es inbound: gente que ya llenó un formulario tuyo |
| Mensaje patrocinado a un desconocido | ✅ (pagado) | **Conversation Ads API** — y está deshabilitado en la UE desde enero de 2022 |

La cita textual de la documentación de Sales Navigator: *"We are not currently accepting new partners for access to the LinkedIn Sales Navigator API."*

Entonces, ¿cómo funciona CoPilot AI? Igual que todos: **obtienen la cookie de sesión `li_at` del usuario y llaman a Voyager**, la API interna que usa la propia web de LinkedIn, por ingeniería inversa. Unipile —el proveedor más serio de esta capa— lo dice sin decirlo: *"la adherencia a los términos de uso de los proveedores es esencial. Las violaciones pueden resultar en la suspensión o baneo de tu cuenta."* Traducción: el riesgo es enteramente tuyo.

Esto no significa que el proyecto sea inviable. Significa que **la capa de LinkedIn no puede ser el producto**, porque es la parte que no controlas, no puedes garantizar, y que un competidor de USD 79 al mes ya resolvió.

### Sobre la capa de InMail, específicamente

Preguntaste por InMail. Vale la pena el detalle porque hay una palanca que casi nadie usa:

| Vía | Volumen | Costo |
|---|---|---|
| **Créditos InMail** (Sales Navigator, cualquier plan) | **50/mes**, acumulables hasta 150 | **Core $99,99/mes** ($79,99 anual). **Advanced $179,99 trae los mismos 50** — subir de plan no da más InMails |
| Premium Business | 15/mes, acumulables hasta 45 | — |
| **InMail a "Open Profile"** | **Hasta ~800/mes por cuenta** según la documentación de Unipile | **Gratis** — no consume crédito |
| Miembros de tus Grupos y asistentes a tus Eventos | Sin límite de crédito | Gratis |

Dos cosas que conviene saber: los créditos se **recuperan si el destinatario responde dentro de 90 días** (incluso una respuesta automática cuenta), y **se pierden si no responde**. Cancelar Premium pone el saldo a cero de inmediato.

**La palanca real es Open Profile.** Cualquier miembro Premium puede activarlo, y entonces cualquiera —incluso una cuenta gratuita— puede mensajearle sin gastar crédito. Filtrar el ICP por "Open Profile" convierte un recurso de 50 mensajes al mes en uno de cientos. Es la diferencia entre un canal de nicho y un canal operativo, y es un criterio de segmentación que ninguna de las referencias explota.

⚠️ *El techo de ~800 InMails abiertos al mes lo documenta Unipile, no LinkedIn. Verificar en el trial antes de modelar volumen sobre esa cifra.*

---

## Qué hacen realmente tus referencias

Las revisamos una por una. El resultado reordena el mapa competitivo.

| Producto | Qué es en realidad | Capa técnica | Entrada USD/mes | Chile |
|---|---|---|---|---|
| **CoPilot AI** (`copilotai.com`, el `.co` redirige) | Outbound LinkedIn con tres agentes IA | **No divulgada.** Exige Sales Navigator aparte | $199 anual **+ $99 SN = ~$298 real** | No declarado |
| **Apollo.io** | Base de datos + secuencias de email. **Su extensión de LinkedIn no ejecuta** | SaaS + extensión Chrome | $0 / $49 | Sin cifras públicas |
| **Prozer** | **Email puro. No usa LinkedIn en absoluto** | SaaS de email con BD propia | $49 | **Nativo LatAm/Chile** |
| HeyReach | LinkedIn multi-cuenta para agencias | Cloud | $79/sender | — |
| Clay | Orquestador sobre 150+ proveedores de datos | Tablas + créditos | $167 (Launch mensual) | — |

Tres correcciones que importan:

**Apollo no compite en la capa de ejecución.** Su propia base de conocimiento lo dice sin ambigüedad: *"LinkedIn tasks need to be manually completed... Apollo doesn't automatically complete LinkedIn tasks for you."* Apollo puede **recordarte** que envíes una solicitud de conexión —es un tipo de tarea en su secuenciador— pero no la envía. Y **InMail ni siquiera figura como tipo de tarea**. Es un proveedor de datos con un lector de LinkedIn y una lista de pendientes. Compararlo con CoPilot AI es comparar categorías distintas.

**Prozer no es competencia de LinkedIn — es competencia de email, y es chileno.** $49/mes por 400 contactos verificados, base propia, agente redactor con IA, warmup de deliverability. Es el único del set que entiende el mercado. Si el producto de adOps termina siendo multicanal, Prozer es el benchmark de precio local, no CoPilot AI.

**Clay tiene el modelo económico exactamente invertido para Chile,** y esto contradice dos cosas del resumen del video:

- *"En Clay no hay límites técnicos para el tamaño de las tablas"* — **hay límites, y peor: no se sabe cuáles.** El plan gratuito topa en 200 filas por tabla según la página de precios… y en **50 filas** según el propio FAQ de Clay, que se contradice consigo mismo. Para los planes de pago, **Clay simplemente no publica el límite de filas.** Es un dato que no se puede verificar antes de contratar.
- **Clay cobra los intentos fallidos.** Los créditos se consumen por paso del workflow, tenga éxito o no. En un mercado donde el *match rate* de un proveedor único ronda el 40–60% —y en Chile probablemente menos— eso significa **pagar íntegro el 50% que no encuentra nada**.
- Clay **no publica el costo por acción**. Se descubre gastando. Es la crítica más repetida en las reviews.
- Y el precio real es más alto de lo que suele citarse: **Launch cuesta $167/mes en facturación mensual** ($54 anual, 15.000 actions y 3.000 data credits), y **Growth cuesta $446/mes mensual** ($185 anual). El "$185" que circula en los blogs es Growth **con compromiso anual**, no un plan de entrada.

Para Chile, el criterio de selección número uno de la capa de datos no es el precio por crédito: es **"no match, no charge"**. Bajo ese criterio, Clay es estructuralmente el peor encaje disponible, y FullEnrich o Prospeo son los mejores.

### El hueco del mercado, en una frase

**Nadie une la capa de ejecución de LinkedIn con datos de LatAm.** Las herramientas de LinkedIn no traen datos —dependen de que cargues listas desde Sales Navigator—. Apollo tiene datos pero su cobertura chilena es débil y no ejecuta. Prozer entiende Chile pero es solo email. Hoy un equipo comercial chileno paga tres productos y los pega a mano.

Y hay un hueco de precio: con LinkedIn cloud serio la entrada es HeyReach a $79 o Skylead a $100. Debajo de eso solo hay extensiones de navegador (más riesgosas) o email puro. **No existe oferta cloud, en español, con datos locales, bajo $79/mes.**

---

## El foso: los datos que Chile regala y nadie usa

Este es el hallazgo que cambia la forma del proyecto.

Primero, una corrección a la narrativa habitual. La literatura del sector dice que LatAm tiene mala cobertura porque hay poca penetración de LinkedIn. **En Chile eso es falso y verificable:** 10,0 millones de miembros, el **63,1% de la población adulta** (DataReportal, cierre de 2025). Es una de las penetraciones más altas de la región. El problema no son los perfiles.

Lo que falta en los proveedores globales es la **firmografía local** —ventas, trabajadores, rubro, RUT— y los **teléfonos móviles verificados**. Y la firmografía chilena, resulta, es pública y gratuita.

### Capa 1 — Universo de empresas · costo ~$0

| Fuente | Qué entrega | Costo |
|---|---|---|
| **SII · Nómina de personas jurídicas** | Razón social, RUT, actividad económica, direcciones históricas | **Gratis** |
| **SII · Empresas por período** | **Tramo de ventas (13 rangos), número de trabajadores, región, rubro, subrubro, actividad principal, tramo de capital propio** ⚠️ | **Gratis** |
| **Registro de Empresas y Sociedades** (datos.gob.cl, CC-BY, con API) | Constituciones por año — empresas nuevas antes que nadie | **Gratis** |
| **Outscraper / Google Maps** | PyME, retail y servicios sin presencia formal: teléfono, web, categoría, reviews | **$1–3 por 1.000** |

La nómina de empresas por período del SII es, en la práctica, **una base firmográfica censal de Chile, oficial y gratuita, con los dos campos que más se pagan en ZoomInfo**: tamaño por ventas y headcount.

⚠️ **Con dos advertencias de frescura que hay que diseñar alrededor.** Las ventas vienen en **tramo**, no en monto. Y la última publicación de ese archivo es de **noviembre de 2025 con datos hasta el año comercial 2024**: hay un desfase de ~18 meses. La razón social, las actividades económicas y las direcciones históricas sí están actualizadas a **agosto de 2026**, pero vienen en archivos separados. En la práctica: la identidad de la empresa es actual, su tamaño es de hace dos años. Para segmentar por tamaño sirve; para prometer "datos en tiempo real", no.

### Capa 2 — Señal de compra · costo $0 · **esto es el diferenciador**

| Fuente | Señal |
|---|---|
| **ChileCompra · bulk OCDS** (licencia **CC0**, ene-2022 a may-2026) | **4.920.375 licitaciones** y **2.364.782 organizaciones que licitan** (*tenderers*). Se indexa localmente ⚠️ |
| **ChileCompra · API** (gratis, **10.000 requests/día**) | Deltas diarios: nuevas licitaciones, adjudicaciones, órdenes de compra |
| **Diario Oficial · sección Sociedades** | Constituciones, modificaciones, disoluciones |

⚠️ **Ojo con la cifra que circula.** El dataset reporta 5.012.621 *suppliers*, pero eso cuenta **ocurrencias del rol proveedor en los releases, no empresas distintas**. Chile no tiene cinco millones de empresas proveedoras del Estado —tiene del orden de 1,2 a 1,5 millones de personas jurídicas en total según el SII—. Al dimensionar el mercado direccionable hay que usar organizaciones únicas deduplicadas por RUT, no el conteo de roles. Es un error fácil de cometer y habría inflado el TAM en un orden de magnitud.

Hecha esa salvedad: esto no es un directorio, es **comportamiento transaccional**. Permite detectar que una empresa acaba de adjudicarse un contrato —tiene presupuesto y va a necesitar proveedores—, que un organismo licita recurrentemente en tu categoría, o que un competidor se está llevando los contratos. Es la diferencia entre una lista y un sistema de prospección.

Y es exactamente el tipo de motor que adOps **ya construyó** en `insights.ts` para el CRM: reglas que detectan un hecho, lo convierten en alerta y le adjuntan una acción ejecutable. Aquí las reglas cambian de "pasó su ventana de recompra" a "ganó una licitación de $X en tu categoría hace nueve días".

> **Nota de cumplimiento, que resulta ser también una ventaja de diseño:** los datos de **personas jurídicas** —RUT, razón social, ventas, trabajadores— **no son datos personales** bajo la Ley 21.719. Construir el sistema con la empresa como entidad central y **enriquecer con el contacto humano solo en el momento de necesitarlo** no es solo la arquitectura más barata: es la que deja la base defendible.

### Capa 3 — Contactos · pago por unidad, bajo demanda

| Herramienta | Rol | Costo |
|---|---|---|
| **Sales Navigator Core** | Targeting de personas. Justificado por los 10M de miembros chilenos | $99,99/mes ($79,99 anual) |
| **FullEnrich** o **Prospeo** | Waterfall de email + móvil. **Criterio decisivo: no match, no charge** | $39–55/mes |
| **Dropcontact** (opcional) | Calcula emails al vuelo sin almacenar base → mejor postura ante la 21.719. Sin teléfonos | €79/mes |
| **MillionVerifier** | Verificar el 100% antes de enviar | ~$3,70 por 1.000 |

*Waterfall enrichment* significa consultar proveedores en cascada hasta encontrar un dato verificado. Los vendors declaran subir de 40–60% (proveedor único) a 80–96% (cascada). ⚠️ **Esas cifras son autodeclaradas y medidas sobre poblaciones casi con certeza estadounidenses. No las presupuestes para Chile.** El diferencial es creíble; los valores absolutos no son transferibles.

### Qué NO comprar para Chile

- ❌ **ZoomInfo / Cognism** — USD 15.000 a 40.000 al año. La FAQ oficial de Cognism define su cobertura como *"EMEA, US y APAC"*. LatAm no aparece.
- ❌ **Clay como orquestador** — cobra los fallos, que es el modelo económico inverso al que necesita un mercado de bajo *hit rate*, y no publica ni el costo por acción ni el límite de filas de sus planes pagos. Además, ninguna fuente chilena tiene conector nativo: igual hay que programarla.
- ❌ **Listas Excel de vendors locales** — riesgo alto bajo la 21.719 desde diciembre. Señal reveladora: el principal vendor local **ya dejó de entregar emails y teléfonos individuales, citando la ley**.

### El dato que no existe, y que hay que generar

Buscamos por múltiples ángulos y el resultado es un hallazgo negativo importante: **no existe públicamente ningún benchmark independiente de tasa de coincidencia por país para LatAm.** Ni en G2, ni en Reddit, ni en comparativas. Cualquiera que te cite un porcentaje de cobertura chilena de Apollo se lo está inventando o se lo dio su vendedor.

Esto convierte la Fase 0 en obligatoria, y también en barata: es el único dato confiable que va a existir sobre este mercado, y lo va a tener adOps.

---

## Lo que ya está construido

adOps no parte de cero. Revisando el CRM en `adoOps.Digital`, hay cuatro piezas que se reusan casi tal cual, y una de ellas es la más difícil de todo el proyecto.

| Módulo existente | Qué hace hoy | Qué hace en el sistema de leads |
|---|---|---|
| **`whatsapp-dispatch.ts`** — los cuatro candados | Aprobación humana → conversación sin BAJA → interruptor general → lista blanca. Punto único de salida, auditable | **Es la arquitectura de cumplimiento que este proyecto necesita, ya construida y probada.** Se generaliza a un `dispatch` multicanal: LinkedIn, email, WhatsApp |
| **`insights.ts`** — motor de reglas | Detecta hechos y emite alertas con acción ejecutable | Motor de señales de compra sobre ChileCompra, SII y Diario Oficial |
| **`scoring.ts`** — puntaje explicable | Cinco factores, pesos editables, evidencia por factor | Lead scoring. La decisión de que sea explicable **es exactamente la correcta** aquí: un vendedor no cambia su conducta por un número que sale de una caja negra |
| **`narrador.ts`** — caché por huella + `<Suspense>` | Redacta resúmenes con GLM/OpenAI, cachea por hash de las cifras, nunca bloquea la pantalla | Generación de mensajes personalizados. **El caché por huella evita reescribir el mismo mensaje para el mismo prospecto y pagarlo dos veces** |
| **`marketing.ts`** — atribución | Campaña → oportunidad → venta, con CAC y ROI | Atribución del canal LinkedIn al pipeline. Cierra el ciclo que ningún competidor cierra |
| **Bandeja de 3 columnas + respuestas rápidas** | Conversaciones de WhatsApp con plantillas | Bandeja unificada LinkedIn + email + WhatsApp |

Dos observaciones sobre esto.

**La primera:** el patrón de "nada sale sin cruzar cuatro candados, y hay un único módulo que importa el cliente de red" es, literalmente, lo que separa un producto de prospección que dura de uno que quema las cuentas de sus clientes en tres meses. Ya lo tienen escrito y ya saben por qué importa. Es probablemente el activo más valioso que entra a este proyecto.

**La segunda, y es una recomendación fuerte:** en Chile y LatAm, **WhatsApp convierte mejor que LinkedIn**, y adOps ya tiene el canal construido con controles. Un sistema que levanta la empresa desde el SII, detecta la señal en ChileCompra, encuentra al decisor por LinkedIn, y cierra la conversación por WhatsApp es un producto que **ninguna de las trece referencias puede armar**, porque ninguna tiene ni los datos chilenos ni el canal de WhatsApp.

Estimación de reuso: entre el **35% y el 45%** del backend del motor ya existe en alguna forma. Lo que hay que construir de cero es la ingesta de fuentes públicas, el motor de secuencias con pacing, y la capa de LinkedIn.

---

## Arquitectura propuesta

Encaja en el stack actual —Next 16, Neon, Drizzle, Vercel— y en la misma convención del CRM: prefijo de tablas, todo bajo una ruta con sesión.

```
  FUENTES PÚBLICAS (gratis)          ENRIQUECIMIENTO (por unidad)
  ┌──────────────────────┐          ┌──────────────────────────┐
  │ SII · nóminas        │          │ Sales Navigator          │
  │ ChileCompra · OCDS   │          │ FullEnrich / Prospeo     │
  │ ChileCompra · API    │          │ MillionVerifier          │
  │ Registro Empresas    │          └────────────┬─────────────┘
  │ Diario Oficial       │                       │
  │ Google Maps          │                       │
  └──────────┬───────────┘                       │
             │  ingesta batch + deltas diarios   │  bajo demanda,
             ▼                                   ▼  solo si pasa el filtro
   ┌─────────────────────────────────────────────────────────┐
   │  RESOLUCIÓN DE IDENTIDAD                                │
   │  RUT → dominio → nombre normalizado                     │
   │  (mismo patrón que el CRM: colisión → revisión humana)   │
   └────────────────────────┬────────────────────────────────┘
                            ▼
   ┌─────────────────────────────────────────────────────────┐
   │  BASE DE PROSPECCIÓN                                     │
   │  empresas · personas · señales · procedencia por campo   │
   │  ▸ cada campo guarda de dónde vino y cuándo — NO OPCIONAL│
   └────────────────────────┬────────────────────────────────┘
                            ▼
   ┌──────────────┬─────────────────┬────────────────────────┐
   │ Señales      │ Scoring         │ Redacción IA           │
   │ (insights)   │ (explicable)    │ (caché por huella)     │
   └──────┬───────┴────────┬────────┴──────────┬─────────────┘
          └────────────────┼───────────────────┘
                           ▼
   ┌─────────────────────────────────────────────────────────┐
   │  MOTOR DE SECUENCIAS + PACING                            │
   │  warm-up obligatorio · ventana horaria · jitter real     │
   │  cuotas por cuenta · freno automático por aceptación     │
   └────────────────────────┬────────────────────────────────┘
                            ▼
   ┌─────────────────────────────────────────────────────────┐
   │  DISPATCH — punto único de salida, los cuatro candados   │
   └───┬─────────────────┬──────────────────┬────────────────┘
       ▼                 ▼                  ▼
   LinkedIn          Email               WhatsApp
   (Unipile)         (Brevo, ya está)    (WaSender, ya está)
       │                 │                  │
       └─────────────────┴──────────────────┘
                         ▼
              BANDEJA UNIFICADA  →  CRM /crm (oportunidades)
```

### Decisiones de arquitectura que conviene fijar ahora

**Procedencia por campo, desde el primer commit.** Cada email, teléfono y URL guarda de qué fuente vino y en qué fecha. No es burocracia: es lo que hace la diferencia entre una base defendible ante la Agencia de Protección de Datos y una base que hay que borrar entera. Retro-adaptarlo después es carísimo, y la ley entra en vigencia en **tres meses y medio**.

**El pacing vive en adOps, no en el proveedor.** Unipile v1 declara explícitamente: *"We don't enforce any limits on our side"* — envía exactamente lo que le pidas, al volumen que le pidas. Toda la lógica de warm-up, cuotas y aleatorización es código propio. Es trabajo, y es también donde está el valor: es lo que evita quemar cuentas.

**Los límites propios, más conservadores que los del vendor.** Unipile documenta hasta 200 invitaciones/semana; el consenso de la comunidad es 100–200 y depende del historial de cada cuenta. La detección de LinkedIn opera sobre **desviación respecto del baseline de cada cuenta**, no sobre umbrales absolutos: 100 a la semana es enorme para una cuenta nueva y rutina para una de cinco años con 8.000 conexiones. Propuesta: **arrancar en 5–10/día, subir 20% semanal, techo 20–25/día**, con freno automático si la tasa de aceptación cae bajo 25%.

**Nada de extensiones de navegador.** Son la arquitectura con mayor huella de detección: LinkedIn inspecciona el DOM modificado y los scripts inyectados. Cloud API con IP residencial dedicada por cuenta.

**Descartar por completo el uso de la cookie de sesión de un tercero sin su participación.** Ver la sección legal: en Chile esto deja de ser un problema contractual y entra en territorio penal.

---

## Riesgo legal

Chile suma una capa que las referencias gringas no tienen: la **Ley 21.719**, que entra en vigencia el **1 de diciembre de 2026** —dentro de tres meses y medio— y que elimina algo importante.

### Lo que cambia el 1 de diciembre

| Aspecto | Detalle |
|---|---|
| **"Fuente de acceso público" deja de ser justificación automática** | Bajo la ley anterior, que un dato fuera público bastaba. Bajo la 21.719, **no**. Que un perfil de LinkedIn sea visible sin login no habilita a tratarlo |
| **El email corporativo nominativo ES dato personal** | `jperez@empresa.cl` identifica a una persona natural. El argumento *"solo tengo clientes empresa"* no aplica |
| **Interés legítimo existe** (Art. 13 d) | Pero exige **test de balanceo documentado por escrito y con anterioridad** al tratamiento, e informar al titular de que se invoca |
| **Oposición absoluta al marketing directo** (Art. 8 b) | Incluye la elaboración de perfiles. No admite ponderación: si se opone, cesa |
| **Multas** | Leve 5.000 UTM · Grave 10.000 UTM · **Gravísima 20.000 UTM = $1.432.980.000** (UTM de agosto 2026: $71.649), del orden de **USD 1,57 millones**. Para grandes empresas reincidentes el tope alternativo es **2–4% de las ventas anuales**, que puede superar esa cifra |
| **Suspensión de operaciones** (Art. 38) | Hasta 30 días renovables por reincidencia grave. Para un negocio de prospección, equivale a un cese |
| **DPO** | **Facultativo** (Art. 49). Solo obligatorio si se adopta el modelo de prevención de infracciones — que es voluntario pero **atenuante expreso** |
| **No hay derechos adquiridos** | Una base armada en 2026 bajo la ley vieja debe cumplir la 21.719 desde el día uno |

### ⚠️ El dato más accionable, y es de este mes

**Al 19 de agosto de 2026 la ley sigue vigente para el 1 de diciembre. Pero el 4 de agosto el Gobierno anunció públicamente que prepara un proyecto para postergarla.** El motivo es que la Agencia de Protección de Datos no tiene Consejo Directivo: el Senado rechazó la nómina en mayo y el plazo legal para constituirlo venció en junio. El proyecto **todavía no ingresa**, y no está definido si postergaría la ley completa o solo la puesta en marcha de la Agencia.

Cómo leerlo para efectos del proyecto: **diseñar para el 1 de diciembre**. Una postergación es un regalo, no un plan, y el alcance de la eventual prórroga es incierto. Pero conviene monitorearlo, porque si la Agencia no se constituye, el régimen sancionatorio no tiene quién lo aplique durante un tiempo — lo cual cambia el cálculo de urgencia, no el de diseño.

### Semáforo por actividad

| Actividad | Riesgo | Lectura |
|---|---|---|
| **Usar la cookie de sesión de un tercero sin su participación** | 🔴 **Descartar** | Además del 8.2, posible encuadre en el **Art. 2 de la Ley 21.459** (acceso ilícito) con agravante de ánimo de apoderamiento: presidio menor en grados mínimo a medio. **Convierte un riesgo civil en riesgo penal.** No hay mitigación |
| **Scraping de perfiles a escala** | 🔴 **Alto** | Cuatro juicios, cuatro derrotas. hiQ ganó en CFAA y **perdió por contrato**: USD 500.000, injunction permanente, destrucción de código y datos, y quebró. Si el scraping requiere estar logueado —que es el caso de casi todo lo útil— se sale del refugio de hiQ |
| **Comprar datos a brokers con origen LinkedIn** | 🟠 **Alto, y subestimado** | La cláusula **8.2(4) alcanza al comprador**: *"whether directly or through third parties (such as data aggregators or brokers)"*. La injunction de Proxycurl lo obligó a **notificar a sus clientes**. Mitigación: due diligence documentada del origen, garantía de licitud e indemnidad contractual |
| **Automatizar invitaciones y mensajes** | 🟠 **Medio-alto** | Violación directa del 8.2(13). La consecuencia práctica es pérdida de cuenta, no litigio —LinkedIn no demanda usuarios individuales—. Pero desde 2026 **hay bans a nivel de proveedor**: la elección de herramienta pesa tanto como la conducta |
| **Email frío enriquecido** | 🟡 **Medio** | Chile es régimen **opt-out** (Art. 28 B, Ley 19.496): asunto que indique la materia + identidad del remitente + dirección de baja válida. Es barato de cumplir. **El riesgo no es el email: es el origen del dato** |
| **InMail pagado y Sales Navigator, operados por una persona** | 🟢 **Bajo** | Es el producto que LinkedIn vende para esto. Se vuelve naranja apenas se automatiza el envío o se exportan listas. El trade-off es costo por contacto y que no escala — ese es precisamente el precio del cumplimiento |

### La asimetría interno / SaaS, en concreto

Esto es lo que hay que decidir antes que nada.

**Uso interno.** El sujeto de la infracción es adOps como usuario. LinkedIn no demanda usuarios individuales; restringe cuentas. El peor caso realista: perder una cuenta de LinkedIn y su historial. Se mitiga tratando las cuentas de outreach como **activos desechables** —nunca la cuenta del socio o del CEO— y operando muy por debajo de los topes.

**SaaS multi-tenant.** El sujeto cambia. adOps pasa a ser quien *"desarrolla, soporta o provee"* el software del 8.2(2), y quien opera infraestructura a escala. Ahí está el precedente completo:

- **Proxycurl** (demanda enero 2025, caso 3:25-cv-00828): seis causas de acción, **fundadores demandados como personas naturales**, empresa de Singapur —la jurisdicción extranjera no funcionó como escudo—, acuerdo con destrucción permanente de datos, obligación de notificar a los clientes, y **cierre en julio de 2025** de un negocio de ~USD 10 millones.
- **Mantheos** (Singapur): mismo patrón, acuerdo con injunction permanente.
- **ProAPIs** (octubre 2025): acuerdo en principio en febrero de 2026.
- **HeyReach** (marzo 2026): página corporativa eliminada, **perfiles personales de CEO, CTO, CRO y CMO baneados**, capacidad publicitaria retirada.

Cuatro casos, cuatro derrotas, cero jurisdicciones que protegieran.

**Conclusión:** un SaaS cuyo *core value* sea automatizar LinkedIn es un negocio con fecha de vencimiento desconocida y con exposición personal para los socios. **Un SaaS cuyo core sea inteligencia comercial chilena, y que además ofrezca conectar la propia cuenta de LinkedIn del cliente como uno de varios canales, tiene un perfil de riesgo materialmente distinto** — porque el activo diferenciador no depende de LinkedIn, y si LinkedIn cierra la puerta, el producto sobrevive.

### Las tres preguntas para el abogado

Este documento no es asesoría legal. Hay tres puntos donde las fuentes divergen y que un abogado tiene que resolver **antes** de comprometer alcance:

1. **¿Es invocable el interés legítimo del Art. 13 d) para prospección fría B2B a no-clientes, o se requiere consentimiento?** Las guías chilenas divergen. Los ejemplos documentados de marketing bajo interés legítimo se refieren a **clientes existentes**. Esta es la bisagra de todo el modelo de negocio.
2. **¿Aplica el Art. 28 B de la Ley 19.496 —que está en la ley del consumidor— a destinatarios estrictamente B2B?** Discutible, pero cumplirlo cuesta casi nada, así que la discusión es más académica que operativa.
3. **Si un cliente conecta voluntariamente su propia cuenta de LinkedIn a la plataforma de adOps, ¿configura eso el tipo del Art. 2 de la Ley 21.459?** El titular autoriza, pero LinkedIn —dueño del sistema— no. Es la pregunta que decide si el SaaS es viable en Chile.

---

## Costos y unit economics

### Operación mensual — piloto interno, 1 cuenta de LinkedIn

| Ítem | USD/mes |
|---|---|
| SII + ChileCompra + Registro de Empresas + Diario Oficial | **$0** |
| Outscraper (~20.000 negocios de Google Maps) | ~$60 |
| Sales Navigator Core ($99,99 mensual / $79,99 con plan anual) | $80–100 |
| Unipile (hasta 10 cuentas conectadas) | ~$55 (€49) |
| FullEnrich (1.000 créditos: ~800 emails o ~100 móviles) | $55 |
| MillionVerifier (~10.000 verificaciones) | ~$37 |
| IP residencial dedicada | ~$10–15 |
| LLM para redacción (con caché por huella) | ~$10–20 |
| Neon + Vercel | **$0 marginal** — ya está pagado |
| **Total** | **≈ $310–350/mes** |

Comparación: la mediana de contrato de ZoomInfo es USD 31.875/año ≈ **$2.656/mes**, con cobertura chilena no documentada y sin señal de compra local. Casi **8× más caro con peor cobertura local**.

⚠️ *Unipile cobra por "cuenta conectada", y **una cuenta = un servicio**. Un cliente con LinkedIn + Gmail + WhatsApp cuenta como tres. Esto cambia mucho la economía en modo multi-tenant y hay que modelarlo bien.*

### Rendimiento esperado — y de dónde salen los números

Con una cuenta a **20 invitaciones/día × 22 días hábiles = ~440 invitaciones/mes**:

| Etapa | Tasa | Resultado |
|---|---|---|
| Invitaciones enviadas | — | 440 |
| Aceptación | 20–30% (HeyReach reporta 21,3% sobre 50M de invitaciones) | 88–132 |
| Respuesta al nurture | 15–25% | 15–30 conversaciones |
| Reunión agendada | 20–30% de las conversaciones | **4–9 reuniones/mes** |

**Costo de herramientas por reunión: ~$40–90.** No incluye el tiempo del ejecutivo, que es el costo dominante.

⚠️ *Estas tasas son de benchmarks de vendors, medidas sobre poblaciones mayoritariamente estadounidenses. **La Fase 0 existe para reemplazarlas por números chilenos reales.** No comprometas un pipeline sobre esta tabla.*

### Escalamiento

El costo marginal por cuenta adicional de LinkedIn es **~$95–115/mes**: Sales Navigator ($80–100 según compromiso) + Unipile ($5) + IP dedicada ($10). Contra HeyReach, que cobra $79 por sender con el producto ya hecho.

Esto tiene una implicación estratégica directa: **si el producto de adOps compite en la capa de envío, el margen es negativo o marginal desde el primer cliente.** El margen está en la capa de datos, donde el costo marginal es cercano a cero porque las fuentes son públicas.

### Modelo de precio sugerido para el SaaS (a validar)

| Plan | Precio | Qué incluye |
|---|---|---|
| **Inteligencia** | ~$79–99/mes (en CLP, con factura) | Señales de ChileCompra + firmografía SII + scoring + exportación. **Sin LinkedIn. Margen alto, riesgo cero** |
| **Inteligencia + Contacto** | ~$199–249/mes | Lo anterior + enriquecimiento waterfall + secuencias de email/WhatsApp |
| **Full** | ~$299–349/mes por sender | Lo anterior + capa de LinkedIn con cuenta propia del cliente |

El plan de entrada es el interesante: **es el único de los tres que no depende de LinkedIn**, es el que nadie más puede ofrecer en Chile, y es el que sobrevive si LinkedIn cierra la puerta. Además ocupa la banda de precio que hoy está vacía.

---

## Fases y tiempos

| Fase | Qué entrega | Duración | Costo directo |
|---|---|---|---|
| **0 · Validación** ⛔ *puerta de decisión* | Test de cobertura sobre 200 empresas del ICP chileno (sacadas gratis del SII) contra FullEnrich, Prospeo y Apollo. Perfilado del bulk OCDS con deduplicación real por RUT. Prueba de Unipile con 1 cuenta y 50 invitaciones. Consulta legal sobre las tres preguntas | **2 semanas** | **~$200** |
| **1 · Capa de datos Chile** | Ingesta del SII, bulk OCDS de ChileCompra indexado, deltas diarios por API, Registro de Empresas, resolución de identidad por RUT, **procedencia por campo** | 4–5 semanas | $0 |
| **2 · Señales y scoring** | Motor de reglas sobre señales de compra, scoring explicable, ICP configurable. **Reusa `insights.ts` y `scoring.ts`** | 2–3 semanas | $0 |
| **3 · Enriquecimiento** | Waterfall con no-match-no-charge, verificación, presupuesto por campaña | 2 semanas | ~$100/mes |
| **4 · Motor de secuencias y dispatch** | Pacing, warm-up, cuotas, freno por aceptación, LinkedIn vía Unipile, bandeja unificada. **Generaliza `whatsapp-dispatch.ts`** | 4–6 semanas | ~$300/mes |
| **5 · Cumplimiento** | RAT, test de balanceo documentado, opt-out operativo con SLA de 30 días, aviso de privacidad, deber de información en el primer contacto | 2–3 semanas | Honorarios legales |
| **6 · Multi-tenant** *(solo si 0–5 validaron)* | Aislamiento por tenant, onboarding, facturación en CLP, planes | 4–6 semanas | — |

**A MVP interno operativo: 14–19 semanas.** A producto vendible: **+4–6 semanas** más.

Las fases 1 y 2 no se pueden solapar con la 4: sin datos confiables el motor de envío es una máquina de mandar mensajes irrelevantes, que es la forma más rápida de quemar cuentas de LinkedIn y de que la tasa de aceptación se desplome.

**La fase 5 no va al final, aunque esté numerada así.** El campo de procedencia y el consentimiento tienen que existir desde el primer `CREATE TABLE` de la fase 1. Lo que va al final es la documentación formal.

---

## Supuestos y riesgos

| Supuesto | Riesgo si no se cumple | Cómo lo manejamos |
|---|---|---|
| La cobertura de contacto en Chile alcanza para un pipeline útil | El motor funciona sobre listas vacías: no hay a quién escribirle | **Fase 0.** 200 empresas del ICP contra tres proveedores, ~$200. Es el gate del proyecto |
| Las nóminas del SII y el OCDS de ChileCompra son procesables | Se cae la capa que es el diferenciador entero | Descarga y perfilado en la primera semana de la Fase 1, antes de comprometer alcance |
| Un desfase de ~18 meses en el tramo de ventas del SII es tolerable para segmentar | Empresas que crecieron o se achicaron quedan en el tramo equivocado | Usar el tramo como filtro grueso, no como dato de ficha. Cruzar con actividad reciente en ChileCompra, que sí es diaria |
| Unipile expone InMail y Sales Navigator como declara | Se pierde la capa de InMail, que es parte del encargo original | **Hay una discrepancia detectada:** el SDK oficial de Unipile lo confirma (`options.linkedin.inmail: true`), pero una review de terceros lo niega. Verificar en el trial de 7 días en la Fase 0 |
| La cuenta de LinkedIn sobrevive al warm-up y a la operación sostenida | Se pierde el canal y el historial de la cuenta | Cuentas desechables, nunca la de un socio. Límites conservadores. Freno automático por tasa de aceptación |
| El interés legítimo es invocable para prospección fría B2B | El modelo de negocio requiere consentimiento previo, lo que lo cambia por completo | Consulta legal en la Fase 0. **Es la pregunta que puede matar el SaaS** |
| La Ley 21.719 entra en vigencia el 1 de diciembre | Si se posterga, hay más ventana; si no, hay tres meses y medio | Diseñar para la ley vigente desde el día uno. Una postergación es un regalo, no un plan |
| El equipo comercial adopta el sistema | El motor genera conversaciones que nadie contesta y la tasa de respuesta se hunde | La bandeja unificada y las respuestas rápidas ya existen y ya se probaron en el CRM |

**El riesgo principal no es técnico ni legal: es de posicionamiento.** Si el producto se define como "automatización de LinkedIn", compite contra trece herramientas maduras, en un canal que no controla, con márgenes de commodity y exposición personal para los socios. Si se define como "inteligencia comercial chilena que además contacta", compite contra nadie, con costo marginal cercano a cero en su capa diferenciadora, y sobrevive a que LinkedIn cambie las reglas.

Es la misma decisión que ya tomaron en el CRM cuando eligieron cortes absolutos en vez de quintiles: calibrar el sistema a la escala y la realidad del mercado que tienen enfrente, no a la que hace lucir mejor una lámina.

---

## Recomendación

**GO condicionado a la Fase 0**, con tres correcciones al planteamiento original:

**1. Cambiar el eje del producto.** El sistema no es "adquisición de leads vía LinkedIn". Es **un motor de señales de compra del mercado chileno con contacto multicanal**, donde LinkedIn es un canal entre tres —junto a email y WhatsApp, que adOps ya tiene construido con controles—. La capa de LinkedIn es necesaria pero no es el producto, porque es la única parte que no se controla y que ya es un commodity de USD 79.

**2. Separar interno de SaaS como decisiones distintas, no como fases.** El uso interno se puede empezar ya: el riesgo es una cuenta de LinkedIn. El SaaS multi-tenant requiere resolver las tres preguntas legales primero, y probablemente lanzar con el plan que **no** incluye LinkedIn — que además es el que ocupa la banda de precio vacía y el que nadie más puede ofrecer en Chile.

**3. Descartar Clay del diseño.** Cobra los intentos fallidos, no publica el costo por acción, no publica el límite de filas de sus planes de pago —y en el plan gratuito su propia documentación se contradice entre 200 y 50 filas—, cuesta $167/mes de entrada en facturación mensual, y no tiene conector nativo para ninguna fuente chilena. El video está bien como demostración de un flujo; está mal como arquitectura para este mercado. La orquestación se programa contra las APIs, que es lo que adOps ya hace con RelBase y WooCommerce.

### Lo primero que hay que hacer, esta semana

1. **Sacar 200 empresas del ICP chileno de la nómina del SII** —es gratis y se descarga hoy— y correrlas contra FullEnrich, Prospeo y Apollo. Los tres tienen capa gratuita o no-match-no-charge. Costo: cerca de cero. Resultado: **el único dato confiable de cobertura chilena que va a existir**, porque nadie lo ha publicado.
2. **Descargar el bulk OCDS de ChileCompra** (CC0, ~2,5 GB en JSON), verificar que las señales que imaginamos están efectivamente ahí, y **deduplicar proveedores por RUT** para saber el tamaño real del universo direccionable —no el conteo de roles.
3. **Abrir el trial de 7 días de Unipile** y verificar de primera mano si InMail y Sales Navigator funcionan como declara el SDK.
4. **Llevarle las tres preguntas a un abogado de datos personales.** La del Art. 13 d) es la que decide si hay SaaS.

Cuatro cosas, dos semanas, unos USD 200. Si la cobertura chilena no da, el proyecto se cierra habiendo gastado eso en vez de cuatro meses de desarrollo.

---

## Anexo · Qué está verificado y qué no

Este informe distingue tres niveles, y conviene respetarlos al citarlo.

Todas las afirmaciones que sostienen la recomendación pasaron por una segunda ronda de verificación adversarial contra fuentes primarias. Cinco quedaron corregidas y están reflejadas arriba; se listan al final por transparencia.

**Verificado en fuente primaria:**
SNAP cerrado —texto literal vigente, página actualizada en mayo de 2025 y aún publicada— y la restricción de las Communication APIs · hiQ v. LinkedIn: stipulated judgment del **7 de diciembre de 2022** por **USD 500.000** más injunction permanente · LinkedIn v. Nubela/Proxycurl, **caso 3:25-cv-00828 (N.D. Cal.), presentado el 24-01-2025**, cierre anunciado el **4-07-2025** citando el acuerdo con LinkedIn · Ley 21.719: publicada 13-12-2024, vigencia 1-12-2026, artículos 2, 8 b), 13 d), 34–39, 49 · **UTM de agosto 2026 = $71.649** y dólar observado 18-08-2026 = $914,19 (SII) · Art. 28 B de la Ley 19.496 · Art. 2 de la Ley 21.459 · **API de ChileCompra gratuita con límite literal de 10.000 solicitudes diarias por ticket**, no modificable · bulk OCDS bajo **CC0 1.0**, cobertura ene-2022 a may-2026, 4.920.375 tenders y 2.364.782 tenderers · campos exactos de la nómina de empresas del SII y su fecha de publicación (nov-2025, datos hasta AC2024) · **Sales Navigator Core $99,99/mes con 50 InMails**, iguales en Advanced · Apollo: *"Apollo doesn't automatically complete LinkedIn tasks for you"* · 10,0M de miembros de LinkedIn en Chile = 63,1% de adultos (DataReportal) · precios de Clay en clay.com/pricing · SDK de Unipile en GitHub · guía de CAN-SPAM de la FTC · EDPB Guidelines 1/2024.

**Declarado por el vendor, no verificado independientemente:**
Precios de Unipile (su sitio bloquea el acceso automatizado; el desglose viene de un recopilador terciario — **verificar antes de presupuestar**) · el techo de ~800 InMails abiertos al mes · todas las tasas de *match rate* del waterfall (93%/87% de FullEnrich, 96% de un "benchmark independiente" no identificado) · las tasas de aceptación y respuesta de la sección de rendimiento · la precisión declarada de los verificadores de email.

**No verificable o en conflicto entre fuentes:**
Redacción exacta y vigente del User Agreement de LinkedIn (su robots.txt bloquea el acceso automatizado a sus propios términos — dato en sí mismo elocuente) · **límite de filas por tabla en los planes pagos de Clay: no publicado**, y en el plan gratuito la página de precios dice 200 mientras el FAQ dice 50 · tamaño de la base de Apollo: publica 240M y 230M en páginas distintas · **no existe ningún benchmark independiente de cobertura de datos por país para LatAm** — esa ausencia es, en sí misma, uno de los hallazgos del estudio.

**Corregido tras la verificación adversarial** (cinco puntos que estaban mal en el primer borrador):
1. *"No existe ninguna API oficial para enviar InMail"* → existe **Message Ads** (`POST /rest/inMailContents/`), que entrega en la bandeja de InMail pero por segmento de audiencia, no a una persona. La conclusión práctica se mantiene; la afirmación absoluta era refutable.
2. *"Clay Launch $185/mes con 50.000 filas por tabla"* → **Launch es $167/mes mensual**; $185 es **Growth con plan anual**; y el límite de filas de los planes pagos **no está publicado**.
3. *"5 millones de proveedores en ChileCompra"* → son **ocurrencias del rol proveedor**; las organizaciones distintas que licitan son **2,36 millones**, y aun ese número incluye duplicados. Habría inflado el mercado direccionable en un orden de magnitud.
4. *"La Ley 21.719 no ha sido postergada"* → cierto, **pero el 4 de agosto de 2026 el Gobierno anunció un proyecto de postergación** que aún no ingresa. Omitirlo era omitir el dato más accionable del mes.
5. *"Nómina del SII con tramo de ventas"* → correcto, **pero el archivo más reciente es de noviembre de 2025 con datos hasta el año comercial 2024**. Desfase de ~18 meses.

**Interpretación propia, no doctrina establecida:**
Que el interés legítimo sea invocable para prospección fría B2B a no-clientes · el encuadre penal del uso de cookie ajena bajo la Ley 21.459 · que la jurisdicción chilena no ofrezca protección práctica frente a LinkedIn (basado en que Singapur no la ofreció en dos casos) · la clasificación de riesgo del semáforo.

---

## Fuentes

**LinkedIn — documentación oficial:** [Getting Access to LinkedIn APIs](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access) · [Sales Navigator Application Platform](https://learn.microsoft.com/en-us/linkedin/sales/) · [Invitations API](https://learn.microsoft.com/en-us/linkedin/shared/integrations/communications/invitations) · [Messages API](https://learn.microsoft.com/en-us/linkedin/shared/integrations/communications/messages) · [Lead Sync API](https://learn.microsoft.com/en-us/linkedin/marketing/lead-sync/getting-access-leadsync) · [Conversation Ads API](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads/advertising-targeting/version/conversation-ads-integrations) · [Product Catalog](https://developer.linkedin.com/product-catalog) · [User Agreement](https://www.linkedin.com/legal/user-agreement) · [Prohibited software and extensions](https://www.linkedin.com/help/linkedin/answer/a1341387)

**Jurisprudencia:** [hiQ v. LinkedIn — 9th Cir. (Justia)](https://law.justia.com/cases/federal/appellate-courts/ca9/17-16783/17-16783-2022-04-18.html) · [Privacy World — consent judgment](https://www.privacyworld.blog/2022/12/linkedins-data-scraping-battle-with-hiq-labs-ends-with-proposed-judgment/) · [Morgan Lewis — lecciones del caso](https://www.morganlewis.com/blogs/sourcingatmorganlewis/2022/12/linkedin-v-hiq-landmark-data-scraping-suit-provides-guidance-to-data-scrapers-and-web-operators) · [Nubela — relato del fundador de Proxycurl](https://nubela.co/blog/is-scraping-linkedin-legal-in-2026/) · [Social Media Today — Proxycurl](https://www.socialmediatoday.com/news/linkedin-wins-legal-case-data-scrapers-proxycurl/756101/) · [The Record — ProAPIs](https://therecord.media/linkedin-sues-data-scraping-company) · [HeyReach — el ban de marzo 2026](https://www.heyreach.io/blog/heyreach-ban)

**Chile — legal:** [Ley 21.719 (BCN)](https://www.bcn.cl/leychile/navegar?idNorma=1209272) · [Diario Constitucional — vigencia](https://www.diarioconstitucional.cl/2026/06/12/la-ley-21-719-entra-en-vigor-el-1-de-diciembre-y-expone-vacios-en-regulacion-de-pequenas-empresas/) · [Emol — el Gobierno anuncia postergación, 4-08-2026](https://www.emol.com/noticias/Economia/2026/08/04/1207539/gobierno-postergar-ley-datos-personales.html) · [Araya — estado al 18-08-2026](https://araya.cl/ley-de-proteccion-de-datos-se-postergara-su-entrada-en-vigencia/) · [SII — valor UTM 2026](https://www.sii.cl/valores_y_fechas/utm/utm2026.htm) · [Confidata — interés legítimo y test de balanceo](https://confidata.cl/blog/interes-legitimo-ley-21719-test-balanceo-ejemplos-limites) · [SERNAC — Art. 28 B Ley 19.496](https://www.sernac.cl/portal/609/w3-propertyvalue-58918.html) · [SERNAC — No Molestar](https://www.sernac.cl/portal/617/w3-propertyvalue-63007.html)

**Chile — fuentes de datos:** [API Mercado Público / ChileCompra](https://www.chilecompra.cl/api/) · [ChileCompra — datos abiertos OCDS](https://data.open-contracting.org/en/publication/144) · [SII — Nóminas de personas jurídicas](https://www.sii.cl/sobre_el_sii/nominapersonasjuridicas.html) · [Registro de Empresas y Sociedades (datos.gob.cl)](https://datos.gob.cl/dataset/registro-de-empresas-y-sociedades) · [Diario Oficial — Sociedades](https://www.diariooficial.interior.gob.cl/tramites/sociedades/conocer/) · [DataReportal — Digital 2026 Chile](https://datareportal.com/reports/digital-2026-chile)

**Competencia y proveedores:** [CoPilot AI — pricing](https://www.copilotai.com/pricing) · [Apollo — las tareas de LinkedIn se completan a mano](https://knowledge.apollo.io/hc/en-us/articles/5646233248269-Complete-LinkedIn-Tasks-in-a-Sequence) · [Apollo — rate limits](https://docs.apollo.io/reference/rate-limits) · [Sales Navigator — comparar planes](https://business.linkedin.com/sales-solutions/compare-plans) · [Message Ads API](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads/advertising-targeting/version/message-ads-integrations) · [Prozer](https://prozer.io/prueba-prozer/) · [Clay — pricing](https://www.clay.com/pricing) · [Docket — análisis de precios de Clay](https://www.docket.io/resources/research/clay-pricing) · [Unipile — límites y restricciones](https://developer.unipile.com/docs/provider-limits-and-restrictions) · [Unipile — SDK de Node](https://github.com/unipile/unipile-node-sdk) · [FullEnrich — waterfall enrichment](https://fullenrich.com/blog/waterfall-enrichment) · [Cognism — FAQ de cobertura](https://www.cognism.com/faq) · [Outscraper — precios](https://outscraper.com/pricing/) · [HeyReach — límites de envío](https://help.heyreach.io/en/articles/9892903-how-to-configure-my-sending-limits)

**Seguridad y detección:** [Ampliflow — cómo LinkedIn detecta automatización](https://ampliflow.in/blog/how-linkedin-detects-automation) · [GetSales — guía de seguridad 2026](https://getsales.io/blog/linkedin-automation-safety-guide-2026/) · [ColdIQ — APIs de scraping de LinkedIn](https://coldiq.com/blog/best-linkedin-scraper-apis)
