# Módulos

La lista completa **no está acá**. Está en [`lib/modulos.ts`](../lib/modulos.ts),
porque un documento se desactualiza en dos semanas y nadie se entera hasta que
alguien confía en él. Este archivo explica la convención; el detalle vive en el
código, que además es lo que la pantalla lee para marcarse.

## El problema que resuelve

Hay **una sola base de datos**. `db/index.ts` abre un único `DATABASE_URL`: el
motor de prospección, el CRM, TorreControl y TV Mix escriben todos en la misma
base de Neon, separados por prefijo de tabla y no por ambiente. No existe una
base de demo de la que las fichas de prueba no puedan salir.

En el CRM de CDC eso ya costó: unas fichas de prueba terminaron dentro del
sistema de producción de un cliente y quedaron ahí para siempre, porque nada en
la pantalla decía a qué ambiente se estaba escribiendo. La defensa que quedó ahí
—`pre_quotes.salucloud_env`, que guarda **por fila** contra qué ambiente se
escribió— es la que se copia acá.

## Los cuatro estados

Están definidos por lo que implican, no por cómo suenan. La pregunta que decide
es siempre la misma: **¿puede haber adentro datos de una persona real?**

| Estado | ¿Personas reales? | ¿Se puede romper sin avisar? | ¿Cómo se llega? |
|---|---|---|---|
| `produccion` | sí | no | navegación pública o login |
| `demo` | **nunca** | sí, avisando si hay una reunión cerca | solo por link |
| `interno` | puede | sí | solo con sesión |
| `archivado` | no | sí | no aparece |

Aparte del estado, cada módulo declara **de dónde salen sus datos**: `reales`,
`sembrados` (de un script de `scripts/`), `mixtos` (sembrado de base, pero acepta
entradas reales en vivo) o `ninguno` (no guarda nada sobre las personas que lo
usan). Los dos ejes son distintos: TorreControl es un `demo` con datos `mixtos`,
porque durante una demostración entran mensajes de WhatsApp de verdad.

## El chip

Cada módulo se marca a sí mismo con `<ChipModulo>`, abajo a la derecha. **La
etiqueta va donde está la persona que se puede confundir**, no en un README.

Dos ausencias son deliberadas:

- **Producción no lleva chip.** Si todo lleva etiqueta, ninguna se lee, y la
  ausencia pasa a significar "esto es de verdad". Esa es la señal que interesa.
- **Un módulo que no guarda datos de personas tampoco.** TV Mix guarda el código
  de una sala y una cola de videos: no hay ficha que confundir.

## Cómo agregar un módulo

1. Una fila en `MODULOS` (`lib/modulos.ts`), con su `nota` de una línea. Si el
   porqué no cabe en una línea, la clasificación está mal.
2. `<ChipModulo id="…" />` al final de su pantalla. En un layout compartido por
   módulos con estados distintos, `<ChipModuloAuto />`.
3. Si exige sesión, su prefijo en `AREAS` y en el `matcher` de `proxy.ts`.

## Lo que este registro NO hace

No impide escribir datos reales en un demo. Eso lo tiene que impedir el código de
cada módulo. Esto declara la intención y la hace visible, que es el paso que
faltaba.
