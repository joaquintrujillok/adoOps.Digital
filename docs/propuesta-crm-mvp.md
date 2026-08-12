# CRM comercial · Propuesta de MVP

**Preparado por adoOps** · agosto de 2026

---

## El punto de partida

El negocio vende por dos canales que no se conocen entre sí: el punto de venta
de las tiendas (RelBase) y la tienda online (WooCommerce). Cada uno sabe lo suyo
y ninguno sabe del otro. La consecuencia práctica es que hoy no hay forma de
responder preguntas que deberían ser simples:

- ¿Cuántos clientes tenemos, y cuántos siguen activos?
- ¿Cuánto vale un cliente a lo largo del tiempo?
- ¿Quiénes están a punto de dejar de comprar?
- ¿El que compra en la tienda es el mismo que compra en la web?
- ¿Qué producto trae los clientes que después vuelven?

Este MVP existe para responderlas. **El entregable principal es un dashboard**,
y todo lo demás está construido alrededor de que ese dashboard tenga datos
confiables de los cuales alimentarse.

---

## El problema que hay que nombrar antes de empezar

Un punto de venta registra al cliente **solo cuando el cliente pide su boleta con
datos**. En retail presencial, una parte importante de las ventas sale sin RUT,
sin correo y sin teléfono: existen en la contabilidad y no existen como cliente.

Esto no es un problema de software y no se resuelve integrando mejor. Se resuelve
con un hábito en el mostrador, y por eso la propuesta tiene dos piezas que van
juntas:

1. **El dashboard**, que muestra qué se puede saber hoy — incluida la cifra
   incómoda de cuánta venta no tiene dueño.
2. **La captura en el showroom**, que es la palanca para que esa cifra suba.

Vender solo la primera produce un tablero honesto sobre una base incompleta.
Vender solo la segunda produce datos que nadie mira. Van juntas.

> En la demo, la primera cifra del dashboard es el porcentaje de ventas
> identificadas. Es deliberado: es el termómetro del proyecto entero.

---

## Alcance del MVP

### 1. Dashboard de clientes

Cinco vistas sobre la base unificada de POS + e-commerce:

| Vista | Qué responde |
|---|---|
| **Panorama** | Cuántos clientes hay, cuántos están activos, cuánto vale la base, de dónde viene la venta |
| **Segmentos RFM** | En qué estado está cada cliente y qué corresponde hacer con cada grupo, incluida la migración entre segmentos |
| **Valor de vida** | Cuánto vale un cliente, cómo se comporta cada cohorte de entrada y cuánto más valen los que compran en ambos canales |
| **Producto** | Por qué categoría entra cada cliente, qué compra después y qué producto trae los clientes que vuelven |
| **Calidad del dato** | Qué porcentaje de la venta tiene cliente asociado y con qué se puede contactar a la base |

**Segmentación RFM** con once segmentos nombrados (campeones, leales, en riesgo,
no los puedo perder, hibernando…), cada uno con la acción que le corresponde.
Los cortes se calculan sobre la base real, no con umbrales fijos que envejecen.

**Valor de vida** histórico y proyectado, con cohortes por mes de adquisición
para responder si los clientes nuevos valen más o menos que los de antes a la
misma edad.

### 2. Captura en el showroom

Formulario público con código QR, uno por tienda, que el visitante llena en su
teléfono en menos de un minuto: nombre, teléfono, qué vino a ver y consentimiento
explícito. Entra directo al CRM, se cruza con el cliente si ya existía, y queda
en una bandeja de seguimiento con estado.

Sirve igual para activaciones y eventos: el código lleva el nombre del evento y
las visitas quedan atribuidas a él.

**El consentimiento es un campo con fecha, no una casilla decorativa.** Sin él,
el dato sirve para el registro de la visita y para nada más.

### 3. CRM operativo, deliberadamente mínimo

- **Contactos** — la ficha del cliente con su historial de compras, su segmento
  y su valor.
- **Señales de conversación** — el motor de activación (abajo).
- **Conversaciones** — WhatsApp con la cadena de controles de envío.
- **Configuración** — umbrales, pesos y interruptores editables sin programar.

Sin embudos de venta, sin automatizaciones complejas, sin campos a medida. Lo
que no se usa en las primeras semanas no entra al MVP.

### 4. Motor de señales de conversación

Es la respuesta a "¿cómo hago que el ejecutivo contacte a la gente de forma
constante sin inventar excusas?".

El sistema detecta hechos que justifican un contacto **hoy**, y cada señal trae
tres cosas: **el motivo**, **la evidencia** que lo sostiene y **un borrador**
listo para editar.

Seis reglas en el MVP:

| Señal | Se dispara cuando |
|---|---|
| Ventana de recompra | Pasó su propio ciclo de compra, no un promedio general |
| Mantención pendiente | Su pieza cumple el plazo de servicio recomendado |
| Aniversario | Se cumple un año de su primera compra |
| Complemento | Clientes de su mismo segmento compran algo que él no tiene |
| Cumpleaños | Cumple en los próximos días |
| Reactivación | Era buen cliente y dejó de venir |

Dos decisiones de diseño que conviene mantener:

- **La señal se acciona o se descarta, nunca se acumula**, y todas vencen. Un
  panel que solo crece se convierte en otra bandeja que nadie mira.
- **El borrador nunca se manda solo.** El sistema propone, la persona edita y
  decide. Un mensaje automático a un cliente que gasta millones es la forma más
  rápida de que la relación se sienta industrial.

**Fase 2 (fuera del MVP):** sumar señales de fuentes externas —novedades de las
marcas que le interesan, eventos del rubro— y una biblioteca de contenidos
etiquetada por marca, categoría y segmento, para que el sistema proponga a qué
clientes le calza cada pieza de contenido.

---

## Arquitectura de integración

```
   RelBase (POS)                    WooCommerce
        │                                │
   polling incremental             webhooks + reconciliación
   cada 15 min                     diaria
        │                                │
        └────────────┬───────────────────┘
                     ▼
          Resolución de identidad
       (RUT → correo → teléfono normalizado)
                     ▼
            Base unificada del CRM
        clientes · ventas · líneas de venta
                     ▼
     Analítica  ·  Señales  ·  Conversaciones
```

### RelBase

De su documentación pública:

- Autenticación con **dos tokens**: uno de empresa —que se solicita a RelBase— y
  uno de usuario integrador que se crea desde la cuenta. Conviene crear un
  usuario integrador dedicado, para poder revocarlo sin afectar a nadie más.
- Recursos disponibles: productos, clientes, ventas y documentos tributarios,
  cotizaciones.
- Paginación de 12 registros por página, con `meta.total_pages`.
- **Límite de 7 solicitudes por segundo.** La sincronización se diseña con eso
  como techo, no como aspiración.
- **No documenta webhooks**, así que la sincronización es por consulta periódica
  con marca de agua sobre la fecha del documento.

### WooCommerce

- API REST v3 con clave y secreto de consumidor.
- Webhooks de creación y actualización de pedidos, que dan casi tiempo real.
- Una reconciliación diaria por consulta cubre los webhooks que se pierdan: un
  webhook que no llegó no avisa que no llegó.

### Resolución de identidad

El corazón del proyecto. Una persona puede aparecer como un RUT en una boleta,
un correo en la tienda online y un teléfono en el showroom. El orden de
resolución es **RUT → correo → teléfono normalizado**, y cuando dos registros
colisionan se marcan para revisión humana en vez de fusionarse solos: fusionar
mal a dos clientes es más caro que tenerlos duplicados unos días.

Toda venta importada lleva su identificador de origen, y la clave de
deduplicación es la dupla **(origen, id externo)**: el POS y la tienda numeran
por su cuenta, y el documento 1041 existe en los dos. Con eso, reprocesar una
sincronización nunca duplica ventas.

---

## Fases y tiempos

| Fase | Qué entrega | Duración estimada |
|---|---|---|
| **1 · Fundación de datos** | Integración con RelBase y WooCommerce, resolución de identidad, base unificada, dashboard completo | 4 a 6 semanas |
| **2 · Captura** | Formulario con QR por tienda, bandeja de seguimiento, indicador de identificación en el dashboard | 2 semanas |
| **3 · Activación** | Motor de señales, alertas al ejecutivo, WhatsApp con controles de envío | 3 a 4 semanas |

Las fases 2 y 3 pueden solaparse. La fase 1 no: sin datos confiables, todo lo
demás se construye sobre arena.

---

## Qué necesitamos del cliente

1. **Credenciales de RelBase**: token de empresa (se solicita a
   `contacto@relbase.cl`) y un usuario integrador creado para esto.
2. **Claves de la API de WooCommerce** con permiso de lectura.
3. **Una persona de contacto** que conozca la operación del mostrador: la mitad
   de las decisiones del proyecto son sobre cómo trabaja el equipo, no sobre
   tecnología.
4. **Definición de quién es "cliente activo"** para el negocio. Nosotros
   proponemos doce meses; en alta gama puede ser más.
5. **Acuerdo sobre el hábito de captura** en el mostrador. Es el único requisito
   que no se resuelve con software.

---

## Supuestos y riesgos

| Supuesto | Riesgo si no se cumple | Cómo lo manejamos |
|---|---|---|
| Los DTE de RelBase traen los datos del cliente cuando existen | El cruce de identidad queda solo con el correo del e-commerce | Auditoría de datos en la primera semana, antes de comprometer alcance |
| El histórico disponible cubre al menos 24 meses | Las cohortes y el valor de vida quedan sin base | Se muestra lo que haya y se marca explícitamente el período cubierto |
| El e-commerce identifica a todos sus compradores | Cae el porcentaje de identificación global | Es lo esperable; el dashboard lo separa por canal |
| El equipo de tienda adopta la captura | El dashboard queda estancado en la cifra de hoy | El indicador de identificación se sigue semanalmente desde el día uno |

**El riesgo principal no es técnico.** Es que la base identificada sea más chica
de lo que se espera. Por eso la primera semana del proyecto es una auditoría de
datos con acceso de lectura: antes de comprometer un alcance, medimos cuántas
ventas tienen cliente y con qué se puede contactar a esa gente.

---

## Lo que se ve en la demo

La demostración corre sobre una base simulada con la forma de los datos reales:
1.200 clientes, 3.500 ventas de tres años llegando por los dos canales, con la
distribución que tiene el retail de verdad —dos de cada tres clientes compran una
sola vez— y con un porcentaje de ventas sin cliente identificado.

Nada de eso es adorno: un dashboard de RFM con veinte clientes de prueba no
muestra nada, y uno donde todos los clientes compran tres veces muestra una
realidad que no existe.
