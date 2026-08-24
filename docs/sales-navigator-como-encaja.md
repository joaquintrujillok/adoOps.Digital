# Sales Navigator · cómo encaja realmente

**adoOps** · agosto de 2026
**Complementa:** `mvp-motor-nurturing.md`

---

## El error de modelo mental

Sales Navigator **no es un sistema con el que te integras**. Es una **propiedad de la cuenta de LinkedIn**, como el color de un auto. No tiene API pública —SNAP está cerrado—, no tiene exportación nativa a CSV, y no hay endpoint al que le pegues.

Lo que hay es esto: tu cuenta de LinkedIn tiene o no tiene la suscripción. Si la tiene, **la misma cuenta se comporta distinto**: ve más resultados, tiene más filtros, trae 50 créditos de InMail al mes, y —lo importante— **devuelve un campo que sin suscripción no existe**.

```
                    NO es esto                          ES esto
        ┌───────────────────────────┐     ┌────────────────────────────────┐
        │                           │     │                                │
        │   Tu sistema              │     │   Tu sistema                   │
        │       │                   │     │       │                        │
        │       ▼                   │     │       ▼                        │
        │  ┌─────────────┐          │     │  ┌──────────┐                  │
        │  │ API de      │          │     │  │ Unipile  │                  │
        │  │ Sales Nav   │  ✗       │     │  └────┬─────┘                  │
        │  └─────────────┘          │     │       │  sesión de la cuenta   │
        │   (no existe)             │     │       ▼                        │
        │                           │     │  ┌──────────────────────────┐  │
        │                           │     │  │ CUENTA DE LINKEDIN       │  │
        │                           │     │  │  · suscripción SN activa │  │
        │                           │     │  │  · 50 créditos InMail    │  │
        │                           │     │  │  · límites elevados      │  │
        │                           │     │  └──────────────────────────┘  │
        └───────────────────────────┘     └────────────────────────────────┘
```

Todo pasa por la cuenta. Sales Navigator solo cambia qué puede hacer esa cuenta.

---

## Qué compras exactamente

Son cuatro cosas empaquetadas en un precio. Conviene verlas separadas porque **solo una de ellas justifica la compra en nuestra arquitectura**.

| Compras | Free | Premium Business | **Sales Navigator Core** |
|---|---|---|---|
| Resultados por búsqueda de **personas** | 1.000 | 1.000 | **2.500** |
| Resultados por búsqueda de **empresas** | 1.000 | 1.000 | **1.000 — no sube** |
| Commercial Use Limit (el bloqueo mensual de búsquedas) | Sí | Exento | Exento |
| Filtros de búsqueda | Básicos | Básicos+ | **40–50 avanzados** |
| Créditos de InMail | 0 | 15/mes | **50/mes** |
| **Flag `open_profile` en resultados de búsqueda** | ❌ | ❌ | **✅ vía API** |
| **Invitaciones por semana** | ~100–200 | ~100–200 | **~100–200 — NO SUBE** |

### Las dos líneas que hay que leer dos veces

**Sales Navigator no sube el límite de invitaciones.** Ese es tu cuello de botella real —20 a 25 al día si quieres que la cuenta sobreviva— y es exactamente igual con o sin suscripción. Pagar Sales Navigator **no te deja mandar más**. Te deja **elegir mejor a quién**.

**Las búsquedas de empresas siguen topadas en 1.000** incluso con Sales Navigator. Si el ICP se construye por empresa —que es justo nuestro caso, porque el universo sale del SII— ese tope no se mueve. Otra razón por la que Sales Navigator no es la fuente del universo en nuestra arquitectura.

---

## La razón real para pagarlo: el flag `open_profile`

Esto es lo que no es obvio y es lo que decide.

Recuerda la escalera de canales: **el InMail a un perfil con Open Profile es gratis** —no consume crédito— y tiene un techo de ~800 al mes, contra los 20–25 diarios de invitaciones. Es el canal más barato y más abundante que tienes.

El problema: **¿cómo sabes quién tiene Open Profile activado?**

Y acá está el detalle: **LinkedIn quitó el badge "OPEN" de las tarjetas de resultados en la interfaz durante 2025–2026.** Hoy, una persona buscando a mano tiene que abrir cada perfil uno por uno para saberlo. Con 2.000 prospectos, es inviable.

**Unipile sí devuelve el campo `open_profile` en cada resultado de búsqueda.** Lo que LinkedIn sacó de la pantalla, la API lo sigue entregando. Eso permite hacer, en una sola pasada, lo que a mano es imposible:

```
Búsqueda de 2.500 personas del ICP
        │
        ▼
Por cada resultado, Unipile devuelve:
  provider_id (ACoAA...)  ·  network_distance  ·  premium  ·  open_profile
        │
        ├── open_profile = true   ──→  carril InMail GRATIS   (~800/mes)
        ├── network_distance = 1  ──→  carril mensaje directo (gratis)
        └── resto                 ──→  carril invitación      (20-25/día, escaso)
```

**Ese ruteo es el MVP.** Y el flag que lo alimenta requiere la suscripción activa.

---

## Qué NO necesitas Sales Navigator para hacer

Esto es igual de importante, porque corrige un supuesto del informe anterior:

> **Una cuenta gratuita de LinkedIn PUEDE enviar mensajes a perfiles con Open Profile, sin consumir crédito.**

Quien necesita ser Premium es **el que recibe** —es él quien activa Open Profile—, no el que envía. Verificado contra la documentación de LinkedIn y confirmado por el soporte de producto de PhantomBuster. (Una fuente aislada dice lo contrario; confunde el requisito del receptor con el del emisor.)

Traducción práctica: **si mañana cancelas Sales Navigator, no pierdes el canal de Open Profile.** Pierdes la capacidad de *detectar a escala* quién lo tiene. El canal sigue abierto; te quedas ciego para encontrarlo.

Esa es toda la decisión, y es más chica de lo que parecía.

---

## Los dos modos de operarlo

### Modo A · humano en el loop (lo del MVP, semanas 1–4)

```
Persona busca en Sales Navigator con los filtros del ICP
        │
        ▼
Guarda una lista de leads
        │
        ▼
Copia las URLs  →  CSV  →  carga al sistema
        │
        ▼
El sistema resuelve cada URL a member_urn y arranca la secuencia
```

Lento, pero **no automatiza la búsqueda**, que es la parte de mayor volumen y por lo tanto la de mayor huella de detección. Para 200 leads de validación, sobra. **No existe exportación nativa a CSV en Sales Navigator** —hay que copiar a mano o usar una extensión, y la extensión es exactamente lo que no queremos.

### Modo B · vía Unipile (semanas 5+)

```javascript
POST /api/v1/linkedin/search?account_id=...
{
  "api": "sales_navigator",      // ← requiere suscripción activa en la cuenta
  "category": "people",
  "url": "https://www.linkedin.com/sales/search/people?query=..."
}
```

Se puede pegar directamente la URL de una búsqueda de Sales Navigator del navegador, o construir los filtros por parámetros. Devuelve hasta 2.500 resultados paginados, con el flag `open_profile` incluido.

Es el modo que hace funcionar el ruteo automático. Y es también el que carga el riesgo: leer 2.500 perfiles es mucho más volumen que enviar 20 invitaciones. **La lectura masiva es más detectable que el envío.**

Recomendación: **Modo A hasta la semana 5.** Valida que la secuencia convierte antes de agregar la superficie de riesgo de la búsqueda automatizada.

---

## El detalle de base de datos que te ahorra un dolor de cabeza

Un hallazgo concreto de la verificación: **el identificador que Sales Navigator usa en su URL es el mismo member URN del perfil público.**

```
linkedin.com/sales/lead/ACwAAAIJflYBqX9OalB0Q4oq13hUS3Mp8HRkvJ0,NAME_SEARCH,ab12
                        └──────────────── member URN ──────────────┘

linkedin.com/in/ACwAAAIJflYBqX9OalB0Q4oq13hUS3Mp8HRkvJ0   ← redirige al perfil real
```

Consecuencias para `lead_personas`:

| Columna | Qué guardar | Por qué |
|---|---|---|
| `member_urn` | `ACoAA...` — **clave de deduplicación** | **Es permanente.** Nunca cambia |
| `public_identifier` | El slug (`jperez-marketing`) | **El usuario lo cambia cuando quiere.** Columna normal, jamás clave |
| URL de Sales Nav | *derivada*, no se guarda | `/sales/lead/{member_urn}` |
| URL pública | *derivada*, no se guarda | `/in/{public_identifier}` |

**Regla: nunca deduplicar por el slug `/in/`.** Alguien cambia su URL de LinkedIn, y el sistema lo trata como una persona nueva y le manda la secuencia otra vez. Con `member_urn` eso no pasa, y de una sola columna salen ambas URLs.

---

## Precio · dos páginas oficiales de LinkedIn se contradicen

Corrección al informe anterior. Verificamos ambas páginas y no coinciden:

| Fuente oficial | Core mensual | Core anual | Advanced mensual |
|---|---|---|---|
| `business.linkedin.com/.../pricing` | **$119,99** | $1.079,88 | $159,99 |
| `business.linkedin.com/.../compare-plans` | **$99,99** | $959,88 | $179,99 |

Probablemente geolocalización o un A/B test. **Presupuestar con $120/mes** y confirmar en el checkout desde Chile. Sobre el modelo de costos del MVP: sube de ~$225 a **~$250–265/mes**. No cambia nada estructural.

Dato útil: **no hay compromiso anual obligatorio.** Se puede contratar mensual y cancelar al final del período. Y hay trial gratuito —requiere tarjeta, y solo para quien no haya usado uno en los últimos 365 días—.

**Core, no Advanced.** Los ~$40–80 extra compran TeamLink, Buyer Intent, Smart Links y CRM Sync con Salesforce o Dynamics. TeamLink no rinde con menos de 5 vendedores, Buyer Intent necesita volumen para no ser ruido, y el CRM Sync apunta a CRMs que no son el de ustedes.

---

## Entonces: ¿se puede?

**Sí, con una cuenta y una suscripción Core.** El resumen operativo:

1. **Una cuenta de LinkedIn dedicada** —no la tuya— con **Sales Navigator Core mensual**, ~$120.
2. Esa cuenta se conecta a **Unipile** (~$55/mes hasta 10 cuentas).
3. Sales Navigator hace **una sola cosa crítica**: entregar el flag `open_profile` para rutear prospectos al carril de InMail gratis. Todo lo demás que compra es secundario en esta arquitectura, porque el universo de empresas viene del SII, no de LinkedIn.
4. **No compra más invitaciones.** El techo de 20–25 al día es el mismo. Compra *criterio*, no *volumen*.
5. Semanas 1–4: búsqueda a mano, CSV, motor corriendo. Semanas 5+: búsqueda vía Unipile.

Y la prueba barata, que se puede hacer esta semana: **abre el trial de Sales Navigator y el de Unipile —7 días— y corre una búsqueda del ICP real.** Cuenta cuántos de los primeros 500 resultados tienen `open_profile = true`. Ese porcentaje decide el tamaño del carril gratis, y con él, si el modelo de costos cierra o no. No lo sabemos y no está publicado en ninguna parte.
