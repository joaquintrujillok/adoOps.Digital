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

## Resuelto: el build de producción caía por orden, no por configuración

**Estado: desplegado y funcionando** desde el 04-09-2026 01:29 UTC
(`ado-ops-digital-m075010v7`). `/cafecito-ia`, `/sitemap.xml`, `/robots.txt` y
`/cafecito-ia/rss.xml` responden 200.

### Qué pasó de verdad

El despliegue de las 00:43 UTC murió con:

```
Error [NeonDbError]: relation "cafecito_ediciones" does not exist
  severity: 'ERROR'   code: '42P01'   file: 'parse_relation.c'
Export encountered an error on /cafecito-ia/page: /cafecito-ia, exiting the build.
```

Se sospechó que la `DATABASE_URL` de Vercel apuntaba a otra base. **Era falso.**
Hay **una sola base**, y se comprobó escribiendo una fila desde local y pidiendo
`https://www.adoops.digital/cafecito-ia/<slug>` en producción: respondió 200. La
fila se borró enseguida; la tabla quedó en 0 filas.

La causa real es de orden, no de configuración: el build corrió **antes** de que
las tablas de Cafecito existieran. Como es una sola base, crearlas localmente ya
las crea en producción, y el despliegue solo tenía que llegar después. Llegó
antes.

Es una causa más aburrida que la hipótesis, pero mucho más fácil de repetir: se
repite cada vez que alguien empuja código que lee una tabla que todavía no creó.
Por eso quedó escrito en `AGENTS.md` como regla de orden — tablas primero,
despliegue después — y no como una anécdota.

### Lo que sí quedó, y vale igual

Las cinco lecturas de Cafecito —índice, edición, imagen OG, RSS y sitemap— están
en `lib/cafecito/consultas.ts`, cada una con su try/catch y un log marcado
`[cafecito]`.

Esto no depende de cuántas bases haya: el problema de fondo era que Next
prerenderiza `/cafecito-ia` en el build, así que **una consulta de un módulo
nuevo podía tumbar el despliegue del sitio entero**, CRM y Tuniche incluidos.
Verificado corriendo `npm run build` contra una base inexistente: las consultas
fallaron, quedaron registradas, y las 36 páginas se generaron igual.

Si algún día `/cafecito-ia` sale vacía, el termómetro es el log de Vercel: si
dice `[cafecito] listarEdiciones — la base no respondió`, el problema es la base;
si no dice nada, es que no hay ediciones publicadas.

### Lo que se probó y se descartó

Se llegó a documentar en `AGENTS.md` un modelo de dos bases separadas, con
`--prod` en `db:verificar`, `db:migrate`, `db:inventario` y
`baseline-migraciones.mjs`. Todo eso se revirtió al comprobar que la base es una
sola: herramientas que ofrecen apuntar a una base que no existe confunden más de
lo que ayudan, y una afirmación falsa en `AGENTS.md` es exactamente el tipo de
cosa que causó el susto del 03-09.

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
