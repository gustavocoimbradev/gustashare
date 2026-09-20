// Notificação local de "chegou mensagem no chat" — só funciona enquanto a
// aba/app tá aberto (não precisa estar em foco), sem depender do Worker:
// é a API padrão `Notification`, direto no processo que já tá rodando.
// Diferente da de "fulano entrou na sala" (pushNotifications.js), que
// precisa sobreviver com o site fechado — aqui não tem esse requisito,
// então não vale a complexidade extra de Web Push.

export const localNotificationsSupported = typeof window !== 'undefined' && 'Notification' in window;

export async function ensureLocalNotificationPermission() {
  if (!localNotificationsSupported) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function notifyLocalChat(nickname, text) {
  if (!localNotificationsSupported || Notification.permission !== 'granted') return;
  // Se a aba já tá em foco a pessoa vê a mensagem no chat ali mesmo — a
  // notificação é só pra quando ela não tá olhando.
  if (typeof document !== 'undefined' && document.hasFocus()) return;
  try {
    const notif = new Notification(nickname || 'Alguém', {
      body: text,
      icon: '/icon-192.png',
      tag: 'gustashare-chat',
    });
    notif.onclick = () => {
      window.focus?.();
      notif.close();
    };
  } catch (err) {
    console.warn('Falha ao mostrar notificação de chat:', err);
  }
}
