# CRM adoOps — estado y pendientes

Documento de traspaso. Con esto se retoma el trabajo sin la conversación previa.
La referencia técnica del módulo está en [`docs/crm.md`](./crm.md); esto es solo
qué está hecho, qué falta y qué no hay que romper.

**Última actualización:** 11 de agosto de 2026 · commit `6bf4a22` · desplegado en
producción.

---

## Qué es

CRM comercial en `/crm`, dentro de la web corporativa (mismo repo, mismo deploy,
misma base de Neon). Se construyó para **salir a vender el producto**: el
prospecto concreto es una boutique de audio de alta fidelidad, y el mock imita su
mecánica comercial sin usar su producto.

**El mock es Belmont Alta Relojería** — relojería fina y alta joyería, showroom en
Alonso de Córdova. Marcas y clientes inventados. Se eligió el rubro porque
reproduce lo que importa mostrar: ticket alto, venta consultiva por WhatsApp,
cita en showroom, catálogo por marca, coleccionista que vuelve, accesorios y
servicio para cross-sell.

- Producción: <https://www.adoops.digital/crm>
- Usuarios: `joaquin` / `adoops2026` (admin), `carla` / `demo1234` (gerente),
  `matias` / `demo1234` (vendedor)
- Local: `npm run dev -- --port 3100` en `/Users/joaquintrujillo/Proyectos/AdoOps/adoOps.Digital`

---

## Qué está listo

| Módulo | Ruta | Estado |
|---|---|---|
| Visión general | `/crm` | Cifras + lectura redactada, con caché y `<Suspense>` |
| Contactos | `/crm/contactos` | Cartera con etiquetas, ficha 360 con potencial explicado |
| Conversaciones | `/crm/conversaciones` | Funciona · **falta el rediseño de 3 columnas** |
| Cotizaciones | `/crm/cotizaciones` | Completo: armador, documento editable, cierre de venta |
| Oportunidades | `/crm/oportunidades` | Funciona · **falta el formato de la referencia** |
| Reportes | `/crm/reportes` | Los anteriores · **falta la vista de 3 pestañas** |
| Alertas y acciones | `/crm/inteligencia` | 9 reglas, cada una con acción ejecutable |
| Segmentos y recompra | `/crm/segmentos` | Segmentos, ventana de recompra, cross-selling |
| Marketing y origen | `/crm/marketing` | Atribución primer/último toque, CAC y ROI |
| Catálogo e inventario | `/crm/productos` | Stock, disponibilidad, riesgo por sobreventa |
| Configuración | `/crm/configuracion` | Pesos, umbrales e interruptores |

---

## Pendientes

### 1. Conversaciones en tres columnas

Rediseñar `/crm/conversaciones` con el layout de la referencia (GoHighLevel):

- **Izquierda:** bandeja con pestañas **No leídos · Todos · Recientes ·
  Destacados**, contador de no leídos, y por conversación el nombre, el extracto
  del último mensaje y la fecha.
- **Centro:** el hilo, con el encabezado del contacto y los controles de la
  conversación.
- **Derecha:** **ficha del contacto** — dueño, etiquetas, y los campos
  (nombre, correo, teléfono) editables sin salir de la pantalla.

Agregar las **respuestas rápidas invocables con `/`**, como en CDC
(`CDC-CRM/apps/crm/lib/respuestas-rapidas.ts`). Ahí hay una decisión que conviene
copiar: lo que el sistema no sabe (horarios, direcciones) va con un hueco visible
entre corchetes en vez de un dato inventado — una respuesta rápida que miente es
peor que teclearla.

### 2. Embudo de oportunidades con el formato de la referencia

En `/crm/oportunidades`, acercar el kanban a la captura de GoHighLevel:

- Encabezado de columna con **`Etapa (porcentaje)`** — "En Propuesta (50%)" — y
  debajo el conteo y el monto de la columna.
- Tarjeta con cliente, valor y una fila de **iconos de actividad** (nota,
  etiqueta, documento, tarea, agenda) con su contador.

El dato ya existe: `ETAPAS` en `lib/crm/etapas.ts` tiene la probabilidad de cada
etapa, y `crm_activities` tiene los conteos por tipo.

### 3. Pipeline y KPIs — tres pestañas

Pantalla nueva en `/crm/pipeline`, con el formato de las capturas de "Pipeline ·
Fábrica". **Está fuera del menú** hasta que exista (`app/crm/(app)/layout.tsx`).

- **Oportunidades:** filtros de periodo (1 sem · 15 días · 1 mes · 3 meses +
  rango de fechas), filtro por etapa y por categoría, tarjetas de resumen por
  etapa y tabla con la categoría editable en línea.
- **KPIs semanales:** tabla de métricas por semana (últimas 8), una fila por
  métrica y una columna por semana, con la columna de total a la izquierda.
- **Mix de categoría:** el "mix de cartera" de la referencia, pero por
  **categoría de producto** en vez de unidad de negocio. Tarjeta por categoría
  con monto, % del pipeline y concentración (HHI), barra apilada del mix, y
  tabla de riesgo de concentración marcando en rojo lo que pase del 50% de su
  categoría.

---

## Lo que no hay que revertir

**El contacto es el eje, no la empresa.** Estado, fuente, dueño y etiquetas viven
en `crm_contacts`. `account_id` quedó opcional en todas las tablas y existe solo
para el regalo corporativo. Volver a colgar todo de la cuenta deja el 90% de la
cartera con la ficha vacía.

**Las cifras las calculan reglas, no el modelo.** El narrador
(`lib/crm/narrador.ts`) recibe un resumen ya cerrado y solo lo redacta; tiene
prohibido agregar números. Si se apaga o falla, el texto sale de plantilla y la
pantalla dice cuál de las dos cosas ocurrió.

**Nada de WhatsApp sale sin cruzar cuatro candados:** aprobación humana →
conversación sin BAJA → interruptor general → lista blanca.
`lib/crm/whatsapp-dispatch.ts` es el único módulo que importa el cliente de
WaSender, y esa es la propiedad que hace auditable la promesa. Modo simulado
encendido por defecto.

**En cotizaciones, el precio se relee del catálogo, nunca se acepta del
formulario.** Y el nombre y el precio se congelan al cotizar: si mañana sube el
precio de lista, la cotización que ya se envió tiene que seguir diciendo lo que
decía.

**La ventana del puntaje es de 24 meses.** Con 12, un coleccionista que compró
hace catorce puntúa igual que alguien que nunca compró, y es justo a quien hay
que llamar.

---

## Trampas conocidas

**La base local ES la de producción.** Misma `DATABASE_URL`. Correr
`node scripts/crm-seed.mjs` reescribe lo que ve el cliente en producción. El seed
es determinístico (semilla fija), así que reproduce siempre los mismos datos, pero
no hay que correrlo en medio de una demo.

**Los montos van en `float8`, no en `int`.** Los tickets de alta gama llegan a
decenas de millones y `sum(monto * probabilidad)` desborda el `integer` de
Postgres (tope 2.147.483.647): la consulta muere con *integer out of range*. Toda
agregación de dinero lleva `::float8`; los contadores siguen en `::int`.

**Subconsultas correlacionadas: nombrar la tabla en texto plano.** Drizzle solo
califica la columna con su tabla cuando la consulta tiene joins; sin joins escribe
`"id"` a secas y adentro de la subconsulta se resuelve contra la tabla
equivocada. La consulta corre sin error y devuelve cifras falsas — pasó, y las 28
cuentas puntuaban idéntico. Por eso se escribe `crm_contacts.id`, no
`${crmContacts.id}`.

**No correr `npm run build` con el dev server levantado:** corrompe `.next` y
todas las rutas devuelven 404. Se arregla con `rm -rf .next` y reiniciar.

**`drizzle-kit push` no sirve acá:** al ver tablas nuevas junto a tablas que no
están en el schema pregunta si es un rename, y sin TTY se cae. Los cambios de
esquema van por `scripts/crm-create-tables.mjs` y `scripts/crm-migrar-v2.mjs`,
que son idempotentes y solo aditivos.

**La narración se cachea por huella de las cifras** (`crm_narraciones`). Si se
agrega una pantalla con narración, hay que pasarle una `clave` distinta a
`narrar()` y envolverla en `<Suspense>`; sin `clave` no se cachea y la pantalla
vuelve a pagar seis segundos por visita.

---

## Scripts

```bash
node scripts/crm-create-tables.mjs      # crea las tablas (idempotente)
node scripts/crm-migrar-v2.mjs          # migración al eje contacto (idempotente)
node scripts/crm-usuario.mjs <u> <c> <rol> "Nombre"
node scripts/crm-seed.mjs               # base de demostración
node scripts/crm-seed.mjs --limpiar     # borra los datos, no los usuarios
```

Tras sembrar hay que apretar **«Volver a analizar»** en Alertas y acciones, o
llamar a `/api/crm/cron/alertas` con `Authorization: Bearer $CRON_SECRET`.
