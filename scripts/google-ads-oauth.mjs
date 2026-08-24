// Genera el refresh token de Google Ads API sin pasar por el OAuth Playground.
//
// **Por qué existe.** El Playground funciona, pero obliga a crear un cliente OAuth
// de tipo «Web», agregarle a mano la redirect URI del Playground y marcar una
// casilla escondida detrás de un engranaje. Es el paso donde más gente se
// atasca y el que produce el error `redirect_uri_mismatch`, que no dice nada
// sobre su causa.
//
// Este script usa el flujo de bucle invertido (loopback) que Google recomienda
// para clientes de escritorio: levanta un servidor local, abre el navegador,
// recibe el código y lo canjea. Los clientes «Aplicación de escritorio» aceptan
// `http://localhost` en cualquier puerto sin configurar nada.
//
// El refresh token **se imprime en pantalla y no se guarda en disco**: va
// directo a las variables de entorno de Vercel. Un archivo con un token de
// larga vida en la carpeta del proyecto es un accidente esperando a pasar.
//
// Uso:
//   GOOGLE_ADS_CLIENT_ID=... GOOGLE_ADS_CLIENT_SECRET=... node scripts/google-ads-oauth.mjs

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const SCOPE = "https://www.googleapis.com/auth/adwords";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Faltan GOOGLE_ADS_CLIENT_ID y/o GOOGLE_ADS_CLIENT_SECRET.\n\n" +
      "  GOOGLE_ADS_CLIENT_ID=... GOOGLE_ADS_CLIENT_SECRET=... node scripts/google-ads-oauth.mjs",
  );
  process.exit(1);
}

const PUERTO = 8765;
const REDIRECT = `http://localhost:${PUERTO}`;
// `state` protege contra que otra pestaña del navegador complete este flujo.
const estado = randomBytes(16).toString("hex");

const url =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    // `offline` pide el refresh token; `consent` fuerza la pantalla de permisos
    // para que Google lo devuelva incluso si esta cuenta ya autorizó antes.
    // Sin `consent`, una segunda ejecución devuelve access token y nada más.
    access_type: "offline",
    prompt: "consent",
    state: estado,
  });

const servidor = createServer(async (req, res) => {
  const entrante = new URL(req.url, REDIRECT);
  if (entrante.pathname !== "/") {
    res.writeHead(404).end();
    return;
  }

  const responder = (titulo, detalle) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(
      `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:3rem;max-width:34rem;margin:auto">
       <h2>${titulo}</h2><p style="color:#444">${detalle}</p></body>`,
    );
  };

  const error = entrante.searchParams.get("error");
  if (error) {
    responder("Autorización cancelada", `Google devolvió: ${error}`);
    console.error(`\n✗ Google devolvió el error: ${error}`);
    servidor.close();
    process.exit(1);
  }

  if (entrante.searchParams.get("state") !== estado) {
    responder("Estado inválido", "La respuesta no corresponde a esta sesión.");
    console.error("\n✗ El parámetro `state` no coincide. Se descarta la respuesta.");
    servidor.close();
    process.exit(1);
  }

  const code = entrante.searchParams.get("code");
  if (!code) {
    responder("Sin código", "Google no devolvió un código de autorización.");
    servidor.close();
    process.exit(1);
  }

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });

  const datos = await r.json();

  if (!r.ok || !datos.refresh_token) {
    responder("No se pudo obtener el refresh token", "Revisa la terminal.");
    console.error("\n✗ Respuesta de Google:", JSON.stringify(datos, null, 2));
    if (r.ok && !datos.refresh_token) {
      console.error(
        "\nGoogle devolvió tokens pero sin refresh_token. Suele pasar cuando la\n" +
          "cuenta ya autorizó esta aplicación antes. Revoca el acceso en\n" +
          "https://myaccount.google.com/permissions y vuelve a ejecutar.",
      );
    }
    servidor.close();
    process.exit(1);
  }

  responder(
    "Listo, ya puedes cerrar esta pestaña",
    "El refresh token quedó impreso en la terminal.",
  );

  console.log("\n✓ Refresh token obtenido:\n");
  console.log(datos.refresh_token);
  console.log(
    "\nGuárdalo en Vercel como GOOGLE_ADS_REFRESH_TOKEN. No lo dejes en un archivo del proyecto.",
  );
  servidor.close();
  process.exit(0);
});

servidor.listen(PUERTO, () => {
  console.log("Abriendo el navegador para autorizar…");
  console.log(`Si no se abre solo, entra a:\n\n${url}\n`);
  // `open` es de macOS; en Linux sería `xdg-open`. Si falla, queda la URL de arriba.
  spawn("open", [url], { stdio: "ignore", detached: true }).on("error", () => {});
});
