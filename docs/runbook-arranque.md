# Runbook de arranque

**adoOps · motor de nurturing** · agosto de 2026
**Complementa:** `factibilidad-leads-linkedin.md` · `mvp-motor-nurturing.md` · `sales-navigator-como-encaja.md`

---

## Lo primero: cuál es el camino crítico

No es el código. **Es la cuenta de LinkedIn.**

Una cuenta nueva no puede mandar 20 invitaciones diarias el primer día — se restringe. El warm-up honesto son cuatro o cinco semanas, y **no depende de que exista una sola línea del sistema**. Si la creas cuando el motor esté listo, esperas cinco semanas más mirando el techo.

```
Semana        1      2      3      4      5      6      7      8
              │      │      │      │      │      │      │      │
Cuenta LI   ┌─┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴─┐
            │ crear · perfil · actividad orgánica │ 5/d │8/d│12/d│16/d│20-25/d
            └────────────────────────────────────┴─────┴───┴────┴────┴───────
                                                  ▲
                                    acá recién empieza a enviar

Fase 0      ┌──────┬──────┐
            │cober-│canal │
            │tura  │      │
            └──────┴───┬──┘
                       ▲ PUERTA GO / NO-GO

Motor                  ┌──────┬──────┬──────┬──────┬──────┬──────┐
                       │esque-│uni-  │motor │esca- │seña- │cumpl.│
                       │ma    │pile  │pasos │lera  │les   │+ 1ª  │
                       └──────┴──────┴──────┴──────┴──────┴──────┘
```

El calce es exacto: cuando el motor está listo en la semana 8, la cuenta ya está a régimen. **Por eso el día 1 es un día de trámites, no de código.**

---

# DÍA 1 · lo que tiene demora y no depende de nadie más

Cuatro cosas, ninguna toma más de media hora, y las cuatro tienen tiempo de espera.

### ☐ 1.1 · Crear la cuenta de LinkedIn dedicada

**No la tuya. No la de un socio. No la del CEO.** Es un activo que se puede perder.

- Correo propio del dominio de adOps (`prospeccion@` o el nombre de una persona real del equipo comercial).
- Perfil **completo**: foto real, banner, titular, "acerca de", experiencia con fechas, educación, 5 skills.
- Sin Sales Navigator todavía. Sin conectarla a nada. **Sin automatización de ningún tipo.**

**Higiene de las próximas cuatro semanas** — 10 minutos al día, una persona real:

| Frecuencia | Qué |
|---|---|
| Diario | Entrar, mirar el feed, reaccionar a 3–5 publicaciones |
| 3× semana | Comentar algo con criterio en una publicación del rubro |
| Semanal | Publicar algo propio, aunque sea corto |
| Semana 1–4 | Conectar **a mano** con 10–15 personas que realmente conozcan a alguien del equipo |

Esto no es teatro. La detección de LinkedIn opera sobre **desviación respecto del comportamiento base de cada cuenta**. Una cuenta sin base es una cuenta sin margen.

### ☐ 1.2 · Pedir el ticket de ChileCompra

Llega por correo y **no publican cuánto demora**. Pídelo hoy y olvídate.

- Formulario: **https://api.mercadopublico.cl/modules/IniciarSesion.aspx**
- Requiere **Clave Única**. Piden nombre, RUT y correo. Un ticket por persona.
- Límite: **10.000 consultas al día, no modificable.**

Mientras llega, hay un ticket de prueba que circula en la documentación antigua — `F8537A18-6766-4DEF-9E59-426B4FEE2844`. Sirve para probar la forma de la respuesta; **no sirve para nada más**, porque lo comparten miles de personas y el cupo diario es compartido.

Prueba de que funciona, apenas llegue:

```bash
curl "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?estado=activas&ticket=TU_TICKET" | head -c 800
```

⚠️ El formato de fecha es **`ddmmaaaa`**, no ISO. `12062026` es el 12 de junio de 2026.

### ☐ 1.3 · Agendar al abogado

Un abogado de **protección de datos**, no el que ve contratos. Las tres preguntas, textuales:

1. ¿Es invocable el **interés legítimo del Art. 13 d) de la Ley 21.719** para prospección fría B2B a personas que no son clientes, o se requiere consentimiento previo?
2. ¿Aplica el **Art. 28 B de la Ley 19.496** —que está en la ley del consumidor— a destinatarios estrictamente B2B?
3. Si un tercero conecta voluntariamente su propia cuenta de LinkedIn a una plataforma nuestra, ¿configura eso el tipo del **Art. 2 de la Ley 21.459**?

La primera decide si esto puede llegar a ser producto. Contexto para el correo: la ley entra en vigencia el 1 de diciembre de 2026, y el 4 de agosto el Gobierno anunció un proyecto de postergación que aún no ingresa.

### ☐ 1.4 · Abrir las cuentas gratis de enriquecimiento

Ninguna pide tarjeta.

| Servicio | Registro | Gratis |
|---|---|---|
| **Prospeo** | https://prospeo.io/sign-up | **100 créditos al mes**, se renuevan |
| **FullEnrich** | https://app.fullenrich.com/app/signUp | **50 créditos**, una vez |

Entre los dos son 150 créditos: alcanza para **~150 de 200 empresas** sin gastar un peso. Y si esperas al mes siguiente, Prospeo te da otros 100 y completas la muestra a costo cero.

> **No pidas teléfonos móviles en el test.** Cuestan 10 créditos cada uno: quemas el cupo gratis en cinco registros. Solo emails.

**Todavía NO abras el trial de Sales Navigator ni el de Unipile.** El de Unipile dura 7 días y el de Sales Navigator solo se puede usar una vez cada 365 días. Van en la semana 3, cuando la cuenta tenga algo de edad y haya algo que probar.

---

# SEMANA 1 · ¿hay a quién escribirle?

Esta es la pregunta que puede cerrar el proyecto por USD 0. **No necesita LinkedIn.**

### ☐ 2.1 · Bajar y perfilar la nómina del SII

Descarga libre, sin registro. El script `fase0_sii.py` hace todo:

```bash
pip install pandas requests
python3 fase0_sii.py perfilar
```

Baja `PUB_NOMBRES_PJ.zip` y `PUB_NOM_ACTECOS.zip` (actualizados a **agosto de 2026**), detecta solo el encoding y el delimitador —el SII **no publica layout ni diccionario de datos**, hay que deducirlo— e imprime las columnas reales y tres filas de ejemplo.

**Anota lo que salga.** Ese es el layout que no existe documentado en ninguna parte, y lo vas a necesitar en la semana 3.

### ☐ 2.2 · Definir el ICP como un `WHERE`

No sirve "empresas medianas". Tiene que poder escribirse como filtro:

```bash
python3 fase0_sii.py actecos --top 40      # ver qué rubros hay y cuántas empresas
```

Y quedar en una línea:

> **ICP v1:** ACTECO que empieza en `__`, región `__`, tramo de ventas `__`.

Si no puedes escribirlo así, el motor no puede alimentarse solo.

### ☐ 2.3 · Armar la muestra

```bash
python3 fase0_sii.py muestra --acteco 62 63 --region 13 --n 200
```

Sale `salida/muestra_icp.csv` con RUT, razón social, ACTECO y las columnas vacías del test. La semilla está fija: dos corridas dan la misma muestra, así el resultado es reproducible.

### ☐ 2.4 · Completar el dominio

El paso aburrido y el único que no se puede saltar: **sin dominio web, ningún proveedor de enriquecimiento encuentra nada.** Búsqueda web, Google Maps, o el sitio de la empresa.

Ya acá aparece el primer dato: **cuántas de las 200 ni siquiera tienen sitio web.** Si son muchas, ese segmento no se prospecta por email — se prospecta por teléfono o WhatsApp, y eso cambia el diseño.

### ☐ 2.5 · Correr el test

1. Sube el CSV a **Prospeo** en modo *company enrichment* — 100 créditos.
2. Los que no resuelva, pásalos por **FullEnrich** — 50 créditos.
3. Marca `prospeo_ok` y `fullenrich_ok`.
4. **Cuenta.**

### El número que decide

| De 200 empresas, con email verificado | Lectura |
|---|---|
| **Más de 120 (60%)** | Verde. La cobertura chilena alcanza. Adelante con el motor |
| **60 a 120 (30–60%)** | Amarillo. Funciona pero necesita más fuentes: Google Maps, teléfono, WhatsApp. **Rediseñar antes de construir** |
| **Menos de 60 (30%)** | Rojo. El email frío no es el canal en este ICP. Toca cambiar de ICP o de canal, no de proveedor |

> Este número **no existe publicado en ninguna parte** — lo verificamos, y no hay un solo benchmark independiente de cobertura de datos por país para LatAm. Al terminar la semana 1, adOps va a tener el único dato confiable que existe sobre esto.

---

# SEMANA 2 · ¿el canal aguanta?

### ☐ 3.1 · Bajar el OCDS de ChileCompra

**No bajes los 2,5 GB completos.** Por año alcanza:

```bash
curl -O "https://data.open-contracting.org/en/publication/144/download?name=2026.jsonl.gz"
curl -O "https://data.open-contracting.org/en/publication/144/download?name=2025.jsonl.gz"
```

*(El portal propio de ChileCompra requiere JavaScript para listar sus descargas; el registro de OCP es el mismo dato bajo licencia CC0 y se baja directo.)*

Lo que hay que responder mirándolo:

- ¿Las adjudicaciones traen **RUT del proveedor** en forma utilizable para cruzar con el SII?
- ¿Cuántas empresas distintas del ICP aparecen adjudicándose algo en los últimos 12 meses?
- ¿Con qué latencia se publica una adjudicación? Si demora tres meses, la señal ya no es señal.

> ⚠️ **Cuidado con el conteo.** El dataset reporta ~5 millones de "suppliers", pero eso cuenta **ocurrencias del rol**, no empresas. Deduplica por RUT antes de dimensionar nada — Chile tiene del orden de 1,2 a 1,5 millones de personas jurídicas en total.

### ☐ 3.2 · Escribir el primer mensaje a mano

Antes de automatizar nada: **escribe cinco invitaciones reales, de menos de 300 caracteres, cada una con la señal de esa empresa.** Mándalas desde la cuenta nueva, a mano.

Es la prueba más barata del proyecto y la más ignorada. Si a ti te cuesta escribir cinco mensajes que no suenen a plantilla, el motor va a producir cinco mil que suenan peor.

### ☐ 3.3 · La puerta

Fin de semana 2. Con los tres datos sobre la mesa —cobertura de contacto, calidad de la señal, respuesta del abogado— **se decide**:

- **GO** → arranca el motor en la semana 3
- **PIVOTE** → cambia el ICP o el canal principal, repite la Fase 0. Barato
- **NO-GO** → se cierra habiendo gastado dos semanas y ~$0

---

# SEMANAS 3 A 8 · el motor

Detalle completo en `mvp-motor-nurturing.md`. Acá el orden y lo que hay que tener listo antes de cada una.

| Semana | Qué queda funcionando | Requisito previo |
|---|---|---|
| **3** | Las 9 tablas `lead_` · carga por CSV · lista de prospectos · **el campo `origen` desde el primer commit** | Layout del SII de la semana 1 |
| **4** | Trial de **Unipile** (7 días) + trial de **Sales Navigator** (30 días) · conectar la cuenta · **enviar UNA invitación real desde la interfaz** · webhooks de respuestas | Cuenta con 3 semanas de edad |
| **5** | Motor de pasos: inscripciones, cola, scheduler cada 15 min · los cuatro candados · modo simulado | — |
| **6** | Escalera de canales completa · retiro de invitaciones a los 14 días · detención por respuesta · email por Brevo | Semana 5 |
| **7** | Señales de ChileCompra por API · plantillas con la señal · aprobación por lote | Ticket de ChileCompra |
| **8** | Opt-out operativo · registro de actividades · las seis métricas · **primera campaña real de 200 prospectos** | Cuenta a régimen |

### El único momento donde importa el orden de los trials

**Semana 4, los dos juntos.** Unipile dura 7 días, así que hay que tener algo que probar cuando se abre. Sales Navigator dura 30 y solo se puede usar una vez cada 365 días — no lo quemes antes.

Con los dos abiertos, corre **la medición que no está publicada en ninguna parte**:

```
Búsqueda de 500 personas del ICP vía Unipile con api: "sales_navigator"
        │
        └──►  ¿Cuántas traen  open_profile = true ?
```

Ese porcentaje define el tamaño del carril de InMail gratis, y con él si el modelo de costos cierra. Nadie lo publica porque LinkedIn quitó ese badge de la interfaz.

---

## Checklist de compras, en orden

| Cuándo | Qué | Costo |
|---|---|---|
| Día 1 | Prospeo + FullEnrich, capa gratis | **$0** |
| Semana 4 | Trial Unipile (7 d) + trial Sales Navigator (30 d) | **$0** |
| Semana 5 | Unipile de pago | €49/mes |
| Semana 6 | IP residencial dedicada | ~$12/mes |
| Semana 7 | Prospeo o FullEnrich de pago | $39–55/mes |
| Semana 7 | MillionVerifier | ~$11/mes |
| Semana 8 | Sales Navigator Core **mensual**, no anual | ~$120/mes |
| | **Régimen** | **≈ $250–265/mes** |

Sales Navigator **mensual** hasta que el motor demuestre que sirve. No hay compromiso anual obligatorio y se cancela al final del período. El anual ahorra 25%, pero recién cuando haya certeza.

---

## Las cinco cosas que hay que decidir antes de la semana 3

1. **¿Quién es el dueño de la cuenta de LinkedIn** y quién hace los 10 minutos diarios de higiene?
2. **El ICP como `WHERE`.** Rubro, región, tramo.
3. **Cuál es la primera señal.** La recomendación es adjudicación en ChileCompra: es diaria, verificable y tiene presupuesto detrás. Pero solo sirve si el ICP le vende al Estado — si no, la señal es empresa recién constituida o cambio de tramo.
4. **Quién contesta.** El motor abre conversaciones. Si nadie responde en menos de 24 horas, todo esto es un generador de mala reputación bien instrumentado.
5. **Qué se hace si LinkedIn restringe la cuenta.** Que no sea la primera vez que se piensa el día que pasa.

La cuarta es la que mata proyectos y no se resuelve con software. Es el mismo punto que ya identificaron en la propuesta del CRM sobre el hábito de captura en la sala.

---

## Hoy, en concreto

Media hora, cuatro cosas:

1. Crear la cuenta de LinkedIn y llenar el perfil completo
2. Pedir el ticket de ChileCompra con Clave Única
3. Mandarle el correo al abogado con las tres preguntas
4. Registrarse en Prospeo y FullEnrich

Mañana: `python3 fase0_sii.py perfilar` y a definir el ICP.
