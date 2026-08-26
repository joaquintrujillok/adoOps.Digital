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

- **There is one database.** `db/index.ts` opens a single `DATABASE_URL`. The
  prospecting engine, the CRM, TorreControl and TV Mix all write to the same Neon
  database, separated by table prefix (`lead_*`, `crm_*`, `d360_*`) and **not by
  environment**. There is no demo database that test records cannot escape from.
  This is why every module must declare itself and mark itself on screen.
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
