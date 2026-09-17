const NICK_KEY = 'gustashare:nickname';
const ROOM_KEY = 'gustashare:roomCode';

export function saveSession(nickname, roomCode) {
  try {
    localStorage.setItem(NICK_KEY, nickname);
    localStorage.setItem(ROOM_KEY, roomCode);
  } catch {
    // localStorage indisponível — só não persiste
  }
}

export function loadSession() {
  try {
    return {
      nickname: localStorage.getItem(NICK_KEY) || '',
      roomCode: localStorage.getItem(ROOM_KEY) || '',
    };
  } catch {
    return { nickname: '', roomCode: '' };
  }
}
