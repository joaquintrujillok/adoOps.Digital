# Reuniones — notas de una Meet, resumidas

Módulo `interno` (`/dashboard360/reuniones`). Toma la transcripción de una
reunión de Google Meet y la guarda con un resumen, decisiones y compromisos.

**No hay ningún bot que se una a la llamada.** La captura la hace el navegador
de alguien que ya está en la reunión, así que en la lista de participantes no
aparece un invitado extra ni Meet muestra que alguien esté grabando.

## Cómo está armado

```
Google Meet (subtítulos activados)
   ↓  los lee del DOM
TranscripTonic  ·  extensión de Chrome, MIT, de un tercero
   ↓  POST al colgar
/api/reuniones/webhook?token=…
   ↓  guarda el transcript  (tabla reunion_registros)
   ↓  after(): resumen con OpenAI  (lib/reuniones/extraer.ts)
/dashboard360/reuniones
```

La pieza que no es nuestra es la extensión:
<https://github.com/vivek-nexus/transcriptonic> (MIT, v3.4.2 al momento de
escribir esto). Se eligió sobre las alternativas por tres razones: procesa todo
en el dispositivo, tiene webhook de salida —que es el punto donde este proyecto
se enchufa— y sigue mantenida. Amurex (2,9k estrellas) lleva más de un año sin
commits, es AGPL y exige levantar su propio backend.

## Puesta en marcha

### 1. Tablas

```
node scripts/reuniones-setup.mjs
```

Idempotente y aditivo. Sin las tablas `reunion_*`, el tablero funciona igual y
ni siquiera pinta la entrada del menú.

### 2. Token del webhook

El script imprime uno servible la primera vez. Va en `.env.local` y en las
variables de entorno de Vercel:

```
REUNIONES_WEBHOOK_TOKEN=<32 bytes en base64url>
```

Sin esta variable el endpoint responde 500 y no guarda nada. Es a propósito:
una ruta pública que escribe en la base y llama a una API que se paga no puede
tener un modo permisivo por defecto.

Después de agregarla en Vercel hay que **redesplegar el último deployment de
Git** desde el panel. No usar `vercel --prod` — ver `AGENTS.md`, sección de
despliegue.

### 3. La extensión, en el navegador de cada persona

1. Instalar TranscripTonic:
   <https://chromewebstore.google.com/detail/ciepnfnceimjehngolkijpnbappkkiag>
2. Abrir sus opciones → **Webhooks**.
3. **Webhook URL**: `https://<dominio>/api/reuniones/webhook?token=<el token>`
4. **Body type**: `advanced`. Importa: en `simple` la transcripción llega como
   un solo bloque de texto y **la fecha de la reunión se pierde** — viene
   formateada en el idioma del navegador y no se puede parsear sin adivinar si
   `08/03` es marzo o agosto. El módulo acepta los dos modos, pero en `simple`
   la reunión queda sin fecha y se ordena por hora de llegada.
5. Activar **Auto post webhook after meeting**.
6. En Meet, activar los subtítulos (`CC`). Sin subtítulos no hay transcripción:
   la extensión lee lo que Google escribe en pantalla, no el audio.

### 4. Probar

```
curl -X POST "https://<dominio>/api/reuniones/webhook?token=<token>" \
  -H 'Content-Type: application/json' \
  -d '{"webhookBodyType":"advanced","meetingSoftware":"Google Meet","meetingTitle":"Prueba","meetingStartTimestamp":"2026-08-28T14:00:00.000Z","meetingEndTimestamp":"2026-08-28T14:20:00.000Z","transcript":[{"personName":"Prueba","timestamp":"2026-08-28T14:01:00.000Z","transcriptText":"Quedamos en que yo mando la propuesta el lunes."}],"chatMessages":[]}'
```

Responde `{"ok":true,"id":N,"duplicada":false}`. La reunión aparece en
`/dashboard360/reuniones` de inmediato; el resumen, unos segundos después.

## Lo que hay que saber antes de confiar en esto

**Sin subtítulos activados no queda nada.** Es el modo de falla más probable y
es silencioso: la reunión ocurre, nadie prende el `CC`, y al colgar no llega
ningún webhook. No hay forma de recuperarlo después.

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

Tarifas de `gpt-4o-mini` verificadas el 01-09-2026 en
<https://developers.openai.com/api/docs/pricing>: **US$0,15 por millón de tokens
de entrada** y **US$0,60 por millón de salida** (la entrada cacheada va a la
mitad, US$0,075).

Una reunión de una hora son unos 45.000 caracteres de transcripción, o sea del
orden de 13.000 tokens de entrada y unos 700 de salida:

```
13.000 × 0,15/1M  +  700 × 0,60/1M  ≈  US$0,0024
```

Menos de un cuarto de centavo de dólar por reunión. Cien reuniones al mes son
unos **25 centavos de dólar**. En la práctica el costo de este módulo es cero y
la decisión de usarlo no pasa por ahí.

**Igual se mide, no se estima.** Cada fila guarda el modelo, los tokens y el
costo en dólares que devolvió la API en esa llamada —columnas `modelo`,
`tokens_entrada`, `tokens_salida`, `costo_usd`—. El número aparece abajo del
resumen en la pantalla de detalle, y el acumulado arriba de la lista.

El costo se congela al momento de la llamada y no se recalcula después: las
tarifas cambian, y multiplicar tokens viejos por la tarifa de hoy daría una
cifra que nunca se pagó. Si se cambia de modelo por uno que no esté en la tabla
de `lib/reuniones/costo.ts`, los tokens se guardan igual y el costo queda en
null — "no sé cuánto costó" es mejor que un número inventado.

## Variables de entorno

| Variable | Para qué | Obligatoria |
|---|---|---|
| `REUNIONES_WEBHOOK_TOKEN` | Autentica el webhook. Mínimo 24 caracteres. | Sí |
| `OPENAI_API_KEY` | El resumen. Ya la usan las actas y el STT de Tuniche. | Sí |
| `REUNIONES_MODEL` | Modelo del resumen. Default `gpt-4o-mini`. | No |

`REUNIONES_MODEL` es propia y no la `EXTRACT_MODEL` de las actas por la misma
razón que `lib/stt.ts` acepta un modelo por módulo: cambiar el modelo de un demo
no debería cambiar el de las reuniones internas del equipo.

## Cuando el resumen falla

La fila queda en estado `error` con el mensaje guardado, y **la transcripción
intacta**. En la pantalla de detalle hay un botón para reintentar. Ese orden
—guardar primero, resumir después— es la invariante del módulo: el transcript
existe una sola vez y la extensión lo manda una sola vez; el resumen se puede
volver a pedir siempre.
