# Cafecito IA — Search Console y analítica

Repo: `~/Proyectos/adoOps.Digital`

Este documento tiene dos partes que van en orden distinto y las hace gente
distinta:

- **Parte A — código.** La hace Code en el repo. Es lo único que falta tocar.
- **Parte B — consola.** Se hace en la interfaz de Google Search Console, con
  sesión iniciada. Code no puede hacerla.

---

## Estado verificado el 07-09-2026

Lo de abajo lo comprobé contra producción, no contra el código. No hay que
rehacerlo:

- `sitemap.xml` responde y lista las 3 páginas estáticas más las 3 ediciones,
  todas con URL de titular.
- Las URLs viejas con fecha (`/cafecito-ia/2026-09-07`) **redirigen** a la de
  titular. Los enlaces que ya salieron por correo siguen sirviendo.
- El `<link rel="canonical">` apunta a la URL de titular en `www`, que es el
  dominio al que el ápex redirige. No hay contradicción entre canonical y
  redirección, que es el error clásico.
- `robots.txt` permite todo salvo `/api/` y las rutas por token
  (`/cafecito-ia/confirmar/`, `/cafecito-ia/baja/`) y las consolas internas.
  Declara el sitemap y el host. Correcto.
- La bajada duplicada en las páginas de edición ya no aparece.

Lo que **no** pude verificar desde acá, y por eso está en la parte B: qué
propiedad existe en Search Console, si el sitemap está enviado, y si hay
alguna URL indexada.

---

## Parte A — código

### A1. Vercel Analytics

No está instalado (`@vercel/analytics` no figura en `package.json`).

```
npm i @vercel/analytics
```

Y en `app/layout.tsx`, dentro del `<body>`:

```tsx
import { Analytics } from "@vercel/analytics/react";
// ...
<Analytics />
```

### A2. Verificación de propiedad: no la muevas

No hay archivo de verificación en `public/` ni meta `google-site-verification`
en el código, así que la propiedad está verificada por **registro TXT en el
DNS**. Eso es lo correcto: es lo que habilita una propiedad de dominio, que
cubre `www` y el ápex y ambos protocolos de una vez.

No agregues un archivo ni un meta tag "por si acaso": duplicar métodos de
verificación no suma nada y confunde el día que haya que auditarlo.

### A3. `lastmod` del sitemap

`app/sitemap.ts` tiene `revalidate = 3600`. Una edición nueva puede tardar
hasta una hora en aparecer en el sitemap. Es aceptable —Google no rastrea en
minutos— pero déjalo anotado: si algún día una edición no aparece, esta es la
explicación antes de buscar un bug.

Las páginas estáticas emiten `lastModified: new Date()`, o sea la hora de
generación, no la del último cambio real. Eso le dice a Google que la portada
cambió cada vez que se regenera, lo que a la larga le quita valor a la señal.
Cámbialo por una fecha fija de última edición real de esas páginas.

### A4. Datos estructurados

Las ediciones ya emiten JSON-LD `NewsArticle` y la portada `Blog`. Valídalos
en el Rich Results Test de Google con una URL real y corrige lo que salga.
Presta atención a que `datePublished` y `dateModified` estén en ISO con zona
horaria, y a que `author`/`publisher` tengan el nombre de adoOps.

---

## Parte B — Search Console (interfaz, con sesión iniciada)

### B1. Confirmar la propiedad correcta

Debe existir una **propiedad de dominio** (`adoops.digital`), no una propiedad
de prefijo de URL. La de dominio cubre `www`, el ápex y http/https juntos, que
es justo lo que este sitio necesita porque el ápex redirige a `www`.

Si solo existe una de prefijo, crea la de dominio y usa esa de aquí en
adelante.

### B2. Enviar el sitemap

En *Sitemaps*, enviar `https://www.adoops.digital/sitemap.xml`. Si ya está
enviado, revisar que el estado sea "Correcto" y que detecte **6 URLs**.

### B3. Pedir indexación de las tres ediciones

Una por una, en *Inspección de URLs* → *Solicitar indexación*:

```
https://www.adoops.digital/cafecito-ia
https://www.adoops.digital/cafecito-ia/se-declaro-la-agi-lo-que-muestran-las-pruebas-es-otra-cosa
https://www.adoops.digital/cafecito-ia/cuatro-meses-invisible-un-incidente-de-agentes-redefine-que-significa-bajo
https://www.adoops.digital/cafecito-ia/meta-entra-a-la-frontera-y-una-caida-simultanea-expone-la-dependencia
```

**No pidas indexación de las URLs con fecha.** Redirigen, y pedir indexación de
una URL que redirige es pedirle a Google que indexe algo que no existe. Se
resuelven solas cuando rastree.

En cada inspección, verifica que el **canonical seleccionado por Google**
coincida con el declarado (la URL de titular en `www`). Si Google elige otro,
ahí hay un problema real que perseguir; hasta que no lo diga Google, no lo hay.

### B4. Qué esperar en los informes, para no perseguir fantasmas

- Las URLs con fecha van a aparecer como **"Página con redirección"**. Es el
  resultado correcto, no un error. No las quites del índice a mano.
- Las rutas `/cafecito-ia/confirmar/` y `/cafecito-ia/baja/` pueden aparecer
  como **"Bloqueada por robots.txt"**. También es lo correcto: son páginas por
  token, no deben indexarse.
- Una edición recién publicada puede tardar días en indexarse. Pedir indexación
  la acelera pero no la garantiza.

### B5. Enlazar analítica

Si vas a usar GA4, enlázalo con la propiedad de Search Console desde GA4
(*Administrar → Vínculos de Search Console*). Con eso las consultas de búsqueda
aparecen dentro de los informes de GA4 y dejas de mirar dos paneles.

Vercel Analytics (parte A1) es otra cosa y no se enlaza: es analítica de
producto, sin cookies, y no reemplaza a Search Console para SEO.

---

## Rutina después de cada edición

Tres veces por semana se publica una edición nueva. No hay que hacer nada
manual: el sitemap la toma sola dentro de la hora y Google la rastrea.

Vale la pena entrar a Search Console **una vez por semana**, no más, a mirar
tres cosas:

1. *Páginas* — que las ediciones nuevas pasen a "Indexada".
2. *Rendimiento* — qué consultas traen impresiones. Es lo que dice si los
   titulares están funcionando como titulares.
3. *Experiencia* — Core Web Vitals, sobre todo si alguna edición trae muchas
   imágenes.

---

## Reglas del repo

- `db/schema.ts` re-exporta los 10 archivos de `db/`. Que siga así.
- **Nunca `drizzle-kit push`** contra esta base: es compartida con otro
  proyecto y propone borrar sus tablas.
- Las migraciones se aplican **antes** del despliegue, no después.
