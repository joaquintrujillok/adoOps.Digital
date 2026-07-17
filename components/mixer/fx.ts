/**
 * TV Mix — efectos de DJ sintetizados con Web Audio (bocina, sirena, scratch,
 * rewind). Suenan en la TV, por fuera de los iframes de YouTube, así que no
 * dependen de ninguna API externa ni tocan el audio de los videos.
 * Solo se usa en el cliente, después de un gesto del usuario (Iniciar pantalla).
 */

import type { FxSound } from "@/lib/mix-types";

let ctx: AudioContext | null = null;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

function audioContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    ctx = new Ctor!();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * Desbloquea el audio DENTRO de un gesto del usuario (el toque de "Iniciar
 * pantalla"). Sin esto, el AudioContext se crearía al llegar el primer efecto
 * —fuera de un gesto— y el navegador lo dejaría suspendido: los FX no sonarían.
 * Reproduce un buffer mudo de 1 sample, el truco estándar para iOS/Safari.
 */
export function unlockFxAudio() {
  try {
    const ac = audioContext();
    const src = ac.createBufferSource();
    src.buffer = ac.createBuffer(1, 1, ac.sampleRate);
    src.connect(ac.destination);
    src.start(0);
  } catch {
    // sin Web Audio: los FX simplemente no sonarán
  }
}

/** Bus con el volumen del efecto (escala con el master de la sala). */
function bus(ac: AudioContext, gain: number, start: number, stop: number): GainNode {
  const g = ac.createGain();
  g.gain.value = gain;
  g.connect(ac.destination);
  // corta cualquier cola sonora al terminar
  g.gain.setValueAtTime(gain, stop - 0.05);
  g.gain.linearRampToValueAtTime(0, stop);
  void start;
  return g;
}

function noiseBuffer(ac: AudioContext, seconds: number): AudioBuffer {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * seconds), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Bocina de aire: tres bocinazos (corto, corto, largo) con armónicos. */
function horn(ac: AudioContext, out: GainNode, t0: number) {
  const blasts = [
    { at: 0, dur: 0.18 },
    { at: 0.26, dur: 0.18 },
    { at: 0.52, dur: 0.75 },
  ];
  for (const { at, dur } of blasts) {
    for (const [freq, level] of [
      [415, 0.5],
      [554, 0.3],
      [311, 0.25],
    ] as const) {
      const osc = ac.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t0 + at);
      osc.frequency.linearRampToValueAtTime(freq * 1.02, t0 + at + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t0 + at);
      g.gain.linearRampToValueAtTime(level, t0 + at + 0.02);
      g.gain.setValueAtTime(level, t0 + at + dur - 0.03);
      g.gain.linearRampToValueAtTime(0, t0 + at + dur);
      osc.connect(g).connect(out);
      osc.start(t0 + at);
      osc.stop(t0 + at + dur + 0.05);
    }
  }
}

/** Sirena: barrido dos ciclos subida/bajada. */
function siren(ac: AudioContext, out: GainNode, t0: number) {
  const osc = ac.createOscillator();
  osc.type = "square";
  const g = ac.createGain();
  g.gain.value = 0.25;
  osc.frequency.setValueAtTime(620, t0);
  for (let i = 0; i < 2; i++) {
    osc.frequency.linearRampToValueAtTime(1250, t0 + i * 0.8 + 0.4);
    osc.frequency.linearRampToValueAtTime(620, t0 + i * 0.8 + 0.8);
  }
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + 1.65);
}

/** Scratch: ruido filtrado con vaivén rápido de tono y cortes de gate. */
function scratch(ac: AudioContext, out: GainNode, t0: number) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 0.9);
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 6;
  const wobble = [900, 2600, 700, 3100, 1100, 2200, 800];
  wobble.forEach((freq, i) => {
    filter.frequency.linearRampToValueAtTime(freq, t0 + (i * 0.85) / wobble.length);
  });
  const gate = ac.createGain();
  for (let i = 0; i < 7; i++) {
    const at = t0 + i * 0.12;
    gate.gain.setValueAtTime(0.65, at);
    gate.gain.setValueAtTime(0.05, at + 0.08);
  }
  src.connect(filter).connect(gate).connect(out);
  src.start(t0);
  src.stop(t0 + 0.9);
}

/** Rewind: chirrido descendente con vibrato, tipo rebobinado de cinta. */
function rewind(ac: AudioContext, out: GainNode, t0: number) {
  const osc = ac.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(2100, t0);
  osc.frequency.exponentialRampToValueAtTime(110, t0 + 1.0);
  const vibrato = ac.createOscillator();
  vibrato.frequency.value = 26;
  const vibratoGain = ac.createGain();
  vibratoGain.gain.value = 90;
  vibrato.connect(vibratoGain).connect(osc.frequency);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.3, t0);
  g.gain.linearRampToValueAtTime(0.12, t0 + 1.0);
  osc.connect(g).connect(out);
  vibrato.start(t0);
  osc.start(t0);
  osc.stop(t0 + 1.05);
  vibrato.stop(t0 + 1.05);
}

const DURATIONS: Record<FxSound, number> = {
  horn: 1.4,
  siren: 1.7,
  scratch: 1.0,
  rewind: 1.1,
};

/** Dispara un efecto. `gain` 0–1 (normalmente master/100). */
export function playFx(sound: FxSound, gain: number) {
  try {
    const ac = audioContext();
    const t0 = ac.currentTime + 0.02;
    const out = bus(ac, Math.max(0.05, Math.min(1, gain)) * 0.9, t0, t0 + DURATIONS[sound]);
    if (sound === "horn") horn(ac, out, t0);
    else if (sound === "siren") siren(ac, out, t0);
    else if (sound === "scratch") scratch(ac, out, t0);
    else rewind(ac, out, t0);
  } catch {
    // sin AudioContext (navegador muy viejo): el efecto simplemente no suena
  }
}
