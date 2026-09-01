# Programa editorial · H&CO · 24 slots hacia el 1 de diciembre

**Complementa:** `hyco-levantamiento.md` (investigación y borradores).
**Cadencia:** un slot cada 4 días, del **29-08** al **29-11**. El último cae dos
días antes de la vigencia.

---

## Por qué varios emisores es mejor, y no solo más

Un perfil publicando 24 veces sobre el mismo tema parece una campaña. Cuatro
voces que discuten el mismo tema desde su especialidad parecen **un estudio**.

Y tiene una ventaja que ninguna otra arquitectura de este proyecto tuvo: **cada
persona publica sobre lo suyo, en su propio perfil, con su nombre.** No hay nada
que ocultar, nada que se parezca a automatización encubierta, y ninguna de las
tensiones que discutimos antes. Es la configuración más segura y además la más
creíble.

| Emisor | Voz | Qué le toca |
|---|---|---|
| **E1 · Socio legal** | Por qué la norma dice lo que dice | Sanciones, intención legislativa, estrategia |
| **E2 · Líder de adecuación tecnológica** | Cómo se ve en la operación | Brechas, sistemas, ciclo de vida del dato |
| **E3 · Gobernanza** | Quién decide qué | Registro, delegado, roles, RRHH |
| **E4 · Página H&CO** | La institución | Los documentos descargables |

E1 es el que carga el diferenciador que ellos mismos declaran —legisladores en el
equipo— y es el único ángulo que ningún competidor puede copiar. Vale la pena que
sea la voz más frecuente.

> Los roles están definidos por función, no por nombre. H&CO mapea sus personas.

## Lo que esto exige técnicamente

Tres consecuencias directas de lo verificado el 25-08:

**Un token por persona.** `w_member_social` es por miembro: cada perfil autoriza
por separado y cada uno tiene su token con **60 días** de vida, sin renovación
automática. Con cuatro emisores son cuatro relojes distintos. La tabla
`contenido_emisores` necesita columna de vencimiento y la pantalla tiene que
mostrarlo — igual que `lead_emisores` muestra el warm-up.

**La página de empresa está bloqueada hoy.** Publicar como H&CO usa
`w_organization_social`, que **no es autoservicio**: viene con Community
Management API. En su portal aparecía en *Development Tier*. **Es lo primero que
hay que destrabar**, porque los seis documentos —el corazón de esta estrategia—
salen desde ahí. Apretar «Request access» cuesta un clic y despeja la duda.

> Si Community Management no resulta accesible, el plan B no es grave: los
> documentos salen desde el perfil de E1 y la página los recompar­te a mano. Se
> pierde alcance institucional, no se pierde el programa.

**Los PDF ya están probados.** El `initializeUpload` de documentos devolvió `200`
con autor persona. Formato PDF, hasta 100MB y 300 páginas. El «carrusel»
deslizable del feed es esto.

---

## Los seis documentos

Son el activo real del programa. Un texto se lee y se olvida; un cuestionario se
guarda, se comparte con el jefe y se llena. **Esa es la viralización que buscas**,
y en LinkedIn el formato que la produce es el PDF deslizable.

Hay una objeción obvia: si regalas el diagnóstico, ¿siguen necesitando al
estudio? Sí, y es justamente el mecanismo. El cuestionario **revela** el problema
—«nueve de veinte en rojo»—; resolverlo requiere abogados. Regalar el diagnóstico
es como se vende el tratamiento.

| # | Documento | Slot | Qué produce |
|---|---|---|---|
| **D1** | **Autodiagnóstico 21.719** · 20 preguntas de sí/no con semáforo al final | 10-09 | El que sale en rojo llama |
| **D2** | **Plantilla de registro de actividades de tratamiento** · la tabla, con dos filas de ejemplo llenas | 26-09 | La obligación más tediosa, resuelta a medias |
| **D3** | **Protocolo de brecha en 72 horas** · una página: quién decide, a quién llama, qué reloj corre | 12-10 | Se imprime y se pega |
| **D4** | **Perfil del delegado** · funciones, incompatibilidades, checklist de designación | 28-10 | Resuelve la reunión donde se nombra al que tenga menos carga |
| **D5** | **Mapa de datos de RRHH** · dónde suelen estar los datos que nadie registró | 13-11 | El punto ciego, hecho lista |
| **D6** | **Últimas semanas: qué alcanza a hacer** · calendario de adecuación | 25-11 | El que despertó tarde |

Cada documento se acompaña de un texto corto que lo presenta, y los otros dos
perfiles lo comentan o recomparten en los días siguientes. Eso multiplica el
alcance sin publicar de más.

**Regla:** cada documento lleva la marca de H&CO y una forma de contacto, pero
**no es un folleto**. Si el PDF no sirve por sí solo, no se guarda, no se
comparte, y no cumple su función.

---

## El calendario

`E1` socio legal · `E2` técnico · `E3` gobernanza · `PÁG` página H&CO
**Los borradores numerados están escritos en `hyco-levantamiento.md`.**

| # | Fecha | Emisor | Formato | Ángulo |
|---|---|---|---|---|
| 1 | 29-08 | E1 | texto | No hay período de gracia · **borrador 1** |
| 2 | 02-09 | E1 | texto | La multa no es lo peor: 30 días · **borrador 2** |
| 3 | 06-09 | E3 | texto | El registro que nadie hizo · **borrador 3** |
| 4 | 10-09 | **PÁG** | **PDF** | **D1 · Autodiagnóstico** |
| 5 | 14-09 | E2 | texto | Las 72 horas · **borrador 4** |
| 6 | 18-09 | E3 | texto | El delegado no puede ser juez y parte · **borrador 5** |
| 7 | 22-09 | E1 | texto | Las atenuantes son estrategia · **borrador 6** |
| 8 | 26-09 | **PÁG** | **PDF** | **D2 · Plantilla de registro** |
| 9 | 30-09 | E1 | texto | La pyme está diferida, no exenta · **borrador 7** |
| 10 | 04-10 | E3 | texto | El punto ciego es RRHH · **borrador 8** |
| 11 | 08-10 | E2 | texto | Los datos que no sabe que tiene · **borrador 9** |
| 12 | 12-10 | **PÁG** | **PDF** | **D3 · Protocolo de brecha** |
| 13 | 16-10 | E1 | texto | «Responsable», no «dueño» · **borrador 10** |
| 14 | 20-10 | E3 | texto | El consentimiento no es la única base · **borrador 11** |
| 15 | 24-10 | E2 | texto | Sus proveedores también tratan sus datos · **borrador 12** |
| 16 | 28-10 | **PÁG** | **PDF** | **D4 · Perfil del delegado** |
| 17 | 01-11 | E1 | texto | El titular pide y usted tiene plazo · **borrador 13** |
| 18 | 05-11 | E3 | texto | La nube está afuera · **borrador 14** |
| 19 | 09-11 | E2 | texto | Cuándo la evaluación de impacto es obligatoria · **borrador 15** |
| 20 | 13-11 | **PÁG** | **PDF** | **D5 · Mapa de datos de RRHH** |
| 21 | 17-11 | E1 | texto | Qué pasa el 2 de diciembre · **borrador 16** |
| 22 | 21-11 | E2 | texto | El dato que debió borrarse · **borrador 17** |
| 23 | 25-11 | **PÁG** | **PDF** | **D6 · Últimas semanas** |
| 24 | 29-11 | E1 | texto | Quedan dos días · **borrador 18** |

18 textos y 6 documentos. Con cuatro emisores, cada perfil publica cada 12 a 16
días: sostenible, y lejos de cualquier umbral de comportamiento.

## Lo que falta decidir

1. **Destrabar Community Management API**, o aceptar que los documentos salen
   desde un perfil.
2. **Mapear las personas de H&CO a E1, E2 y E3.**
3. **El visto bueno legal sobre las cifras**, que sigue siendo la condición de
   todo.
4. **Producir los seis PDF.** Los textos están; los documentos son diseño y
   contenido, y son el trabajo más grande que queda.
