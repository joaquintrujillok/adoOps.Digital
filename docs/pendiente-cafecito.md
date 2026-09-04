# Pendiente: Cafecito IA

Estado al 03-09-2026, 21:00. Lee también `AGENTS.md` (sección de la base) y
`docs/base-de-datos.md`.

## Qué es Cafecito IA

Un boletín de IA de adoOps que sale lunes, miércoles y viernes a las 9:00. Tres
variantes, "tazas":

| Taza | Archivo del informe | Público |
|---|---|---|
| Expreso directivo | `FECHA-gerencia.md` | negocio: costo, riesgo, posición (2 min) |
| Expreso builder | `FECHA-builder.md` | técnico: precios, benchmarks (2 min) |
| Flat white | `FECHA-web.md` | informe completo (8 min) — además se publica en el sitio |

El contenido se redacta **fuera de este repo**, en
`~/Proyectos/resumen semanal de whatsapp`, y entra por
`POST /api/cafecito/publicar` con `CAFECITO_TOKEN`. Publicar no requiere
desplegar.

En este repo vive `/cafecito-ia`: archivo de ediciones, página por edición,
suscripción con doble opt-in y perfilamiento, y baja por token.

## Lo que ya está hecho

- `/cafecito-ia` (índice) y `/cafecito-ia/[slug]` (edición).
- `/cafecito-ia/confirmar/[token]` (confirmar + perfilar) y `/cafecito-ia/baja/[token]`.
- `POST /api/cafecito/publicar` y `GET /api/cafecito/suscriptores` (token Bearer).
- Tablas `cafecito_ediciones` y `cafecito_suscriptores` en `db/cafecito.ts`.
- SEO: `app/sitemap.ts`, `app/robots.ts`, `rss.xml`, JSON-LD (`NewsArticle` y
  `Blog`), imagen OpenGraph por edición.
- URL canónica centralizada en `lib/site.ts`, fijada en `https://www.adoops.digital`
  (la apex redirige 308 a www; antes el código declaraba la apex como canónica).
- Esquema centralizado: los 10 archivos de `db/` se reexportan desde `schema.ts`,
  `db:push` deshabilitado, `db:verificar` como red de seguridad, línea base de
  migraciones puesta.
- Variables en Vercel (Production): `CAFECITO_TOKEN`, `CAFECITO_FROM_EMAIL`,
  `NEXT_PUBLIC_BASE_URL`.

## BLOQUEANTE: producción apunta a otra base — confirmado

El despliegue de producción de las 00:43 UTC del 04-09-2026
(`ado-ops-digital-gilzm43k9`) murió así:

```
Error [NeonDbError]: relation "cafecito_ediciones" does not exist
  severity: 'ERROR'   code: '42P01'   file: 'parse_relation.c'
Export encountered an error on /cafecito-ia/page: /cafecito-ia, exiting the build.
```

**Ya no es una hipótesis.** Ese error lo emite el parser de Postgres, no el
driver: la conexión se abrió, se autenticó y la consulta llegó al servidor. Si
`DATABASE_URL` estuviera vacía o mal formada el error sería otro. Lo único que
falta es la tabla.

Y en la base de `.env.local` la tabla **sí existe**, y existía 43 minutos antes
de ese despliegue:

```
host: ep-nameless-mountain-atzwqsr4-pooler.c-9.us-east-1.aws.neon.tech
db:   neondb   ·   cafecito_ediciones: 0 filas   ·   cafecito_suscriptores: 0 filas
```

`npm run db:verificar` da 72 declaradas / 72 en la base, en verde.

Conclusión: **la `DATABASE_URL` de Vercel y la de `.env.local` son bases
distintas.** Producción tiene las otras 70 tablas —el sitio lleva meses
funcionando— pero no las dos de Cafecito, que se crearon el 03-09 solo en la
base local. No hay integración de Neon en el proyecto de Vercel
(`vercel integration list` → *No resources found*), así que la variable se pegó a
mano hace 74 días y desde entonces las dos copias se separaron.

### Decidido: bases separadas

Las dos bases se quedan separadas. Es el estado de facto desde siempre, y evita
que una prueba local escriba sobre datos reales de CRM, Tuniche y TorreControl.
Quedó escrito en `AGENTS.md`, y las herramientas de esquema ya saben apuntar a
cada una: `db:verificar`, `db:migrate`, `db:inventario` y
`baseline-migraciones.mjs` aceptan `--prod` (o su variante `:prod`), y todas
anuncian contra qué base van a trabajar antes de hacerlo. Desarrollo es el
destino por defecto; producción cuesta un flag explícito.

Se descartó el atajo de cambiar `DATABASE_URL` en Vercel por la de `.env.local`:
arreglaría el síntoma, pero le cambiaría la fuente de datos a todo el sitio de
golpe hacia una base que nadie verificó que tenga los datos de producción.

### Qué falta, y solo tú puedes hacerlo

El valor de la `DATABASE_URL` de producción es Secret en Vercel y no se puede
leer de vuelta, ni con `vercel env pull` (ver `AGENTS.md`). Sale de la consola de
Neon. Los cinco pasos, en orden:

1. **Pegar la cadena en `.env.local`** (la de producción, con pooler), como
   `DATABASE_URL_PRODUCCION`. El archivo está en `.gitignore`; no se sube.

2. **Ver qué le falta a producción.** Debería reportar las dos tablas de Cafecito
   como declaradas que aún no existen:

   ```bash
   npm run db:verificar:prod
   ```

3. **Crear las tablas allá.** Idempotente, solo `CREATE ... IF NOT EXISTS`:

   ```bash
   psql "$DATABASE_URL_PRODUCCION" -f drizzle/manual/cafecito.sql
   ```

   Repetir el paso 2: tiene que quedar en verde.

4. **Poner la línea base en producción.** Nació con `push`, así que no tiene
   historial de migraciones; sin línea base, el primer `db:migrate:prod`
   intentaría correr los 72 `CREATE TABLE` de la `0000` sobre tablas que ya
   existen y fallaría. Primero sin `--aplicar`, que solo muestra qué haría:

   ```bash
   node scripts/baseline-migraciones.mjs --prod
   node scripts/baseline-migraciones.mjs --prod --aplicar
   ```

5. **Desplegar.** El commit ya está hecho pero no empujado, porque empujar a
   `main` despliega a producción:

   ```bash
   git push origin main
   ```

   Con los pasos 1 a 4 hechos, `/cafecito-ia` sale funcionando. Sin ellos el
   despliegue **igual pasa** —eso es lo que se arregló— pero `/cafecito-ia` se ve
   vacía y el log de Vercel dice `[cafecito] listarEdiciones — la base no
   respondió`.

### Ya no puede tumbar el despliegue

Las cinco lecturas de Cafecito —índice, edición, imagen OG, RSS y sitemap—
pasaron a `lib/cafecito/consultas.ts`, cada una con su try/catch.

**Verificado**, no supuesto: se corrió `npm run build` con una `DATABASE_URL`
apuntando a una base inexistente. Las tres consultas del build fallaron, cada
una registró su `[cafecito] … — la base no respondió`, y el build **terminó
bien**, con las 36 páginas generadas. Un módulo nuevo ya no se lleva puesto el
despliegue completo.

Lo que esto NO arregla: mientras producción siga sin las tablas, `/cafecito-ia`
se verá vacía y el log de Vercel dirá `[cafecito] listarEdiciones — la base no
respondió`. Ese mensaje es el termómetro: cuando desaparezca, las dos bases
quedaron alineadas.

## Después del despliegue

1. Verificar en producción: `/cafecito-ia`, `/sitemap.xml`, `/robots.txt`,
   `/cafecito-ia/rss.xml` y `/cafecito-ia/<slug>/opengraph-image`.
2. Probar el ciclo completo de suscripción: correo → confirmar → elegir taza.
   El correo de confirmación sale por Brevo con `BREVO_API_KEY`, que ya está en
   Vercel.
3. Desde el otro repo, `npm run despachar` publica el flat white en el sitio y
   manda las tres ediciones con su enlace de baja.

## Ideas que quedaron fuera

- Panel para ver suscriptores (hoy se consultan por SQL).
- Mover `messages` y `memories` a su propio esquema de Postgres. Ver
  `db/externas.ts`.
- Decidir si se borran las cuatro columnas heredadas (`crm_showroom_visitas.con_cita`
  y `.sala_id`, `lead_empresas.grupo` y `.grupo_metodo`). Tienen datos; requiere
  una migración explícita.

---

# Pendiente: SEO y analítica

Estado al 03-09-2026, 21:30.

## Vercel Web Analytics — falta el código

Ya está **habilitado en el panel** de Vercel (plan Pro, incluido; se cobra solo
por sobre 1M de eventos). Falta la parte del repo, que son dos pasos:

```bash
npm i @vercel/analytics
```

Y en `app/layout.tsx`, dentro del `<body>`:

```tsx
import { Analytics } from "@vercel/analytics/next";
// ...
<Analytics />
```

Se eligió Vercel Analytics **en vez de GA4** a propósito: no usa cookies ni
identificadores personales, así que no necesita banner de consentimiento —
relevante porque el boletín puede atraer lectores europeos. Además los
bloqueadores de anuncios no lo omiten, así que los números vienen completos.

Si algún día se quiere GA4 para integrar con Google Ads, hay que construir el
banner de consentimiento antes. No es opcional.

## Search Console — bloqueado por el DNS

La propiedad `adoops.digital` está **creada y pendiente de verificación**, del
tipo **Dominio** (cubre www, apex, subdominios y ambos protocolos de una vez).

Hay que crear este registro:

```
Tipo:   TXT
Nombre: @   (raíz del dominio)
Valor:  google-site-verification=YZW6IBeORf30DL1ojPzG0hixDQIMZkT1uaBuD35OOn4
TTL:    1 hora
```

**Dónde: NO en Vercel.** El panel de dominios muestra `Registrar: Third Party` y
`Nameservers: Third Party`, y Google detecta GoDaddy. El DNS lo administra un
tercero, no Vercel.

Vercel ofrece un botón "Enable Vercel DNS" — **no usarlo sin pensarlo**. Cambia
los nameservers y se lleva por delante cualquier registro que hoy viva en el
proveedor actual: correo (MX), verificaciones de otros servicios, subdominios.
Migrar el DNS a Vercel puede ser buena idea, pero es un proyecto con su propia
checklist, no un paso de este trámite.

Una vez propagado el TXT, en Search Console se pulsa Verificar.

## Después de verificar

1. Enviar el sitemap: `https://www.adoops.digital/sitemap.xml`. **Solo cuando el
   sitio esté desplegado y `/cafecito-ia` responda** — si se envía antes, Google
   registra las URLs como error y tarda en reintentarlas.
2. Pedir indexación de `/cafecito-ia` desde la Inspección de URL.
3. Revisar en Search Console que el canónico detectado sea
   `https://www.adoops.digital/...`. Si aparece la apex, quedó algo apuntando al
   dominio viejo (ver `lib/site.ts`).

## Contexto de la URL canónica

`adoops.digital` redirige 308 a `www.adoops.digital`. Durante un tiempo el
código declaró la apex como canónica en ocho archivos distintos, cada uno con su
propio valor por defecto. Ahora hay una sola fuente: `lib/site.ts`, fijada en
`https://www.adoops.digital`, y `NEXT_PUBLIC_BASE_URL` en Vercel dice lo mismo.

Si algún día se invierte la redirección, se cambia en esos dos lugares y en
ninguno más.
