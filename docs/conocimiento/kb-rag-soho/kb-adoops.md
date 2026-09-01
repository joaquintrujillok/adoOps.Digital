---
titulo: "Base de conocimiento adoOps para agente de reunión comercial en vivo"
marca: adoOps
version: "1.0 · 2026-09-01"
uso: >
  Base RAG para un agente que escucha una reunión comercial en vivo y sugiere a Joaquín
  qué decir, qué preguntar y qué no afirmar. Cada bloque encabezado con ### está escrito
  para funcionar como chunk autocontenido y ser citado casi textualmente en voz alta.
regla_cifras: >
  Este documento NO contiene precios, valores hora, tarifas, montos, UF, CLP, USD ni
  cubicaciones de esfuerzo. Sí contiene plazos, duraciones, umbrales técnicos, volúmenes
  funcionales y composición cualitativa del equipo. Si el cliente pregunta por valores,
  el agente debe indicar que la cifra se entrega en la propuesta formal, nunca improvisarla.
fuentes:
  - kb/reports/adoops.md (informe sintetizado del corpus adoOps)
  - kb/txt/adoops_solution_adoption_framework.pptx.txt
  - kb/txt/SGS_Referencia_-_adoOps.pptx.txt
  - kb/txt/SGS_00_-_LEEME_-_Contexto_del_proyecto.md.txt (INTERNO)
  - kb/txt/SGS_..._Propuesta_Tecnica_-_Asistente_SGI_-_adoOps.docx.txt (v1.3, 18-ago-2026)
  - kb/txt/SGS_..._Resumen_Ejecutivo_-_Asistente_SGI_-_adoOps.docx.txt
  - kb/txt/SGS_..._Anexo_de_seguridad_-_Asistente_SGI_-_adoOps.docx.txt (v1.0)
  - kb/txt/SGS_..._Propuesta_Asistente_SGI_-_adoOps.pptx.txt (deck PoC, 22 slides)
  - kb/txt/SGS_..._Propuesta_ejecutiva_-_Asistente_SGI_-_adoOps.pptx.txt
  - kb/txt/SGS_..._Mantenimiento_evolutivo_-_Asistente_SGI_-_adoOps.pptx.txt
  - kb/txt/adoOps_AgentOps_-_standalone.html.txt (SIN CONTENIDO ÚTIL — ver §3)
---

# Base de conocimiento adoOps — asistencia comercial en vivo

## 0. Cómo usar esta base (instrucciones para el agente en vivo)

### 0.1 Qué es esta base y qué se espera de ti

Eres el copiloto de Joaquín en una reunión comercial de adoOps. Escuchas, y en cada turno entregas como máximo tres cosas: **una frase para decir**, **una pregunta para hacer** y **una advertencia si corresponde**. No resúmenes largos. No teoría. El operador está hablando con un cliente y sólo puede leer de reojo.

Reglas de operación:

1. **Prioriza preguntar sobre afirmar.** El método adoOps es de diagnóstico. Si dudas entre sugerir una afirmación y sugerir una pregunta, sugiere la pregunta.
2. **Cita casi textual.** Las frases marcadas entre comillas en esta base están redactadas para decirse tal cual. Úsalas literalmente; están calibradas.
3. **Cero cifras comerciales.** Si el cliente pregunta precio, valor hora o costo mensual, la respuesta sugerida es siempre del tipo: *"Eso lo dimensionamos y te lo entregamos por escrito; hoy definamos el alcance, porque la cifra sale del alcance."* Nunca inventes un número, ni siquiera un rango.
4. **No prometas lo que §15 dice que no está probado.** Antes de sugerir un compromiso técnico, verifica §15 (divergencias y advertencias).
5. **Separa marca.** Esta base es sólo adoOps. Si la conversación deriva a fábrica de software, staffing o delivery a escala, ve a §14 y cambia de marco explícitamente.

### 0.2 Cómo enrutar lo que escuchas

| Si escuchas… | Ve a | Sugiere |
|---|---|---|
| "no encontramos los documentos", "no sabemos si está vigente", "procedimiento", "norma", "ISO", "auditoría" | §4 A-01, §5 | Caso SGS + pregunta 9.3 |
| "estamos evaluando Copilot / Copilot Studio / una plataforma" | §11 objeción 6, §2.6 | Los dos escenarios medidos con la misma vara |
| "y si alucina", "el bot va a decir cualquier cosa" | §11 objeciones 1 y 2 | Tres salidas + verificación de respaldo + set de evaluación |
| "¿dónde quedan nuestros datos?", "seguridad", "legal", "DPO" | §7 | Respuestas listas del anexo de seguridad |
| "ya probamos un chatbot y nadie lo usó" | §4 A-04, §11 objeción 7 | Ruta de aprendizaje medida + sesiones sobre consultas reales |
| "quién lo mantiene después" | §4 A-06, §8 | Bolsa mensual + runbook + traspaso a TI |
| "no tenemos política de IA todavía" | §4 A-05, §3 | AI Operating System + modelo desacoplado |
| "nuestra documentación es un desastre" | §11 objeción 8, §12 | Se reporta, no se remedia + primera entrega operativa como diagnóstico |
| "queremos un CRM / una plataforma X" | §2, §4 A-10 | Tesis adoOps: primero la capacidad, después la plataforma |
| El cliente pide una demo | §2.5 | "No proponemos una demo, proponemos un experimento" |

### 0.3 Los cinco movimientos que el agente debe intentar en toda reunión

1. **Instalar el método antes que el producto.** La venta de adoOps es el framework, no la pieza.
2. **Conseguir que el cliente nombre el costo del error.** Sin costo del error no hay urgencia.
3. **Reducir el pedido de cierre al mínimo.** El cierre no es firmar la implementación: es acordar qué es una buena respuesta y medirla.
4. **Fijar los umbrales antes de la prueba.** Es el diferenciador de método más fuerte.
5. **Dejar agendado el próximo paso concreto** con fecha, nombre y entregable.

### 0.4 Qué NO debe hacer el agente

- No dar cifras de precio, esfuerzo, valor hora ni costo mensual de nube.
- No afirmar que la capa multi-proveedor de modelos ya está construida (ver §15.1).
- No prometer WhatsApp como canal (ver §15.4).
- No prometer certificaciones propias de adoOps (ver §7.9).
- No prometer que adoOps corrige la documentación del cliente (ver §11 objeción 8).
- No atacar a Microsoft, a Copilot ni a ningún competidor. El tono es neutral y deportivo.
- No mezclar los umbrales de la PoC con los del proyecto de implementación (ver §15.2).

---

## 1. Identidad y posicionamiento de adoOps

### 1.1 Firma de marca y promesa

**Firma, presente al pie de todo entregable y como banda superior de todos los decks:**

> **adoOps · Adoptamos IA · Operamos IA · Escalamos IA**

En decks aparece en versalitas como banda permanente: `ADOPTAMOS IA · OPERAMOS IA · ESCALAMOS IA`.

**Frase de identidad corporativa (portada institucional):**

> *"Transformamos organizaciones mediante estrategias de adopción, agentes inteligentes, talento especializado y programas de desarrollo para convertir la Inteligencia Artificial en una capacidad real de negocio."*

De esa frase se leen las cuatro líneas de negocio: **estrategias de adopción · agentes inteligentes · talento especializado · programas de desarrollo (formación)**.

Sitio de marca: `adoops.digital`. Personas visibles en el material comercial: **Joaquín Trujillo** y **Nelson García**.

### 1.2 La tesis

Enunciada de forma explícita en el framework comercial:

> **Tesis adoOps:** *"Antes de implementar una plataforma, hay que diseñar la capacidad de negocio que esa plataforma debe habilitar."*

Corolarios textuales, todos utilizables en vivo:

- *"No desarrollamos un CRM. Aceleramos la adopción de soluciones tecnológicas conectadas al negocio."*
- *"CRM es el caso de uso; el diferencial es el método."*
- *"El CRM no es el producto final: es la primera capacidad a acelerar."*
- *"No te pedimos elegir entre HubSpot, Salesforce, Zoho u Odoo; primero validamos qué capacidad comercial necesitas y luego decidimos si se construye, integra o combina."*

El posicionamiento es, entonces: **método sobre producto** y **capacidad de negocio sobre plataforma**. Sustituye "CRM" por la plataforma que el cliente traiga a la mesa y la tesis sigue funcionando igual.

### 1.3 En qué se diferencia de un integrador y de una fábrica de software

| | Integrador de plataforma | Fábrica de software | **adoOps** |
|---|---|---|---|
| Qué vende | Implementar el producto que ya eligió el cliente | Capacidad de construcción por demanda | **Un método para convertir IA en capacidad de negocio adoptada** |
| Punto de partida | La plataforma ya está decidida | El requerimiento ya está escrito | **La capacidad de negocio todavía no está diseñada** |
| Criterio de éxito | Salió a producción | Se entregó lo pedido | **Se usa, se mide y sostiene evidencia** |
| Qué queda del proyecto | Una plataforma configurada | Código entregado | **Reglas de negocio propias, gobierno, hábitos y un tablero de medición** |
| Relación con el proveedor de IA | Hereda el del ecosistema | El que pida el cliente | **Desacoplado por diseño: "el motor se elige, no se hereda"** |

Frases de contraste para decir en vivo:

- *"Nosotros no llegamos a implementar la herramienta que ya eligieron. Llegamos antes: a diseñar la capacidad que esa herramienta tiene que habilitar."*
- *"Lo único que no se reemplaza son las reglas que determinan cuándo el sistema responde, cuándo pregunta y cuándo se abstiene. Eso es lo que estamos construyendo. Ninguna plataforma lo trae de fábrica: se diseña con ustedes."*
- *"La lógica es nuestra, el motor es intercambiable."*

### 1.4 Propuesta de valor en cuatro puntos

1. **Control de riesgo por evidencia.** *"La ventaja comercial del framework es el control de riesgo. El cliente no se casa con una gran implementación: valida, aprende y escala por evidencia."*
2. **Validar antes de comprometer presupuesto.** La etapa *Prove* existe *"justamente para no comprometer presupuesto de despliegue sin evidencia"*.
3. **La lógica es propia, el motor es intercambiable.** El diferencial no es el modelo ni la documentación: es el agente y sus reglas.
4. **Adopción medible, no entrega de artefactos.** Gobierno de uso, entrenamiento, hábitos y métricas están dentro del alcance, no en el "después".

### 1.5 Tono de marca — cómo suena adoOps

- Español de Chile, registro profesional-ejecutivo, **frases cortas y declarativas**, con vocación de aforismo.
- **Contraste retórico sistemático**: "No proponemos X, proponemos Y". Ejemplos reales: *"No proponemos una demo. Proponemos un experimento con criterio de éxito acordado de antemano"* · *"No es un buscador con lenguaje natural. Es un agente con reglas"* · *"reportes accionables, no solo dashboards"* · *"Una ficha, no un párrafo"* · *"La cita es un objeto, no un enlace"* · *"La derivación es un entregable, no un mensaje de error"*.
- **Honestidad calibrada como táctica**: se reconocen los límites en voz alta (*"adoOps no aporta certificaciones propias en este alcance y no las declara"*), y la exclusión explícita se usa como señal de rigor.
- **Neutralidad frente al competidor**, textual de la nota de orador: *"Tono neutral y deportivo. No atacamos Copilot: proponemos el método que hace justa la comparación. Quien propone la vara honesta gana credibilidad."*
- **Barra de calidad visual** como requisito, no como comentario: *"a muy buen nivel de UX/UI, que no parezca que lo hizo un agente"*.

### 1.6 Aforismos de marca — repertorio para decir en vivo

Úsalos tal cual. Están calibrados y son reconocibles.

- *"Una respuesta inventada cuesta más que una respuesta ausente."*
- *"Un sistema que sólo sabe responder es un sistema que inventa."*
- *"Es un agente con reglas, que sabe cuándo responder, cuándo preguntar y cuándo callarse."*
- *"La lógica es nuestra, el motor es intercambiable."*
- *"El motor se elige, no se hereda."*
- *"Insumos conectables, no etapas del flujo."*
- *"La derivación es un entregable, no un mensaje de error."*
- *"Cada derivación identifica una brecha."*
- *"La cita es un objeto, no un enlace."*
- *"Mostrar la incertidumbre es lo que hace confiable la certeza."*
- *"Una ficha, no un párrafo."*
- *"No son dos sistemas distintos: es el mismo cambiando de suscripción. El paso a producción es un despliegue, no una reconstrucción."*
- *"La diferencia no es de resultado, es de techo."*
- *"Un índice mal calibrado degrada el sistema sin generar señales visibles."*
- *"Las tablas se procesan íntegras, ya que una matriz de riesgo fragmentada pierde su significado."*
- *"En cumplimiento normativo, una respuesta sin fuente no es una respuesta."*

### 1.7 Interlocutores naturales de adoOps

- **Dueño del proceso de negocio** (el área que sufre el dolor): es quien nombra el costo del error.
- **Calidad, cumplimiento, auditoría, prevención de riesgos**: valoran trazabilidad y vigencia.
- **Seguridad de la información**: el anexo de seguridad está escrito para ellos (§7).
- **TI / arquitectura**: aprueban permisos, suscripción y despliegue; son bloqueantes.
- **Comité o dirección**: compran el framework y el control de riesgo, no la arquitectura.

Regla de conversación: **el dolor lo declara el negocio, el permiso lo da TI, y el presupuesto lo aprueba la dirección.** Si en la reunión falta uno de los tres, la pregunta de cierre es quién es y cuándo se suma (ver §9.11).

---

## 2. El Solution Adoption Framework™

### 2.1 Qué es, en una frase

**Solution Adoption Framework™** (también escrito *"Solución de Adopción Framework™"*) es el método propietario de adoOps para convertir una necesidad de negocio en una solución adoptada, medible y escalable. Versión corta, la que se dibuja en una servilleta:

> **Diagnóstico → PoC → Adopción → Escala**

Versión completa: **cinco movimientos** — Understand · Design · Prove · Adopt · Scale.

Encuadre para decirlo en vivo:
> *"Un framework para validar valor rápido, operar con usuarios reales y escalar solo lo que demuestra impacto."*

### 2.2 Las cinco etapas y qué produce cada una

| # | Etapa | Qué se hace | Qué produce (salida verificable) |
|---|---|---|---|
| 01 | **Understand** | Dolor y objetivo · procesos críticos · datos disponibles · decisión de negocio en juego | Diagnóstico del dolor, mapa de procesos críticos, inventario de datos y fuentes |
| 02 | **Design** | Blueprint funcional · integraciones · KPIs de negocio · experiencia de uso | Blueprint, mapa de integraciones, set de KPIs acordado |
| 03 | **Prove** | PoC / *Validation Sprint* con usuarios reales, MVP validable | Evidencia medida contra umbrales acordados antes de correr la prueba |
| 04 | **Adopt** | Modelo operativo · entrenamiento · gobierno de uso · hábitos | Ruta de aprendizaje, gobierno de uso, artefacto de adopción, métricas de uso |
| 05 | **Scale** | Roadmap de 90 días · automatizaciones · mejora continua | Hoja de ruta priorizada y ciclo de mejora instalado |

**Nota de vocabulario:** en el framework comercial genérico la etapa Prove se ofrece como *"PoC sin costo"*; en la versión aplicada al caso SGS aparece como *"PoC medida"*. En vivo, di **"PoC medida"** o **"Validation Sprint"** salvo que Joaquín decida ofrecerla sin costo, que es una decisión comercial suya, no del agente.

### 2.3 La Decisión del Sprint

La salida formal de la etapa **Prove** no es un informe: es una decisión de cuatro opciones.

> **Decisión del Sprint: Construir · Integrar · Automatizar · Descartar** *"con evidencia, usuarios y métricas"*

Cómo se dice en vivo:
> *"Al final del sprint no les entregamos un informe con recomendaciones. Les entregamos una decisión de cuatro opciones, con la evidencia detrás: se construye, se integra, se automatiza o se descarta. Descartar también es un resultado válido, y es barato descartar a las cuatro semanas."*

### 2.4 Señales del cliente que activan el framework

Estas cinco señales vienen del diagnóstico comercial del framework (caso CRM), y son reutilizables como checklist de escucha en cualquier dominio:

| # | Señal | Cómo suena en la reunión |
|---|---|---|
| 01 | **Trazabilidad** | "no sabemos de dónde vino esa oportunidad / ese dato / esa respuesta" |
| 02 | **Priorización** | "no sabemos dónde poner el foco / quién tiene más potencial" |
| 03 | **Acción** | "tenemos los datos pero nadie hace nada con ellos" |
| 04 | **Operación** | "el proceso se cae entre sistemas" |
| 05 | **Decisión** | "tenemos dashboards, pero no decidimos con ellos" → *"reportes accionables, no solo dashboards"* |

Capacidades tipo que el framework promete como resultado en el caso comercial: trazabilidad marketing→ventas · scoring y oportunidades · alertas e insights comerciales · integración inventario/stock · reportería útil para decidir.

### 2.5 Demo vs. Experimento — el argumento de método

Es el argumento más fuerte del framework y el que más credibilidad genera. Tabla textual:

| DEMO | EXPERIMENTO |
|---|---|
| El proveedor elige las preguntas | El equipo del cliente aporta las preguntas reales |
| Se evalúa por impresión | Se evalúa **a ciegas**, sin saber qué sistema respondió |
| El criterio de éxito se define después | Los umbrales se acuerdan **antes** de la prueba |
| No es reproducible | Cualquiera puede repetir la medición |

Frase de apertura recomendada cuando el cliente pide "una demo":
> *"No proponemos una demo. Proponemos un experimento con criterio de éxito acordado de antemano. Sus documentos, sus preguntas, resultado medido."*

Nota de orador que explica por qué funciona: *"Fijar los umbrales antes es lo que nos da credibilidad y lo que impide que el criterio se mueva cuando aparezcan los resultados."*

### 2.6 Cómo se usa el framework para ubicar una propuesta

El framework sirve para que cualquier propuesta concreta se lea como parte de un mapa mayor en vez de como una venta suelta. Formulación textual usada con el cliente:

> *"Solution Adoption Framework™ — esta propuesta cubre el tercer movimiento. Estamos proponiendo Prove: la etapa que produce evidencia antes de comprometer presupuesto de implementación."*

Uso en vivo: cuando el cliente pregunte "¿y esto en qué queda después?", señala el movimiento siguiente (Adopt) y el posterior (Scale), y deja claro que ya están diseñados. Nunca dejes la propuesta huérfana de mapa.

### 2.7 Métricas de adopción — impacto vs. uso

El material no trae un cuadro canónico de KPIs del framework. Lo que sí existe, y es lo que hay que usar, son las métricas efectivamente instrumentadas. Se separan en dos familias:

**Métricas de USO (¿la organización lo está usando?)**
- Volumen real de consultas medido — *"responde la pregunta del levantamiento que quedó sin cifra"*
- Porcentaje de usuarios inscritos que **completa la ruta de aprendizaje y aprueba el examen** (umbral comprometido en el caso SGS: **≥85%**)
- Avance de la ruta de aprendizaje, visible para la jefatura desde el día de la entrega
- Distribución de consultas por dominio y por rol
- Consultas frecuentes reales, recogidas en la primera sesión de acompañamiento

**Métricas de IMPACTO (¿está cambiando algo?)**
- **Consultas resueltas sin recurrir al equipo experto** — KPI nombrado por el propio cliente
- **Tiempo hasta tener la información completa** — KPI nombrado por el propio cliente
- **Brechas documentales priorizadas** a partir de consultas recurrentes sin respaldo
- Derivaciones que debieron haberse resuelto (mide calidad, no volumen)
- Reportes de respuesta incorrecta enviados por usuarios

**Métricas del ciclo de mejora continua:** uso, calidad, costos y riesgos.

Regla de conversación: **el cliente casi siempre trae métricas de uso y ninguna de impacto.** La pregunta que hay que hacer está en §9.9: *"¿Qué número, de los que hoy miden, tendría que moverse para que dentro de seis meses digan que esto valió la pena?"*

### 2.8 Cómo se explica el framework en una reunión — guion de 45 minutos

Formato indicado en la propia plantilla comercial: **1 slide "brutal" + 3 slides extendidas + 20 minutos de conversación y demo.**

Agenda sugerida:

| Bloque | Duración | Objetivo |
|---|---|---|
| 01 · Framework | 10 min | Alinear que la plataforma es medio, no fin |
| 02 · Caso del cliente | 10 min | Mapear necesidades contra capacidades priorizadas |
| 03 · Demo | 20 min | Mostrar trazabilidad, alertas, acciones y reporte |
| 04 · Validation Sprint | 5 min | Proponer la PoC acotada para validar adopción |

Cierre sugerido textual:
> *"Validemos el caso con un PoC acotado y decidamos con evidencia qué conviene escalar."*

Nota de orador del cierre: *"pedir permiso para trabajar un Validation Sprint. Definir un flujo específico: oportunidad → scoring → alerta → recomendación → seguimiento → reporte de negocio."* El patrón es general: **cierra pidiendo permiso para un flujo específico, nombrado punta a punta**, no para "un piloto".

### 2.9 Errores de exposición del framework que hay que evitar

- Presentar las cinco etapas como cronograma. No son fases de un proyecto: son movimientos, y varios corren en paralelo (en SGS, Prove corre en paralelo al desarrollo).
- Vender el framework en abstracto. Siempre aterriza en el caso del cliente antes del minuto 10.
- Saltarse Understand porque "el cliente ya sabe lo que quiere". Justamente ahí está la venta.
- Ofrecer la PoC sin criterio de éxito. Una PoC sin umbrales acordados antes es una demo.
- Dejar Adopt y Scale como "después". Son alcance, no promesa.

---

## 3. AgentOps

### 3.1 Advertencia de cobertura — leer antes de usar el término

⚠️ **El corpus adoOps no contiene ninguna definición de "AgentOps".** El único archivo con ese nombre (`adoOps AgentOps - standalone.html`) es una página HTML cuyo contenido está embebido en JavaScript; el texto extraíble se reduce a `Bundled Page`, `This page requires JavaScript to display.`, `ado Ops` y `Unpacking...`.

**Consecuencia operativa para el agente en vivo:** no expliques "AgentOps" como si fuera un marco documentado. Si el cliente lo menciona o si Joaquín lo nombra, apóyate en lo que sí está descrito y es equivalente en función: el **adoOps AI Operating System** y la capa de operación y mejora continua de agentes en producción. Todo lo de §3.2 a §3.6 está respaldado por el material; el nombre "AgentOps" no lo está.

### 3.2 adoOps AI Operating System — el marco documentado

> **AdoOps AI Operating System** — *"De la estrategia a la operación. De la operación al impacto. Un sistema integral para gobernar, operar y mejorar la IA de forma responsable y escalable."*

**Tres pilares:**

| # | Pilar | Definición textual | Qué cubre |
|---|---|---|---|
| 01 | **Governance** | *"Decidimos con claridad."* | Define qué puede hacer la IA, por qué y con qué límites |
| 02 | **Superagency** | *"Operamos la IA de forma segura."* | Capa operacional / agéntica: el agente en producción |
| 03 | **Intelligence & Improvement** | *"Medimos, aprendemos y mejoramos."* | Observa uso y desempeño para optimizar valor, controlar riesgos y evolucionar la gobernanza |

**Cuatro objetivos del sistema:** 01 Cumplimiento (ley, ética y estándares) · 02 Confianza (transparencia y control) · 03 Valor (innovación y eficiencia) · 04 Adaptabilidad (evolución continua).

**Niveles de gobernanza:** Dirección → Gobernanza → Control → Delivery → Adopción.

**Guardrails transversales:** Valor · Riesgo · Datos · IA · Seguridad · Personas.

**Resultado declarado:** cumplimiento y trazabilidad · riesgo legal, ético y reputacional controlado · confianza para innovar.

**Ecuación de cierre, para pizarra:**
> *"IA gobernada + operación segura + mejora continua = Impacto sostenible"* bajo el lema *"Más valor · Menos riesgo · Adopción efectiva"* y *"Escala la IA con confianza, evidencia y aprendizaje."*

### 3.3 El ciclo de mejora continua (cómo se opera un agente en producción)

| Paso | Nombre | Qué observa / hace |
|---|---|---|
| 1 | **Monitorear** | Uso, calidad, costos y riesgos |
| 2 | **Evaluar** | Modelos, controles y desempeño |
| 3 | **Aprender** | Insights que generan mejoras |
| 4 | **Adaptar** | Políticas, agentes y procesos |
| 5 | **Escalar** | Más valor y mejor experiencia |

Este ciclo es la respuesta canónica a "¿y quién se queda a cargo después?". Es el mismo ciclo que se materializa en la bolsa mensual de mantenimiento evolutivo (§8).

### 3.4 Qué significa "operar un agente" en la práctica adoOps

Traducción concreta del pilar Superagency, tomada de lo que efectivamente se compromete en un proyecto:

- **Monitoreo, alertas y atención de incidentes** sobre el agente en producción.
- **Supervisión de la reingesta y del estado del corpus**: el conocimiento del agente se desactualiza solo, y esa es la falla de mayor impacto.
- **Ajuste de reglas, umbrales y vocabulario** a partir de las consultas reales, no de supuestos de diseño.
- **Actualización de modelos y revalidación del scorecard**: cuando cambia el modelo, se vuelve a correr el set de evaluación. El modelo no se cambia a ciegas.
- **Informe periódico de uso, cobertura y brechas documentales.**
- **Sesión periódica de revisión** con la contraparte del cliente.
- **Control de consumo**: presupuesto configurable con alerta al umbral, verificación previa a cada consulta e **interruptor de corte (kill switch)** operable por TI del cliente.
- **Registro de auditoría de sólo adición** de consulta, evidencia, decisión y respuesta.

### 3.5 Cómo escala un agente en producción

Tres ejes de escalamiento, todos presentes en el material:

1. **Escala por volumen de consultas, no por usuarios.** Es un diferenciador comercial explícito frente al licenciamiento por usuario/mensaje de las plataformas cerradas. El costo crece de forma acotada frente a incrementos significativos de uso, porque el componente principal es infraestructura encendida por hora, no consumo por consulta.
2. **Escala por fuentes.** El perímetro documental es intercambiable y ampliable: SharePoint Online, repositorios de red, Google Drive, otros gestores documentales. Ampliar fuentes no obliga a rehacer el núcleo.
3. **Escala por canales y por dominios.** Un mismo núcleo de reglas alimenta portal web, Teams, SharePoint, móvil y API. Ampliar dominios normativos es ingesta y evaluación, no arquitectura nueva.

⚠️ **Límite honesto que hay que declarar:** ampliar el corpus a documentos con acceso restringido **no** es escalar; es **modificación de alcance**, porque obliga a filtrar la recuperación según permisos efectivos y eso cambia el diseño del índice. Dilo antes de que lo pregunten (§7.6).

### 3.6 Cómo se dice esto en una reunión

> *"El agente no es un entregable, es un sistema que hay que operar. Nosotros lo entregamos con su tablero, sus alertas, su presupuesto, su corte y su runbook, y con un manual para que la operación del día a día no dependa de nosotros. Y después, si quieren, lo operamos con ustedes: monitoreo, ajuste de reglas con las consultas reales, revalidación del scorecard cuando cambia el modelo, e informe mensual."*

Cierre para el escéptico:
> *"La pregunta correcta no es si el agente funciona el día del go-live. Es si sigue funcionando el día que cambian tres procedimientos y sale un modelo nuevo. Eso se opera."*

---
## 4. Catálogo de soluciones adoOps

> **Cómo usar este catálogo en vivo.** Cada ficha es un chunk autocontenido. El campo **Señales en la conversación** es el disparador: si escuchas una de esas frases, esa ficha es la que corresponde. El campo **Preguntas que debo hacer** se dice tal cual. El campo **Dependencias del cliente y riesgos** es lo que hay que levantar en la misma reunión, no después. Todas las fichas comparten el mismo núcleo adoOps: reglas de negocio, orquestación y verificación de respaldo.

### A-01 · Asistente conversacional corporativo con RAG sobre documentación normativa

**Tags:** RAG · documentación normativa · cumplimiento · ISO · SharePoint · vigencia de documentos · citación · agente con reglas · caso insignia

**Una línea:** Un asistente que responde consultas sobre el cuerpo normativo de la empresa citando documento, sección y versión, que advierte cuando la fuente está superada y que deriva al equipo responsable cuando no hay respaldo documental.

**Para quién:** Áreas dueñas de sistemas de gestión y cuerpos normativos — calidad, prevención de riesgos, salud y seguridad ocupacional, cumplimiento, operaciones reguladas, auditoría interna. El comprador es el área dueña de la documentación; el aprobador técnico es TI.

**Señales en la conversación de que aplica:**
- "tenemos todo en SharePoint pero la gente no lo encuentra"
- "encuentran el documento y no saben si está vigente"
- "nos llegaron no conformidades / observaciones de auditoría"
- "el equipo experto se pasa el día contestando las mismas preguntas por correo y por Teams"
- "cuando viene la fiscalización no tenemos la respuesta a mano"
- "cada uno tiene su copia del procedimiento"
- "hay versiones distintas dando vueltas"

**Qué incluye:**
- Ingesta del corpus documental preservando estructura, con **tablas íntegras** como unidad
- Enriquecimiento de metadatos a campos propios: código, versión, fecha de vigencia, estado, plazos, referencias cruzadas
- Índice híbrido: semántico (vectorial) + léxico (término exacto), con reranking
- Núcleo de reglas de negocio auditables sobre grafo de decisión
- Verificación de respaldo como paso separado de la generación
- Tres salidas gobernadas: responder con cita / repreguntar / derivar
- Advertencia de documento superado
- Portal web con SSO y canal Microsoft Teams
- Panel del área dueña con volumen, KPIs y brechas documentales
- Set de evaluación y scorecard firmado
- Ruta de aprendizaje y acompañamiento de adopción

**Las cinco reglas de negocio (decirlas tal cual, y pausar):**

| N° | Regla | Cómo se implementa |
|---|---|---|
| 1 | **No responde sin fuente** | Toda afirmación queda asociada a un fragmento recuperado; lo que no se puede asociar se descarta de la respuesta |
| 2 | **Si la consulta es ambigua, pregunta antes de responder** | Umbral de confianza sobre la recuperación; bajo ese umbral solicita la precisión faltante |
| 3 | **Si no hay respaldo documental, deriva — no improvisa** | Escalamiento al equipo responsable con el caso estructurado. *"La derivación constituye una respuesta válida del sistema"* |
| 4 | **Si el documento está superado, lo advierte** | Comparación contra metadatos de versión y vigencia extraídos en la ingesta; la advertencia **precede** a la respuesta |
| 5 | **Cita siempre documento, sección y versión** | La cita se construye desde los metadatos del fragmento y enlaza de vuelta al repositorio de origen |

**Arquitectura y stack:**
- **Canales:** portal web con SSO + aplicación de Microsoft Teams (tarjetas adaptables)
- **Núcleo adoOps:** orquestación por grafo de decisión, reglas de negocio, verificación de respaldo y citación
- **Recuperación:** búsqueda híbrida densa + léxica, fusión y reranking (de 30 candidatos a los 6–8 más pertinentes; especificación interna: reranking cross-encoder 30→8)
- **Índice:** PostgreSQL con **pgvector**, índice **HNSW**, índice de texto completo (**tsvector**), metadatos de versión y vigencia
- **Ingesta:** conector a Microsoft Graph con **delta query**, extracción con estructura, fragmentación jerárquica (documento → sección → subsección) con solapamiento, enriquecimiento de metadatos, vectorización (embeddings de 1.536 dimensiones, `text-embedding-3-small`)
- **Modelos:** capa de abstracción de proveedor sobre Azure OpenAI Service (ver §15.1)
- **Orquestación (detalle técnico):** LangGraph StateGraph, flujo `classify → retrieve → generate`
- **Transversal:** identidad, trazabilidad, observabilidad y control de presupuesto

**Entregables:**
- Asistente en producción dentro de la suscripción del cliente
- Portal web con SSO contra el directorio corporativo
- Aplicación de Teams publicada en el catálogo de la organización
- Pipeline de ingesta con reingesta incremental automatizada
- Índice de conocimiento con metadatos de versión y vigencia
- Panel de observabilidad, alertas, límite de presupuesto e interruptor de corte
- Documento técnico de arquitectura, **manual de operación y traspaso para TI**, **runbook de incidentes y reversión**
- **Scorecard** de evaluación contra el set de preguntas validado por el cliente
- Módulos de aprendizaje publicados, examen con corrección automática y panel de avance
- Artefacto de adopción personalizado e informe final con hoja de ruta

**Fases típicas (caso SGS, nueve semanas punta a punta):**

| Fase | Semanas | Hito de cierre |
|---|---|---|
| P0 · Primera entrega operativa | 1–3 | Informe de la primera entrega operativa |
| F0 · Levantamiento técnico | 1 | Solicitudes cursadas y corpus inventariado |
| F1 · Ingesta y corpus | 2 | El corpus consultable, con versión y vigencia |
| F2 · Motor y reglas | 2–4 | El asistente responde con cita y respeta las cinco reglas |
| F3 · Canales e interfaz | 4–5 | Ambos canales usables sin instrucción previa |
| F4 · Evaluación | 5–6 | **Scorecard firmado** |
| F5 · Entrega | 6 | Entrega y puesta en producción |
| F6 · Ruta de aprendizaje | 3–9 | Umbral de finalización y aprobación cumplido |
| F7 · Consultoría de adopción | 6–9 | Informe de adopción y hoja de ruta |

Hitos macro: **S3** resultados de la primera entrega operativa · **S6** entrega y go-live · **S9** informe de adopción con métricas y hoja de ruta. Cláusula clave que hay que decir siempre: *"El plazo corre desde que los pre-requisitos están cumplidos, no desde la firma."*

**Equipo (composición cualitativa; cada rol se define por el compromiso que asume ante el cliente):**

| Rol | De qué responde ante el cliente |
|---|---|
| Ingeniería de IA y recuperación | Que el asistente responda con respaldo documental y respete las cinco reglas |
| Ingeniería de datos e ingesta | Que los documentos entren con su versión, su vigencia y sus tablas intactas |
| Desarrollo de aplicación | Que el portal y el canal de Teams se usen sin instrucción previa y que la cita sea navegable |
| Adopción y diseño instruccional | Que la ruta de módulos y el examen queden publicados en el ecosistema del cliente |
| Dirección de proyecto y arquitectura | Que el calendario se cumpla y que la arquitectura sea auditable por TI |
| DevOps, seguridad y despliegue | Que el despliegue tenga reversión y control de presupuesto y que el traspaso quede documentado |
| QA y evaluación | Que el scorecard se mida sobre el corpus real y se firme |
| Consultoría de adopción | Que la adopción se compruebe sobre consultas reales y quede un plan de continuidad |

Núcleo de desarrollo: tres personas durante seis semanas, más una en diseño instruccional a media jornada. Dirección de proyecto y arquitectura transversal y parcial. adoOps designa **un responsable de proyecto único**.

**Dependencias del cliente y riesgos:**
- Suscripción cloud provista y operativa, y **cuota del servicio de modelo aprobada en la región definida** — *"la única condición del proyecto que adoOps no controla"*
- Permisos de acceso al repositorio aprobados (sin permisos no hay ingesta)
- Grupos de seguridad definidos en el directorio corporativo
- Contraparte técnica y funcional designadas con nombre y disponibilidad agendada
- Administrador del catálogo de Teams identificado (rol distinto del que aprueba los permisos del repositorio)
- Set de preguntas de evaluación validado por el cliente antes de la fase de evaluación
- Riesgos altos: calidad del corpus peor de lo previsto · tablas complejas mal extraídas · parámetros del índice mal calibrados (*"un índice mal calibrado degrada el sistema sin generar señales visibles"*) · disponibilidad insuficiente de la contraparte · habilitación de nube no resuelta a tiempo
- Riesgo de expectativa: que el cliente espere que el asistente **corrija** la documentación. Se fija desde el primer módulo de la ruta de aprendizaje

**Casos que la respaldan:** **SGS Chile — área Health & Safety** (ver §5, caso insignia): ~700 documentos del sistema de gestión integrado en SharePoint Online, hasta 100 usuarios habilitados, dos dominios de piloto (Gestión de Incidentes y Seguridad en el Transporte), dos canales, go-live en la semana 6 de un proyecto de nueve semanas.

**Preguntas que debo hacer:**
- ¿Cuántos documentos son, en qué formatos, y dónde viven hoy? ‹fuente: SGS›
- ¿Cada cuánto se revisan y se reemplazan esas versiones? ‹fuente: SGS›
- ¿Toda esa documentación es de acceso general, o hay documentos restringidos por rol, área o país? ‹fuente: SGS›
- ¿Qué pasa hoy cuando alguien responde con el documento equivocado? ‹fuente: SGS›
- ¿En qué dos o tres temas se concentran las consultas? ‹fuente: SGS›
- ¿Pueden facilitarnos entre veinte y cincuenta documentos representativos y el listado de preguntas frecuentes reales? ‹fuente: SGS›
- ¿Qué considera su equipo experto que es una **buena respuesta**? ‹fuente: SGS›

---

### A-02 · Agentes de negocio con reglas explícitas y auditables

**Tags:** agente de negocio · grafo de decisión · reglas auditables · orquestación con herramientas · derivación · integración a sistemas de destino

**Una línea:** El mismo núcleo del asistente documental aplicado a un proceso de negocio: un agente que decide con reglas explícitas cuándo responder, cuándo pedir más información y cuándo escalar a una persona, dejando registro auditable de cada decisión.

**Para quién:** Áreas de operación, servicio, comercial o soporte interno donde hoy una persona experta responde consultas repetitivas con criterio, y ese criterio es explicitable.

**Señales en la conversación de que aplica:**
- "todo pasa por dos personas que saben cómo se hace"
- "el proceso está escrito pero nadie lo sigue igual"
- "necesitamos que alguien filtre antes de que llegue al equipo"
- "queremos automatizar, pero no podemos permitirnos que se equivoque"
- "necesitamos poder explicar por qué el sistema decidió eso"

**Qué incluye:**
- Diseño de las reglas de negocio con el equipo dueño del proceso (no se heredan de una plataforma)
- Implementación de cada regla como **nodo explícito de un grafo de decisión**, auditable con independencia del modelo
- Orquestación con herramientas: buscar, leer contexto completo, verificar condiciones, cruzar fuentes y repreguntar antes de responder
- Verificación de respaldo previa a la entrega
- Derivación estructurada a la persona o al equipo responsable
- Registro de auditoría de la decisión tomada en cada caso

**Arquitectura y stack:**
- **Núcleo adoOps** (no depende de proveedor): reglas de negocio · orquestación · verificación de respaldo
- **Canales de acceso** (perímetro intercambiable): portal web · Microsoft Teams · SharePoint · móvil · API
- **Fuentes** (perímetro intercambiable): SharePoint Online · repositorios de red · Google Drive · otros gestores documentales
- **Modelos de lenguaje** (*"el motor se elige, no se hereda"*): Azure OpenAI · Anthropic · OpenAI · Amazon Bedrock · modelos abiertos autoalojados
- **Sistemas de destino** (hacia dónde escala y registra): correo corporativo · Microsoft Teams · mesa de ayuda / tickets · registro de auditoría
- Condición transversal declarada: *"Se despliega en la nube del cliente · Autenticación con el directorio corporativo · Los datos no salen de su infraestructura"*

**Entregables:** mapa de reglas de negocio acordado y firmado · agente en operación · integración a los sistemas de destino acordados · registro de auditoría de decisiones · set de evaluación y scorecard · documentación técnica, manual de operación y runbook.

**Fases típicas:** Understand (dolor, proceso, datos, decisión) → Design (blueprint, integraciones, KPIs) → Prove (PoC medida con usuarios reales) → Adopt (operación, gobierno, capacitación, hábitos) → Scale (roadmap, automatizaciones, mejora continua).

**Equipo:** ingeniería de IA y orquestación · ingeniería de datos e integración · desarrollo de aplicación · dirección de proyecto y arquitectura · DevOps y seguridad · QA y evaluación · consultoría de adopción.

**Dependencias del cliente y riesgos:**
- Que exista un dueño del proceso con autoridad para declarar cuál es la regla correcta
- Que el criterio experto sea explicitable; si el criterio real es "depende", eso hay que descubrirlo en Understand y no en producción
- Accesos a los sistemas de origen y de destino
- Riesgo principal: reglas mal declaradas que el agente aplica con consistencia perfecta. La consistencia amplifica el error de diseño

**Casos que la respaldan:** el caso documentado con reglas explícitas de punta a punta es el Asistente SGI (§5). Para procesos no documentales, presenta la arquitectura núcleo/perímetro como capacidad, no como caso entregado.

**Preguntas que debo hacer:**
- ¿Quién decide hoy, y con qué criterio, cuando el caso no es obvio?
- ¿Ese criterio está escrito en alguna parte o vive en la cabeza de alguien?
- ¿Qué tiene que pasar para que ustedes acepten que el sistema decida solo?
- ¿Qué decisiones **nunca** quieren que tome sin una persona?
- ¿A quién escala hoy lo que no se puede resolver, y en qué formato le llega?
- ¿Dónde tiene que quedar registrado lo que el agente decidió?

---

### A-03 · Integración con canales corporativos (portal web, Microsoft Teams, SharePoint, móvil, API)

**Tags:** canales · Microsoft Teams · portal web · SSO · tarjetas adaptables · adopción por canal · Bot Service

**Una línea:** Llevar el mismo agente, con las mismas reglas y el mismo índice, a los canales donde la gente ya trabaja, sin duplicar lógica ni abrir una segunda fuente de verdad.

**Para quién:** Organizaciones con una herramienta corporativa de colaboración instalada donde ya vive el trabajo diario, y con población mixta (internos y externos, escritorio y terreno).

**Señales en la conversación de que aplica:**
- "la gente vive en Teams"
- "no quiero otra plataforma más que abrir"
- "tenemos gente en terreno que no entra al portal"
- "hay personal externo que no está en el Teams corporativo"
- "queremos que quede embebido donde ya trabajan"

**Qué incluye:**
- **Portal web** con SSO contra el directorio corporativo, conversación con citas navegables, panel de fuentes consultadas, indicadores visibles de vigencia, historial por usuario y canal de reporte de respuesta incorrecta
- **Microsoft Teams**: aplicación publicada en el catálogo de la organización, SSO dentro de Teams y **tarjetas adaptables** con respuesta, cita y advertencia de vigencia; cada respuesta enlaza al portal para ver la evidencia completa
- Ambos canales como **capas de presentación sobre la misma API, las mismas reglas y el mismo índice**

**Criterio de uso (decirlo así, es un argumento y no una limitación):**

| Canal | Dónde luce mejor |
|---|---|
| **Portal web** | Lectura y verificación: presenta completa la cita, el panel de fuentes y la advertencia de vigencia |
| **Microsoft Teams** | Consulta rápida dentro del flujo de trabajo, sin cambiar de app. **Es el canal que favorece la adopción** |

> *"Teams favorece la adopción porque las personas ya trabajan en esa herramienta; el portal conserva la presentación completa de la evidencia, que en tarjetas adaptables resulta limitada. Tener los dos permite sostener la adopción sin renunciar a la trazabilidad de la respuesta."*

**Arquitectura y stack:** Azure Bot Service y app publicada en el catálogo de Teams del tenant · portal sobre Azure Container Apps o Static Web Apps · SSO con Microsoft Entra ID · tarjetas adaptables · misma API del agente. Soportados por la arquitectura como perímetro ampliable: SharePoint como canal, móvil y API pública a terceros.

**Entregables:** portal web operativo con SSO · app de Teams publicada en el catálogo · documentación de publicación y del proceso de aprobación · ambos canales usables sin instrucción previa (criterio de cierre de fase).

**Fases típicas:** se ejecuta como una fase propia dentro del proyecto (en el caso SGS, semanas 4–5), con el trámite de aprobación del catálogo iniciado varias semanas antes para no condicionar la entrega.

**Equipo:** desarrollo de aplicación (peso principal) · DevOps para publicación y despliegue · QA para pruebas de canal · dirección para la gestión del trámite administrativo.

**Dependencias del cliente y riesgos:**
- **Administrador de Teams identificado** — autoriza la publicación en el catálogo y **es un rol distinto** del que aprueba los permisos de acceso al repositorio. Es la dependencia más olvidada del proyecto
- Mitigación declarada: si la aprobación no llega a tiempo, la entrega se realiza igualmente con el portal web operativo y el canal de Teams se habilita al recibirse
- **Personal externo sin acceso al Teams corporativo**: se confirma en el levantamiento qué proporción de usuarios es externa; el portal con SSO cubre a quienes no acceden a Teams
- App móvil nativa y API pública a terceros: viables y naturales como evolución, pero fuera de un alcance estándar

**Casos que la respaldan:** SGS Chile — dos canales (portal web y Teams) sobre la misma API, con la aprobación del catálogo gestionada desde la semana 3.

**Preguntas que debo hacer:**
- ¿Dónde trabaja realmente esta gente todo el día?
- ¿Qué proporción de los usuarios es personal externo, y qué nivel de acceso tiene al Teams corporativo? ‹fuente: SGS›
- ¿Quién autoriza publicar una aplicación en el catálogo de Teams de la organización? ‹fuente: SGS›
- ¿Cuánto demora habitualmente esa aprobación en su casa?
- ¿Hay gente en terreno sin equipo corporativo?
- ¿Necesitan que esto quede embebido en su intranet o basta con un portal propio?

---

### A-04 · Adopción y gestión del cambio

**Tags:** adopción · b-learning · examen de comprobación · artefacto de adopción · consultoría post go-live · hábitos · panel de avance

**Una línea:** El sistema de adopción que convierte una herramienta entregada en una práctica instalada: ruta de aprendizaje autoguiada con examen, sesiones consultivas sobre consultas reales y un kit de adopción construido con el uso efectivo de la organización.

**Para quién:** Cualquier cliente que ya tenga la cicatriz de una herramienta bien construida que nadie usó. También para el que va a comprar por primera vez y no sabe que ese es el riesgo real.

**Señales en la conversación de que aplica:**
- "ya compramos una herramienta parecida y no la usó nadie"
- "el problema no es la tecnología, es que la gente siga haciendo lo de siempre"
- "capacitamos una vez y se olvidó"
- "necesitamos que esto llegue a terreno"
- "¿cómo sabemos que lo van a usar?"

**Qué incluye:**
- **Ruta de b-learning autoguiada**, alojada en el propio ecosistema del cliente, con video corto, guía descargable y práctica sobre el sistema real
- **Examen de comprobación con corrección automática**, incluyendo preguntas de aplicación sobre salidas reales del sistema
- **Panel de avance** visible para la jefatura desde el día de la entrega
- **Cuatro sesiones consultivas semanales** posteriores al go-live, sobre las consultas reales de esa semana, cada una cerrando con ajustes aplicados al sistema
- **Artefacto de adopción a medida**: guía de uso, biblioteca de consultas por rol y tablero de seguimiento, construido a partir del uso real
- **Informe de adopción con hoja de ruta de evolución**

**Estructura de la ruta (caso SGS: cinco módulos, ~70 minutos en total):**

| Módulo | Duración | Qué resuelve |
|---|---|---|
| 1 · Alcances y limitaciones del asistente | 12 min | Qué consultas resuelve y cuáles quedan fuera |
| 2 · Cómo formular una consulta | 15 min | Formulación y efecto del contexto sobre la respuesta |
| 3 · Cómo interpretar una respuesta | 15 min | Cita, sección, versión y procedimiento ante advertencia de vigencia |
| 4 · Tipos de respuesta del asistente | 15 min | Respuesta con referencia, solicitud de precisión y derivación |
| 5 · Cuándo verificar y cómo reportar | 12 min | Verificación por el usuario y canal de reporte |

**Examen:** 12 preguntas — 8 de conocimiento y 4 de **aplicación práctica sobre respuestas reales del asistente** —, corrección automática, aprobación con 80%, hasta dos intentos. Las de aplicación presentan una respuesta real y exigen identificar si está correctamente fundada, si la fuente está vigente y qué acción corresponde.

**Las cuatro sesiones consultivas (caso SGS, semanas 6 a 9):**

| Sesión | Semana | Foco | Salida |
|---|---|---|---|
| S1 | 6 | Puesta en marcha asistida; primeras consultas reales y dudas de uso | Lista de consultas frecuentes reales |
| S2 | 7 | Revisión de respuestas incorrectas y de derivaciones que debieron resolverse | Ajuste de reglas y umbrales; **entrega del artefacto de adopción** |
| S3 | 8 | Calibración con sinónimos y vocabulario propio del cliente, casos límite y documentos mal fragmentados | Glosario incorporado y correcciones de ingesta |
| S4 | 9 | Cierre de adopción: métricas de uso, brechas documentales y plan de continuidad | Informe de adopción y hoja de ruta |

**Arquitectura y stack:** todo dentro del ecosistema del cliente — contenidos en SharePoint o Viva Learning, examen en Microsoft Forms, panel de avance en lista de SharePoint con vista en Power BI. **Sin plataformas externas, sin licencias adicionales y sin datos de usuarios fuera del tenant.**

**Entregables:** módulos publicados · examen con corrección automática · panel de avance · artefacto de adopción personalizado · registro de ajustes por sesión · informe final de adopción con hoja de ruta.

**Fases típicas:** producción de módulos en paralelo al desarrollo, publicación el día de la entrega, recorrido durante las cuatro semanas de acompañamiento posteriores al go-live.

**Equipo:** adopción y diseño instruccional (media jornada, desde el diseño hasta el cierre) · consultoría de adopción para las sesiones post go-live — se valoriza distinto porque corresponde a **criterio profesional sénior frente al equipo del cliente y no a horas de desarrollo**.

**Dependencias del cliente y riesgos:**
- Usuarios de la ruta identificados con anticipación
- Jefatura dispuesta a mirar el panel de avance (es el mecanismo real de tracción)
- Riesgo de baja participación: mitigado con panel visible para la jefatura desde la entrega y con la primera sesión consultiva agendada con el equipo completo
- Riesgo de expectativa desalineada: el módulo 1 existe específicamente para fijar qué hace y qué no hace el asistente
- El contenido se produce en un idioma; traducción y doblaje quedan fuera

**Métrica comprometida:** en el caso SGS, **≥85% de los usuarios inscritos completa la ruta y aprueba el examen**. Es un criterio de aceptación, no una aspiración.

**Casos que la respaldan:** SGS Chile — ruta de cinco módulos, examen, panel de avance para la jefatura, cuatro sesiones consultivas y artefacto de adopción a medida, todo dentro del alcance del proyecto.

**Preguntas que debo hacer:**
- ¿Qué herramienta compraron antes que hoy nadie usa, y por qué creen que pasó?
- ¿Quién en la organización se hace responsable de que esto se use?
- ¿La jefatura va a mirar un panel de avance, o eso no funciona en su cultura?
- ¿Cómo capacitan hoy, y qué tasa de finalización tienen?
- ¿Dónde publican sus contenidos internos hoy?
- ¿A quién le tenemos que demostrar, en cuatro semanas, que esto se está usando?

---

### A-05 · Gobierno de IA

**Tags:** gobierno de IA · política de IA · guardrails · comité · AI Operating System · cumplimiento · riesgo legal y reputacional

**Una línea:** Instalar el marco que define qué puede hacer la IA en la organización, con qué límites, quién decide y cómo se mide — antes o en paralelo a los primeros casos de uso.

**Para quién:** Organizaciones con IA ya entrando por varias puertas a la vez y sin política corporativa cerrada; áreas de riesgo, cumplimiento, legal, seguridad de la información y dirección.

**Señales en la conversación de que aplica:**
- "nuestra política de IA está en desarrollo" ‹fuente: SGS›
- "casa matriz todavía no define"
- "tenemos gente usando IA por su cuenta"
- "necesito llevar esto al comité"
- "legal nos va a frenar"
- "¿quién se hace responsable si el sistema se equivoca?"

**Qué incluye:**
- **adoOps AI Operating System**: tres pilares — Governance (*"Decidimos con claridad"*), Superagency (*"Operamos la IA de forma segura"*), Intelligence & Improvement (*"Medimos, aprendemos y mejoramos"*)
- **Cuatro objetivos**: cumplimiento (ley, ética y estándares) · confianza (transparencia y control) · valor (innovación y eficiencia) · adaptabilidad (evolución continua)
- **Niveles de gobernanza**: Dirección → Gobernanza → Control → Delivery → Adopción
- **Guardrails transversales**: Valor · Riesgo · Datos · IA · Seguridad · Personas
- **Ciclo de mejora continua**: Monitorear → Evaluar → Aprender → Adaptar → Escalar
- Diseño de la solución **desacoplada del proveedor de modelo** como decisión de gobierno: no amarra a la organización a una decisión que su gobernanza aún no ha tomado

**Arquitectura y stack:** es una capa de método y controles, no de infraestructura. Se materializa en artefactos: matriz de responsabilidad compartida, resumen de controles por dominio contrastable con el marco de control del cliente, registro de auditoría de decisiones del agente, y criterios de aceptación medidos y firmados.

**Entregables:** marco de gobernanza con niveles y guardrails · matriz de responsabilidad compartida entre proveedor cloud, cliente y adoOps · resumen de controles por dominio · definición de métricas de uso, calidad, costos y riesgos · recomendaciones regulatorias (en Chile: Ley 21.719, roles de responsable y encargado, inventario de tratamientos, evaluación de impacto).

**Fases típicas:** se instala en Design y se opera desde Adopt. En un proyecto concreto se ancla al primer caso de uso, que es lo que hace que el gobierno se pruebe en vez de quedar en papel.

**Equipo:** dirección y arquitectura · DevOps y seguridad · consultoría de adopción. El interlocutor es seguridad de la información, legal y dirección.

**Dependencias del cliente y riesgos:**
- Que exista un interlocutor con mandato para decidir política (no sólo para opinar)
- Que casa matriz no tenga una definición contradictoria en curso
- Riesgo típico: el gobierno se diseña y no se opera. Mitigación: anclarlo a un caso de uso con métricas y a un ciclo de revisión periódica

**Casos que la respaldan:** SGS Chile — el diseño mantiene el modelo desacoplado y el alojamiento en nube aprobada **precisamente porque la política corporativa de IA está en desarrollo** (respuesta 21 del levantamiento). Es el ejemplo canónico de gobierno usado como argumento de diseño.

**Preguntas que debo hacer:**
- ¿Tienen una política de IA vigente, en desarrollo, o todavía no está en la agenda? ‹fuente: SGS›
- ¿Quién la está escribiendo y cuándo esperan cerrarla?
- ¿Casa matriz define o ustedes definen?
- ¿Qué comité tendría que aprobar un caso de uso como este?
- ¿Qué usos de IA ya están ocurriendo hoy sin que nadie los haya autorizado?
- ¿Quién es el responsable si el sistema entrega una respuesta equivocada?
- ¿Tienen delegado de protección de datos, y qué criterio aplica para evaluaciones de impacto? ‹fuente: SGS›

---

### A-06 · Mantenimiento evolutivo y operación de agentes

**Tags:** mantenimiento evolutivo · operación · bolsa mensual · reingesta · revalidación de scorecard · SLA · runbook · continuidad

**Una línea:** La capa mensual que mantiene el agente vivo después del go-live: monitoreo, supervisión del corpus, ajuste de reglas con las consultas reales, revalidación del scorecard cuando cambia el modelo, e informe y sesión periódicos.

**Para quién:** Todo cliente que ya pasó a producción. Se contrata al cierre del proyecto y es una capa opcional y separada, no un supuesto.

**Señales en la conversación de que aplica:**
- "¿y después quién lo mantiene?"
- "no tenemos equipo para operar esto"
- "¿qué pasa cuando cambien los procedimientos?"
- "¿qué pasa si sale un modelo nuevo?"
- "nuestro TI no va a poder hacerse cargo"

**Qué incluye (la bolsa mensual):**
- Monitoreo, alertas y **atención de incidentes**
- **Supervisión de la reingesta** y del estado del corpus
- **Ajuste de reglas, umbrales y vocabulario** según las consultas reales
- **Actualización de modelos y revalidación del scorecard**
- **Informe mensual** de uso, cobertura y brechas documentales
- **Sesión mensual de revisión** con la contraparte del cliente

**Tramos de contratación:** **3, 6 y 12 meses**. El de **12 meses es el recomendado** *"porque cubre el ciclo anual de auditoría y el reproceso completo del corpus, que es cuando el asistente más se exige"*. Racional por tramo, para explicar la recomendación sin hablar de dinero:
- **3 meses** — estabilización posterior al go-live, con el uso real todavía asentándose
- **6 meses** — cubre un ciclo completo de revisión documental y la recalibración que trae consigo
- **12 meses** — cubre el ciclo anual de auditoría y el reproceso completo del corpus

**Reglas de gobierno de la bolsa (decirlas siempre, evitan fricción después):**
- El consumo de nube queda **fuera** de esta capa y lo factura el proveedor cloud directamente a la suscripción del cliente
- *"Los trabajos que excedan la bolsa mensual se dimensionan y se aprueban antes de ejecutarse"*

**Arquitectura y stack:** opera sobre lo ya entregado — panel de observabilidad, alertas, límite de presupuesto, interruptor de corte, runbook de incidentes y reversión, manual de operación y traspaso.

**Entregables:** informe mensual de uso, cobertura y brechas · registro de ajustes aplicados · scorecard revalidado tras cambios de modelo · acta de la sesión mensual de revisión.

**Fases típicas:** arranca al cierre del acompañamiento incluido en el proyecto (en el caso SGS, después de la semana 9).

**Equipo:** perfil mixto de ingeniería de IA, DevOps y consultoría de adopción, con un punto de contacto único.

**Dependencias del cliente y riesgos:**
- Contraparte del cliente disponible para la sesión periódica de revisión
- Que el cliente mantenga su propio ciclo de actualización documental: el agente refleja el corpus, no lo arregla
- Riesgo declarado explícitamente: un corpus que se actualiza sobre un índice que no se regenera produce **respuestas correctas respecto de contenido desactualizado**, que es el tipo de error de mayor impacto en este sistema

**Garantía previa (lo que sí está incluido en el proyecto):** durante las cuatro semanas de acompañamiento, la corrección de defectos atribuibles a la implementación está incluida. Se entiende por defecto *"el comportamiento que se aparta de lo comprometido"* en el alcance y en los criterios de calidad. **No** son defecto: problemas originados en la calidad del corpus documental, cambios de alcance solicitados durante la ejecución e indisponibilidades de los servicios del proveedor cloud.

**Casos que la respaldan:** SGS Chile — capa de mantenimiento evolutivo formalizada como oferta posterior al cierre del proyecto, con los tres tramos y el alcance de la bolsa mensual arriba descrito.

**Preguntas que debo hacer:**
- ¿Quién va a operar esto el día 91?
- ¿Su TI tiene capacidad y ganas de tomar la operación, o prefieren que la tomemos nosotros?
- ¿Cada cuánto cambian los documentos que alimentan el sistema?
- ¿Cuándo es su ciclo de auditoría, y qué pasa con la documentación en ese período?
- ¿Quién autoriza un cambio de modelo, y qué evidencia necesitan para aprobarlo?
- ¿Cómo manejan hoy los incidentes de una aplicación en producción?

---

### A-07 · Validation Sprint / PoC medida con perímetro zero trust

**Tags:** PoC · Validation Sprint · experimento · umbrales pre-registrados · evaluación a ciegas · zero trust · piloto sin tocar el tenant

**Una línea:** Una prueba acotada, con las preguntas del cliente y los umbrales acordados antes de correrla, montada fuera del tenant del cliente para que no dependa del proceso de aprobación de TI corporativa.

**Para quién:** Clientes que no pueden o no quieren comprometer presupuesto de implementación sin evidencia, y clientes cuyo proceso interno de habilitación de accesos es lento.

**Señales en la conversación de que aplica:**
- "nos gustaría ver algo antes de comprometernos"
- "el proceso de habilitación con TI toma meses"
- "necesito llevar algo concreto al comité"
- "estamos evaluando dos alternativas en paralelo"
- "no tenemos presupuesto asignado todavía"

**Qué incluye:**
- Construcción del **set de evaluación con el equipo del cliente**, con respuesta esperada y fuente de origen para cada pregunta
- Acuerdo de umbrales **antes** de correr la prueba
- Ingesta y construcción del asistente acotado sobre el subconjunto documental acordado
- **Uso real por un grupo reducido de usuarios** durante la prueba
- **Evaluación a ciegas** por el equipo del cliente
- Scorecard comparativo y presentación de resultados, con el volumen real de consultas medido

**Plan de cuatro semanas (caso SGS):**

| Semana | Foco | Entregable |
|---|---|---|
| 1 | Set de evaluación: recepción de documentos y construcción de las 40 preguntas en sesión conjunta | Set con respuesta esperada y fuente |
| 2 | Construcción: ingesta estructurada, índice híbrido y orquestación sobre los dominios del piloto | Asistente funcionando |
| 3 | Uso real: los usuarios del piloto lo usan en su trabajo; evaluación a ciegas del set | Registro de consultas y evaluaciones |
| 4 | Resultado: scorecard comparativo y volumen real medido | Presentación de resultados |

**Las cuatro métricas de la PoC (distintas de los criterios del proyecto de implementación — ver §15.2):**

| Métrica | Umbral | Definición |
|---|---|---|
| **Exactitud factual** | ≥ 85% | Respuesta correcta y completa, evaluada por el equipo del cliente **a ciegas** |
| **Trazabilidad** | ≥ 90% | Cita el documento y la sección correctos. **Verificable, no opinable** |
| **Tasa de invención** | ≤ 2% | Respuestas plausibles sin respaldo documental. **"La métrica que manda"** |
| **Abstención correcta** | ≥ 80% | Dice que no sabe y deriva, en vez de improvisar un requisito |

> *"En cumplimiento normativo, una respuesta sin fuente no es una respuesta. Por eso la tasa de invención pesa más que la exactitud."* Nota de orador: *"Los umbrales son propuestos, no impuestos. La conversación sobre dónde ponerlos ya es trabajo de consultoría valioso para ellos."*

**Arquitectura y stack — el modelo de acceso en cinco capas (piloto fuera del tenant del cliente):**

| Capa | Qué hace |
|---|---|
| **01 · Perímetro zero trust** | **Lista blanca de los correos exactos** de los usuarios del piloto — *"otro correo del mismo dominio tampoco pasa"*. **Código de un solo uso enviado al correo**, sin contraseñas que gestionar. **El usuario no instala nada.** Cada intento de acceso queda registrado |
| **02 · Sesión de aplicación** | Segunda puerta, independiente de la primera. **Expiración corta**: la sesión no queda viva indefinidamente. Tráfico cifrado de extremo a extremo |
| **03 · Exposición de datos** | **No se sirven documentos completos. Solo los fragmentos citados en cada respuesta.** *"Nadie puede descargar el corpus, ni entrando."* Documentos cifrados en reposo |
| **04 · Registro de auditoría** *(transversal)* | Quién entró, cuándo, qué preguntó y qué se le respondió. **Es además el insumo del scorecard de la prueba** |
| **05 · Caducidad automática** *(transversal)* | El acceso se apaga solo al terminar la prueba y los documentos se eliminan al cierre |

> *"Todo lo demás se detiene en la capa 01. Un correo fuera de la lista, un enlace reenviado a un tercero, o cualquier tráfico de internet no llega siquiera a ver la aplicación. Se rechaza en el perímetro y queda registrado."*

Alojamiento: infraestructura de adoOps, fuera del tenant del cliente, **sin registro de aplicación ni permisos sobre el repositorio**, **sin dependencia del proceso de aprobación de TI corporativa**. (Tecnología del perímetro identificada internamente: Cloudflare Access.)

**Entregables:** set de evaluación con respuesta esperada y fuente · asistente acotado en operación · registro de consultas y evaluaciones · scorecard comparativo · presentación de resultados con volumen real medido.

**Fases típicas:** cuatro semanas cuando es una PoC autónoma. Cuando va embebida en un proyecto de implementación se llama **"primera entrega operativa"** y corre **en paralelo** al desarrollo, con resultados en la semana 3 (§5.7).

**Equipo:** ingeniería de IA y recuperación · ingeniería de datos e ingesta · QA y evaluación · dirección de proyecto. Perfil compacto y de corta duración.

**Dependencias del cliente y riesgos:**
- Entre 20 y 50 documentos representativos, con criterio de selección (ver abajo)
- Listado de preguntas frecuentes reales, las que efectivamente llegan por correo, chat y llamadas
- Una sesión de trabajo de medio día con el equipo experto para construir el set y acordar umbrales
- Los usuarios del piloto designados, disponibles para usarlo en su trabajo real
- Acuerdo de confidencialidad antes del inicio
- Riesgo: que la muestra documental no sea representativa y el resultado no sea extrapolable

**Criterio de selección de la muestra documental — los tres criterios:**
1. Los dominios completos del piloto, con sus anexos y formularios asociados
2. **Documentos vecinos que se confunden** — dos o tres de los que la gente abre por error; *"es donde se prueba la precisión de la recuperación"*
3. **Al menos una versión obsoleta** de un procedimiento vigente
> *"El tercer criterio es el que nadie pide. También es el que conecta directamente con las no conformidades que ya les costaron caro."*

**Barrera de entrada — argumento de cierre:** *"No requerimos acceso al tenant, ni registro de aplicaciones, ni permisos sobre el repositorio para esta etapa."*

**Casos que la respaldan:** SGS Chile — PoC de cuatro semanas con diez usuarios del equipo experto, perímetro zero trust con lista blanca y código de un solo uso, evaluación a ciegas del set de 40 preguntas.

**Preguntas que debo hacer:**
- ¿Nos pueden facilitar entre veinte y cincuenta documentos con este criterio, incluida una versión obsoleta? ‹fuente: SGS›
- ¿Tienen el listado de las preguntas frecuentes reales que le llegan al equipo por correo, chat y llamadas? ‹fuente: SGS›
- ¿Quiénes serían los usuarios del piloto y cuánto tiempo real le pueden dedicar? ‹fuente: SGS›
- ¿Podemos agendar media jornada con el equipo experto para construir el set y acordar los umbrales? ‹fuente: SGS›
- ¿Dónde ponemos los umbrales? ‹fuente: SGS›
- ¿Qué acuerdo de confidencialidad necesitan firmar antes de que recibamos documentos? ‹fuente: SGS›

---

### A-08 · Ingesta, estructuración y diagnóstico del corpus documental

**Tags:** ingesta · chunking consciente de estructura · tablas íntegras · metadatos de vigencia · reingesta incremental · calidad del corpus · triaje documental

**Una línea:** El pipeline que convierte un repositorio documental heterogéneo en un índice consultable con versión y vigencia, y que como subproducto entrega un diagnóstico del estado real de esa documentación.

**Para quién:** Cualquier cliente cuyo conocimiento crítico viva en documentos ofimáticos con tablas, matrices y control de versiones.

**Señales en la conversación de que aplica:**
- "tenemos PDFs escaneados"
- "las matrices de riesgo están en Excel"
- "hay duplicados y no sabemos cuál es el bueno"
- "hay documentos que se contradicen"
- "no tenemos claro qué está vigente"

**Qué incluye — el pipeline en cinco pasos:**

| # | Paso | Qué hace |
|---|---|---|
| 01 | **Origen** | Conector al repositorio del cliente; documentos en PDF, Word, Excel y presentaciones |
| 02 | **Extracción** | Se lee el archivo conservando su estructura. **Las tablas se mantienen enteras** |
| 03 | **Fragmentación** | Cada documento se corta en pedazos que se entienden solos, con su jerarquía (documento → sección → subsección), con solapamiento y metadatos de vigencia replicados en cada fragmento |
| 04 | **Enriquecimiento** | Código, versión, vigencia, plazos y referencias salen a **columnas propias** |
| 05 | **Vectorización** | Cada fragmento se convierte en **1.536 coordenadas de significado** |

> **Regla dura de procesamiento:** *"Las tablas se conservan íntegras como unidad y no se fragmentan. Las matrices de riesgo, las matrices de severidad y los cuadros de plazos corresponden al tipo de contenido donde un extractor plano de texto genera una secuencia continua de palabras sin significado."*

Frase de venta reutilizable, para no técnicos:
> *"Las tablas se procesan íntegras, ya que una matriz de riesgo fragmentada pierde su significado."*

**Arquitectura y stack:** conector a Microsoft Graph con **delta query** para reingesta incremental (sólo se reprocesa lo que cambió) · procesamiento documental con reconocimiento de estructura · fragmentación jerárquica con solapamiento · índice en PostgreSQL con pgvector (HNSW) más índice de texto completo (tsvector) y metadatos de vigencia y estado del documento.
> *"La ingesta escribe acá una vez. La consulta lee de acá cada vez."*

**Entregables:** pipeline de ingesta con reingesta incremental automatizada · índice de conocimiento con metadatos de versión y vigencia · **inventario del corpus real** · reporte de calidad del corpus (duplicados, versiones en conflicto, documentos escaneados sin capa de texto, documentos vencidos, referencias cruzadas rotas) · criterios de triaje aplicados.

**Fases típicas:** inventario del corpus en el levantamiento técnico (semana 1) y construcción de la ingesta en la fase siguiente. En el caso SGS, la ingesta ocupa una semana completa.

**Equipo:** ingeniería de datos e ingesta como rol responsable — *"que los documentos entren con su versión, su vigencia y sus tablas intactas"*.

**Dependencias del cliente y riesgos:**
- Acceso de solo lectura al repositorio, aprobado
- Que exista metadata de versión y vigencia efectivamente poblada. Si no existe, la advertencia de vigencia no se sostiene y hay que decirlo antes de comprometerla
- **Riesgo alto:** documentos con tablas complejas mal extraídas. Mitigación: modelo de análisis de estructura y validación manual sobre una muestra, en la primera semana
- **Riesgo medio:** corpus contaminado con formularios sin contenido normativo. Mitigación: **triaje por tipo de documento** — los formularios se excluyen del índice de respuesta y se mantienen como referencia
- **Exclusión que hay que declarar siempre:** la remediación del contenido documental no está incluida. Duplicados, versiones en conflicto, escaneados sin capa de texto y vencidos **se reportan, no se corrigen**. *"La corrección del corpus es una decisión del área dueña de la documentación"*
- La migración de documentos entre repositorios está fuera: el asistente lee, no mueve, no reorganiza ni reestructura

**Posicionamiento del hallazgo documental como beneficio, no como reclamo:**
> *"Las sesiones de acompañamiento habitualmente permiten detectar problemas en la propia documentación, entre ellos versiones en conflicto, procedimientos que se contradicen y documentos vigentes sin actualización. Estos hallazgos se reportan. Su corrección no forma parte del alcance, aunque constituye uno de los aportes más relevantes del proyecto para el área dueña de la documentación."*

**Casos que la respaldan:** SGS Chile — ~700 documentos en PDF, Word, Excel y presentaciones, con tablas y matrices de riesgo como contenido crítico y vigencia como requisito central.

**Preguntas que debo hacer:**
- ¿Cuántos documentos son y en qué formatos? ‹fuente: SGS›
- ¿Son PDFs nativos o escaneados? ¿Tienen los editables disponibles? ‹fuente: SGS›
- ¿Tienen control de versiones y metadata poblada en el repositorio? ‹fuente: SGS›
- ¿Cómo saben hoy, mirando un documento, si está vigente?
- ¿Cuánto de ese contenido crítico vive dentro de tablas y matrices?
- ¿Hay formularios y registros sin contenido normativo mezclados en el mismo repositorio?
- Si encontramos versiones en conflicto, ¿quién es el dueño que decide cuál queda?

---

### A-09 · Habilitación con seguridad de la información y cumplimiento

**Tags:** anexo de seguridad · responsabilidad compartida · mínimo privilegio · Ley 21.719 · auditoría · prompt injection · due diligence de proveedor

**Una línea:** El paquete de controles, respuestas y evidencia que hace que el área de seguridad de la información apruebe el proyecto en vez de frenarlo.

**Para quién:** Organizaciones con área de seguridad de la información formal, marco de control propio, requisitos de due diligence a proveedores y/o exposición regulatoria en datos personales.

**Señales en la conversación de que aplica:**
- "esto tiene que pasar por seguridad"
- "tenemos un cuestionario de proveedores"
- "nos van a pedir ISO 27001"
- "¿dónde se procesan los datos?"
- "¿el modelo se entrena con nuestra información?"
- "tenemos que cumplir con la ley de datos personales"

**Qué incluye:**
- **Anexo de seguridad de la información** como documento propio, dirigido al área de seguridad
- **Modelo de responsabilidad compartida** explícito entre proveedor cloud, cliente y adoOps — *"definirlo de forma explícita evita zonas sin responsable asignado"*
- **Resumen de controles por dominio**, para contrastar contra el marco de control del cliente
- Diseño de **mínimo privilegio** documentado
- Sección específica de **seguridad de la solución de IA**: inyección de instrucciones desde el contenido, segregación entre usuarios, superficie de acción y control de consumo
- Sección de **datos personales** con roles, controles y recomendaciones
- Compromiso de **notificación de incidentes dentro de 24 horas**

**Arquitectura y stack:** ver §7 completo — es la sección de la base escrita como respuestas listas para dar en reunión.

**Entregables:** anexo de seguridad · matriz de responsabilidad compartida · resumen de controles por dominio · inventario de componentes y puntos de exposición (insumo para que el cliente encargue pruebas de penetración a su proveedor habitual) · runbook de incidentes y reversión · constancia escrita de eliminación al cierre.

**Fases típicas:** el anexo se entrega junto con la propuesta técnica, **antes de la firma**. Las cuatro decisiones de aprovisionamiento se toman en la primera semana. La revisión de permisos se repite en la fase de evaluación.

**Equipo:** DevOps, seguridad y despliegue como rol responsable, con dirección y arquitectura como interlocutor del área de seguridad del cliente.

**Dependencias del cliente y riesgos:**
- Decisiones de la semana 1: región de despliegue · tipo de despliegue del servicio de modelo · uso de claves administradas por el cliente · exigencia de puntos privados. *"Las cuatro condicionan el aprovisionamiento y son más costosas de cambiar después"*
- Aprobación de permisos sobre el repositorio (rol distinto del administrador del catálogo de Teams)
- Definición del plazo de retención del registro de consultas
- Riesgo: requisitos de proveedor que adoOps no cumple por sí misma. **Honestidad frontal:** *"adoOps no aporta certificaciones propias en este alcance y no las declara"*, apoyándose en el programa de cumplimiento de la plataforma, verificable por el cliente. Los requisitos de proveedor *"se abordan antes de la firma, no durante el proyecto"*
- Pruebas de penetración fuera de alcance por plazo, con dos caminos ofrecidos

**Casos que la respaldan:** SGS Chile — anexo de seguridad de diez secciones dirigido explícitamente al equipo de seguridad de la información, con cada punto de la lámina de seguridad **anclado a una respuesta concreta del levantamiento del cliente**. Táctica declarada: *"Mostrar que leímos lo que TI contestó genera más confianza que un discurso genérico de seguridad."*

**Preguntas que debo hacer:**
- ¿Qué exige su área de seguridad a un proveedor antes de firmar? ‹fuente: SGS›
- ¿Tienen un cuestionario de due diligence que debamos responder?
- ¿Hay restricciones de residencia de datos para este tipo de información? ‹fuente: SGS›
- ¿Cómo está clasificada esta documentación en su esquema interno? ‹fuente: SGS›
- ¿Su política exige claves administradas por el cliente o puntos privados? ‹fuente: SGS›
- ¿Cuánto tiempo deben retener el registro de consultas? ‹fuente: SGS›
- ¿Hay datos personales en este corpus?
- ¿Quién aprueba los permisos de acceso al repositorio y cuánto demora? ‹fuente: SGS›

---

### A-10 · Diagnóstico de capacidad de negocio (Understand + Design)

**Tags:** diagnóstico · blueprint · capacidad de negocio · agnosticismo de plataforma · construir/integrar/automatizar/descartar · KPIs

**Una línea:** Antes de decidir plataforma, diseñar la capacidad de negocio que esa plataforma debe habilitar, y salir con un blueprint, un mapa de integraciones y KPIs acordados.

**Para quién:** Clientes que llegan con una plataforma ya elegida y un problema mal definido, o con varias alternativas sobre la mesa y sin criterio para decidir.

**Señales en la conversación de que aplica:**
- "estamos evaluando entre estas tres plataformas"
- "compramos la licencia y no la usamos"
- "queremos implementar X" (sin que quede claro para qué)
- "cada área tiene su propia versión de la información"
- "tenemos dashboards y no decidimos con ellos"

**Qué incluye:**
- **Understand**: dolor y objetivo · procesos críticos · datos disponibles · decisión de negocio en juego
- **Design**: blueprint funcional · integraciones · KPIs de negocio · experiencia de uso
- Priorización de capacidades y decisión **Construir · Integrar · Automatizar · Descartar**
- Definición del flujo específico punta a punta que se va a probar

**Arquitectura y stack:** agnóstica por definición. *"No te pedimos elegir entre HubSpot, Salesforce, Zoho u Odoo; primero validamos qué capacidad comercial necesitas y luego decidimos si se construye, integra o combina."*

**Entregables:** diagnóstico de capacidad · blueprint funcional · mapa de integraciones · set de KPIs de negocio acordado · recomendación de decisión con su fundamento · alcance propuesto para el Validation Sprint.

**Fases típicas:** es la puerta de entrada del framework. Desemboca en Prove.

**Equipo:** dirección y arquitectura · consultoría de adopción · apoyo de ingeniería para la factibilidad de integraciones.

**Dependencias del cliente y riesgos:**
- Acceso a las personas que ejecutan el proceso, no sólo a quien lo describe
- Riesgo: que el cliente ya tenga la decisión de plataforma tomada políticamente. En ese caso el diagnóstico se acota a diseñar la capacidad **sobre** esa plataforma, y se dice así en vez de pelear la decisión

**Casos que la respaldan:** el framework comercial documentado usa el caso CRM como ejemplo canónico (trazabilidad marketing→ventas, scoring y oportunidades, alertas e insights, integración de inventario, reportería para decidir). Úsalo como ilustración del método, no como caso entregado.

**Preguntas que debo hacer:**
- ¿Qué decisión de negocio quieren tomar mejor, y quién la toma hoy?
- Si la plataforma ya estuviera implementada, ¿qué haría distinto la gente el lunes?
- ¿Qué proceso crítico se rompe hoy entre sistemas?
- ¿Qué datos tienen realmente disponibles y con qué calidad?
- ¿Qué reporte tienen hoy que nadie usa para decidir?
- ¿Qué pasaría si decidiéramos no construir nada y sólo automatizar una parte?

---

### A-11 · Panel analítico del área dueña y observabilidad de uso

**Tags:** panel · KPIs declarados por el cliente · brechas documentales · volumen real · derivaciones · observabilidad

**Una línea:** El tablero que le da al área dueña visibilidad que hoy no tiene: cuánto le pregunta la organización, qué resuelve sola, cuánto demora y qué falta en su propia documentación.

**Para quién:** El área experta que hoy responde consultas informalmente y no tiene ninguna cifra de ese trabajo.

**Señales en la conversación de que aplica:**
- "no sabemos cuántas consultas recibimos"
- "las preguntas llegan por todos lados"
- "sabemos que preguntan lo mismo pero no lo tenemos medido"
- "no tenemos cómo justificar más recursos para el área"

**Qué incluye:**
- **Volumen real medido** — *"responde la pregunta del levantamiento que quedó sin cifra: cuántas consultas recibe efectivamente el equipo"*
- **Los KPIs que el propio cliente nombró**: consultas resueltas sin recurrir al equipo experto, y tiempo hasta tener la información completa
- **Brechas documentales priorizadas**: las consultas recurrentes sin respaldo se convierten en una agenda de trabajo para el área
- Derivaciones y su calidad · reportes de respuesta incorrecta · distribución por dominio y por rol

> *"Este panel es un producto en sí mismo."* Da visibilidad que hoy no existe sobre qué le pregunta la organización al área experta. *"Cada derivación identifica una brecha. Lo que hoy es una interrupción pasa a ser un dato sobre el corpus."*

**Arquitectura y stack:** se alimenta del registro de auditoría de la solución (consulta, fragmentos recuperados con documento/sección/versión, decisión del agente, respuesta entregada y advertencias emitidas, eventos de operación y consumo), alojado en la observabilidad dentro de la suscripción del cliente. Publicación del panel dentro del ecosistema del cliente.

**Entregables:** panel del área dueña · informe de brechas documentales priorizadas · métricas de uso e impacto · panel de avance de la ruta de aprendizaje, visible para la jefatura.

**Fases típicas:** se entrega con la puesta en producción y se explota en las sesiones de acompañamiento y en el informe de adopción.

**Equipo:** desarrollo de aplicación y consultoría de adopción.

**Dependencias del cliente y riesgos:**
- Definición del plazo de retención del registro de consultas (dato asociado a persona identificada)
- Riesgo: que el panel se use como herramienta de control sobre las personas en vez de sobre el corpus. Conviene acordar de antemano para qué se va a mirar

**Casos que la respaldan:** SGS Chile — panel del equipo SGI con volumen real, los dos KPIs declarados por el cliente y brechas documentales priorizadas.

**Preguntas que debo hacer:**
- ¿Cuántas consultas recibe hoy su equipo al mes? ¿Está medido o es una impresión? ‹fuente: SGS›
- ¿Por qué canales le llegan esas consultas? ‹fuente: SGS›
- ¿Qué porcentaje de esas consultas es repetida?
- ¿Cuánto demora hoy una persona en tener la información completa? ‹fuente: SGS›
- ¿Qué harían distinto si tuvieran una lista priorizada de los vacíos de su propia documentación?
- ¿Quién debería ver este panel, y para tomar qué decisión?

---

### A-12 · Diseño del set de evaluación y scorecard de calidad de respuestas

**Tags:** evaluación · set de preguntas · scorecard firmado · criterios de aceptación · evaluación a ciegas · anti-alucinación

**Una línea:** Construir con el cliente el instrumento que define y mide qué es una buena respuesta, y convertirlo en criterio de aceptación firmado.

**Para quién:** Todo proyecto de agente con IA. Es transversal a las demás fichas y es el mecanismo que sostiene la promesa anti-invención.

**Señales en la conversación de que aplica:**
- "¿cómo sabemos si funciona bien?"
- "¿cómo comparamos las dos alternativas?"
- "necesitamos un criterio objetivo para aceptar"
- "¿y si se equivoca?"

**Qué incluye:**
- Construcción del set **con el equipo experto del cliente**, a partir de consultas reales, cada pregunta con respuesta esperada, documento y sección de origen
- Acuerdo de umbrales **antes** de correr la medición
- Ejecución de la medición y consolidación en **scorecard firmado por ambas partes**
- Corrección de brechas antes del cierre

**Dos taxonomías disponibles (no mezclarlas — ver §15.2):**

*Taxonomía por bloques (proyecto de implementación, 40 preguntas):*

| Bloque | Qué prueba | N° |
|---|---|---|
| Respuesta directa | Consultas con respuesta única y respaldada. **Al menos tres deben resolverse dentro de una tabla** | 14 |
| Ambigüedad | Consultas cuyo requisito depende de un dato no declarado. **Responder sin pedir esa precisión se considera error** | 6 |
| Sin respaldo | Consultas del dominio cuya respuesta no está en el corpus. Debe derivar e indicar el motivo | 6 |
| Vigencia | Versiones en conflicto, documentos superados, revisiones vencidas y **referencias cruzadas rotas** | 8 |
| Casos límite | **Premisas falsas incrustadas**, consultas multi-documento, vocabulario propio del cliente e **intentos de inducir invención** | 6 |

*Taxonomía por niveles de dificultad creciente (versión PoC):*

| N° | Tipo de pregunta | Qué exige | Por qué importa |
|---|---|---|---|
| 1 | Recuperación directa | Un documento, una cláusula | Piso mínimo — lo pasa cualquier sistema |
| 2 | Agregación entre documentos | Cruza dos o más estándares | La búsqueda de un solo tiro devuelve uno u otro |
| 3 | Aplicabilidad y excepciones | Requiere leer alcance y exclusiones | **Es donde más se inventa** |
| 4 | Tablas y matrices | Plazos, severidad, matrices de riesgo | El procesamiento ingenuo destruye las tablas |
| 5 | Vigencia y versión | Exige entender la metadata, no el texto | Conecta con el riesgo declarado |
| 6 | Fuera de alcance | Sin respuesta en el corpus | Debe abstenerse y derivar |

> *"Los tipos 4 y 5 son los que separan una arquitectura ajustable de una plataforma cerrada."*

**Criterios de aceptación del proyecto de implementación (caso SGS):**

| Criterio | Umbral |
|---|---|
| **Cobertura** | ≥ 90% del set responde con cita correcta |
| **Precisión de la cita** | ≥ 95% cita documento, sección y versión existentes |
| **Detección de vigencia** | **100%** de las respuestas que usan un documento superado lo advierten |
| **Afirmaciones sin respaldo** | **0** en el set de evaluación |
| **Latencia** | p95 ≤ 8 segundos |
| **Adopción** | ≥ 85% de los usuarios inscritos completa la ruta y aprueba el examen |

> Matiz anti-gaming que hay que decir sin que lo pregunten: *"Las falsas alarmas se contabilizan como fallo. Un asistente que advirtiera un posible problema de vigencia en todas sus respuestas cumpliría formalmente el criterio de vigencia, pero deterioraría la confianza del usuario en poco tiempo."*

**Arquitectura y stack:** no aplica infraestructura propia; se apoya en el registro de auditoría y en el ambiente entregado.

**Entregables:** set de preguntas con respuesta esperada y fuente · resultado de la medición · scorecard firmado · lista de brechas corregidas.

**Fases típicas:** el set se construye temprano (semana 1 en una PoC; validado por el cliente antes de la fase de evaluación en un proyecto de implementación) y se ejecuta al final del desarrollo.

**Equipo:** QA y evaluación como rol responsable — *"que el scorecard se mida sobre el corpus real y se firme"*.

**Dependencias del cliente y riesgos:**
- **El cliente valida el set; adoOps lo elabora.** Sin validación no hay criterio de aceptación
- Disponibilidad del equipo experto para la sesión de construcción
- Riesgo declarado en el material interno: **este instrumento es el que sostiene todos los criterios de aceptación y es también lo que más se posterga.** No dejes salir la reunión sin fecha para la sesión de construcción del set

**Argumento de venta propio de esta ficha:** *"La sesión de definición del set vale por sí sola: obliga a explicitar qué considera el equipo experto una buena respuesta. Es trabajo que hoy no está hecho."*

**Casos que la respaldan:** SGS Chile — set de 40 preguntas como instrumento de aceptación tanto en la PoC (cuatro métricas, evaluación a ciegas) como en el proyecto de implementación (seis criterios, scorecard firmado).

**Preguntas que debo hacer:**
- ¿Qué considera su equipo que es una buena respuesta? ‹fuente: SGS›
- ¿Quién de su equipo tendría la autoridad para validar ese set? ‹fuente: SGS›
- ¿Dónde ponemos los umbrales? ‹fuente: SGS›
- ¿Están dispuestos a evaluar a ciegas, sin saber qué sistema respondió? ‹fuente: SGS›
- ¿Qué tipo de error les duele más: que se equivoque, o que no conteste?
- ¿Tienen tres o cuatro preguntas reales que hoy nadie contesta bien?

---
## 5. Caso de referencia: Asistente SGI (SGS Chile)

> Es el caso insignia de adoOps. Todo lo de esta sección se puede contar en reunión. Lo que **no** se cuenta está marcado con ⛔ y explicado en §15.

### 5.1 El cliente y el contexto

**SGS Chile — área Health & Safety.** SGS es una empresa de **certificación, inspección, verificación y ensayos**; el área contratante gestiona Salud y Seguridad Ocupacional.

El activo en juego es el **Sistema de Gestión Integrado (SGI)**: aproximadamente **700 documentos** alojados en **SharePoint Online** — procedimientos, instructivos, matrices, formularios y registros — en formatos PDF, Word, Excel y PowerPoint. Ese corpus *"constituye la base normativa sobre la que la organización opera, audita y responde"*. Hay estándares ISO en juego y fiscalizaciones externas.

Volumetría funcional del proyecto: hasta **100 usuarios habilitados** en el asistente y hasta **60 usuarios** en la ruta de aprendizaje. Dominios del piloto: **Gestión de Incidentes** y **Seguridad en el Transporte** — *"las consultas se concentran en dos estándares… el foco lo puso el propio equipo"*.

La propuesta nace de un **cuestionario de levantamiento de 33 preguntas** respondido por SGS. Ese cuestionario es la columna vertebral de toda la argumentación: cada punto de seguridad y de alcance está anclado a una respuesta numerada del cliente.

### 5.2 El dolor, en sus propias palabras

Formulación de la propuesta técnica:
> *"El problema identificado no corresponde al almacenamiento ni a la búsqueda por palabra clave. Las personas no logran ubicar el documento aplicable a su situación concreta y, una vez encontrado, no disponen de una forma rápida de confirmar si esa versión sigue vigente. El principal riesgo no está únicamente en el tiempo de búsqueda, sino en la posibilidad de responder o actuar conforme a un documento equivocado o superado."*

Formulación corta, para decir en vivo:
> *"El costo no es la búsqueda. Es responder o actuar con el documento equivocado."*

**El costo del documento equivocado, declarado por el propio cliente** (respuesta 4 del levantamiento — este es el momento de inflexión de la presentación):

1. **No conformidades** que ponen en riesgo la continuidad de la vigencia de los certificados ISO
2. **Multas** por falta de respuesta ante fiscalizaciones
3. **Reincidencia de incidentes** por incumplimiento de los estándares de H&S

De ahí el axioma que reordena todo el criterio de evaluación:
> **"Una respuesta inventada cuesta más que una respuesta ausente."**

### 5.3 Las tres condiciones del levantamiento que determinan el diseño

1. **Acceso general** — toda la documentación del SGI es de acceso general para cualquier colaborador, sin restricción por rol, área ni país. *"Elimina el mayor costo oculto de este tipo de proyectos: no hay permisos que replicar dentro del índice."*
2. **Ciclo de actualización extenso** — los documentos se revisan en ciclos largos (actualización cada 3 años: el índice es casi estático). La sincronización se resuelve con trabajo programado, no con notificaciones en tiempo real.
3. **Vigencia como necesidad central** — la incertidumbre sobre la vigencia es el problema más costoso; la solución se diseña en torno a él y lo trata como requisito, no como funcionalidad.

Cuarto hecho del levantamiento, que baja la barrera de entrada: **el insumo crítico ya está comprometido** — el cliente puede facilitar 20–50 documentos representativos y el listado de preguntas frecuentes reales.

### 5.4 La solución

**Nombre comercial:** *Asistente Virtual SGI* / *Asistente documental con IA sobre el sistema de gestión integrado*.

**Definición canónica, para leer tal cual:**
> *"Un asistente con reglas de negocio explícitas y auditables, que determina en cada consulta si entrega una respuesta con referencia, solicita una precisión adicional o deriva al equipo responsable, y que no formula afirmaciones sin una fuente documental que las respalde."*

**Contraste de marca:**
> *"No es un buscador con lenguaje natural. Es un agente con reglas, que sabe cuándo responder, cuándo preguntar y cuándo callarse."*

**Las tres salidas del agente:**

| | Salida | Qué hace |
|---|---|---|
| **A** | **Responde con referencia / evidencia** | Entrega el requisito aplicable citando **documento, sección y versión**; la cita es navegable de vuelta al repositorio |
| **B** | **Solicita precisión (repregunta)** | Cuando el requisito aplicable depende de un dato que el usuario no declaró, pide esa precisión antes de responder |
| **C** | **Deriva** | Cuando no hay respaldo suficiente, escala al equipo responsable **con el caso ya estructurado** |

Y transversal: **la advertencia de vigencia**. Cuando la fuente utilizada fue reemplazada por una versión posterior, lo señala junto con la respuesta. Es el elemento que el propio Joaquín declaró como *"el elemento clave"*, y es el que conecta directamente con el dolor declarado.

**Las cinco reglas de negocio:** ver la tabla completa en §4 A-01. Se implementan como nodos explícitos del grafo de decisión, auditables de forma independiente del modelo de lenguaje.

**Caso de uso canónico de ambigüedad:** *"Tuve un accidente, ¿qué hago?"* — el requisito aplicable se bifurca según si hubo lesión, si hubo tiempo perdido y si ocurrió en ruta. Variante de entrada: *"Tuve un incidente en ruta, ¿qué debo hacer?"*

### 5.5 La experiencia de uso — las cinco pantallas

**1 · Punto de entrada.** Entrada única, sin curva de aprendizaje: *"se escribe la duda como se le contaría a un colega, no como una búsqueda por palabras clave"*. Accesos directos a los dos dominios del piloto. **Encabezado que declara a qué fecha está actualizada la documentación indexada.**

**2 · Consulta ambigua.** *"La pantalla más importante de la propuesta."* El asistente no responde: repregunta, con **opciones clicables, no texto libre** — menos fricción para el usuario y captura correcta de la bifurcación normativa.
> *"Responder de inmediato es el error. Un sistema que contesta lo genérico se ve bien y está equivocado. La mayoría de las herramientas hace exactamente eso."*
Nota de orador: detenerse aquí. Es contraintuitivo y es el mejor diferenciador.

**3 · Respuesta.** *"Una ficha, no un párrafo"*: respuesta directa, requisito detallado y fuentes con vigencia.
- **La cita es un objeto, no un enlace** — código de documento, sección, versión y estado de vigencia. *"Verificar cuesta un clic, no una búsqueda en SharePoint."*
- **Semáforo de confianza siempre visible** — *"mostrar la incertidumbre es lo que hace confiable la certeza"*
- **Alerta explícita de documento superado**
- **Panel de evidencia persistente** en la conversación — *"es lo que separa una herramienta de cumplimiento de un chatbot genérico"*

**4 · Derivación.** *"La derivación al equipo SGI es un entregable, no un mensaje de error."* Se arma el paquete completo: consulta original, contexto capturado, documentos ya revisados y qué faltó. *"El equipo SGI no parte de cero: recibe el caso ordenado en vez de una pregunta suelta por Teams."* Y *"cada derivación identifica una brecha: lo que hoy es una interrupción pasa a ser un dato sobre el corpus"*.

**5 · Panel del equipo SGI.** Volumen real medido, los KPIs que el propio cliente nombró (consultas resueltas sin recurrir al equipo, tiempo hasta la información completa) y brechas documentales priorizadas como agenda de trabajo. *"Este panel es un producto en sí mismo."*

Otras funcionalidades del portal: SSO, conversación con citas navegables, panel de fuentes consultadas, indicadores visibles de vigencia, **historial por usuario** y **canal de reporte de respuesta incorrecta**.

### 5.6 Arquitectura del caso SGS

**Principio rector:**
> *"La solución se despliega íntegramente dentro del ecosistema Microsoft de SGS. Ningún dato del sistema de gestión sale de la suscripción del cliente durante la operación del producto final."*

**Arquitectura por capas:**

| Capa | Componentes |
|---|---|
| **Canales** | Portal web con SSO + aplicación de Microsoft Teams. (App móvil nativa y API pública a terceros quedan fuera, como evolución natural) |
| **Núcleo** | Orquestación por grafo de decisión, reglas de negocio, verificación de respaldo y citación. **Es el componente desarrollado por adoOps** |
| **Recuperación** | Búsqueda híbrida densa + léxica, fusión de resultados y reranking |
| **Índice** | PostgreSQL con pgvector e índice HNSW, índice de texto completo y metadatos de versión y vigencia |
| **Ingesta** | Conector a Microsoft Graph, procesamiento documental con estructura, fragmentación jerárquica y enriquecimiento de metadatos |
| **Fuentes** | SharePoint Online del tenant del cliente |
| **Transversal** | Identidad, trazabilidad, observabilidad y control de presupuesto |
| **Modelos** | Capa de abstracción de proveedor sobre Azure OpenAI Service |

**Componentes concretos, y dónde vive cada uno:**

| Capa | Componente | Dónde vive |
|---|---|---|
| Identidad | **Microsoft Entra ID** con SSO y grupos de seguridad | Tenant del cliente |
| Fuente documental | **SharePoint Online** vía **Microsoft Graph**, con **delta query** | Tenant del cliente |
| Modelo de lenguaje | **Azure OpenAI Service**, región definida por el cliente | Suscripción del cliente |
| Índice de conocimiento | **Azure Database for PostgreSQL Flexible Server** con **pgvector** | Suscripción del cliente |
| Cómputo | **Azure Container Apps** (API del agente + worker de ingesta) | Suscripción del cliente |
| Canal web | Azure Container Apps o **Static Web Apps** | Suscripción del cliente |
| Canal Teams | **Azure Bot Service** + app publicada en el catálogo de Teams | Suscripción y tenant del cliente |
| Secretos | **Azure Key Vault** | Suscripción del cliente |
| Observabilidad | **Application Insights, Log Analytics y Azure Monitor** | Suscripción del cliente |
| Despliegue | **Azure DevOps o GitHub Actions**, ambientes dev/prod con reversión | A definir con TI del cliente |

**La versión de seis niveles, para audiencia no técnica** (la mejor forma de contar la arquitectura en una reunión ejecutiva):

| Nivel | Descripción | Dónde reside |
|---|---|---|
| **1 · Identidad** | Control de acceso con Entra ID, SSO y los grupos de seguridad ya definidos | Tenant del cliente |
| **2 · Documentación** | Lectura de SharePoint Online vía Microsoft Graph, **solo lectura**. No se mueven ni reorganizan repositorios | Tenant del cliente |
| **3 · Conocimiento** | Base de datos con índice semántico y de texto, con metadatos de versión y vigencia | Suscripción del cliente |
| **4 · Modelo** | Modelo de lenguaje sobre Azure OpenAI Service, en la región que defina el cliente | Suscripción del cliente |
| **5 · Reglas de negocio** | **El componente desarrollado por adoOps** | Suscripción del cliente |
| **6 · Canales** | Portal web con inicio de sesión corporativo y app de Teams. El usuario no instala software | Suscripción y tenant |

> Frase de cierre del nivel 5: *"El modelo de lenguaje y la documentación operan como insumos conectables. El modelo se selecciona y la documentación pertenece al cliente, de modo que la solución permite sustituir el modelo o ampliar las fuentes sin rehacerse."*

**Los dos procesos, en versión simple:**
- **A · Procesamiento de la documentación** — lectura y fragmentación conservando estructura (tablas íntegras) → extracción de datos clave a campos propios → indexación dual por significado y por palabra exacta
- **B · Resolución de una consulta** — recuperación con versión y vigencia → evaluación de suficiencia → validación de respaldo, descartando lo no fundado → entrega en una de las tres formas, con advertencia de vigencia cuando corresponde

### 5.7 Canales y lógica de accesos y permisos

**Canales:** portal web con SSO y aplicación de Microsoft Teams; ambos son *"capas de presentación sobre la misma API, las mismas reglas de negocio y el mismo índice"*. Criterio de uso y detalle en §4 A-03.

**Accesos de usuario:**
- SSO contra **Entra ID** usando los **grupos de seguridad ya existentes** del tenant. **No se crea directorio paralelo ni credenciales propias del asistente.**
- Consecuencia práctica, que hay que decir siempre: **el asistente hereda el ciclo de vida de la identidad corporativa.** Deshabilitar a una persona en Entra ID le quita el acceso sin ninguna acción adicional y sin intervención de adoOps.
- Se heredan también **MFA y acceso condicional** del tenant. *"La solución no las evade ni establece una vía de acceso alternativa."*

**Acceso de la aplicación a la documentación:**
- Identidad de aplicación registrada en el tenant del cliente, con permisos de aplicación de Microsoft Graph.
- **Se solicita `Sites.Selected`**: acceso únicamente a los sitios que el cliente autorice de forma explícita, sitio por sitio.
- **No se solicita `Sites.Read.All`**, que otorgaría lectura sobre la totalidad de SharePoint. *"La diferencia entre ambos es el punto que conviene revisar con mayor atención en la aprobación de permisos."*
- **Modalidad solo lectura.** No escribe, no mueve, no reorganiza ni elimina contenido.
- Se prefiere **identidad administrada** sobre secreto de cliente; si el secreto es inevitable, reside en Key Vault con rotación documentada.

**Acceso del equipo adoOps:**
- Rol **Contributor acotado a un único grupo de recursos** creado para el proyecto.
- **No** se solicitan permisos en Entra ID, **no** se solicita el rol de propietario, **no** se solicita acceso a otros grupos de recursos.
- *"El cliente puede retirar ese acceso en cualquier momento desde su propio portal, sin depender de adoOps y sin afectar la operación del asistente ya desplegado."*

**Segregación entre usuarios:** sobre la base del acceso general, **la recuperación no aplica filtros por usuario**. Límite declarado por adelantado: *"Si en el futuro se incorporan documentos con acceso restringido, la recuperación debe filtrarse según los permisos efectivos de quien consulta. Ese cambio afecta el diseño del índice y constituye una modificación de alcance, no un ajuste de configuración."*

### 5.8 Seguridad del caso

Detalle completo, redactado como respuestas de reunión, en §7. Resumen del caso: identidad corporativa heredada · secretos en Key Vault · registro de consultas de sólo adición sin endpoint de borrado · presupuesto configurable con alerta e interruptor de corte operable por TI del cliente · componentes sin exposición pública de la base de datos · TLS 1.2+ en tránsito y cifrado en reposo · servicio de modelo desplegado dentro de la suscripción del cliente · recomendación de solicitar el monitoreo modificado de uso indebido · Ley 21.719 con el cliente como responsable del tratamiento y adoOps como encargado durante la ejecución.

**Controles específicos de la primera entrega operativa** (única etapa en que documentos del cliente residen temporalmente en infraestructura de adoOps — ver §7.10).

### 5.9 Las fases del proyecto (nueve semanas)

| Fase | Semanas | Contenido | Hito de cierre |
|---|---|---|---|
| **P0 · Primera entrega operativa** | 1–3 | Montaje acotado, uso real por grupo reducido, revisión de resultados | Informe de la primera entrega operativa |
| **F0 · Levantamiento técnico** | 1 | Solicitudes técnicas de integración (suscripción, cuota, permisos de Graph, grupos de Entra ID, red, política). Inventario del corpus real | Solicitudes cursadas y corpus inventariado |
| **F1 · Ingesta y corpus** | 2 | Conector a Graph, extracción con estructura, fragmentación jerárquica, enriquecimiento, indexación híbrida | Los ~700 documentos consultables, con versión y vigencia |
| **F2 · Motor y reglas** | 2–4 | Búsqueda híbrida con reranking, orquestación de decisión, verificación de respaldo, advertencia de superado | El asistente responde con cita y respeta las cinco reglas |
| **F3 · Canales e interfaz** | 4–5 | Portal web con SSO, citas navegables, panel de fuentes, indicadores de vigencia, historial y reporte de error; canal Teams | Ambos canales usables sin instrucción previa |
| **F4 · Evaluación** | 5–6 | Set de 40 preguntas, medición contra umbrales, corrección de brechas, prueba de carga acotada, revisión de permisos | **Scorecard firmado** |
| **F5 · Entrega** | 6 | Despliegue productivo, monitoreo, alertas, límite de presupuesto, interruptor de corte, documentación y traspaso a TI | Entrega y puesta en producción |
| **F6 · Ruta de aprendizaje** | 3–9 | Producción de módulos y examen (S3–S5), publicación en la entrega, recorrido durante el acompañamiento | ≥85% de inscritos completa y aprueba |
| **F7 · Consultoría de adopción** | 6–9 | Cuatro sesiones semanales sobre consultas reales; artefacto de adopción personalizado | Informe de adopción y hoja de ruta |

**Hitos macro:** S3 resultados de la primera entrega operativa · **S6 entrega y go-live** · S9 informe de adopción con métricas y hoja de ruta.

**Por qué la primera entrega operativa corre en paralelo, y no antes:**
> *"Ejecutarla de forma secuencial obligaría a esperar tres semanas antes de iniciar el desarrollo. En paralelo, sus resultados se entregan en la semana 3, cuando el motor del producto final se encuentra en construcción y todavía admite ajustes."*

Verifica cuatro cosas antes de que el producto final esté terminado: si la recuperación funciona sobre el vocabulario propio del cliente, si la fragmentación respeta la estructura de sus tablas, si la detección de vigencia se sostiene con los metadatos efectivamente disponibles, y cuál es el estado real del corpus. Corre sólo sobre portal web; el ambiente se apaga al cierre de la semana 3 y sus documentos se eliminan.

**Metodología:** entregas verificables **por semana** y reunión de avance semanal.
> *"Dada la duración del proyecto no se emplean sprints de dos semanas. Cada semana tiene un hito propio y comprobable, y el estado del proyecto se mide contra ese hito antes que contra una estimación porcentual de avance."* *"El diseño se toma como base cerrada al inicio. En un plazo de esta naturaleza no se contempla reabrir decisiones de diseño. El trabajo consiste en implementar sobre un diseño ya definido y utilizar la primera entrega operativa para calibrarlo con datos reales."*

Argumento declarado abiertamente al cliente: *"El equipo de desarrollo trabaja con asistentes de IA generativa integrados a su flujo de trabajo, lo que sostiene la velocidad de construcción comprometida sin afectar la revisión humana de cada entrega."*

Modalidad remota, con hasta dos instancias presenciales a convenir.

### 5.10 Resultados, compromisos medidos y aprendizajes

**Compromisos medidos (criterios de aceptación, consolidados en scorecard firmado):** cobertura ≥90% · precisión de la cita ≥95% · detección de vigencia 100% · afirmaciones sin respaldo 0 · latencia p95 ≤8 segundos · adopción ≥85% de los inscritos completa la ruta y aprueba el examen. Las falsas alarmas se contabilizan como fallo.

**Aprendizajes reutilizables del caso — decirlos como aprendizajes, no como teoría:**

1. **El acceso universal fue la mejor noticia del levantamiento.** *"Elimina el mayor costo oculto de este tipo de proyectos: no hay permisos que replicar dentro del índice."* Averigua esto temprano en toda oportunidad.
2. **Pedir la versión obsoleta es la mejor demostración posible.** Nadie la pide y es la que ataca el dolor declarado.
3. **Anclar cada afirmación de seguridad a una respuesta del propio cliente** genera más confianza que un discurso genérico de seguridad.
4. **El pedido de cierre debe ser pequeño**: *"No pedimos que decidan sobre la arquitectura, el proveedor ni el presupuesto de implementación. Pedimos que definan, junto a nosotros, qué es una buena respuesta — y después lo medimos."*
5. **La sesión de definición del set vale por sí sola.** Obliga a explicitar qué considera el equipo experto una buena respuesta, y es trabajo que hoy no está hecho.
6. **La derivación bien hecha es un producto.** Convierte una interrupción en un dato sobre el corpus.
7. **El índice vectorial no se omite por analogía con proyectos chicos.** Existe un antecedente interno donde se eliminó deliberadamente el índice vectorial porque con un corpus muy pequeño degradaba el recall; con un corpus de este orden esa decisión sería catastrófica. Se dejó documentado al cliente como consideración técnica.
8. **La falsa alarma es fallo.** Un sistema que advierte siempre cumple formalmente y destruye la confianza.
9. **El canal que favorece la adopción es el que la gente ya usa**, aunque no sea el que mejor presenta la evidencia. Por eso van los dos.
10. **El proyecto siempre destapa problemas de la documentación del cliente.** Preséntalo como aporte, no como reclamo, y déjalo fuera del alcance por escrito desde el principio.

**Marco contractual del caso (reutilizable):** la propiedad intelectual del código, configuración, modelos de datos, documentación técnica y contenidos de aprendizaje producidos en el proyecto **es del cliente**; adoOps conserva la propiedad de sus componentes y metodologías preexistentes. La aceptación se formaliza mediante **scorecard firmado por ambas partes**. Las modificaciones de alcance se documentan, se dimensionan y requieren **aprobación escrita de ambas partes antes de ejecutarse**. Relación entre personas jurídicas, sin vínculo laboral. Vigencia de la propuesta: 30 días corridos.

⛔ **No contar en reunión:** la estrategia competitiva interna frente a la evaluación de plataforma que el cliente hacía por su cuenta, el brief anonimizado a un tercero, las banderas de riesgo internas y las discrepancias de plazo del material interno. Ver §15.

---

## 6. Arquitectura de referencia y decisiones técnicas

### 6.1 El principio de núcleo y perímetro

Es la lámina que responde tres objeciones que nadie dice en voz alta: *¿nos amarramos a un proveedor de IA? · ¿y si movemos la documentación de sitio? · ¿qué construyen ustedes exactamente?*

**Núcleo adoOps — no depende de proveedor:**
- **Reglas de negocio** — determinan cuándo responder, cuándo preguntar y cuándo derivar
- **Orquestación** — decide qué buscar, cuánto contexto leer y cuándo detenerse
- **Verificación de respaldo** — ancla cada afirmación en la fuente citada

**Perímetro — todo intercambiable:**

| Anillo | Opciones documentadas |
|---|---|
| **Canales de acceso** (por dónde se consulta) | Portal web · Microsoft Teams · SharePoint · Móvil · API |
| **Fuentes documentales** (de dónde lee) | SharePoint Online · Repositorios de red · Google Drive · Otros gestores documentales |
| **Modelos de lenguaje** (*"el motor se elige, no se hereda"*) | Azure OpenAI · Anthropic · OpenAI · Amazon Bedrock · Modelos abiertos autoalojados |
| **Sistemas de destino** (hacia dónde escala y registra) | Correo corporativo · Microsoft Teams · Mesa de ayuda / tickets · Registro de auditoría |

**Condición transversal:** *"Se despliega en la nube del cliente · Autenticación con el directorio corporativo · Los datos no salen de su infraestructura."*

**Guion de 60 segundos para esta lámina:**
1. *"Esta es la misma solución, mirada desde sus conexiones."*
2. *"Todo lo que ven punteado es intercambiable."* — recorrer el perímetro sin detenerse en ningún conector
3. *"Hoy leemos de SharePoint, pero podría ser otro repositorio. Hoy se accede por web, pero puede ser Teams."*
4. *"El modelo de lenguaje también es un conector. Y eso importa mientras su política de IA todavía se está definiendo."*
5. PAUSA. SEÑALAR EL CENTRO. *"Lo único que no se reemplaza son las reglas que determinan cuándo el sistema responde, cuándo pregunta y cuándo se abstiene."*
6. *"Eso es lo que estamos construyendo. Ninguna plataforma lo trae de fábrica: se diseña con ustedes."*

Regla de honestidad de la lámina: los conectores dentro del alcance de la propuesta se marcan; los demás *"son soportados por la arquitectura y se cotizan aparte — si preguntan, decirlo así"*.

### 6.2 Modelos y estrategia multi-proveedor

- El modelo de lenguaje es un **conector**, no una etapa del flujo: *"insumos conectables, no etapas del flujo"*.
- Proveedores contemplados por la arquitectura: **Azure OpenAI · Anthropic · OpenAI · Amazon Bedrock · modelos abiertos autoalojados**.
- En el caso documentado, el despliegue es **Azure OpenAI Service como recurso dentro de la suscripción del cliente**, en la región que el cliente defina.
- **El tipo de despliegue determina el alcance geográfico del procesamiento**: un despliegue regional estándar procesa dentro de la geografía del recurso; los identificados como Global o DataZone pueden procesar en otras geografías. **Se recomienda regional estándar** y así queda declarado en el diseño salvo indicación contraria del cliente.
- Justificación de la capa de abstracción: *"La independencia del proveedor es un compromiso de esta propuesta y se refleja en la estructura del código."*
- ⚠️ **Límite que hay que respetar en vivo:** *"En este alcance se entrega la interfaz definida con un proveedor implementado."* No afirmes que hay una capa multi-proveedor probada. Ver §15.1.
- Argumento de gobierno asociado: *"El modelo se mantiene desacoplado. No los amarra a una decisión que su gobernanza aún no ha tomado."*

### 6.3 RAG e ingesta

**Pipeline de ingesta** (se ejecuta al cargar el corpus y cada vez que un documento cambia): origen → extracción conservando estructura, con tablas enteras → fragmentación jerárquica con solapamiento y metadatos de vigencia replicados → enriquecimiento a columnas propias (código, versión, vigencia, plazos, referencias) → vectorización (1.536 dimensiones, `text-embedding-3-small`).

**Detección de cambios:** **delta query** sobre Microsoft Graph, de modo que la reingesta procesa únicamente lo que cambió.

**Índice:** PostgreSQL + pgvector · índice **HNSW** · **tsvector** · metadata de vigencia · estado del documento. *"La ingesta escribe acá una vez. La consulta lee de acá cada vez."*

**Pipeline de consulta** (completo en cada pregunta, en segundos):
1. **Pregunta** en lenguaje natural, convertida también a coordenadas
2. **Recuperación** — búsqueda por significado + por palabra exacta; **reranking de 30 a 8** (en la versión de PoC: de 30 candidatos a los 6–8 más pertinentes; especificación interna: reranking cross-encoder 30→8)
3. **Orquestación y reglas** — *punto de decisión*: ¿alcanza para responder? Si no, repregunta. Si no hay respaldo, deriva
4. **Verificación** — *punto de decisión*: cada afirmación debe estar anclada en un fragmento; lo que no, se elimina
5. **Respuesta** — con documento, sección y versión, y alerta si una fuente está superada

**Por qué el híbrido y no sólo vectorial:** *"en documentación normativa los usuarios citan códigos exactos"*. La recuperación densa resuelve el lenguaje natural; la léxica resuelve la mención literal de un código o del nombre exacto de un estándar, donde la semántica pierde precisión. Sus limitaciones se compensan entre sí.

### 6.4 Orquestación

- **Grafo de decisión** como forma de orquestación: cada regla es un **nodo explícito**, auditable con independencia del modelo de lenguaje.
- Implementación identificada internamente: **LangGraph StateGraph**, flujo `classify → retrieve → generate`.
- **Orquestación con herramientas, no búsqueda de un solo tiro:** *"El asistente puede buscar, leer la sección completa, verificar vigencia, cruzar estándares y repreguntar antes de responder."*
- Justificación para un dominio de cumplimiento: *"la capacidad de explicar por qué el sistema tomó una decisión determinada constituye un requisito"*.

### 6.5 Las cuatro capas ajustables — el argumento del techo

| # | Capa | Qué hace | Qué tipo de pregunta resuelve |
|---|---|---|---|
| 01 | **Ingesta y estructuración** | Conversión con reconocimiento de estructura, no extracción plana; tablas íntegras; cada fragmento carga su jerarquía y su metadata de versión y vigencia | Tablas y matrices · Vigencia y versión |
| 02 | **Recuperación híbrida** | Vectorial + léxica; reranking de 30 candidatos a los más pertinentes | Recuperación directa · Agregación entre documentos |
| 03 | **Orquestación con herramientas** | Buscar, leer la sección completa, verificar vigencia, cruzar estándares y repreguntar | Agregación · Aplicabilidad y excepciones |
| 04 | **Verificación de respaldo** | Antes de entregar, valida el anclaje de cada afirmación; lo no anclable se elimina o se marca | **Controla la invención** |

> *"Cada capa se corrige de forma independiente contra el set de evaluación. Ahí está el margen de mejora."* *"Cuando una arquitectura propia falla una pregunta, se corrige la capa que falló. Cuando falla una plataforma cerrada, se reescribe la instrucción y se espera."* **"La diferencia no es de resultado, es de techo."**

### 6.6 Decisiones técnicas y su justificación

| Decisión | Justificación |
|---|---|
| **pgvector sobre un motor vectorial dedicado** | Evita un componente adicional de infraestructura, resuelve el híbrido denso+léxico en el mismo motor y mantiene metadatos y vectores bajo la misma transacción. Un servicio de búsqueda administrado es alternativa válida si TI prefiere un servicio administrado puro; el esfuerzo es equivalente y cambia el perfil de costo mensual |
| **HNSW en lugar de ivfflat** | ivfflat exige calibrar parámetros según el volumen y **pierde precisión sin generar señales visibles** cuando ese volumen cambia. HNSW es más estable frente al crecimiento del corpus |
| **Orquestación por grafo de decisión** | Hace explícito y auditable el flujo entre responder, precisar y derivar. En un dominio de cumplimiento, poder explicar la decisión es un requisito |
| **Verificación de respaldo como paso separado** | Sostiene el compromiso de cero afirmaciones sin fundamento. Integrarla en la generación impediría medirla y auditarla de forma independiente |
| **Capa de abstracción de proveedor de modelo** | La independencia del proveedor es un compromiso de la propuesta y se refleja en la estructura del código |
| **Reingesta incremental automática desde el diseño** | *"Un corpus que se actualiza sobre un índice que no se regenera produce respuestas correctas respecto de contenido desactualizado, que es el tipo de error de mayor impacto en este sistema"* |

**Consideración documentada explícitamente al cliente:** *"En sistemas con corpus muy pequeños, del orden de menos de doscientos fragmentos, puede justificarse operar sin índice vectorial, porque la calibración del índice degrada el recall más de lo que aporta. Ese criterio no aplica en este proyecto."* Con un corpus del orden de cientos de documentos fragmentados, el índice vectorial es necesario y sus parámetros deben medirse sobre el corpus real.

### 6.7 Infraestructura y despliegue

- Todo dentro de la suscripción y el tenant del cliente. Sin exposición pública de la base de datos; tráfico entre componentes dentro de la red virtual.
- Cómputo en contenedores administrados (API del agente + worker de ingesta); canal web sobre contenedores o sitio estático; canal Teams sobre Bot Service.
- Secretos en bóveda, con preferencia por identidad administrada sobre secreto de cliente.
- **CI/CD con ambientes de desarrollo y producción y reversión documentada.**
- **Traspaso a TI**: manual de operación, runbook de incidentes y procedimiento de reversión, *"de modo que la operación del día a día no dependa de adoOps"*.
- Lo que queda fuera de un alcance ajustado y hay que declarar: ambiente de staging separado, segunda iteración de interfaz, campaña extendida de pruebas de carga, capa multi-proveedor probada, panel de administración de ingesta y tableros de observabilidad a medida.

### 6.8 Observabilidad y evaluación de la calidad de las respuestas

**Observabilidad:** Application Insights, Log Analytics y Azure Monitor **dentro de la suscripción del cliente**. Panel de observabilidad, alertas, límite de presupuesto e interruptor de corte forman parte de los entregables.

**Qué se registra por consulta:** usuario, marca de tiempo y consulta formulada · fragmentos recuperados con documento, sección y versión · **decisión del asistente entre responder, precisar o derivar** · respuesta entregada y advertencias de vigencia emitidas · eventos de operación, errores y consumo.

**Evaluación de calidad — el instrumento es el set de preguntas** (ver §4 A-12). Puntos que diferencian esta forma de evaluar:
- Preguntas reales del cliente, con respuesta esperada y fuente de origen
- Umbrales acordados **antes** de correr la medición
- **Evaluación a ciegas** por el equipo del cliente
- Medición reproducible: *"cualquiera puede repetir la medición"*
- Bloques que prueban lo que casi nadie prueba: tablas, vigencia, ambigüedad, ausencia de respaldo, premisas falsas incrustadas e intentos de inducir invención
- **Las falsas alarmas cuentan como fallo**
- El resultado se consolida en **scorecard firmado por ambas partes** y es el criterio de aceptación
- Cuando cambia el modelo, **se revalida el scorecard** (§8)

### 6.9 Control de costos operativos (sin montos)

Cómo se habla de costo operativo sin dar cifras — todo esto es decible:

- **La estructura del costo, no el monto:** el componente principal es infraestructura encendida por hora (base de datos del índice y contenedores de la aplicación), que se factura con independencia del volumen de uso. El consumo del modelo de lenguaje es la **fracción minoritaria** del total.
- **Consecuencia práctica:** el costo **varía poco ante una menor actividad** y **crece de forma acotada frente a incrementos significativos de uso**. Multiplicar el volumen de consultas en un período de auditoría o recertificación no multiplica el costo.
- **Escala por volumen de consultas, no por usuarios.** Es la diferencia estructural con el licenciamiento por usuario o por mensaje de una plataforma cerrada.
- **Control de gasto entregado, no prometido:** presupuesto configurable con **alerta al umbral**, **verificación previa a cada consulta** e **interruptor de corte operable por TI del cliente**. Se dejan configuradas las alertas en la herramienta de gestión de costos de la nube con aviso a la contraparte técnica.
- **La exclusión que hay que declarar siempre:** el consumo y licenciamiento de nube **no está incluido**; lo factura el proveedor cloud directamente a la suscripción del cliente y adoOps no lo intermedia. *"Es la exclusión de mayor impacto económico y conviene tenerla presente desde el inicio."*
- **Compromiso de transparencia:** se entrega una **estimación mensual referencial del consumo de nube en la primera semana**, calibrada con el consumo real de la primera entrega operativa.
- Factores que mueven la estimación: región seleccionada, exigencia de alta disponibilidad en zona redundante, nivel de retención de registros y el acuerdo comercial que el cliente tenga con su proveedor cloud.

⚠️ **Regla dura para el agente:** nunca des el rango ni el monto en vivo. La frase es:
> *"Es un costo que factura directamente su proveedor de nube a su suscripción, nosotros no lo intermediamos, y les entregamos la estimación calibrada en la primera semana con el consumo real de la prueba. Lo que sí les dejamos configurado desde el día uno es la alerta de presupuesto y el corte."*

---

## 7. Seguridad, privacidad y cumplimiento

> Redactado como respuestas listas para dar en reunión. Cada bloque se puede leer casi tal cual. Táctica de fondo, declarada en el material: **anclar cada afirmación de seguridad a una respuesta concreta del levantamiento del cliente.** *"Mostrar que leímos lo que TI contestó genera más confianza que un discurso genérico de seguridad."*

### 7.1 "¿Dónde viven nuestros datos?"

> *"La solución se despliega íntegramente dentro de su suscripción cloud y su tenant. En la operación del producto final, ningún documento y ninguna consulta salen de su infraestructura. La única excepción, acotada en el tiempo y descrita por escrito, es la prueba inicial, si es que deciden hacerla sobre nuestra infraestructura para no depender del proceso de habilitación de TI."*

Puntos de apoyo: la documentación permanece en el repositorio del cliente y se lee en modalidad **solo lectura** · el índice, el modelo, el cómputo, los secretos y la observabilidad viven en la suscripción del cliente · la solución **no mantiene una segunda copia completa del repositorio**, sólo fragmentos y metadatos necesarios para responder con cita.

### 7.2 Modelo de responsabilidad compartida

> *"Definirlo de forma explícita evita zonas sin responsable asignado."*

| Ámbito | Proveedor cloud | Cliente | adoOps |
|---|---|---|---|
| Seguridad física, del hipervisor y de los servicios de plataforma | **Responsable** | Verifica | Verifica |
| Configuración del tenant, políticas de identidad y acceso condicional | — | **Responsable** | Se ajusta |
| Suscripción cloud, cuota de servicio y presupuesto | — | **Responsable** | Configura alertas |
| Permisos de acceso al repositorio documental | — | **Aprueba** | Solicita el mínimo necesario |
| Diseño y configuración segura de la aplicación | — | Revisa | **Responsable** |
| Despliegue, reversión y traspaso documentado | — | Autoriza | **Ejecuta** |
| Contenido y calidad del corpus documental | — | **Responsable** | Reporta hallazgos |
| Operación diaria posterior al cierre del proyecto | — | **Responsable** | Fuera del alcance |

### 7.3 Cifrado

> *"En tránsito, TLS 1.2 o superior en todo: acceso de los usuarios al portal, llamadas entre componentes, acceso a la base de datos y llamadas al servicio de modelo. En reposo, cifrado transparente en la base de datos y cifrado de servicio en el almacenamiento, con claves administradas por la plataforma. Si su política exige claves administradas por el cliente, se configuran sobre la bóveda de claves — conviene definirlo la primera semana porque condiciona el aprovisionamiento."*

### 7.4 Gestión de secretos y aislamiento de red

> *"Las credenciales y cadenas de conexión residen en la bóveda de claves. No quedan en el código fuente, ni en el repositorio, ni en variables de entorno en texto plano. La base de datos y los contenedores se despliegan sin exposición pública y el tráfico entre componentes ocurre dentro de la red virtual de su suscripción. Si su política exige puntos privados, se incorporan en el diseño de red durante el levantamiento técnico."*

**Las cuatro decisiones de la semana 1** (*"más costosas de cambiar después"*): región de despliegue · tipo de despliegue del servicio de modelo · uso de claves administradas por el cliente · exigencia de puntos privados.

### 7.5 Roles, permisos y control de acceso

**Usuarios:** SSO contra el directorio corporativo, con los **grupos de seguridad ya existentes**. No se crea directorio paralelo ni credenciales propias. **El asistente hereda el ciclo de vida de la identidad corporativa**: deshabilitar a una persona en el directorio le quita el acceso sin intervención de adoOps. **MFA y acceso condicional del tenant se aplican igual que a cualquier otra aplicación; la solución no los evade.**

**Aplicación sobre el repositorio:** permiso acotado **sitio por sitio** (`Sites.Selected`), **no** lectura total del repositorio (`Sites.Read.All`). *"La diferencia entre ambos es el punto que conviene revisar con mayor atención en la aprobación de permisos."* Modalidad **solo lectura**: no escribe, no mueve, no reorganiza, no elimina. Preferencia por identidad administrada sobre secreto de cliente; si el secreto es inevitable, vive en la bóveda con rotación documentada.

**Equipo adoOps:** rol Contributor **acotado a un único grupo de recursos** creado para el proyecto. Sin permisos en el directorio, sin rol de propietario, sin acceso a otros grupos de recursos. *"El cliente puede retirar ese acceso en cualquier momento desde su propio portal, sin depender de adoOps y sin afectar la operación del asistente ya desplegado."*

### 7.6 Segregación entre usuarios

> *"Sobre la base de que la documentación es de acceso general, la recuperación no aplica filtros por usuario. Ahora bien, si en el futuro incorporan documentos con acceso restringido, la recuperación debe filtrarse según los permisos efectivos de quien consulta. Ese cambio afecta el diseño del índice y es una modificación de alcance, no un ajuste de configuración. Conviene tenerlo presente antes de ampliar el corpus."*

Dilo **antes** de que lo pregunten. Es el punto donde más proveedores prometen de más.

### 7.7 Tratamiento de datos por el modelo de lenguaje

*"Esta es la pregunta que suele concentrar la revisión de seguridad."*

- **Qué se envía:** en cada consulta, el prompt de sistema con las reglas de negocio, la pregunta del usuario y **sólo los fragmentos recuperados para esa consulta**. *"No se envía el corpus completo ni se mantiene una copia del repositorio en el servicio de modelo."*
- **Dónde se procesa:** el servicio de modelo es un **recurso dentro de la suscripción del cliente**, en la región que el cliente defina. *"Las llamadas no se dirigen a la interfaz pública del proveedor del modelo ni interactúan con servicios operados por ese proveedor."*
- **Tipo de despliegue = alcance geográfico:** un despliegue regional estándar procesa dentro de la geografía del recurso; los identificados como Global o DataZone pueden procesar en otras geografías. **Se recomienda regional estándar.**
- **Uso y retención:** el proveedor cloud declara que las entradas y salidas del cliente, sus incrustaciones y sus datos de entrenamiento **no se usan para mejorar modelos ni servicios**, **no se usan para entrenar modelos fundacionales sin instrucción del cliente**, y **no quedan disponibles para el proveedor del modelo**. *"Los modelos operan sin estado y no almacenan las entradas ni las salidas."*
- **Monitoreo de uso indebido:** el servicio ejecuta un monitoreo automatizado. Ante una alerta, un conjunto acotado de personal autorizado puede revisar el contenido señalado, desde estaciones seguras y con aprobación puntual. El almacén está separado lógicamente por recurso de cliente y reside en la geografía del recurso.
- **Recomendación proactiva:** solicitar el **monitoreo modificado de uso indebido**, que elimina tanto el almacenamiento como la revisión humana del contenido. Requiere postular a un programa de acceso limitado. *"adoOps recomienda gestionarlo durante la fase de levantamiento técnico, de modo que la respuesta esté resuelta antes de la puesta en producción."*

### 7.8 Seguridad específica de la solución de IA

**Inyección de instrucciones desde el contenido (prompt injection).**
> *"Un documento del repositorio podría contener texto redactado para alterar el comportamiento del asistente, dado que el contenido recuperado se incorpora al prompt. El riesgo es real en un corpus que muchas personas pueden editar."*
Mitigaciones:
- **Separación de planos** — instrucciones del sistema y contenido recuperado se mantienen separados. **El contenido de los documentos se trata como dato de referencia y no como instrucción ejecutable**
- **Verificación de respaldo** — la validación posterior a la generación descarta lo que no puede asociarse a un fragmento recuperado, lo que limita el efecto de una instrucción insertada
- **Evaluación** — el set de preguntas incluye casos construidos para inducir respuestas sin fundamento; su resultado se mide y se firma en el scorecard

**Superficie de acción del asistente** (respuesta corta y contundente):
> *"El asistente entrega texto y referencias. No ejecuta acciones sobre sus sistemas, no escribe en el repositorio, no envía correos y no dispone de integraciones de escritura. Su capacidad de causar daño está limitada por diseño a entregar una respuesta incorrecta — y ese riesgo se controla con las reglas de negocio y con la advertencia de vigencia."*

**Control de consumo:** presupuesto configurable, verificación previa a cada consulta y mecanismo de corte operable por TI del cliente *"limitan el impacto de un uso abusivo o de un fallo que genere llamadas en exceso"*.

### 7.9 Certificaciones y due diligence de proveedor

> *"Los servicios operan bajo el programa de cumplimiento de la plataforma cloud, que incluye entre otras ISO/IEC 27001, ISO/IEC 27017, ISO/IEC 27018 y los informes SOC 1, SOC 2 y SOC 3. Ustedes pueden verificar el alcance vigente de cada servicio en el portal de confianza del proveedor. Y les digo lo otro con la misma claridad: **adoOps no aporta certificaciones propias en este alcance y no las declara.**"*

Los requisitos que el cliente exija a un proveedor (certificación, evaluaciones de terceros, acuerdo de confidencialidad) *"se abordan antes de la firma, no durante el proyecto"*.

**Pruebas de penetración:** quedan fuera de un alcance ajustado por extensión de plazo, con dos caminos compatibles:
1. **Ejecución por el cliente** con su proveedor habitual sobre el ambiente entregado; adoOps aporta **sin costo** la documentación de arquitectura, el inventario de componentes y los puntos de exposición necesarios para dimensionarlas
2. **Incorporación al alcance**, cotizada por separado, antes de la puesta en producción
El proveedor cloud permite ejecutar pruebas de penetración sobre los recursos propios de la suscripción conforme a sus reglas de participación, que el cliente debe revisar antes de encargarlas.

### 7.10 Trazabilidad y auditoría

> *"El registro de actividad es el control que permite responder por qué el asistente entregó una respuesta determinada, que es la pregunta que aparece en una auditoría."*

| Qué se registra | Para qué sirve |
|---|---|
| Usuario, marca de tiempo y consulta formulada | Reconstruir quién consultó qué y cuándo |
| Fragmentos recuperados, con documento, sección y versión | Verificar sobre qué evidencia se construyó la respuesta |
| Decisión del asistente entre responder, precisar o derivar | Comprobar que las reglas de negocio se aplicaron |
| Respuesta entregada y advertencias de vigencia emitidas | Contrastar lo que el usuario efectivamente recibió |
| Eventos de operación, errores y consumo | Detectar comportamiento anómalo y controlar el gasto |

- **Integridad:** el registro admite **únicamente escrituras de adición**. *"No se expone un método para eliminar o modificar entradas registradas."*
- **Ubicación:** dentro de la suscripción del cliente. **El registro no sale de su infraestructura.**
- **Retención:** configurable. **Se recomienda un mínimo de doce meses**, de modo que cubra un ciclo completo de auditoría. La definición corresponde al cliente y afecta el costo mensual.

### 7.11 Datos personales (Chile, Ley 21.719)

- **Vigencia plena desde el 1 de diciembre de 2026**, coincidiendo con los primeros meses de operación de un sistema que entre en producción en 2026.
- *"Un sistema de gestión de seguridad y salud ocupacional habitualmente contiene datos personales, entre ellos registros de incidentes, nóminas de capacitación y antecedentes de exámenes ocupacionales."* Si el corpus los contiene, su tratamiento queda alcanzado por la ley.
- **Roles:** el cliente es **responsable del tratamiento** (determina finalidad y medios); adoOps actúa como **encargado de tratamiento** durante la ejecución, y esa condición **se limita a la primera entrega operativa**, porque en el producto final los datos no salen de la infraestructura del cliente.
- **Controles que aporta la solución:** cifrado en tránsito y en reposo · control de acceso por identidad corporativa con las políticas de autenticación del cliente · registro de accesos · minimización (lectura sin escritura, sin copia completa del repositorio, sin transferencia fuera del tenant en el producto final).
- **Recomendaciones al cliente (dichas proactivamente, generan mucha confianza):** 1. **Identificar el contenido con datos personales antes de la ingesta.** El triaje por tipo de documento permite excluir del índice lo que no deba ser consultable por todos 2. **Definir el plazo de retención del registro de consultas** — *"la consulta de un usuario constituye un dato asociado a una persona identificada"* 3. **Incorporar el proyecto al inventario de tratamientos** y evaluar si corresponde una **evaluación de impacto**, según el criterio del delegado de protección de datos
- **Notificación de incidentes:** adoOps se compromete a notificar a la contraparte técnica designada **dentro de las 24 horas** siguientes a la detección de cualquier incidente que pudiera constituir una brecha de datos personales, *"con la información disponible en ese momento y sin esperar a completar el análisis"*.

### 7.12 Controles durante la prueba inicial (única salida temporal de datos)

> *"Es la única etapa del proyecto en la que un subconjunto del corpus reside temporalmente en nuestra infraestructura. Es también el punto de mayor exposición, y por eso se describe con detalle."*

| Control | Cómo se aplica |
|---|---|
| **Acotamiento del corpus** | El subconjunto se acuerda antes de la extracción y se limita a lo necesario |
| **Ambiente dedicado** | Exclusivo del proyecto, **sin compartir infraestructura con otros clientes de adoOps** |
| **Acceso nominado** | Restringido al equipo del proyecto, con las personas identificadas **por nombre** ante el cliente |
| **Cifrado** | En tránsito y en reposo, con el mismo estándar del producto final |
| **Sin copias** | No se generan copias fuera del ambiente; **no se usan estaciones de trabajo personales** para almacenar el contenido |
| **Eliminación verificable** | Al cierre se eliminan documentos y ambiente, **con constancia escrita** |

Más el perímetro de acceso en cinco capas de §4 A-07 (lista blanca, código de un solo uso, sesión de expiración corta, sólo fragmentos citados, auditoría y caducidad automática).

**Plan B si la política del cliente no permite la salida temporal:** montar la prueba sobre un subconjunto no sensible o sobre documentación anonimizada, *"sin que ello altere su propósito"*; como última alternativa, diferirla hasta que la suscripción del cliente esté habilitada, con el efecto de retrasar la evidencia.

### 7.13 Continuidad, respaldo, incidentes y cierre

- **Respaldos:** base de datos con respaldo automático y retención configurable (siete días por defecto). *"El corpus siempre puede reconstruirse desde el repositorio, que es la fuente de origen."*
- **Reversión:** procedimiento documentado en el runbook traspasado a TI en la entrega.
- **Gestión de incidentes:** el runbook incluye clasificación y ruta de escalamiento; los eventos con implicancia de seguridad se comunican a la contraparte técnica **dentro de 24 horas** de su detección.
- **Cierre del proyecto:** al término del acompañamiento, adoOps **no conserva credenciales, accesos activos ni copias** de la documentación del cliente. La devolución o eliminación se documenta y se entrega constancia.

### 7.14 Resumen de controles por dominio (para contrastar con el marco de control del cliente)

| Dominio | Controles comprometidos |
|---|---|
| **Control de acceso** | SSO con el directorio corporativo, herencia del ciclo de vida de la identidad, permiso al repositorio acotado por sitio, rol Contributor limitado a un grupo de recursos, revocación unilateral por el cliente |
| **Criptografía** | TLS 1.2+, cifrado transparente y de servicio en reposo, secretos en bóveda con identidad administrada |
| **Seguridad de las operaciones** | Aislamiento de red sin exposición pública, presupuesto con alerta y corte, respaldos con retención configurable, procedimiento de reversión |
| **Registro y monitoreo** | Registro de consultas de sólo adición, trazabilidad de fragmentos y versiones, observabilidad dentro de la suscripción del cliente, retención definida por el cliente |
| **Relación con proveedores** | Modelo de responsabilidad compartida explícito, certificaciones de la plataforma verificables, condición de encargado de tratamiento acotada |
| **Seguridad de la solución de IA** | Separación entre instrucciones y contenido, verificación de respaldo, evaluación con casos de inducción, **ausencia de superficie de escritura** |
| **Cumplimiento** | Alineamiento con la Ley 21.719, notificación de incidentes en 24 horas, eliminación verificable al cierre |

**Descargo que hay que decir al entregar el anexo** (suma credibilidad, no la resta):
> *"Este anexo describe los controles que nos comprometemos a implementar y las condiciones que dependen de ustedes. No constituye una certificación ni una auditoría de seguridad, y no reemplaza la revisión que su área de seguridad de la información estime necesaria."*

---

## 8. Modelo de soporte, SLA y mantenimiento evolutivo

### 8.1 Las tres capas del servicio, en orden

1. **Acompañamiento incluido en el proyecto** — cuatro sesiones consultivas semanales posteriores al go-live, con ajustes aplicados al sistema en cada sesión (§4 A-04).
2. **Garantía** — durante esas cuatro semanas, la corrección de defectos atribuibles a la implementación está incluida.
3. **Mantenimiento evolutivo** — capa mensual opcional, posterior al cierre del proyecto (§4 A-06). **No es un supuesto: se contrata aparte y se dice así desde la primera reunión.**

### 8.2 Qué es y qué no es un defecto (definición contractual)

**Es defecto:** *"el comportamiento que se aparta de lo comprometido"* en el alcance funcional y en los criterios de calidad de la propuesta.

**No es defecto, y por lo tanto no está cubierto por la garantía:**
- Problemas originados en la **calidad del corpus documental**
- **Cambios de alcance** solicitados durante la ejecución
- **Indisponibilidades de los servicios del proveedor cloud**

Decirlo en reunión, sin rodeos:
> *"Si el asistente se comporta distinto de lo que comprometimos, lo arreglamos nosotros y está incluido. Si el problema es que dos procedimientos de ustedes se contradicen, eso lo reportamos y la corrección la decide el área dueña de la documentación."*

### 8.3 Niveles de servicio cualitativos

El material no define tiempos de respuesta contractuales por severidad. Lo que sí está comprometido, y es lo que se puede afirmar:

| Compromiso | Contenido |
|---|---|
| **Notificación de incidentes de seguridad** | Comunicación a la contraparte técnica **dentro de 24 horas** de la detección, con la información disponible en ese momento y sin esperar a completar el análisis |
| **Monitoreo y alertas** | Panel de observabilidad, alertas y umbrales configurados y traspasados a TI del cliente |
| **Reversión** | Procedimiento documentado en el runbook; despliegue con ambientes y reversión |
| **Runbook de incidentes** | Clasificación de incidentes y ruta de escalamiento, entregados a TI |
| **Control de gasto** | Presupuesto con alerta al umbral e interruptor de corte operable por el cliente |
| **Respaldo** | Respaldo automático de la base de datos con retención configurable; el corpus siempre reconstruible desde el repositorio de origen |
| **Punto de contacto** | adoOps designa **un responsable de proyecto único** |

⚠️ Si el cliente pide un SLA con tiempos de respuesta por severidad, la respuesta correcta es:
> *"Eso lo definimos en el contrato de mantenimiento, en función de la criticidad que ustedes le asignen al sistema. Hoy lo que está comprometido por escrito es la notificación de incidentes de seguridad dentro de 24 horas y el runbook con la ruta de escalamiento."*
No inventes tiempos de respuesta.

### 8.4 Gobierno del servicio y comités

- **Durante el proyecto:** reunión de avance **semanal** con la contraparte del cliente, contra un hito propio y comprobable de esa semana — no contra un porcentaje de avance.
- **Durante el acompañamiento:** **cuatro sesiones consultivas semanales** con foco definido para cada una (puesta en marcha → respuestas incorrectas y derivaciones → calibración de vocabulario y casos límite → cierre de adopción).
- **En la capa de mantenimiento evolutivo:** **sesión mensual de revisión** con la contraparte del cliente, más **informe mensual** de uso, cobertura y brechas documentales.
- **Contrapartes del cliente:** una técnica y una funcional, designadas **con nombre y disponibilidad agendada** desde antes del inicio, participando desde la primera semana.
- **adoOps designa un responsable de proyecto único.**

### 8.5 El ciclo de mejora y cómo se prioriza el backlog

El backlog de evolución no se prioriza por opinión: se prioriza por evidencia recogida del sistema en operación. Fuentes de priorización, en orden de peso:

1. **Respuestas incorrectas reportadas por usuarios** a través del canal de reporte — son defectos potenciales y van primero.
2. **Derivaciones que debieron resolverse** — indican una brecha del motor, no del corpus.
3. **Consultas recurrentes sin respaldo** — indican una **brecha documental**; no se corrigen con código, se reportan al área dueña como agenda de trabajo.
4. **Vocabulario y sinónimos propios del cliente** que la recuperación no está capturando — se incorporan como glosario.
5. **Documentos mal fragmentados** detectados en el uso real — correcciones de ingesta.
6. **Resultado de la revalidación del scorecard** tras un cambio de modelo o del corpus.
7. **Costos y riesgos** observados en el monitoreo.

Ciclo formal detrás de esta priorización (§3.3): **Monitorear → Evaluar → Aprender → Adaptar → Escalar.**

Regla de gobierno del alcance, que evita la fricción clásica:
> *"Los trabajos que excedan la bolsa mensual se dimensionan y se aprueban antes de ejecutarse."*
Y en el proyecto: *"Toda modificación al alcance se documenta, se dimensiona y requiere aprobación escrita de ambas partes antes de su ejecución."*

### 8.6 Traspaso y no dependencia

El traspaso a TI del cliente incluye **manual de operación**, **runbook de incidentes** y **procedimiento de reversión**, *"de modo que la operación del día a día no dependa de adoOps"*.

Además, transferencia de conocimiento durante la construcción:
> *"Las contrapartes técnica y funcional participan desde la semana 1 y pueden acompañar las sesiones de trabajo durante todo el desarrollo. El objetivo es que conozcan cómo se construye la solución mientras se construye, y no solo al momento del traspaso."*

Y al cierre del acompañamiento se entrega una **hoja de ruta de evolución con opciones dimensionadas** (entre ellas, típicamente, app móvil nativa y API pública a terceros).

Argumento de venta contraintuitivo pero muy eficaz:
> *"Nuestro objetivo explícito es que la operación del día a día no dependa de nosotros. Por eso entregamos manual, runbook y reversión. Si después quieren que la operemos con ustedes, es una decisión suya, no una necesidad que les creamos."*

---
## 9. Banco de preguntas por temática

> Preguntas escritas para decirse **tal cual**, en español de Chile. Las marcadas con **‹fuente: SGS›** provienen de decisiones, requerimientos o respuestas efectivamente presentes en la documentación del caso SGS; las demás son formulaciones derivadas del mismo material. Regla de uso: una pregunta por turno. Espera la respuesta antes de la siguiente.

### 9.1 Apertura y encuadre

- ¿Qué los hizo abrir esta conversación ahora y no hace seis meses?
- ¿Qué esperan llevarse de esta reunión para que haya valido la pena?
- ¿Quiénes están hoy en la sala y quién falta para que esto avance?
- ¿Esto ya es un proyecto con dueño y presupuesto, o todavía es una exploración?
- ¿Ya evaluaron alguna alternativa? ¿Cuál y qué encontraron?
- ¿Hay alguna evaluación en curso en paralelo, interna o con otro proveedor?
- ¿Prefieren que partamos por el método o que partamos por su caso?
- ¿Cuánto tiempo tenemos hoy y qué es lo que no puede quedar sin cubrir?
- ¿Hay algún plazo o hito de la organización con el que esto tenga que calzar?
- ¿Qué tendría que pasar para que dentro de tres meses ustedes digan que esto fue un acierto?
- ¿Qué les preocupa más de meterse en un proyecto de IA: que no funcione, que no lo usen, o que no lo puedan mantener?
- Antes de que les cuente nada: ¿qué es lo que ya intentaron y no resultó?
- ¿Hay alguien en la organización que se va a oponer a esto? ¿Por qué motivo?
- ¿Quieren que hoy definamos alcance, o que definamos cómo lo vamos a probar?
- ¿Prefieren un piloto acotado con resultado medido, o ir directo a implementación?

### 9.2 Caso de uso y dolor

- Cuénteme el último caso concreto en que esto les dolió. ¿Qué pasó exactamente?
- ¿Quién sufre el problema todos los días, y quién lo sufre de vez en cuando pero caro?
- ¿Cuál es el costo real de responder o actuar con la información equivocada? ‹fuente: SGS›
- ¿Han tenido no conformidades, observaciones de auditoría o multas por esto? ‹fuente: SGS›
- ¿Se han repetido incidentes por incumplimiento de un estándar que sí estaba escrito? ‹fuente: SGS›
- ¿El problema es que no encuentran la información, o que la encuentran y no confían en ella? ‹fuente: SGS›
- ¿En qué dos o tres temas se concentran las consultas hoy? ‹fuente: SGS›
- ¿Qué preguntas les llegan una y otra vez al equipo experto?
- ¿Cuánto de ese trabajo es criterio y cuánto es buscar un dato que ya está escrito?
- Si mañana esto estuviera resuelto, ¿qué haría distinto su equipo el lunes?
- ¿Qué parte del proceso preferirían que el sistema **no** toque?
- ¿Este dolor lo tienen sólo ustedes o se repite en otras áreas de la organización?
- ¿Hay una fecha o un evento (auditoría, recertificación, fiscalización) que ponga presión sobre esto?
- ¿Qué está pasando hoy que hace que este problema sea urgente y no sólo importante?
- ¿Cuál sería el caso de uso más angosto posible con el que ya valdría la pena partir?

### 9.3 Fuentes de conocimiento y calidad documental

- ¿Cuántos documentos son, y en qué formatos? ‹fuente: SGS›
- ¿Dónde viven hoy: un solo repositorio o varios? ‹fuente: SGS›
- ¿Son PDFs nativos o escaneados? ¿Tienen los editables disponibles? ‹fuente: SGS›
- ¿Tienen control de versiones y metadata poblada en el repositorio? ‹fuente: SGS›
- ¿Cada cuánto se revisan y se reemplazan esos documentos? ‹fuente: SGS›
- ¿Cómo sabe hoy una persona, mirando un documento, si está vigente?
- ¿Cuánto del contenido crítico vive dentro de tablas, matrices de riesgo o cuadros de plazos?
- ¿Hay formularios y registros sin contenido normativo mezclados en el mismo repositorio?
- ¿Saben si hay duplicados o versiones en conflicto dando vueltas?
- ¿Hay documentos que se contradicen entre sí?
- ¿Hay referencias cruzadas entre documentos, y están al día?
- ¿Existe vocabulario propio de la casa que un tercero no entendería?
- Si encontramos versiones en conflicto, ¿quién decide cuál queda? ‹fuente: SGS›
- ¿Están dispuestos a que el proyecto les entregue un diagnóstico del estado real de su documentación?
- ¿Nos pueden facilitar entre veinte y cincuenta documentos representativos, incluidos dos o tres de los que la gente abre por error y **al menos una versión obsoleta** de un procedimiento vigente? ‹fuente: SGS›
- ¿Tienen el listado de las preguntas frecuentes reales que le llegan al equipo por correo, chat y llamadas? ‹fuente: SGS›
- ¿Hay documentación crítica fuera del repositorio principal — unidades de red, carpetas locales, correos?

### 9.4 Usuarios, canales y volumen de uso

- ¿Cuántas personas usarían esto, y de qué áreas? ‹fuente: SGS›
- ¿Dónde trabajan realmente todo el día: correo, chat corporativo, intranet, terreno?
- ¿Qué proporción de esos usuarios es personal externo, y qué acceso tiene al chat corporativo? ‹fuente: SGS›
- ¿Hay gente en terreno sin equipo corporativo?
- ¿Cuántas consultas recibe hoy el equipo experto al mes? ¿Está medido o es una impresión? ‹fuente: SGS›
- ¿Por qué canales le llegan esas consultas hoy? ‹fuente: SGS›
- ¿Qué porcentaje de esas consultas es repetida?
- ¿Hay picos de uso previsibles — auditorías, recertificaciones, cierres de mes?
- ¿Prefieren una entrada única propia o que quede embebido donde ya trabajan?
- ¿Quiénes serían los usuarios de un piloto, y cuánto tiempo real le pueden dedicar? ‹fuente: SGS›
- ¿Quiénes deberían pasar por la ruta de aprendizaje?
- ¿Hay usuarios que necesiten esto en otro idioma?
- ¿Hay algún grupo que no debería tener acceso, al menos en una primera etapa?
- ¿Cuál sería el canal principal para cada grupo de usuarios? ‹fuente: SGS›

### 9.5 Integraciones y sistemas existentes

- ¿Qué sistemas tendrían que conversar con esto, hoy y en un año?
- ¿A dónde debería escalar una consulta que el sistema no puede resolver: correo, chat, mesa de ayuda, un ticket? ‹fuente: SGS›
- ¿Tienen mesa de ayuda formal, y con qué herramienta?
- ¿Dónde tiene que quedar registrado lo que el sistema decidió?
- ¿El repositorio documental es el único origen, o hay otras fuentes de verdad?
- ¿Tienen intranet o portal donde esto debería quedar embebido?
- ¿Qué proceso siguen hoy para registrar una aplicación e integrarla a su directorio corporativo? ‹fuente: SGS›
- ¿Quién aprueba los permisos de acceso al repositorio, y cuánto suele demorar? ‹fuente: SGS›
- ¿Quién autoriza publicar una aplicación en el catálogo de su herramienta de colaboración? ‹fuente: SGS›
- ¿Ese es el mismo rol que aprueba los permisos del repositorio, o son personas distintas? ‹fuente: SGS›
- ¿Tienen suscripción cloud propia y operativa para este tipo de cargas? ‹fuente: SGS›
- ¿Tienen cuota aprobada para servicios de IA en la región que usarían? ‹fuente: SGS›
- ¿Prefieren base de datos con extensión vectorial o un servicio de búsqueda administrado? ‹fuente: SGS›
- ¿Qué herramienta de CI/CD usan y qué exige su proceso de despliegue a producción?
- ¿Necesitan un ambiente de staging separado o alcanza con desarrollo y producción?

### 9.6 Seguridad, privacidad y datos sensibles

- ¿Qué exige su área de seguridad de la información a un proveedor antes de firmar? ‹fuente: SGS›
- ¿Tienen un cuestionario de due diligence que debamos responder?
- ¿Hay restricciones de residencia de datos para este tipo de información? ‹fuente: SGS›
- ¿Cómo está clasificada esta documentación en su esquema interno de clasificación? ‹fuente: SGS›
- ¿Toda esta documentación es de acceso general para cualquier colaborador, o hay restricciones por rol, área o país? ‹fuente: SGS›
- ¿Hay datos personales en este corpus — registros de incidentes, nóminas de capacitación, antecedentes médicos? ‹fuente: SGS›
- ¿Tienen delegado de protección de datos? ¿Qué criterio aplica para una evaluación de impacto? ‹fuente: SGS›
- ¿Su política exige claves administradas por el cliente? ‹fuente: SGS›
- ¿Exigen puntos privados de red, sin exposición pública? ‹fuente: SGS›
- ¿En qué región quieren que se despliegue? ‹fuente: SGS›
- ¿Tienen preferencia sobre el tipo de despliegue del servicio de modelo, regional o global? ‹fuente: SGS›
- ¿Cuánto tiempo deben retener el registro de consultas? ‹fuente: SGS›
- ¿Quieren que gestionemos con el proveedor la solicitud de monitoreo modificado de uso indebido? ‹fuente: SGS›
- ¿Su política permite que un subconjunto de documentos salga temporalmente para una prueba, o hay que montarla dentro de su nube? ‹fuente: SGS›
- ¿Qué acuerdo de confidencialidad necesitan firmar antes de que recibamos cualquier documento? ‹fuente: SGS›
- ¿Van a querer pruebas de penetración sobre el ambiente entregado, y con qué proveedor? ‹fuente: SGS›
- ¿Tienen políticas de MFA y acceso condicional que deban aplicarse a esta aplicación? ‹fuente: SGS›
- ¿Cuánto acceso están dispuestos a darnos, y a qué grupo de recursos exactamente? ‹fuente: SGS›

### 9.7 Gobierno de IA, políticas y supervisión humana

- ¿Tienen una política de IA vigente, en desarrollo, o todavía no está en la agenda? ‹fuente: SGS›
- ¿Quién la está escribiendo y cuándo esperan cerrarla?
- ¿Casa matriz define o ustedes definen?
- ¿Qué comité tendría que aprobar un caso de uso como este?
- ¿Hay usos de IA ya ocurriendo en la organización sin que nadie los haya autorizado?
- ¿Tienen preferencia o restricción respecto del proveedor de modelo?
- ¿Su gobernanza ya tomó la decisión de proveedor de IA, o eso todavía está abierto? ‹fuente: SGS›
- ¿Quién es el responsable dentro de la organización si el sistema entrega una respuesta equivocada?
- ¿Qué decisiones **nunca** debería tomar el sistema sin una persona en el medio?
- ¿Cómo quieren que se comporte el sistema cuando no tiene respuesta: que se abstenga y derive, o que dé lo mejor que tenga? ‹fuente: SGS›
- ¿A quién debería derivar, y en qué formato le tiene que llegar el caso? ‹fuente: SGS›
- ¿Necesitan poder auditar, meses después, por qué el sistema respondió lo que respondió?
- ¿Quién revisa periódicamente que las reglas de negocio sigan siendo las correctas?
- ¿Qué tendría que registrar el sistema para que una auditoría quede conforme?
- ¿Quién autorizaría un cambio de modelo, y qué evidencia necesitaría para aprobarlo?

### 9.8 Adopción y gestión del cambio

- ¿Qué herramienta compraron antes que hoy nadie usa, y por qué creen que pasó?
- ¿Quién en la organización se hace responsable de que esto se use?
- ¿La jefatura va a mirar un panel de avance, o eso no funciona en su cultura?
- ¿Cómo capacitan hoy, y qué tasa de finalización tienen?
- ¿Dónde publican sus contenidos internos? ¿Tienen plataforma propia? ‹fuente: SGS›
- ¿Prefieren capacitación autoguiada o sesiones en vivo?
- ¿Sus usuarios están dispuestos a hacer una ruta de una hora y rendir un examen?
- ¿Existe algún incentivo o requisito interno que empuje la adopción?
- ¿Quiénes son los que si adoptan, arrastran al resto?
- ¿Hay resistencia esperable de alguien que hoy es el dueño informal del conocimiento?
- ¿Qué expectativa tiene la organización sobre lo que esta herramienta va a hacer? ¿Está calibrada?
- ¿Alguien espera que esto además les arregle la documentación? ‹fuente: SGS›
- ¿Cuánto tiempo real puede dedicar su equipo a cuatro sesiones semanales después de la salida a producción? ‹fuente: SGS›
- ¿A quién le tenemos que demostrar, en cuatro semanas, que esto se está usando?
- ¿Qué pasa si la adopción no llega al umbral que acordemos?

### 9.9 Medición de éxito y métricas de adopción

- ¿Qué considera su equipo experto que es una **buena respuesta**? ‹fuente: SGS›
- ¿Quién de su equipo tendría la autoridad para validar el set de preguntas de evaluación? ‹fuente: SGS›
- ¿Dónde ponemos los umbrales? ‹fuente: SGS›
- ¿Están dispuestos a evaluar a ciegas, sin saber qué sistema respondió? ‹fuente: SGS›
- ¿Qué tipo de error les duele más: que se equivoque, o que no conteste? ‹fuente: SGS›
- ¿Tienen tres o cuatro preguntas reales que hoy nadie contesta bien?
- ¿Qué número, de los que hoy miden, tendría que moverse para que dentro de seis meses digan que esto valió la pena?
- ¿Cuánto demora hoy una persona en tener la información completa? ‹fuente: SGS›
- ¿Qué proporción de consultas resuelve hoy la gente sin recurrir al equipo experto? ‹fuente: SGS›
- ¿Cómo medirían hoy el impacto de una no conformidad evitada? ‹fuente: SGS›
- ¿Qué latencia de respuesta es aceptable para el tipo de consulta que hacen?
- ¿Les sirve un scorecard firmado por ambas partes como criterio formal de aceptación? ‹fuente: SGS›
- ¿Qué porcentaje de sus usuarios esperan que complete una ruta de aprendizaje? ‹fuente: SGS›
- ¿Quieren medir también las brechas documentales que el uso vaya destapando? ‹fuente: SGS›
- ¿Con qué frecuencia quieren ver el informe de uso, cobertura y brechas?

### 9.10 Operación, soporte y quién se queda a cargo

- ¿Quién va a operar esto el día 91?
- ¿Su TI tiene capacidad y ganas de tomar la operación, o prefieren que la tomemos nosotros?
- ¿Cómo manejan hoy los incidentes de una aplicación en producción?
- ¿Qué documentación de traspaso exige su TI para aceptar un sistema nuevo? ‹fuente: SGS›
- ¿Necesitan runbook de incidentes y procedimiento de reversión formalizados? ‹fuente: SGS›
- ¿Quién debería recibir las alertas de presupuesto y quién debería poder accionar el corte? ‹fuente: SGS›
- ¿Cada cuánto cambian los documentos que alimentan el sistema? ‹fuente: SGS›
- ¿Cuándo es su ciclo de auditoría, y qué pasa con la documentación en ese período?
- ¿Quién decide cuándo se reprocesa el corpus completo?
- ¿Con qué frecuencia quieren una sesión de revisión con nosotros después del go-live?
- ¿Prefieren contratar acompañamiento por tres, seis o doce meses? ‹fuente: SGS›
- ¿Tienen claro que el consumo de nube lo factura directamente su proveedor cloud a su suscripción? ‹fuente: SGS›
- ¿Quién designan como contraparte técnica y quién como contraparte funcional? ‹fuente: SGS›
- ¿Esas personas tienen disponibilidad agendada, o vamos a competir con su día a día? ‹fuente: SGS›
- ¿Quieren que sus contrapartes acompañen las sesiones de construcción desde la primera semana? ‹fuente: SGS›

### 9.11 Proceso de compra y decisores (sin montos)

- ¿Cómo se aprueba una iniciativa como esta en su organización?
- ¿Quién firma, quién recomienda y quién puede vetar?
- ¿Hay presupuesto asignado para este año o hay que crearlo?
- ¿Requiere pasar por comité? ¿Cuándo sesiona?
- ¿Necesitan comparar contra otra alternativa formalmente? ¿Qué formato les sirve?
- ¿Qué documento necesita el área de compras o abastecimiento para abrir el proceso?
- ¿Hay proceso de registro de proveedor que debamos iniciar en paralelo?
- ¿Qué requisitos de proveedor tienen que cumplirse antes de la firma? ‹fuente: SGS›
- ¿Necesitan un acuerdo de confidencialidad firmado antes de avanzar? ‹fuente: SGS›
- ¿Prefieren contratar la prueba y la implementación por separado, o en un solo instrumento?
- ¿Qué tendría que contener una propuesta para que ustedes puedan defenderla internamente?
- ¿Quién más tiene que ver esta presentación antes de que se decida?
- ¿Cuál es el plazo realista entre que decidan y que podamos partir?
- ¿Hay algún proceso interno de habilitación que tome más tiempo que la decisión misma? ‹fuente: SGS›
- ¿Qué pasa si el plazo de vigencia de una propuesta se les vence antes de decidir?

### 9.12 Cierre y próximos pasos

- ¿Les hace sentido el enfoque de probar con sus preguntas y umbrales acordados antes?
- ¿Qué les falta para poder tomar la decisión de hacer una prueba acotada?
- ¿Podemos agendar media jornada con su equipo experto para construir el set de evaluación y acordar los umbrales? ‹fuente: SGS›
- ¿Cuándo nos pueden entregar la muestra de documentos con el criterio que conversamos? ‹fuente: SGS›
- ¿Quién designan como contraparte para coordinar esto?
- ¿Qué necesitan de nosotros por escrito para el próximo paso?
- ¿Les sirve que les enviemos el anexo de seguridad para que su área lo revise en paralelo? ‹fuente: SGS›
- ¿Prefieren que la próxima reunión sea con seguridad de la información o con el área de negocio?
- ¿Cuándo se juntan ustedes internamente para revisar esto?
- ¿Qué fecha ponemos para volver a hablar?
- Si tuviéramos que partir en dos semanas, ¿qué de su lado no estaría listo? ‹fuente: SGS›
- ¿Hay algo que no les haya preguntado y que sea importante para ustedes?

**Cierre canónico de adoOps, para decir literal:**
> *"No les pedimos que decidan hoy sobre la arquitectura, el proveedor ni el presupuesto de implementación. Les pedimos que definan, junto a nosotros, qué es una buena respuesta — y después lo medimos."*

---

## 10. Temáticas que siempre hay que abordar

No cierres una reunión comercial de adoOps sin haber tocado estos doce puntos. Si falta alguno, esa es la pregunta siguiente.

1. **El costo del error.** Qué pasa cuando alguien responde o actúa con información equivocada. Sin esto no hay urgencia, y sin urgencia no hay proyecto.
2. **El framework.** Dónde se ubica lo que estamos proponiendo dentro de Understand · Design · Prove · Adopt · Scale. Nunca dejar la propuesta huérfana de mapa.
3. **Demo vs. experimento.** Umbrales acordados antes, preguntas del cliente, evaluación a ciegas, medición reproducible.
4. **Las tres salidas y las cinco reglas.** Responder / repreguntar / derivar. *"Un sistema que sólo sabe responder es un sistema que inventa."*
5. **La advertencia de vigencia** (o el equivalente en el dominio del cliente): el elemento que ataca directamente el dolor declarado.
6. **Núcleo y perímetro.** Qué construye adoOps y qué es intercambiable. Responde de una vez tres objeciones que nadie dice en voz alta.
7. **Dónde viven los datos** y bajo qué identidad se accede. Aunque no lo pregunten.
8. **Qué NO está incluido.** Consumo de nube, remediación documental, migración entre repositorios, soporte posterior. Declararlo temprano es señal de rigor y evita fricción después.
9. **Adopción como alcance, no como promesa.** Ruta de aprendizaje con examen, panel para la jefatura, sesiones sobre consultas reales, artefacto de adopción.
10. **Quién opera después del go-live**, y el compromiso explícito de que la operación diaria no dependa de adoOps.
11. **Las dependencias del cliente que condicionan el plazo**, y la cláusula *"el plazo corre desde que los pre-requisitos están cumplidos, no desde la firma"*.
12. **El próximo paso concreto**, con fecha, nombre y entregable.

**Temas que hay que abordar sólo si el cliente los abre, pero con respuesta lista:** gobierno de IA y política corporativa · Ley 21.719 y datos personales · comparación con plataformas cerradas · certificaciones de adoOps · pruebas de penetración · costo operativo de la nube (sin cifras).

---

## 11. Objeciones frecuentes y cómo responderlas

> Formato: **Objeción → Qué hay detrás → Respuesta → Evidencia.**

### 11.1 "¿Y si alucina? ¿Y si se inventa una respuesta?"

**Qué hay detrás:** miedo a que el sistema entregue con tono seguro un requisito que no existe, y que alguien actúe con eso. En dominios normativos es el miedo dominante y es legítimo.

**Respuesta:**
> *"Es la objeción correcta, y es la que ordena todo nuestro diseño. Primero, el sistema tiene tres salidas, no una: responde con cita, repregunta, o deriva. Un sistema que sólo sabe responder es un sistema que inventa. Segundo, la verificación de respaldo es un paso separado de la generación: cada afirmación tiene que estar anclada a un fragmento recuperado, y lo que no se puede anclar se elimina. Lo hacemos separado justamente para poder medirlo y auditarlo por su cuenta. Y tercero, lo medimos contra un set de preguntas que construimos con ustedes, que incluye casos armados para inducir invención, con el umbral acordado antes de correr la prueba."*

**Evidencia:** las cinco reglas de negocio implementadas como nodos auditables del grafo de decisión · verificación de respaldo como paso separado · criterio de aceptación **0 afirmaciones sin respaldo** en el set de evaluación · métrica de PoC **tasa de invención ≤2%**, declarada como *"la métrica que manda"* · **abstención correcta ≥80%** · bloque de casos límite con premisas falsas incrustadas e intentos de inducir invención · axioma *"Una respuesta inventada cuesta más que una respuesta ausente"*.

### 11.2 "El bot va a decir cualquier cosa" / "no confío en que responda bien"

**Qué hay detrás:** experiencia previa con un chatbot genérico que contestaba lo plausible. También, a veces, la sospecha de que la demo estará amañada.

**Respuesta:**
> *"Le doy dos respuestas. La primera es de comportamiento: cuando la consulta es ambigua, el sistema no responde, repregunta con opciones concretas. Un sistema que contesta lo genérico se ve bien y está equivocado, y la mayoría de las herramientas hace exactamente eso. La segunda es de método: no les proponemos una demo, les proponemos un experimento. Ustedes ponen las preguntas reales, acordamos los umbrales antes, y la evaluación es a ciegas, sin saber qué sistema respondió. Cualquiera puede repetir la medición."*

**Evidencia:** pantalla de consulta ambigua descrita como *"la pantalla más importante de la propuesta"* · opciones clicables en vez de texto libre · semáforo de confianza siempre visible (*"mostrar la incertidumbre es lo que hace confiable la certeza"*) · panel de evidencia persistente · tabla Demo vs. Experimento · citación con documento, sección y versión, navegable.

### 11.3 "¿Dónde vive nuestra información? ¿Sale de la empresa?"

**Qué hay detrás:** revisión de seguridad, exposición regulatoria y, muchas veces, una mala experiencia con una herramienta SaaS que se llevó datos afuera.

**Respuesta:**
> *"En el producto final, nada sale de su suscripción ni de su tenant. El índice, el modelo, el cómputo, los secretos y los registros viven en su nube. La documentación se lee en modalidad solo lectura y no mantenemos una segunda copia completa de su repositorio: guardamos los fragmentos y metadatos necesarios para poder responderles con cita. La única excepción es la prueba inicial, si deciden hacerla sobre nuestra infraestructura para no depender de su proceso de habilitación: esa etapa está acotada en el tiempo, tiene seis controles descritos por escrito y termina con eliminación verificable y constancia. Y si su política no permite ni eso, la montamos sobre un subconjunto no sensible o documentación anonimizada."*

**Evidencia:** anexo de seguridad de diez secciones dirigido al área de seguridad · principio rector de despliegue íntegro dentro del ecosistema del cliente · minimización sin segunda copia del repositorio · seis controles de la prueba inicial con eliminación verificable y constancia escrita · plan B con subconjunto no sensible o anonimizado · perímetro zero trust de cinco capas para el piloto.

### 11.4 "¿Cuánto nos va a costar operar esto? Los modelos son caros"

**Qué hay detrás:** miedo a un costo variable descontrolado, y a un proyecto que se paga dos veces.

**Respuesta (sin dar cifras):**
> *"Se lo enfrento de frente porque es la exclusión de mayor impacto y no queremos sorpresas: el consumo de nube no está incluido en el valor del proyecto, lo factura directamente su proveedor cloud a su suscripción y nosotros no lo intermediamos. Ahora, la estructura importa: la mayor parte del costo mensual es infraestructura encendida por hora — la base de datos del índice y los contenedores — que se factura con independencia del uso. El consumo del modelo es la fracción minoritaria. Por eso el costo varía poco si usan menos, y crece de forma acotada si usan mucho más, incluso en un período de auditoría. Y les dejamos configurada desde el día uno la alerta de presupuesto y un mecanismo de corte que opera su TI. La estimación calibrada se la entregamos en la primera semana, con el consumo real de la prueba."*

**Evidencia:** exclusión declarada por escrito · entregable de estimación mensual referencial en la semana 1 · composición del costo con la infraestructura como componente fijo · presupuesto configurable con alerta al umbral, verificación previa a cada consulta e interruptor de corte operable por TI del cliente · escalamiento por volumen de consultas, no por usuarios.

### 11.5 "¿No quedamos amarrados a un proveedor de IA?"

**Qué hay detrás:** decisión de gobernanza todavía abierta, o política corporativa en desarrollo. A veces también una preferencia corporativa por otro proveedor.

**Respuesta:**
> *"El modelo de lenguaje es un conector, no una etapa del flujo. La arquitectura está diseñada con una capa de abstracción de proveedor: el motor se elige, no se hereda. Y eso importa justamente mientras su política de IA todavía se está definiendo — no los amarra a una decisión que su gobernanza aún no ha tomado. Le digo también dónde está el límite honesto: en un alcance como este entregamos la interfaz definida con un proveedor implementado. La capa multi-proveedor probada, con dos motores corriendo en paralelo, es un alcance adicional y así se declara."*

**Evidencia:** arquitectura núcleo/perímetro con los modelos en el perímetro intercambiable · decisión técnica documentada de capa de abstracción de proveedor · declaración textual *"en este alcance se entrega la interfaz definida con un proveedor implementado"* · la capa multi-proveedor probada aparece explícitamente en la lista de exclusiones. ⚠️ Ver §15.1: **no digas que ya está construida.**

### 11.6 "Esto lo puede hacer ChatGPT" / "estamos evaluando Copilot"

**Qué hay detrás:** el cliente no ve todavía la diferencia entre un modelo con acceso a documentos y un agente con reglas. A veces hay una evaluación interna en curso.

**Respuesta (tono neutral y deportivo, nunca atacar):**
> *"Perfecto, y no venimos a decirles que esa alternativa es mala. Venimos a proponerles la vara que hace justa la comparación: el mismo corpus, las mismas preguntas construidas con ustedes, los mismos umbrales acordados antes, y evaluación a ciegas. Escenario A, la plataforma: configuración base sobre el mismo corpus, escala por usuarios y mensajes, y las capas internas no se ajustan. Escenario B, arquitectura propia: mismo corpus, mismas preguntas, escala por volumen de consultas y cada capa se corrige contra el set de evaluación. La diferencia no es de resultado, es de techo: cuando una arquitectura propia falla una pregunta, se corrige la capa que falló; cuando falla una plataforma cerrada, se reescribe la instrucción y se espera."*

Complemento cuando la objeción es específicamente "ChatGPT":
> *"La diferencia no es el modelo. Es que aquí hay reglas: no responde sin fuente, pregunta si hay ambigüedad, deriva si no hay respaldo, avisa si el documento está superado y siempre cita documento, sección y versión. Eso no lo trae ninguna plataforma de fábrica: se diseña con ustedes."*

**Evidencia:** lámina de los dos escenarios medidos con la misma vara · las cuatro capas ajustables con mapeo a los tipos de pregunta que resuelve cada una · *"los tipos 4 y 5 —tablas y vigencia— son los que separan una arquitectura ajustable de una plataforma cerrada"* · nota de orador: *"Quien propone la vara honesta gana credibilidad."*

### 11.7 "La adopción interna va a ser baja / ya compramos algo así y nadie lo usó"

**Qué hay detrás:** cicatriz real. Es la objeción más honesta que puede hacer un cliente y hay que tratarla con respeto, no con optimismo.

**Respuesta:**
> *"Le creo, y por eso la adopción está dentro del alcance y no en el 'después'. Concretamente: una ruta de aprendizaje autoguiada corta, publicada en el ecosistema que ustedes ya usan, con examen de comprobación que incluye preguntas de aplicación sobre respuestas reales del sistema; un panel de avance visible para la jefatura desde el día de la entrega; y cuatro sesiones semanales después del go-live sobre las consultas reales de esa semana, cada una cerrando con ajustes aplicados al sistema. En la semana siguiente a la salida construimos un kit de adopción a medida, con la biblioteca de consultas por rol armada con el uso real. Y la adopción es criterio de aceptación medido, no una aspiración."*

**Evidencia:** cinco módulos de ruta autoguiada · examen con corrección automática, aprobación con 80%, hasta dos intentos · umbral de adopción **≥85% de los inscritos completa y aprueba** como criterio de aceptación · panel de avance para la jefatura · cuatro sesiones consultivas con foco definido · artefacto de adopción a medida · el canal de chat corporativo como *"el canal que favorece la adopción"* porque la gente ya trabaja ahí.

### 11.8 "Nuestra documentación es un desastre, esto no va a funcionar"

**Qué hay detrás:** vergüenza y miedo a que el proyecto exponga el problema. También, a veces, la esperanza secreta de que el proyecto lo arregle.

**Respuesta:**
> *"Dos cosas, y las digo en este orden. La primera: lo vamos a descubrir temprano y a propósito. La prueba inicial existe justamente para ver el estado real del corpus antes de comprometer umbrales, y su informe llega con margen para ajustar. La segunda, y quiero ser explícito: la remediación documental no está en el alcance. Los duplicados, las versiones en conflicto, los escaneados sin capa de texto y los vencidos se reportan, no se corrigen — corregirlos es una decisión del área dueña de la documentación. Dicho eso: en la experiencia, ese reporte termina siendo uno de los aportes más valiosos del proyecto, porque les llega una lista priorizada de los vacíos de su propia documentación, construida con las consultas reales de su gente."*

**Evidencia:** primera entrega operativa cuyo propósito declarado incluye *"cuál es el estado real del corpus"* · exclusión escrita de remediación documental · triaje por tipo de documento · brechas documentales priorizadas como entregable del panel · posicionamiento de los hallazgos documentales como *"uno de los aportes más relevantes del proyecto para el área dueña de la documentación"* · el primer módulo de la ruta de aprendizaje diseñado específicamente para fijar esa expectativa.

### 11.9 "¿Quién lo mantiene después? No tenemos equipo para esto"

**Qué hay detrás:** miedo a quedar con un sistema huérfano, o a quedar atrapados con el proveedor.

**Respuesta:**
> *"Nuestro objetivo explícito es que la operación del día a día no dependa de nosotros. Por eso el traspaso a su TI incluye manual de operación, runbook de incidentes y procedimiento de reversión, y sus contrapartes participan desde la primera semana para que conozcan la solución mientras se construye, no sólo al momento del traspaso. Ahora, si además quieren que la operemos con ustedes, existe una capa mensual: monitoreo y atención de incidentes, supervisión de la reingesta y del estado del corpus, ajuste de reglas y umbrales con las consultas reales, actualización de modelos con revalidación del scorecard, informe mensual y una sesión mensual de revisión. Se contrata por tres, seis o doce meses; recomendamos doce porque cubre el ciclo anual de auditoría y el reproceso completo del corpus, que es cuando el asistente más se exige."*

**Evidencia:** entregables de manual de operación, runbook de incidentes y reversión · transferencia de conocimiento desde la semana 1 · alcance de la bolsa mensual · tramos de 3, 6 y 12 meses con racional por tramo · garantía de defectos durante el acompañamiento incluido.

### 11.10 "¿Qué pasa si cambia el modelo? ¿Se rompe todo?"

**Qué hay detrás:** experiencia de sistemas que se degradaron solos cuando el proveedor cambió algo, y miedo a un mantenimiento invisible.

**Respuesta:**
> *"Dos capas de respuesta. La primera es de arquitectura: la lógica de decisión, las reglas y la verificación son nuestras y viven fuera del modelo; el modelo es un conector. Sustituirlo o actualizarlo no implica rehacer la solución. La segunda es de operación, y es la importante: cuando se actualiza el modelo, se revalida el scorecard. Es decir, se vuelve a correr el mismo set de preguntas contra los mismos umbrales y se compara. El modelo no se cambia a ciegas nunca. Eso forma parte del servicio mensual."*

**Evidencia:** núcleo/perímetro con el modelo en el perímetro · decisión técnica de capa de abstracción de proveedor · *"actualización de modelos y revalidación del scorecard"* como ítem explícito de la bolsa mensual · el set de evaluación como instrumento reproducible.

### 11.11 "¿Ustedes qué certificaciones tienen?"

**Qué hay detrás:** proceso formal de due diligence de proveedores.

**Respuesta (honestidad frontal, funciona mejor que la evasiva):**
> *"Se lo digo derecho: adoOps no aporta certificaciones propias en este alcance y no las declaramos. La solución se apoya en el programa de cumplimiento de la plataforma cloud —ISO 27001, 27017, 27018 y los informes SOC— y ustedes pueden verificar el alcance vigente de cada servicio en el portal de confianza del proveedor. Lo que sí les entregamos es un anexo de seguridad con el detalle de los controles que nos comprometemos a implementar, con un resumen por dominio que pueden contrastar contra su propio marco de control. Y los requisitos que ustedes exijan a un proveedor los abordamos antes de la firma, no durante el proyecto."*

**Evidencia:** declaración textual de no aportar certificaciones propias · certificaciones y reportes de la plataforma verificables por el cliente · anexo de seguridad con resumen de controles por dominio · descargo explícito de que el anexo no constituye certificación ni auditoría.

### 11.12 "¿Qué daño puede causar si se equivoca?"

**Respuesta:**
> *"El asistente entrega texto y referencias. No ejecuta acciones sobre sus sistemas, no escribe en el repositorio, no envía correos y no tiene integraciones de escritura. Su capacidad de causar daño está limitada por diseño a entregar una respuesta incorrecta — y ese riesgo se controla con las cinco reglas, la verificación de respaldo y la advertencia de vigencia."*

**Evidencia:** sección de superficie de acción del anexo de seguridad · ausencia de superficie de escritura como control declarado por dominio.

### 11.13 "¿Y si alguien mete instrucciones maliciosas en un documento?"

**Respuesta:**
> *"Es un riesgo real en un corpus que muchas personas pueden editar, y lo tratamos explícitamente. Primero, separación de planos: las instrucciones del sistema y el contenido recuperado se mantienen separados, y el contenido de los documentos se trata como dato de referencia, nunca como instrucción ejecutable. Segundo, la verificación posterior a la generación descarta lo que no se puede asociar a un fragmento recuperado, lo que limita el efecto de una instrucción insertada. Y tercero, el set de evaluación incluye casos construidos para inducir respuestas sin fundamento; el resultado se mide y se firma."*

### 11.14 "La PoC va a funcionar y producción va a ser otra cosa"

**Respuesta:**
> *"No son dos sistemas distintos: es el mismo cambiando de suscripción. El paso a producción es un despliegue, no una reconstrucción."*
Complemento: en un proyecto de implementación, la prueba **corre en paralelo** al desarrollo y sus resultados llegan cuando el motor todavía admite ajustes, no cuando ya está cerrado.

### 11.15 "Nuestros permisos de repositorio son un lío"

**Respuesta:**
> *"Si la documentación es de acceso general, esa es la mejor noticia posible: elimina el mayor costo oculto de este tipo de proyectos, porque no hay permisos que replicar dentro del índice. Si hay documentos restringidos, se lo digo ahora y no después: filtrar la recuperación según los permisos efectivos de quien consulta afecta el diseño del índice y es una modificación de alcance, no un ajuste de configuración."*

### 11.16 "¿Y si el asistente advierte vigencia todo el tiempo?"

**Respuesta:**
> *"Lo previmos: las falsas alarmas se contabilizan como fallo. Un asistente que advirtiera un posible problema de vigencia en todas sus respuestas cumpliría formalmente el criterio y deterioraría la confianza del usuario en poco tiempo. Por eso se mide como error."*

---

## 12. Señales de alerta — cuándo NO seguir o cuándo acotar

### 12.1 Señales de que hay que acotar el alcance antes de avanzar

- **El corpus tiene documentos restringidos por rol o por área.** Filtrar la recuperación por permisos efectivos cambia el diseño del índice: es modificación de alcance. Acota el piloto al subconjunto de acceso general.
- **No existe metadata de versión y vigencia poblada.** Sin metadatos, la advertencia de documento superado no se sostiene en datos y no se puede comprometer al 100%. Levántalo antes de prometerlo.
- **Corpus mayoritariamente escaneado sin capa de texto.** Es un problema de origen, no de recuperación. Acota a lo que sí es procesable y repórtalo.
- **El conocimiento crítico no está escrito.** Si el criterio experto vive en la cabeza de dos personas y no en documentos, no hay corpus que indexar. La conversación correcta es otra.
- **El cliente quiere que el sistema escriba o ejecute acciones.** La arquitectura documentada no tiene superficie de escritura. Es un alcance distinto y hay que decirlo.
- **El cliente pide un canal que no está en el material** (por ejemplo mensajería externa). Ver §15.4: no lo prometas.

### 12.2 Señales de que el proyecto va a fallar por el lado del cliente

- **No hay contraparte con nombre y disponibilidad agendada.** Es un riesgo de impacto alto declarado: *"el calendario no contempla ausencias prolongadas"*.
- **La habilitación de la nube y la cuota del servicio de modelo no tienen dueño ni fecha.** Es *"la única condición del proyecto que adoOps no controla"*.
- **Nadie sabe quién aprueba los permisos del repositorio**, o el trámite histórico toma meses.
- **Nadie identificado como administrador del catálogo de la herramienta de colaboración.** Es la dependencia más olvidada.
- **El cliente no está dispuesto a validar un set de preguntas de evaluación.** Sin eso no hay criterio de aceptación y el proyecto se acepta por impresión.
- **El cliente no puede facilitar documentos ni preguntas reales** para la prueba.
- **No hay dueño de la documentación con autoridad para decidir qué versión queda.**

### 12.3 Señales de expectativa desalineada — corregir en la misma reunión

- **Esperan que el proyecto corrija su documentación.** No lo hace. Se reporta, no se remedia.
- **Esperan que el asistente reemplace al equipo experto.** No lo hace: le deriva casos ordenados y le da visibilidad. Reencuadra hacia el panel del área dueña.
- **Esperan cero errores.** El compromiso es cero **afirmaciones sin respaldo** en el set de evaluación, más umbrales de cobertura y precisión de cita. No es lo mismo y hay que decirlo.
- **Esperan que el consumo de nube esté incluido.** No lo está y es la exclusión de mayor impacto.
- **Esperan soporte indefinido incluido.** El acompañamiento incluido es acotado; el mantenimiento posterior se contrata aparte.
- **Esperan que la agnosticidad de modelo sea una capa ya probada con dos motores.** Ver §15.1.

### 12.4 Señales de que conviene NO seguir

- El cliente busca una demo para justificar una decisión ya tomada a favor de otra alternativa, y no acepta medir con la misma vara.
- El cliente no acepta acordar umbrales antes de la prueba. Sin eso el criterio se mueve cuando aparecen los resultados, y no hay forma de ganar.
- El cliente exige certificaciones propias del proveedor como requisito eliminatorio. Se aborda **antes** de la firma; si es eliminatorio, mejor saberlo el primer día.
- No hay dolor con costo. Si nadie puede nombrar qué pasa cuando se responde con el documento equivocado, no hay proyecto: hay curiosidad.
- El comprador quiere una fábrica de software o cuerpos por hora. Ese no es el negocio de adoOps: ver §14 y reencuadrar o derivar.
- El plazo exigido no permite ni levantamiento técnico ni evaluación. Un proyecto sin evaluación medida contradice el método completo.

### 12.5 Banderas rojas técnicas que el agente debe levantar en vivo

- **Corpus pequeño con expectativa de RAG completo.** Con corpus muy chicos (del orden de menos de doscientos fragmentos) el índice vectorial puede degradar el recall más de lo que aporta. Está documentado como consideración: no lo repliques por analogía en cualquier dirección.
- **Tablas y matrices como contenido crítico.** Riesgo alto de extracción defectuosa: exige validación manual sobre muestra en la primera semana.
- **Formularios sin contenido normativo mezclados en el repositorio.** Contaminan el índice de respuesta: exigen triaje por tipo de documento.
- **Índice mal calibrado.** *"Degrada el sistema sin generar señales visibles."* Los parámetros se miden sobre el corpus real, no se asumen.
- **Corpus que se actualiza sin reingesta automática.** Produce el peor error posible: respuestas correctas respecto de contenido desactualizado.

---

## 13. Glosario

### 13.1 Marca y método

- **adoOps** — la marca. Firma: *Adoptamos IA · Operamos IA · Escalamos IA*. Sitio: adoops.digital
- **Solution Adoption Framework™** (o *Solución de Adopción Framework™*) — método propietario de cinco movimientos: Understand · Design · Prove · Adopt · Scale
- **Diagnóstico → PoC → Adopción → Escala** — versión corta del framework
- **Validation Sprint** — nombre comercial del PoC acotado que se ofrece en la etapa Prove
- **Decisión del Sprint** — la salida de Prove: Construir · Integrar · Automatizar · Descartar
- **adoOps AI Operating System** — marco de gobierno, operación y mejora de IA (Governance · Superagency · Intelligence & Improvement)
- **Superagency** — pilar operacional del sistema: *"Operamos la IA de forma segura"*
- **Guardrails transversales** — Valor · Riesgo · Datos · IA · Seguridad · Personas
- **Niveles de gobernanza** — Dirección → Gobernanza → Control → Delivery → Adopción
- **Ciclo de mejora continua** — Monitorear → Evaluar → Aprender → Adaptar → Escalar
- **Núcleo / perímetro** — el núcleo es propio de adoOps (reglas, orquestación, verificación); el perímetro (canales, fuentes, modelos, destinos) es intercambiable
- **Insumos conectables** — el modelo y la documentación no son etapas del flujo, son conectores
- **Primera entrega operativa** — nombre comercial de la PoC embebida dentro de un proyecto de implementación y ejecutada en paralelo al desarrollo
- **Artefacto de adopción** — kit personalizado (guía de uso, biblioteca de consultas por rol, tablero de seguimiento) construido con las consultas reales
- **Scorecard** — instrumento de aceptación firmado por ambas partes con el resultado medido contra los umbrales
- **b-learning** — ruta de aprendizaje autoguiada con video corto, guía descargable, práctica sobre el sistema real y examen
- **Bolsa mensual** — modelo de contratación del mantenimiento evolutivo, con alcance acotado al mes y tramos de 3, 6 y 12 meses

### 13.2 De la solución

- **SGI** — Sistema de Gestión Integrado (nomenclatura del caso SGS)
- **Las cinco reglas de negocio** — no responde sin fuente · pregunta si es ambigua · deriva si no hay respaldo · advierte si está superado · cita documento, sección y versión
- **Las tres salidas** — A responde con referencia / B solicita precisión (repregunta) / C deriva
- **Advertencia de vigencia / documento superado** — el diferencial declarado como *"el elemento clave"*
- **Derivación** — escalamiento al equipo responsable con el caso estructurado; es una respuesta válida del sistema, no un error
- **Semáforo de confianza** — indicador de incertidumbre siempre visible en la respuesta
- **Panel de evidencia / panel de fuentes** — listado persistente de las fuentes consultadas
- **La cita es un objeto, no un enlace** — código de documento, sección, versión y estado de vigencia
- **Panel del área dueña** — tablero con volumen real, KPIs de resolución y brechas documentales
- **Brecha documental** — pregunta recurrente sin respaldo en el corpus; insumo de la agenda de trabajo del área dueña

### 13.3 Técnica

- **RAG híbrido** — recuperación densa (semántica, por embeddings) + léxica (término exacto, tsvector/BM25), fusionadas
- **Reranking (cross-encoder)** — reordenamiento y reducción de candidatos (30 → 8, o 30 → 6–8)
- **Chunking consciente de estructura / fragmentación jerárquica** — cortar conservando documento → sección → subsección, con solapamiento y **sin partir tablas**
- **Groundedness / verificación de respaldo** — validar afirmación por afirmación que hay anclaje en un fragmento recuperado; lo no anclable se elimina o se marca
- **pgvector** — extensión vectorial de PostgreSQL
- **HNSW** — índice de grafo jerárquico navegable; estable frente al crecimiento del corpus
- **ivfflat** — índice vectorial por listas invertidas; descartado por exigir calibración según volumen y perder precisión sin señales visibles
- **tsvector** — índice de texto completo de PostgreSQL, para la recuperación léxica
- **Embeddings de 1.536 dimensiones** (`text-embedding-3-small`) — *"1.536 coordenadas de significado"*
- **LangGraph StateGraph** — orquestación por grafo de decisión (`classify → retrieve → generate`)
- **Grafo de decisión** — cada regla es un nodo auditable, independiente del modelo
- **Microsoft Graph** — API de acceso a SharePoint Online
- **Delta query** — mecanismo de detección incremental de cambios, base de la reingesta
- **`Sites.Selected` vs. `Sites.Read.All`** — permiso acotado sitio por sitio vs. lectura total del repositorio
- **Entra ID / SSO / grupos de seguridad / acceso condicional / MFA** — identidad corporativa heredada
- **Azure Container Apps · Static Web Apps · Bot Service · Key Vault · Application Insights · Log Analytics · Azure Monitor** — componentes del despliegue
- **Tarjetas adaptables (Adaptive Cards)** — formato de respuesta en el canal de chat corporativo
- **Kill switch / interruptor de corte** — mecanismo de corte del consumo operable por TI del cliente
- **Runbook** — procedimiento documentado de incidentes y reversión traspasado a TI
- **Registro append-only** — registro de auditoría de sólo adición, sin método de borrado
- **Triaje por tipo de documento** — exclusión del índice de respuesta de formularios sin contenido normativo o de documentos con datos personales
- **Prompt injection / separación de planos** — el contenido recuperado se trata como dato, nunca como instrucción ejecutable
- **Monitoreo modificado de uso indebido** — programa de acceso limitado que elimina almacenamiento y revisión humana del contenido señalado
- **CMK (claves administradas por el cliente) / puntos privados (private endpoints)** — controles opcionales de cifrado y red que condicionan el aprovisionamiento
- **Zero trust / lista blanca / OTP (código de un solo uso)** — perímetro de acceso del piloto
- **p95** — percentil 95 de latencia; forma en que se compromete el criterio de tiempo de respuesta
- **Ley 21.719** — ley chilena de protección de datos personales, en plena vigencia desde el 1 de diciembre de 2026. Roles: **responsable** (el cliente) y **encargado** (adoOps durante la ejecución)

---

## 14. adoOps vs. Soho — cómo diferenciarlas en una conversación

> ⚠️ **Advertencia de uso.** El corpus **no contiene ningún documento que declare la relación societaria entre ambas marcas** ni una comparación oficial. Lo que sigue son diferencias de **posicionamiento de marca observables en el material**, no afirmaciones sobre estructura corporativa. En vivo: **habla de posicionamiento y de tipo de trabajo, nunca de propiedad, holding ni relación entre empresas.** Si el cliente pregunta por la relación entre ambas, la respuesta correcta es remitir a Joaquín, no improvisar.

### 14.1 Tabla de diferenciación

| Dimensión | **adoOps** | **Soho** |
|---|---|---|
| **Promesa central** | *"Adoptamos IA · Operamos IA · Escalamos IA"* — convertir la IA en **capacidad real de negocio adoptada y medida** | Capacidad de **ingeniería y diseño** a escala regional, con tres décadas construyendo canales digitales transaccionales |
| **Unidad de venta** | **Un método** (Solution Adoption Framework™) aplicado a un caso de uso concreto | **Modelos de contratación**: staffing / talento, fábrica de software, consultoría y grandes proyectos |
| **Qué dice que NO hace** | *"No desarrollamos un CRM"*, *"no es una fábrica"* — se define **por oposición a la fábrica** | Es, entre otras cosas, **una fábrica de software**: ciclo completo de construcción |
| **Prueba social** | El **rigor del método** y la evidencia medida | La **escala**: años, países, delivery centers, profesionales, clientes, proyectos, verticales y logos |
| **Rol de la IA** | La IA **es el producto**: agentes de negocio, gobierno de IA, adopción de IA en el cliente | La IA es **aceleración del propio delivery**: ingeniería aumentada, agentes dentro del ciclo de desarrollo |
| **Foco del agente** | **Agente de dominio de negocio** para el usuario final del cliente | **Agentes de ingeniería** dentro del ciclo de desarrollo de software |
| **Métrica que vende** | Métricas de **confianza y adopción**: tasa de invención, trazabilidad, abstención correcta, porcentaje que completa la ruta | Métricas de **productividad y calidad de entrega**: velocidad, defectos, deuda técnica, modernización |
| **Entrada comercial** | **PoC / Validation Sprint acotado**, como llave para escalar por evidencia | **Diagnósticos y productos de entrada rápida**, retainers y suscripciones |
| **Vocabulario** | Adopción, gobierno, guardrails, evidencia, reglas de negocio, cumplimiento, trazabilidad | Talento, verticales, delivery, células, design system, DevOps, staffing, ciclo de desarrollo |
| **Interlocutor natural** | Dueño de proceso de negocio, cumplimiento y calidad, seguridad de la información, comité o directorio | Gerencia de tecnología, arquitectura, jefaturas de desarrollo y diseño |
| **Postura frente al stack** | **Agnóstica y desacoplada por diseño** (*"el motor se elige, no se hereda"*), fuerte en el ecosistema del cliente | Agnóstica al stack y fuerte en el ecosistema que el cliente ya opera |
| **Tono** | Sobrio, normativo, casi jurídico; aforismos de contraste; honestidad sobre límites | Comercial y enérgico; promesa de velocidad y talento |

### 14.2 Cómo decidir en vivo de qué marca hablar

| Si el cliente dice… | Es conversación de… |
|---|---|
| "necesitamos que esto se adopte", "gobierno de IA", "¿cómo sabemos que funciona bien?" | **adoOps** |
| "necesitamos un agente que responda sobre nuestra documentación / nuestro proceso" | **adoOps** |
| "tenemos que probar antes de comprometer presupuesto" | **adoOps** |
| "necesitamos desarrolladores", "necesitamos un equipo", "necesitamos capacidad" | **Soho** |
| "hay que construir la plataforma completa", "tenemos un backlog grande" | **Soho** |
| "queremos acelerar nuestro propio desarrollo con IA" | **Soho** |
| "necesitamos rediseñar la experiencia / el design system" | **Soho** |

**Síntesis para tener en la cabeza:** adoOps ocupa la conversación de *"¿esto sirve, y va a ser usado?"*; Soho ocupa la de *"¿quién lo construye y con qué capacidad sostenida?"*. Son complementarias más que competidoras.

### 14.3 Qué NO decir

- No afirmes relación societaria, propiedad, filial, matriz ni fusión entre ambas marcas.
- No presentes casos, cifras de escala, clientes ni logos de Soho como respaldo de adoOps.
- No uses la prueba social de escala de Soho para responder "¿ustedes qué tamaño tienen?" desde adoOps. Si preguntan por tamaño, la respuesta adoOps es de **método y equipo del proyecto**: responsable de proyecto único, roles definidos por el compromiso que asumen ante el cliente y contrapartes del cliente integradas desde la primera semana.
- No mezcles vocabularios en la misma frase. Si cambias de marca, cambia de marco explícitamente.

---

## 15. Divergencias y advertencias — qué NO afirmar en vivo

### 15.1 La agnosticidad de modelo es promesa de diseño, no capa probada

**Qué dice el material de cliente:** *"La independencia del proveedor es un compromiso de esta propuesta y se refleja en la estructura del código. En este alcance se entrega la interfaz definida con un proveedor implementado."* Y la **capa multi-proveedor probada aparece explícitamente en la lista de exclusiones**.

**Qué NO decir:** que ya existe una capa multi-proveedor funcionando, que se puede cambiar de modelo "apretando un botón", o que hay dos motores corriendo en paralelo hoy.

**Qué sí decir:** *"La arquitectura está diseñada para que el modelo sea un conector, y en este alcance entregamos la interfaz definida con un proveedor implementado. Tener la capa multi-proveedor probada con dos motores es un alcance adicional y así se declara."*

### 15.2 No mezclar los umbrales de la PoC con los del proyecto de implementación

Coexisten **dos conjuntos de métricas distintos** para el mismo cliente. Confundirlos en vivo es el error más fácil y el más caro.

| | **PoC / Validation Sprint** | **Proyecto de implementación** |
|---|---|---|
| Duración | 4 semanas | 9 semanas, go-live en la 6 |
| Usuarios | 10 del piloto | hasta 100 habilitados |
| Dónde vive | Infraestructura de adoOps, fuera del tenant del cliente | 100% en la suscripción y tenant del cliente |
| Identidad | Lista blanca de correos + código de un solo uso | SSO con el directorio corporativo |
| Canales | Sólo portal web | Portal web + chat corporativo |
| Taxonomía del set | Seis niveles de dificultad creciente | Cinco bloques temáticos |
| Métricas | Exactitud factual ≥85% · Trazabilidad ≥90% · Tasa de invención ≤2% · Abstención correcta ≥80% | Cobertura ≥90% · Precisión de cita ≥95% · Vigencia 100% · Afirmaciones sin respaldo 0 · Latencia p95 ≤8s · Adopción ≥85% |

**Regla:** pregunta primero de qué etapa se está hablando y recién después cita umbrales.

### 15.3 "AgentOps" no está definido en el material

Ver §3.1. No expliques AgentOps como marco documentado. Usa el **adoOps AI Operating System** y la capa de operación y mejora continua, que sí están respaldados.

### 15.4 Canales no documentados — WhatsApp y mensajería externa

Los canales que el material declara son: **portal web, Microsoft Teams, SharePoint, móvil y API**. **WhatsApp no aparece en ninguna fuente adoOps.** No lo ofrezcas como canal disponible, probado ni cotizado.

Si el cliente lo pide, la respuesta segura es:
> *"Los canales que tenemos entregados y probados son portal web y el chat corporativo, sobre la misma API y las mismas reglas. La arquitectura contempla móvil y API como perímetro ampliable. Un canal de mensajería externa lo evaluamos y lo dimensionamos aparte; no se lo voy a prometer aquí sin haberlo revisado."*

### 15.5 Discrepancia de plazo en el corpus

El material interno de agosto describe el proyecto de implementación con un plazo mayor y otro hito de go-live. **Toda la documentación de cliente compromete nueve semanas con go-live en la semana 6**, y es posterior. **Prevalece la documentación de cliente.** Nunca cites el plazo del material interno.

### 15.6 El set de preguntas de evaluación no está construido

El set de 40 preguntas es el instrumento que sostiene **todos** los criterios de aceptación y, en el material, **nunca llegó a construirse**. Consecuencias operativas:
- No digas que "ya tenemos el set". Se construye **con el cliente**, en sesión conjunta.
- Véndelo como valor: *"la sesión de definición del set vale por sí sola: obliga a explicitar qué considera su equipo una buena respuesta, y es trabajo que hoy no está hecho"*.
- No salgas de la reunión sin fecha para esa sesión.

### 15.7 Material interno que nunca sale al cliente

El corpus incluye un documento de handoff interno con: estrategia frente a la evaluación de plataforma que el cliente hacía por su cuenta, un brief anonimizado enviado a un tercero, banderas de riesgo comercial, una credencial filtrada detectada en otro proyecto, discrepancias de plazo y notas sobre el estilo de trabajo del propio equipo.

**Nada de eso se menciona en una reunión con cliente.** Si el agente detecta que la conversación se acerca a alguno de esos temas, la instrucción es cambiar de tema hacia el método o hacia una pregunta de levantamiento.

### 15.8 Antecedente técnico que no se debe generalizar

Existe un antecedente interno donde se **eliminó deliberadamente el índice vectorial** porque con un corpus muy pequeño degradaba el recall a cero. Esa decisión fue correcta **ahí** y sería catastrófica en un corpus de cientos de documentos. El material de cliente lo traduce como consideración documentada: *"En sistemas con corpus muy pequeños, del orden de menos de doscientos fragmentos, puede justificarse operar sin índice vectorial… Ese criterio no aplica en este proyecto."* No lo cites como caso, cítalo como criterio.

### 15.9 Reglas duras de conversación para el agente

1. **Cifras comerciales: nunca.** Ni precio, ni valor hora, ni esfuerzo, ni costo mensual de nube, ni rango. Fórmula fija: *"Eso lo dimensionamos y se lo entregamos por escrito; hoy definamos el alcance, porque la cifra sale del alcance."*
2. **Umbrales técnicos: sí, pero con etapa.** Verifica primero si se habla de PoC o de proyecto.
3. **Certificaciones propias: no existen y se declara así.**
4. **Multi-proveedor probado: no afirmarlo.**
5. **WhatsApp u otros canales no documentados: no prometerlos.**
6. **Remediación documental: no está incluida, en ningún escenario.**
7. **Filtrado de recuperación por permisos de usuario: es modificación de alcance, no configuración.**
8. **SLA con tiempos de respuesta por severidad: no inventar.** Lo comprometido es notificación de incidentes de seguridad dentro de 24 horas y el runbook con ruta de escalamiento.
9. **Relación entre adoOps y Soho: no describirla.** Remitir a Joaquín.
10. **Si algo no está en esta base, no está en las fuentes.** No lo digas en la reunión.
