import { loadEnvConfig } from "@next/env";
import type { Config } from "drizzle-kit";

loadEnvConfig(process.cwd());

/**
 * Este repo trabaja con dos bases de Neon separadas (ver AGENTS.md):
 * `DATABASE_URL` es desarrollo y `DATABASE_URL_PRODUCCION` es producción.
 *
 * Desarrollo es el destino por defecto y producción hay que pedirla en voz
 * alta, con `BASE=produccion`. Equivocarse de base tiene que costar una
 * declaración explícita, no un olvido: `npm run db:migrate:prod` la pone.
 */
const aProduccion = process.env.BASE === "produccion";
const variable = aProduccion ? "DATABASE_URL_PRODUCCION" : "DATABASE_URL";
const url = process.env[variable];

if (!url) {
  throw new Error(
    `Falta ${variable} en .env.local.` +
      (aProduccion
        ? " No se puede sacar de Vercel: 'vercel env pull' devuelve el valor vacío" +
          " en este proyecto (ver AGENTS.md). Sácalo de la consola de Neon."
        : ""),
  );
}

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
} satisfies Config;
