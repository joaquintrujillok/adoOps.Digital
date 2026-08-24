# Layout real de las nóminas del SII

**Levantado el 23 de agosto de 2026** corriendo `scripts/fase0_sii.py perfilar`.
El SII **no publica layout, diccionario de datos ni encoding**. Esto es lo que
trae de verdad cada archivo. Es el insumo de la semana 3 (`db/leads.ts`).

Descarga: `https://www.sii.cl/estadisticas/nominas/<ARCHIVO>.zip` — libre, sin registro.
Los cuatro archivos son **UTF-8** con delimitador **TAB**, con cabecera.

---

## PUB_NOMBRES_PJ · 52 MB zip → 208 MB · todas las personas jurídicas

| # | Columna | Nota |
|---|---|---|
| 1 | `RUT` | **sin dígito verificador**, sin puntos, sin ceros a la izquierda |
| 2 | `DV` | dígito verificador, columna aparte. Puede ser `K` |
| 3 | `COD_SUBTIPO` | numérico, sin diccionario publicado |
| 4 | `RAZON_SOCIAL` | |
| 5 | `FECHA_INICIO_VIG` | **`dd-mm-aaaa`** |
| 6 | `FECHA_TG_VIG` | término de giro. Vacío = giro vigente. **`dd-mm-aaaa`** |

⚠️ No trae región, ni tramo de ventas, ni actividad. Solo identidad.

## PUB_NOM_ACTECOS · 39 MB zip → 364 MB · actividades vigentes por RUT

| # | Columna | Nota |
|---|---|---|
| 1 | `RUT` | sin DV |
| 2 | `DV` | |
| 3 | `CODIGO ACTIVIDAD` | 6 dígitos. Los 2 primeros son la división CIIU |
| 4 | `DESC. ACTIVIDAD ECONOMICA` | |
| 5 | `FECHA` | **`dd-mm-aaaa`** |
| 6 | `AFECTA A IVA` | `S` / `N` |
| 7 | `CATEGORIA TRIBUTARIA` | |

**Un RUT tiene varias filas** — una por actividad. Deduplicar antes de contar.

## PUB_EMPRESAS_PJ_2020_A_2024 · → 5 archivos, uno por año comercial

**Este es el único archivo con región y tramo de ventas.** Es el que convierte
el ICP en un `WHERE`. El más reciente es `PUB_EMPRESAS_PJ_2024.txt` (378 MB,
**994.476 empresas**, año comercial 2024).

22 columnas, **con tildes en la cabecera** (a diferencia de los otros dos):

`Año comercial` · `RUT` · `DV` · `Razón social` · `Tramo según ventas` ·
`Número de trabajadores dependie` *(truncada así en el original)* ·
`Fecha inicio de actividades vige` · `Fecha término de giro` ·
`Fecha primera inscripción de ac` · `Tipo término de giro` ·
`Tipo de contribuyente` · `Subtipo de contribuyente` ·
`Tramo capital propio positivo` · `Tramo capital propio negativo` ·
`Rubro económico` · `Subrubro económico` · `Actividad económica` ·
`Región` · `Provincia` · `Comuna` · `R_PRESUNTA` · `OTROS_REGIMENES`

⚠️ **Las fechas acá son `aaaa-mm-dd`**, no `dd-mm-aaaa` como en los otros dos.

⚠️ **`Región` es texto con numeral romano**, no un código numérico:
`XIII REGION METROPOLITANA`, `IV REGION COQUIMBO`. Hay 213 filas con
`Sin Información`.

### Distribución por región · año comercial 2024

| Región | Empresas |
|---|---:|
| XIII Metropolitana | 504.860 |
| V Valparaíso | 95.329 |
| VIII Biobío | 66.394 |
| VII Maule | 49.478 |
| X Los Lagos | 46.575 |
| VI O'Higgins | 44.351 |
| IX Araucanía | 42.325 |
| IV Coquimbo | 32.001 |
| II Antofagasta | 26.633 |
| XVI Ñuble | 18.611 |
| XIV Los Ríos | 18.035 |
| I Tarapacá | 15.501 |
| III Atacama | 10.129 |
| XII Magallanes | 10.042 |
| XV Arica y Parinacota | 7.282 |
| XI Aysén | 6.717 |

### Distribución por tramo de ventas · año comercial 2024

| Tramo | Empresas | | Tramo | Empresas |
|---:|---:|---|---:|---:|
| 1 | 231.083 | | 8 | 22.446 |
| 2 | 203.720 | | 9 | 13.175 |
| 3 | 120.318 | | 10 | 7.557 |
| 4 | 185.552 | | 11 | 6.088 |
| 5 | 87.592 | | 12 | 1.380 |
| 6 | 61.709 | | 13 | 2.624 |
| 7 | 51.232 | | | |

> **NO VERIFICADO:** el corte en UF de cada tramo. El archivo entrega el número
> pelado y el SII publica la equivalencia en otra página. Hay que leerla ahí
> antes de escribir el ICP — no darla por sabida.

⚠️ El dato más reciente es **año comercial 2024**. No hay tramo 2025 ni 2026.
Una empresa creada en 2025 no aparece en este archivo, aunque sí en
`PUB_NOMBRES_PJ`. Para la señal "empresa recién constituida" hay que cruzar los
dos, no basta este.

## PUB_NOM_DIRECCIONES · 95 MB zip → 467 MB · domicilios históricos

Archivo interno: `PUB_NOM_DOMICILIO.txt`. 13 columnas:

`RUT` · `DV` · `VIGENCIA` (`S`/`N`) · `FECHA` (**`aaaa-mm-dd`**) ·
`TIPO_DIRECCION` · `CALLE` · `NUMERO` · `BLOQUE` · `DEPARTAMENTO` ·
`VILLA_POBLACION` · `CIUDAD` · `COMUNA` · `REGION` (texto romano)

Trae el historial completo, con `VIGENCIA = N` para las direcciones antiguas.
Es la fuente de la señal **"cambió de domicilio o abrió sucursal"**: se detecta
comparando fechas, no consultando un campo.

⚠️ Trae basura evidente en `CALLE` (`IUQWEIQWIEIWQUIWUI` en la tercera fila del
archivo). Es autodeclarado y no está saneado.

---

## Consecuencias para `db/leads.ts`

1. **El RUT se guarda con DV.** El SII lo entrega partido en dos columnas y sin
   ceros a la izquierda; ChileCompra y los proveedores de enriquecimiento lo
   esperan completo. Normalizar a `12345678-9` en la ingesta, no después.
2. **Tres formatos de fecha conviven** (`dd-mm-aaaa`, `aaaa-mm-dd`, y `ddmmaaaa`
   en la API de ChileCompra). El parseo va por fuente, no genérico.
3. **`region` se guarda normalizada a código numérico**, no como el texto romano
   del SII. Ese texto es de presentación y ya cambió de nombre antes.
4. **`tramo_ventas` lleva el año comercial** del que salió. Un tramo sin año es
   un dato sin fecha de vencimiento, y ese es exactamente el problema que la
   procedencia por campo existe para evitar.
