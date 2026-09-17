import { getAudioContext } from './audioContext.js';

// Video nativo só como fallback (janela preta no Chromium). O caminho
// principal é o stream do picker do Windows + áudio WASAPI.
//
// video: frame = [width u32 LE][height u32 LE][pixels RGBA8...]
// audio: chunk = PCM float32 intercalado, stereo, 48kHz

export async function captureWindowNative({ hwnd, wantsAudio, video: wantVideo = true }) {
  const id = `${hwnd}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let videoStream = null;
  let stopVideo = null;

  if (wantVideo) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    let width = 0;
    let height = 0;
    let painting = false;

    videoStream = await new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          stopVideo?.();
          reject(new Error('timeout esperando primeiro frame da captura nativa'));
        }
      }, 8000);

      stopVideo = window.gustashare.startNativeVideoCapture(id, hwnd, (frame) => {
        if (painting && settled) return;
        painting = true;

        const bytes = frame instanceof Uint8Array ? frame : new Uint8Array(frame);
        const view = new DataView(bytes.buffer, bytes.byteOffset, 8);
        const w = view.getUint32(0, true);
        const h = view.getUint32(4, true);
        if (w === 0 || h === 0) {
          painting = false;
          return;
        }

        if (w !== width || h !== height) {
          width = w;
          height = h;
          canvas.width = width;
          canvas.height = height;
        }

        const pixelCount = width * height * 4;
        if (bytes.byteLength < 8 + pixelCount) {
          painting = false;
          return;
        }
        const pixels = Uint8ClampedArray.from(bytes.subarray(8, 8 + pixelCount));
        ctx.putImageData(new ImageData(pixels, width, height), 0, 0);

        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(canvas.captureStream(30));
        }
        painting = false;
      });
    });
  }

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

  const tracks = [];
  if (videoStream) tracks.push(...videoStream.getVideoTracks());
  if (audioDestination) tracks.push(...audioDestination.stream.getAudioTracks());
  const stream = new MediaStream(tracks);

  return {
    stream,
    stop() {
      stopVideo?.();
      stopAudio?.();
    },
  };
}
