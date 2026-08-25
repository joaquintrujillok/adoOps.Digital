# Motor de nurturing — `/dashboard360/motor`

Prospección multicanal con señal verificable. Vive **dentro de Dashboard360**,
detrás de login, y comparte base con el CRM y con el tablero.

## Qué es, en una frase

No es "automatizar LinkedIn". Es **una máquina de estados por prospecto que cada
día decide a quién le toca, qué se le dice y por cuál de tres canales**,
tomando siempre el más barato disponible.

LinkedIn, InMail y email no son tres funcionalidades: son tres salidas del mismo
motor. Construidas como tres módulos, el trabajo se triplica y el resultado son
tres bandejas que nadie mira.

## Por qué vive dentro del tablero

El motor nació en `/leads`, con su propio cascarón y su propio CSS. Funcionaba,
pero la pestaña **Prospección** del tablero terminaba con un enlace «Abrir el
motor →» que sacaba al usuario a otra aplicación. Todo el recorrido —universo del
SII, señal, persona, conversación— es uno solo, y estaba partido en dos.

Se centralizó **la pantalla, no el producto**:

| Se centralizó | Sigue separado |
|---|---|
| Las rutas viven bajo `/dashboard360/motor` | Las tablas conservan el prefijo `lead_` y son ajenas al tablero |
| Un solo cascarón, un solo CSS, un solo `components/dashboard360/ui` | El CRM conserva su sesión; nadie importa la del otro |
| Toda lectura de `lead_*` desde el tablero pasa por `lib/dashboard360/motor.ts` | El tablero funciona entero con el motor apagado o sin desplegar |

`disponible()` decide si el grupo «Prospección» del menú se pinta. Si las tablas
`lead_*` no existen, no se pinta: **un menú con pestañas muertas es peor que un
menú corto**, y el plan "Inteligencia" —el único que no depende de LinkedIn— se
vende sin el motor.

### La sesión acepta las dos

`proxy.ts` decía, con razón, que `/leads` compartía cookie con el CRM a propósito:
*"no es otro producto, es la misma gente operando dos partes del mismo sistema.
Un segundo login sería una segunda contraseña que alguien apunta en un papel."*

Mudarlo a la sesión del tablero sin más le habría quitado el acceso a quien entra
por `/crm`. Así que **la zona del motor acepta cualquiera de las dos cookies**
(`lib/leads/sesion.ts`). Lo que sigue separado es lo importante: una sesión del
CRM no abre el Panel 360, ni al revés.

## El panel de despacho

`/dashboard360/motor` es la vista central, y es **una cola, no un tablero**.

La razón es operativa: en un motor con pacing el estado normal es que **la
mayoría de las cosas no salgan** —cuota agotada, fuera de ventana, sin señal
vigente, emisor frenado—. Un panel que solo muestra lo que sí salió se ve
idéntico el día que todo funciona y el día que nada funciona.

| Banda | Qué muestra | Por qué |
|---|---|---|
| **A · Emisores** | Cuota usada hoy, día de warm-up, aceptación de 7 días | Es la causa más frecuente de que la cola no avance |
| **B · Cola de hoy** | Persona, señal con su fecha y vencimiento, carril, paso, hora | Si una fila no puede justificar por qué se le escribe a alguien, la acción no debería existir |
| **C · Frenado hoy** | Cada descarte con su candado y qué lo desbloquea | **Es la banda que casi nadie construye** |

### Por qué existe la banda C

En el CRM de CDC, `candidatasRecordatorio()` descartaba candidatas en memoria en
vez de en el `WHERE`. Las descartadas encabezaban el orden —nunca se les marcaba
nada— así que consumían el margen entero y el motor recibía una lista vacía
mientras había candidatas más abajo.

**Seis días sin mandar un solo mensaje, con el cron corriendo cada dos minutos y
respondiendo 200.** El síntoma era invisible porque no había ninguna superficie
que mostrara la cola descartada.

Es el mismo criterio de la tarjeta «Cuadratura de leads» del Panel 360:
*responder la pregunta antes de que la hagan*. Allá es por qué el número no calza
con el CRM; acá es por qué hoy no salió nada.

La banda C tiene dos mitades y las dos hacen falta:

- `frenadasDeHoy()` — lo que el tick evaluó y marcó, con su candado.
- `descartadasAntesDeLaCola()` — lo que el `WHERE` deja fuera. Es invisible por
  definición: la consulta principal no lo devuelve. Sin contarlo aparte, un motor
  detenido porque sus 40 candidatas están suprimidas se ve igual que uno que no
  tiene nada agendado.

## Los cuatro candados

Los evalúa `lib/leads/motivo.ts` en orden 1 → 2 → 3 → 4, y devuelve el **primero**
que frena. Ninguna pantalla escribe estos textos a mano.

| # | Candado | Qué mira |
|---|---|---|
| 1 | Aprobación humana, **por lote** | `aprobada_en`. De a un mensaje no escala, y un candado que no escala se desactiva "por esta vez" |
| 2 | Sin opt-out, sin respuesta previa, bajo el tope de 5 toques, con señal vigente | La señal se exige **solo en el primer toque** |
| 3 | Interruptor general, campaña activa, no simulada | `lead_config.motor.encendido`, en la base y no en una variable de entorno |
| 4 | Cuota, ventana horaria, salud del emisor | Es el único que mira la cuota, y por eso va último |

**Un freno nunca consume cupo.** Si el orden se invirtiera, el emisor perdería
turnos por gente a la que nunca le escribió, y el síntoma sería "hoy salieron
menos de los que decía el panel".

## Punto único de salida

`lib/leads/despacho.ts` es el único módulo del motor autorizado a importar un
cliente de red. Se verifica con un comando:

```bash
grep -rn "unipile" lib app --include=*.ts | grep -v node_modules
```

Debe devolver solo ese archivo. Para Brevo el grep no sirve tal cual:
`lib/email.ts` ya lo importa desde antes, para el formulario de contacto de la
web. Ese módulo le escribe a adoOps, no a prospectos.

Es el mismo patrón que `whatsapp-dispatch.ts` en el CRM de CDC, y la razón por la
que ahí se puede responder con certeza "¿a quién le mandamos?" mirando un archivo.

## Estado actual: simulado, y a propósito

`enviarPorLaRed()` **todavía no está conectada**. Mientras
`lead_campanas.simulado` esté en `true` —el default del esquema— el candado 3
corta antes de llegar ahí, así que el motor completo se construye, se aprueba y
se recorre sin una cuenta de LinkedIn. Cuando entren las credenciales, lo único
que cambia es el cuerpo de esa función.

Las acciones frenadas por `simulado` aparecen en la banda C con ese motivo, así
que **el panel muestra exactamente cuántas habrían salido** si estuviera conectado.

## Las señales

Ningún primer contacto sale sin una señal verificable y vigente. Hace tres cosas
a la vez: sube la aceptación —la métrica que decide si LinkedIn te deja operar—,
da algo concreto que decir, y es la diferencia entre "traté sus datos porque
estaban ahí" y "lo contacté por un hecho público y pertinente" bajo el art. 13 d)
de la Ley 21.719.

| Señal | Ventana | Fuente |
|---|---|---|
| Se adjudicó una licitación | 30 días | ChileCompra |
| Publicó una licitación | 15 días | ChileCompra |
| Empresa constituida hace poco | 90 días | Registro de Empresas |
| Cambió de tramo de ventas | 180 días | SII |
| Abrió sucursal o cambió domicilio | 180 días | SII |
| Otra, verificable | 45 días | manual · **exige URL** |

**La ventana se cuenta desde la fecha del hecho, no desde la carga.** Una
adjudicación de hace 25 días ya casi no sirve; contándola desde la carga el
sistema la trataría como fresca 30 días más. Por eso `fecha_hecho` y
`obtenido_en` son dos columnas distintas.

### Mientras no esté la API de Mercado Público

Se cargan a mano en `/dashboard360/motor/senales`. No es un parche: la propia
especificación del MVP dice que si hay que recortar algo, se recorta la ingesta
automática y las señales se cargan a mano por un mes. Automatizar la fuente antes
de saber si el motor convierte es construir una cañería hacia un estanque del que
no sabemos si tiene fondo.

Cuando llegue el ticket, `registrarSenal()` es la función que va a llamar el cron
de ChileCompra, y la pantalla se queda: sirve para lo que ninguna API va a traer.
Lo que cambia es el `origen` de cada fila —`chilecompra` en vez de `manual`—, y
esa diferencia queda registrada por fila.

## La escalera de canales

Se toma el **primer** carril disponible, no el preferido:

| # | Condición | Carril | Costo |
|---|---|---|---|
| 1 | `network_distance = 1` | Mensaje directo | gratis |
| 2 | `es_open_profile = true` | InMail a Open Profile | gratis, no gasta crédito |
| 3 | Grupo o evento compartido | Mensaje directo | *fuera del MVP: requiere Unipile* |
| 4 | Prioritario | InMail con crédito | *fuera del MVP: 50/mes, sin criterio medido* |
| 5 | Tiene perfil | Invitación con nota | **20–25/día — el recurso escaso** |
| 6 | Solo email | Secuencia de email | verificar antes: un rebote duro daña el dominio |

**La invitación es el recurso más caro, no el más barato.** La intuición dice lo
contrario porque es gratis en dinero. Toda la escalera existe para no quemarla en
gente a la que se le puede escribir directo.

`es_open_profile = null` significa "no se ha consultado", **no** "no lo tiene".
Descartar por null sería descartar por defecto.

## El reloj

`lib/leads/reloj.ts` concentra todo lo que diga "hoy" o "a esta hora".

Vercel corre en UTC: con `toISOString().slice(0,10)` el "hoy" del panel cambia a
media tarde hora de Chile, y las cuotas diarias se reinician en mitad de la
jornada. Y Chile agrega una vuelta que Honduras no tiene: **horario de verano**.
El desfase alterna entre −3 y −4 dos veces al año, así que ninguna ventana se
puede escribir como constante en UTC.

Por eso `lead_acciones.fecha_chile` es **una columna y no una expresión del
índice**: `timestamptz AT TIME ZONE` es `STABLE`, no `IMMUTABLE`, y Postgres no la
acepta dentro de un índice.

## El cron

```
*/15 12-22 * * 1-5    →  /api/leads/cron/tick
```

Cada 15 minutos, días hábiles, en la **unión** de las dos estaciones de Chile:
12–22 UTC contiene 09:00–18:00 tanto en verano (−3) como en invierno (−4). La
ventana real la decide `dentroDeVentana()` contra `America/Santiago`.

**Una acción por invocación.** No es una limitación: es lo que hace que el ritmo
lo manden las cuotas y no la frecuencia del cron. Despachar la cola entera en una
invocación termina en un timeout a mitad de tanda, con algunos mensajes mandados
y ninguna forma limpia de saber cuáles.

Acotarlo a la ventana laboral **es por costo**: Neon apaga el cómputo tras 5
minutos sin actividad, y un cron cada 15 minutos las 24 horas no la deja dormir
nunca. En el CRM de CDC eso agotó la cuota del plan gratuito y tumbó el login con
un 500 que no era del código. De ~2.900 invocaciones al mes a ~220.

### Diagnosticar una cola detenida

```bash
curl "$URL/api/leads/cron/tick?simular=1" -H "Authorization: Bearer $CRON_SECRET"
```

No toca nada y devuelve qué pasaría con cada acción y con qué freno. **"El cron
corre" no prueba nada**: respondía 200 los seis días que no mandó nada.

El botón «Correr ahora» del panel hace lo mismo que el cron, sin saltear ningún
candado.

## Puesta en marcha

Las tablas se crean **desde dentro del despliegue**, igual que en Dashboard360 y
por la misma razón: la cadena de Neon vive cifrada en Vercel y no se puede leer
desde una máquina local.

```bash
# 1. Variables en Vercel
vercel env add LEADS_SETUP_SECRET production --value "$(openssl rand -hex 32)" --yes
# CRON_SECRET ya existe para las alertas del CRM

# 2. Desplegar

# 3. Crear tablas + configuración mínima (idempotente)
curl -X POST "$URL/api/leads/cron/setup" -H "Authorization: Bearer $LEADS_SETUP_SECRET"
```

El setup crea las diez tablas, aplica los ALTER de `persona_id`, `fecha_chile` y
`motivo` sobre `lead_acciones` si la tabla ya existía, y siembra **configuración**
—un emisor en warm-up y una campaña con sus cinco pasos—. **Nunca personas ni
empresas de mentira**: en un tablero de métricas un dato ficticio es una barra
que se ve linda; acá es alguien a quien el motor puede intentar escribirle. Los
prospectos entran solo por CSV.

Para apagar el endpoint: borrar `LEADS_SETUP_SECRET`. Sin esa variable responde
503. Falla cerrado.

> ⚠️ **Agregar o borrar una variable no afecta al deployment que ya está
> corriendo.** Vercel las congela al empezar el build, así que hace falta
> redesplegar para que el runtime la vea — o para que deje de verla.
>
> Y para ese redespliegue **no** se usa `vercel --prod`: ese comando sube la
> carpeta local, no el commit de `main`. Corrido desde un clon sin `git pull`
> despliega código viejo y reapunta el dominio a él. Pasó el 25-08-2026 y sacó el
> motor de producción minutos después de haberlo verificado funcionando; el
> síntoma es que las rutas empiezan a devolver 404. Lo correcto es **Redeploy**
> sobre el último deployment de Git en el dashboard, o empujar un commit a
> `main`.

## Qué falta

1. **Conectar Unipile** en `enviarPorLaRed()`, y verificar en el trial de 7 días
   si `es_open_profile` viene de verdad en la respuesta de búsqueda. Es la
   suposición sobre la que se apoya el carril más barato.
2. **Ingesta de ChileCompra** por API, solo deltas. Requiere el ticket.
3. **Bandeja unificada**: webhooks de entrada → `lead_mensajes` → hilo por
   persona. Hoy `marcarRespondio()` existe pero no lo llama nadie.
4. **Retiro de invitaciones a los 14 días** → Ruta C por email. Una invitación
   pendiente ocupa cupo indefinidamente y degrada la cuenta.
5. **Las seis métricas**, por emisor y no solo agregadas: una cuenta puede estar
   hundiéndose mientras el promedio se ve bien.
