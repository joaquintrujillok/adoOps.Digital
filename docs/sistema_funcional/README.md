# Sistema Tuniche — `/tuniche`

Sistema de visitas a campo de **Semillas Tuniche**. Un zonal manda un audio de
WhatsApp desde la camioneta, el audio se convierte en un informe estructurado, y
ese informe queda en el historial del agricultor y se le puede enviar.

Reemplaza lo que hoy es una conversación de WhatsApp que nadie puede consultar
seis meses después. Francisco lo dijo con estas palabras en la reunión: la única
forma que tiene hoy de saber en qué quedó con un agricultor es leer el hilo de
WhatsApp que tuvo con él.

> **Estado: `produccion`.** Se firmó como prueba de concepto y aun así entra como
> producción, porque la pregunta que decide el estado es "¿puede haber adentro
> datos de una persona real?" y la respuesta es sí desde el primer día. Ver
> [`lib/modulos.ts`](../../lib/modulos.ts) y [`docs/modulos.md`](../modulos.md).

---

## Por qué hay áreas

MN y Altué **no llenan la misma planilla**, y eso no es un detalle de formato:
son cultivos distintos, clientes distintos y momentos distintos. Ellos mismos
pusieron el límite en la reunión — "puede ser que Altué necesite 6 campos más y
MN otros 6, que no 100".

Un área es, entonces, **un conjunto de gente que llena la misma sábana**. Decide
dos cosas y solo dos: qué filas ve una persona y qué plantilla llena. Todo lo
demás —audio, historial, envío al agricultor— es idéntico, y por eso esto es un
sistema y no dos. El registro está en [`lib/tuniche/areas.ts`](../../lib/tuniche/areas.ts).

| Área | `id` | Qué produce | Cómo mide el tiempo |
|---|---|---|---|
| Mercado Nacional | `mn` | Maíz de grano y silo vendido a agricultores chilenos vía distribuidores | Etapa **fenológica** |
| Producción Altué | `altue` | Semilla hortícola híbrida bajo contrato para clientes en el extranjero | **Momento** del cultivo |

---

## Roles

Tres, y no más: cada rol extra es una regla que alguien tiene que recordar. Están
definidos por lo que **dejan hacer**, no por el cargo.

| Rol | Ve | Envía el informe al agricultor | Administra cuentas |
|---|---|---|---|
| `zonal` | solo sus propios agricultores, dentro de su área | no | no |
| `jefe` | toda su área | sí | no |
| `admin` | todas las áreas | sí | sí |

El cargo real no importa acá. René es jefe de Producción Altué y Francisco es
zonal de Mercado Nacional, pero si mañana Francisco necesita ver el área entera
se le cambia el rol, no el código.

El contrato que hace cumplir esto es `alcanceDe()` en
[`lib/tuniche/session.ts`](../../lib/tuniche/session.ts). **Toda consulta que lea
visitas, agricultores o lotes tiene que pasar por ahí**: el filtro que se olvida
en una sola pantalla es el que le muestra a un zonal de MN los agricultores de
Altué.

### El teléfono no es un dato de contacto

Es la **identidad en WhatsApp**. Un audio no trae usuario ni contraseña: trae un
número. Si el número no está en `tuniche_usuarios`, el mensaje no tiene autor, no
tiene área y por lo tanto no tiene plantilla — y la respuesta correcta es
rechazarlo, no adivinar. Un informe atribuido a la persona equivocada es peor que
un informe que no se creó. Por eso la columna es única y la pantalla de inicio
avisa cuando hay cuentas activas sin número.

---

## Qué mandaron Francisco y René

Esto está acá y no en código porque **todavía no lo lee ninguna pantalla**.
Cuando la plantilla de visita exista, esta información se muda a
`lib/tuniche/areas.ts`, que es donde el repo guarda lo que decide comportamiento.
Los archivos originales están en esta misma carpeta.

### Mercado Nacional (Francisco Pinochet)

Mandó **dos cosas distintas** y conviene no confundirlas.

**1. `Agricultores MN - Sistema Informático Tuniche`** — es la **maestra**, un
export del sistema que ya tienen. Columnas:

```
Zonal · Año · Región · Razón Social · Sucursal · Distribuidor · Vendedor ·
Status · Bolsas · Mes Facturación · Despacho · Tratamiento · Ciclo · Híbrido ·
Tipo Semilla · Calibre · Fecha Sol.Sit · Fecha Despacho · Obs. · Fecha Cambio ·
Nombre Contacto · Teléfono · Correo
```

Las tres últimas son las que importan para el envío del informe. `Zonal` es lo
que conecta cada agricultor con un usuario del sistema.

**2. `Sábana de Datos IA`** — es la **plantilla de visita**, organizada por etapa
fenológica. Cada columna es una etapa y cada fila un punto a evaluar en ella:

| Etapa | Qué se evalúa |
|---|---|
| **Presiembra** | Nota preparación de suelo · presión de maleza · compactación del perfil · definición de herbicida de presiembra · humedad de suelo |
| **Siembra** | Distancia entre hileras · distancia entre pasadas (pega) · distancia semilla-fertilizante · profundidad de semilla · población · chequeo dosis fertilizante/ha |
| **Emergencia** | Días de siembra a emergencia · presión de maleza · color de plantas emergidas · n° de plantas emergidas · presencia de insectos |
| **V2** | Presión de maleza · tipo de maleza (hoja ancha / angosta) · definición del control (herbicidas post-emergentes) |
| **V4** | Fecha estimada de aporca · n° de plantas antes de la aporca · altura de aporca ideal · desempeño del control de malezas |
| **V6** | Evaluación n° de plantas post aporca · evaluación primer riego post aporca |
| **V8** | Estimación fecha de floración · milímetros a regar según pivote |
| **R1** | Revisión de ceda · revisión de mazorcas potenciales · vuelo por dron · revisión de riegos |
| **R5** | Corte de riego según suelo · estimación fecha de ensilaje (para coordinar máquinas) · estimación fecha de cosecha de grano · medición de altura de plantas · toma de humedad de grano · revisión de llenado de grano · sanidad del cultivo (fusarium, carbón) |

### Producción Altué (René)

**`Sabana Datos Prod Invierno`** — una sola planilla dividida en cuatro bloques,
y el primero **viene precargado desde Comercial**: el zonal no lo escribe.

| Bloque | Campos |
|---|---|
| **Precargado (Comercial)** | Temporada · Cliente · Cultivo · Variedad · Relación (H:M) · Agricultor · Localidad · Zonal · Lote · N° IDASE · Hectáreas · Objetivo (kilos/ha) |
| **Trasplante** | Fecha de plantación hembra / macho 1 / macho 2 · establecimiento (30 DDT) pl/ha de cada uno · comentarios |
| **Floración** | Fecha postura de abejas · hembra 5/50/100% floración · macho 1 5/50/100% floración · población hembra (pl/ha) · evaluación agronómica floración (%) · evaluación nicking · comentarios |
| **Cosecha-Trilla** | Población final a cosecha · fecha eliminación macho · fecha inicio cosecha · fecha inicio trilla · número de máquina · bolting hembra / macho · fecha bolting |

Y aparte, lo que René marcó al pie de la planilla como **obligatorio en toda
visita**, independiente del momento:

- Foto general, de hembra y de macho
- Estado del riego
- Estado de malezas
- Sanidad de campo
- Nota agronómica en %

**Esa lista es la clave del diseño.** Los bloques de arriba se llenan una vez, en
su momento; estos cinco campos se llenan **cada vez**. Son los que corresponden
al audio de WhatsApp — la visita ordinaria— y los que producen el historial que
Francisco quiere poder mostrarle a un agricultor. Lo demás son hitos.

### Lo que los dos tienen en común

El núcleo es el mismo y por eso hay un solo sistema:

```
agricultor → lote → visita → informe → historial → envío al agricultor
```

MN mide el tiempo en etapas fenológicas y Altué en momentos del cultivo. Es la
misma idea con distinto vocabulario: **una visita ocurre en un punto del ciclo, y
ese punto determina qué se pregunta.**

---

## Cómo se enciende en un entorno

Las tablas no se crean con el despliegue. Un entorno sin ellas es legítimo — el
sitio de adoOps se sirve entero sin este módulo.

```bash
node scripts/tuniche-setup.mjs
```

Después, el primer administrador (no hay pantalla para esto, porque la pantalla
exige ya ser administrador):

```bash
node scripts/tuniche-usuario.mjs <usuario> <contraseña> admin "Nombre Apellido"
```

Hace falta `TUNICHE_SESSION_SECRET` en el entorno, de 32 caracteres o más y
**distinto** al del CRM y al del tablero: `/tuniche` no es un producto de adoOps,
es el sistema interno de otra empresa alojado en esta infraestructura.
Compartir el secreto significaría que una sesión de adoOps abre los datos de los
agricultores de Tuniche.

`scripts/tuniche-setup.mjs` **no siembra ningún usuario**, a propósito: una
cuenta sembrada con clave conocida es una puerta abierta que nadie recuerda haber
dejado.

## Las claves

Un administrador crea la cuenta y el sistema genera la clave: se muestra **una
sola vez** y después solo existe su hash. La persona la usa para entrar y el
sistema no la deja pasar a ninguna pantalla hasta que elija la suya. La regla es
larga y nada más —12 caracteres, sin exigir mayúsculas ni símbolos—, porque las
reglas de "una mayúscula, un número y un símbolo" producen `Tuniche2026!` en
todas las cuentas y una nota pegada al monitor.

Las cuentas **no se borran, se desactivan**: sus visitas quedan firmadas con su
nombre, y una fila huérfana convierte el historial de un agricultor en un informe
sin autor.

---

## Las tres capas

El análisis de los tres Excel dio una separación que ordena todo el sistema, y
está en [`lib/tuniche/plantillas.ts`](../../lib/tuniche/plantillas.ts):

| Capa | Qué es | Quién la llena | Cada cuánto |
|---|---|---|---|
| **1 · Agricultor y lote** | Agricultor, lote, cultivo, variedad, superficie, objetivo | Precargada desde Comercial / el SIA | Una vez |
| **2 · Visita** | Riego, malezas, sanidad, nota agronómica %, fotos, próximas acciones | **El audio de WhatsApp** | Cada vez |
| **3 · Hitos** | Trasplante, floración, cosecha (Altué) · las 9 etapas fenológicas (MN) | El zonal, cuando toca | Una vez por etapa |

**La capa 2 es idéntica para las dos áreas** y es lo único que corre todos los
días. Sale de la lista que René escribió al pie de su sábana, más dos matices de
la checklist de Francisco (tipo de maleza en V2, qué enfermedad en R5). La nota
agronómica en % la aporta Altué y se adopta también para MN: es el único campo
que permite comparar el mismo lote entre marzo y julio, y dos zonales entre sí.

**Las etapas NO se unifican entre áreas, a propósito.** MN mide en etapas
fenológicas del maíz y Altué en momentos de la producción de semilla híbrida.
Forzar una tabla de equivalencias daría un mapeo que ningún agrónomo de las dos
áreas reconocería como suyo. Lo que sí se unifica es el nombre del campo
—`etapa`— y su papel: decidir qué hitos se preguntan.

## Entregables para el cliente

| Archivo | Para qué |
|---|---|
| `Sabana Consolidada - propuesta adoOps.xlsx` | La propuesta consolidada, campo por campo, diciendo de qué columna de qué planilla salió cada uno. Es lo que Francisco y René tienen que revisar. |
| `Flujo y contexto - Sistema Tuniche.pptx` | 14 láminas para presentar el contexto y el flujo **antes** de mostrar el sistema. |
| `maestra-extraida.json` | La extracción literal de los dos .xlsx. Versionado para que se vea qué se importó sin abrir Excel. |

## El flujo, tal como está implementado

1. Llega un mensaje de WhatsApp → **el número decide de quién es**. Si no está en
   `tuniche_usuarios`, no es de Tuniche y el mensaje sigue al router de las demos
   de TorreControl, que comparte el mismo número.
2. Audio → se desencripta, se transcribe (`lib/stt.ts`) y se estructura contra la
   plantilla del área de esa persona (`lib/tuniche/extraccion.ts`).
3. **La IA elige el lote de una lista real**, la de los lotes de ese zonal. Si lo
   que dijo no calza, devuelve `null` y guarda la frase textual: un informe
   atribuido al lote equivocado contamina el historial de un agricultor que no
   tuvo esa visita.
4. Se guarda **pendiente** y vuelve el borrador por WhatsApp.
5. El zonal responde **OK** → entra al historial **interno**. Las fotos que mande después se
   pegan a su última visita, copiadas a almacenamiento propio (la URL de WaSender
   vive una hora).

## Reportes: hacia adentro, no hacia afuera

`/tuniche/reportes` responde una pregunta distinta de todo lo demás. El historial
dice *"¿qué pasó en este campo?"*, la sábana *"¿cómo va la temporada?"*, los
informes son documentos que **salen** hacia un tercero. Reportes mira hacia
adentro: **¿qué se está quedando sin mirar?**

Un tablero que solo muestra actividad deja invisible lo que no se hizo, y lo que
no se hizo es lo que duele. Por eso "lo que se está quedando sin visitar" va
arriba, antes que cualquier cifra de producción.

- **Cobertura de lotes** — es la cifra que la POC tiene que mover. Francisco
  estimó que ~50% de las visitas queda respaldada por WhatsApp, y de ese 50% nada
  queda consultable. Esto la mide de verdad.
- **Lotes atrasados y nunca visitados**, ordenados por antigüedad.
- **Alertas abiertas** — según la **última** visita de cada lote. Un riego que
  estuvo crítico en marzo y se arregló en abril deja de aparecer: una lista que
  acumula lo ya resuelto enseña a ignorarla.
- **Actividad por zonal** — por el zonal **a cargo del campo**, no por quién
  apretó el micrófono. Es la pregunta de gestión, y son cosas distintas.
- **Del campo al agricultor** — el embudo generados → con visto bueno →
  enviados. Muestra dónde se detiene lo que debería salir.
- **Zonales sin cuenta con teléfono** — tienen agricultores asignados y no pueden
  mandar audios.

### Los gráficos

**Todo lo de esa pantalla es una sola serie**, y eso decide el diseño: comparar
magnitudes (días sin visita, visitas por zonal) y una razón contra un total
(cobertura). Con una serie no hace falta paleta categórica ni leyenda —la
identidad la da el título— y el largo de la barra carga el dato, así que el color
queda libre para lo único que significa algo acá: el estado.

La cobertura es un **medidor, no una torta**. Una torta de dos gajos obliga a
comparar ángulos para responder algo que un largo responde solo. La pista es un
paso más claro del mismo tono del relleno, para que la severidad se lea a lo
largo de toda la barra y no solo en la parte llena.

Los "nunca visitados" **no llevan barra**: no hay magnitud que comparar, o tienen
visitas o no. Son una lista, y la lista es el trabajo pendiente.

**Los colores de gráfico están separados de los de texto, y no es duplicación.**
Una marca necesita 3:1 contra la superficie; un texto necesita 4.5:1. El mismo
hex no puede cumplir ambos y además mantener separación bajo daltonismo — el
naranja lo demuestra: oscurecerlo hasta que sirva de texto lo acerca tanto al
verde que un protanope deja de distinguirlos. Así que las barras llevan
`--viz-*` y las etiquetas llevan los de texto, nunca al revés.

Los `--viz-*` están validados con el validador de la guía sobre superficie
blanca: banda de luminosidad, piso de croma, separación bajo daltonismo (ΔE 11.0
protan) y piso de visión normal (ΔE 24.4) pasan. El naranja queda en 2.93 de
contraste, bajo 3:1, y el alivio que eso exige es el que la pantalla ya tiene:
toda marca va con su etiqueta y su cifra al lado, nunca sola.

La pantalla es solo clara, como el resto del módulo — decisión tomada al elegir
los tokens: se mira en un teléfono, a pleno sol, en marzo.

No se congela nada: se recalcula entero en cada carga, porque su valor es
justamente estar al día. Es lo contrario de un informe.

## El repositorio de informes

**Un informe no es una visita.** La visita es lo que pasó en el campo; el informe
es lo que se le *comunicó a alguien*. Por eso `tuniche_informes.contenido` guarda
un **snapshot completo** —nombres, cifras, fotos y resumen congelados al
generarlo— y no un puñado de ids: si corregir una visita en octubre cambiara lo
que dice el informe enviado en marzo, el repositorio dejaría de servir para lo
único que importa, que es poder mostrar qué se dijo y cuándo.

Dos tipos, un solo repositorio:

| Tipo | Qué es | Destinatario | Cómo sale |
|---|---|---|---|
| `visita` | Lo que Francisco hoy manda por WhatsApp tras cada recorrido | El agricultor | WhatsApp, con el mismo texto que muestra la vista previa |
| `mensual` | Lo que René arma a mano pegando fotos de Drive en un PowerPoint | El cliente en el extranjero | Se imprime y se despacha; el sistema registra a quién y cuándo |

**Una visita produce un informe y solo uno** (índice único sobre `visita_id`).
Dos constancias del mismo hecho, con contenidos que pueden diferir, es peor que
ninguna.

El PDF sale **imprimiendo la página**, no de un generador aparte: un segundo
renderizador significaría dos versiones del mismo documento que se
desincronizan, y la que se desincroniza siempre es la que nadie mira — la que
recibe el cliente. Ver `@media print` en `app/tuniche/tuniche.css`.

La transcripción del audio **no entra al snapshot**. Es material interno para
contrastar lo que la IA entendió; al agricultor se le manda el informe, no la
grabación de alguien hablando desde una camioneta.

### La sábana como pantalla

`/tuniche/sabana` es la planilla con los datos adentro: una fila por lote.
Existe aparte del historial porque responden preguntas distintas — el historial
dice *"¿qué pasó en este campo?"* y la sábana dice *"¿cómo va la temporada?"*.
René y Francisco piensan en filas, no en fichas, y darles solo fichas es pedirles
que abandonen la forma en que miran su trabajo.

**Las columnas dependen del área y eso no se unifica.** Una tabla con las
columnas de las dos tendría, en cualquier fila, treinta celdas vacías que no
significan "falta el dato" sino "no aplica" — y en una planilla esas dos cosas se
ven igual.

Dos vistas: `resumen` (identificación + estado) y `completa`, que suma los hitos
—24 columnas en Altué, 31 en MN—. Quien abre la sábana para ver cómo va la
temporada no necesita los hitos; quien va a llenar una etapa, sí.

**Lo que aporta el sistema va sobre fondo verde**: etapa actual, número de
visitas, fecha de la última, nota agronómica, riego, malezas, sanidad e informes.
Ninguna de esas columnas estaba en la planilla original, y se actualizan solas
cuando entra un audio. Ese es el argumento entero de la pantalla.

`/api/tuniche/sabana?area=…` la baja en CSV, siempre en vista completa. Separador
`;` y BOM, que es lo que Excel en español abre sin preguntar. **No es una
concesión**: nadie deja una planilla de un día para otro, y exigirlo sería la
forma más rápida de que no usen esto. Lo que se borra es la transcripción a mano.
La ruta comprueba la sesión y el alcance por su cuenta: el proxy es un control
optimista, y si mañana alguien la agrega a `apiPublica` para desatascar otra
cosa, la sábana entera quedaría descargable sin sesión.

## Datos de demostración

`node scripts/tuniche-demo.mjs` siembra 4 agricultores inventados, 5 lotes, 8
visitas con transcripciones escritas como habla un zonal por audio, fotos, y 9
informes repartidos entre los tres estados. `--limpiar` lo borra entero.

**Agricultores inventados, nunca los reales.** Los 34 cargados son empresas que
existen; colgarles una nota agronómica falsa sería crear un registro que dice
cosas sobre el campo de alguien, y a los tres clics nadie distingue esa ficha de
una de verdad. Es exactamente lo que pasó en el CRM de CDC.

Tres defensas, y ninguna es un README:

1. **Columna `demo` por fila** en agricultores, lotes, visitas e informes. Es la
   copia de `pre_quotes.salucloud_env`: se marca por fila, porque hay una sola
   base de datos y no existe un ambiente del que las fichas no puedan salir.
2. **La pantalla lo pinta** con `<Demo />`. En el documento de un informe el
   aviso queda **fuera de `tun-no-print`**: si desapareciera al imprimir, una
   hoja de demostración podría llegar a un cliente sin nada que la distinga.
3. **El despacho está bloqueado por código.** `enviarInformeAction` se niega a
   mandar un informe `demo` aunque tenga visto bueno. Que el teléfono también
   sea inventado no basta: un número de ocho dígitos siempre puede ser de
   alguien.

Por eso la fila de `lib/modulos.ts` declara `datos: "mixtos"` y no `reales`.

### Descartar y corregir

**Descartar, no borrar.** Un audio mandado por error —cortado, el micrófono
apretado sin querer— pasa a estado `descartada`: sale de la bandeja y del
historial, pero la fila sobrevive con su transcripción. Si alguien descarta por
equivocación el audio de una visita que sí ocurrió, borrarla de verdad
significaría perderla para siempre: el audio original en WhatsApp también expira.
Por eso hay botón de recuperar.

**Corregir es indispensable, no un lujo.** Todo el diseño se apoya en "la IA
propone, la persona confirma"; si al confirmar lo único posible fuera aceptar o
rechazar en bloque, quien encuentre un campo mal puesto validaría igual —porque
el resto está bien— y el error entraría al historial. El formulario se arma
recorriendo `VISITA`, así que un campo nuevo en la plantilla aparece solo.

La **transcripción no se edita nunca**. Es la constancia de lo que dijo la
persona, y es contra ella que se contrasta lo que entendió la IA. Una visita
corregida queda como `corregida` y no como `validada`: el historial tiene que
poder distinguir lo que salió tal cual del audio de lo que alguien ajustó.

Editar o descartar **borra el borrador del informe** si existía. Un informe es un
snapshot congelado; si el contenido cambia, ese snapshot pasa a decir algo que ya
no es cierto, y hay que regenerarlo. Si el informe ya salió, ninguna de las dos
cosas se permite: el destinatario lo tiene.

### Qué se puede hacer desde WhatsApp

Dos verbos, y el mensaje de vuelta lo dice arriba y explícito:

| Respuesta | Qué hace |
|---|---|
| `OK` (o `listo`, `confirmo`, `👍`) | Valida: entra al historial |
| `NO` (o `descartar`, `❌`) | Descarta |
| `1`, `2775`, `MN26-0002`… | Elige el lote, cuando se supo el agricultor y no cuál de sus lotes |

**La elección de lote se resuelve en código, sin volver a llamar al modelo.** Es
una pregunta cerrada con dos o tres respuestas posibles: comparar cadenas es
exacto, barato e instantáneo, y no puede alucinar un lote que no estaba en la
lista. Mandarla al modelo sería reintroducir incertidumbre en el único paso donde
ya no la hay. Acepta el número de la lista, el código completo o cualquier trozo
distintivo de la variedad —*"el de la 2775"* resuelve TUNICHE 2775—, y devuelve
null si calzan varios.

Dos guardas para que no secuestre mensajes que no son una elección: solo se
intenta con textos de **40 caracteres o menos** —un reporte de terreno de verdad
no cabe ahí— y si no calza, solo se pide aclaración cuando el texto **parecía** un
intento. Un "buenas, cómo estás" sigue de largo y se trata como una visita nueva.

El orden de los candidatos es por código y es estable: el `2` de un mensaje tiene
que significar siempre el mismo lote.

**Corregir no.** Descartar sí está en WhatsApp porque el audio equivocado se manda
desde el teléfono y se nota segundos después; obligar a entrar al sistema para eso
es fricción justo donde duele. Corregir por audio, en cambio, obligaría a adivinar
qué campo se corrige, manejar correcciones parciales y mantener estado de
conversación — tres formas de que el sistema entienda mal una corrección, que es
peor que el error original porque nadie vuelve a revisarla.

## Las dos compuertas

No hay una sola confirmación, hay dos, y las hace gente distinta:

| | Quién | Qué afirma | Qué habilita |
|---|---|---|---|
| **Validación** | El zonal que estuvo en el campo | "esto es lo que yo vi" | El historial **interno** |
| **Visto bueno** | `jefe` o `admin` del área | "esto puede salir de Tuniche" | Recién ahí se puede enviar |

El visto bueno se da **sobre el informe**, no sobre la visita: se aprueba el
documento completo que va a salir, teniéndolo a la vista. Aprobar desde una
tarjeta resumida sería aprobar algo distinto de lo que se envía — el error que
este repo ya evitó una vez en el CRM al separar el texto de la cotización de la
pantalla que lo muestra.

Un zonal valida su propia visita —es el único que puede afirmar lo que vio— pero
**no puede darse el visto bueno a sí mismo**. Un jefe sí puede aprobar una visita
que él mismo levantó: en un área con un solo jefe, lo contrario significaría que
sus propias visitas no salen nunca.

**El envío nunca es automático.** No se dispara al validar, no hay envío por lote
ni programado. Cada informe lo decide una persona, y ese nombre queda en
`tuniche_visitas.aprobada_por`. El visto bueno se puede retirar mientras el
informe no haya salido; después no, porque el agricultor ya lo tiene.

### Los modelos

| Paso | Modelo | Variable |
|---|---|---|
| Transcripción | `gpt-transcribe` | `TUNICHE_STT_MODEL` |
| Extracción | `gpt-5.6-sol` | `TUNICHE_EXTRACT_MODEL` |

**Tuniche no hereda de `EXTRACT_MODEL` ni de `STT_MODEL`**, que son las de las
demos de TorreControl. Abaratar una demo no debe abaratar el sistema de un
cliente, y en una demo una palabra mal transcrita es una anécdota mientras que
acá es el nombre de un agricultor que después no calza con ningún lote.

En extracción va el modelo grande a propósito. La llamada no solo llena campos:
**elige un lote entre los del zonal o declara que no supo**, y ahí un modelo
chico prefiere elegir algo plausible antes que admitir incertidumbre. El costo de
equivocarse no es un campo vacío, es una visita colgada del historial de un
agricultor que no la tuvo. Una visita son ~1.350 tokens de entrada y ~250 de
salida: alrededor de un centavo de dólar, contra una milésima con la variante más
económica. No hay volumen que justifique ahorrar ahí.

Se fija la variante explícita (`gpt-5.6-sol`) y no el alias `gpt-5.6`: un alias
lo puede reapuntar OpenAI, y el comportamiento de producción cambiaría sin que
exista un commit que lo explique. Es la misma lección que dejó
`LINKEDIN_API_VERSION`.

La extracción va por la **Responses API** (`/v1/responses`), no por
`chat.completions`. No es preferencia: los modelos con razonamiento **rechazan
function tools** en chat.completions salvo que se mande `reasoning_effort: 'none'`,
y apagar el razonamiento sería pagar el modelo insignia con su rasgo distintivo
desactivado — justamente el que hace falta para decidir si lo que dijo el zonal
calza con un lote o si hay que declarar que no se supo.

Se descubrió con el primer audio real: la API devolvió *"Function tools with
reasoning_effort are not supported for gpt-5.6-sol in /v1/chat/completions"*. La
documentación decía que chat.completions soportaba la familia GPT-5.6 con
`tools`, y es cierto — pero no con razonamiento activo, que es el matiz que solo
apareció al llamarla de verdad.

`strict` va apagado a propósito: el esquema tiene campos opcionales por diseño
—un audio que no menciona el riego no debe inventarlo— y el modo estricto exige
que toda propiedad esté en `required`.

### El número del sistema

Los audios se le mandan a **+56 9 2257 6899**, que es el número conectado en
WaSender. El sistema no lo necesita en ninguna variable —responde por la cuenta,
no por el número— pero es lo primero que alguien pregunta y hasta ahora no
estaba escrito en ningún lado.

Es el número **receptor**. El que va en la ficha de cada usuario
(`tuniche_usuarios.telefono`) es el del **emisor**: desde qué teléfono manda sus
audios esa persona. Son dos cosas distintas y confundirlas cuesta una tarde.

El número del sistema **no debe registrarse nunca como usuario**. Hoy no lo está;
si alguna vez lo estuviera, el webhook lo salva igual —descarta los mensajes con
`key.fromMe`— pero es una defensa que no conviene tener que usar.

El webhook entrante es `/api/whatsapp/webhook`, compartido con las demos de
TorreControl. Adentro, el discriminador es el número de quien escribe: si está en
`tuniche_usuarios`, el mensaje es de Tuniche. **Tuniche no tiene webhook propio.**

`TUNICHE_WHATSAPP_SIMULADO=1` corre todo el flujo sin mandar ningún mensaje. En
producción esa variable no va.

## Estado

| | Estado |
|---|---|
| Accesos, roles y alcance por área | ✅ verificado en pantalla |
| Maestra de agricultores y lotes | ✅ 34 agricultores, 37 lotes importados |
| Plantilla de visita por área | ✅ en `plantillas.ts` |
| Entrada por WhatsApp (audio, texto, fotos) | ⚠️ escrita y enrutada; **la extracción no se ha probado contra la API real** — falta `OPENAI_API_KEY` en el entorno local |
| Historial por agricultor y por lote | ✅ verificado en pantalla |
| Envío del informe al agricultor | ❌ falta el teléfono del agricultor |

## Lo que falta, y de quién depende

**Ninguna de las dos planillas trae a quién mandarle el informe.** Es el hallazgo
más importante de la importación y bloquea el último paso del flujo:

- **MN**: las columnas `Nombre Contacto`, `Teléfono` y `Correo` están vacías en
  las 14 filas. Francisco mandó la estructura, no los datos.
- **Altué**: las columnas `CLIENTE` y `AGRICULTOR` están vacías en las 23 filas.
  René anonimizó la sábana antes de mandarla.

Lo demás, en orden:

1. **Los zonales y sus números de WhatsApp.** Hoy figuran Francisco Pinochet,
   Carlos Mancilla y José Casanova en las planillas, sin cuenta ni número. El
   número es la identidad del sistema.
2. **Identificador de lote en MN.** Su planilla es un libro de ventas y no tiene
   potrero. Hoy se importa una fila = un lote provisional (`MN26-0001`) y la
   propuesta es que el zonal lo corrija en su primera visita.
3. **Superficie en hectáreas para MN.** Miden en bolsas vendidas.
4. **Un audio real.** De una visita de verdad, sin ensayar. Es lo único que dice
   si la extracción funciona: el ruido de la camioneta y las frases a medias son
   el problema, no el vocabulario.

Fuera del alcance de esta etapa, y anotado porque salió en la reunión: **la
reportería mensual al cliente en el extranjero**, que hoy René arma a mano
pegando fotos en un PowerPoint. Es un dolor real y probablemente el de mayor
retorno, pero es otro problema —tiene otro destinatario y otro formato— y
mezclarlo acá diluiría la POC.
