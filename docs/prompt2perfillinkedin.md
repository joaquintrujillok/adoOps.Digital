# Brief · Darle vida al perfil de LinkedIn

**Para:** quien tome el trabajo de contenido y presencia en LinkedIn.
**Perfil:** `linkedin.com/in/claudia-shaw-919a23430` · creado hace 3 días.
**Contexto:** este perfil va a ser el emisor del motor de prospección de adOps
(`/dashboard360/motor`), que ya está desplegado y esperando una cuenta conectada.

---

## Lo primero: separar dos cosas que parecen una

Hay dos automatizaciones acá y **tienen riesgos opuestos**. Confundirlas es el
error más caro que se puede cometer con este perfil.

| | Publicar contenido | Seguir, conectar, mensajear |
|---|---|---|
| ¿Hay API oficial? | **Sí** — el producto *Share on LinkedIn* da el permiso `w_member_social` para publicar como el propio miembro | **No.** No existe endpoint público de conexiones ni de mensajes 1:1 |
| ¿Viola los términos? | No | Sí — artículo 8.2 del acuerdo de usuario |
| Riesgo de la cuenta | Ninguno | Restricción o baneo |
| Cuánto se puede automatizar | Todo | Poco, y despacio |

**La parte que quieres automatizar —construir publicaciones— es justamente la
que está permitida.** La parte que suena inofensiva —seguir gente— es la
arriesgada. Y en una cuenta de tres días, seguir a escala es la forma más rápida
de perderla.

> ⚠️ Verificar en el portal de desarrolladores de LinkedIn que *Share on
> LinkedIn* siga disponible en modo autoservicio antes de construir sobre eso.
> LinkedIn viene cerrando programas —Sales Navigator API está cerrada a nuevos
> partners— y conviene confirmarlo, no asumirlo.

---

## Una decisión que hay que tomar explícitamente

Si **Claudia Shaw es una persona real** del equipo que va a operar la cuenta,
todo lo que sigue aplica tal cual.

Si es **un personaje**, hay que decidirlo a conciencia y arriba, porque choca con
el argumento sobre el que se construyó el motor entero:

- El motor se apoya en el **interés legítimo** del art. 13 d) de la Ley 21.719, y
  ese test se sostiene en que el contacto es transparente y pertinente.
- El art. 28 B de la Ley 19.496 exige **identificar al remitente** en una
  comunicación comercial.
- Escribirle a alguien como una persona que no existe no rompe una regla de
  estilo: **desarma la defensa legal del sistema completo**, que es lo que lo
  diferencia de las trece herramientas del mercado.

No es un impedimento técnico y no cambia una línea de código. Es una decisión de
producto que conviene tomar ahora y no cuando alguien pregunte.

---

## Fase 0 · Esta semana, a mano, sin una sola automatización

Una cuenta de tres días con actividad automatizada entra en revisión. La
detección de LinkedIn opera sobre **la desviación respecto del comportamiento
esperado de esa cuenta**, no sobre umbrales fijos — y una cuenta nueva no tiene
historial contra el cual parecer normal.

**Nada de automatización hasta el día 30.** Punto.

### La URL, que es lo que preguntaste

`/in/claudia-shaw-919a23430` tiene el sufijo numérico porque nunca se
personalizó. Se arregla a mano, en dos minutos:

**Perfil → Editar perfil público y URL** (arriba a la derecha) → editar la URL
personalizada.

Dejarla en algo estable y corto: `/in/claudia-shaw-adops` o similar. Dos avisos:
LinkedIn limita los cambios en una ventana de meses, y **la URL vieja deja de
funcionar** — así que hay que elegirla pensando en que no se cambia más.

### El resto del perfil

Un perfil incompleto es la señal más barata de cuenta descartable, y además baja
la tasa de aceptación, que es la métrica que decide si el motor puede operar.

- Foto y portada reales
- Titular que diga qué hace, no un cargo genérico
- «Acerca de» de tres o cuatro párrafos
- Experiencia con al menos un puesto y fechas coherentes
- Aptitudes, idiomas, ubicación
- Vincular la página de empresa de adOps

### Actividad orgánica, de a poco

Semanas 1 a 4, todo a mano:

- 5 a 10 conexiones **por día** como máximo, gente que de verdad tenga sentido
- Comentar dos o tres publicaciones al día — comentarios de verdad, de dos
  líneas, no «¡Excelente!»
- Reaccionar sin exagerar
- **Publicar dos veces por semana desde la semana 1**

Lo que se busca es que para el día 30 la cuenta tenga un baseline: alguien que se
conecta, comenta y publica. Recién ahí una automatización se parece a lo que esa
cuenta ya hacía.

---

## Fase 1 · La máquina de contenido

Acá está el valor real, y es la parte que no tiene riesgo de plataforma.

### Qué construir

Una tubería con aprobación humana antes de publicar:

```
tema o señal  →  borrador generado  →  revisión de una persona  →  publicación
```

- **Los temas salen de lo que adOps ya sabe.** El motor de prospección tiene
  señales de ChileCompra y firmografía del SII: «cuántas empresas del rubro X se
  adjudicaron licitaciones este mes» es una publicación que nadie más en Chile
  puede escribir con datos. Es el mismo activo que hace defendible el motor.
- **Calendario de dos o tres publicaciones por semana**, no más. La consistencia
  pesa más que el volumen.
- **Nada se publica sin que una persona lo lea.** Es el mismo candado 1 del motor
  de prospección, y por la misma razón: un texto generado que sale sin revisar es
  el que termina diciendo algo absurdo con la marca al lado.
- **Guardar qué se publicó y cuándo**, igual que el motor guarda cada mensaje. Si
  alguien pregunta por una publicación, tiene que haber respuesta.

### Qué NO construir

- **Nada de seguir o conectar automáticamente.** Sin API, contra los términos, y
  el riesgo cae sobre la cuenta que el motor necesita.
- **Nada de extensiones de navegador.** Son la arquitectura con más huella de
  detección: LinkedIn inspecciona el DOM modificado y los scripts inyectados.
- **Nada de comentar automáticamente.** Un comentario genérico bajo la
  publicación de un prospecto hace más daño que no comentar.

---

## Fase 2 · Conectar el perfil al motor

Recién cuando la cuenta tenga un mes de vida y perfil completo.

1. Contratar Unipile (~USD 55/mes) y conectar la cuenta.
2. Pegar el `account_id` en `/dashboard360/motor/emisores`.
3. **Dejar el warm-up como viene**: 5 invitaciones al día la primera semana, 8 la
   segunda, 12, 16, y techo en 20–25. Está en la pantalla y no hay que tocarlo.
4. Mantener las campañas en **modo simulado** hasta ver una cola completa
   correcta en el panel.
5. IP residencial dedicada (~USD 12/mes). Cambiar de IP entre sesiones también se
   detecta.

El motor ya tiene el freno automático: si la aceptación de 7 días cae bajo 25%,
deja de despachar solo. No es una alerta para que alguien decida — cuando una
persona lee la alerta, la cuenta ya va camino a la restricción.

---

## Lo que hay que entregar

1. La URL personalizada, arreglada.
2. El perfil completo: foto, portada, titular, «acerca de», experiencia.
3. Un calendario editorial de cuatro semanas con los temas.
4. Una respuesta a si *Share on LinkedIn* está disponible hoy en autoservicio.
5. La decisión sobre la identidad del perfil, por escrito.
6. Un registro simple de la actividad diaria de las primeras cuatro semanas
   —conexiones, comentarios, publicaciones— para poder mirar el baseline después.

## Lo que no hay que hacer nunca

- Comprar seguidores o conexiones.
- Usar la cookie de sesión de un tercero. En Chile eso deja de ser un problema
  contractual y entra en el art. 2 de la Ley 21.459, con pena de presidio.
- Apurar el warm-up porque «no pasa nada». Lo que se pierde no es la cuenta: es
  el mes de historial que la hacía creíble.
