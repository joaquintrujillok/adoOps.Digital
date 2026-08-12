# Brief para construir la presentación · CRM Highend Chile

**Para:** el agente que va a producir la PPT
**De:** adoOps
**Fecha:** agosto de 2026
**Versión:** 2 — reescrita tras dedicar el CRM a Highend Chile

Este documento es autosuficiente: contiene el contexto, la narrativa, el
contenido de cada lámina, las cifras exactas y la propuesta económica. No hace
falta pedir nada más para construir la presentación.

> **Si conoces la versión 1 de este brief, léelo completo igual.** No cambiaron
> solo las cifras: cambió el argumento central. La versión anterior se apoyaba
> en que un tercio de las ventas no tenía cliente asociado. Con el volumen y el
> ticket reales de este cliente eso es falso, y sostenerlo habría durado hasta
> la primera pregunta del gerente. El diagnóstico nuevo está en la sección 2 y
> es más fuerte, no más débil.

---

## 0. Lo primero que tienes que entender

**No estamos vendiendo un desarrollo. Estamos vendiendo la implementación de un
producto que ya existe y funciona.**

Ese encuadre gobierna toda la presentación. El CRM está construido, desplegado y
operando con datos: se puede mostrar en vivo durante la reunión. Lo que el
cliente paga es que ese producto quede conectado a *sus* sistemas, con *sus*
datos y su equipo usándolo.

Consecuencias para el tono:

- Se habla en presente, no en futuro. **"El dashboard muestra"**, no "el
  dashboard mostraría".
- No se venden semanas de desarrollo. Se venden semanas de **implementación**.
- La demo en vivo es el argumento principal. Las láminas la acompañan, no la
  reemplazan.

**Segunda cosa que tienes que entender: este es un negocio de nicho.** Entran
tres o cuatro ventas al mes. No es una tienda con miles de transacciones y eso
cambia qué se puede afirmar. Cualquier porcentaje con decimales sobre cuarenta
ventas al año es ruido disfrazado de precisión. En las láminas van **números
absolutos y personas con nombre**, no distribuciones.

---

## 1. El cliente y la situación

**Quién es:** **Highend Chile** — distribuidor de audio de alta fidelidad.
Parlantes, amplificadores, tornamesas, streamers y accesorios de marcas como
Magico, Børresen, Accuphase, Soulution, Burmester, Aurender y Transrotor. Su
catálogo va de $49.900 a $39.900.000.

**Cómo se vende esto:** el cliente entra al showroom, se sienta a escuchar un
sistema durante una o dos horas, se va a pensarlo y vuelve semanas o meses
después. La venta es larga, consultiva y con ticket muy alto.

**Sus sistemas:**
- **RelBase** como punto de venta y facturación electrónica.
- **WooCommerce** como tienda online.

**El problema:** los dos sistemas no se conocen, y ninguno de los dos sabe nada
de la persona que entró a escuchar y no compró ese día. Preguntas del negocio
que hoy no tienen respuesta:

- ¿Cuántos clientes tenemos y cuántos siguen activos?
- ¿Cuánto vale un cliente en el tiempo?
- ¿Quién está a punto de dejar de comprar?
- ¿Qué tiene armado cada cliente y qué le falta?
- ¿Cuánta gente entró este mes y qué pasó con ellos?

**Quién decide:** el dueño o gerente comercial. No es un comprador técnico: le
importan las ventas, no la arquitectura.

---

## 2. El diagnóstico · esto es lo que cambió

### Lo que NO es el problema

En un negocio de ticket alto la venta queda bien registrada. Hay factura, hay
despacho, hay instalación y muchas veces hay crédito directo: **nadie entrega
parlantes de veintiocho millones sin saber a quién**. En la demo, el 92% de las
ventas tiene cliente identificado y la facturación sin dueño es el 0,25% del
total.

**No hay que inventar un problema acá.** Si se dice en la reunión que la mitad
de sus boletas sale sin cliente, el gerente lo va a desmentir en el acto y se
pierde la credibilidad del resto de la presentación.

### Lo que SÍ es el problema

**El hueco está antes de la venta.** Por cada persona que compra, entran
alrededor de cuatro al showroom. Esas otras tres escucharon un equipo, se fueron
a pensarlo y **hoy no existen en ningún registro**: no hay forma de avisarles
cuando llega el modelo que estaban esperando, ni de saber cuántos eran, ni qué
venían buscando.

En un retail masivo eso sería una fuga tolerable. Acá no: con tres o cuatro
ventas al mes, **cada visita perdida pesa**.

### El cálculo que gana la reunión

> Venta típica: **$5.029.000**
> Implementación completa: **$1.900.000**
>
> **Recuperar una sola visita al año paga el sistema.**

Es conservador —usa la mediana, no el promedio de $17.025.090— y por eso es
defendible. No hay que inflarlo.

---

## 3. La narrativa · el arco de la presentación

1. **Hay preguntas sobre tu negocio que hoy no puedes responder.** (Tensión)
2. **Tus ventas están bien registradas. El problema es la gente que entra y no
   compra ese día.** (Diagnóstico — el giro)
3. **Así se ve tu negocio cuando se cruzan los datos.** (Demo — el corazón)
4. **Y así se ve el sistema de cada cliente, con lo que le falta.** (El
   diferenciador del rubro)
5. **Para que funcione hay que capturar a quien entra al showroom.** (Captura)
6. **Y el ejecutivo tiene que saber qué decirle.** (Señales)
7. **Esto cuesta y demora esto.** (Cierre)

**La idea que tiene que quedar:** *"sé quiénes me compraron, pero no sé nada de
los que estuvieron a punto — y con mi volumen, esos son el negocio del próximo
año"*.

**El giro está en el punto 2, y es un giro a favor.** Empieza reconociendo algo
bueno de su operación ("tus ventas están bien registradas") antes de mostrar el
hueco. Eso desarma la defensa y hace que el problema real se escuche.

---

## 4. Estructura lámina por lámina

Formato: **presentación en vivo**. Poco texto por lámina, una idea cada una.
Entre 17 y 19 láminas.

---

### Sección A · La tensión (3 láminas)

**Lámina 1 · Portada**
- Título: **CRM Highend**
- Bajada: *De dos sistemas que no se hablan a una vista única de tus clientes*
- Logo de Highend Chile · logo adoOps · fecha

**Lámina 2 · Las cinco preguntas**
Solo las preguntas, grandes, una debajo de otra. Sin respuestas todavía.

> ¿Cuántos clientes tengo y cuántos siguen activos?
> ¿Cuánto vale un cliente a lo largo del tiempo?
> ¿Quiénes están a punto de dejar de comprar?
> ¿Qué tiene armado cada uno y qué le falta?
> ¿Cuánta gente entró al showroom este mes y qué pasó con ellos?

Pie de lámina: *Hoy ninguna de estas preguntas tiene respuesta en tus sistemas.*

**Lámina 3 · Por qué**

```
   RelBase                    WooCommerce              Showroom
   Punto de venta             Tienda online            Quien entra a escuchar
   ¿quién compró?             ¿quién compró?           ¿quién era?
        ↓                          ↓                        ↓
   [no se hablan]                                      [no queda registro]
```

Mensaje: *Cada sistema sabe lo suyo. Ninguno sabe del otro. Y nadie sabe nada de
quien entró, escuchó dos horas y se fue a pensarlo.*

---

### Sección B · El diagnóstico (2 láminas)

**Lámina 4 · Lo que está bien** ← *lámina de credibilidad, no la saltes*

Un número grande:

> # 92%
> **de tus ventas tiene cliente identificado**

Debajo: *Cuando hay factura, despacho e instalación de por medio, la venta queda
con nombre. Tu registro de ventas no es el problema.*

**Nota para el presentador:** esta lámina compra permiso para la siguiente. Se
dice rápido y con seguridad.

**Lámina 5 · Lo que falta** ← *lámina más importante de la presentación*

> # 4 de cada 5
> **personas que entran al showroom no compran ese día — y no dejan rastro**

Debajo: *No hay forma de avisarles cuando llega lo que estaban esperando.*

Y abajo, en una línea:
*Venta típica $5.029.000 · Implementación $1.900.000 · **recuperar una al año
paga el sistema.***

**Nota para el presentador:** pausa acá. Este es el momento de la reunión.

---

### Sección C · La demo (5 láminas)

Capturas del sistema real, no maquetas. El presentador puede saltar al sistema
en vivo.

**Lámina 6 · Panorama**
Resaltar: ventas al mes, venta típica contra promedio, clientes activos y la
tabla de **las últimas ventas con nombre**.

Frase para decir: *con este volumen, el panel no te resume el mes — te muestra
las ventas una por una.*

**Lámina 7 · Segmentos RFM**
Captura de la matriz. Explicar en una línea: *cada cliente cae en una casilla
según cuándo compró por última vez y cuántas veces. Once grupos, cada uno con lo
que corresponde hacer.*

Si preguntan por el método, la respuesta corta es: *los cortes son fijos y están
calibrados a tu rubro —"más de tres años sin comprar", "sobre treinta
millones"— no son porcentajes de la lista. Con sesenta clientes, un porcentaje
te inventaría una jerarquía que no existe.*

**Lámina 8 · Migración entre segmentos**
Mensaje: *Una foto dice cuántos clientes hay en riesgo. Esto dice quién se está
moviendo y hacia dónde.*

**Lámina 9 · Valor de vida y cohortes**
Captura del heatmap. Explicar: *cada fila son los clientes que entraron ese año;
las columnas, cuánto han gastado desde entonces.*

**Importante:** si alguien pregunta por qué es anual y no mensual, la respuesta
está en la pantalla y hay que decirla: *entran unos veinte clientes nuevos al
año. Una cohorte de un mes serían dos personas, y con dos personas el promedio
no muestra una tendencia — muestra a uno de los dos.*

**Lámina 10 · Calidad del dato**
Cierra el arco de las láminas 4 y 5.

---

### Sección D · El diferenciador del rubro (2 láminas)

**Lámina 11 · El sistema de cada cliente** ← *lámina que ningún competidor tiene*

Captura de la vista Sistemas y upgrade.

Mensaje: *Un equipo es una cadena —fuente, previo, etapa, parlantes— y suena tan
bien como su eslabón más flojo. El CRM sabe qué tiene armado cada cliente.*

Los dos motivos para llamar:
- **Completar:** le falta un eslabón para cerrar el equipo.
- **Equilibrar:** tiene una pieza muy por debajo del resto y el sistema rinde
  menos de lo que costó.

**Nota:** esto no lo hace un CRM genérico. Es la lámina que justifica por qué
vale la pena un sistema hecho para ellos y no una suscripción a algo estándar.

**Lámina 12 · Los hallazgos**

| Hallazgo | Cifra | Qué implica |
|---|---|---|
| El 20% que más compra concentra el **66%** de los ingresos | — | Perder uno de los grandes no se compensa con diez chicos |
| Quien compra en tienda **y** online vale **2,4 veces más** | $62,2M vs $25,5M | Llevar al cliente de tienda a la web deja de ser intuición |
| **40 clientes** están armando un sistema y les falta al menos un eslabón | $631M a precio de lista | Es una lista de conversaciones concretas, no un pronóstico |

> **Cómo presentar la tercera cifra.** $631 millones es un **techo teórico a
> precio de lista**: nadie va a comprar todo y lo que se compre se va a
> negociar. Hay que decirlo en la lámina, no en la letra chica. Si se presenta
> como "oportunidad de venta" sin la aclaración, el gerente lo descuenta mentalmente
> y de paso descuenta todo lo demás.

---

### Sección E · Las otras dos piezas (3 láminas)

**Lámina 13 · Captura en el showroom**
Captura del formulario en un teléfono + el QR.

Mensaje: *Todo lo anterior vive de que quien entra deje su nombre. Eso no lo
arregla el software: lo arregla un hábito de diez segundos.*

Detalles: un QR por sala, menos de un minuto, consentimiento explícito con
fecha, entra directo al CRM y se cruza solo si el cliente ya existía. Sirve
igual para ferias y audiciones.

**Lámina 14 · Señales de conversación**
Captura del panel.

Mensaje: *El problema del ejecutivo no es a quién llamar. Es qué decirle.*

Mostrar una señal completa: motivo, evidencia y borrador.

Las seis reglas: ventana de recompra propia del cliente · mantención que toca ·
aniversario · complemento que compra su segmento · cumpleaños · reactivación.

Dos frases que conviene decir tal cual:
- *"La señal se acciona o se descarta, nunca se acumula."*
- *"El borrador nunca se manda solo. El sistema propone, tu ejecutivo decide."*

**Nota de escala:** el panel muestra **33 señales, 6 de prioridad alta**. Es a
propósito. Un sistema que genera setecientas alertas es otra bandeja que nadie
mira; con este volumen la lista tiene que caber en la semana de una persona.

**Lámina 15 · Cómo se conecta** (técnica, breve)

```
RelBase (POS) ──┐
                ├─→ Identidad (RUT → correo → teléfono) ─→ CRM ─→ Dashboard · Señales
WooCommerce ────┘
        ↑
   Captura showroom
```

Una línea de respaldo: *ya revisamos la API de RelBase; sabemos cómo y con qué
límites se sincroniza.*

---

### Sección F · El cierre (3 láminas)

**Lámina 16 · Cómo se implementa** — sección 6 de este brief
**Lámina 17 · Inversión** — sección 7
**Lámina 18 · Qué necesitamos y próximo paso** — sección 8

---

## 5. Cifras exactas · **usar estas, no inventar**

Todas salen del sistema andando, medidas el 12 de agosto de 2026.

### Base de la demo
| Dato | Valor |
|---|---|
| Clientes | 76 |
| Ventas (4 años) | 156 · **3,3 al mes** |
| Facturación acumulada | $2.457.867.900 |
| Ventas identificadas | 144 · **92,3%** |
| Facturación sin cliente asociado | $6.255.000 · **0,25%** |
| Catálogo | 70 productos · 26 marcas · 11 categorías |

### Últimos 12 meses
| Dato | Valor |
|---|---|
| Facturación | $531.459.500 |
| Ventas | 47 · **3,9 al mes** |
| Venta típica (mediana) | **$5.029.000** |
| Venta promedio | $17.025.090 |
| Punto de venta | 128 ventas |
| E-commerce | 28 ventas · 24 clientes |
| Clientes activos | 35 de 76 |
| Nuevos | 16 |
| Recuperados | 15 |
| En riesgo | 15 |

> **La mediana y el promedio juntos, siempre.** La diferencia entre $5,0M y
> $17,0M es el argumento: un solo par de parlantes arrastra el promedio de todo
> un año. Mostrar solo el promedio sería exagerar el tamaño de la venta típica.

### Valor de vida
| Dato | Valor |
|---|---|
| Promedio | $32.258.064 |
| Mediana | $12.080.000 |
| Proyección 12 meses por cliente activo | $16.759.521 |
| Concentración del 20% que más compra | **65,5%** *(la pantalla redondea a 66%)* |
| **Omnicanal** | **$62.164.900** (14 clientes) |
| **Un solo canal** | **$25.504.908** |

> La comparación omnicanal es **2,4×**. Con solo 14 clientes omnicanal hay que
> presentarla como una señal, no como una ley: *"los pocos que compran en los
> dos canales valen más del doble"*. No decir "está demostrado".

### Sistemas y upgrade
| Dato | Valor |
|---|---|
| Armando su sistema (2+ piezas) | 40 |
| Sistemas completos | 4 |
| Con eslabón débil | 3 |
| Compra suelta (una sola pieza) | 33 |
| Oportunidad a precio de lista | $631.490.000 *(techo teórico)* |

Qué eslabón falta más: **Etapa 31 · Previo 27 · Parlantes 21 · Fuente 9**

### Puertas de entrada por categoría
| Entra comprando | Clientes | Vuelve | Compras | Valor de vida |
|---|---|---|---|---|
| **Parlantes y Cine** | **23** | **57%** | **2,4** | **$51.850.083** |
| Audio Análogo | 9 | 33% | 2,2 | $44.092.989 |
| Sistemas Highend | 9 | 0% | 1,0 | $21.844.333 |
| Audio Digital | 7 | 29% | 1,9 | $29.510.957 |
| Amplificadores | 5 | 60% | 2,6 | $63.821.600 |
| Tubos y Válvulas | 8 | 25% | 1,6 | $1.871.750 |
| Cables de Audio | 5 | 0% | 1,0 | $509.900 |

> **El hallazgo de esta tabla:** quien entra por parlantes vuelve el 57% de las
> veces; quien entra por cables, nunca. **Con qué producto se adquiere un
> cliente importa tanto como el margen de ese producto.**
>
> Ojo con las filas de 5 clientes: son señales, no leyes. Si preguntan, decirlo.

### Contactabilidad
| Dato | Valor |
|---|---|
| Contactos totales | 76 |
| Con teléfono | 69 |
| Con correo | 70 |
| Con consentimiento | 58 |
| Con WhatsApp autorizado | 57 |

### Showroom y señales
| Dato | Valor |
|---|---|
| Visitas registradas (5 meses) | 78 |
| Visitas últimos 30 días | 20 |
| Autorizan contacto | 75% |
| Conversión de visitas trabajadas | 14% |
| Señales pendientes | **33** (6 de prioridad alta) |

---

### ⚠ Dos cifras que NO hay que usar

1. **La variación de facturación (−38,8% vs los 12 meses previos).** Es un
   artefacto del mock: con 47 ventas al año, dos operaciones grandes que caigan
   en un período y no en el otro mueven la cifra decenas de puntos. No apoyarse
   en ella y, si aparece en una captura, tener lista la explicación: *"con este
   volumen la comparación año contra año depende de dos o tres ventas; por eso
   el panel muestra trimestres"*. **Esa respuesta refuerza el argumento, no lo
   debilita.**

2. **"Vida promedio: 8 meses".** El mock todavía no refleja bien el ciclo largo
   de este rubro, donde entre una compra y la siguiente pasan uno o dos años.
   Es una métrica a corregir antes de mostrarla; mientras tanto, no ponerla en
   una lámina.

---

## 6. Cómo se implementa · las tres etapas

**Encuadre: son semanas de implementación, no de desarrollo.**

| Etapa | Qué pasa | Duración |
|---|---|---|
| **1 · Conexión** | Auditoría de datos, conexión con RelBase y WooCommerce, resolución de identidad, carga del histórico. Al terminar, el dashboard muestra el negocio real. | 2 a 3 semanas |
| **2 · Captura** | QR en la sala, formulario en producción, bandeja de seguimiento y capacitación al equipo. | 1 semana |
| **3 · Activación** | Motor de señales con las reglas del negocio, WhatsApp conectado, capacitación a los ejecutivos. | 1 a 2 semanas |

**Total: 4 a 6 semanas.**

**La primera semana es una auditoría de datos**, y hay que decirlo en la
reunión: antes de comprometer nada medimos cuántas de sus ventas tienen cliente
y con qué se puede contactar a esa gente. Es lo que separa una propuesta seria
de una promesa.

---

## 7. Propuesta económica

### Estructura
**Implementación pagada una vez + mensualidad de operación.** La mensualidad
cubre hosting, soporte, correcciones y mejoras; el cliente opera el día a día
con acompañamiento de adoOps.

### Las tres opciones

| | **Esencial** | **Completo** ⭐ | **Ampliado** |
|---|---|---|---|
| **Implementación** | **$1.500.000** | **$1.900.000** | **$2.400.000** |
| **Mensualidad** | $150.000 | $150.000 | $220.000 |
| Integración RelBase | ✓ | ✓ | ✓ |
| Integración WooCommerce | — | ✓ | ✓ |
| Dashboard completo (6 vistas) | ✓ | ✓ | ✓ |
| Sistemas y ruta de upgrade | ✓ | ✓ | ✓ |
| Captura en showroom con QR | ✓ | ✓ | ✓ |
| Motor de señales | — | ✓ | ✓ |
| WhatsApp conectado | — | ✓ | ✓ |
| Capacitación | 1 sesión | 2 sesiones | 4 sesiones + acompañamiento 1 mes |
| Biblioteca de contenidos | — | — | ✓ |
| Reportes a medida | — | — | 2 incluidos |

**La opción recomendada es Completo.** Presentarla al centro y como
predeterminada; las otras dos dan contexto de precio.

**El argumento de precio, dicho en una línea:** *la implementación completa
cuesta menos que la mitad de una venta típica.*

### Forma de pago sugerida
- 50% a la firma
- 50% contra la entrega de la etapa 1 (dashboard con datos reales)
- Mensualidad desde el mes siguiente a la puesta en marcha

### Qué incluye la mensualidad de $150.000
- Hosting y respaldo diario
- Sincronización automática con los dos sistemas
- Soporte por correo y WhatsApp en horario hábil
- Correcciones y mejoras del producto sin costo adicional
- Un ajuste de configuración al mes (umbrales, reglas, plantillas)

### Qué **no** incluye · decirlo en la propuesta
- Desarrollos a medida fuera del alcance (se cotizan aparte)
- Migración o limpieza de bases históricas fuera de RelBase y WooCommerce
- Integraciones con otros sistemas (ERP, contabilidad, marketplaces)
- Costos de terceros: WhatsApp Business API, servicios de correo
- Más de una sesión de configuración al mes

> **Nota de riesgo para adoOps, no para la lámina:** con $1,9M de
> implementación, la integración con RelBase tiene que ser acotada. Si el
> cliente pide transformaciones a medida, conciliaciones especiales o limpieza
> de años de histórico sucio, eso se cotiza aparte desde el primer día.

---

## 8. Qué necesitamos del cliente (lámina 18)

1. Token de empresa de RelBase (se solicita a `contacto@relbase.cl`) y un
   usuario integrador dedicado.
2. Claves de la API de WooCommerce con permiso de lectura.
3. Una persona que conozca la operación del mostrador.
4. Acuerdo sobre el hábito de captura en la sala. **Es el único requisito que no
   se resuelve con software.**

**Próximo paso propuesto:** una auditoría de datos de una semana con acceso de
lectura, sin costo, para medir con sus datos reales lo que la demo muestra con
datos simulados.

---

## 9. Guía visual

**Paleta — la de Highend Chile**, medida sobre su sitio. El CRM ya usa estos
colores, así que las capturas y las láminas van a calzar.

| Uso | Color |
|---|---|
| Bronce Highend (acentos, botones) | `#ab8a62` |
| Bronce oscuro (texto sobre claro) | `#8a6c48` |
| Bronce suave (fondos de destaque) | `#f6f1e9` |
| Negro Highend (barra lateral, portadas) | `#161616` |
| Fondo de página | `#faf9f7` |
| Superficie de tarjeta | `#ffffff` |
| Tinta principal | `#0f0e0d` |
| Tinta secundaria | `#55524d` |
| Azul de datos | `#2a78d6` |
| Rojo de alerta | `#d03b3b` |

**Logo:** `public/highend-logo.png` en el repo. Es claro sobre transparente
—hecho para fondo oscuro—, así que en láminas claras hay que usar wordmark
tipográfico: **HIGHEND** en mayúsculas con tracking amplio.

**Tipografía:** su sitio usa **Nunito**. El CRM usa Sora para títulos e Inter
para texto. Para la PPT, Nunito es la elección correcta: es la de ellos.

**Reglas de diseño:**
- Una idea por lámina. Si necesita dos, son dos láminas.
- Los números grandes van solos.
- Las capturas van con borde sutil y sombra suave, sin marcos de navegador.
- Nada de íconos genéricos ni fotos de stock.
- **Fotografía de producto sí:** es audio de alta gama y se ve bien. Sacarla de
  su sitio, no de bancos de imágenes.
- Sin animaciones de transición.

---

## 10. Tono y lenguaje

- **Español de Chile, neutro.**
- **Cero jerga.** No decir "customer lifetime value": decir **valor de vida del
  cliente**. No decir "churn": decir **clientes que dejan de comprar**. "RFM" se
  puede usar una vez, explicándolo.
- **El vocabulario del rubro sí se usa**, y conviene: fuente, previo, etapa,
  parlantes, sistema. Muestra que entendimos el negocio. Lo que no se usa es
  jerga de software.
- Frases cortas. Verbos concretos.
- **No prometer lo que no se puede sostener.**

### Errores que hay que evitar

| No hacer | Por qué |
|---|---|
| Decir que sus ventas están mal registradas | **Es falso y lo van a desmentir en el acto.** El 92% está identificado |
| Presentar los $631M como venta esperable | Es un techo a precio de lista. Sin la aclaración, el gerente descuenta todo lo demás |
| Usar la caída de facturación del −38,8% | Es ruido del mock: con 47 ventas al año, dos operaciones mueven la cifra |
| Mostrar porcentajes con un decimal sobre pocos casos | "El 57% vuelve" son 13 de 23 personas. Decir el número absoluto |
| Vender "inteligencia artificial" como argumento central | El valor está en cruzar datos. La IA redacta textos, no calcula las cifras |
| Llenar láminas de funcionalidades | Compran responder preguntas, no una lista de features |
| Mostrar el precio antes de la demo | El precio solo tiene sentido después de ver lo que recibe |

---

## 11. Sobre los datos de la demo

**El sistema corre con el catálogo real de Highend Chile —sus categorías, sus
marcas y sus rangos de precio— pero con clientes y ventas simulados.**

Está calibrado al volumen que ellos mismos indicaron: tres o cuatro ventas
mensuales. Los nombres de clientes son ficticios.

**Decirlo en una línea durante la demo:** *"el catálogo es el suyo; los clientes
y las ventas son simulados con la forma y el volumen que tendrían los suyos"*.

Es honesto, y de paso comunica algo que conviene: **nos tomamos el trabajo de
entender qué venden y a qué ritmo.**

---

## 12. Anexo · dónde ver el sistema

- **CRM:** https://www.adoops.digital/crm
- **Formulario de captura:** https://www.adoops.digital/showroom
- Credenciales de demostración: pedirlas a Joaquín antes de la reunión.

Pantallas para capturar:
| Pantalla | Ruta |
|---|---|
| Panorama | `/crm/clientes?vista=panorama` |
| Segmentos RFM | `/crm/clientes?vista=rfm` |
| Valor de vida | `/crm/clientes?vista=valor` |
| Producto | `/crm/clientes?vista=producto` |
| **Sistemas y upgrade** | `/crm/clientes?vista=sistemas` |
| Calidad del dato | `/crm/clientes?vista=datos` |
| Señales | `/crm/senales` |
| Showroom | `/crm/showroom` |

**Tomar las capturas en 1440px de ancho**, con la barra lateral visible: se ve
el logo de Highend y que es un sistema real, no una lámina dibujada.

---

## 13. Para regenerar los datos

Si hay que rehacer el mock —por ejemplo para ajustar el volumen tras una
conversación con el cliente—, el orden es:

```bash
node scripts/crm-catalogo-highend.mjs   # catálogo real
node scripts/crm-seed-highend.mjs       # clientes, ventas y visitas
```

Ambos son determinísticos: dos corridas dan exactamente lo mismo. Si se
regeneran, **todas las cifras de la sección 5 cambian** y hay que volver a
medirlas antes de la reunión.
