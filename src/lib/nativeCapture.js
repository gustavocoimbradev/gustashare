import { getAudioContext } from './audioContext.js';

// Transforma a captura nativa (video BGRA cru via canvas, audio PCM cru
// via Web Audio) num MediaStream normal, pra usar exatamente como
// qualquer outro stream (RTCPeerConnection não sabe a diferença).
//
// video: frame = [width u32 LE][height u32 LE][pixels BGRA8...]
// audio: chunk = PCM float32 intercalado, stereo, 48kHz

export async function captureWindowNative({ hwnd, wantsAudio }) {
  const id = `${hwnd}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let videoStream = null;
  let stopVideo = null;

  await new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        stopVideo?.();
        reject(new Error('timeout esperando primeiro frame da captura nativa'));
      }
    }, 8000);

    stopVideo = window.gustashare.startNativeVideoCapture(id, hwnd, (frame) => {
      const bytes = frame instanceof Uint8Array ? frame : new Uint8Array(frame);
      const view = new DataView(bytes.buffer, bytes.byteOffset, 8);
      const w = view.getUint32(0, true);
      const h = view.getUint32(4, true);

      if (w !== width || h !== height) {
        width = w;
        height = h;
        canvas.width = width;
        canvas.height = height;
      }
      if (width === 0 || height === 0) return;

      const pixelCount = width * height * 4;
      const pixels = new Uint8ClampedArray(bytes.buffer.slice(bytes.byteOffset + 8, bytes.byteOffset + 8 + pixelCount));
      // BGRA -> RGBA
      for (let i = 0; i < pixels.length; i += 4) {
        const b = pixels[i];
        pixels[i] = pixels[i + 2];
        pixels[i + 2] = b;
      }
      ctx.putImageData(new ImageData(pixels, width, height), 0, 0);

      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        videoStream = canvas.captureStream(30);
        resolve();
      }
    });
  });

  let stopAudio = null;
  let audioDestination = null;

  if (wantsAudio) {
    const pid = await window.gustashare.resolvePidFromHwnd(hwnd);
    if (pid) {
      const audioCtx = getAudioContext();
      audioDestination = audioCtx.createMediaStreamDestination();

      stopAudio = window.gustashare.startNativeAudioCapture(id, pid, (chunk) => {
        const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        const floats = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
        const frameCount = Math.floor(floats.length / 2);
        if (frameCount === 0) return;

        const buffer = audioCtx.createBuffer(2, frameCount, 48000);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        for (let i = 0; i < frameCount; i++) {
          left[i] = floats[i * 2];
          right[i] = floats[i * 2 + 1];
        }

        const src = audioCtx.createBufferSource();
        src.buffer = buffer;
        src.connect(audioDestination);
        src.start();
      });
    }
  }

  const tracks = [...videoStream.getVideoTracks()];
  if (audioDestination) tracks.push(...audioDestination.stream.getAudioTracks());
  const stream = new MediaStream(tracks);

  stream.addEventListener('gustashare-stop', () => {
    stopVideo?.();
    stopAudio?.();
  });

  return {
    stream,
    stop() {
      stopVideo?.();
      stopAudio?.();
    },
  };
}
