# Verificación · ¿Está *Share on LinkedIn* disponible hoy en autoservicio?

**Entregable 4 del brief** `docs/prompt2perfillinkedin.md`.
**Verificado el:** 25-08-2026, contra la documentación oficial de Microsoft/LinkedIn
**y contra la API real**: el camino completo se probó de punta a punta y publica.
**Responde también:** la propuesta de manejar LinkedIn con un navegador automatizado
como plan B.

---

## Veredicto

**Sí. `Share on LinkedIn` sigue siendo autoservicio y sigue otorgando
`w_member_social`.** La Fase 1 del brief —la máquina de contenido— se puede
construir sobre API oficial. No hay que pedirle permiso a nadie ni entrar a una
cola de partners.

La página *Getting Access to LinkedIn APIs*, actualizada el **3 de junio de
2026**, lo lista bajo «Open Permissions (Consumer)» con esta frase:

> «The following permissions are available to all developers, and may be added
> via self-service through the LinkedIn Developer Portal, under the Products tab
> on your application page.»

| Producto | Permiso | Qué habilita |
|---|---|---|
| Sign in with LinkedIn using OpenID Connect | `profile`, `email` | Nombre, titular, foto y correo del miembro autenticado |
| **Share on LinkedIn** | **`w_member_social`** | **Publicar, comentar y reaccionar en nombre del miembro autenticado** |

Contraste útil: en esa misma página, SNAP sigue exigiendo ser partner aprobado y
Compliance sigue cerrada —*"Access is closed and may not be requested"*—. O sea,
la página está mantenida y refleja los cierres reales. Que *Share on LinkedIn*
siga en la tabla abierta no es inercia documental.

**Pero la respuesta corta esconde cuatro hallazgos que cambian el plan.**

---

## Hallazgo 1 · El candado no es el permiso, es la página de empresa

El brief asumía que el trabajo era conseguir el permiso. No lo es: el permiso es
gratis y automático. Lo que bloquea es el paso anterior.

Para crear la app en el portal de desarrolladores hay que **asociarla a una
Página de LinkedIn**, y un **super admin de esa página tiene que verificarla**:
se genera una URL única desde Settings → Verify, se le manda al super admin, y
éste tiene 30 días para aprobarla.

Consecuencias concretas:

- **Sin página de empresa de adOps verificada, no hay app, y sin app no hay
  `w_member_social`.** Ni con el perfil de Claudia perfecto.
- El brief ya pedía «vincular la página de empresa de adOps» como parte del
  perfil. Resulta que no es cosmética: **es la dependencia dura de toda la Fase
  1**, y hay que adelantarla.
- El super admin de la página tiene que ser alguien de adOps que esté disponible.
  Si la página no existe todavía, crearla es el primer paso, no el último.

Esto se puede empezar hoy y es administrativo, no técnico.

## Hallazgo 2 · La documentación de *Share on LinkedIn* está vencida

La página del producto (`ms.date` 2021, última edición diciembre 2023) manda a
`POST /v2/ugcPosts`. Esa API **fue reemplazada**. La Posts API —editada en mayo
de 2026— dice textual: *"The Posts API replaces the ugcPosts API."*

Lo que hay que usar de verdad:

```http
POST https://api.linkedin.com/rest/posts
X-Restli-Protocol-Version: 2.0.0
Linkedin-Version: 202608
Content-Type: application/json
```

```json
{
  "author": "urn:li:person:{id}",
  "commentary": "...",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED",
    "targetEntities": [],
    "thirdPartyDistributionChannels": []
  },
  "lifecycleState": "PUBLISHED",
  "isReshareDisabledByAuthor": false
}
```

Devuelve `201` y el identificador del post viene en el header **`x-restli-id`**.
Guardar ese valor, que es lo único que después permite referirse a la publicación.

**El header `Linkedin-Version` caduca.** La versión 202508 se apagó el **17 de
agosto de 2026** — hace ocho días. El ciclo es de unos doce meses: hay que dejar
un recordatorio en calendario, porque el día que se apague 202608 la tubería
devuelve error y nadie va a acordarse por qué.

El `urn:li:person:{id}` sale del login con OpenID Connect, que es el otro producto
autoservicio de la tabla. Hay que activar los dos.

## Hallazgo 3 · No se puede leer de vuelta lo publicado

`r_member_social` —recuperar los posts, comentarios y reacciones del propio
miembro— está marcado en la Posts API como **restringido y disponible solo para
usuarios aprobados**. No es autoservicio.

Esto no rompe nada, pero decide un punto de diseño del brief. El brief pedía
«guardar qué se publicó y cuándo». **Ese registro tiene que ser local y
escribirse en el momento de publicar**, porque no hay forma de reconstruirlo
después preguntándole a LinkedIn. Si el `x-restli-id` no se guarda en la fila
propia cuando llega el `201`, se perdió.

Es exactamente el mismo criterio que ya usa el motor con cada mensaje, y la misma
lección de `pre_quotes.salucloud_env` en el CRM de CDC: **el estado se guarda con
el dato, no se deduce después.**

## Sobre el límite de tasa

La doc del producto declara 150 solicitudes diarias por miembro. Fuentes de
terceros afirman que hoy son 150 mensuales. **No pude resolver la contradicción
contra fuente oficial vigente** — la única cifra oficial que encontré está en la
página desactualizada.

Da igual para este caso: dos publicaciones por semana son ocho al mes. Cabe
holgado en cualquiera de las dos lecturas. Solo importaría si alguien decidiera
usar `w_member_social` para reaccionar o comentar en volumen, que es justo lo que
el brief prohíbe.

---

## La propuesta del navegador automatizado

La idea era: si la API no sirve, poner a Claude a entrar a Chrome y hacer tareas
diarias programadas sobre LinkedIn.

**Recomendación: no, y además ya no hace falta.**

**1. El plan B resuelve un problema que no existe.** El plan A funciona: el
permiso está abierto y es automático. Lo único que falta es una página de empresa
verificada, que es trámite de dos días, no un muro técnico. Cambiar a la
arquitectura más riesgosa para evitar un trámite es un mal canje.

**2. Es la arquitectura con más huella de detección, y el brief ya lo decía.**
Un navegador controlado deja rastro en el DOM modificado y en los scripts
inyectados. LinkedIn inspecciona exactamente eso. No es una intuición: es la
razón por la que las herramientas del mercado migraron de extensión a nube.

**3. Una tarea programada empeora el problema en vez de disimularlo.** La
detección opera sobre desviación respecto del comportamiento esperado. Una tarea
que corre todos los días a la misma hora, desde la misma IP, con intervalos
regulares entre clics, es *más* señal que menos: ningún humano tiene esa
regularidad. Y en una cuenta de tres días no hay historial contra el cual esa
regularidad pueda pasar por normal.

**4. El artículo 8.2 no distingue por acción.** Prohíbe el acceso automatizado,
no solo el mensajeo automatizado. Publicar vía API está permitido porque LinkedIn
lo autorizó explícitamente con un permiso; publicar simulando clics no queda
cubierto por ese permiso.

**5. Y el argumento que cierra el tema: automatizar la Fase 0 destruye la Fase
0.** Lo único que produce ese mes son treinta días de comportamiento humano
genuino, que es el activo que hace creíble a la cuenta después. Si esos treinta
días los genera un navegador automatizado, la cuenta no llega al día 30 con un
baseline humano: llega con treinta días de huella de automatización acumulada.
Eso es peor que llegar con cero días.

### Dónde sí sirve un navegador automatizado

En todo lo que no sea LinkedIn. La materia prima del calendario editorial —qué
empresas se adjudicaron licitaciones este mes en ChileCompra, qué dice la
firmografía del SII— se puede recolectar automáticamente sin tocar ninguna
plataforma cuyos términos lo prohíban. Ahí la automatización agrega valor y no
arriesga la cuenta que el motor necesita.

---

## Hallazgo 4 · El token vive 60 días y no se renueva solo

Esto apareció al preparar la prueba y es la restricción operativa más seria de
todas, porque no se ve hasta que la tubería lleva dos meses corriendo.

- Los access tokens se emiten con **60 días** de vida.
- Los **refresh tokens programáticos** están disponibles *"for a limited set of
  partners"*. No para nosotros.
- La renovación oficial es «volver a pasar por el flujo de autorización», que se
  salta la pantalla de permisos **solo si el miembro sigue con sesión abierta en
  linkedin.com y el token todavía no venció**.

Traducido: **una tarea programada en el servidor no puede renovar el token sola.**
Requiere un navegador con la sesión de Claudia. Cada menos de 60 días, una
persona tiene que entrar y reautorizar.

Eso hay que diseñarlo, no descubrirlo:

- La tubería tiene que **guardar la fecha de expiración junto al token** y avisar
  con margen — no fallar el día 61 con un 401 que nadie sabe leer.
- Es el mismo criterio del freno automático del motor: el sistema avisa antes de
  romperse, no después. Una alerta que llega cuando la publicación ya no salió
  llega tarde.

## Resuelto · la Posts API sí acepta autor persona con autoservicio

**Probado el 25-08-2026 contra la API real. Devuelve `201`.**

Era la única pregunta que bloqueaba el diseño de la Fase 1: si `/rest/posts`
—que vive en el espacio de *community management* de Marketing, donde casi todo
exige ser partner— aceptaría publicar como persona con un token de autoservicio.
Lo acepta.

Las condiciones exactas de la prueba, porque «funciona» sin condiciones no sirve
de nada:

| | |
|---|---|
| App | Desechable, bajo una página propia donde el operador es super admin |
| Productos | Solo los dos autoservicio: *Sign in with LinkedIn using OpenID Connect* y *Share on LinkedIn* |
| Scopes del token | `openid`, `profile`, `w_member_social`. **Nada más** |
| Endpoint | `POST https://api.linkedin.com/rest/posts` |
| `Linkedin-Version` | `202608` |
| `author` | `urn:li:person:{sub}`, con el `sub` de `/v2/userinfo` |
| Respuesta | **`201`**, con el URN en el header `x-restli-id` |
| Borrado | `DELETE` sobre el mismo URN: funciona |

Tres consecuencias:

- **La Fase 1 se construye sobre `/rest/posts`.** No hay que tramitar Community
  Management API ni entrar a ninguna cola. El respaldo `/v2/ugcPosts` queda sin
  usar, que es lo que se quería: es la ruta declarada reemplazada.
- **El URN que vuelve es un `urn:li:share:`**, no un `urn:li:ugcPost:`. La doc
  dice que puede ser cualquiera de los dos, así que el registro local tiene que
  guardar el string completo tal como llega y no asumir el prefijo.
- **El camino completo está verificado de punta a punta**: crear la app,
  verificarla contra una página, activar los dos productos, generar el token,
  publicar y borrar. Lo que falta para producción no es técnico — es hacer el
  mismo trámite bajo la página del cliente.

Se probó con `scripts/linkedin-probar.mjs`, que sin banderas no publica nada y
con `--publicar --borrar` hace el ciclo completo sin dejar rastro.

---

## Qué falta para producción

El camino técnico ya no tiene incógnitas. Lo que queda es repetir el mismo
trámite bajo la página del cliente, que es quien opera la prospección:

1. La **página de LinkedIn del cliente**, y quién es su super admin.
2. Crear la app ahí. El super admin aprueba la URL de verificación — tiene 30
   días, y es el único paso que espera a otra persona.
3. Agregar los dos productos autoservicio.
4. **Que la cuenta que va a publicar sea parte del equipo de la app.** El
   generador de tokens emite a nombre de quien tenga la sesión abierta, así que
   un token del operador publica en el perfil del operador. En la prueba eso era
   lo correcto; en producción sería el error más incómodo de descubrir.
5. Construir la tubería sobre `/rest/posts`.

El paso a paso detallado está en `docs/runbook-linkedin-app.md`.

**La app de la prueba es desechable.** El publisher de una app es la organización
dueña de la página que se elige, y eso no se cambia después: la de producción
tiene que ser otra app, bajo la página del cliente.

Para la tubería de producción sí habrá que registrar una redirect URL —el
generador del portal sirve para probar, no para renovar un token cada 60 días sin
intervención—. LinkedIn **exige HTTPS** y URL absoluta, sin `#` y sin parámetros.
La del repo sería `https://www.adoops.digital/api/linkedin/callback` — con `www`,
por la misma razón que ya está anotada para Google en `env.example`: el apex
redirige y la URI tiene que coincidir exacta.

Nada de esto toca el perfil de Claudia ni acelera la Fase 0. Corren en paralelo:
la cuenta sigue su mes a mano mientras el permiso se tramita.

---

## Fuentes

- [Getting Access to LinkedIn APIs](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access) — actualizada 03-06-2026. Tabla de Open Permissions.
- [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin) — última edición 14-12-2023. Desactualizada, apunta a `ugcPosts`.
- [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api) — actualizada 13-05-2026. Reemplazo de `ugcPosts`, tabla de permisos, aviso de sunset de 202508.
- [3-Legged OAuth Flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow) — actualizada 15-05-2026. Vida del token, refresh solo para partners, exigencia de HTTPS en la redirect URL.
- [Developer Portal Tools](https://learn.microsoft.com/en-us/linkedin/shared/authentication/developer-portal-tools) — el generador de tokens y el inspector.
- [Sign In with LinkedIn using OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2) — `/v2/userinfo` y el campo `sub`.
- [Send an app verification request for a LinkedIn Page](https://www.linkedin.com/help/linkedin/answer/a1665329) — flujo de verificación por super admin.
- [Associate an app with a LinkedIn Page](https://www.linkedin.com/help/linkedin/answer/a548360)
