# Motor de nurturing multicanal · Especificación del MVP

**adoOps** · agosto de 2026
**Documento hermano de:** `factibilidad-leads-linkedin.md`
**Qué responde:** qué se construye en las primeras seis semanas, y qué explícitamente no

---

## La idea en una frase

**El producto no es "automatizar LinkedIn". Es una máquina de estados por prospecto que cada día decide a quién le toca, qué se le dice, y por cuál de tres canales — eligiendo siempre el más barato que esté disponible.**

LinkedIn, InMail y email no son tres features: son tres salidas del mismo motor. Si se construyen como tres módulos separados, el MVP se triplica y el resultado son tres bandejas que nadie mira. Si se construye una sola secuencia con canales intercambiables, el MVP cabe en seis semanas y es lo que ninguna de las trece referencias tiene.

---

## 1. La escalera de canales

Esto es el corazón del MVP y la respuesta directa a tu pregunta. Para cada prospecto, el motor evalúa en orden y toma **el primer canal disponible**:

| # | Condición | Canal | Costo | Cupo |
|---|---|---|---|---|
| 1 | Ya es **conexión de 1er grado** | Mensaje directo de LinkedIn | **Gratis** | ~150/día |
| 2 | Tiene **Open Profile** activo | **InMail gratis** — no consume crédito | **Gratis** | ~800/mes por cuenta |
| 3 | Comparte **grupo o evento** con la cuenta emisora | Mensaje directo | **Gratis** | Sin cupo de crédito |
| 4 | Nada de lo anterior, pero es prioritario | **InMail con crédito** | 1 crédito | **50/mes.** Se recupera si responde en 90 días |
| 5 | Nada de lo anterior | **Invitación con nota** (300 caracteres) | Gratis | **20–25/día — es el recurso escaso** |
| 6 | Invitación sin aceptar a los 14 días | Se **retira** la invitación y baja a email | — | Retirarla libera cupo semanal |
| 7 | Tiene email verificado | **Secuencia de email** | ~$0,05 el enriquecimiento | Sin cupo relevante |

Dos decisiones que conviene fijar ahora porque cambian todo lo demás:

**La invitación es el recurso más caro que tienes, no el más barato.** La intuición dice "mando invitaciones porque son gratis". El cupo real es de 20–25 al día si quieres que la cuenta sobreviva — unas 500 al mes. Los InMails a Open Profile son **gratis y tienen un techo de ~800 al mes**. La escalera existe para no quemar invitaciones en gente a la que se le puede escribir directo.

**El paso 6 es el que casi nadie implementa.** Una invitación pendiente ocupa cupo indefinidamente y, acumuladas, degradan el *trust score* de la cuenta. Retirar automáticamente a los 14 días y bajar a email recupera cupo y convierte un callejón sin salida en un segundo intento.

> ⚠️ El techo de ~800 InMails abiertos al mes lo documenta Unipile, no LinkedIn. **Verificarlo en el trial de 7 días antes de dimensionar la campaña sobre esa cifra.**

---

## 2. La regla que hace que esto sea nurturing y no spam

**Ningún primer contacto sale sin una señal verificable sobre esa empresa.**

No es una regla de estilo. Hace tres cosas a la vez:

- **Sube la tasa de aceptación.** Es la variable que decide si LinkedIn te deja operar: bajo 25% de aceptación, la plataforma empieza a estrangular la cuenta. Un mensaje que menciona un hecho real de esa empresa acepta muy por encima de uno que dice "vi tu perfil y me pareció interesante".
- **Es lo que hace defendible el interés legítimo** bajo la Ley 21.719. La diferencia entre "traté sus datos porque estaban ahí" y "lo contacté por un hecho público y pertinente a mi servicio" es exactamente el test de balanceo.
- **Es el único diferenciador que adOps puede sostener**, porque las señales chilenas son gratis y nadie las usa.

Señales del MVP, todas de fuentes públicas:

| Señal | Fuente | Ventana |
|---|---|---|
| Se adjudicó una licitación en una categoría relevante | ChileCompra (API, deltas diarios) | 30 días |
| Publicó una licitación en tu categoría | ChileCompra | 15 días |
| Empresa constituida recientemente | Registro de Empresas / Diario Oficial | 90 días |
| Cambió de tramo de ventas o de trabajadores | SII (anual) | — |
| Abrió sucursal o cambió domicilio | SII, direcciones históricas | 180 días |

Si un prospecto no tiene señal, **no entra a la campaña**. Se queda en la base esperando. Esto reduce el volumen y sube todo lo demás.

---

## 3. La secuencia

Cinco toques como máximo, repartidos entre canales, en unas tres semanas. El tope de cinco no es arbitrario: más que eso configura hostigamiento y no mejora la conversión.

### Ruta A — hay que conectar primero

```
D0    Invitación con nota  ·  <300 caracteres  ·  menciona LA SEÑAL
       │
       ├── aceptó ──────────────────────────────────────────┐
       │                                                     │
       └── no aceptó en 14 días → retirar → Ruta C (email)   │
                                                             ▼
D+2   Mensaje 1 · agradece, contexto, CERO pitch
D+6   Mensaje 2 · algo útil sin pedir nada (un dato del rubro, un caso)
D+13  Mensaje 3 · UNA pregunta directa
D+21  Mensaje 4 · cierre amable, "si no es el momento, te dejo tranquilo"
       │
       └── respondió en cualquier punto → SALE de la automatización
                                          → bandeja humana
```

### Ruta B — Open Profile o conexión existente

Se salta la invitación. Arranca directo en el equivalente al Mensaje 1, con la señal incorporada. Es la ruta más barata y la de mejor conversión: no gastó cupo de invitación y el prospecto ya es alcanzable.

### Ruta C — email

```
D0    Email 1 · asunto que nombra la señal, no el servicio
D+4   Email 2 · valor, sin pedir nada
D+9   Email 3 · una pregunta
D+16  Email 4 · cierre
```

### Reglas transversales del motor

| Regla | Por qué |
|---|---|
| **Una respuesta en cualquier canal detiene todo** y abre hilo humano | Es la diferencia entre nurturing y una máquina de spam |
| **Máximo 5 toques por persona, sumando todos los canales** | Cumplimiento y calidad. Después, supresión |
| **Nunca dos canales el mismo día** | Perseguir a alguien por tres frentes a la vez se lee como acoso |
| **Ventana horaria laboral, hora de Chile** | Una cuenta activa a las 3 AM es la firma de detección más obvia |
| **Los D+N son "días hábiles + jitter aleatorio"** | Una acción cada 90 segundos exactos es lo que delata a un bot |
| **La secuencia se pausa si el prospecto ve tu perfil o interactúa** | Está mirando. Ese es momento de mensaje humano, no del paso 3 |

---

## 4. Modelo de datos

Nueve tablas, prefijo `lead_`, misma convención que `crm_`. Montos enteros, misma decisión que el CRM.

| Tabla | Qué guarda | Nota |
|---|---|---|
| `lead_empresas` | RUT, razón social, rubro, tramo de ventas, región, dominio | La clave es el RUT. Deduplicación por RUT normalizado |
| `lead_personas` | Nombre, cargo, `linkedin_urn`, email, teléfono, `empresa_id` | **Cada campo de contacto lleva `origen` y `obtenido_en`** |
| `lead_senales` | Tipo, evidencia (texto + URL), fecha del hecho, `empresa_id`, vencimiento | Igual que las alertas del CRM: **vencen, no se acumulan** |
| `lead_campanas` | ICP, plantillas por paso, límites diarios, canal preferido | |
| `lead_secuencias` | Definición de pasos: orden, espera, canal, plantilla | Data, no código. Se edita sin desplegar |
| `lead_inscripciones` | Persona × campaña · estado · paso actual · fecha del próximo paso | **La máquina de estados vive acá** |
| `lead_acciones` | La cola: qué, cuándo, por qué canal, estado, intentos, resultado | El scheduler lee de acá |
| `lead_mensajes` | Todo lo enviado y recibido, de los tres canales, unificado | Es lo que alimenta la bandeja |
| `lead_emisores` | Cuenta de LinkedIn o buzón · cuota diaria · día de warm-up · IP · estado | Sin esto no hay pacing |

Estados de `lead_inscripciones`:

```
pendiente → invitado → conectado → en_secuencia → respondio → calificado
                │                       │              │
                │                       │              └→ a CRM (oportunidad)
                │                       └→ agotado (5 toques sin respuesta)
                └→ rechazado / retirado → email (Ruta C)

  Desde cualquier estado: → suprimido  (opt-out, BAJA, rebote duro, oposición)
```

**El campo `origen` en `lead_personas` no es opcional.** Cada email y cada teléfono guarda de qué fuente vino y cuándo. Es lo único que hace la base defendible ante la Agencia, y retro-adaptarlo después de tener 20.000 registros es carísimo. Va en el primer `CREATE TABLE`.

---

## 5. El scheduler y el dispatch

Un cron cada 15 minutos, protegido con `CRON_SECRET` — mismo patrón que `/api/crm/cron/alertas`:

```
1. Traer acciones vencidas, ordenadas por prioridad de señal
2. Por cada emisor: ¿le queda cuota hoy? ¿está en ventana horaria?
   ¿su tasa de aceptación de 7 días está sobre el piso?
        └── si no → dejar la acción para mañana, no forzar
3. Pasar por los CUATRO CANDADOS
4. Despachar por el canal que corresponda
5. Registrar en lead_mensajes y avanzar la inscripción
6. Agendar el paso siguiente con jitter
```

### Los cuatro candados, adaptados

Se generaliza `whatsapp-dispatch.ts`. **Un único módulo importa los clientes de red** — Unipile, Brevo, WaSender. Esa propiedad es la que hace auditable la promesa, y ya la tienen escrita.

| # | Candado | Cambio respecto del CRM |
|---|---|---|
| 1 | **Aprobación humana** | Por lote, no por mensaje. "Aprobar los 40 primeros toques de esta campaña" — si es de a uno, no escala y nadie lo usa |
| 2 | **Sin BAJA ni oposición** | Se amplía: BAJA, opt-out de email, rebote duro, oposición registrada, y quien ya respondió |
| 3 | **Interruptor general + modo simulado** | Idéntico. El modo simulado corta antes de la red |
| 4 | **Lista blanca → cuota y ventana** | En piloto, lista blanca literal. En producción se reemplaza por cuota diaria + ventana horaria + freno por tasa de aceptación |

### Warm-up, no negociable

| Semana | Invitaciones/día | Mensajes/día |
|---|---|---|
| 1 | 5 | 10 |
| 2 | 8 | 20 |
| 3 | 12 | 35 |
| 4 | 16 | 50 |
| 5+ | **20–25 (techo)** | 80–100 |

**Freno automático:** si la tasa de aceptación de los últimos 7 días cae bajo 25%, el sistema baja la cuota a la mitad y avisa. Si cae bajo 15%, pausa la cuenta. No es una alerta para que alguien decida: es el sistema frenando solo, porque cuando alguien lee la alerta ya es tarde.

---

## 6. Lo que NO va en el MVP

Esto es la mitad de la especificación. Cada cosa acá adentro es una tentación razonable que hay que resistir.

| Fuera | Por qué | Cuándo |
|---|---|---|
| **Ingesta automática del SII y ChileCompra** | El motor se valida con 200 leads cargados por CSV. Automatizar la fuente antes de saber si el motor convierte es construir una cañería hacia un estanque que no sabemos si tiene fondo | Fase 2 |
| **Enriquecimiento automático en cascada** | En el MVP se enriquece por lote, a mano, con FullEnrich. 200 contactos son 10 minutos | Fase 2 |
| **Scoring elaborado** | La señal ya ordena la cola. Un score de cinco factores sin datos de conversión es un número inventado con más pasos | Fase 3 |
| **IA redactando cada mensaje** | Plantillas con variables + la señal en texto. La IA entra solo en el primer toque, con caché por huella. **Cuatro mensajes generados por IA para alguien que nunca respondió es plata quemada** | Parcial en el MVP |
| **Multi-tenant** | Es el proyecto entero otra vez. Y hasta no resolver las tres preguntas legales, no corresponde | Después de validar |
| **WhatsApp** | El canal existe y funciona en el CRM, pero sumarlo abre la discusión de consentimiento previo, que es más estricta. Es el mejor canal de Chile y va sí o sí — pero en la fase siguiente | Fase 2 |
| **Dashboard bonito** | Seis números en una tabla. Los gráficos vienen cuando haya algo que graficar | Fase 3 |

---

## 7. Seis semanas

| Semana | Qué queda funcionando |
|---|---|
| **1** | Esquema de las 9 tablas · carga por CSV · pantalla de lista de prospectos · **el campo `origen` desde el primer commit** |
| **2** | `lead_emisores` con cuota y warm-up · conexión de Unipile · **enviar UNA invitación real a mano desde la interfaz** · bandeja de mensajes recibidos con webhooks |
| **3** | Motor de pasos: inscripciones, cola de acciones, scheduler cada 15 min · los cuatro candados · modo simulado |
| **4** | Escalera de canales completa · retiro automático de invitaciones a los 14 días · detención por respuesta · Ruta C por email con Brevo (ya está en el stack) |
| **5** | Ingesta de señales de ChileCompra por API — solo deltas, sin el bulk · plantillas con la señal incorporada · aprobación por lote |
| **6** | Opt-out operativo · registro de actividades · las seis métricas · **primera campaña real de 200 prospectos** |

**Semanas 1 a 4 son el motor. Semanas 5 y 6 son lo que lo hace defendible y medible.** Si hay que recortar, se recorta la 5 (las señales se cargan a mano por un mes) — nunca la 6.

Antes de la semana 1, la **Fase 0** del informe anterior: 200 empresas del SII contra tres proveedores de enriquecimiento, y las tres preguntas al abogado. Dos semanas, USD 200. Si la cobertura chilena no da, no hay a quién escribirle y el motor no importa.

---

## 8. Costo del MVP

| Ítem | USD/mes |
|---|---|
| Unipile (hasta 10 cuentas conectadas) | ~$55 |
| Sales Navigator Core (plan anual) | ~$80 |
| FullEnrich · 1.000 créditos, no-match-no-charge | $55 |
| MillionVerifier · ~3.000 verificaciones | ~$11 |
| IP residencial dedicada | ~$12 |
| LLM para el primer toque, con caché por huella | ~$10 |
| Neon + Vercel + Brevo | **$0 marginal** — ya está pagado |
| **Total** | **≈ $225/mes** |

Con una cuenta a régimen: ~440 invitaciones/mes, más el volumen de Open Profile e InMail que salga de la segmentación. Si la aceptación llega a 25% y la conversación a reunión funciona como el benchmark, son **4 a 9 reuniones al mes**. Costo de herramientas por reunión: **$25 a $55**.

⚠️ *Esas tasas vienen de benchmarks de vendors medidos sobre poblaciones estadounidenses. La primera campaña de la semana 6 existe para reemplazarlas por números chilenos.*

---

## 9. Las seis métricas

No más. Un panel que crece se convierte en otra pantalla que nadie mira.

| Métrica | Piso | Qué significa si cae |
|---|---|---|
| **Tasa de aceptación de invitaciones** | **25%** | La única que puede cerrar la cuenta. Bajo 25% el sistema frena solo |
| Tasa de respuesta del nurturing | 10% | La secuencia no dice nada útil, o la señal no era pertinente |
| Respuestas por canal | — | Dice dónde invertir. En Chile, la apuesta es que Open Profile e InMail ganen |
| Toques hasta la primera respuesta | — | Si casi todo pasa en el toque 1, la secuencia sobra. Si nada pasa antes del 4, hay que reescribirla |
| **Costo por conversación** | — | El número que decide si esto reemplaza o complementa la pauta |
| Opt-outs y quejas | **<0,5%** | La señal temprana de que el mensaje se está leyendo como spam |

Las tres primeras se miden por emisor, no solo agregadas: una cuenta puede estar hundiéndose mientras el promedio se ve bien.

---

## 10. Lo que hay que decidir antes de la semana 1

1. **¿Con qué cuenta de LinkedIn se opera?** No la de un socio ni la del CEO. Cuenta dedicada, perfil completo, con actividad orgánica, y asumida como **activo desechable**. Si no existe, hay que crearla y madurarla — eso toma semanas y conviene arrancar hoy.
2. **¿Cuál es el ICP concreto?** Rubro, tramo de ventas y región. El motor no puede empezar con "empresas medianas": necesita un filtro que se pueda escribir como `WHERE`.
3. **¿Qué señal es la primera?** La recomendación es adjudicación en ChileCompra, porque es diaria, verificable y tiene presupuesto detrás. Pero depende de si el ICP le vende al Estado.
4. **¿Quién contesta?** El motor abre conversaciones. Si nadie las atiende en menos de 24 horas, todo lo anterior es un generador de mala reputación bien instrumentado.

La cuarta es la que mata proyectos, y no se resuelve con software — es el mismo punto que en la propuesta del CRM sobre el hábito de captura en la sala.
