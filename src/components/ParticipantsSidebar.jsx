import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import useSpeaking from '../lib/useSpeaking.js';
import { userColorStyle } from '../lib/userColor.js';
import { loadPublicRooms } from '../lib/publicRooms.js';
import ClientBadge from './ClientBadge.jsx';
import HostBadge from './HostBadge.jsx';
import MicBadge from './MicBadge.jsx';
import RoomIcon from './RoomIcon.jsx';

function ParticipantRow({ nickname, isSelf, userId, platform, micStream, isHost }) {
  const speaking = useSpeaking(micStream);
  const micOn = Boolean(micStream);

  return (
    <div className={`participant-row ${speaking ? 'speaking' : ''}`} style={userColorStyle(userId)}>
      <span className="participant-name">
        {nickname}
        {isSelf ? ' (você)' : ''}
      </span>
      <span className="participant-badges">
        {isHost && <HostBadge />}
        <ClientBadge platform={platform} />
        <MicBadge on={micOn} />
      </span>
    </div>
  );
}

export default function ParticipantsSidebar({
  roster,
  selfId,
  streams,
  selfStreams,
  className,
  onClose,
  hostId,
  currentRoomCode,
  onSwitchRoom,
}) {
  const [rooms, setRooms] = useState([]);
  const [switchTarget, setSwitchTarget] = useState(null);

  useEffect(() => {
    setRooms(loadPublicRooms());
  }, [currentRoomCode]);

  function pickRoom(room) {
    if (room.roomCode === currentRoomCode) return;
    setSwitchTarget(room);
  }

  function confirmSwitch() {
    const room = switchTarget;
    setSwitchTarget(null);
    if (room) onSwitchRoom?.(room.roomCode);
  }

  return (
    <div className={`participants ${className || ''}`}>
      <div className="participants-section">
        <div className="participants-title">
          Nesta sala ({roster.length})
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="participants-list">
          {roster.map((m) => {
            const isSelf = m.id === selfId;
            const micStream = isSelf ? selfStreams.mic : streams[m.id]?.mic;
            return (
              <ParticipantRow
                key={m.id}
                userId={m.id}
                nickname={m.nickname}
                isSelf={isSelf}
                platform={m.platform}
                micStream={micStream}
                isHost={m.id === hostId}
              />
            );
          })}
        </div>
      </div>

      <div className="room-switch-section">
        <div className="participants-title">Outras salas</div>
        <div className="room-switch-list">
          {rooms.map((room) => {
            const isCurrent = room.roomCode === currentRoomCode;
            return (
              <button
                key={room.roomCode}
                type="button"
                className={`public-room-card ${isCurrent ? 'current' : ''}`}
                onClick={() => pickRoom(room)}
                disabled={isCurrent}
              >
                <RoomIcon name={room.roomCode} size={18} />
                <div className="room-info">
                  <div className="room-name">{room.roomCode}</div>
                </div>
                <div className={`room-count ${room.participantCount > 0 ? 'room-count-active' : 'room-count-empty'}`}>
                  {isCurrent ? 'atual' : `${room.participantCount} ${room.participantCount === 1 ? 'pessoa' : 'pessoas'}`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {switchTarget && (
        <div className="picker-backdrop" onClick={() => setSwitchTarget(null)}>
          <div className="invite-box leave-box" onClick={(e) => e.stopPropagation()}>
            <h2>Trocar de sala?</h2>
            <p className="invite-hint">
              Você vai sair dessa sala e entrar em <strong>{switchTarget.roomCode}</strong>.
            </p>
            <button type="button" className="leave-confirm" onClick={confirmSwitch}>
              Trocar de sala
            </button>
            <button type="button" className="leave-cancel" onClick={() => setSwitchTarget(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
