# La base de datos

Neon Postgres, con Drizzle como ORM. Una particularidad que manda sobre todo lo
demás: **esta base la comparten varios proyectos**, no solo adoOps.

## Lo que pasó el 3 de septiembre de 2026

Un `drizzle-kit push` rutinario propuso borrar 14 tablas con datos reales —
Tuniche completo, el CRM de ventas, `conocimiento_trozos` con 319 registros,
reuniones — más cuatro columnas con cientos de filas.

No fue un bug de drizzle. `push` hace exactamente lo que promete: deja la base
idéntica al esquema. El problema era que `db/schema.ts` solo reexportaba 5 de los
10 archivos de `db/`, y drizzle-kit **únicamente lee `schema.ts`**. Todo lo que no
llega ahí no existe para él, y lo que no existe en el esquema sobra en la base.

Se abortó a tiempo. De ahí salió todo lo que sigue.

## Reglas

**1. `db:push` está deshabilitado.** El script imprime por qué y sale con error.
No lo reactives: en una base compartida es cuestión de tiempo.

**2. Todo archivo nuevo en `db/` se reexporta desde `schema.ts`.** Sin esa línea,
sus tablas quedan expuestas a borrado. `db:verificar` lo detecta.

**3. Antes de cualquier migración, `npm run db:verificar`.** `db:generate` ya lo
corre solo, pero conviene tenerlo a mano.

**4. Las tablas ajenas se declaran, no se ignoran.** Ver `db/externas.ts`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run db:verificar` | compara lo declarado contra lo que existe; falla si hay diferencias |
| `npm run db:inventario` | vuelca `docs/db-inventario.md` con tablas, columnas, índices y conteos |
| `npm run db:generate` | verifica y genera el SQL de la migración (revísalo antes de aplicar) |
| `npm run db:migrate` | aplica las migraciones pendientes |
| `npm run db:baseline` | registra migraciones como aplicadas sin ejecutarlas |
| `npm run db:studio` | explorador visual |
| ~~`npm run db:push`~~ | deshabilitado a propósito |

## Puesta en marcha de las migraciones (una sola vez)

La base venía manejada con `push`, o sea sin historial. Para pasar a migraciones
versionadas hay que sentar una línea base, porque la primera migración que genera
drizzle incluye un `CREATE TABLE` por cada tabla del esquema — también las 70 que
ya existen.

```bash
# 1. Que la base tenga TODO lo que el esquema declara.
psql "$DATABASE_URL" -f drizzle/manual/cafecito.sql
npm run db:verificar          # tiene que salir en verde

# 2. Generar la migración inicial (72 CREATE TABLE: es lo esperado).
npm run db:generate

# 3. Registrarla como aplicada SIN ejecutarla.
npm run db:baseline           # muestra qué haría
node scripts/baseline-migraciones.mjs --aplicar

# 4. Desde acá, el flujo normal.
npm run db:generate && npm run db:migrate
```

`drizzle/manual/` guarda SQL escrito a mano, fuera del historial de migraciones.
Se usa solo para la puesta en marcha; una vez sentada la línea base, todo cambio
de esquema pasa por `db:generate`.

## Estado

70 tablas en `public`, 72 declaradas (las dos de Cafecito esperan migración).
`docs/db-inventario.md` tiene el detalle completo, regenerable con
`npm run db:inventario`.

Por dominio:

| Archivo | Tablas | Qué es |
|---|---:|---|
| `db/schema.ts` | 9 | web corporativa, actas, mantención, mix |
| `db/crm.ts` | 26 | CRM de audio (showroom, cotizaciones, WhatsApp) |
| `db/leads.ts` | 10 | motor de nurturing |
| `db/tuniche.ts` | 7 | sistema de terreno agrícola |
| `db/dashboard360.ts` | 6 | dashboard de mercado |
| `db/venta.ts` | 4 | pipeline comercial |
| `db/contenido.ts` | 3 | publicación de contenido |
| `db/cafecito.ts` | 2 | boletín Cafecito IA |
| `db/reuniones.ts` | 2 | registros y compromisos |
| `db/externas.ts` | 2 | **de otros proyectos**, solo protegidas |
| `db/conocimiento.ts` | 1 | trozos indexados |
