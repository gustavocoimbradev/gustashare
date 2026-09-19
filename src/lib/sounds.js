import { getAudioContext } from './audioContext.js';

// Nota pura em seno soa "achatada" e todas ficam parecidas entre si. Aqui
// cada evento tem uma identidade: forma de onda, se tem filtro varrendo
// (dá "movimento"/textura) e quantas camadas tocam junto (mais camadas =
// mais "peso"/importância). São 3 níveis:
//   1 (rotina, super frequente)  → chat, mic
//   2 (acontecimento social)     → alguém entrou/saiu
//   3 (algo importante mudou)    → tela/câmera ligada

function tone(ctx, { type = 'sine', freqFrom, freqTo = freqFrom, start, duration, peakGain, filterFrom, filterTo, filterType = 'lowpass', detune = 0 }) {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freqFrom, t0);
  if (freqTo !== freqFrom) {
    osc.frequency.exponentialRampToValueAtTime(freqTo, t0 + duration);
  }

  let tail = osc;
  if (filterFrom !== undefined) {
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(filterFrom, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(filterTo ?? filterFrom, 20), t0 + duration);
    osc.connect(filter);
    tail = filter;
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + duration * 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  tail.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Estouro de ruído filtrado — dá um "clique" mecânico de botão/switch,
// bem diferente das notas melódicas usadas pra entrar/sair/chat.
function click(ctx, { start, duration, peakGain, filterFrom, filterTo, filterType = 'bandpass' }) {
  const t0 = ctx.currentTime + start;
  const frames = Math.max(1, Math.round(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.Q.value = 1.3;
  filter.frequency.setValueAtTime(filterFrom, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(filterTo ?? filterFrom, 20), t0 + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + duration * 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

// ----- Nível 1: rotina, toca o tempo todo — precisa ser curto e discreto -----

// "Ding" de mensagem: dois harmônicos próximos tocando quase juntos, tipo sino pequeno.
export function playChatSound() {
  const ctx = getAudioContext();
  tone(ctx, { type: 'triangle', freqFrom: 1318.5, start: 0, duration: 0.06, peakGain: 0.06 });
  tone(ctx, { type: 'sine', freqFrom: 1975.5, start: 0.035, duration: 0.1, peakGain: 0.05 });
}

// Switch mecânico ligando: clique seco + estalo tonal subindo.
export function playMicOnSound() {
  const ctx = getAudioContext();
  click(ctx, { start: 0, duration: 0.045, peakGain: 0.11, filterFrom: 900, filterTo: 2600 });
  tone(ctx, { type: 'square', freqFrom: 660, freqTo: 990, start: 0.015, duration: 0.05, peakGain: 0.025 });
}

// Switch mecânico desligando: mesmo clique, varredura invertida — sem nota tonal.
export function playMicOffSound() {
  const ctx = getAudioContext();
  click(ctx, { start: 0, duration: 0.05, peakGain: 0.1, filterFrom: 2400, filterTo: 500 });
}

// ----- Nível 2: alguém entrou/saiu — acontecimento social, merece acorde -----

// Acorde subindo (dó-mi-sol) com duas camadas levemente destoadas: mais
// "corpo"/calor do que uma nota só, sensação de "boas-vindas".
export function playJoinSound() {
  const ctx = getAudioContext();
  [0, 6].forEach((detune) => {
    tone(ctx, { type: 'triangle', freqFrom: 523.25, start: 0, duration: 0.14, peakGain: 0.06, detune });
    tone(ctx, { type: 'triangle', freqFrom: 659.25, start: 0.07, duration: 0.14, peakGain: 0.06, detune });
    tone(ctx, { type: 'sine', freqFrom: 783.99, start: 0.14, duration: 0.24, peakGain: 0.08, detune });
  });
}

// Espelho do de entrar, mas descendo e com filtro fechando — sensação de
// "porta se fechando", timbre mais fosco (menos brilho no final).
export function playLeaveSound() {
  const ctx = getAudioContext();
  tone(ctx, { type: 'triangle', freqFrom: 783.99, freqTo: 392, start: 0, duration: 0.24, peakGain: 0.075, filterFrom: 5000, filterTo: 350 });
  tone(ctx, { type: 'sine', freqFrom: 523.25, freqTo: 261.6, start: 0.02, duration: 0.22, peakGain: 0.05 });
}

// ----- Nível 3: tela/câmera ligada — o evento mais importante da sala -----

// Mini-fanfarra: arpejo de 4 notas em oitava, cada uma com camada
// destoada por cima (coro/shimmer) e cauda mais longa — bem mais presente
// e "grande" que os outros dois níveis, de propósito.
export function playMediaOnSound() {
  const ctx = getAudioContext();
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const start = i * 0.075;
    const duration = i === notes.length - 1 ? 0.32 : 0.16;
    const peak = i === notes.length - 1 ? 0.12 : 0.09;
    tone(ctx, { type: 'triangle', freqFrom: freq, start, duration, peakGain: peak });
    tone(ctx, { type: 'sine', freqFrom: freq, start, duration: duration + 0.05, peakGain: peak * 0.55, detune: 8 });
  });
}
