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

// Um "tap" só, abafado (filtro fechando + pitch caindo de leve) — nada de
// duas notas subindo em sequência, que soa a moeda de jogo 8-bit.
export function playChatSound() {
  const ctx = getAudioContext();
  tone(ctx, { type: 'triangle', freqFrom: 620, freqTo: 480, start: 0, duration: 0.09, peakGain: 0.11, filterFrom: 2600, filterTo: 900 });
}

// Tick suave subindo: mic ligou.
export function playMicOnSound() {
  const ctx = getAudioContext();
  tone(ctx, { type: 'sine', freqFrom: 700, freqTo: 1000, start: 0, duration: 0.08, peakGain: 0.1 });
}

// Mesma textura do de ligar, só que descendo — bem sutil, sem clique mecânico.
export function playMicOffSound() {
  const ctx = getAudioContext();
  tone(ctx, { type: 'sine', freqFrom: 700, freqTo: 420, start: 0, duration: 0.09, peakGain: 0.1 });
}

// ----- Nível 2: alguém entrou/saiu — acontecimento social, merece acorde -----

// Só duas notas curtas subindo, uma camada só — de propósito bem mais
// discreto que o de compartilhar tela, pra não competir com ele.
export function playJoinSound() {
  const ctx = getAudioContext();
  tone(ctx, { type: 'sine', freqFrom: 587.33, start: 0, duration: 0.08, peakGain: 0.1 });
  tone(ctx, { type: 'sine', freqFrom: 880, start: 0.075, duration: 0.12, peakGain: 0.11 });
}

// Bolha de sabão estourando (tipo Transformice) — bem sutil: só o tom caindo rápido.
export function playLeaveSound() {
  const ctx = getAudioContext();
  tone(ctx, { type: 'sine', freqFrom: 900, freqTo: 340, start: 0, duration: 0.1, peakGain: 0.11 });
}

// ----- Nível 3: tela/câmera ligada — o evento mais importante da sala -----

// Mini-fanfarra: um "sopro" grave subindo (riser, prepara a entrada) por
// baixo de um arpejo de 4 notas em oitava, cada uma com camada destoada
// por cima (coro/shimmer) — de propósito bem mais presente/"grande" que
// os outros dois níveis.
export function playMediaOnSound() {
  const ctx = getAudioContext();
  click(ctx, { start: 0, duration: 0.3, peakGain: 0.035, filterFrom: 200, filterTo: 3200, filterType: 'lowpass' });

  // As 4 notas com o mesmo peso — a última não fica isolada/mais alta no
  // final soando feito "ding" de moeda, só fecha o acorde junto com o resto.
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const start = i * 0.075;
    tone(ctx, { type: 'triangle', freqFrom: freq, start, duration: 0.16, peakGain: 0.095 });
    tone(ctx, { type: 'sine', freqFrom: freq, start, duration: 0.21, peakGain: 0.052, detune: 8 });
  });
}
