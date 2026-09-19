import { PublicRoomsRegistry } from './RoomClient.js';
import { PERMANENT_ROOMS } from './permanentRooms.js';

export { PERMANENT_ROOMS };

// Junta as salas dinâmicas (criadas por alguém, guardadas no localStorage
// deste navegador) com as permanentes, sempre com as mais cheias primeiro.
export function loadPublicRooms() {
  PublicRoomsRegistry.cleanup();
  const dynamicRooms = Object.values(PublicRoomsRegistry.getAll()).map((r) => ({
    ...r,
    category: 'galera',
  }));
  const dynamicCodes = new Set(dynamicRooms.map((r) => r.roomCode));
  const permanentRooms = PERMANENT_ROOMS.filter((r) => !dynamicCodes.has(r.name)).map((r) => ({
    roomCode: r.name,
    hostName: '',
    participantCount: 0,
    createdAt: 0,
    category: r.category,
  }));
  return [...dynamicRooms, ...permanentRooms].sort((a, b) => b.participantCount - a.participantCount);
}
