// Qualidade de tela no estilo Discord: hint de "detail", bitrate alto e
// preferência por não derrubar resolução quando a rede oscila.
// Não precisa de Firebase/Vercel/Cloudflare pra mídia — o WebRTC já é P2P.

// STUNs de provedores diferentes — ajudam a descobrir o candidato público;
// cobre o caso de um provedor específico estar bloqueado/instável numa
// rede sem derrubar a tentativa inteira.
const STUN_SERVERS = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.services.mozilla.com' },
  { urls: 'stun:stun.relay.metered.ca:80' },
];

// TURN (relay) estático via Metered — plano free, 20GB/mês. Usado como
// FALLBACK caso o Worker do Cloudflare (mais cota, ver abaixo) esteja fora
// do ar ou ainda não tenha sido configurado. Usado só quando a conexão
// direta não fecha — a maioria dos casos continua P2P puro, sem passar
// por aqui.
const METERED_TURN_SERVERS = [
  {
    urls: 'turn:standard.relay.metered.ca:80',
    username: '25e728d03219114eb23ae4f6',
    credential: 'BRVlcIt0D/gnMU+D',
  },
  {
    urls: 'turn:standard.relay.metered.ca:80?transport=tcp',
    username: '25e728d03219114eb23ae4f6',
    credential: 'BRVlcIt0D/gnMU+D',
  },
  {
    urls: 'turn:standard.relay.metered.ca:443',
    username: '25e728d03219114eb23ae4f6',
    credential: 'BRVlcIt0D/gnMU+D',
  },
  {
    urls: 'turns:standard.relay.metered.ca:443?transport=tcp',
    username: '25e728d03219114eb23ae4f6',
    credential: 'BRVlcIt0D/gnMU+D',
  },
];

// URL do Cloudflare Worker que gera credenciais TURN de curta duração (ver
// cloudflare-worker/worker.js). Fica null até o deploy acontecer e a URL
// real ser configurada — enquanto isso, `resolveIceServers` usa só STUN +
// o TURN estático da Metered acima.
const TURN_WORKER_URL = 'https://gustashare-turn.whoisgustavolima.workers.dev';

const FALLBACK_ICE_SERVERS = [...STUN_SERVERS, ...METERED_TURN_SERVERS];

// Busca credenciais TURN "frescas" no Worker do Cloudflare (cota bem maior
// que a da Metered). Se o Worker não estiver configurado, estiver fora do
// ar, ou demorar demais, cai pro STUN + TURN estático da Metered — nunca
// deixa a sala sem NENHUM caminho de conexão só por causa disso.
export async function resolveIceServers() {
  if (!TURN_WORKER_URL) return FALLBACK_ICE_SERVERS;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(TURN_WORKER_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return FALLBACK_ICE_SERVERS;
    const data = await res.json();
    if (Array.isArray(data.iceServers) && data.iceServers.length) {
      return [...STUN_SERVERS, ...data.iceServers];
    }
    return FALLBACK_ICE_SERVERS;
  } catch {
    return FALLBACK_ICE_SERVERS;
  }
}

// Junta candidatos antes de precisar deles — conecta mais rápido,
// principalmente em reconexões onde cada milissegundo de handshake conta
// pro usuário não perceber a queda.
export function buildPeerOptions(iceServers) {
  return { config: { iceServers, iceCandidatePoolSize: 4 } };
}

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

// ----- Sobre o "compartilho e um vê, outro não" -----
//
// Isso era o sintoma clássico de mesh P2P só com STUN: STUN descobre o
// endereço público de cada lado, mas só funciona quando pelo menos um dos
// dois está atrás de um NAT "bem comportado". Contra NAT simétrico ou
// CGNAT — muito comum em rede móvel/4G e em vários provedores residenciais
// no Brasil — os dois lados descobriam endereços que não serviam pra nada,
// a conexão direta nunca fechava, e o RTCPeerConnection ficava preso em
// "connecting"/"failed" pra sempre. Como cada par de pessoas na sala tem
// uma rede diferente, dava exatamente essa sensação de loteria: funcionava
// pra quem tinha NAT tranquilo, falhava pra quem não tinha — e o retry
// (que já existe em RoomClient) não resolvia porque o problema não era
// transitório, era estrutural.
//
// O TURN acima (Metered, plano free — 20GB/mês) cobre isso: quando a rota
// direta não fecha, os dois lados retransmitem a mídia por ele em vez de
// falhar. Se algum dia estourar a cota de 20GB/mês, a chamada volta a
// falhar só pra quem realmente precisava de relay (o resto continua P2P
// puro normalmente) — vale ficar de olho no painel da Metered.
//
// Ainda assim, RoomClient avisa quem está compartilhando quando a conexão
// com um espectador específico falha de vez, mesmo com TURN (evento
// `stream-failed`) — rede muito ruim dos dois lados ainda pode acontecer,
// e aí é melhor avisar do que deixar parecer que deu tudo certo.
