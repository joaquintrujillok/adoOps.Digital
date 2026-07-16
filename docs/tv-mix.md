# TV Mix · Mezcla YouTube sincronizado con tu televisor (/mix + /tv)

Sistema de mixeo tipo DJ con **doble pantalla**: la consola corre en el celular
o el computador (`/mix/SALA`) y el televisor muestra el video y reproduce el
audio (`/tv/SALA`). Dos decks de YouTube, crossfader con curva equal-power,
volumen por deck, master, biblioteca de recientes y un DJ asistente con IA.

```
Consola /mix/SALA (celular o computador)
   │ gesto (play, crossfader, cargar video…)
   ├─▶ BroadcastChannel ──────────────▶ TV /tv/SALA (mismo equipo, ~0 ms)
   └─▶ POST /api/mix/SALA (throttled) ─▶ Neon (mix_rooms, estado versionado)
                                          ▲
                     TV /tv/SALA ── poll 1s (GET ?v=N) — otro dispositivo, ~1 s
                     TV /tv/SALA ── reporta progreso (tiempos) sin versionar
```

## Cómo se usa

1. Entra a `/mix` y crea una sala → obtienes un código corto (ej: `XK42`).
2. En el televisor abre `adoops.digital/tv/XK42` en su navegador **o** abre esa
   URL en una pestaña del computador y castéala (Chrome → Enviar) / conéctala
   por HDMI como segunda pantalla. Un toque en "Iniciar pantalla" habilita el
   audio (política de autoplay de los navegadores).
3. En `/mix/XK42` pega URLs de YouTube en los decks A y B, dale play y mezcla
   con el crossfader. El video y el audio salen por la TV.

### Fases del desafío original

- **Fase 1 — espejo**: castear/duplicar la pestaña de la TV. Funciona ya, sin
  nada extra; la sincronización local usa BroadcastChannel (latencia ~0).
- **Fase 2 — doble pantalla real**: TV con su propio navegador apuntando a
  `/tv/SALA`; la consola queda libre en el celular/computador. La
  sincronización viaja por el API (~1 s de latencia — suficiente para cargar,
  play/pausa y fades; no para scratching).

## Piezas

| Archivo | Rol |
|---|---|
| `lib/mix-types.ts` | Tipos, merge de estado, parser de URLs de YouTube, curva del crossfader (puro, compartido cliente/servidor) |
| `lib/mix-store.ts` | Persistencia en Neon (`mix_rooms`), crea la tabla en el primer uso |
| `app/api/mix/[room]/route.ts` | GET snapshot (con poll barato `?v=N`) · POST `{patch}` (consola) o `{progress}` (TV) |
| `app/api/mix/oembed/route.ts` | Proxy del oEmbed de YouTube (título del video, sin API key) |
| `app/api/mix/suggest/route.ts` | DJ asistente: OpenAI sugiere temas según la vibra y lo que suena |
| `app/mix/page.tsx` | Portada: crear/unirse a una sala |
| `app/mix/[room]/page.tsx` + `components/mixer/Controller.tsx` | Consola: decks, crossfader, master, biblioteca, IA |
| `app/tv/[room]/page.tsx` + `components/mixer/TvScreen.tsx` | Pantalla: 2 players de YouTube IFrame API mezclados por opacidad/volumen |
| `db/schema.ts` | Tabla `mix_rooms` (estado versionado + telemetría) |

## Setup

1. **Variables**: solo `DATABASE_URL` (ya existe). `OPENAI_API_KEY` es opcional
   y habilita el DJ asistente (usa `SUGGEST_MODEL` o `EXTRACT_MODEL`, default
   `gpt-4o-mini`).
2. **Tabla en Neon**: se crea sola en el primer request. Si prefieres crearla
   antes: `node scripts/create-mix-tables.mjs`.

## Decisiones y límites

- **YouTube IFrame API** (oficial): controla play/pausa/seek/volumen/velocidad
  de videos embebidos. No se descarga ni extrae audio — se respeta el player y
  los términos de YouTube. Videos que bloquean embedding no van a funcionar.
- **Crossfader equal-power**: `cos/sin` sobre el crossfader para que el volumen
  percibido se mantenga durante la transición; el video cruza por opacidad.
- **Dos transportes**: BroadcastChannel (mismo navegador, latencia ~0) y
  polling versionado al API (dispositivos distintos, ~1 s). La TV prefiere el
  canal local cuando está activo.
- **Sin auth**: las salas son códigos cortos sin contraseña, igual que el resto
  de demos. Cualquiera con el código puede controlar la sala.
- **Ideas siguientes**: cola/playlist con auto-mix, búsqueda integrada
  (YouTube Data API), BPM y sincronización de beats (Web Audio no aplica sobre
  iframes de YouTube — requeriría otra fuente de audio), WebRTC para bajar la
  latencia remota, integración con la biblioteca personal de YouTube (OAuth).
