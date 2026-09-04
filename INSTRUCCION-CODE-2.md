# Cafecito IA — bugs del doble opt-in y del despacho

Dos repos:
- `~/Proyectos/adoOps.Digital` (sitio, Next.js + Drizzle + Neon)
- `~/Proyectos/resumen semanal de whatsapp` (redacción y despacho)

## Síntoma reportado

Joaquín completó el doble opt-in y eligió **flat white**. Le llegó el **expreso directivo**.

En la corrida del 04-09 el despachador reportó:

```
Enviado [builder] a 1/1 — lista: sitio
Enviado [gerencia] a 1/1 — lista: sitio
Sin suscriptores para [web] (flat_white); no se envía nada.
```

## Paso 0 — diagnóstico primero, no toques código todavía

No deduzcas la causa. Mírala.

```
cd "/Users/joaquintrujillo/Proyectos/resumen semanal de whatsapp"
source .env
for t in expreso_directivo expreso_builder flat_white; do
  echo "--- $t"
  curl -s -H "authorization: Bearer $CAFECITO_TOKEN" \
    "https://www.adoops.digital/api/cafecito/suscriptores?taza=$t" | python3 -m json.tool
done
```

Y consulta la tabla completa (incluidos `pendiente` y dados de baja, que la API no devuelve). Usa la conexión de Neon del `.env` del sitio:

```sql
SELECT id, email, estado, taza, confirmado_en, baja_en, creado_en
FROM cafecito_suscriptores ORDER BY creado_en;
```

Reporta qué devolvió antes de cambiar nada. Las tres explicaciones posibles son excluyentes y los datos deciden cuál es:

- Su fila dice `taza = 'expreso_directivo'` → el problema está entre el click y el submit del formulario.
- Su fila dice `taza = 'flat_white'` pero la API no la devolvió → el problema está en el filtro o en `estado`/`baja_en`.
- Su correo no aparece confirmado en ninguna → el envío salió de la lista de respaldo de `email.config.json` y el problema es el fallback.

## Bug 1 — la página de confirmación miente sobre el estado (confirmado)

`app/cafecito-ia/confirmar/[token]/page.tsx` muestra **"Correo confirmado. Ahora elige el tamaño de tu taza…"** apenas se abre el enlace. Pero esa página **solo lee la base, no escribe nada**.

El único lugar en todo el proyecto que escribe `estado: "confirmado"` es `lib/cafecito/actions.ts:134`, dentro de `perfilar` — o sea, al **enviar** el formulario de perfilamiento.

Consecuencia: quien abre el enlace, lee "Correo confirmado" y cierra la pestaña queda en `pendiente` para siempre, creyendo que se suscribió. Nunca recibe nada y nadie se entera.

**Arreglo.** Separa las dos cosas, que hoy están fusionadas:

- Confirmar el correo debe ocurrir al abrir el enlace válido: marca `estado = 'confirmado'` y `confirmado_en` ahí mismo (idempotente — si ya estaba confirmado, no lo toques). Eso es lo que el doble opt-in promete y lo que el texto ya afirma.
- El perfilamiento (nombre, empresa, rol, teléfono, **taza**) queda como un paso posterior y opcional, que `perfilar` sigue guardando.
- Ajusta el copy para que diga la verdad en cada estado.

Ojo con el efecto secundario: al desacoplarlos aparecen suscriptores confirmados sin taza, que hoy son un caso teórico. Eso conecta con el Bug 3.

## Bug 2 — el despachador marca `enviado` cuando no envió a nadie

`despachador.js:150` escribe `estado: 'enviado'` aunque `enviar-informe.js:121` haya salido por "Sin suscriptores". Por eso `2026-09-04-web.md` figura como enviado sin que le llegara a nadie.

Consecuencia: si alguien elige flat white mañana, esa edición nunca se le manda — quedó registrada como despachada.

**Arreglo.** Que `enviar-informe.js` distinga "enviado a N" de "cero destinatarios", y que el despachador registre el segundo caso como `sin_destinatarios` (o similar) **sin bloquear el reintento** en corridas futuras. No lo trates como error: no debe hacer fallar la corrida ni abortar las otras variantes.

## Bug 3 — el fallback de taza es silencioso

`app/api/cafecito/suscriptores/route.ts`:

```ts
.filter((f) => (f.taza ?? "expreso_directivo") === taza)
```

Quien está confirmado sin taza recibe el expreso directivo y no queda rastro de que fue un default y no una elección.

**Arreglo.** Mantén el fallback (es preferible a no mandar nada), pero hazlo visible: que la respuesta marque esas filas como `tazaPorDefecto: true`, y que el despachador lo registre en el log. Si el diagnóstico del paso 0 muestra que este es el camino por el que llegó el correo equivocado, esto es lo que lo habría delatado el primer día.

## Bug 4 — el selector de tazas depende de un CDN externo con `@latest`

`components/CafecitoPerfil.tsx` carga los íconos con:

```
url('https://unpkg.com/lucide-static@latest/icons/${ICONO[valor]}.svg')
```

Dependencia externa sin versión fijada dentro de un `mask` CSS. Si unpkg falla o cambia el ícono, la opción se ve rota. Inlínea los SVG o fija la versión.

## Verificación

1. Registra un correo de prueba nuevo, abre el enlace y **cierra sin enviar** el formulario → debe quedar `confirmado`, y la API debe devolverlo (con la marca de taza por defecto).
2. Repite, esta vez eligiendo **flat white** y enviando → la API debe devolverlo bajo `flat_white` y no bajo `expreso_directivo`.
3. `npm run despachar --forzar` sobre la edición `2026-09-04-web.md` y confirma que llega.
4. Deja `enviados.json` consistente con lo que realmente se envió.

## Contexto que no debes romper

- `db/schema.ts` debe seguir re-exportando los 10 archivos de `db/`. **Nunca** corras `drizzle-kit push` contra esta base: es compartida y propone borrar tablas ajenas. Migraciones versionadas, y `npm run db:verificar` antes de desplegar.
- Las migraciones tienen que aplicarse **antes** del deploy, no después: así se cayó el build del 03-09.
