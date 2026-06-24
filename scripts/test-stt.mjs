// Round-trip TTS→STT para validar OPENAI_API_KEY y el modelo de transcripción.
// Genera un audio con TTS de OpenAI y lo transcribe con Whisper. No necesita WaSender.
// Uso: node scripts/test-stt.mjs
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

const OpenAI = (await import("openai")).default;
if (!process.env.OPENAI_API_KEY) {
  console.error("⚠️  Falta OPENAI_API_KEY");
  process.exit(1);
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const guion =
  "Hola, reporte de terreno de hoy para el campo Santa Elvira, sector norte, cuarteles cuatro y cinco. " +
  "A cargo Pedro Muñoz con seis personas. Avance ochenta por ciento. Falta revisar el cuartel cinco mañana.";

console.log("1) Generando audio con TTS…");
const speech = await client.audio.speech.create({
  model: "gpt-4o-mini-tts",
  voice: "alloy",
  input: guion,
  response_format: "mp3",
});
const buf = Buffer.from(await speech.arrayBuffer());
console.log(`   audio: ${(buf.length / 1024).toFixed(1)} KB`);

console.log(`2) Transcribiendo con ${process.env.STT_MODEL || "gpt-4o-transcribe"}…`);
const file = new File([buf], "test.mp3", { type: "audio/mpeg" });
const out = await client.audio.transcriptions.create({
  file,
  model: process.env.STT_MODEL || "gpt-4o-transcribe",
  language: "es",
});

console.log("\n✓ Transcripción:\n" + out.text);
