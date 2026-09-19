import React, { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorX, Gamepad2, Share2, Users, MessageCircle, Globe, Lock } from 'lucide-react';
import Tooltip from './Tooltip.jsx';
import InviteModal from './InviteModal.jsx';
import GamesModal from './GamesModal.jsx';

export default function Dock({
  micOn,
  camOn,
  screenOn,
  onToggleMic,
  onToggleCam,
  onToggleScreen,
  roomCode,
  nickname,
  onInviteGame,
  usersOpen,
  chatOpen,
  onToggleUsers,
  onToggleChat,
  isHost,
  isPublic,
  onTogglePublic,
  isPermanentRoom,
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);

  return (
    <>
      <div className="dock">
        <Tooltip label={micOn ? 'Desligar microfone' : 'Ligar microfone'}>
          <button type="button" className={`dock-btn ${micOn ? 'active' : ''}`} onClick={onToggleMic}>
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
        </Tooltip>

        <Tooltip label={camOn ? 'Desligar câmera' : 'Ligar câmera'}>
          <button type="button" className={`dock-btn ${camOn ? 'active' : ''}`} onClick={onToggleCam}>
            {camOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
        </Tooltip>

        <span className="dock-desktop-only">
          <Tooltip label={screenOn ? 'Parar compartilhamento' : 'Compartilhar tela'}>
            <button
              type="button"
              className={`dock-btn screen ${screenOn ? 'active' : ''}`}
              onClick={onToggleScreen}
            >
              {screenOn ? <MonitorX size={20} /> : <MonitorUp size={20} />}
            </button>
          </Tooltip>
        </span>

        <span className="dock-mobile-only">
          <Tooltip label="Na sala">
            <button type="button" className={`dock-btn ${usersOpen ? 'active' : ''}`} onClick={onToggleUsers}>
              <Users size={20} />
            </button>
          </Tooltip>
        </span>

        <span className="dock-mobile-only">
          <Tooltip label="Chat">
            <button type="button" className={`dock-btn ${chatOpen ? 'active' : ''}`} onClick={onToggleChat}>
              <MessageCircle size={20} />
            </button>
          </Tooltip>
        </span>

        <Tooltip label="Jogar online">
          <button type="button" className="dock-btn" onClick={() => setGamesOpen(true)}>
            <Gamepad2 size={20} />
          </button>
        </Tooltip>

        {isHost && (
          <Tooltip
            label={
              isPermanentRoom
                ? 'Sala permanente — sempre pública'
                : isPublic
                ? 'Tornar sala privada'
                : 'Tornar sala pública'
            }
          >
            <button
              type="button"
              className={`dock-btn ${isPublic ? 'active' : ''}`}
              onClick={onTogglePublic}
              disabled={isPermanentRoom}
            >
              {isPublic ? <Globe size={20} /> : <Lock size={20} />}
            </button>
          </Tooltip>
        )}

        <span className="dock-desktop-only">
          <Tooltip label="Convidar alguém">
            <button type="button" className="dock-btn" onClick={() => setInviteOpen(true)}>
              <Share2 size={20} />
            </button>
          </Tooltip>
        </span>
      </div>

      {inviteOpen && (
        <InviteModal roomCode={roomCode} onClose={() => setInviteOpen(false)} />
      )}
      {gamesOpen && (
        <GamesModal nickname={nickname} onInvite={onInviteGame} onClose={() => setGamesOpen(false)} />
      )}
    </>
  );
}
