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
