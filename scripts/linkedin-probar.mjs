// Responde la única pregunta que quedó abierta en docs/verificacion-share-on-linkedin.md:
// ¿la Posts API acepta publicar como *persona* con un token que solo tiene el
// `w_member_social` de autoservicio, o exige ser partner aprobado?
//
// **Por qué existe.** La tabla de permisos de la Posts API lista `w_member_social`,
// lo que dice que sí. Pero esa API vive en el espacio de *community management*
// de Marketing, donde casi todo lo demás exige aprobación. La documentación no
// alcanza para decidirlo: hay que disparar un POST real y mirar el código.
// De eso depende si la máquina de contenido se construye sobre `/rest/posts` o
// sobre la ruta vieja `/v2/ugcPosts`.
//
// **No hace falta configurar OAuth para esto.** El portal tiene un generador de
// tokens que evita registrar una redirect URL:
//   https://www.linkedin.com/developers/tools/oauth/token-generator
// Se elige la app, se marcan los scopes `openid profile w_member_social`, el
// miembro aprueba, y se copia el token. Ojo: el token sale a nombre de *quien
// esté con sesión iniciada*, y esa cuenta tiene que ser admin de la app. Para
// que la prueba valga, tiene que ser la cuenta que después va a publicar.
//
// **Por defecto no publica nada.** Sin `--publicar` valida el token, resuelve
// quién es el miembro y muestra el cuerpo exacto que enviaría. Publicar en
// LinkedIn es irreversible hacia afuera: que ocurra tiene que ser una decisión,
// no el resultado de correr un script sin leerlo.
//
// Uso:
//   LINKEDIN_TOKEN=... node scripts/linkedin-probar.mjs
//   LINKEDIN_TOKEN=... node scripts/linkedin-probar.mjs --publicar --borrar

const TOKEN = process.env.LINKEDIN_TOKEN;

// El header `Linkedin-Version` caduca. La 202508 se apagó el 17-08-2026; el ciclo
// es de unos doce meses. Cuando esta deje de servir, el síntoma es un 426 o un
// 400 que no menciona la versión — de ahí que la fecha esté escrita aquí.
const VERSION = process.env.LINKEDIN_VERSION || "202608";

const publicar = process.argv.includes("--publicar");
const borrar = process.argv.includes("--borrar");

if (!TOKEN) {
  console.error(
    "Falta LINKEDIN_TOKEN.\n\n" +
      "Generalo en https://www.linkedin.com/developers/tools/oauth/token-generator\n" +
      "con los scopes: openid profile w_member_social\n\n" +
      "  LINKEDIN_TOKEN=... node scripts/linkedin-probar.mjs",
  );
  process.exit(1);
}

const texto =
  "Prueba técnica de integración. Se borra en unos minutos. " +
  "— adOps (" + new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC)";

// ── Paso 1: quién es el miembro ───────────────────────────────────────────────
// El `sub` de OpenID Connect es el id del miembro. Es la única forma autoservicio
// de armar el `urn:li:person:{id}`: `/v2/me` exige permisos que no tenemos.

const infoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
  headers: { authorization: `Bearer ${TOKEN}` },
});
const info = await infoRes.json().catch(() => ({}));

if (!infoRes.ok) {
  console.error(`\n✗ /v2/userinfo devolvió ${infoRes.status}:`);
  console.error(JSON.stringify(info, null, 2));
  console.error(
    "\n401 suele ser token vencido o mal copiado (duran 60 días).\n" +
      "403 suele ser que falta el producto «Sign in with LinkedIn using OpenID\n" +
      "Connect», o que el token se generó sin el scope `profile`.",
  );
  process.exit(1);
}

const autor = `urn:li:person:${info.sub}`;
console.log(`\nMiembro autenticado: ${info.name ?? "(sin nombre)"}`);
console.log(`Autor que se usará:  ${autor}`);
console.log(`Versión de API:      ${VERSION}`);

// ── Paso 2: el cuerpo ─────────────────────────────────────────────────────────
// `CONNECTIONS` en vez de `PUBLIC` a propósito: una cuenta nueva casi no tiene
// conexiones, así que la prueba es efectivamente invisible. `PUBLIC` la dejaría
// en el feed abierto, y el primer contenido del perfil no debería ser una prueba.

const cuerpo = {
  author: autor,
  commentary: texto,
  visibility: "CONNECTIONS",
  distribution: {
    feedDistribution: "MAIN_FEED",
    targetEntities: [],
    thirdPartyDistributionChannels: [],
  },
  lifecycleState: "PUBLISHED",
  isReshareDisabledByAuthor: false,
};

if (!publicar) {
  console.log("\n── Ensayo, no se publicó nada ──");
  console.log("\nEl token sirve y el autor se resolvió. Cuerpo que se enviaría a");
  console.log("POST https://api.linkedin.com/rest/posts\n");
  console.log(JSON.stringify(cuerpo, null, 2));
  console.log("\nPara disparar la prueba de verdad:");
  console.log("  LINKEDIN_TOKEN=... node scripts/linkedin-probar.mjs --publicar --borrar");
  process.exit(0);
}

// ── Paso 3: la prueba ─────────────────────────────────────────────────────────

console.log("\nPublicando en /rest/posts…");

const res = await fetch("https://api.linkedin.com/rest/posts", {
  method: "POST",
  headers: {
    authorization: `Bearer ${TOKEN}`,
    "content-type": "application/json",
    "x-restli-protocol-version": "2.0.0",
    "linkedin-version": VERSION,
  },
  body: JSON.stringify(cuerpo),
});

if (res.ok) {
  const urn = res.headers.get("x-restli-id");
  console.log(`\n✓ ${res.status}. La Posts API acepta autor persona con w_member_social.`);
  console.log(`\n  URN: ${urn}`);
  console.log("\nEse URN es lo único que después identifica la publicación, y no se");
  console.log("puede recuperar preguntándole a LinkedIn: `r_member_social` es");
  console.log("restringido. La tubería tiene que guardarlo al recibir el 201.");
  console.log("\n→ Construir la Fase 1 sobre POST /rest/posts.");
  if (borrar) await borrarPost(urn);
  process.exit(0);
}

const err = await res.text();
console.error(`\n✗ /rest/posts devolvió ${res.status}:`);
console.error(err);

// Un 403 acá es el escenario que este script existe para detectar: significa que
// la Posts API está reservada a partners y que el autoservicio solo alcanza para
// la ruta vieja. Se prueba en el acto, porque saberlo cambia el diseño entero.
if (res.status !== 403) {
  console.error("\nNo es un 403, así que no es un problema de permisos. Revisar el cuerpo,");
  console.error(`la versión (${VERSION}) o el token antes de concluir nada.`);
  process.exit(1);
}

console.log("\nProbando el respaldo /v2/ugcPosts…");

const legacy = await fetch("https://api.linkedin.com/v2/ugcPosts", {
  method: "POST",
  headers: {
    authorization: `Bearer ${TOKEN}`,
    "content-type": "application/json",
    "x-restli-protocol-version": "2.0.0",
  },
  body: JSON.stringify({
    author: autor,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: texto },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "CONNECTIONS" },
  }),
});

if (!legacy.ok) {
  console.error(`\n✗ /v2/ugcPosts también falló (${legacy.status}):`);
  console.error(await legacy.text());
  console.error(
    "\nLos dos caminos cerrados. Antes de dar por muerto el plan A, verificar en\n" +
      "el portal que la app tenga el producto «Share on LinkedIn» activo y que el\n" +
      "token se haya generado con el scope `w_member_social`.",
  );
  process.exit(1);
}

const urnLegacy = legacy.headers.get("x-restli-id");
console.log(`\n✓ ${legacy.status} en /v2/ugcPosts. URN: ${urnLegacy}`);
console.log("\n→ La Posts API exige partner. Construir la Fase 1 sobre /v2/ugcPosts,");
console.log("  que es la ruta vieja: sirve hoy, pero está declarada reemplazada.");
console.log("  Hay que dejar registrado que la tubería corre sobre algo con fecha");
console.log("  de vencimiento no anunciada.");
if (borrar) await borrarPost(urnLegacy, true);

// ── Limpieza ──────────────────────────────────────────────────────────────────

async function borrarPost(urn, legacy = false) {
  if (!urn) {
    console.log("\n⚠ No vino el header x-restli-id: hay que borrar la prueba a mano.");
    return;
  }
  const base = legacy
    ? "https://api.linkedin.com/v2/ugcPosts/"
    : "https://api.linkedin.com/rest/posts/";
  const headers = {
    authorization: `Bearer ${TOKEN}`,
    "x-restli-protocol-version": "2.0.0",
    "x-restli-method": "DELETE",
  };
  if (!legacy) headers["linkedin-version"] = VERSION;

  const r = await fetch(base + encodeURIComponent(urn), { method: "DELETE", headers });
  // El borrado es idempotente y devuelve 204 sin cuerpo.
  if (r.ok) console.log("\n✓ Publicación de prueba borrada.");
  else console.log(`\n⚠ No se pudo borrar (${r.status}). Hay que hacerlo a mano en el perfil.`);
}
