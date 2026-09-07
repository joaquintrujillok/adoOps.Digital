# Cafecito IA — copy de portada, selector de taza y URLs con slug de título

Repo principal: `~/Proyectos/adoOps.Digital`
Repo secundario (solo para la tarea 5): `~/Proyectos/resumen semanal de whatsapp`

Todo lo de abajo salió de revisar el sitio en producción el 07-09-2026. La
publicación de ediciones funciona bien; lo que falla es el copy, un selector y
el formato de las URLs.

Hay un script útil para inspeccionar suscriptores mientras trabajas:
`node scripts/cafecito-suscriptor.mjs` (sin argumentos lista todas las filas).

---

## Tarea 1 — El copy de portada quedó de cuando había dos tazas

`app/cafecito-ia/page.tsx` dice que el boletín tiene dos ediciones y que se lee
en cinco minutos. Hay tres tazas, y el flat white son ocho minutos.

Ubicaciones exactas:

- línea 13 — meta description: *"...cada dos días y en cinco minutos..."*
- línea 21 — JSON-LD: misma frase
- línea 53 — hero: *"Lo que pasó en inteligencia artificial, cada dos días y en cinco minutos."*
- línea 105 — *"**2 ediciones** · dirección y builder"*
- línea 106 — *"**5 min** de lectura"*
- línea 119 — *"Dos ediciones, mismo material, distinto foco."*

**El problema de fondo no es la inconsistencia: es que el flat white no aparece
en ninguna parte de la portada.** Quien llega al sitio no sabe que existe hasta
que abre el formulario de perfilamiento. Eso hace que la taza más completa sea
invisible justo donde se decide la suscripción.

Qué hacer:

- Reescribe esas seis ubicaciones para tres tazas y un rango de lectura real
  ("de 4 a 8 minutos", no un número fijo).
- Agrega a la portada un bloque que presente **las tres tazas por nombre**, con
  su descripción y sus minutos. Toma los textos de `TAZAS` en `db/cafecito.ts`
  para que exista una sola fuente y no se vuelvan a desincronizar: si el copy de
  la portada se puede derivar de `TAZAS`, derívalo en vez de repetirlo.
- Los minutos en `TAZAS` ya están actualizados a "4 min" para los dos expresos
  (cambio de hoy, sin desplegar todavía). Verifica que el sitio los tome de ahí.

## Tarea 2 — El selector de taza viene preseleccionado y por eso la gente elige mal

`components/CafecitoPerfil.tsx`, línea 37:

```tsx
const [taza, setTaza] = useState<CafecitoTaza>(tazaActual ?? "expreso_directivo");
```

Como `activo` se calcula contra ese estado, la tarjeta de expreso directivo se
pinta con borde verde y fondo teñido apenas carga la página. La pregunta no se
ve como pregunta: se ve como algo ya respondido. Quien baja a llenar nombre y
empresa sin volver a subir envía expreso directivo sin haber elegido nunca.

**Esto ya ocurrió en producción**: una suscripción quedó en `expreso_directivo`
cuando la persona quería flat white.

Qué hacer:

1. `useState<CafecitoTaza | null>(tazaActual)` — sin valor por defecto.
2. Deshabilita el botón de envío mientras `taza` sea `null`.
3. Microcopy cuando no hay elección, algo como "Elige una para continuar".
4. Revisa que `perfilar` en `lib/cafecito/actions.ts` siga rechazando un `taza`
   ausente con un mensaje claro (hoy ya lo hace, pero confirma que se vea).

Efecto secundario valioso: hoy es imposible distinguir en la base "eligió
directivo" de "no eligió nada". Con este cambio, `taza = NULL` vuelve a
significar algo, y el fallback de
`app/api/cafecito/suscriptores/route.ts` (`f.taza ?? "expreso_directivo"`) pasa
a describir un caso real en vez de tapar un bug.

## Tarea 3 — La bajada sale dos veces en cada edición

En `app/cafecito-ia/[slug]/page.tsx` la línea 111 renderiza `e.bajada` desde la
base, y además la primera línea del markdown del cuerpo es esa misma bajada, así
que se imprime duplicada. Se ve en `/cafecito-ia/2026-09-07`.

Arréglalo del lado del render o del lado de `publicar`: si la primera línea
suelta del contenido coincide con la bajada, no la vuelvas a mostrar. Prefiero
que el markdown guardado quede intacto y el arreglo esté en el render, para no
perder información al publicar.

## Tarea 4 — Desplegar

Los cambios de `TAZAS` ("4 min") ya están en `db/cafecito.ts` sin desplegar.
Que salgan junto con lo anterior.

---

## Tarea 5 — URLs con el título, no con la fecha (SEO)

Hoy la URL de cada edición es la fecha: `/cafecito-ia/2026-09-07`. Debe pasar a
ser un slug derivado del título: `/cafecito-ia/se-declaro-la-agi-lo-que-muestran-las-pruebas-es-otra-cosa`.

Es el cambio más delicado del lote porque el slug es identidad, no presentación.
Léelo entero antes de tocar nada.

### Lo que hay hoy

- `db/cafecito.ts`: `slug: varchar("slug", { length: 10 }).notNull()` con
  `uniqueIndex`. **10 caracteres**: entra `2026-09-07` y nada más.
- `app/api/cafecito/publicar/route.ts` recibe `slug` y `contenido`.
- `~/Proyectos/resumen semanal de whatsapp/publicar-web.js`, líneas 30-31:
  deriva el slug del nombre del archivo y **valida que sea `YYYY-MM-DD`**.
- Consumen el slug: `app/cafecito-ia/page.tsx`, `[slug]/page.tsx`,
  `[slug]/opengraph-image.tsx`, `rss.xml/route.ts`, `app/sitemap.ts`,
  `lib/cafecito/consultas.ts`.

### Qué hacer

**1. Esquema.** Amplía `slug` a 200 caracteres y agrega una columna nueva
`fecha` (date, not null) con la fecha de la edición, que hoy vive implícita en
el slug. El listado y el RSS ordenan por fecha, no por slug, así que esa
columna tiene que existir antes de quitarle ese rol al slug. Migración
versionada — **nunca `drizzle-kit push` sobre esta base**, es compartida con
otro proyecto y propone borrar tablas ajenas.

**2. Generación del slug.** Función pura, con tests:

- minúsculas, sin tildes ni diéresis (`declaró` → `declaro`), `ñ` → `n`
- todo lo que no sea `[a-z0-9]` pasa a `-`, sin guiones repetidos ni en los extremos
- recorta a ~80 caracteres sin cortar una palabra por la mitad
- si el slug ya existe, sufija con la fecha: `titulo-del-articulo-2026-09-09`

**3. El slug se congela al publicar.** Una vez publicada una edición, su slug
no cambia aunque después se corrija el título — cambiarlo rompe los enlaces que
ya salieron por correo. Solo se genera si la fila no tiene uno.

**4. Redirecciones 301 de las URLs viejas.** Esto es obligatorio: las tres
ediciones ya publicadas (`2026-09-03`, `2026-09-04`, `2026-09-07`) fueron
enviadas por correo con la URL de fecha, y esos correos ya están en bandejas de
entrada. Implementa `/cafecito-ia/[slug]` de modo que, si el segmento tiene
forma `YYYY-MM-DD`, busque la edición por `fecha` y redirija con 301 permanente
al slug nuevo. 301 y no 302: le dice a Google que consolide la autoridad en la
URL nueva, que es el punto de todo esto.

**5. El publicador.** En `publicar-web.js` quita la validación que exige
`YYYY-MM-DD` y manda la fecha en su propio campo. El nombre del archivo sigue
siendo `YYYY-MM-DD-web.md`: la fecha se extrae de ahí, el slug lo calcula el
sitio a partir del título. No dupliques la lógica de slug en los dos repos.

**6. Sitemap, RSS y OG.** Verifica que los tres emitan la URL nueva y ninguno
la de fecha. Después del despliegue, pide reindexación en Search Console.

### Verificación

- `/cafecito-ia/2026-09-07` responde 301 hacia el slug nuevo.
- El slug nuevo responde 200 con la edición correcta.
- El listado, el RSS y el sitemap muestran solo URLs nuevas.
- Publicar una edición de prueba con un título con tildes y `ñ` produce un slug
  limpio; publicarla de nuevo con el título cambiado **no** cambia el slug.
- `npm run db:verificar` en verde.

---

## Pendientes menores del mismo bloque

- **Carrera en `enviados.json`** (`~/Proyectos/resumen semanal de whatsapp`).
  El despachador lee el registro al arrancar y lo escribe al terminar; si otra
  corrida se solapa, la segunda restaura entradas que la primera había quitado.
  Pasó hoy en producción. Arréglalo con un lock de archivo, o releyendo y
  fusionando el registro justo antes de escribirlo.
- **Íconos desde unpkg con `@latest`** en `CafecitoPerfil.tsx`: dependencia
  externa sin versión fijada dentro de un `mask` CSS. Inlínea los SVG o fija la
  versión.
- **`~/.zprofile` línea 2** tiene `nexport` en vez de `export`. Ensucia cada
  línea del log del despachador.

## Reglas que no se negocian

- `db/schema.ts` re-exporta los 10 archivos de `db/`. Que siga así.
- **Nunca `drizzle-kit push`** contra esta base: es compartida y propone borrar
  tablas de otro proyecto.
- Las migraciones se aplican **antes** del despliegue, no después. Así se cayó
  el build del 03-09.
