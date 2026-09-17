import { getAudioContext } from './audioContext.js';

function tone(ctx, { freqFrom, freqTo, start, duration, peakGain }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.connect(gain);
  gain.connect(ctx.destination);

  const t0 = ctx.currentTime + start;
  osc.frequency.setValueAtTime(freqFrom, t0);
  if (freqTo !== freqFrom) {
    osc.frequency.exponentialRampToValueAtTime(freqTo, t0 + duration);
  }

  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + duration * 0.2);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Duas notas curtas e suaves subindo — discreto, sem ser irritante.
export function playJoinSound() {
  const ctx = getAudioContext();
  tone(ctx, { freqFrom: 660, freqTo: 660, start: 0, duration: 0.09, peakGain: 0.06 });
  tone(ctx, { freqFrom: 880, freqTo: 880, start: 0.09, duration: 0.12, peakGain: 0.06 });
}

// "Bolha estourando": frequência caindo rápido com decaimento curto.
export function playLeaveSound() {
  const ctx = getAudioContext();
  tone(ctx, { freqFrom: 600, freqTo: 180, start: 0, duration: 0.14, peakGain: 0.05 });
}

// Blip curto e agudo, diferente de entrar/sair — um "ding" de mensagem.
export function playChatSound() {
  const ctx = getAudioContext();
  tone(ctx, { freqFrom: 1046, freqTo: 1046, start: 0, duration: 0.07, peakGain: 0.05 });
  tone(ctx, { freqFrom: 1568, freqTo: 1568, start: 0.06, duration: 0.1, peakGain: 0.045 });
}

// Alguém ligou tela ou câmera — três notas subindo, mais presente.
export function playMediaOnSound() {
  const ctx = getAudioContext();
  tone(ctx, { freqFrom: 523, freqTo: 523, start: 0, duration: 0.12, peakGain: 0.09 });
  tone(ctx, { freqFrom: 659, freqTo: 659, start: 0.1, duration: 0.12, peakGain: 0.09 });
  tone(ctx, { freqFrom: 784, freqTo: 784, start: 0.2, duration: 0.18, peakGain: 0.1 });
}

// Mic ligou: um "tick" curto subindo.
export function playMicOnSound() {
  const ctx = getAudioContext();
  tone(ctx, { freqFrom: 720, freqTo: 1080, start: 0, duration: 0.1, peakGain: 0.055 });
}

// Mic desligou: um "tick" curto descendo, distinto do de ligar.
export function playMicOffSound() {
  const ctx = getAudioContext();
  tone(ctx, { freqFrom: 480, freqTo: 280, start: 0, duration: 0.11, peakGain: 0.05 });
}
