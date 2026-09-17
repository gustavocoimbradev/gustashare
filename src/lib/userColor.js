const PALETTE = [
  '#7c6bfb',
  '#4a7dff',
  '#ec4899',
  '#22c55e',
  '#f59e0b',
  '#14b8a6',
  '#f97316',
  '#38bdf8',
  '#a78bfa',
  '#e879f9',
  '#84cc16',
  '#fb7185',
  '#2dd4bf',
  '#60a5fa',
  '#fbbf24',
  '#c084fc',
];

function hashId(id) {
  const s = String(id || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function userColor(id) {
  const hex = PALETTE[hashId(id) % PALETTE.length];
  const n = parseInt(hex.slice(1), 16);
  return {
    hex,
    rgb: `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`,
  };
}

export function userColorStyle(id) {
  const { hex, rgb } = userColor(id);
  return { '--user-color': hex, '--user-color-rgb': rgb };
}
