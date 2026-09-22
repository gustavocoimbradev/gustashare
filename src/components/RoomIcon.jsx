import React from 'react';
import {
  Ghost,
  Gamepad2,
  MessageCircle,
  Code2,
  BookOpen,
  Music,
  Clapperboard,
  UsersRound,
  Globe,
  Sparkles,
  Palette,
  Library,
  ChefHat,
  Plane,
  Goal,
  Cpu,
  Laugh,
  Wallet,
  HeartHandshake,
  Coffee,
  MoonStar,
} from 'lucide-react';

// Ícones temáticos das salas permanentes "genéricas" (sem jogo/marca
// associado), cada uma com uma cor própria pra não ficar tudo igual.
const THEME_ICONS = {
  'Vídeos de Terror': { icon: Ghost, bg: 'linear-gradient(135deg, #6a0000, #1a0000)' },
  Gameplay: { icon: Gamepad2, bg: 'linear-gradient(135deg, #7c6bfb, #4a7dff)' },
  'Conversa Fiada': { icon: MessageCircle, bg: 'linear-gradient(135deg, #11998e, #38ef7d)' },
  'Programação': { icon: Code2, bg: 'linear-gradient(135deg, #134e5e, #4ca1af)' },
  Estudos: { icon: BookOpen, bg: 'linear-gradient(135deg, #667eea, #764ba2)' },
  'Música': { icon: Music, bg: 'linear-gradient(135deg, #f093fb, #d6336c)' },
  Filminho: { icon: Clapperboard, bg: 'linear-gradient(135deg, #b8860b, #7b1e3a)' },
  Networking: { icon: UsersRound, bg: 'linear-gradient(135deg, #2193b0, #1c4e80)' },
  Anime: { icon: Sparkles, bg: 'linear-gradient(135deg, #ff6a88, #ff99ac)' },
  Desenho: { icon: Palette, bg: 'linear-gradient(135deg, #a855f7, #ec4899)' },
  Livros: { icon: Library, bg: 'linear-gradient(135deg, #6a4c93, #3a2960)' },
  'Culinária': { icon: ChefHat, bg: 'linear-gradient(135deg, #f6a536, #b03a2e)' },
  Viagem: { icon: Plane, bg: 'linear-gradient(135deg, #00b4db, #0083b0)' },
  Futebol: { icon: Goal, bg: 'linear-gradient(135deg, #1e8449, #0b3d24)' },
  Tecnologia: { icon: Cpu, bg: 'linear-gradient(135deg, #485563, #29323c)' },
  Memes: { icon: Laugh, bg: 'linear-gradient(135deg, #f9d423, #c9861f)' },
  'Finanças': { icon: Wallet, bg: 'linear-gradient(135deg, #11998e, #0f4c3a)' },
  Relacionamentos: { icon: HeartHandshake, bg: 'linear-gradient(135deg, #ff5e7e, #b0264f)' },
  'Só Café': { icon: Coffee, bg: 'linear-gradient(135deg, #6f4e37, #3a2417)' },
  Madrugada: { icon: MoonStar, bg: 'linear-gradient(135deg, #2c3e50, #0b1220)' },
};

// Marcas reais (sites/apps próprios) — usamos o ícone/favicon/logo oficial
// em vez de um ícone genérico.
//
// Caminho prefixado com `import.meta.env.BASE_URL` (não `/room-icons/...`
// fixo): no build desktop o Vite usa `base: './'` (file://, caminho
// absoluto vira "raiz do disco" e quebra a imagem) e no build web usa
// `base: '/'` — ver vite.config.js.
const ICON_BASE = `${import.meta.env.BASE_URL}room-icons/`;

const IMAGE_ICONS = {
  Codenames: `${ICON_BASE}codenames.png`,
  StopotS: `${ICON_BASE}stopots.png`,
  Gartic: `${ICON_BASE}gartic.png`,
  'Gartic Phone': `${ICON_BASE}gartic-phone.png`,
  Argumento: `${ICON_BASE}argumento.png`,
  Xracing: `${ICON_BASE}xracing.png`,
  Minecraft: `${ICON_BASE}minecraft.svg`,
  CS2: `${ICON_BASE}cs2.png`,
  Fortnite: `${ICON_BASE}fortnite.png`,
  'EA FC': `${ICON_BASE}eafc.png`,
  GTA: `${ICON_BASE}gta.png`,
  'Free Fire': `${ICON_BASE}freefire.png`,
  'Rocket League': `${ICON_BASE}rocketleague.svg`,
  'Just Dance': `${ICON_BASE}justdance.svg`,
  Uno: `${ICON_BASE}uno.svg`,
  'Skribbl.io': `${ICON_BASE}skribbl.png`,
  Jackbox: `${ICON_BASE}jackbox.png`,
};

// Marcas com logo próprio desenhado em path (path preenchido, como no
// simple-icons, ou traço/contorno, como no tabler-icons).
const BRAND_ICONS = {
  Valorant: {
    type: 'fill',
    paths: ['M23.792 2.152a.252.252 0 0 0-.098.083c-3.384 4.23-6.769 8.46-10.15 12.69-.107.093-.025.288.119.265 2.439.003 4.877 0 7.316.001a.66.66 0 0 0 .552-.25c.774-.967 1.55-1.934 2.324-2.903a.72.72 0 0 0 .144-.49c-.002-3.077 0-6.153-.003-9.23.016-.11-.1-.206-.204-.167zM.077 2.166c-.077.038-.074.132-.076.205.002 3.074.001 6.15.001 9.225a.679.679 0 0 0 .158.463l7.64 9.55c.12.152.308.25.505.247 2.455 0 4.91.003 7.365 0 .142.02.222-.174.116-.265C10.661 15.176 5.526 8.766.4 2.35c-.08-.094-.174-.272-.322-.184z'],
    bg: '#ff4655',
    fg: '#fff',
  },
  'League of Legends': {
    type: 'fill',
    paths: ['m1.912 0 1.212 2.474v19.053L1.912 24h14.73l1.337-4.682H8.33V0ZM12 1.516c-.913 0-1.798.112-2.648.312v1.74a9.738 9.738 0 0 1 2.648-.368c5.267 0 9.536 4.184 9.536 9.348a9.203 9.203 0 0 1-2.3 6.086l-.273.954-.602 2.112c2.952-1.993 4.89-5.335 4.89-9.122C23.25 6.468 18.213 1.516 12 1.516Zm0 2.673c-.924 0-1.814.148-2.648.414v13.713h8.817a8.246 8.246 0 0 0 2.36-5.768c0-4.617-3.818-8.359-8.529-8.359zM2.104 7.312A10.858 10.858 0 0 0 .75 12.576c0 1.906.492 3.7 1.355 5.266z'],
    bg: '#0a1428',
    fg: '#c8aa6e',
  },
  'Among Us': {
    type: 'stroke',
    paths: [
      'M10.646 12.774c-1.939 .396 -4.467 .317 -6.234 -.601c-2.454 -1.263 -1.537 -4.66 1.423 -4.982c2.254 -.224 3.814 -.354 5.65 .214c.835 .256 1.93 .569 1.355 3.281c-.191 1.067 -1.07 1.904 -2.194 2.088z',
      'M5.84 7.132c.083 -.564 .214 -1.12 .392 -1.661c.456 -.936 1.095 -2.068 3.985 -2.456a22.464 22.464 0 0 1 2.867 .08c1.776 .14 2.643 1.234 3.287 3.368c.339 1.157 .46 2.342 .629 3.537v11l-12.704 -.019c-.552 -2.386 -.262 -5.894 .204 -8.481',
      'M17 10c.991 .163 2.105 .383 3.069 .67c.255 .13 .52 .275 .534 .505c.264 3.434 .57 7.448 .278 9.825h-3.881',
    ],
    bg: '#c51111',
    fg: '#fff',
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
    const isStroke = brand.type === 'stroke';
    return (
      <span className="room-icon room-icon-brand" style={{ background: brand.bg }}>
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill={isStroke ? 'none' : brand.fg}
          stroke={isStroke ? brand.fg : 'none'}
          strokeWidth={isStroke ? 2 : 0}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {brand.paths.map((d) => (
            <path key={d} d={d} />
          ))}
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
