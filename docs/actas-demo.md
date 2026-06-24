# Demo · Actas de Reunión (WhatsApp → IA → Dashboard)

De un audio de WhatsApp a un **acta estructurada + decisiones + compromisos accionables**, con validación humana. Mismo motor que el demo de terreno; cambia el esquema, las plantillas y el dashboard.

```
WhatsApp (WaSender) ─▶ /api/whatsapp/webhook ─▶ router clasifica el mensaje
                                              └▶ decrypt + Whisper (audio)
                                                  └▶ OpenAI (extracción de acta)
                                                      └▶ Neon (acta_reports + compromisos)
                                                          └▶ responde por WhatsApp (validación)
                                                              └▶ Dashboard /actas
```

## Piezas

| Archivo | Rol |
|---|---|
| `lib/whatsapp-router.ts` | Clasifica el mensaje a un vertical (terreno/actas/mantención) y despacha |
| `lib/extract-actas.ts` | Extracción estructurada con OpenAI (function calling) |
| `lib/actas.ts` | Orquestación + persistencia + validación |
| `app/actas/page.tsx` | Dashboard (KPIs, actas, compromisos) |
| `db/schema.ts` | Tablas `acta_reports` y `compromisos` |

Reutiliza tal cual: `lib/wasender.ts`, `lib/stt.ts` y el webhook.

## Setup

1. **Variables**: las mismas del demo de terreno (`OPENAI_API_KEY`, `WASENDER_API_KEY`).
2. **Tablas en Neon**: `node scripts/create-actas-tables.mjs`
3. **(Opcional) datos demo**: `node scripts/seed-actas.mjs`
4. **Dev**: `npm run dev` → http://localhost:3000/actas

## Ruteo (un solo número de WhatsApp)

El router decide el vertical por palabras clave de la transcripción: si menciona
"reunión", "acta", "acordamos", "compromiso", etc., entra aquí. Para audio,
primero transcribe y luego clasifica. `terreno` es el default.

## Flujo de la demo

1. Mandas un **audio** relatando una reunión ("la reunión de coordinación de hoy…").
2. El bot responde el **acta estructurada + decisiones + compromisos** y pide validar.
3. Respondes **OK** → queda `validado` y los compromisos se activan.
4. Todo aparece en vivo en `/actas`.
