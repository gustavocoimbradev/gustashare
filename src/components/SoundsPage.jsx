import React, { useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import {
  playChatSound,
  playMicOnSound,
  playMicOffSound,
  playJoinSound,
  playLeaveSound,
  playMediaOnSound,
} from '../lib/sounds.js';
import { SOUND_DEFS, getSoundSetting, setSoundSetting, resetSoundSetting } from '../lib/soundSettings.js';

const PLAYERS = {
  chat: playChatSound,
  micOn: playMicOnSound,
  micOff: playMicOffSound,
  join: playJoinSound,
  leave: playLeaveSound,
  mediaOn: playMediaOnSound,
};

const TIER_LABEL = {
  1: 'Nível 1 — rotina',
  2: 'Nível 2 — alguém entrou/saiu',
  3: 'Nível 3 — algo importante mudou',
};

function SoundRow({ def }) {
  const [settings, setSettings] = useState(() => getSoundSetting(def.id));

  function update(patch) {
    setSettings(setSoundSetting(def.id, patch));
  }

  function reset() {
    setSettings(resetSoundSetting(def.id));
  }

  function play() {
    PLAYERS[def.id]?.();
  }

  return (
    <div className="sound-row">
      <div className="sound-row-head">
        <div>
          <div className="sound-row-title">{def.label}</div>
          <div className="sound-row-hint">{def.hint}</div>
        </div>
        <div className="sound-row-actions">
          <button type="button" className="sound-play-btn" onClick={play}>
            <Play size={14} />
            Tocar
          </button>
          <button type="button" className="sound-reset-btn" onClick={reset} aria-label="Restaurar padrão">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div className="sound-row-controls">
        <label className="sound-slider">
          <span>Volume — {Math.round(settings.volume * 100)}%</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={settings.volume}
            onChange={(e) => update({ volume: parseFloat(e.target.value) })}
          />
        </label>

        <label className="sound-slider">
          <span>Tom — {settings.pitch > 0 ? `+${settings.pitch}` : settings.pitch} semitons</span>
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={settings.pitch}
            onChange={(e) => update({ pitch: parseFloat(e.target.value) })}
          />
        </label>

        <label className="sound-slider">
          <span>Velocidade — {settings.speed.toFixed(2)}x</span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            value={settings.speed}
            onChange={(e) => update({ speed: parseFloat(e.target.value) })}
          />
        </label>
      </div>
    </div>
  );
}

export default function SoundsPage({ onBack }) {
  const tiers = [1, 2, 3];

  return (
    <div className="sounds-page">
      <div className="sounds-page-header">
        <div>
          <h1>Efeitos sonoros</h1>
          <p>Ouça cada som usado no app e ajuste volume/tom/velocidade — a mudança vale pra sala de verdade também.</p>
        </div>
        <button type="button" className="sounds-back-btn" onClick={onBack}>
          Voltar
        </button>
      </div>

      {tiers.map((tier) => (
        <div key={tier} className="sound-tier">
          <h2>{TIER_LABEL[tier]}</h2>
          {SOUND_DEFS.filter((d) => d.tier === tier).map((def) => (
            <SoundRow key={def.id} def={def} />
          ))}
        </div>
      ))}
    </div>
  );
}
