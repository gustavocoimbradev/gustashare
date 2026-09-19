import React from 'react';
import {
  Ghost,
  Gamepad2,
  Timer,
  MessageCircle,
  Code2,
  BookOpen,
  Music,
  Clapperboard,
  UsersRound,
  Globe,
} from 'lucide-react';

// Ícones temáticos das salas permanentes "genéricas" (sem jogo/marca
// associado), cada uma com uma cor própria pra não ficar tudo igual.
const THEME_ICONS = {
  'Vídeos de Terror': { icon: Ghost, bg: 'linear-gradient(135deg, #6a0000, #1a0000)' },
  Gameplay: { icon: Gamepad2, bg: 'linear-gradient(135deg, #7c6bfb, #4a7dff)' },
  StopotS: { icon: Timer, bg: 'linear-gradient(135deg, #e08600, #ad1457)' },
  'Conversa Fiada': { icon: MessageCircle, bg: 'linear-gradient(135deg, #11998e, #38ef7d)' },
  'Programação': { icon: Code2, bg: 'linear-gradient(135deg, #134e5e, #4ca1af)' },
  Estudos: { icon: BookOpen, bg: 'linear-gradient(135deg, #667eea, #764ba2)' },
  'Música': { icon: Music, bg: 'linear-gradient(135deg, #f093fb, #d6336c)' },
  Filminho: { icon: Clapperboard, bg: 'linear-gradient(135deg, #b8860b, #7b1e3a)' },
  Networking: { icon: UsersRound, bg: 'linear-gradient(135deg, #2193b0, #1c4e80)' },
};

// Marcas reais (sites/apps próprios) — usamos o ícone/favicon oficial em
// vez de um ícone genérico.
const IMAGE_ICONS = {
  Codenames: '/room-icons/codenames.png',
  Gartic: '/room-icons/gartic.png',
  'Gartic Phone': '/room-icons/gartic-phone.png',
  Argumento: '/room-icons/argumento.png',
  Xracing: '/room-icons/xracing.png',
};

// Marcas com logo próprio (paths extraídos do simple-icons).
const BRAND_ICONS = {
  Valorant: {
    path: 'M23.792 2.152a.252.252 0 0 0-.098.083c-3.384 4.23-6.769 8.46-10.15 12.69-.107.093-.025.288.119.265 2.439.003 4.877 0 7.316.001a.66.66 0 0 0 .552-.25c.774-.967 1.55-1.934 2.324-2.903a.72.72 0 0 0 .144-.49c-.002-3.077 0-6.153-.003-9.23.016-.11-.1-.206-.204-.167zM.077 2.166c-.077.038-.074.132-.076.205.002 3.074.001 6.15.001 9.225a.679.679 0 0 0 .158.463l7.64 9.55c.12.152.308.25.505.247 2.455 0 4.91.003 7.365 0 .142.02.222-.174.116-.265C10.661 15.176 5.526 8.766.4 2.35c-.08-.094-.174-.272-.322-.184z',
    bg: '#ff4655',
    fg: '#fff',
  },
  'League of Legends': {
    path: 'm1.912 0 1.212 2.474v19.053L1.912 24h14.73l1.337-4.682H8.33V0ZM12 1.516c-.913 0-1.798.112-2.648.312v1.74a9.738 9.738 0 0 1 2.648-.368c5.267 0 9.536 4.184 9.536 9.348a9.203 9.203 0 0 1-2.3 6.086l-.273.954-.602 2.112c2.952-1.993 4.89-5.335 4.89-9.122C23.25 6.468 18.213 1.516 12 1.516Zm0 2.673c-.924 0-1.814.148-2.648.414v13.713h8.817a8.246 8.246 0 0 0 2.36-5.768c0-4.617-3.818-8.359-8.529-8.359zM2.104 7.312A10.858 10.858 0 0 0 .75 12.576c0 1.906.492 3.7 1.355 5.266z',
    bg: '#0a1428',
    fg: '#c8aa6e',
  },
};

// Salas dinâmicas (criadas por alguém) não têm ícone temático — variam a
// cor de fundo a partir do nome pra não ficarem todas idênticas.
const FALLBACK_PALETTE = [
  'linear-gradient(135deg, #7c6bfb, #4a7dff)',
  'linear-gradient(135deg, #11998e, #38ef7d)',
  'linear-gradient(135deg, #eb3349, #f45c43)',
  'linear-gradient(135deg, #f7971e, #d0710a)',
  'linear-gradient(135deg, #2193b0, #6dd5ed)',
  'linear-gradient(135deg, #a855f7, #ec4899)',
  'linear-gradient(135deg, #ff512f, #dd2476)',
  'linear-gradient(135deg, #134e5e, #71b280)',
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export default function RoomIcon({ name, size = 20 }) {
  const brand = BRAND_ICONS[name];
  if (brand) {
    return (
      <span className="room-icon room-icon-brand" style={{ background: brand.bg }}>
        <svg viewBox="0 0 24 24" width={size} height={size} fill={brand.fg}>
          <path d={brand.path} />
        </svg>
      </span>
    );
  }

  const image = IMAGE_ICONS[name];
  if (image) {
    return (
      <span className="room-icon room-icon-image">
        <img src={image} alt="" />
      </span>
    );
  }

  const theme = THEME_ICONS[name];
  if (theme) {
    const ThemeIcon = theme.icon;
    return (
      <span className="room-icon" style={{ background: theme.bg }}>
        <ThemeIcon size={size} />
      </span>
    );
  }

  const bg = FALLBACK_PALETTE[hashString(String(name || '')) % FALLBACK_PALETTE.length];
  return (
    <span className="room-icon" style={{ background: bg }}>
      <Globe size={size} />
    </span>
  );
}
