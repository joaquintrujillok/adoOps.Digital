# Conectar Google Ads real a Dashboard360 — paso a paso

Runbook para reemplazar los datos sembrados de Google Ads por los de una cuenta
real. Verificado contra la documentación de Google el 2026-08-24.

Al final tienes que quedar con **seis valores**. Todos van a variables de
entorno en Vercel; ninguno se guarda en el repositorio.

| Variable | De dónde sale |
|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Paso 2 |
| `GOOGLE_ADS_CLIENT_ID` | Paso 3 |
| `GOOGLE_ADS_CLIENT_SECRET` | Paso 3 |
| `GOOGLE_ADS_REFRESH_TOKEN` | Paso 4 |
| `GOOGLE_ADS_CUSTOMER_ID` | Paso 5 |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Paso 5 |

---

## Paso 1 · Cuenta de administrador (MCC)

El developer token **solo se pide desde una cuenta de administrador**. Desde una
cuenta normal de Google Ads el API Center ni siquiera aparece: sale el mensaje
*«The API Center is only available to manager accounts»*.

1. Entra a <https://ads.google.com/home/tools/manager-accounts/>
2. **Crear una cuenta de administrador**. Es gratis y no requiere medio de pago.
3. Dentro del MCC, vincula la cuenta de Google Ads que vas a leer:
   **Cuentas → Subcuentas → botón `+` → Vincular cuenta existente**, con el
   customer ID de 10 dígitos.
4. Desde la cuenta vinculada hay que **aceptar la invitación**.

> Si la cuenta es de un cliente, el paso 3 lo tiene que aprobar el cliente. No
> es un trámite técnico: le estás pidiendo acceso administrativo a su inversión
> publicitaria.

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

## Paso 4 · Refresh token

No hace falta el OAuth Playground. El repositorio trae la herramienta:

```bash
GOOGLE_ADS_CLIENT_ID=... GOOGLE_ADS_CLIENT_SECRET=... node scripts/google-ads-oauth.mjs
```

Abre el navegador, pide autorización con el scope
`https://www.googleapis.com/auth/adwords`, recibe el código en `localhost:8765`
y lo canjea. **Imprime el refresh token en la terminal y no lo guarda en disco.**

Autoriza con la cuenta de Google que tiene acceso al MCC, no con otra.

> Si el script dice que Google devolvió tokens **sin** refresh token, es porque
> esa cuenta ya había autorizado la aplicación antes. Revoca el acceso en
> <https://myaccount.google.com/permissions> y vuelve a ejecutar.

---

## Paso 5 · Los dos customer IDs

Son dos y se confunden seguido:

- **`GOOGLE_ADS_CUSTOMER_ID`** — la cuenta cuyos datos quieres leer.
- **`GOOGLE_ADS_LOGIN_CUSTOMER_ID`** — el MCC desde el que entras. **Es
  obligatorio** cuando el acceso pasa por una cuenta de administrador, que es
  nuestro caso.

Se encuentran arriba a la derecha en la interfaz de Google Ads, con el formato
`123-456-7890`. **Se guardan sin guiones**: `1234567890`. La API los rechaza con
guiones.

---

## Paso 6 · Cargar las variables

```bash
cd ~/Proyectos/adoOps.Digital
for v in GOOGLE_ADS_DEVELOPER_TOKEN GOOGLE_ADS_CLIENT_ID GOOGLE_ADS_CLIENT_SECRET \
         GOOGLE_ADS_REFRESH_TOKEN GOOGLE_ADS_CUSTOMER_ID GOOGLE_ADS_LOGIN_CUSTOMER_ID; do
  read -r "valor?$v: "
  vercel env add "$v" production --value "$valor" --yes
done
```

---

## Lo que hay que construir después

Con los seis valores, falta la ingesta: **un cliente directo de la API en el
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
