# CRM adoOps — estado y pendientes

Documento de traspaso. Con esto se retoma el trabajo sin la conversación previa.
La referencia técnica del módulo está en [`docs/crm.md`](./crm.md); esto es solo
qué está hecho, qué falta y qué no hay que romper.

**Última actualización:** 12 de agosto de 2026 · **el CRM pasó a ser dedicado a
Highend Chile**. Catálogo real, identidad de marca y toda la analítica
recalibrada al volumen de nicho. Verificado en local y commiteado.

---

## Qué es

CRM comercial en `/crm`, dentro de la web corporativa (mismo repo, mismo deploy,
misma base de Neon). Se construyó para **salir a vender el producto** a un
prospecto concreto: **Highend Chile** (<https://highend.cl>), distribuidor de
audio de alta fidelidad.

**Ya no hay mock de otro rubro.** Hasta el 11 de agosto la demo corría con una
boutique de relojería ficticia ("Belmont"), elegida para no ser evidente con el
producto del cliente. Eso se reemplazó: ahora el catálogo es **el real de
Highend** —70 productos, 26 marcas, 11 categorías, de $49.900 a $39.900.000— y
solo los clientes y las ventas son simulados.

### El dato que gobierna todo el diseño

**Tres o cuatro ventas al mes.** Lo dio el cliente y obligó a rehacer el modelo
analítico, no a ajustarlo. Antes de tocar cualquier cosa de analítica, leer la
sección «La escala cambia qué es verdad» más abajo.

- Producción: <https://www.adoops.digital/crm>
- Usuarios: `joaquin` / `adoops2026` (admin), `demo` / `Highend2026` (admin),
  `carla` / `demo1234` (gerente), `matias` / `demo1234` (vendedor),
  `nelson` / `demo1234` (gerente, para probar).
  `gerente` y `admin` pasan los mismos candados (`requireGerencia`), así que
  Nelson puede tocar todo, Configuración incluida.
- `general.empresa` en `crm_settings` quedó en **"Highend Chile"**: es lo que se
  muestra bajo el nombre del usuario en la barra lateral.
- Local: `npm run dev -- --port 3100` en `/Users/joaquintrujillo/Proyectos/AdoOps/adoOps.Digital`

---

## Qué está listo

| Módulo | Ruta | Estado |
|---|---|---|
| Visión general | `/crm` | Cifras + lectura redactada, con caché y `<Suspense>` |
| Contactos | `/crm/contactos` | Cartera con etiquetas, ficha 360 con potencial explicado |
| Conversaciones | `/crm/conversaciones` | Tres columnas, pestañas, respuestas rápidas con `/` |
| Cotizaciones | `/crm/cotizaciones` | Completo: armador, documento editable, cierre de venta |
| Oportunidades | `/crm/oportunidades` | Kanban con `Etapa (%)`, iconos de actividad y modal |
| Pipeline y KPIs | `/crm/pipeline` | Tres pestañas: oportunidades, KPIs semanales, mix |
| Reportes | `/crm/reportes` | Trimestre con lectura, imprimible |
| Alertas y acciones | `/crm/inteligencia` | 9 reglas, cada una con acción ejecutable |
| Segmentos y recompra | `/crm/segmentos` | Segmentos, ventana de recompra, cross-selling |
| Marketing y origen | `/crm/marketing` | Atribución primer/último toque, CAC y ROI |
| Catálogo e inventario | `/crm/productos` | Stock, disponibilidad, riesgo por sobreventa |
| Configuración | `/crm/configuracion` | Pesos, umbrales e interruptores |

---

## Conversaciones en tres columnas — hecho

`/crm/conversaciones` es ahora una sola pantalla con `?hilo=N`: bandeja con
pestañas · hilo · ficha del contacto. La ruta vieja `/crm/conversaciones/[id]`
quedó como redirección permanente, porque la ficha del contacto, la cartera y la
cotización enviada ya linkeaban a `?hilo=` desde antes (y ese link no hacía
nada).

Lo que se agregó y conviene no deshacer sin leer:

**Dos columnas nuevas en `crm_wa_conversations`**, por
`scripts/crm-migrar-bandeja.mjs` (idempotente, aditivo, ya corrido en la base):

- `leido_en` — se marca al abrir el hilo. "No leído" es una marca de la persona
  que atiende, no un cálculo sobre la dirección del último mensaje: derivarlo
  haría que una conversación leída y dejada para mañana reaparezca como
  pendiente en cada recarga, y la pestaña deja de servir.
- `destacada` — se prende con la estrella del encabezado del hilo. Un destacado
  que se calcula solo no es un destacado.

**La bandeja abre en «Todos», no en «No leídos».** No leídos es la primera
pestaña porque es la que más se usa, pero abrir ahí significa que el día que el
equipo se puso al día la pantalla arranca vacía, y una bandeja vacía se lee como
una bandeja rota.

**Los borradores se aprueban dentro del hilo**, en la burbuja, con el texto a la
vista. El botón masivo «Aprobar los N borradores» sigue en el encabezado, pero
lo normal pasó a ser leer antes de aprobar. Los retenidos y fallidos muestran su
motivo y su botón de reintento en la misma burbuja.

**Las respuestas rápidas viven en `lib/crm/respuestas-rapidas.ts`** y se abren
escribiendo `/` al principio del mensaje. Se copió el criterio de CDC: lo que el
sistema no sabe —horario, dirección, formas de pago, plazo de garantía y plazo
de servicio— va con un hueco visible entre corchetes, y el cuadro de redacción
avisa mientras quede un corchete sin completar. Ninguna promete un plazo: la
pieza puede estar en vitrina, en otra boutique o en fábrica.

**El teléfono se edita como se lee.** En la base vive en E.164 sin `+`
(`56943851163`); el campo muestra `+56 9 4385 1163` y `normalizarTelefono`
vuelve a la forma guardada. Y editar el teléfono del contacto **no mueve la
conversación**: el hilo está amarrado al número por el que llegaron los mensajes.
Cuando los dos difieren, la ficha lo dice.

**La ficha lateral no reusa `fichaCliente()`.** Esa arma la ficha 360 con siete
consultas; el panel necesita cinco datos de identidad y tres cifras, y se pinta
en cada apertura. Está en `fichaLateral()`, una sola consulta.

## Embudo con el formato de la referencia — hecho

En `/crm/oportunidades`, el encabezado de cada columna dice **`Etapa (porcentaje)`**
—"Propuesta (50%)"— y debajo el conteo y el monto, bruto y ponderado. Ver la
probabilidad arriba de la columna es lo que hace que el ponderado deje de ser un
número que aparece de la nada.

La tarjeta lleva una **fila de iconos de actividad con su contador**. Dos
decisiones que conviene no revertir:

- **Los tipos son los que el CRM registra de verdad** (`nota`, `llamada`,
  `email`, `reunion`, `tarea`), no los de la captura de GoHighLevel. Un ícono de
  "documento" que siempre marca cero porque el sistema nunca escribe ese tipo
  enseña a ignorar la fila entera.
- **Solo se pintan los que tienen algo.** Cinco íconos en gris con cero al lado
  son ruido en una tarjeta que se lee de reojo.

Los conteos salen de **una sola consulta agrupada** (`actividadesPorDeal` en
`lib/crm/pipeline.ts`), no de cinco subconsultas dentro de `listarDeals`: esa
consulta la usan otras cuatro pantallas que no necesitan estos conteos.

## Pipeline y KPIs — hecho

Pantalla nueva en `/crm/pipeline`, ya en el menú. Las pestañas y los filtros
viajan en la URL: una vista filtrada se puede pegar en un mensaje, y «atrás»
deshace el último filtro en vez de salir de la pantalla.

- **Oportunidades:** periodo (1 sem · 15 días · 1 mes · 3 meses) o rango de
  fechas a medida, filtro por etapa y por categoría, una tarjeta por etapa y la
  tabla con la categoría editable en línea.
- **KPIs semanales:** seis métricas × ocho semanas, con el total a la izquierda.
- **Mix de categoría:** barra apilada, tarjeta por categoría con monto, % del
  pipeline y HHI, y la tabla de riesgo de concentración.

**Una columna nueva: `crm_deals.categoria`**, por `scripts/crm-migrar-pipeline.mjs`
(idempotente, aditivo, ya corrido). NULL significa "usa la de las piezas" —la de
mayor subtotal, no la más repetida—; solo cuando alguien la corrige queda
escrita, y desde ahí manda. Existe porque la derivación falla justo donde
importa: un amplificador cotizado dentro de una instalación de cine pesa en
"Amplificadores" cuando el negocio era de "Audio Video", y eso lo sabe quien
vende, no el catálogo. Una columna llena de NULL dice que nadie tuvo que
intervenir.

**El periodo abre en 3 meses.** Un pipeline de alta gama se mueve en semanas: con
la ventana de una semana la pantalla arranca casi vacía y parece que no hay
negocio.

**Las columnas de la tabla de KPIs se arman en JS, no salen de las filas de la
consulta.** Si salieran de los resultados, una semana sin movimiento
desaparecería y la tabla mentiría por omisión justo sobre lo que hay que mirar.

**El HHI se calcula por cliente dentro de la categoría**, no por oportunidad: dos
negocios abiertos con el mismo coleccionista son un solo riesgo.

## Minimalismo — primera pasada hecha

**`Lectura` es ahora un `<details>` plegado con su primera frase a la vista.** Se
resolvió en la primitiva (`Plegable` en `components/crm/ui.tsx`) y no pantalla
por pantalla, así que las diez que usan `Lectura` o `LecturaNarrada` cayeron de
una vez. La primera frase ES el titular —así se le pide al narrador— y el resto
queda a un clic.

`<details>` nativo y no estado de React: plegar es exactamente lo que el elemento
hace, y reimplementarlo significaría mandar JavaScript para rehacer el
comportamiento de teclado y el de buscar-en-la-página, que una versión casera
casi siempre pierde.

**Los mensajes largos del hilo se recortan a tres líneas** con «ver más». El
umbral es por largo del texto (220 caracteres) y no por alto medido: medir obliga
a pintar, comparar `scrollHeight` y volver a pintar, y en un hilo de cuarenta
mensajes eso es un salto visible en cada carga.

**Contacto y oportunidad abren en modal**, con rutas interceptoras de Next
(`app/crm/(app)/@modal/(.)contactos/[id]` y `(.)oportunidades/[id]`). Navegando
desde adentro del CRM se abre encima; recargando o llegando por un link pegado se
pinta la ficha completa. La URL sigue sirviendo para mandársela a alguien, que es
lo que un modal con estado local pierde.

El caparazón (`components/crm/Modal.tsx`) es un `<dialog>` nativo: `showModal()`
trae gratis Escape, el foco atrapado, el fondo inerte y el backdrop. Cierra con
`router.back()` porque el modal ES una ruta: cerrarlo tiene que deshacer la
navegación, si no el botón «atrás» lo reabre.

**Nueva cotización también abre en modal** (`@modal/(.)cotizaciones/nueva`), con
`ancho="ancho"` porque el armador lleva una tabla de piezas adentro. Es la que
más gana: se cotiza en el mostrador con el cliente enfrente, y las tres entradas
al armador son justo las pantallas a las que hay que volver después. No hizo
falta coordinar el cierre: `accionCrearCotizacion` redirige a la cotización
recién creada, esa navegación resuelve el slot a `default.tsx` y el modal se
cierra solo.

**Las tarjetas del tablero se arrastran entre columnas**
(`components/crm/ArrastreEtapa.tsx`), con la API nativa de HTML y sin librería:
mover una tarjeta entre cuatro columnas es exactamente lo que esa API hace.

El arrastre se agregó **encima** del selector de etapa, no en su lugar, y ahí hay
una decisión que conviene no revertir: el comentario viejo de `MoverEtapa.tsx`
descartaba el arrastre por accesibilidad, y tenía razón a medias. La API de
arrastre de HTML no existe en táctil y no se maneja con teclado ni con lector de
pantalla, así que reemplazar el selector dejaría el tablero inoperable justo para
quien más lo necesita. Conviven: el arrastre es el atajo para el mouse, el
selector es la garantía.

Dos detalles del arrastre que están ahí a propósito: soltar una tarjeta en su
propia columna **no** escribe nada —una actividad de "movió de propuesta a
propuesta" ensucia la bitácora que alimenta las alertas de estancamiento— y
mover a «Perdido» pide el motivo, igual que el selector.

El criterio detrás de todo esto: **si un dato no cambia lo que la persona va a
hacer en los próximos treinta segundos, no va en la vista de primer nivel.**

---

## La escala cambia qué es verdad

Con 3-4 ventas al mes hay técnicas de analítica estándar que **dejan de medir y
empiezan a inventar**. Esto es lo que se cambió y por qué; si alguien revierte
algo de acá, el dashboard vuelve a mentir en silencio.

| Antes | Ahora | Por qué |
|---|---|---|
| RFM por quintiles | **Cortes absolutos** (`CORTES_RECENCIA`, `CORTES_MONTO` en `lib/crm/analitica.ts`) | Con 76 clientes el quintil superior son 15 personas *por definición*, hayan gastado $40M o $600K. Y bastaba que entrara un cliente de $39,9M para que todos bajaran un escalón sin cambiar su conducta |
| Cohortes mensuales | **Anuales, medidas en trimestres** | Entran ~20 clientes nuevos al año: una cohorte mensual son 2 personas, y ahí el promedio no muestra una tendencia sino a uno de los dos |
| Series mensuales | **Trimestrales** | Que febrero tenga 2 ventas y marzo 5 no significa nada |
| Solo ticket promedio | **Mediana junto al promedio** | El catálogo va de $49.900 a $39.900.000: una venta de parlantes arrastra el promedio de todo un año |
| Sin ventas nominales | **Últimas ventas con nombre**, arriba en el panorama | A este volumen es la vista más útil del panel |

**El corte de recencia R1 es "más de 3 años".** Por eso el seed genera **cuatro**
años de historia (`DIAS_HISTORIA = 1460`): con tres, esa fila del RFM quedaba
vacía por construcción y se leía como un error. La tentación de mover el corte a
2,5 años para que se llenara está explícitamente descartada en el comentario del
script — sería deformar el modelo para que el mock se vea bien.

---

## Módulo de sistemas — lo único que no serviría en otro rubro

`lib/crm/sistemas.ts` + vista `?vista=sistemas`.

Un equipo de audio es una cadena: **fuente → previo → etapa → parlantes**, más
soporte (cables, acondicionador, racks, tubos). Suena tan bien como su eslabón
más flojo. El módulo reconstruye qué tiene armado cada cliente desde sus compras
y produce dos tipos de conversación:

- **Completar** — le falta un eslabón para cerrar el equipo.
- **Equilibrar** — tiene una pieza bajo el 25% de su pieza más cara.

Dos decisiones que costó afinar y conviene no deshacer:

1. **`nivelTipico` (mediana) para recomendar, no `nivel` (máximo).** Apuntando al
   pico, todas las recomendaciones terminaban sugiriendo el mismo producto del
   tope del catálogo — la señal más clara de que no estaba mirando al cliente.
2. **Solo cuenta como "sistema incompleto" quien tiene 2+ piezas.** Contando a
   los de una sola compra salían 44 clientes sin previo sobre 54, y el panel
   decía "casi todos", que es lo mismo que no decir nada.

---

## Pendientes

1. **Forms anidados en `/crm/senales`.** Hay un `<form action={accionResolverSenal}>`
   dentro de un `<form action={accionEnviarSenal}>` (~líneas 139-210 de
   `app/crm/(app)/senales/page.tsx`). Es HTML inválido y dispara error de
   hidratación de React en cada carga. Se arregla con `formAction` en los botones.
2. **`vidaPromedioDias` da 8 meses**, que no refleja el ciclo largo de este rubro
   (uno a dos años entre compras). Es un problema del cálculo o del seed; está
   marcado en `docs/brief-presentacion-crm.md` como cifra que **no** hay que
   mostrar hasta corregirla.
3. **La variación de facturación da −38,8%.** Es ruido del mock: con 47 ventas al
   año, dos operaciones grandes mueven la cifra decenas de puntos. No es un bug,
   pero conviene decidir si se suaviza el seed antes de la reunión.
4. **Segunda pasada de minimalismo** en `/crm` y `/crm/reportes`, que siguen
   mostrando cuatro `StatTile` y dos gráficos antes de cualquier acción.
5. **El modal de contacto no abre desde `/crm/pipeline`** (sí desde el kanban y
   la cartera).
6. **`docs/crm.md` está desactualizado** en su tabla de módulos y en la
   descripción de la base de demostración.

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

**React no toca el `defaultValue` de un campo que ya existe.** Aparece de dos
formas y las dos ya mordieron:

- *Al rechazar.* Si una Server Action rechaza el guardado —un teléfono mal
  escrito— React vacía el formulario y la persona ve el error sin tener ya qué
  corregir. La salida es devolver lo tecleado en el resultado de la acción
  (`accionGuardarContacto` + `components/crm/FormularioContacto.tsx`).
- *Al guardar bien.* Un `<select>` que ya está montado se queda mostrando la
  opción anterior aunque el servidor haya revalidado y las etiquetas ya digan
  otra cosa: la fila dice una cosa y la base otra
  (`components/crm/CategoriaEnLinea.tsx`).

En los dos casos la salida es la misma: **`key` con el valor del servidor**, para
que el campo se remonte cuando ese valor cambia.

**`.crm-root` lleva `min-height: 100vh`.** Poner esa clase en el `<dialog>` de un
modal lo estira de borde a borde. No hace falta: el `<dialog>` ya cuelga de
`.crm-root` en el DOM y hereda los tokens igual, porque el top layer cambia el
orden de pintado, no la herencia.

**Un `<details>` cerrado imprime solo su resumen.** Como `Lectura` viene plegada,
`/crm/reportes` —que se lleva impreso a la reunión— le pasa `abierto`. Cualquier
pantalla nueva pensada para papel tiene que hacer lo mismo.

**Las rutas paralelas exigen `default.tsx`.** Sin `app/crm/(app)/@modal/default.tsx`
devolviendo `null`, cualquier navegación que no calce con un interceptor deja el
slot sin resolver y la ruta entera responde 404.

**Las fechas del hilo se formatean en el servidor, no en el componente de
cliente.** Formatearlas en el navegador hace que el HTML del servidor y el del
cliente no coincidan cuando difieren el huso o el idioma del sistema, y React
descarta el árbol entero: el hilo parpadea en cada carga.

---

## Scripts

```bash
node scripts/crm-create-tables.mjs      # crea las tablas (idempotente)
node scripts/crm-migrar-v2.mjs          # migración al eje contacto (idempotente)
node scripts/crm-migrar-bandeja.mjs     # leido_en + destacada (idempotente, ya corrido)
node scripts/crm-migrar-pipeline.mjs    # crm_deals.categoria (idempotente, ya corrido)
node scripts/crm-migrar-analitica.mjs    # origen, identidad, showroom, señales (idempotente)
node scripts/crm-usuario.mjs <u> <c> <rol> "Nombre"

# Base de demostración de Highend — EN ESTE ORDEN
node scripts/crm-catalogo-highend.mjs   # catálogo real (70 productos)
node scripts/crm-catalogo-highend.mjs --listar   # solo muestra qué haría
node scripts/crm-seed-highend.mjs       # 76 clientes, 156 ventas, 78 visitas
node scripts/crm-seed-highend.mjs --limpiar      # borra los datos, no los usuarios
```

**El catálogo va primero.** `crm-catalogo-highend.mjs` trunca `crm_products`
junto con `crm_order_items` y `crm_quote_items`: borrar productos sin borrar las
ventas dejaría líneas apuntando a ids que ya no existen. El seed reconstruye
todo sobre los ids nuevos.

Ambos son **determinísticos** (semilla fija): dos corridas dan exactamente lo
mismo. Si se regeneran, **todas las cifras de `docs/brief-presentacion-crm.md`
cambian** y hay que volver a medirlas antes de cualquier reunión.

`scripts/crm-seed.mjs` y `crm-seed-analitica.mjs` son los del mock de relojería.
Quedaron en el repo por si hace falta volver atrás, pero **no correrlos**: dejan
la base con un catálogo que no es el del cliente.

Tras sembrar hay que apretar **«Volver a analizar»** en Alertas y acciones, o
llamar a `/api/crm/cron/alertas` con `Authorization: Bearer $CRON_SECRET`.
