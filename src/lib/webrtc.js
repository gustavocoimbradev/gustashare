// Qualidade de tela no estilo Discord: hint de "detail", bitrate alto e
// preferência por não derrubar resolução quando a rede oscila.
// Não precisa de Firebase/Vercel/Cloudflare pra mídia — o WebRTC já é P2P.

export const PEER_OPTIONS = {
  config: {
    // Vários STUNs de provedores diferentes — sem TURN, isso é o que temos
    // pra descobrir o candidato público. Não ajuda contra NAT simétrico,
    // mas cobre o caso de um provedor específico estar bloqueado/instável
    // numa rede sem derrubar a tentativa inteira.
    iceServers: [
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
    ],
    // Junta candidatos antes de precisar deles — conecta mais rápido,
    // principalmente em reconexões onde cada milissegundo de handshake
    // conta pro usuário não perceber a queda.
    iceCandidatePoolSize: 4,
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

// Sem TURN/SFU, quem compartilha a tela sobe uma cópia do vídeo pra CADA
// espectador (mesh puro) — o upload dela é o gargalo real, e cresce
// linearmente com gente na sala. Em vez de um teto fixo (que satura o
// upload de quem tem 2+ espectadores numa rede residencial comum), dividimos
// um orçamento total entre quantos estão de fato assistindo a tela agora.
const SCREEN_BANDWIDTH_BUDGET = 6_000_000; // com 1 espectador, ainda é boa qualidade
const SCREEN_MIN_BITRATE = 700_000; // abaixo disso texto na tela vira ilegível
const SCREEN_MAX_FPS = 30;

export function screenBitrateForViewers(viewerCount) {
  const n = Math.max(1, viewerCount);
  return Math.max(SCREEN_MIN_BITRATE, Math.round(SCREEN_BANDWIDTH_BUDGET / n));
}

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

export async function tuneScreenSender(call, maxBitrate = SCREEN_BANDWIDTH_BUDGET) {
  const pc = call?.peerConnection;
  if (!pc) return;

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
  enc.maxBitrate = maxBitrate;
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
