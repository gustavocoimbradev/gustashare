import { useEffect, useState } from 'react';
import { getAudioContext } from './audioContext.js';

const SPEAKING_THRESHOLD = 18; // 0-255
const HOLD_MS = 300; // evita "piscar" o indicador entre sílabas

export default function useSpeaking(stream) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setSpeaking(false);
      return undefined;
    }

    const audioCtx = getAudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let lastAbove = 0;

    const interval = setInterval(() => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;

      const now = performance.now();
      if (avg > SPEAKING_THRESHOLD) lastAbove = now;
      setSpeaking(now - lastAbove < HOLD_MS);
    }, 100);

    return () => {
      clearInterval(interval);
      source.disconnect();
      analyser.disconnect();
      setSpeaking(false);
    };
  }, [stream]);

  return speaking;
}
