// Prueba el pipeline de extracción con OpenAI usando el ejemplo del PDF.
// Requiere OPENAI_API_KEY en el entorno o en .env.local.
// Uso: node scripts/test-extract.mjs
import { readFileSync } from "node:fs";

try {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  /* sin .env.local */
}

const transcript =
  "Hola, reporte de terreno de hoy para el campo Santa Elvira, sector norte, cuarteles 4 y 5. " +
  "Estuvo a cargo Pedro Muñoz con una cuadrilla de seis personas. Se revisaron 18 hectáreas durante " +
  "la mañana y se completó cerca del 80% del trabajo planificado. En el cuartel 5 baja actividad. " +
  "Se tomaron cuatro fotos. Para mañana priorizar el sector 5 antes de las 10. Avisar al cliente.";

const OpenAI = (await import("openai")).default;
if (!process.env.OPENAI_API_KEY) {
  console.error("⚠️  Falta OPENAI_API_KEY. Cárgala en .env.local y reintenta.");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.EXTRACT_MODEL || "gpt-4o-mini";

const completion = await client.chat.completions.create({
  model,
  messages: [
    {
      role: "system",
      content:
        "Estructura reportes de terreno agrícola. No inventes datos; usa null o listas vacías si falta info.",
    },
    { role: "user", content: `Transcripción:\n"""${transcript}"""` },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "registrar",
        description: "Registra un reporte de terreno estructurado.",
        parameters: {
          type: "object",
          properties: {
            cliente: { type: ["string", "null"] },
            sector: { type: ["string", "null"] },
            cuarteles: { type: "array", items: { type: "string" } },
            responsable: { type: ["string", "null"] },
            personas: { type: ["number", "null"] },
            avancePct: { type: ["number", "null"] },
            incidencias: { type: "array", items: { type: "string" } },
            resumenEjecutivo: { type: "string" },
            hojaDeTrabajo: { type: "array", items: { type: "string" } },
          },
          required: ["resumenEjecutivo"],
        },
      },
    },
  ],
  tool_choice: { type: "function", function: { name: "registrar" } },
});

const call = completion.choices[0]?.message?.tool_calls?.[0];
console.log(`Modelo: ${model}\n`);
console.log(JSON.stringify(JSON.parse(call.function.arguments), null, 2));
