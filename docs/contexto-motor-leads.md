# Motor de leads · contexto para la sesión de código

**Apúntale a este archivo al empezar en Claude Code.**
Es el resumen ejecutable de cuatro documentos de investigación. Lo que está acá ya se decidió y **no hay que volver a discutirlo** — si algo parece mal, está justificado en el documento que se cita.

| Documento | Qué contiene |
|---|---|
| `docs/factibilidad-leads-linkedin.md` | Competencia, marco legal, costos, go/no-go |
| `docs/mvp-motor-nurturing.md` | Especificación funcional del MVP |
| `docs/sales-navigator-como-encaja.md` | Qué hace y qué no hace Sales Navigator |
| `docs/runbook-arranque.md` | Trámites, Fase 0 y calendario |
| `docs/flujo-motor-nurturing.html` | El diagrama del flujo completo |

---

## Qué se está construyendo

Un motor de prospección que vive **dentro del mismo repo**, bajo `/leads`, con la misma base de Neon y detrás del mismo login — exactamente el patrón de `/crm`.

**No es "automatización de LinkedIn".** Es una máquina de estados por prospecto que cada día decide a quién le toca, qué se le dice y **por cuál de tres canales**, eligiendo siempre el más barato disponible. LinkedIn, email y WhatsApp son salidas del mismo motor, no módulos separados.

Fase actual: **el MVP corre con leads cargados por CSV.** La ingesta automática de fuentes chilenas viene después. No construir la cañería antes de saber si el estanque tiene fondo.

---

## Invariantes · no negociables

Estas son las que, si se rompen, hay que rehacer trabajo caro. En orden de qué tan caro.

### 1. Procedencia por campo, desde el primer `CREATE TABLE`

Cada email, teléfono y URL guarda **de qué fuente vino y en qué fecha**. No es burocracia: la Ley 21.719 entra en vigencia el 1 de diciembre de 2026 y sin esto la base entera es indefendible. Retro-adaptarlo con 20.000 registros adentro es carísimo.

```ts
email:            text(),
email_origen:     text(),        // 'prospeo' | 'fullenrich' | 'csv' | 'manual' | 'sii'
email_obtenido_en: timestamp(),
```

Lo mismo para `telefono_*` y `linkedin_*`. Sin excepción.

### 2. `member_urn` es la clave. El slug `/in/` nunca.

El identificador estable de una persona en LinkedIn es `ACoAA...` — el mismo que aparece en la URL de Sales Navigator (`/sales/lead/ACoAA...`). **El slug `/in/juan-perez` lo cambia el usuario cuando quiere.** Si deduplicas por slug, alguien cambia su URL y el sistema le manda la secuencia de nuevo.

```ts
member_urn:        text().primaryKey(),   // "ACoAA..." — permanente
public_identifier: text(),                // slug, mutable, jamás clave
```

Ambas URLs son derivables de esas dos columnas. No las guardes.

### 3. Un solo módulo importa clientes de red

`lib/leads/dispatch.ts` es el **único** archivo que puede importar el SDK de Unipile, Brevo o WaSender. Es la generalización de `lib/crm/whatsapp-dispatch.ts`, y esa propiedad es lo que hace auditable la promesa de que nada sale sin permiso.

**Los cuatro candados, en este orden:**

1. Aprobación humana — **por lote**, no por mensaje (de a uno no escala y nadie lo usa)
2. Sin BAJA / opt-out / rebote duro / oposición registrada / ya respondió
3. Interruptor general + modo simulado (el simulado corta **antes** de la red)
4. Cuota diaria + ventana horaria + freno automático por tasa de aceptación

### 4. El pacing vive en nuestro código

Unipile v1 declara literalmente: *"We don't enforce any limits on our side."* Envía exactamente lo que le pidas, al volumen que le pidas. **Todo el warm-up, cuotas, jitter y ventana horaria es código nuestro.** Si no se escribe, se queman cuentas.

```
Semana 1: 5 invitaciones/día   Semana 4: 16/día
Semana 2: 8/día                Semana 5+: 20-25/día (techo duro)
Semana 3: 12/día
```

Freno automático: si la aceptación de 7 días cae bajo **25%**, la cuota baja a la mitad. Bajo **15%**, la cuenta se pausa sola. No es una alerta para que alguien decida — cuando alguien lee la alerta ya es tarde.

### 5. Los límites son configurables, no constantes

LinkedIn **no publica** ninguno de estos números y los modula por cuenta. Todo lo de arriba va en `lead_emisores` o en configuración editable, nunca hardcodeado.

---

## Convenciones heredadas del CRM · respétalas

- **Montos enteros en pesos.** No `numeric`: el CLP no tiene decimales y `numeric` vuelve como string desde Drizzle.
- **Las subconsultas correlacionadas nombran su tabla en texto plano** (`lead_empresas.id`, no `${leadEmpresas.id}`). Drizzle solo califica la columna cuando hay joins; sin joins escribe `"id"` a secas y se resuelve contra la tabla equivocada. **La consulta corre sin error y devuelve cifras falsas** — ya pasó en el CRM con las 28 cuentas puntuando idéntico.
- **Las cifras las calculan reglas, no el modelo.** El LLM redacta sobre un resumen ya cerrado y tiene prohibido agregar números.
- **Caché por huella + `<Suspense>`** para cualquier texto generado por IA. En el CRM la narración sin caché costaba 6 segundos por visita. Acá aplica igual: **no generes cuatro mensajes por IA para alguien que nunca respondió.**
- **Next 16.** Lee `node_modules/next/dist/docs/` antes de escribir. Las APIs cambiaron respecto de lo que sabes.
- Auth de `/leads` y `/api/leads` va en `proxy.ts`, como `/crm`.

---

## Modelo de datos · 9 tablas, prefijo `lead_`

```
lead_empresas       rut (clave, normalizado sin puntos ni guion), razon_social,
                    rubro, tramo_ventas, region, dominio, origen, obtenido_en

lead_personas       member_urn (clave), public_identifier, nombre, cargo,
                    empresa_id, email + email_origen + email_obtenido_en,
                    telefono + telefono_origen + telefono_obtenido_en,
                    es_open_profile, network_distance

lead_senales        empresa_id, tipo, evidencia (texto + URL), fecha_hecho,
                    vence_en, estado
                    ▸ VENCEN, no se acumulan. Un panel que solo crece
                      es otra bandeja que nadie mira.

lead_campanas       nombre, icp (jsonb), limites, canal_preferido, estado

lead_secuencias     campana_id, orden, espera_dias, canal, plantilla
                    ▸ es DATA, no código. Se edita sin desplegar.

lead_inscripciones  persona_id, campana_id, estado, paso_actual,
                    proximo_paso_en, toques_totales
                    ▸ la máquina de estados vive acá

lead_acciones       inscripcion_id, tipo, canal, programada_en, estado,
                    intentos, resultado
                    ▸ la cola que lee el scheduler

lead_mensajes       persona_id, canal, direccion, cuerpo, enviado_en,
                    external_id
                    ▸ los tres canales unificados; alimenta la bandeja

lead_emisores       tipo, identificador, cuota_diaria, dia_warmup, ip,
                    tasa_aceptacion_7d, estado
                    ▸ sin esto no hay pacing
```

**Estados de `lead_inscripciones`:**

```
pendiente → invitado → conectado → en_secuencia → respondio → calificado
                │                       │              │
                │                       │              └→ oportunidad en /crm
                │                       └→ agotado (5 toques sin respuesta)
                └→ rechazado / retirado → email

  desde cualquier estado → suprimido (opt-out, BAJA, rebote duro, oposición)
```

---

## La escalera de canales · el corazón del motor

Para cada prospecto se toma **el primer carril disponible**:

| # | Condición | Canal | Costo | Cupo |
|---|---|---|---|---|
| 1 | `network_distance == 1` | Mensaje directo | Gratis | ~150/día |
| 2 | `es_open_profile == true` | **InMail gratis** | Gratis | **~800/mes** |
| 3 | Grupo o evento en común | Mensaje directo | Gratis | Sin cupo |
| 4 | Prioritario | InMail con crédito | 1 crédito | 50/mes |
| 5 | Nada de lo anterior | **Invitación + nota 300 car.** | Gratis pero **escaso** | **20–25/día** |

**Contraintuitivo y crítico: la invitación es el recurso más caro, no el más barato.** 20–25 al día contra ~800 InMails gratis al mes. Toda la escalera existe para no quemarla.

**A los 14 días sin aceptar: retirar la invitación** — libera cupo semanal, evita que las pendientes degraden la cuenta — y bajar el prospecto al carril de email.

### Reglas transversales

- Una respuesta **en cualquier canal** detiene todo y abre hilo humano
- Máximo **5 toques** por persona, sumando todos los canales; después, supresión
- Nunca dos canales el mismo día
- Los `D+N` son días hábiles **con jitter aleatorio** — una acción cada 90 segundos exactos es lo que delata a un bot
- La secuencia se pausa si el prospecto ve el perfil o interactúa: está mirando, eso es momento de humano

---

## Lo que se reusa del CRM

No partimos de cero. Entre 35% y 45% del backend ya existe:

| Módulo del CRM | Rol acá |
|---|---|
| `lib/crm/whatsapp-dispatch.ts` | **Se generaliza a `lib/leads/dispatch.ts`.** Los cuatro candados ya están escritos y probados |
| `lib/crm/insights.ts` | Motor de señales de compra. Cambian las reglas, no la arquitectura |
| `lib/crm/scoring.ts` | Lead scoring. La decisión de que sea **explicable** es la correcta acá también |
| `lib/crm/narrador.ts` | Redacción con caché por huella |
| `lib/crm/marketing.ts` | Atribución del canal al pipeline |
| `components/crm/HiloConversacion.tsx` | Bandeja de 3 columnas, ahora multicanal |
| `app/api/crm/cron/alertas/` | El patrón del cron con `CRON_SECRET` |

---

## Fuera del MVP · resistir la tentación

| Fuera | Por qué |
|---|---|
| Ingesta automática de SII y ChileCompra | Se valida con 200 leads por CSV primero |
| Enriquecimiento en cascada automático | Por lote, a mano. 200 contactos son 10 minutos |
| Scoring de cinco factores | La señal ya ordena la cola. Un score sin datos de conversión es un número inventado con más pasos |
| Multi-tenant | Es el proyecto entero otra vez, y hay tres preguntas legales sin responder |
| WhatsApp | El canal existe en el CRM pero abre la discusión de consentimiento previo. Fase 2 |
| Dashboard con gráficos | Seis números en una tabla. Los gráficos vienen cuando haya algo que graficar |

---

## Orden de construcción

| Semana | Entregable | Requisito |
|---|---|---|
| **3** | Las 9 tablas · carga CSV · lista de prospectos · **`origen` desde el primer commit** | Layout del SII |
| **4** | Trials de Unipile y Sales Navigator · conectar cuenta · **UNA invitación real desde la interfaz** · webhooks | Cuenta con 3 semanas de edad |
| **5** | Motor de pasos · scheduler cada 15 min · los cuatro candados · modo simulado | — |
| **6** | Escalera completa · retiro a los 14 días · detención por respuesta · email por Brevo | Semana 5 |
| **7** | Señales de ChileCompra · plantillas con la señal · aprobación por lote | Ticket de ChileCompra |
| **8** | Opt-out · registro de actividades · seis métricas · **primera campaña real** | Cuenta a régimen |

**Empieza por la semana 3.** Y dentro de la semana 3, empieza por `db/leads.ts` con los campos de procedencia puestos — es la decisión que no se puede tomar después.

---

## Las seis métricas · no más

| Métrica | Piso |
|---|---|
| **Aceptación de invitaciones** | **25%** — la única que puede cerrar la cuenta |
| Respuesta al nurturing | 10% |
| Opt-outs y quejas | **bajo 0,5%** |
| Respuestas por canal | — |
| Toques hasta la primera respuesta | — |
| Costo por conversación | — |

Las tres primeras se miden **por emisor**, no solo agregadas: una cuenta puede estar hundiéndose mientras el promedio se ve bien.

---

## Dos cosas que conviene tener presentes al escribir

**Nada de esto tiene API oficial.** No existe endpoint de LinkedIn para prospección fría — SNAP está cerrado y las Communication APIs prohíben expresamente los eventos automatizados. Unipile opera con la sesión de la cuenta por ingeniería inversa. Eso significa que **los errores son inestables**: 422, 429, 500 sin patrón claro. Los reintentos van con backoff, y un fallo nunca debe reintentarse en bucle contra LinkedIn.

**La cuenta de LinkedIn es un activo desechable.** El código debe asumir que una cuenta puede quedar restringida en cualquier momento: `lead_emisores` con estado, campañas que sobreviven al cambio de emisor, y nada crítico atado a una sola cuenta.
