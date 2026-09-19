// Lista "crua" das salas permanentes — sem imports, pra poder ser usada
// tanto por publicRooms.js (monta a listagem da home) quanto por
// RoomClient.js (decide se uma sala deve se contar como pública
// automaticamente) sem criar dependência circular entre os dois.
export const PERMANENT_ROOMS = [
  // Jogos
  { name: 'Gameplay', category: 'jogos' },
  { name: 'Valorant', category: 'jogos' },
  { name: 'League of Legends', category: 'jogos' },
  { name: 'Xracing', category: 'jogos' },
  { name: 'Codenames', category: 'jogos' },
  { name: 'StopotS', category: 'jogos' },
  { name: 'Gartic', category: 'jogos' },
  { name: 'Gartic Phone', category: 'jogos' },
  { name: 'Among Us', category: 'jogos' },
  { name: 'Minecraft', category: 'jogos' },
  { name: 'CS2', category: 'jogos' },
  { name: 'Fortnite', category: 'jogos' },
  { name: 'EA FC', category: 'jogos' },
  { name: 'GTA', category: 'jogos' },
  { name: 'Free Fire', category: 'jogos' },
  { name: 'Rocket League', category: 'jogos' },
  { name: 'Just Dance', category: 'jogos' },
  { name: 'Uno', category: 'jogos' },
  { name: 'Skribbl.io', category: 'jogos' },
  { name: 'Jackbox', category: 'jogos' },
  // Assuntos
  { name: 'Vídeos de Terror', category: 'assuntos' },
  { name: 'Argumento', category: 'assuntos' },
  { name: 'Conversa Fiada', category: 'assuntos' },
  { name: 'Programação', category: 'assuntos' },
  { name: 'Estudos', category: 'assuntos' },
  { name: 'Música', category: 'assuntos' },
  { name: 'Filminho', category: 'assuntos' },
  { name: 'Networking', category: 'assuntos' },
  { name: 'Anime', category: 'assuntos' },
  { name: 'Desenho', category: 'assuntos' },
  { name: 'Livros', category: 'assuntos' },
  { name: 'Culinária', category: 'assuntos' },
  { name: 'Viagem', category: 'assuntos' },
  { name: 'Futebol', category: 'assuntos' },
  { name: 'Tecnologia', category: 'assuntos' },
  { name: 'Memes', category: 'assuntos' },
  { name: 'Finanças', category: 'assuntos' },
  { name: 'Relacionamentos', category: 'assuntos' },
  { name: 'Só Café', category: 'assuntos' },
  { name: 'Madrugada', category: 'assuntos' },
];

const PERMANENT_ROOM_NAMES = new Set(PERMANENT_ROOMS.map((r) => r.name.toLowerCase()));

export function isPermanentRoomName(roomCode) {
  return PERMANENT_ROOM_NAMES.has(String(roomCode || '').trim().toLowerCase());
}
