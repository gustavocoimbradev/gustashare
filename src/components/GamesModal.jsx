import React, { useState } from 'react';
import { X } from 'lucide-react';

const GAMES = [
  { name: 'Gartic', url: 'https://gartic.io/', domain: 'gartic.io' },
  { name: 'StopotS', url: 'https://stopots.com/', domain: 'stopots.com' },
  { name: 'Codenames', url: 'https://codenames.game/', domain: 'codenames.game' },
  { name: 'Argumento', url: 'http://argumen.to/', domain: 'argumen.to' },
];

function faviconUrl(domain) {
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
}

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

function openGame(url) {
  if (window.gustashare?.openExternal) {
    window.gustashare.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function GamesModal({ onClose }) {
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
            <button
              key={game.url}
              type="button"
              className="games-item"
              onClick={() => {
                openGame(game.url);
                onClose();
              }}
            >
              <GameIcon domain={game.domain} name={game.name} />
              <span className="games-item-name">{game.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
