# Brief para construir la presentación · CRM comercial

**Para:** el agente que va a producir la PPT
**De:** adoOps
**Fecha:** agosto de 2026

Este documento es autosuficiente: contiene el contexto, la narrativa, el
contenido de cada lámina, las cifras exactas y la propuesta económica. No hace
falta pedir nada más para construir la presentación.

---

## 0. Lo primero que tienes que entender

**No estamos vendiendo un desarrollo. Estamos vendiendo la implementación de un
producto que ya existe y funciona.**

Ese encuadre gobierna toda la presentación. El CRM está construido, desplegado y
operando con datos: se puede mostrar en vivo durante la reunión. Lo que el
cliente paga es que ese producto quede conectado a *sus* sistemas, con *sus*
datos y su equipo usándolo.

Consecuencias para el tono de la propuesta:

- Se habla en presente, no en futuro. **"El dashboard muestra"**, no "el
  dashboard mostraría".
- No se venden semanas de desarrollo. Se venden semanas de **implementación**.
- La demo en vivo es el argumento principal. Las láminas la acompañan, no la
  reemplazan.

---

## 1. El cliente y la situación

**Quién es:** un retailer chileno de productos de alta gama, con tiendas físicas
y venta online. Ticket alto, venta consultiva, cliente que vuelve cada varios
meses o años.

**Sus sistemas:**
- **RelBase** como punto de venta y facturación electrónica.
- **WooCommerce** como tienda online.

**El problema:** los dos sistemas no se conocen. Cada uno sabe lo suyo y ninguno
sabe del otro. No hay forma de responder preguntas básicas del negocio:

- ¿Cuántos clientes tenemos y cuántos siguen activos?
- ¿Cuánto vale un cliente en el tiempo?
- ¿Quién está a punto de dejar de comprar?
- ¿El que compra en tienda es el mismo que compra en la web?
- ¿Qué producto trae los clientes que después vuelven?

**Quién decide:** el dueño o gerente comercial. No es un comprador técnico: le
importan las ventas, no la arquitectura. Los ejecutivos de cuenta (CAM) son los
usuarios y sus objeciones importan, pero no firman.

---

## 2. La narrativa · el arco de la presentación

La presentación tiene que hacer este recorrido, en este orden:

1. **Hay una pregunta que hoy no puedes responder.** (Tensión)
2. **Y hay una razón concreta: tus dos sistemas no se hablan, y buena parte de
   tus ventas no tiene dueño.** (Diagnóstico)
3. **Así se vería tu negocio si pudieras responderla.** (Demo — el corazón)
4. **Estos son los tres hallazgos que aparecen apenas se cruzan los datos.**
   (Prueba de valor)
5. **Para que eso funcione hay que capturar al cliente en la tienda.** (Captura)
6. **Y para que sirva, el ejecutivo tiene que saber qué decirle.** (Señales)
7. **Esto es lo que cuesta y cuánto demora.** (Cierre)

**La idea que tiene que quedar:** *"tengo un negocio del que sé menos de lo que
creía, y hay una forma concreta y barata de empezar a saberlo"*.

**El giro emocional está en el punto 2.** Cuando se dice que más de un tercio de
las ventas no tiene cliente asociado, el cliente reconoce algo que sospechaba y
nunca había visto en un número. Ese es el momento en que la reunión se gana. No
hay que suavizarlo.

---

## 3. Estructura lámina por lámina

Formato: **presentación en vivo**. Poco texto por lámina, una idea cada una, el
presentador cuenta la historia. Entre 16 y 18 láminas.

---

### Sección A · La tensión (3 láminas)

**Lámina 1 · Portada**
- Título: **CRM comercial**
- Bajada: *De dos sistemas que no se hablan a una vista única de tus clientes*
- Logo adoOps · nombre del cliente · fecha

**Lámina 2 · Las cinco preguntas**
Solo las preguntas, grandes, una debajo de otra. Sin respuestas todavía.

> ¿Cuántos clientes tengo y cuántos siguen activos?
> ¿Cuánto vale un cliente a lo largo del tiempo?
> ¿Quiénes están a punto de dejar de comprar?
> ¿El que compra en la tienda es el mismo que compra en la web?
> ¿Qué producto trae los clientes que después vuelven?

Pie de lámina: *Hoy ninguna de estas preguntas tiene respuesta en tus sistemas.*

**Lámina 3 · Por qué**
Diagrama simple: dos cajas separadas, sin línea entre ellas.

```
   RelBase                    WooCommerce
   Punto de venta             Tienda online
   ¿quién compró?             ¿quién compró?
        ↓                          ↓
   [no se hablan]
```

Mensaje: *Cada sistema sabe lo suyo. Ninguno sabe del otro. Y el punto de venta
solo registra al cliente cuando el cliente lo pide.*

---

### Sección B · El diagnóstico (2 láminas)

**Lámina 4 · La cifra incómoda** ← *lámina más importante de la presentación*

Un solo número gigante al centro:

> # 35,5%
> **de las ventas no tiene cliente asociado**

Debajo, en menor tamaño:
*Existen en la contabilidad. No existen como cliente: no tienen segmento, no
tienen valor de vida, no se les puede escribir.*

**Nota para el presentador:** hacer una pausa acá. Es el momento de la reunión.

**Lámina 5 · Qué significa en plata**
Tres cifras en fila:

| Ventas registradas | Con cliente identificado | Sin dueño |
|---|---|---|
| 3.503 | 2.260 (64,5%) | $8.644 millones |

Mensaje de cierre: *Cada punto porcentual que sube son $249 millones de venta
que pasan a ser analizables.*

---

### Sección C · La demo (5 a 6 láminas)

Estas láminas son **capturas del sistema real**, no maquetas. El presentador
puede saltar de las láminas al sistema en vivo.

**Lámina 6 · Panorama**
Captura del dashboard. Resaltar: clientes activos, facturación 12 meses, valor
de vida promedio y el % identificado.

**Lámina 7 · Segmentos RFM**
Captura de la matriz. Explicar en una línea: *cada cliente cae en una casilla
según cuándo compró por última vez y cuántas veces compró. Once grupos, cada uno
con lo que corresponde hacer.*

**Lámina 8 · Migración entre segmentos** ← *diferenciador fuerte*
Mensaje: *Una foto dice "tienes 197 clientes en riesgo". Esto dice quién se está
moviendo y hacia dónde, cada trimestre.*

**Lámina 9 · Valor de vida y cohortes**
Captura del heatmap. Explicar: *cada fila son los clientes que entraron ese mes;
las columnas, cuánto han gastado desde entonces. Responde si los clientes nuevos
valen más o menos que los de antes.*

**Lámina 10 · Producto**
Captura de la tabla de puertas de entrada.

**Lámina 11 · Calidad del dato**
Cierra el arco que abrió la lámina 4: *este indicador se sigue semana a semana.
Es el termómetro del proyecto.*

---

### Sección D · Los hallazgos (1 lámina, alto impacto)

**Lámina 12 · Tres cosas que aparecen apenas se cruzan los datos**

Tres bloques, cada uno con su número grande:

| Hallazgo | Cifra | Qué implica |
|---|---|---|
| Quien compra en tienda **y** online vale **4,8 veces más** | $34,9M vs $7,3M | Llevar al cliente de tienda a la web deja de ser intuición y pasa a ser un objetivo con número |
| El 20% que más compra concentra el **71%** de los ingresos | — | Perder uno de los grandes no se compensa con diez chicos |
| Quien entra por la categoría correcta **vuelve 41%** de las veces y vale el doble | $23,8M vs $10,3M | Cambia qué producto conviene empujar para *adquirir*, no solo por su margen |

**Nota:** este es el segundo momento fuerte. Son conclusiones que el cliente no
tiene hoy y que no requieren fe: salen de sus propias ventas.

---

### Sección E · Las otras dos piezas (3 láminas)

**Lámina 13 · Captura en el showroom**
Captura del formulario en un teléfono + el QR.

Mensaje: *El dashboard vive de que la venta tenga una persona detrás. Eso no lo
arregla el software: lo arregla un hábito de diez segundos en el mostrador.*

Detalles a mencionar: un QR por tienda, menos de un minuto, consentimiento
explícito con fecha, entra directo al CRM y se cruza solo si el cliente ya
existía. Sirve igual para eventos y activaciones.

**Lámina 14 · Señales de conversación**
Captura del panel de señales.

Mensaje: *El problema del ejecutivo no es a quién llamar. Es qué decirle.*

Mostrar una señal completa como ejemplo: motivo, evidencia y borrador.

Las seis reglas: ventana de recompra propia del cliente · mantención que toca ·
aniversario · complemento que compra su segmento · cumpleaños · reactivación.

Dos frases que conviene decir tal cual:
- *"La señal se acciona o se descarta, nunca se acumula."*
- *"El borrador nunca se manda solo. El sistema propone, tu ejecutivo decide."*

**Lámina 15 · Cómo se conecta** (técnica, breve)
El diagrama de integración. No entrar en detalle: el comprador no es técnico.
Basta con que se vea que está resuelto.

```
RelBase (POS) ──┐
                ├─→ Identidad (RUT → correo → teléfono) ─→ CRM ─→ Dashboard · Señales
WooCommerce ────┘
```

Una línea de respaldo: *ya revisamos la API de RelBase; sabemos cómo y con qué
límites se sincroniza.*

---

### Sección F · El cierre (2 a 3 láminas)

**Lámina 16 · Cómo se implementa**
Tres etapas con duración. (Contenido en la sección 5 de este brief.)

**Lámina 17 · Inversión**
Las tres opciones. (Contenido en la sección 6.)

**Lámina 18 · Qué necesitamos de ustedes y próximo paso**
Cierre con una acción concreta, no con un "gracias".

---

## 4. Cifras exactas · **usar estas, no inventar**

Todas salen del sistema andando. Están verificadas.

### Base de datos de la demo
| Dato | Valor |
|---|---|
| Clientes | 1.200 |
| Ventas (3 años) | 3.503 |
| Facturación acumulada | $24.926.650.000 |
| Ventas identificadas | 2.260 · **64,5%** |
| Facturación sin cliente asociado | **$8.644.150.000** |

### Últimos 12 meses
| Dato | Valor |
|---|---|
| Facturación | $9.109.260.000 (−4,7% vs período anterior) |
| Punto de venta | 943 ventas · $8.125.760.000 |
| E-commerce | 296 ventas · $983.500.000 |
| Clientes activos | 573 de 1.200 |
| Nuevos | 294 |
| Recuperados | 192 |
| En riesgo | 197 |

### Valor de vida
| Dato | Valor |
|---|---|
| Promedio | $13.568.750 |
| Mediana | $5.080.000 |
| Proyección 12 meses por cliente activo | $10.768.361 |
| Concentración del 20% que más compra | **71,2%** |
| Vida promedio | 5 meses · 1,9 compras |
| **Omnicanal** | **$34.930.590** (271 clientes) |
| **Un solo canal** | **$7.337.255** |

> La comparación omnicanal es **4,8×**. Es la cifra más vendedora de toda la
> presentación.

### Puertas de entrada por categoría
| Entra comprando | Clientes | Vuelve | Compras | Valor de vida |
|---|---|---|---|---|
| Joyería fina | 417 | 31% | 1,8 | $10.269.089 |
| Accesorios | 340 | 37% | 1,9 | $8.597.971 |
| Relojes clásicos | 253 | 37% | 1,8 | $13.732.292 |
| **Relojes deportivos** | **110** | **41%** | **2,2** | **$23.789.636** |
| Servicios | 34 | 9% | 1,1 | $1.800.882 |

### Contactabilidad
| Dato | Valor |
|---|---|
| Contactos totales | 1.200 |
| Con teléfono | 1.019 |
| Con correo | 859 |
| Con consentimiento | 710 |

### Showroom y señales
| Dato | Valor |
|---|---|
| Visitas registradas | 180 |
| Autorizan contacto | 74% |
| Señales pendientes | 155 (33 de prioridad alta) |

---

## 5. Cómo se implementa · las tres etapas

**Encuadre: son semanas de implementación, no de desarrollo.** El producto
existe.

| Etapa | Qué pasa | Duración |
|---|---|---|
| **1 · Conexión** | Auditoría de datos, conexión con RelBase y WooCommerce, resolución de identidad, carga del histórico. Al terminar, el dashboard muestra el negocio real. | 2 a 3 semanas |
| **2 · Captura** | QR por tienda, formulario en producción, bandeja de seguimiento y capacitación al equipo de tienda. | 1 semana |
| **3 · Activación** | Motor de señales configurado con las reglas del negocio, WhatsApp conectado, capacitación a los ejecutivos. | 1 a 2 semanas |

**Total: 4 a 6 semanas** hasta tener el sistema operando con el equipo usándolo.

**La primera semana es una auditoría de datos**, y hay que decirlo en la
reunión: antes de comprometer nada medimos cuántas de sus ventas tienen cliente
y con qué se puede contactar a esa gente. Es lo que separa una propuesta seria
de una promesa.

---

## 6. Propuesta económica

### Estructura
**Implementación pagada una vez + mensualidad de operación.** La mensualidad
cubre hosting, soporte, correcciones y mejoras del producto; el cliente opera el
día a día con acompañamiento de adoOps.

### Las tres opciones

| | **Esencial** | **Completo** ⭐ | **Ampliado** |
|---|---|---|---|
| **Implementación** | **$1.500.000** | **$1.900.000** | **$2.400.000** |
| **Mensualidad** | $150.000 | $150.000 | $220.000 |
| Integración RelBase | ✓ | ✓ | ✓ |
| Integración WooCommerce | — | ✓ | ✓ |
| Dashboard completo (5 vistas) | ✓ | ✓ | ✓ |
| Captura en showroom con QR | ✓ | ✓ | ✓ |
| Motor de señales | — | ✓ | ✓ |
| WhatsApp conectado | — | ✓ | ✓ |
| Capacitación | 1 sesión | 2 sesiones | 4 sesiones + acompañamiento 1 mes |
| Biblioteca de contenidos | — | — | ✓ |
| Reportes a medida | — | — | 2 incluidos |

**La opción recomendada es Completo.** Presentarla al centro y como la
predeterminada; las otras dos existen para dar contexto de precio, no para que
las elijan.

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
Esto protege el margen y evita la conversación incómoda del mes tres:

- Desarrollos a medida fuera del alcance (se cotizan aparte)
- Migración o limpieza de bases históricas fuera de RelBase y WooCommerce
- Integraciones con otros sistemas (ERP, contabilidad, marketplaces)
- Costos de terceros: WhatsApp Business API, servicios de correo
- Más de una sesión de configuración al mes

> **Nota de riesgo para adoOps, no para la lámina:** con $1,9M de
> implementación, la integración con RelBase tiene que ser acotada. Si el
> cliente pide transformaciones de datos a medida, conciliaciones especiales o
> limpieza de años de histórico sucio, eso se cotiza aparte desde el primer día.
> Dejarlo por escrito en la propuesta es lo que evita que el proyecto se coma el
> margen.

---

## 7. Qué necesitamos del cliente (lámina 18)

1. Token de empresa de RelBase (se solicita a `contacto@relbase.cl`) y un
   usuario integrador dedicado.
2. Claves de la API de WooCommerce con permiso de lectura.
3. Una persona de contacto que conozca la operación del mostrador.
4. Acuerdo sobre el hábito de captura en tienda. **Es el único requisito que no
   se resuelve con software.**

**Próximo paso propuesto:** una auditoría de datos de una semana con acceso de
lectura, sin costo, para medir con sus datos reales lo que la demo muestra con
datos simulados.

> Ese cierre es fuerte: baja el riesgo percibido a cero y compromete al cliente
> a entregar credenciales, que es la barrera real de este tipo de proyecto.

---

## 8. Guía visual

**Paleta (la del CRM, para que las capturas no desentonen):**

| Uso | Color |
|---|---|
| Verde adoOps (acentos, botones) | `#20a64c` |
| Verde claro (fondos de destaque) | `#eaf7ef` |
| Fondo de página | `#f9f9f7` |
| Superficie de tarjeta | `#fcfcfb` |
| Tinta principal | `#0b0b0b` |
| Tinta secundaria | `#52514e` |
| Azul de datos | `#2a78d6` |
| Rojo de alerta | `#d03b3b` |

**Tipografía:** Sora para títulos, Inter para texto. Si no están disponibles,
cualquier sans geométrica para títulos y una humanista para el cuerpo.

**Reglas de diseño:**
- Una idea por lámina. Si necesita dos, son dos láminas.
- Los números grandes van solos, sin competencia visual.
- Las capturas del sistema van con borde sutil y sombra suave, sin marcos de
  navegador ni mockups de laptop.
- Nada de íconos genéricos de stock ni fotos de gente en reuniones.
- Sin animaciones de transición entre láminas.

---

## 9. Tono y lenguaje

- **Español de Chile, neutro.** Tratar de "usted" al cliente en los textos de
  ejemplo del CRM; en las láminas, impersonal.
- **Cero jerga.** No decir "customer lifetime value": decir **valor de vida del
  cliente**. No decir "churn": decir **clientes que dejan de comprar**. "RFM" se
  puede usar una vez, explicándolo.
- Frases cortas. Verbos concretos.
- **No prometer lo que no se puede sostener.** Nada de "aumenta tus ventas un
  30%": no lo sabemos y el cliente lo sabe.

### Errores que hay que evitar

| No hacer | Por qué |
|---|---|
| Vender "inteligencia artificial" como argumento central | El valor está en cruzar datos que hoy no se cruzan. La IA redacta textos, no calcula las cifras — y decir lo contrario es mentir sobre cómo funciona |
| Llenar láminas de funcionalidades | Nadie compra una lista de features. Compran responder preguntas que hoy no puede |
| Suavizar el 35,5% de ventas sin dueño | Es el momento que gana la reunión |
| Prometer que el CRM sube las ventas | Lo que sube es la capacidad de saber a quién contactar y por qué |
| Mostrar el precio antes de la demo | El precio solo tiene sentido después de que vio lo que recibe |

---

## 10. Advertencia sobre el rubro de la demo

**El sistema que se muestra corre con datos de una boutique de relojería y alta
joyería ficticia ("Belmont Alta Relojería"), no del rubro del cliente.**

Fue deliberado: se eligió un rubro con la misma mecánica comercial —ticket alto,
venta consultiva, showroom, cliente que vuelve— sin usar el producto del
cliente.

**Hay que decidir antes de la reunión** una de dos:

- **Opción A (recomendada):** mostrarlo tal cual y decirlo en una línea: *"los
  datos son simulados con la forma que tendrían los suyos"*. Es honesto y evita
  la sensación de que se armó algo apurado.
- **Opción B:** cambiar el mock al rubro real del cliente antes de la reunión.
  Más impacto, pero expone que se preparó específicamente para ellos, lo que
  puede leerse como presión.

Si se elige B, el cambio es de una tarde: se reemplazan las categorías, marcas y
nombres de producto del catálogo, y todo el resto del sistema se recalcula solo.

---

## 11. Anexo · dónde ver el sistema

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
| Calidad del dato | `/crm/clientes?vista=datos` |
| Señales | `/crm/senales` |
| Showroom | `/crm/showroom` |

**Tomar las capturas en 1440px de ancho**, en modo claro, con la barra lateral
visible: se ve que es un sistema real y no una lámina dibujada.
