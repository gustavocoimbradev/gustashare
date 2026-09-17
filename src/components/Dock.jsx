import React from 'react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorX } from 'lucide-react';
import Tooltip from './Tooltip.jsx';

export default function Dock({ micOn, camOn, screenOn, onToggleMic, onToggleCam, onToggleScreen }) {
  return (
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

      <Tooltip label={screenOn ? 'Parar compartilhamento' : 'Compartilhar tela'}>
        <button
          type="button"
          className={`dock-btn screen ${screenOn ? 'active' : ''}`}
          onClick={onToggleScreen}
        >
          {screenOn ? <MonitorX size={20} /> : <MonitorUp size={20} />}
        </button>
      </Tooltip>
    </div>
  );
}
