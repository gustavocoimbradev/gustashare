// Ajustes ao vivo dos efeitos sonoros (usados pela rota /sounds). Persiste
// no localStorage e é lido por sounds.js toda vez que um som toca — então
// mexer aqui muda de verdade o som usado no app de verdade, não uma cópia.

const KEY = 'gustashare:soundSettings';

export const SOUND_DEFS = [
  { id: 'chat', label: 'Mensagem no chat', tier: 1, hint: 'Toca quando alguém manda uma mensagem' },
  { id: 'micOn', label: 'Microfone ligado', tier: 1, hint: 'Toca quando alguém ativa o microfone' },
  { id: 'micOff', label: 'Microfone desligado', tier: 1, hint: 'Toca quando alguém desativa o microfone' },
  { id: 'join', label: 'Alguém entrou na sala', tier: 2, hint: 'Toca quando um novo participante chega' },
  { id: 'leave', label: 'Alguém saiu da sala', tier: 2, hint: 'Toca quando um participante sai' },
  { id: 'mediaOn', label: 'Tela ou câmera ligada', tier: 3, hint: 'Toca quando alguém começa a compartilhar tela/câmera' },
];

const DEFAULT_SETTING = { volume: 1, pitch: 0, speed: 1 };

function defaults() {
  const out = {};
  for (const { id } of SOUND_DEFS) out[id] = { ...DEFAULT_SETTING };
  return out;
}

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    cache = defaults();
    for (const { id } of SOUND_DEFS) {
      if (raw[id]) cache[id] = { ...DEFAULT_SETTING, ...raw[id] };
    }
  } catch {
    cache = defaults();
  }
  return cache;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // localStorage indisponível — vale só pra essa sessão
  }
}

export function getSoundSetting(id) {
  const all = load();
  return all[id] || { ...DEFAULT_SETTING };
}

export function setSoundSetting(id, patch) {
  const all = load();
  all[id] = { ...DEFAULT_SETTING, ...all[id], ...patch };
  persist();
  return all[id];
}

export function resetSoundSetting(id) {
  const all = load();
  all[id] = { ...DEFAULT_SETTING };
  persist();
  return all[id];
}

export function resetAllSoundSettings() {
  cache = defaults();
  persist();
  return cache;
}
