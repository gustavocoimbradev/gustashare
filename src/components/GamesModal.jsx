import React, { useState } from 'react';
import { X } from 'lucide-react';
import { GAMES, faviconUrl, openGame } from '../lib/games.js';

function GameIcon({ domain, name }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="games-fallback">{name.slice(0, 1)}</span>;
  }
  return (
    <img
      className="games-favicon"
      src={faviconUrl(domain)}
      alt=""
      width={20}
      height={20}
      onError={() => setFailed(true)}
    />
  );
}

export default function GamesModal({ nickname, onInvite, onClose }) {
  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="invite-box games-box" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>Jogar online</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="games-list">
          {GAMES.map((game) => (
            <div key={game.url} className="games-item">
              <GameIcon domain={game.domain} name={game.name} />
              <span className="games-item-name">{game.name}</span>
              <div className="games-item-actions">
                <button
                  type="button"
                  onClick={() => {
                    onInvite?.(nickname, game);
                    onClose();
                  }}
                >
                  Convidar galera
                </button>
                <button
                  type="button"
                  className="on"
                  onClick={() => {
                    openGame(game.url);
                    onClose();
                  }}
                >
                  Jogar agora
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
