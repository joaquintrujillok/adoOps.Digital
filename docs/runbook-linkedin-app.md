# Runbook · Habilitar la publicación por API en LinkedIn

**Para:** quien haga los trámites del portal de LinkedIn.
**Resultado:** un token que permite publicar en el perfil desde código, y la
respuesta a la pregunta técnica que quedó abierta.
**Tiempo:** una hora de trabajo propio, más la espera del super admin.
**Contexto:** `docs/verificacion-share-on-linkedin.md` explica el porqué de cada
paso. Esto es solo el cómo.

---

## Antes de tocar el portal

El motor lo opera adOps, pero **el perfil y la prospección son del cliente**. Eso
decide algo que después no se cambia sin rehacer todo: la app va bajo **la página
del cliente**, no la de adOps. La documentación de LinkedIn lo dice sin rodeos —
*«the organization that owns the Page you select will function as the publisher
of the app»*. El publisher tiene que ser quien opera la prospección.

Cuatro cosas que conviene tener a mano antes de empezar, porque el formulario las
pide todas juntas y no guarda borrador:

- ☐ **La página de LinkedIn del cliente**, y saber **quién es su super admin**.
  Si la página no existe: `linkedin.com/company/setup/new`. Sin super admin
  identificado y disponible, el trámite se queda a medias en el paso 3.
- ☐ **Un logo cuadrado**, de 100px o más por lado.
- ☐ **Una URL de política de privacidad.** Es la de la app, y va a quedar visible
  en la pantalla de permisos que ve Claudia al autorizar.
- ☐ **La cuenta de Claudia**, con sesión disponible en el navegador. En el paso 6
  el token sale a nombre de quien esté con sesión iniciada.

> Los campos exactos del formulario —nombre, página, política de privacidad,
> logo— salen de guías de terceros, no de la documentación oficial, que no los
> lista. Si el formulario pide algo más, no es un problema: se completa y se
> sigue.

---

## Paso 1 · La página del cliente

`linkedin.com/company/setup/new` si no existe.

Confirmar quién es **super admin**. No «admin»: **super admin**. Es el único rol
que puede aprobar la verificación del paso 3, y descubrir en el paso 3 que la
persona que tienes a mano no lo es cuesta días.

## Paso 2 · Crear la app

`linkedin.com/developers/apps/new`

| Campo | Qué va |
|---|---|
| App name | Algo reconocible. Aparece en la pantalla de permisos. |
| LinkedIn Page | **La del cliente.** Nombre o URL. |
| Privacy policy URL | La de la app. |
| App logo | Cuadrado, ≥100px. |
| Legal terms | Marcar la casilla. |

Al crearla quedan disponibles el **Client ID** y el **Client Secret**, en la
pestaña *Auth*. El secret no se comparte, no va en una URL y no se pega en un
chat. Para lo que viene ni siquiera hace falta usarlos.

## Paso 3 · Verificar la app contra la página

Este es el paso que espera a otra persona, así que se dispara temprano.

En la app → pestaña **Settings** → botón **Verify** → **Generate URL** → copiar
y mandársela al super admin de la página.

El super admin **tiene 30 días** para abrirla y aprobar. Hasta que lo haga, la
app existe pero no sirve: los productos del paso 4 no se pueden agregar.

## Paso 4 · Agregar los dos productos

En la app → pestaña **Products**. Agregar los dos:

- ☐ **Sign in with LinkedIn using OpenID Connect** → da `profile` y `email`.
  Es el que permite averiguar el `urn:li:person:` de Claudia.
- ☐ **Share on LinkedIn** → da `w_member_social`. Es el que permite publicar.

**Los dos son autoservicio y se activan solos**, sin revisión ni cola de
partners. Si alguno pide una solicitud o queda «pending», algo cambió respecto de
lo verificado el 25-08-2026 y hay que releer `verificacion-share-on-linkedin.md`
antes de seguir.

Después de agregarlos, la pestaña *Auth* debería listar los tres scopes:
`profile`, `email`, `w_member_social` (y `openid`).

## Paso 5 · Que Claudia tenga acceso a la app

El generador de tokens del paso siguiente emite **a nombre del miembro que tenga
la sesión abierta**, y solo funciona para apps donde ese miembro es parte del
equipo.

Entonces: o Claudia crea la app ella misma en el paso 2, o hay que agregarla como
miembro del equipo de la app desde la configuración de la app.

Si esto se salta, el paso 7 igual devuelve `201` — pero habrá publicado en el
perfil equivocado, que es la forma más incómoda de descubrir el error.

## Paso 6 · Generar el token

`linkedin.com/developers/tools/oauth/token-generator`

1. Elegir la app.
2. Marcar los scopes: **`openid`, `profile`, `w_member_social`**.
3. Claudia aprueba en la pantalla de permisos.
4. Copiar el token.

No hace falta configurar ninguna redirect URL para esto: el generador existe
justamente para saltarse el flujo OAuth completo. Si el portal igual exige
registrar una en la pestaña *Auth*, se pone cualquier HTTPS válida y se sigue —
el generador no la usa.

Para inspeccionar un token existente: `developers/tools/oauth/token-inspector`.

> **El token dura 60 días** y no se renueva solo: los refresh tokens
> programáticos están limitados a partners. Anotar la fecha de vencimiento hoy,
> porque el síntoma del día 61 es un `401` que nadie va a saber leer.

## Paso 7 · La prueba

Desde la raíz del repo:

```bash
LINKEDIN_TOKEN=el-token-copiado node scripts/linkedin-probar.mjs
```

Así, **sin banderas, no publica nada**. Valida el token, dice de quién es y
muestra el cuerpo que enviaría. Verificar que el nombre que imprime sea el de
Claudia y no el de otra persona.

Recién entonces, la prueba de verdad:

```bash
LINKEDIN_TOKEN=el-token-copiado node scripts/linkedin-probar.mjs --publicar --borrar
```

Publica con visibilidad `CONNECTIONS` —no pública— y borra la publicación al
terminar. Lo que responde es la pregunta que bloquea la Fase 1: si la tubería se
construye sobre `/rest/posts` o sobre `/v2/ugcPosts`.

---

## Dónde falla y qué significa

| Síntoma | Causa casi siempre |
|---|---|
| No se pueden agregar productos | El super admin no aprobó la verificación del paso 3 |
| `401 INVALID_ACCESS_TOKEN` en `/v2/userinfo` | Token vencido, mal copiado, o cortado al pegarlo |
| `403` en `/v2/userinfo` | Falta el producto de OpenID Connect, o el token se generó sin `profile` |
| El script imprime otro nombre | El token es de otra sesión. Volver al paso 5 |
| `403` en `/rest/posts` | Es el hallazgo que la prueba busca. El script sigue solo con `/v2/ugcPosts` |
| `403` en las dos rutas | Falta *Share on LinkedIn*, o el token se generó sin `w_member_social` |
| Error que no menciona la versión | Puede ser `Linkedin-Version` caducada. Probar con `LINKEDIN_VERSION=` la del mes |

## Qué dejar anotado al terminar

1. Client ID de la app y bajo qué página quedó.
2. Quién es el super admin que verificó, y cuándo.
3. La fecha de vencimiento del token — 60 días desde que se generó.
4. **Cuál de las dos rutas respondió `201`.** Es lo que decide el diseño de la
   Fase 1, y hay que escribirlo en `verificacion-share-on-linkedin.md`.

---

## Lo que este runbook no hace

No acelera la Fase 0. La cuenta sigue necesitando su mes de actividad humana
antes de que se automatice nada, y estos trámites corren en paralelo sin tocarla.

Y no habilita conectar ni mensajear: `w_member_social` solo publica. Eso es la
Fase 2, es otra decisión, y no pasa por este portal.
