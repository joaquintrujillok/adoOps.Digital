#!/usr/bin/env node
// Despliegue a producción con freno.
//
// ── Por qué existe ───────────────────────────────────────────────────────────
//
// `vercel --prod` sube la CARPETA LOCAL, no el commit de `main`. Corrido desde
// un clon que no se ha traído los últimos cambios, despliega código viejo y
// reapunta el dominio a él: producción retrocede sin que nada falle.
//
// Pasó el 25-08-2026. El motor de nurturing desapareció de producción minutos
// después de haberlo verificado funcionando, y el diagnóstico costó porque la
// combinación es engañosa: la base seguía con las tablas nuevas, el deploy
// decía "Ready in 32s", y el único síntoma era que las rutas devolvían 404.
//
// El error real no fue teclear el comando: fue que nada avisó. Este script es
// ese aviso, y es la razón por la que existe en vez de una línea en un README
// que nadie lee con el terminal abierto.
//
//   npm run desplegar          verifica y despliega
//   npm run desplegar -- --pull   se pone al día primero, y después verifica
//
// Lo que NO hace: no despliega igual "porque es urgente". Un despliegue que
// retrocede producción no se arregla apurándose.

import { execFileSync, spawnSync } from "node:child_process";

const PULL = process.argv.includes("--pull");
const RAMA_PRODUCCION = "main";

const c = {
  rojo: (s) => `\x1b[31m${s}\x1b[0m`,
  verde: (s) => `\x1b[32m${s}\x1b[0m`,
  ambar: (s) => `\x1b[33m${s}\x1b[0m`,
  gris: (s) => `\x1b[90m${s}\x1b[0m`,
  fuerte: (s) => `\x1b[1m${s}\x1b[0m`,
};

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function abortar(titulo, ...detalle) {
  console.error(`\n${c.rojo("✖")} ${c.fuerte(titulo)}\n`);
  for (const linea of detalle) console.error(`  ${linea}`);
  console.error("");
  process.exit(1);
}

// ─── 1. La rama ──────────────────────────────────────────────────────────────

const rama = git("rev-parse", "--abbrev-ref", "HEAD");
if (rama !== RAMA_PRODUCCION) {
  abortar(
    `Estás en "${rama}", no en ${RAMA_PRODUCCION}`,
    `Producción sirve lo que hay en ${RAMA_PRODUCCION}. Desplegar desde otra rama`,
    "sube código que nadie revisó y que no está en el historial de la rama.",
    "",
    c.gris(`  git checkout ${RAMA_PRODUCCION}`),
  );
}

// ─── 2. El árbol de trabajo ──────────────────────────────────────────────────

const sucio = git("status", "--porcelain");
if (sucio) {
  abortar(
    "Hay cambios sin commitear",
    "`vercel --prod` los subiría a producción sin que existan en GitHub.",
    "Nadie podría reconstruir después qué está corriendo.",
    "",
    ...sucio.split("\n").slice(0, 10).map((l) => c.gris(`  ${l}`)),
    sucio.split("\n").length > 10 ? c.gris(`  … y ${sucio.split("\n").length - 10} más`) : "",
  );
}

// ─── 3. Contra el remoto ─────────────────────────────────────────────────────

console.log(c.gris(`Consultando origin/${RAMA_PRODUCCION}…`));
try {
  execFileSync("git", ["fetch", "--quiet", "origin", RAMA_PRODUCCION], { stdio: "inherit" });
} catch {
  abortar(
    "No pude consultar el remoto",
    "Sin saber qué hay en GitHub no se puede afirmar que el clon esté al día,",
    "y desplegar a ciegas es exactamente lo que este script existe para evitar.",
  );
}

const local = git("rev-parse", "HEAD");
const remoto = git("rev-parse", `origin/${RAMA_PRODUCCION}`);

if (local !== remoto) {
  const atras = Number(git("rev-list", "--count", `HEAD..origin/${RAMA_PRODUCCION}`));
  const adelante = Number(git("rev-list", "--count", `origin/${RAMA_PRODUCCION}..HEAD`));

  if (atras > 0 && PULL && adelante === 0) {
    console.log(c.ambar(`↓ Tu clon está ${atras} commit(s) atrás. Trayendo…`));
    execFileSync("git", ["pull", "--ff-only", "origin", RAMA_PRODUCCION], { stdio: "inherit" });
  } else if (adelante > 0) {
    abortar(
      `Tienes ${adelante} commit(s) que no están en GitHub`,
      "Desplegarlos dejaría producción corriendo código que no existe en el",
      "repositorio. Empújalos primero: al llegar a main, la integración de Git",
      "despliega sola y este comando ni siquiera hace falta.",
      "",
      c.gris(`  git push origin ${RAMA_PRODUCCION}`),
    );
  } else {
    abortar(
      `Tu clon está ${atras} commit(s) atrás de origin/${RAMA_PRODUCCION}`,
      "Desplegar ahora subiría código viejo y haría RETROCEDER producción.",
      "Es exactamente lo que pasó el 25-08-2026.",
      "",
      c.gris("  git pull --ff-only origin main"),
      c.gris("  npm run desplegar -- --pull      (hace las dos cosas)"),
    );
  }
}

// ─── 4. Recién ahora ─────────────────────────────────────────────────────────

const commit = git("log", "-1", "--pretty=%h %s");
console.log(`${c.verde("✔")} Clon al día con origin/${RAMA_PRODUCCION}`);
console.log(c.gris(`  ${commit}\n`));

// Un recordatorio, no un bloqueo: si lo único que cambió es una variable de
// entorno, este comando no es necesario. Basta Redeploy sobre el último
// deployment de Git en el dashboard, que es más rápido y no depende del clon.
console.log(
  c.ambar("Nota: "),
  "si solo cambiaste una variable de entorno, no hace falta este comando —",
);
console.log("      alcanza con Redeploy sobre el último deployment de Git.\n");

const r = spawnSync("vercel", ["--prod"], { stdio: "inherit" });

if (r.error && r.error.code === "ENOENT") {
  abortar(
    "No encontré el comando `vercel`",
    "Las verificaciones pasaron: el clon está al día y el árbol limpio.",
    "Falta el CLI, o basta con empujar a main y dejar que despliegue Git.",
    "",
    c.gris("  npm i -g vercel        y volver a correr esto"),
    c.gris("  git push origin main   y la integración despliega sola"),
  );
}

process.exit(r.status ?? 1);
