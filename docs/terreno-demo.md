# Demo · Reportes de Terreno (WhatsApp → IA → Dashboard)

De un audio de WhatsApp a **datos estructurados + tareas accionables + reporte**, con validación humana.

```
WhatsApp (WaSender) ─▶ /api/whatsapp/webhook ─▶ decrypt + Whisper (audio)
                                              └▶ Claude (extracción estructurada)
                                                  └▶ Neon (field_reports + work_sheets)
                                                      └▶ responde por WhatsApp (validación)
                                                          └▶ Dashboard /terreno
```

## Piezas

| Archivo | Rol |
|---|---|
| `app/api/whatsapp/webhook/route.ts` | Recibe `messages.received`, deduplica, procesa con `after()` |
| `lib/wasender.ts` | Enviar texto + desencriptar audio (WaSenderAPI) |
| `lib/stt.ts` | Transcripción con OpenAI Whisper |
| `lib/extract.ts` | Extracción estructurada con OpenAI (function calling) |
| `lib/reports.ts` | Orquestación + persistencia + validación |
| `app/terreno/page.tsx` | Dashboard (KPIs, reportes, hojas de trabajo) |
| `db/schema.ts` | Tablas `field_reports` y `work_sheets` |

## Setup

1. **Variables** (`.env.local`, ver `env.example`):
   - `WASENDER_API_KEY`, `WASENDER_WEBHOOK_SECRET` (opcional)
   - `OPENAI_API_KEY` (única key de IA: Whisper + extracción)
2. **Tablas en Neon**: `node scripts/create-terreno-tables.mjs`
3. **(Opcional) datos demo**: `node scripts/seed-demo.mjs`
4. **Probar extracción**: `node scripts/test-extract.mjs`
5. **Dev**: `npm run dev` → http://localhost:3000/terreno

## Conectar WaSender

En el panel de WaSender, configura el webhook del número nuevo apuntando a:

```
https://<tu-deploy>.vercel.app/api/whatsapp/webhook
```

Para probar local, expón el puerto con un túnel (cloudflared/ngrok) y usa esa URL.

## Flujo de la demo

1. Mandas un **audio** de terreno al número (ej. el guion de Santa Elvira).
2. El bot responde el **reporte estructurado + hoja de trabajo** y pide validar.
3. Respondes **OK** → queda `validado` y la hoja de trabajo se activa.
4. Todo aparece en vivo en `/terreno`.
