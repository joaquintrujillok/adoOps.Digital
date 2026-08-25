# Dashboard360 — `/dashboard360`

Panel de control de rendimiento comercial para salir a vender. Vive dentro de la
web corporativa (mismo repo, mismo deploy, misma base de Neon) bajo la ruta
`/dashboard360`, detrás de login.

## Qué resuelve

El pedido original, textual, de un director comercial B2B:

> «en b2b normalmente las herramientas son ads, mail, rrss… y el responsable
> debería tener en una sola vista todos los esfuerzos integrados. Ese es como el
> gran volón, mi panel de control de rendimiento, que me permita ejecutar
> informes rápidos de resultados para el directorio.»

Son tres pedidos con dificultad muy distinta:

| Pedido | Estado del mercado |
|---|---|
| Ads, mail y redes en una sola vista | Resuelto y barato. Porter Metrics desde US$15/mes, Windsor.ai desde US$19 |
| Panel de control de rendimiento | La misma capa de arriba |
| **Informes rápidos para el directorio** | **Nadie lo resuelve bien. Es el diferenciador** |

Un tablero muestra que el costo por lead subió 40%. Un directorio quiere saber
si el trimestre va bien, por qué, y qué se hace al respecto. Ese salto lo hace
hoy una persona a mano cada mes en PowerPoint.

| Módulo | Ruta | Qué resuelve |
|---|---|---|
| Panel 360 | `/dashboard360` | La sola vista: inversión, leads, costo por lead y CTR, con la cuadratura contra el CRM arriba y no escondida |
| Canales | `/dashboard360/canales` | Detalle por plataforma y campaña, con las campañas caras marcadas |
| Informe al directorio | `/dashboard360/informe` | Genera la lectura del período en Markdown, imprimible, con flujo borrador → publicado |
| Fuentes conectadas | `/dashboard360/fuentes` | Estado y atraso de cada conector. Existe porque la falla común no es un número malo: es un número viejo |
| Prospección · Mercado | `/dashboard360/prospeccion` | El universo del SII y el ICP direccionable |
| Prospección · Motor | `/dashboard360/motor` | El motor de nurturing, mudado desde `/leads`. Ver `docs/motor-nurturing.md` |

## El motor de nurturing vive acá adentro, pero no viene incluido

Desde agosto de 2026 las pantallas del motor cuelgan de `/dashboard360/motor`.
Todo el recorrido —universo, señal, persona, conversación— es uno solo y estaba
partido en dos aplicaciones con cascarones distintos.

**Lo que se centralizó es la pantalla, no el producto.** Toda lectura de `lead_*`
pasa por `lib/dashboard360/motor.ts`, que degrada a vacío igual que `mercado.ts`.
Si esas tablas no existen en un despliegue, `disponible()` responde `false` y el
grupo «Prospección» del menú **no se pinta**: el tablero se sigue vendiendo solo.

La sesión es la excepción, y está documentada en `lib/leads/sesion.ts`: la zona
del motor acepta la cookie del tablero **o** la del CRM. Mudarlo sin más le habría
quitado el acceso a quien entra por `/crm`, y `proxy.ts` ya explicaba por qué eso
importa. Una sesión del CRM sigue sin abrir el Panel 360, ni al revés.

## La decisión de producto que sostiene todo

**Se muestran dos conteos de leads y ninguno sobra.** Las plataformas reportan
lo que cada una se atribuye; sumarlas infla el total porque tres canales se
cuelgan del mismo contacto. `d360_leads` cuenta personas distintas.

Esa diferencia es lo que hace caer un tablero en la sala del directorio cuando
alguien lo compara con el CRM. Acá está explicada de antemano, en la primera
pantalla, y todos los costos por lead se calculan sobre personas distintas.

## Arquitectura

```
Airbyte (self-hosted)  →  Neon Postgres  →  Dashboard360
```

Se descartó BigQuery: el proyecto ya corre Neon con Drizzle y Airbyte escribe a
Postgres sin problema. Un almacén más era una factura más y un sistema más que
mantener.

Se descartó la suscripción a Windsor.ai o Supermetrics (US$99/mes en el plan que
cubre las 7 fuentes que pide un B2B real) porque Airbyte open source trae los
mismos conectores sin licencia. Lo que se paga a cambio es operación: hosting,
monitoreo y subir versiones de conectores cuando las plataformas rompen algo —
LinkedIn apaga versiones en fecha fija, Meta publica una por trimestre y su API
de marketing puede expirar a los 90 días.

## Estado actual: demo con datos sembrados

**Este módulo todavía no está conectado a Airbyte, y es deliberado.** Para una
demostración de venta no hace falta: hace falta una pantalla creíble con datos
creíbles. Montar la ingesta primero atrasaba el demo semanas sin agregar nada
que el prospecto vea en la reunión.

El esquema de `db/dashboard360.ts` es el que escriben los conectores reales, de
modo que conectar una cuenta productiva es configuración y no reescritura.

Los datos sembrados **cuentan una historia a propósito**: el período reciente
tiene más inversión y levemente menos leads que el anterior, y dos campañas
gastaron sin devolver un solo lead. Sin eso el informe generado no diría nada, y
el informe es justamente lo que se está vendiendo.

## El informe no llama a un modelo de lenguaje

`lib/dashboard360/informe.ts` compone el texto con reglas sobre los datos. Tres
razones, en orden de peso:

1. En una reunión de venta, una llamada de red lenta o caída arruina la demo.
2. Un modelo que redacta sobre cifras puede equivocarse en una cifra, y en un
   documento que va al directorio ese error cuesta la cuenta.
3. Las conclusiones son deterministas de verdad: «subió la inversión, bajaron los
   leads, por lo tanto el costo por lead empeoró» es aritmética, no inteligencia.

Dónde sí entra un modelo más adelante: pulir el tono y redactar el contexto
cualitativo. La variable `D360_NARRADOR_MODEL` queda reservada. Lo que nunca
debería hacer un modelo acá es calcular.

## Puesta en marcha

Las tablas se crean y el demo se siembra **desde dentro del despliegue**, no con
un script local. La razón es concreta: la cadena de conexión de Neon está
guardada como variable cifrada en Vercel, y Vercel las entrega en un solo
sentido — se escriben, no se leen. En una máquina sin el `.env.local` original
no hay forma de correr un script contra la base; el runtime desplegado sí la
tiene.

Efecto secundario bienvenido: regenerar el demo antes de una reunión es una
llamada HTTP y no una sesión de terminal con credenciales a mano.

```bash
# 1. Variables en Vercel (Preview y Production)
vercel env add D360_SESSION_SECRET production --value "$(openssl rand -hex 32)" --yes
vercel env add D360_SETUP_SECRET   production --value "$(openssl rand -hex 32)" --yes

# 2. Desplegar

# 3. Crear tablas + sembrar (una vez)
D360_SETUP_SECRET=... node scripts/d360-setup.mjs https://www.adoops.digital
```

El endpoint crea el usuario `demo` / `dashboard360` con rol gerente; se cambia
con `D360_DEMO_USER` y `D360_DEMO_PASS`. Para regenerar desde cero, `--limpiar`
(borra métricas, leads, informes y fuentes de `d360_`; conserva usuarios).

**Para apagar el endpoint** cuando el demo ya no se regenere: borrar
`D360_SETUP_SECRET` de Vercel. Sin esa variable responde 503.

## Sesión

Cookie `adoops_d360_session`, firmada con HMAC-SHA256, contraseñas con scrypt.
Es el mismo mecanismo del CRM, **copiado y no importado**: son productos que se
venden por separado y comparten base por conveniencia, no por diseño. Una sesión
del CRM no abre el tablero, ni al revés.

`proxy.ts` custodia ambas áreas con una tabla de descriptores; sin el secreto
correspondiente responde 500 en vez de dejar entrar con un fallback conocido.

Roles: `admin`, `gerente`, `analista`. Publicar un informe —la única acción con
destinatario externo— queda reservada a gerencia y admin.

## Color y accesibilidad

Los colores de interfaz son de la marca adoOps, medidos sobre el código de la
home: verde `#2ed477`, teal `#0e8a82`, navy `#0e1d33`.

Los colores de serie son los mismos del CRM y salen de una paleta categórica
**validada con el script, no estimada a ojo** (ΔE CVD ≥ 8 entre pares
adyacentes sobre superficie clara). El verde de marca nunca pinta datos: si la
marca pintara series, cambiar la marca cambiaría lo que significa una barra.

Tres series quedan bajo 3:1 de contraste contra la superficie. El validador lo
marca como advertencia y obliga a compensar: por eso cada gráfico lleva leyenda
visible y va acompañado de la tabla con las mismas cifras.

## Qué falta para producción

1. Levantar Airbyte self-hosted y apuntar los conectores a `d360_metricas_diarias`.
2. La deduplicación de leads que hoy viene sembrada: hay que implementarla como
   transformación sobre los datos crudos de Airbyte.
3. Conectar las etapas del CRM para cerrar el circuito lead → oportunidad →
   venta. Sin ese tramo, «costo por lead» es lo más lejos que se puede llegar, y
   no alcanza para decidir dónde crecer. El propio informe lo declara.
