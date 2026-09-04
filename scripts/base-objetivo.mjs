// Resuelve contra QUÉ base corre una herramienta de esquema.
//
// ── Por qué existe ───────────────────────────────────────────────────────────
//
// Este repo trabaja con dos bases de Neon separadas: la de desarrollo, que vive
// en `DATABASE_URL`, y la de producción, que vive en `DATABASE_URL_PRODUCCION`.
// Ver AGENTS.md.
//
// El 04-09-2026 un despliegue murió con `42P01: relation "cafecito_ediciones"
// does not exist`: las tablas se habían creado solo en desarrollo. Nadie se
// equivocó — sencillamente no había forma de apuntar `db:verificar` a la otra
// base para notarlo. Esto la da.
//
// La regla de diseño: desarrollo es el destino por defecto y producción hay que
// pedirla en voz alta, con `--prod`. Equivocarse de base tiene que costar un
// flag explícito, no un olvido.

import { readFileSync } from "node:fs";

/** Lee .env.local sin dependencias: @next/env es CommonJS y no importa limpio. */
export function cargarEnv() {
  for (const f of [".env.local", ".env"]) {
    let s;
    try { s = readFileSync(f, "utf8"); } catch { continue; }
    for (const linea of s.split("\n")) {
      const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

/** `postgresql://user:clave@host/base?…` → `host · base`, sin la contraseña. */
export function describir(url) {
  try {
    const u = new URL(url);
    return `${u.hostname} · ${u.pathname.replace(/^\//, "")}`;
  } catch {
    return "(URL ilegible)";
  }
}

/**
 * Devuelve { url, nombre } según los argumentos. `--prod` elige producción.
 * Si falta la variable, explica cómo conseguirla en vez de reventar con undefined.
 */
export function baseObjetivo(argv = process.argv) {
  const prod = argv.includes("--prod") || process.env.BASE === "produccion";
  const variable = prod ? "DATABASE_URL_PRODUCCION" : "DATABASE_URL";
  const url = process.env[variable];

  if (!url) {
    console.error(`\n  Falta ${variable} en .env.local.\n`);
    if (prod) {
      console.error(`  El valor NO se puede sacar de Vercel: 'vercel env pull' devuelve`);
      console.error(`  los nombres con el valor vacío en este proyecto (ver AGENTS.md).`);
      console.error(`  Sácalo de la consola de Neon: la cadena de conexión con pooler`);
      console.error(`  de la base que usa producción, y pégalo en .env.local.\n`);
    }
    process.exit(1);
  }

  return { url, nombre: prod ? "PRODUCCIÓN" : "desarrollo", prod };
}

/** Deja por escrito contra qué base se está trabajando, antes de trabajar. */
export function anunciar(base, accion) {
  const marca = base.prod ? "⚠️  " : "";
  console.log(`\n${marca}${accion} · base de ${base.nombre}`);
  console.log(`   ${describir(base.url)}\n`);
}
