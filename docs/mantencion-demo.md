# Demo · Incidencias y Mantención (WhatsApp → IA → Dashboard)

De un audio de WhatsApp a una **incidencia estructurada + severidad + alertas + órdenes de trabajo**, con validación humana. Mismo motor que el demo de terreno; cambia el esquema, las plantillas y el dashboard.

```
WhatsApp (WaSender) ─▶ /api/whatsapp/webhook ─▶ router clasifica el mensaje
                                              └▶ decrypt + Whisper (audio)
                                                  └▶ OpenAI (extracción de incidencia)
                                                      └▶ Neon (incidencias + ordenes_trabajo)
                                                          └▶ responde por WhatsApp (validación)
                                                              └▶ Dashboard /mantencion
```

## Piezas

| Archivo | Rol |
|---|---|
| `lib/whatsapp-router.ts` | Clasifica el mensaje a un vertical y despacha |
| `lib/extract-mantencion.ts` | Extracción estructurada con OpenAI (function calling) |
| `lib/mantencion.ts` | Orquestación + persistencia + validación |
| `app/mantencion/page.tsx` | Dashboard (KPIs, incidencias, órdenes de trabajo) |
| `db/schema.ts` | Tablas `incidencias` y `ordenes_trabajo` |

Reutiliza tal cual: `lib/wasender.ts`, `lib/stt.ts` y el webhook.

## Setup

1. **Variables**: las mismas del demo de terreno (`OPENAI_API_KEY`, `WASENDER_API_KEY`).
2. **Tablas en Neon**: `node scripts/create-mantencion-tables.mjs`
3. **(Opcional) datos demo**: `node scripts/seed-mantencion.mjs`
4. **Dev**: `npm run dev` → http://localhost:3000/mantencion

## Ruteo (un solo número de WhatsApp)

El router decide el vertical por palabras clave: si menciona "falla", "incidencia",
"se detuvo", "bomba", "motor", "repuesto", etc., entra aquí. Para audio, primero
transcribe y luego clasifica. `terreno` es el default.

La IA clasifica la **severidad** (crítica/alta/media/baja) y el **estado del equipo**
(detenido / operativo con riesgo / operativo) para priorizar en el dashboard.

## Flujo de la demo

1. Mandas un **audio** reportando una falla ("se detuvo la bomba de riego 3…").
2. El bot responde la **incidencia estructurada + alertas + órdenes de trabajo** y pide validar.
3. Respondes **OK** → queda `validado` y las órdenes se activan.
4. Todo aparece en vivo en `/mantencion`.
