// Worker que serve duas coisas pro GustaShare (que não tem backend
// próprio — roda 100% no navegador/Electron, sem servidor):
//
//   1. /turn      credenciais TURN de curta duração (Cloudflare Realtime)
//   2. /push/*    notificação "fulano entrou na sala X" via Web Push,
//                 mesmo com o site/app fechado
//
// Por que o Web Push precisa de um Worker: mandar o POST assinado (VAPID)
// pro serviço de push do navegador exige headers que disparam preflight
// CORS, e esses serviços não liberam CORS pra chamada vinda direto do
// navegador de quem entrou na sala — o navegador bloqueia antes de sair.
// Esse Worker é a menor peça possível que resolve isso: guarda (no KV)
// quem quer ser avisado de qual sala, e manda o push de verdade quando
// alguém entra.
//
// Configuração (uma vez só):
//   wrangler kv namespace create PUSH_SUBS   # cola o id no wrangler.toml
//   wrangler secret put TURN_KEY_ID
//   wrangler secret put TURN_API_TOKEN
//   wrangler secret put VAPID_PRIVATE_KEY    # ver scripts/generate-vapid-keys.js
//
// Deploy:
//   cd cloudflare-worker && npx wrangler deploy

import { buildPushPayload } from '@block65/webcrypto-web-push';

const TURN_TTL_SECONDS = 6 * 60 * 60; // 6h — bem mais que uma sessão típica

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function normalizeRoomCode(roomCode) {
  return String(roomCode || '').trim().toLowerCase();
}

function subKey(deviceId) {
  return `sub:${deviceId}`;
}

function roomKey(roomCodeLower) {
  return `room:${roomCodeLower}`;
}

const MAX_WATCHED_ROOMS = 3;

// `sub:<deviceId>` guarda `roomCodes` (as últimas até 3 salas que o device
// entrou, ordem do mais antigo pro mais novo). Registros de antes dessa
// mudança tinham só `roomCode` (uma sala só) — trata os dois formatos.
function watchedRoomsOf(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.roomCodes)) return entry.roomCodes;
  return entry.roomCode ? [entry.roomCode] : [];
}

function vapidFromEnv(env) {
  return {
    subject: env.VAPID_SUBJECT || 'https://gustashare.vercel.app',
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
}

// Manda `message` pra cada deviceId em `deviceIds`. Devolve quantos
// receberam de verdade; pra quem tiver inscrição morta (404/410 —
// desinstalou, limpou os dados do site etc), a lista de salas que
// vigiava (quem chama decide como tirar o device dessas listas, porque o
// jeito de montar `deviceIds` muda por caso — watchers de uma sala,
// listagem geral pro convite diário); e, se `requireRoomCode` foi
// passado, quem apareceu na lista de watchers dessa sala mas cujo
// registro (`sub:<device>`) já não cita mais essa sala — o KV é
// eventualmente consistente, então o índice reverso (`room:<code>`) pode
// ficar por um instante à frente ou atrás do registro do device quando
// ele troca de sala rápido; isso auto-corrige na próxima vez que alguém
// entrar nessa sala.
async function sendPushToDevices(env, deviceIds, message, { requireRoomCode } = {}) {
  if (!deviceIds.length) return { notified: 0, stale: [], notWatching: [] };
  const vapid = vapidFromEnv(env);
  let notified = 0;
  const stale = [];
  const notWatching = [];

  await Promise.all(
    deviceIds.map(async (deviceId) => {
      const entry = await env.PUSH_SUBS.get(subKey(deviceId), 'json');
      if (!entry?.subscription) {
        stale.push({ deviceId, roomCodes: watchedRoomsOf(entry) });
        return;
      }
      if (requireRoomCode && !watchedRoomsOf(entry).includes(requireRoomCode)) {
        notWatching.push(deviceId);
        return;
      }
      try {
        const payload = await buildPushPayload(message, entry.subscription, vapid);
        const res = await fetch(entry.subscription.endpoint, payload);
        if (res.status === 404 || res.status === 410) {
          stale.push({ deviceId, roomCodes: watchedRoomsOf(entry) });
        } else if (res.ok) {
          notified += 1;
        }
      } catch (err) {
        console.error('falha ao enviar push:', err);
      }
    })
  );

  await Promise.all(stale.map(({ deviceId }) => env.PUSH_SUBS.delete(subKey(deviceId))));
  return { notified, stale, notWatching };
}

async function removeDeviceFromRoom(env, deviceId, roomCodeLower) {
  const room = await env.PUSH_SUBS.get(roomKey(roomCodeLower), 'json');
  if (!room) return;
  const next = room.filter((id) => id !== deviceId);
  if (next.length) await env.PUSH_SUBS.put(roomKey(roomCodeLower), JSON.stringify(next));
  else await env.PUSH_SUBS.delete(roomKey(roomCodeLower));
}

async function addDeviceToRoom(env, deviceId, roomCodeLower) {
  const room = (await env.PUSH_SUBS.get(roomKey(roomCodeLower), 'json')) || [];
  if (room.includes(deviceId)) return;
  room.push(deviceId);
  await env.PUSH_SUBS.put(roomKey(roomCodeLower), JSON.stringify(room));
}

// Limpa do KV as inscrições que morreram durante um `sendPushToDevices`,
// tirando cada device de TODAS as salas que ele vigiava (não só da sala
// da chamada atual) — senão ficava lixo órfão nas outras.
async function cleanupStaleDevices(env, stale) {
  await Promise.all(
    stale.flatMap(({ deviceId, roomCodes }) => roomCodes.map((code) => removeDeviceFromRoom(env, deviceId, code)))
  );
}

async function handleTurn(env) {
  if (!env.TURN_KEY_ID || !env.TURN_API_TOKEN) {
    return json({ error: 'worker sem TURN_KEY_ID/TURN_API_TOKEN configurados' }, 500);
  }
  try {
    const upstream = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.TURN_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
      }
    );
    if (!upstream.ok) {
      return json({ error: 'cloudflare turn api error', status: upstream.status }, 502);
    }
    return json(await upstream.json(), 200);
  } catch {
    return json({ error: 'falha ao gerar credenciais TURN' }, 502);
  }
}

// Grava a inscrição do device pra sala dada, mantendo só as últimas
// MAX_WATCHED_ROOMS salas que ele entrou (ordem de mais antiga pra mais
// nova) — entrar numa 4ª sala derruba a mais antiga da lista.
async function handleSubscribe(request, env) {
  if (!env.PUSH_SUBS) return json({ error: 'worker sem KV PUSH_SUBS configurado' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'json inválido' }, 400);
  }

  const { deviceId, subscription, nickname } = body;
  const roomCode = normalizeRoomCode(body.roomCode);
  if (!deviceId || !roomCode || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return json({ error: 'campos faltando' }, 400);
  }

  const previous = await env.PUSH_SUBS.get(subKey(deviceId), 'json');
  const merged = [...watchedRoomsOf(previous).filter((code) => code !== roomCode), roomCode];
  const evictedCount = Math.max(0, merged.length - MAX_WATCHED_ROOMS);
  const evicted = merged.slice(0, evictedCount);
  const roomCodes = merged.slice(evictedCount);

  await Promise.all(evicted.map((code) => removeDeviceFromRoom(env, deviceId, code)));

  await env.PUSH_SUBS.put(
    subKey(deviceId),
    JSON.stringify({ subscription, roomCodes, nickname: String(nickname || '').slice(0, 60) })
  );

  await addDeviceToRoom(env, deviceId, roomCode);

  return json({ ok: true });
}

async function handleUnsubscribe(request, env) {
  if (!env.PUSH_SUBS) return json({ error: 'worker sem KV PUSH_SUBS configurado' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'json inválido' }, 400);
  }

  const { deviceId } = body;
  if (!deviceId) return json({ error: 'deviceId faltando' }, 400);

  const previous = await env.PUSH_SUBS.get(subKey(deviceId), 'json');
  await Promise.all(watchedRoomsOf(previous).map((code) => removeDeviceFromRoom(env, deviceId, code)));
  await env.PUSH_SUBS.delete(subKey(deviceId));

  return json({ ok: true });
}

// Avisa todo mundo que já tava vigiando essa sala (menos quem acabou de
// entrar) que "fulano entrou na sala X".
async function handleNotifyJoin(request, env) {
  if (!env.PUSH_SUBS) return json({ error: 'worker sem KV PUSH_SUBS configurado' }, 500);
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return json({ error: 'worker sem VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY configurados' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'json inválido' }, 400);
  }

  const { nickname, deviceId: joinerDeviceId } = body;
  const roomCode = normalizeRoomCode(body.roomCode);
  if (!roomCode) return json({ error: 'roomCode faltando' }, 400);

  const watcherIds = (await env.PUSH_SUBS.get(roomKey(roomCode), 'json')) || [];
  const targets = watcherIds.filter((id) => id !== joinerDeviceId);
  if (!targets.length) return json({ ok: true, notified: 0 });

  const message = {
    data: {
      title: `${nickname || 'Alguém'} entrou na sala`,
      body: body.roomCode,
      // pro clique da notificação levar pra sala certa (ver public/sw.js)
      roomCode: body.roomCode,
    },
    options: { ttl: 60, urgency: 'normal' },
  };

  const { notified, stale, notWatching } = await sendPushToDevices(env, targets, message, {
    requireRoomCode: roomCode,
  });
  await cleanupStaleDevices(env, stale);
  await Promise.all(notWatching.map((deviceId) => removeDeviceFromRoom(env, deviceId, roomCode)));

  return json({ ok: true, notified });
}

// ----- Convite diário -----
//
// Uma vez por dia, num horário "aleatório" (na prática: pseudo-aleatório,
// determinado por um hash da data — sem isso, cada tick do cron teria que
// concordar em qual foi o horário sorteado, e não dá pra sortear de
// verdade sem guardar estado antes), manda um convite pra todo mundo que
// já se inscreveu alguma vez (entrou em pelo menos uma sala).
//
// O cron roda a cada 15min (ver wrangler.toml) só checando "é agora?" —
// o KV guarda `daily-invite:<data>` pra nunca mandar duas vezes no mesmo
// dia mesmo se o worker acordar em dois ticks próximos.

const DAILY_INVITE_TIMEZONE = 'America/Sao_Paulo';
const DAILY_INVITE_WINDOW = { startHour: 10, endHour: 22 }; // pseudo-aleatório dentro desse intervalo

const DAILY_INVITE_MESSAGES = [
  'Que tal compartilhar sua tela com seus amigos agora?',
  'Bora chamar a galera pra uma sala no GustaShare?',
  'Já faz um tempo que você não abre uma sala... que tal hoje?',
  'Um joguinho, um filme, uma tela compartilhada — chama a turma!',
  'GustaShare tá esperando por você e sua galera. Bora entrar numa sala?',
];

// FNV-1a — um hash simples de 31 bits (`* 31 + char`) espalha mal quando as
// chaves são datas sequenciais tipo "2026-09-01"/"2026-09-02" (o horário
// sorteado saía andando 15min por dia em vez de parecer aleatório). Esse
// dá uma distribuição bem melhor pra strings parecidas.
function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function saoPauloParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DAILY_INVITE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  };
}

async function handleScheduled(env, now = new Date()) {
  if (!env.PUSH_SUBS) return;
  const { dateStr, hour, minute } = saoPauloParts(now);

  const alreadySent = await env.PUSH_SUBS.get(`daily-invite:${dateStr}`);
  if (alreadySent) return;

  const { startHour, endHour } = DAILY_INVITE_WINDOW;
  const totalSlots = (endHour - startHour) * 4; // slots de 15min
  const targetSlot = fnv1a(`${dateStr}:slot`) % totalSlots;
  const targetHour = startHour + Math.floor(targetSlot / 4);
  const targetMinute = (targetSlot % 4) * 15;

  if (hour !== targetHour || minute !== targetMinute) return;

  // Trava antes de mandar (não depois) pra evitar corrida entre ticks.
  await env.PUSH_SUBS.put(`daily-invite:${dateStr}`, '1', { expirationTtl: 3 * 24 * 60 * 60 });

  const deviceIds = [];
  let cursor;
  do {
    const listed = await env.PUSH_SUBS.list({ prefix: 'sub:', cursor });
    deviceIds.push(...listed.keys.map((k) => k.name.slice('sub:'.length)));
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);

  if (!deviceIds.length) return;

  const phrase = DAILY_INVITE_MESSAGES[fnv1a(`${dateStr}:msg`) % DAILY_INVITE_MESSAGES.length];
  const message = {
    data: { title: 'GustaShare', body: phrase },
    options: { ttl: 6 * 60 * 60, urgency: 'low' },
  };

  const { stale } = await sendPushToDevices(env, deviceIds, message);
  await cleanupStaleDevices(env, stale);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const { pathname } = new URL(request.url);

    if (pathname === '/turn' || pathname === '/') {
      if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);
      return handleTurn(env);
    }

    if (pathname === '/push/subscribe' && request.method === 'POST') {
      return handleSubscribe(request, env);
    }

    if (pathname === '/push/unsubscribe' && request.method === 'POST') {
      return handleUnsubscribe(request, env);
    }

    if (pathname === '/push/notify-join' && request.method === 'POST') {
      return handleNotifyJoin(request, env);
    }

    return json({ error: 'not found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env, new Date(event.scheduledTime)));
  },
};
