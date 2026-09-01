# Dashboard360 · Estado y traspaso

Documento de continuidad, escrito el **2026-08-25**. Resume una sesión larga de
trabajo para que quien retome —otra sesión, otro agente o tú en dos semanas— no
tenga que reconstruir las decisiones ni volver a pagar los errores.

Lo que está en el código está en el código. Acá va **lo que no se ve leyéndolo**:
por qué las cosas son así y qué se probó antes de descartarlas.

---

## 1. Qué es esto y de dónde salió

El pedido original, textual, de un director comercial B2B:

> «en b2b normalmente las herramientas son ads, mail, rrss… y el responsable
> debería tener en una sola vista todos los esfuerzos integrados. Ese es como el
> gran volón, mi panel de control de rendimiento, que me permita ejecutar
> informes rápidos de resultados para el directorio.»

Son **tres pedidos con dificultad muy distinta**, y confundirlos lleva a
construir lo que ya existe:

| Pedido | Estado del mercado |
|---|---|
| Ads, mail y redes en una vista | Resuelto y barato: Porter Metrics desde US$15/mes, Windsor.ai desde US$19 |
| Panel de control de rendimiento | La misma capa de arriba |
| **Informes rápidos para el directorio** | **Nadie lo resuelve bien. Es el diferenciador** |

Un tablero dice que el costo por lead subió 40%. Un directorio quiere saber si el
trimestre va bien, por qué, y qué se hace. Ese salto lo hace hoy una persona a
mano cada mes en PowerPoint. **Ahí está el producto.**

---

## 2. Estado real al 2026-08-25

| Pieza | Estado |
|---|---|
| Dashboard360 en producción | ✅ `https://www.adoops.digital/dashboard360` |
| Login (`demo` / `dashboard360`) | ✅ |
| MCC `adoOps` · 826-978-3458 | ✅ |
| Developer token | ✅ **Acceso básico aprobado el 25-08-2026** |
| Proyecto Cloud `adoops-dashboard360` · nº 623436741294 | ✅ |
| OAuth (app **Interna**) + refresh token | ✅ Verificado contra la API |
| Cuenta del cliente **H&Co** · 386-295-1513 | ✅ Acceso de solo lectura concedido |
| Las 5 variables `GOOGLE_ADS_*` en Vercel | ✅ |
| Ingesta por API + cron diario | ✅ Desplegada · **primera corrida automática pendiente** |
| Datos reales en el panel | ✅ Cargados por CSV; la API ya devuelve 200 |

**Verificación del 25-08 contra la API real**, después de la aprobación:

```
HTTP 200 · 44 filas · CLP 249.850 · 6.615 impresiones · 457 clics
3 campañas de H&Co
```

Antes de la aprobación esa misma consulta devolvía `DEVELOPER_TOKEN_NOT_APPROVED`.

---

## 3. Las decisiones, con su razón

Cada una se tomó descartando alternativas concretas. **No las reviertas sin leer
por qué.**

### Airbyte sí, después no

Se evaluó pagar Windsor.ai (US$99/mes en el plan de 7 fuentes) y se descartó por
costo. Se eligió Airbyte self-hosted… y después **también se descartó**, porque
para *una sola fuente* es una máquina que mantener a cambio de nada. Airbyte se
justifica de cuatro o cinco fuentes en adelante.

Hoy la ingesta es un cliente directo de la API con cron de Vercel. Cuando entren
LinkedIn y Meta, reevaluar.

### Neon, no BigQuery

El proyecto ya corre Neon con Drizzle. Un almacén más era otra factura y otro
sistema. Airbyte —si vuelve— escribe a Postgres sin problema.

### El informe NO llama a un modelo de lenguaje

`lib/dashboard360/informe.ts` compone el texto con reglas sobre los datos:

1. En una reunión de venta, una llamada de red lenta arruina la demo.
2. Un modelo que redacta sobre cifras puede equivocarse en una cifra, y en un
   documento que va al directorio eso cuesta la cuenta.
3. «Subió la inversión, bajaron los leads, el costo por lead empeoró» es
   aritmética, no inteligencia.

`D360_NARRADOR_MODEL` queda reservada para que un modelo pula el **tono**.
Calcular, nunca.

### Dos conteos de leads, y ninguno sobra

Las plataformas reportan lo que cada una se atribuye; sumarlas infla el total
porque tres canales se cuelgan del mismo contacto. `d360_leads` cuenta personas
distintas.

Esa diferencia es **lo que hace caer un tablero en la sala del directorio** cuando
alguien lo compara con el CRM. Está explicada en la primera pantalla, antes de que
la pregunten.

### La app OAuth quedó **Interna**, y no se cambia

Se consideró pasarla a Externa para habilitar la *verificación de marca*, que
acelera la revisión de Google. **Se descartó**, verificado en la documentación:

- En estado «Testing», los refresh tokens **expiran a los 7 días** — la guía de
  errores de Google Ads lista `invalid_grant` por esa causa. El cron diario se
  rompería cada semana.
- `adwords` es un **scope sensible**: publicar como Externa dispara el proceso de
  verificación de app, otra cola y más lenta.

Consecuencia que hay que respetar: **solo cuentas `@adoops.digital` pueden
autorizar.** El correo al que un cliente da acceso de solo lectura tiene que ser
del dominio, no `@jtk.app` ni un Gmail.

### Camino A (invitación de usuario), no Camino B (vincular al MCC)

El anunciante agrega nuestro correo como usuario **Solo lectura** desde su propia
cuenta. No se le pide vincular su cuenta al MCC: eso toca facturación y gestión,
es mucho más difícil de conseguir, y no hace falta para reportar.

**Con el camino A no se envía `login-customer-id`.**

---

## 4. Las trampas que ya pagamos

Cinco horas de sesión concentradas. Cada una costó tiempo real.

### `USER_PERMISSION_DENIED` ≠ `DEVELOPER_TOKEN_NOT_APPROVED`

Se parecen y significan cosas opuestas:

- **`USER_PERMISSION_DENIED`** — se envió `login-customer-id` de un MCC que *no
  administra* esa cuenta. Es topología, no credenciales.
- **`DEVELOPER_TOKEN_NOT_APPROVED`** — todo lo demás está bien y solo falta la
  aprobación. **Llegar a este error es la señal de que la configuración quedó
  correcta.**

Por eso el código propaga el mensaje de Google literal en vez de un error
genérico.

### `cost_micros` viene en millonésimas… pero solo en la API

La API entrega `cost_micros`: hay que dividir por 1.000.000. **El CSV de la
interfaz ya viene en pesos.** Dividir ahí deja todo en cero.

### El CSV trae filas de subtotal

El export incluye «Total: Campañas», «Total: Cuenta» y «Total: Búsqueda». En el
archivo de H&Co eran **50 de 83 filas**. Sumarlas todas daba CLP 460.135 cuando lo
real era CLP 115.028 — exactamente cuatro veces.

Se descarta toda fila cuyo estado empiece con `Total:`. Filtrado así, cuadra al
peso con la interfaz.

### Importar sobre datos sembrados deja híbridos

La primera importación reemplazó solo los 11 días del CSV y los días sembrados
anteriores sobrevivieron: el panel mostró **CLP 3.433.202** cuando lo real eran
115.028. Ni demo ni verdad.

Por eso existe `--reemplazar-todo`. **Un número a medias es peor que cualquiera de
los dos puros**, y en una pantalla que alguien muestra en una reunión es
peligroso.

### `vercel --prod` hace retroceder producción

Sube la **carpeta local**, no el commit de `main`. El 25-08 borró el motor de
nurturing de producción minutos después de verificarlo. Usar siempre:

```bash
npm run desplegar          # verifica y despliega
npm run desplegar -- --pull   # se pone al día primero
```

### Vercel cifra las variables en un solo sentido

Se escriben, no se leen. `vercel env pull` devuelve **string vacío** para todas.
Por eso las tablas se crean y el demo se siembra **desde endpoints dentro del
despliegue**, no con scripts locales.

### Chrome descarga dentro del repositorio

Tanto el JSON del cliente OAuth como los CSV de Google Ads terminaron en
`~/Proyectos/adoOps.Digital/`. Ambos están ahora en `.gitignore`, pero **el
repositorio es público**: revisar antes de commitear.

### El secreto de OAuth se muestra una sola vez

La consola lo parte en dos líneas y copiarlo de pantalla lo corrompe —pasó, dio
`invalid_client`—. **Descargar el JSON**, no transcribir.

---

## 5. Credenciales: qué existe y dónde

Ninguna vive en el repositorio.

| Variable | Dónde | Valor |
|---|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Vercel + `.env.local` | 22 caracteres, del MCC 826-978-3458 |
| `GOOGLE_ADS_CLIENT_ID` | Vercel + `.env.local` | `623436741294-…apps.googleusercontent.com` |
| `GOOGLE_ADS_CLIENT_SECRET` | Vercel + `.env.local` | Del JSON descargado |
| `GOOGLE_ADS_REFRESH_TOKEN` | Vercel + `.env.local` | Autorizado con `nelson@adoops.digital` |
| `GOOGLE_ADS_CUSTOMER_ID` | Vercel + `.env.local` | `3862951513` (H&Co) |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | **Vacía a propósito** | Camino A no la usa |
| `D360_SESSION_SECRET` | Vercel | Firma la cookie del tablero |
| `D360_SETUP_SECRET` | Vercel | Protege sembrado, importación y purga |
| `CRON_SECRET` | Vercel | Protege la sincronía diaria |

### Pendientes de higiene

1. **Borrar `client_secret_2_*.json`** del repositorio local. Ya está ignorado,
   pero no tiene por qué seguir en disco.
2. **Inhabilitar el secreto OAuth viejo** (`****yEma`) en la consola de Cloud.
   Google advierte que tener dos activos aumenta el riesgo.
3. **Cambiar el contacto de la API a un correo de rol** —
   `google-ads-api@adoops.digital`— en `ads.google.com/aw/apicenter`. Hoy es
   personal, y el formulario advierte que no responder avisos de política puede
   costar el token. No afecta al token: es otro campo.

---

## 6. Cómo operar

```bash
# Sembrar el demo completo (datos ficticios con una historia)
D360_SETUP_SECRET=... node scripts/d360-setup.mjs https://www.adoops.digital --limpiar

# Cargar un CSV real de Google Ads
D360_SETUP_SECRET=... node scripts/d360-importar-csv.mjs \
  https://www.adoops.digital "Informe de campaña.csv" 3862951513 --reemplazar-todo

# Dejar solo datos reales, borrando lo sembrado
curl -X POST "https://www.adoops.digital/api/dashboard360/cron/purgar?conservar=google_ads" \
  -H "Authorization: Bearer $D360_SETUP_SECRET"

# Forzar la sincronía por API (normalmente corre sola a las 11:00 UTC)
curl "https://www.adoops.digital/api/dashboard360/cron/google-ads" \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Para exportar el CSV correcto:** Campañas → `Segmentar` → `Hora` → `Día` →
`Descargar` → **`.csv`** (no «Excel .csv», que usa otra codificación).

---

## 7. Lo que de verdad falta

### H&Co no mide conversiones

**Es el hallazgo más importante de toda la sesión y no es técnico.**

Las tres campañas tienen `Conversiones = 0.00`. El CTR es 7,67% —muy bueno— pero
no hay forma de saber si esos clics sirvieron.

Consecuencia directa: **la cuadratura de leads queda en cero y el costo por lead
no se puede calcular.** Con datos reales el panel muestra inversión y alcance,
pero no resultado — que es la única pregunta que le importa a un directorio.

Sin medición de conversiones, Dashboard360 le muestra a H&Co cuánto gasta, no si
funciona. **Configurársela vale más que cualquier pantalla nueva.**

### La cuenta es nueva

Solo hay datos desde el 13 de agosto. La comparación contra el período anterior
va a salir vacía hasta septiembre.

### Solo hay una fuente conectada

LinkedIn, Meta, email y redes siguen sembrados o vacíos. Y **la deduplicación de
leads —el diferenciador— necesita dos fuentes o más**: con una sola, la relación
es 1 a 1 siempre.

---

## 8. Frontera con el trabajo en paralelo

Hay otra línea de trabajo sobre el motor de prospección (`/dashboard360/motor`,
tablas `lead_*`).

**Git resuelve conflictos de archivos; nadie resuelve que dos procesos escriban
en la misma tabla con criterios distintos.** Ya se vio lo que pasa: la mezcla de
sembrado y real dio CLP 3.433.202 donde lo verdadero eran 115.028.

Frontera propuesta:

| Dominio | Dueño |
|---|---|
| `d360_metricas_diarias` con `fuente_slug='google_ads'` · `lib/dashboard360/google-ads*.ts` | Esta línea |
| Tablas `lead_*` · `lib/dashboard360/motor.ts` · `lib/dashboard360/mercado.ts` | Motor de prospección |
| `d360_leads`, `d360_informes`, `d360_fuentes` | **Compartidas — coordinar antes de borrar** |

El endpoint de purga borra `d360_leads` y `d360_informes` completos. **Avisar
antes de usarlo** si el motor ya está poblando leads.

---

## 9. Dónde está cada cosa

| | |
|---|---|
| `docs/dashboard360.md` | El módulo: pantallas, arquitectura, sesión, color |
| `docs/dashboard360-google-ads.md` | Runbook de Google Ads paso a paso |
| `docs/google-ads-api-design-document.pdf` | Documento enviado a Google |
| `lib/dashboard360/google-ads.ts` | Cliente de la API + ingesta |
| `lib/dashboard360/google-ads-csv.ts` | Importador del CSV |
| `lib/dashboard360/informe.ts` | Redacción del informe al directorio |
| `db/dashboard360.ts` | Esquema `d360_*` |
| `scripts/desplegar.mjs` | Despliegue con freno |

Los mensajes de commit llevan el razonamiento de cada cambio. `git log` es parte
de la documentación.
