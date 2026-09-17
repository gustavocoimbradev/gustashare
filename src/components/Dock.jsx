import React, { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorX, Gamepad2, Share2 } from 'lucide-react';
import Tooltip from './Tooltip.jsx';
import InviteModal from './InviteModal.jsx';
import GamesModal from './GamesModal.jsx';
import DesktopOnlyDialog from './DesktopOnlyDialog.jsx';
import { isDesktop } from '../lib/platform.js';

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
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [desktopOnly, setDesktopOnly] = useState(null);

  function handleMic() {
    onToggleMic();
  }

  function handleCam() {
    if (!isDesktop) {
      setDesktopOnly('cam');
      return;
    }
    onToggleCam();
  }

  function handleScreen() {
    if (!isDesktop) {
      setDesktopOnly('screen');
      return;
    }
    onToggleScreen();
  }

  return (
    <>
      <div className="dock">
        <Tooltip label={micOn ? 'Desligar microfone' : 'Ligar microfone'}>
          <button type="button" className={`dock-btn ${micOn ? 'active' : ''}`} onClick={handleMic}>
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
        </Tooltip>

        <Tooltip label={camOn ? 'Desligar câmera' : 'Ligar câmera'}>
          <button type="button" className={`dock-btn ${camOn ? 'active' : ''}`} onClick={handleCam}>
            {camOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
        </Tooltip>

        <Tooltip label={screenOn ? 'Parar compartilhamento' : 'Compartilhar tela'}>
          <button
            type="button"
            className={`dock-btn screen ${screenOn ? 'active' : ''}`}
            onClick={handleScreen}
          >
            {screenOn ? <MonitorX size={20} /> : <MonitorUp size={20} />}
          </button>
        </Tooltip>

        <Tooltip label="Jogar online">
          <button type="button" className="dock-btn" onClick={() => setGamesOpen(true)}>
            <Gamepad2 size={20} />
          </button>
        </Tooltip>

        <Tooltip label="Convidar alguém">
          <button type="button" className="dock-btn" onClick={() => setInviteOpen(true)}>
            <Share2 size={20} />
          </button>
        </Tooltip>
      </div>

      {inviteOpen && (
        <InviteModal roomCode={roomCode} onClose={() => setInviteOpen(false)} />
      )}
      {gamesOpen && (
        <GamesModal nickname={nickname} onInvite={onInviteGame} onClose={() => setGamesOpen(false)} />
      )}
      {desktopOnly && (
        <DesktopOnlyDialog feature={desktopOnly} onClose={() => setDesktopOnly(null)} />
      )}
    </>
  );
}
