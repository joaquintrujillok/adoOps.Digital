# Conectar Google Ads real a Dashboard360 — paso a paso

Runbook para reemplazar los datos sembrados de Google Ads por los de una cuenta
real. Verificado contra la documentación de Google el 2026-08-24.

## Antes de empezar: son dos permisos distintos, no uno

Se confunden todo el tiempo y conviene tenerlos separados desde el principio:

| | Quién lo controla | Qué habilita |
|---|---|---|
| **Developer token** | **Tú.** Sale de *tu* cuenta de administrador | Identifica a la aplicación ante Google. **Por sí solo no da acceso a ningún dato** |
| **Acceso a la cuenta** | **El cliente** | Determina qué cuentas puede leer el usuario autenticado |

El cliente **no** necesita developer token, ni cuenta de administrador, ni
proyecto en Google Cloud. Todo eso es tuyo y se hace una sola vez, sirve para
todos los clientes que vengan después.

> **El token no tiene que salir del MCC que administra las cuentas.** El
> developer token solo acredita que eres un desarrollador registrado; el control
> de acceso real está en los permisos del usuario OAuth. Un token emitido desde
> un MCC propio y vacío sirve para leer cualquier cuenta a la que ese usuario
> tenga acceso, aunque no esté vinculada a ese MCC.
>
> Por eso no vale la pena pedir acceso de administrador al MCC de un cliente o
> de otra agencia para sacar el token de ahí. Funcionaría —un administrador del
> MCC entra al API Center y lo saca solo, sin que nadie le pase nada— pero deja
> tres dependencias que no necesitas: si te quitan el acceso pierdes el token y
> la ingesta se cae; compartes el límite diario de operaciones con cualquier otra
> herramienta que use ese MCC; y si Google suspende el token por el uso que le da
> un tercero, se cae la tuya con él.

Lo único que el cliente hace es darte acceso a su cuenta — y hay dos formas,
con costo político muy distinto:

### Camino A · Invitación de usuario (recomendado)

El administrador de la cuenta del cliente agrega tu correo como usuario, con
nivel **Solo lectura**. En Google Ads: **Administración → Acceso y seguridad →
`+` → correo + nivel de acceso**.

«Solo lectura» permite ver campañas y correr informes de rendimiento, que es
exactamente lo que necesita la API — el Google Ads API no tiene su propio modelo
de permisos: hereda los roles de usuario de la interfaz. No permite editar nada.

Es el permiso mínimo, se concede en dos minutos y se revoca en un clic.

**Con este camino no se usa `login-customer-id`**, porque el acceso no pasa por
una cuenta de administrador.

### Camino B · Vincular la cuenta a tu MCC

Tu MCC envía una solicitud de vinculación al customer ID del cliente y el
cliente la acepta: **Cuentas → Subcuentas → `+` → Vincular cuenta existente**.

Es un permiso bastante más fuerte —toca facturación y gestión— y por lo mismo
más difícil de conseguir. Se justifica cuando administras la inversión, no
cuando solo la reportas.

**Con este camino sí se envía `login-customer-id`**, con el ID de tu MCC.

---

Al final tienes que quedar con **cinco valores** (seis si tomas el camino B).
Todos van a variables de entorno en Vercel; ninguno se guarda en el repositorio.

| Variable | De dónde sale |
|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Paso 2 |
| `GOOGLE_ADS_CLIENT_ID` | Paso 3 |
| `GOOGLE_ADS_CLIENT_SECRET` | Paso 3 |
| `GOOGLE_ADS_REFRESH_TOKEN` | Paso 4 |
| `GOOGLE_ADS_CUSTOMER_ID` | Paso 5 |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Paso 5 — **solo en el camino B** |

---

## Paso 1 · Tu cuenta de administrador (MCC)

Sirve **solo para poder pedir el developer token**: desde una cuenta normal de
Google Ads el API Center ni siquiera aparece, sale *«The API Center is only
available to manager accounts»*.

No necesita tener ninguna cuenta vinculada ni gastar un peso. Es un trámite
tuyo, de una sola vez.

1. Entra a <https://ads.google.com/home/tools/manager-accounts/> con el correo
   que vas a usar siempre para esto.
2. **Crear una cuenta de administrador**. Es gratis y no pide medio de pago.

Si tomaste el camino B, acá además vinculas la cuenta del cliente. En el camino
A no hay nada más que hacer en este paso.

---

## Paso 2 · Developer token

1. Con el MCC seleccionado, entra a <https://ads.google.com/aw/apicenter>
2. Completa el formulario:
   - **Nombre de empresa** — adoOps
   - **URL** — `https://www.adoops.digital` (tiene que ser un sitio que cargue;
     Google rechaza dominios genéricos o de prueba)
   - **Email de contacto** — uno que se lea de verdad, Google escribe ahí
3. Envía y copia el token: son **22 caracteres alfanuméricos**.

### Qué nivel te dan

| Nivel | Revisión | Límite diario | Espera |
|---|---|---|---|
| **Explorer** | Automática | 2.880 operaciones sobre cuentas de producción | Inmediato |
| Basic | Manual | 15.000 operaciones | 5 días hábiles |
| Standard | Manual | Ilimitado | 10 días hábiles |

**Explorer alcanza para esto.** Una sincronía diaria de una cuenta consume unas
pocas operaciones; 2.880 es holgado. Si el formulario deja pedir Basic de una
vez, pídelo igual: llega en unos días y no estorba mientras tanto.

Si en vez de Explorer te dan *Test Account Access*, el token solo sirve contra
cuentas de prueba y hay que solicitar Basic explícitamente desde el mismo
API Center.

---

## Paso 3 · Proyecto en Google Cloud y cliente OAuth

1. <https://console.cloud.google.com/> → **crear proyecto** (o usar uno existente).
2. **APIs y servicios → Biblioteca** → buscar **Google Ads API** → **Habilitar**.
3. **APIs y servicios → Pantalla de consentimiento OAuth**:
   - Tipo de usuario: **Interno** si la cuenta de Google es de un Workspace de
     adoOps; **Externo** si es una cuenta `@gmail.com`.
   - Con **Externo**, la app queda en modo «Prueba»: hay que agregar el correo
     que va a autorizar como **usuario de prueba**. Sin eso, Google bloquea el
     acceso con un error de app no verificada.
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**
   - Tipo de aplicación: **Aplicación de escritorio**
   - Copia **ID de cliente** y **Secreto de cliente**

> **Por qué «Aplicación de escritorio» y no «Aplicación web».** Los clientes de
> escritorio aceptan `http://localhost` en cualquier puerto sin declarar redirect
> URIs, y piden acceso sin conexión por defecto. Con un cliente web hay que
> registrar la URI exacta a mano, y el desajuste produce
> `redirect_uri_mismatch`, que es el error más común de todo este proceso.

---

## Paso 3.5 · Llave de acceso (passkey) — **hay que hacerlo con días de antelación**

Esto no es opcional y tiene plazos que arruinan una planificación si se descubren
tarde.

- Desde el **21 de abril de 2026**, la Google Ads API exige verificación en dos
  pasos para **generar refresh tokens nuevos**.
- Desde el **5 de agosto de 2026**, exige **llave de acceso** para parte de sus
  usuarios. Contraseña sola, TOTP y códigos por SMS quedan **descartados** como
  forma de autenticación para emitir tokens nuevos.
- Los refresh tokens **ya existentes no se ven afectados** y siguen funcionando.

Como el paso 4 genera un token nuevo, esto aplica de lleno.

**Los tiempos son el problema:** una llave de acceso recién creada tarda entre
**uno y dos días en vincularse con Google Ads**, y puede quedar sujeta a un
**retraso de seguridad de siete días** para acciones sensibles si Google no logra
verificar la identidad de inmediato.

Se crea en **Administrador → Acceso y seguridad → Tareas de seguridad → Crear una
llave de acceso**, con el mismo correo que vaya a autorizar la API.

> **Los correos de dominio gratuito quedan fuera.** Las cuentas `@gmail.com` y
> similares están bloqueadas para acciones sensibles y hay que migrarlas a un
> dominio corporativo. `@adoops.digital` y `@jtk.app` sirven; una cuenta personal
> de Gmail, no.

---

## Paso 4 · Refresh token

No hace falta el OAuth Playground. El repositorio trae la herramienta:

```bash
GOOGLE_ADS_CLIENT_ID=... GOOGLE_ADS_CLIENT_SECRET=... node scripts/google-ads-oauth.mjs
```

Abre el navegador, pide autorización con el scope
`https://www.googleapis.com/auth/adwords`, recibe el código en `localhost:8765`
y lo canjea. **Imprime el refresh token en la terminal y no lo guarda en disco.**

Autoriza con **el mismo correo al que el cliente le dio acceso** a su cuenta de
Google Ads. Ese correo es el que define qué cuentas se pueden leer; el developer
token no aporta acceso, solo identifica a la aplicación.

> Si el script dice que Google devolvió tokens **sin** refresh token, es porque
> esa cuenta ya había autorizado la aplicación antes. Revoca el acceso en
> <https://myaccount.google.com/permissions> y vuelve a ejecutar.

---

## Paso 5 · Customer ID

**`GOOGLE_ADS_CUSTOMER_ID`** — la cuenta cuyos datos quieres leer. Aparece
arriba a la derecha en la interfaz de Google Ads con el formato `123-456-7890`.
**Se guarda sin guiones**: `1234567890`. Con guiones la API lo rechaza.

**`GOOGLE_ADS_LOGIN_CUSTOMER_ID`** — solo si tomaste el camino B. Es el ID de tu
MCC, también sin guiones. Es obligatorio cuando el acceso pasa por una cuenta de
administrador; en el camino A no se envía.

---

## Paso 6 · Cargar las variables

```bash
cd ~/Proyectos/adoOps.Digital
# Agrega GOOGLE_ADS_LOGIN_CUSTOMER_ID a la lista solo si tomaste el camino B.
for v in GOOGLE_ADS_DEVELOPER_TOKEN GOOGLE_ADS_CLIENT_ID GOOGLE_ADS_CLIENT_SECRET \
         GOOGLE_ADS_REFRESH_TOKEN GOOGLE_ADS_CUSTOMER_ID; do
  read -r "valor?$v: "
  vercel env add "$v" production --value "$valor" --yes
done
```

---

## Verificado en terreno el 2026-08-24

La cadena completa se probó contra la API real, no en teoría:

| Paso | Resultado |
|---|---|
| refresh token → access token | ✅ 200, expira en 3599 s |
| `customers:listAccessibleCustomers` | ✅ 200 · devuelve el MCC `8269783458` y la cuenta `3964539601` |
| Consulta GAQL sobre `campaign` | ❌ `DEVELOPER_TOKEN_NOT_APPROVED` |

**La versión de la API que responde hoy es `v22`.** `v21` devuelve 404.

Dos errores que conviene reconocer porque significan cosas muy distintas:

- **`USER_PERMISSION_DENIED`** — sale al enviar `login-customer-id` de un MCC que
  *no administra* esa cuenta. Es el error del camino B mal armado. En el camino A
  la cabecera simplemente no se envía.
- **`DEVELOPER_TOKEN_NOT_APPROVED`** — *«The developer token is only approved for
  use with test accounts»*. Este es el bueno: significa que credenciales,
  permisos y consulta están bien, y lo único que falta es el acceso básico.

Llegar al segundo error es la señal de que todo lo demás quedó correcto.

---

## Lo que hay que construir después

Con esos valores, falta la ingesta: **un cliente directo de la API en el
mismo repositorio, disparado por un cron de Vercel**, que escriba en
`d360_metricas_diarias` con `fuente_slug = 'google_ads'`.

**No se usa Airbyte para una sola fuente.** Levantar una instancia self-hosted
para un conector es una máquina que mantener sin beneficio a cambio. Airbyte se
justifica de cuatro o cinco fuentes en adelante.

La consulta es una sola, en GAQL, sobre `campaign`:

```sql
SELECT segments.date, campaign.name, metrics.impressions, metrics.clicks,
       metrics.cost_micros, metrics.conversions
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
```

Dos detalles de conversión que hay que resolver al escribirla:

- **`cost_micros` viene en millonésimas de la moneda de la cuenta.** Se divide
  por 1.000.000 para llegar a pesos. Es el error clásico: un tablero que muestra
  la inversión multiplicada por un millón.
- **`metrics.conversions` es un decimal, no un entero**, porque Google reparte
  conversiones fraccionadas entre campañas. Hay que decidir si se redondea o se
  acumula, y decirlo en pantalla.

## Lo que Google Ads solo no puede darte

La **cuadratura de leads** —la pantalla que sostiene el argumento de venta— no
funciona con una sola fuente:

- Google Ads entrega **conversiones, no personas**: sin nombre ni correo no hay
  deduplicación posible.
- Deduplicar necesita **dos fuentes o más**. Con una, la relación es 1 a 1
  siempre.
- No hay **CRM** contra qué reconciliar.

Con Google Ads solo hay que apagar esa tarjeta, o mostrará un número vacío.

Lo que sí queda real: inversión, impresiones, clics, CTR y conversiones por
campaña y por día; costo por conversión; y el hallazgo de **presupuesto sin
retorno** — campañas que gastan sin devolver conversiones. Ese último sobrevive
entero y suele ser lo que justifica la reunión.

## Demo y cliente no pueden compartir base

Si apuntas producción a una cuenta real, los datos sembrados se reemplazan y
pierdes la pantalla para vender.

Se resuelve con una **rama de Neon**: el demo se queda donde está y el piloto
vive en su propia base con la misma aplicación, cambiando solo `DATABASE_URL` en
el entorno correspondiente. Neon las crea en segundos.
