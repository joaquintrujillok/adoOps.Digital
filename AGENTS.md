<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Repository and deployment

- GitHub repository: `joaquintrujillok/adoOps.Digital`
- The `origin` remote is already configured for this repository.
- Do not ask the user to configure or identify the GitHub repository again.
- Production deployments are triggered by pushing the intended release changes to `main`.
- **Never tell anyone to run `vercel --prod` to pick up a changed environment
  variable.** That command deploys the *local working directory*, not the commit
  on `main`. Run from a clone that has not been pulled, it silently ships stale
  code and re-aliases the domain to it — production rolls back, and the only
  symptom is routes returning 404. It happened on 25-08-2026: the motor
  disappeared from production minutes after it had been verified working.
  To pick up an env-var change, use **Redeploy** on the latest *Git* deployment
  in the Vercel dashboard, or push a commit to `main`. Both redeploy the commit,
  not the folder.
- When a CLI deploy really is the right tool, run `npm run desplegar`. It refuses
  to deploy from a stale clone, a dirty tree, a non-`main` branch, or commits
  that are not on GitHub yet — the four ways `vercel --prod` ships something
  other than what `main` says. `npm run al-dia` just pulls.

## Modules: what is a demo and what is production

- **There is one database.** `db/index.ts` opens a single `DATABASE_URL`, and
  local development and production point at the same Neon database — verified on
  04-09-2026 by writing a row locally and reading it back from
  `www.adoops.digital`. The prospecting engine, the CRM, TorreControl and TV Mix
  all write to it, separated by table prefix (`lead_*`, `crm_*`, `d360_*`) and
  **not by environment**. There is no demo database that test records cannot
  escape from, and no staging copy: a local script writing to `DATABASE_URL` is
  writing to production. This is why every module must declare itself and mark
  itself on screen.
- **A schema change is live before the code that needs it is.** Because there is
  one database, `CREATE TABLE` run locally takes effect in production
  immediately, and a deploy is only the code catching up. The order matters, and
  getting it backwards has already cost a deploy: on 04-09-2026 a production
  build died with `42P01: relation "cafecito_ediciones" does not exist` because
  the build ran *before* those tables were created. Create the tables first, then
  push.
- **A read added to a prerendered page must not be able to fail the build.** That
  same `42P01` did not just blank out the newsletter — Next prerenders
  `/cafecito-ia` at build time, so one missing table took down the deploy of the
  entire site, CRM and Tuniche included. See `lib/cafecito/consultas.ts`: every
  read is wrapped, logs under a recognizable prefix, and returns empty. A new
  section renders blank instead of taking everything else down with it. Verified
  by running `next build` against a database that does not exist: the reads fail,
  they are logged, and the build finishes.
- **`lib/modulos.ts` is the source of truth**, not a document. Each module
  declares its state (`produccion` · `demo` · `interno` · `archivado`), where its
  data comes from, who looks at it, and why. Do not infer a module's state from
  its route, its folder, or how it looks — read the table.
- Adding a module means three things: a row in `MODULOS`, a `<ChipModulo>` at the
  end of its screen (or `<ChipModuloAuto />` in a layout shared by modules with
  different states), and — if it needs a session — its prefix in `AREAS` and in
  the `matcher` of `proxy.ts`. See `docs/modulos.md`.
- `demo` means **never** real people's data. If a demo starts receiving real
  data, the fix is to reclassify it, not to leave the label lying.

## Environment variables cannot be read back from Vercel

- **`vercel env pull` does not work on this project.** It returns the variable
  *names* with **empty values** — verified on 25-08-2026 against both the
  `production` and `development` environments, CLI 54.1.0. The only values that
  come back are Vercel's own (`VERCEL_*`, `TURBO_*`, `BLOB_READ_WRITE_TOKEN`).
  `Encrypted` in `vercel env ls` means "encrypted at rest", not "downloadable".
- So a fresh clone cannot recover `DATABASE_URL` from Vercel. It comes from the
  **Neon console** (connection string, pooled), pasted into `.env.local` by hand.
- **A leftover `.env.production.local` will silently break `next build`.** When
  `NODE_ENV=production`, Next loads it *before* `.env.local`, so an empty
  `DATABASE_URL` in it wins and the build fails at `Failed to collect page data`
  with `No database connection string was provided`. `next dev` works fine at the
  same time, which makes it look like a build bug. If a past `vercel env pull`
  left that file behind, move it out of the way — it holds nothing but blanks.

## Never run `drizzle-kit push` on this database

- **`npm run db:push` is deliberately disabled.** It prints why and exits 1. Do
  not re-enable it, and do not run `npx drizzle-kit push` around it.
- On 03-09-2026 a routine `push` proposed **dropping 14 tables holding real
  data** — all of Tuniche, the sales CRM, `conocimiento_trozos` with 319 rows,
  meetings — plus four columns with 78 and 200 rows. It was aborted in time.
- It was not a drizzle bug. `push` makes the database identical to the schema, so
  anything that exists and is not declared is surplus to be deleted. The cause
  was that `db/schema.ts` re-exported **5 of the 10 files** in `db/`, and
  **drizzle-kit reads `schema.ts` and nothing else**. What does not reach that
  file does not exist for it. Missing were `tuniche`, `reuniones`, `venta` and
  `conocimiento` — exactly the tables it offered to drop.
- This is a direct consequence of "There is one database" above: other projects
  share this Neon instance, so tables this repo never created still live in
  `public` and are still in `push`'s blast radius.

### The rules that follow

- **Every new file in `db/` gets an `export * from "./x"` line in
  `db/schema.ts`.** Without it, its tables are exposed to deletion.
- **`npm run db:verificar` before any migration.** It compares what is declared
  against what exists and exits 1 on any difference — including the case that
  started all this: a `db/` file that is not re-exported. `db:generate` runs it
  first, so a migration cannot be generated from an incomplete schema.
- **Foreign tables are declared, not ignored.** `messages` and `memories` belong
  to another project sharing this database and are declared in `db/externas.ts`
  mirroring their real shape. Matching the database exactly means they produce no
  diff: invisible to migrations, yet protected from deletion. Do not read or
  write them from this repo. The real fix — moving them to their own Postgres
  schema, which drizzle does not look at — is still pending.
- **Legacy columns are declared with a comment, not dropped.**
  `crm_showroom_visitas.con_cita` / `.sala_id` and `lead_empresas.grupo` /
  `.grupo_metodo` exist with data but no code reads them. Dropping them deserves
  an explicit migration and a human decision, not a side effect of a sync.

### Migration workflow

The database was managed with `push` until 03-09-2026, so it had no history. A
baseline was set that day: migration `0000` (72 `CREATE TABLE`) is recorded as
applied without ever having run, via `scripts/baseline-migraciones.mjs`.

    npm run db:verificar   # what is declared vs what exists
    npm run db:generate    # verifies, then writes a reviewable SQL file
    npm run db:migrate     # applies pending migrations

There is one database, so these commands act on production. Run them before the
deploy that needs them, never after.

`npm run db:inventario` regenerates `docs/db-inventario.md` with every table,
column, index and row count. `drizzle/manual/` holds hand-written SQL used only
for bootstrapping; it is outside the migration history and is idempotent, which
makes it the right tool for creating tables that a migration never covered.

Full context in `docs/base-de-datos.md`.
