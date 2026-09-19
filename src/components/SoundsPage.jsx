import React from 'react';
import { Play } from 'lucide-react';
import {
  playChatSound,
  playMicOnSound,
  playMicOffSound,
  playJoinSound,
  playLeaveSound,
  playMediaOnSound,
} from '../lib/sounds.js';

const SOUND_DEFS = [
  { id: 'chat', label: 'Mensagem no chat', tier: 1, hint: 'Toca quando alguém manda uma mensagem', play: playChatSound },
  { id: 'micOn', label: 'Microfone ligado', tier: 1, hint: 'Toca quando alguém ativa o microfone', play: playMicOnSound },
  { id: 'micOff', label: 'Microfone desligado', tier: 1, hint: 'Toca quando alguém desativa o microfone', play: playMicOffSound },
  { id: 'join', label: 'Alguém entrou na sala', tier: 2, hint: 'Toca quando um novo participante chega', play: playJoinSound },
  { id: 'leave', label: 'Alguém saiu da sala', tier: 2, hint: 'Toca quando um participante sai', play: playLeaveSound },
  { id: 'mediaOn', label: 'Tela ou câmera ligada', tier: 3, hint: 'Toca quando alguém começa a compartilhar tela/câmera', play: playMediaOnSound },
];

const TIER_LABEL = {
  1: 'Nível 1 — rotina',
  2: 'Nível 2 — alguém entrou/saiu',
  3: 'Nível 3 — algo importante mudou',
};

export default function SoundsPage({ onBack }) {
  return (
    <div className="sounds-page">
      <div className="sounds-page-header">
        <div>
          <h1>Efeitos sonoros</h1>
          <p>Só pra ouvir cada som usado no app.</p>
        </div>
        <button type="button" className="sounds-back-btn" onClick={onBack}>
          Voltar
        </button>
      </div>

      {[1, 2, 3].map((tier) => (
        <div key={tier} className="sound-tier">
          <h2>{TIER_LABEL[tier]}</h2>
          {SOUND_DEFS.filter((d) => d.tier === tier).map((def) => (
            <div key={def.id} className="sound-row">
              <div>
                <div className="sound-row-title">{def.label}</div>
                <div className="sound-row-hint">{def.hint}</div>
              </div>
              <button type="button" className="sound-play-btn" onClick={def.play}>
                <Play size={14} />
                Tocar
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
