// Qualidade de tela no estilo Discord: hint de "detail", bitrate alto e
// preferência por não derrubar resolução quando a rede oscila.
// Não precisa de Firebase/Vercel/Cloudflare pra mídia — o WebRTC já é P2P.

export const PEER_OPTIONS = {
  config: {
    iceServers: [
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.l.google.com:19302' },
    ],
  },
};

export const SCREEN_DISPLAY_MEDIA = {
  video: {
    frameRate: { ideal: 30, max: 60 },
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },
  },
  audio: true,
  systemAudio: 'include',
};

const SCREEN_MAX_BITRATE = 8_000_000;
const SCREEN_MAX_FPS = 30;
const CODEC_PREF = ['video/AV1', 'video/VP9', 'video/H264', 'video/VP8'];

export function prepareScreenTrack(stream) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track) return;
  try {
    track.contentHint = 'detail';
  } catch {
    // Chromium antigo
  }
  track.applyConstraints({
    frameRate: { ideal: 30, max: 60 },
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },
  }).catch(() => {});
}

export async function tuneScreenSender(call) {
  const pc = call?.peerConnection;
  if (!pc) return;

  try {
    const caps = RTCRtpSender.getCapabilities?.('video');
    if (caps?.codecs?.length) {
      const ranked = [...caps.codecs].sort((a, b) => codecRank(a.mimeType) - codecRank(b.mimeType));
      for (const transceiver of pc.getTransceivers()) {
        if (transceiver.sender?.track?.kind === 'video' && transceiver.setCodecPreferences) {
          transceiver.setCodecPreferences(ranked);
        }
      }
    }
  } catch {
    // setCodecPreferences nem sempre está disponível
  }

  const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
  if (!sender) return;
  if (sender.track) {
    try {
      sender.track.contentHint = 'detail';
    } catch {
      // ignore
    }
  }

  const params = sender.getParameters();
  if (!params.encodings || params.encodings.length === 0) {
    params.encodings = [{}];
  }
  params.degradationPreference = 'maintain-resolution';
  const enc = params.encodings[0];
  enc.maxBitrate = SCREEN_MAX_BITRATE;
  enc.maxFramerate = SCREEN_MAX_FPS;
  enc.scaleResolutionDownBy = 1;
  enc.priority = 'high';
  enc.networkPriority = 'high';
  try {
    await sender.setParameters(params);
  } catch {
    // alguns browsers recusam encodings vazios no começo da call
  }
}

function codecRank(mime) {
  const i = CODEC_PREF.findIndex((m) => m.toLowerCase() === String(mime || '').toLowerCase());
  return i === -1 ? 99 : i;
}
