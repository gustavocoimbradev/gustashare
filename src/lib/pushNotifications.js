// Notificação "fulano entrou na sala" via Web Push — funciona mesmo com o
// site fechado de verdade (não só em background), porque quem entra na
// sala avisa o Worker da Cloudflare, e é ELE quem manda o push pro
// navegador/SO de quem tá vigiando aquela sala (ver cloudflare-worker/worker.js
// e o README daquela pasta pra configuração).
//
// Só vigia uma sala por vez — qualquer sala (permanente ou personalizada)
// que você entrar vira "a" sala vigiada, substituindo a anterior.
//
// No desktop (Electron) isso não funciona: Service Worker/Push API não
// registram em origem `file://`, que é como o app carrega o build. Falha
// em silêncio (fica só sem o aviso) — a versão web funciona normalmente.

const PUSH_WORKER_URL = 'https://gustashare-turn.whoisgustavolima.workers.dev';
const VAPID_PUBLIC_KEY = 'BE6HXXgJM-DfYaYKAa8WxbzjXMGRXHE02T7Yi2eOPPwrnDiUmzhfsG-XZuXm3ebNycqm2uUMQNZsNQxvcfYjPHE';
const DEVICE_ID_KEY = 'gustashare:deviceId';

export const pushSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function ensureSubscription() {
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

async function subscribeToRoom(deviceId, roomCode, nickname) {
  if (!pushSupported) return;
  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  const subscription = await ensureSubscription();
  await fetch(`${PUSH_WORKER_URL}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, roomCode, nickname, subscription: subscription.toJSON() }),
  });
}

async function announceJoin(deviceId, roomCode, nickname) {
  await fetch(`${PUSH_WORKER_URL}/push/notify-join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, roomCode, nickname }),
  });
}

// Chamar ao entrar numa sala: passa a vigiá-la (no lugar de qualquer outra
// que vigiava antes) e avisa quem já vigiava que você entrou. Nunca lança
// — falha de rede/permissão só significa "sem notificação dessa vez", não
// deve quebrar a entrada na sala.
export async function watchRoomAndAnnounceJoin(roomCode, nickname) {
  const deviceId = getDeviceId();
  if (!deviceId) return;

  try {
    await subscribeToRoom(deviceId, roomCode, nickname);
  } catch (err) {
    console.warn('Falha ao assinar notificações push:', err);
  }

  try {
    await announceJoin(deviceId, roomCode, nickname);
  } catch (err) {
    console.warn('Falha ao avisar entrada na sala:', err);
  }
}
