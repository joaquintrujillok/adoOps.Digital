# Reuniones — notas de una Meet, resumidas

Módulo `interno` (`/dashboard360/reuniones`). Toma la transcripción de una
reunión de Google Meet, la guarda, **la corrige con IA sin perder el original**,
y la deja buscable y descargable como `.txt`.

**No hay ningún bot que se una a la llamada.** La captura la hace el navegador
de alguien que ya está en la reunión, así que en la lista de participantes no
aparece un invitado extra ni Meet muestra que alguien esté grabando.

## Cómo está armado

```
Google Meet (subtítulos activados)
   ↓  los lee del DOM
TranscripTonic  ·  extensión de Chrome, MIT, de un tercero
   ↓  POST al colgar
/api/reuniones/webhook?token=…        ← el token dice quién grabó y en qué ámbito
   ↓  guarda el transcript ORIGINAL  (tabla reunion_registros)
   ↓  after(), pasada 1: corregir la transcripción  (lib/reuniones/corregir.ts)
   ↓  after(), pasada 2: resumir lo corregido       (lib/reuniones/extraer.ts)
/dashboard360/reuniones              ← buscador, filtro por fechas, ámbitos, .txt
```

El orden de las dos pasadas importa: el resumen lee la versión **corregida**, así
que hereda todo lo que arregló la corrección. Al revés sería tirar a la basura la
pasada más cara.

La pieza que no es nuestra es la extensión:
<https://github.com/vivek-nexus/transcriptonic> (MIT, v3.4.2 al momento de
escribir esto). Se eligió sobre las alternativas por tres razones: procesa todo
en el dispositivo, tiene webhook de salida —que es el punto donde este proyecto
se enchufa— y sigue mantenida. Amurex (2,9k estrellas) lleva más de un año sin
commits, es AGPL y exige levantar su propio backend.

## Qué hace la corrección, y qué no

Corrige tres cosas y solo esas: **palabras mal reconocidas** —sobre todo nombres
propios y términos técnicos, que es donde el reconocedor de Google falla—,
**puntuación y mayúsculas**, y **tartamudeos del reconocedor**, esas palabras
repetidas de corrido que la persona no dijo dos veces.

No resume, no acorta, no reformula. Si una frase quedó a medias porque alguien se
cortó, queda a medias. Y ante la duda deja la palabra como está: una palabra mal
reconocida que sigue mal reconocida es un error del reconocedor, pero una que se
"corrige" mal es un error del modelo, y ese es peor porque suena convincente.

### El glosario, que es lo que la hace servir

`REUNIONES_GLOSARIO` es una lista de términos separados por comas: nombres de
clientes, de sistemas, de personas, jerga del negocio. Viaja en cada tramo y
cuesta unas decenas de tokens.

**No es un extra, es la diferencia entre que corrija y que arruine.** Se descubrió
probándola en producción el 01-09-2026. Sin glosario:

| Lo que entregó Meet | Lo que hizo la IA | Lo correcto |
|---|---|---|
| un nombre propio partido en dos | lo dejó partido en dos palabras comunes | el nombre propio, entero |
| `los itos del lote` | `los ITOS del lote` | los **hitos** |

(La prueba se hizo con un payload sintético. **El glosario de este módulo lo
define quien lo usa**: son los nombres de su gente, sus clientes y su jerga. No
se siembra con vocabulario de otros proyectos del repositorio — eso metería en
las transcripciones palabras que no tienen nada que ver y empujaría al corrector
hacia ellas.)

El modelo no se abstuvo: armó algo plausible con las palabras que sí conocía. Es
la forma más dañina de equivocarse, porque el resultado se lee bien y nadie lo va
a revisar. Los nombres propios de un negocio no están en el mundo del modelo;
dárselos convierte una adivinanza en un calce.

A la lista se le suman solos los nombres de quienes hablaron en esa reunión: si
habló Camila Rojas, "camila roja" en el texto es ella.

Junto con el glosario se endurecieron tres reglas del prompt, cada una por un
error observado: no partir una palabra desconocida en dos palabras conocidas, no
convertir una palabra en sigla poniéndola en mayúsculas, y ante la duda dejarla
literalmente igual.

### Las dos defensas del diseño

**Se corrige línea por línea, y se cuentan las líneas.** El modelo devuelve un
arreglo de líneas, no un bloque de texto. Si devuelve una cantidad distinta de la
que recibió, **se descarta su salida y se conserva el tramo original**: un modelo
que fusiona dos turnos de habla no está corrigiendo, está resumiendo, y ahí ya se
perdió quién dijo qué. Cuántos tramos se descartaron queda guardado en
`tramos_sin_corregir` y la pantalla lo avisa.

**Los tramos no se encadenan.** Cada tramo recibe como contexto el final del
tramo anterior en su versión **original**, no en la corregida, así un error de
corrección no se propaga hacia adelante. De paso los tramos quedan independientes
y se piden de a cuatro en paralelo.

**Y el original nunca se toca.** Vive en `transcripcion`; lo corregido va en
`transcripcion_corregida`, una columna al lado. Las dos se pueden bajar por
separado desde la pantalla de detalle, y el `.txt` dice en su encabezado cuál de
las dos es.

## Puesta en marcha

### 1. Tablas

```
node scripts/reuniones-setup.mjs
```

Idempotente y aditivo. Sin las tablas `reunion_*`, el tablero funciona igual y
ni siquiera pinta la entrada del menú.

### 2. Tokens: uno por navegador

`REUNIONES_WEBHOOK_TOKEN` no es un token, es una lista. Cada entrada es
`token:Nombre:ámbito`, separadas por comas:

```
REUNIONES_WEBHOOK_TOKEN=abc123…:Joaquín Trujillo:soho,def456…:Joaquín Trujillo:personal
```

**El token hace tres cosas a la vez**, y por eso son varios y no uno:

1. **Autentica.** Es lo que era antes.
2. **Dice quién grabó.** Google Meet rotula al usuario local como "Tú" en su
   interfaz en español, y eso es lo que la extensión lee. En una reunión de
   cinco, cuatro salen con su nombre y la quinta —justamente la que grabó— sale
   como "Tú". El nombre del token lo reemplaza antes de guardar. Solo en las
   líneas de hablante: el "tú" que alguien dijo hablando no se toca.
3. **Separa los mundos.** El ámbito es la pestaña de la pantalla. Un navegador
   para el trabajo, otro para lo personal, un token cada uno, y las reuniones no
   se mezclan nunca.

Un token sin nombre ni ámbito autentica igual y guarda igual; solo pierde el
reemplazo y el filtro. Es deliberado: el día que se agregue un token al vuelo y
se olvide el resto, la reunión tiene que guardarse igual. Un transcript sin
firmar se arregla después; uno que nunca se guardó, no.

El token debe tener al menos 24 caracteres o no se carga. Si no queda ninguno
cargado, el endpoint responde 500 y no guarda nada: una ruta pública que escribe
en la base y llama a una API que se paga no puede tener un modo permisivo por
defecto.

Después de agregarla en Vercel hay que **redesplegar el último deployment de
Git** desde el panel. No usar `vercel --prod` — ver `AGENTS.md`, sección de
despliegue.

### 3. La extensión, en el navegador de cada persona

Los pasos están en orden de lo que rompe primero. Los dos primeros son los que
hacen que la extensión exista para Meet; sin ellos, configurar el webhook no
sirve de nada.

1. Instalar TranscripTonic:
   <https://chromewebstore.google.com/detail/ciepnfnceimjehngolkijpnbappkkiag>

2. **Encender el interruptor de Google Meet en el popup, y aceptar el permiso de
   notificaciones que pide Chrome.** Este paso no es cosmético y es el que más
   se salta. La configuración interna de la extensión exige el permiso
   `notifications` para dar Google Meet por habilitado, y ese permiso **no viene
   en su manifiesto**: hay que concederlo. Mientras no esté, la extensión no
   registra sus content scripts, o sea que en `meet.google.com` no hay nadie
   leyendo nada. El síntoma es el peor posible: la reunión pasa entera, y
   después no aparece **ni en la tabla de la extensión ni acá**.

3. En el popup, dejar **Auto mode** (es el default). En auto, la extensión
   **aprieta el botón `CC` sola** al entrar a la reunión. En modo manual no, y
   ahí sí hay que prenderlo a mano.

4. Opciones → **Webhooks** → **Webhook URL**:
   `https://<dominio>/api/reuniones/webhook?token=<el token>`
   Al guardar, Chrome vuelve a pedir permiso, esta vez para el dominio del
   webhook. También hay que aceptarlo.

5. **Body type: `advanced`.** No es un detalle. En `simple` la transcripción
   llega como un bloque de texto y **la fecha de la reunión se pierde** — viene
   formateada en el idioma del navegador y no se puede parsear sin adivinar si
   `08/03` es marzo o agosto. La primera reunión real que entró acá vino en
   `simple` y quedó sin fecha ni duración. El módulo acepta los dos modos, pero
   con `simple` la reunión se ordena por hora de llegada y nada más.

6. Activar **Auto post webhook after meeting**.

### La señal de que está funcionando

Al entrar a una reunión con todo bien configurado, **la extensión muestra un
aviso dentro de la interfaz de Meet**. Si ese aviso no aparece, no está
corriendo, y no vale la pena hablar media hora para descubrirlo al colgar.

### Que Meet *pueda* generar subtítulos

Aparte de que la extensión los prenda, Meet tiene que estar efectivamente
generando subtítulos. Se verificó en terreno el 01-09-2026: las dos primeras
pruebas no capturaron nada porque Meet no estaba produciendo captions, aunque el
botón estuviera activado. La comprobación que sirve es mirar la pantalla y ver
si aparece texto abajo cuando alguien habla, **antes** de confiar en que la
reunión se está guardando.

### 4. Probar

```
curl -X POST "https://<dominio>/api/reuniones/webhook?token=<token>" \
  -H 'Content-Type: application/json' \
  -d '{"webhookBodyType":"advanced","meetingSoftware":"Google Meet","meetingTitle":"Prueba","meetingStartTimestamp":"2026-08-28T14:00:00.000Z","meetingEndTimestamp":"2026-08-28T14:20:00.000Z","transcript":[{"personName":"Prueba","timestamp":"2026-08-28T14:01:00.000Z","transcriptText":"Quedamos en que yo mando la propuesta el lunes."}],"chatMessages":[]}'
```

Responde `{"ok":true,"id":N,"duplicada":false}`. La reunión aparece en
`/dashboard360/reuniones` de inmediato; el resumen, unos segundos después.

## La pantalla

**Buscador.** Busca adentro de la transcripción, no solo en el título. Es lo que
lo hace servir: el título que manda Meet es el código de la sala —"Meet -
ppb-cxec-ujo"— y nadie recuerda una reunión por ahí. Se recuerda por una palabra
que se dijo adentro. Busca en el original, en la versión corregida y en el
resumen, con `ILIKE`, así que encuentra fragmentos y palabras a medias. Si algún
día son miles de reuniones, se cambia por un índice `tsvector` y la pantalla no
se entera.

**Filtro por fechas.** Sobre la fecha de la reunión, y si no la hay —modo
`simple`— sobre la hora en que llegó. Una reunión sin fecha no puede desaparecer
de un filtro solo porque su emisor tenía mal una casilla. El "hasta" incluye el
día entero.

**Pestañas de ámbito.** Se arman con los ámbitos que existen en la base, no con
los que declara la configuración: si mañana se saca un token, sus reuniones no
desaparecen y la pestaña para encontrarlas sigue ahí. Cambiar de pestaña conserva
lo que haya escrito en el buscador.

**Descargar `.txt`.** En la lista y en el detalle. El default es la versión
corregida; en el detalle hay un segundo botón para bajar el original. El archivo
trae un encabezado con el título, la fecha, el ámbito, quién capturó y **cuál de
las dos versiones es** — un `.txt` que sale de acá termina pegado en otra
herramienta, y sin esa línea nadie sabe si está leyendo lo que se dijo o lo que
un modelo entendió que se dijo.

La descarga vive en `/api/dashboard360/reuniones/<id>/txt` y no bajo
`/api/reuniones`, a propósito: el webhook está fuera del `matcher` de `proxy.ts`
porque lo llama una extensión sin cookie, y esta ruta devuelve transcripciones
literales de reuniones de trabajo. Colgarla del mismo prefijo la habría dejado
pública sin que nadie lo notara.

## Lo que hay que saber antes de confiar en esto

**Si Meet no genera subtítulos, no queda nada.** Es el modo de falla más
probable y es silencioso: la reunión ocurre, no se produce ni una línea de
caption, y al colgar no llega ningún webhook ni queda registro en la propia
extensión. No hay forma de recuperarlo después. Pasó en las dos primeras
pruebas reales.

**Lo que se lee arriba pasó por dos capas de interpretación.** El reconocedor de
voz de Google primero, y un modelo corrigiéndolo después. Por eso el original
nunca se borra, está a un clic en el detalle y se puede bajar por separado. Si
una frase suena rara, la pregunta correcta es qué decía el original.

**Son dos capas de error antes de la primera palabra en pantalla.** El
reconocedor de voz de Google se equivoca —sobre todo con nombres propios y
términos técnicos— y encima un modelo interpreta ese texto. Por eso la
transcripción literal se guarda siempre y está a un clic en la pantalla de
detalle: el resumen es una lectura, no la fuente.

**El DOM de Meet es de Google y cambia.** El día que cambie, la extensión deja
de capturar hasta que sus autores la arreglen. Es el costo de no meter un bot
en la llamada.

**El token viaja en la URL.** La extensión no manda cabeceras propias —lo
único configurable es la URL—, así que queda en los logs de acceso de Vercel y
en el `chrome.storage.sync` de quien la configure. Quien lo tenga puede
insertar reuniones falsas y gastar tokens de OpenAI; no puede leer nada, porque
el endpoint no devuelve datos. Si aparece donde no debía, se rota la variable y
se reconfigura la extensión.

**Hay que avisar que se está transcribiendo.** El indicador de grabación de
Meet no se enciende, porque esto no graba: lee los subtítulos que Google ya
muestra. Que sea invisible no lo hace consentido, y es una conversación con
personas, no un detalle técnico.

## Cuánto cuesta

La captura no cuesta nada: los subtítulos los genera Google dentro de Meet y la
extensión es gratis. Lo único que se paga es el resumen.

Tarifas verificadas el 01-09-2026 en
<https://developers.openai.com/api/docs/pricing>, en USD por millón de tokens:

| Modelo | Entrada | Entrada cacheada | Salida | |
|---|---|---|---|---|
| `gpt-4o-mini` | 0,15 | 0,075 | 0,60 | **el default de este módulo** |
| `gpt-5.6-luna` | 0,20 | 0,02 | 1,20 | tramo corto; el largo vale el doble |
| `gpt-5.6-terra` | 2,00 | 0,20 | 12,00 | tramo corto |
| `gpt-5.6-sol` | 4,00 | 0,40 | 20,00 | tramo corto |
| `gpt-4o` | 2,50 | 1,25 | 10,00 | |

Una reunión de una hora son unos 45.000 caracteres, o sea del orden de 13.000
tokens. **La corrección es la que manda en el costo**, y por una razón que no es
obvia: reescribe el texto entero, así que sus tokens de *salida* son del orden de
los de entrada, y la salida vale cuatro veces más. El resumen, al lado, es
gratis.

```
Corrección   ~18.000 × 0,15/1M  +  ~13.000 × 0,60/1M   ≈  US$0,0105
Resumen      ~13.000 × 0,15/1M  +     ~700 × 0,60/1M   ≈  US$0,0024
                                                          ─────────
                                                          US$0,013
```

(La entrada de la corrección son más de 13.000 porque el prompt de sistema viaja
en cada uno de los ocho tramos, junto con el contexto del tramo anterior.)

**Poco más de un centavo de dólar por reunión de una hora.** Cien reuniones al
mes son **US$1,3**. Es cinco veces lo que costaba solo resumiendo, y sigue sin
ser un criterio de decisión.

### Por qué el default sigue siendo `gpt-4o-mini`

Es el que ya usan las actas de TorreControl con esta misma forma de llamada
—Chat Completions con `tool_choice` forzado—, así que está probado en este
repo. Es además el más barato de la tabla. Cambiar a `gpt-5.6-luna` es una
variable de entorno:

```
REUNIONES_MODEL=gpt-5.6-luna
```

pero antes hay que confirmar en producción que ese modelo responde igual a la
llamada con función forzada. Un cambio de modelo sin esa prueba se ve como
reuniones que llegan y nunca se resumen.

### El asterisco de los tramos de contexto

Los `gpt-5.6-*` cobran **el doble pasado cierto largo de contexto** ("long
context"). La página de precios no dice dónde está el corte y la respuesta de la
API no informa qué tramo se aplicó. Este módulo cobra siempre al tramo corto y
marca la fila: con esos modelos, el número que muestra la pantalla es un **piso**
y aparece con un "aprox." al lado. Con `gpt-4o-mini`, que tiene tarifa única, el
número es exacto y no lleva nada.

### Lo que se guarda

Las cifras son la **suma de las dos pasadas** —la corrección son varios tramos y
el resumen una llamada más—, porque la pregunta que se hace es "¿cuánto costó
esta reunión?", no "¿cuánto costó cada paso?".

Cada fila guarda el modelo, los tokens de entrada, los cacheados, los de salida,
el costo en dólares y si ese costo es aproximado —columnas `modelo`,
`tokens_entrada`, `tokens_entrada_cache`, `tokens_salida`, `costo_usd`,
`costo_aproximado`—. El número aparece abajo del resumen en la pantalla de
detalle, y el acumulado con promedio arriba de la lista.

El costo se congela al momento de la llamada y no se recalcula después: las
tarifas cambian —esta tabla ya se actualizó una vez— y multiplicar tokens viejos
por la tarifa de hoy daría una cifra que nunca se pagó. Si se cambia a un modelo
que no esté en `lib/reuniones/costo.ts`, los tokens se guardan igual y el costo
queda en null: "no sé cuánto costó" es mejor que un número inventado.

## Variables de entorno

| Variable | Para qué | Obligatoria |
|---|---|---|
| `REUNIONES_WEBHOOK_TOKEN` | Lista de `token:Nombre:ámbito`. Autentica, identifica y separa. | Sí |
| `OPENAI_API_KEY` | El resumen. Ya la usan las actas y el STT de Tuniche. | Sí |
| `REUNIONES_MODEL` | Modelo de la corrección y el resumen. Default `gpt-4o-mini`. Ver la tabla de tarifas. | No |
| `REUNIONES_GLOSARIO` | Vocabulario **de quien usa el módulo**, separado por comas. Sin esto la corrección inventa nombres propios. | En la práctica, sí |

`REUNIONES_MODEL` es propia y no la `EXTRACT_MODEL` de las actas por la misma
razón que `lib/stt.ts` acepta un modelo por módulo: cambiar el modelo de un demo
no debería cambiar el de las reuniones internas del equipo.

## Cuando el resumen falla

La fila queda en estado `error` con el mensaje guardado, y **la transcripción
intacta**. En la pantalla de detalle hay un botón para reintentar. Ese orden
—guardar primero, resumir después— es la invariante del módulo: el transcript
existe una sola vez y la extensión lo manda una sola vez; el resumen se puede
volver a pedir siempre.
