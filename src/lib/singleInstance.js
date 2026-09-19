import { useEffect, useState } from 'react';

// Trava simples pra impedir duas abas do GustaShare abertas ao mesmo tempo
// no mesmo navegador. Guarda quem é "dono" no localStorage (compartilhado
// entre abas da mesma origem) com um heartbeat; se a aba dona travar ou
// fechar sem disparar o evento de descarregamento, a trava expira sozinha
// e outra aba assume.
const LOCK_KEY = 'gsh_instance_lock';
const HEARTBEAT_MS = 1000;
const STALE_MS = 2500;

function readLock() {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY) || 'null');
  } catch {
    return null;
  }
}

function isFresh(lock) {
  return Boolean(lock) && Date.now() - lock.ts < STALE_MS;
}

export function useSingleInstance(enabled) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let owner = false;

    function writeLock() {
      try {
        localStorage.setItem(LOCK_KEY, JSON.stringify({ id, ts: Date.now() }));
      } catch {
        // sem localStorage não dá pra travar — deixa passar
      }
    }

    function tick() {
      const lock = readLock();
      if (owner) {
        if (!lock || lock.id === id) {
          writeLock();
        } else {
          owner = false;
          setBlocked(true);
        }
        return;
      }
      if (isFresh(lock) && lock.id !== id) {
        setBlocked(true);
      } else {
        owner = true;
        setBlocked(false);
        writeLock();
      }
    }

    function release() {
      if (!owner) return;
      const lock = readLock();
      if (lock && lock.id === id) {
        try {
          localStorage.removeItem(LOCK_KEY);
        } catch {
          // ignora
        }
      }
    }

    function onStorage(e) {
      if (e.key === LOCK_KEY) tick();
    }

    tick();
    const interval = setInterval(tick, HEARTBEAT_MS);
    window.addEventListener('storage', onStorage);
    window.addEventListener('beforeunload', release);
    window.addEventListener('pagehide', release);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('beforeunload', release);
      window.removeEventListener('pagehide', release);
      release();
    };
  }, [enabled]);

  return blocked;
}
