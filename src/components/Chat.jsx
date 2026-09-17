import React, { useEffect, useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { userColorStyle } from '../lib/userColor.js';
import ClientBadge from './ClientBadge.jsx';
import { faviconUrl, openGame } from '../lib/games.js';

function GameInviteText({ game }) {
  const [iconFailed, setIconFailed] = useState(false);
  const name = game?.name || 'um jogo';

  function onGameClick(e) {
    e.preventDefault();
    openGame(game.url);
  }

  return (
    <span className="chat-text">
      convidou vocês para jogar{' '}
      <a className="chat-game-link" href={game.url} target="_blank" rel="noopener noreferrer" onClick={onGameClick}>
        {!iconFailed && game?.domain ? (
          <img
            className="chat-game-icon"
            src={faviconUrl(game.domain)}
            alt=""
            width={14}
            height={14}
            onError={() => setIconFailed(true)}
          />
        ) : null}
        {name}
      </a>
    </span>
  );
}

export default function Chat({ messages, onSend, selfId, roster }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  function submit(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
  }

  return (
    <div className="chat">
      <div className="chat-title">Chat</div>
      <div className="chat-messages" ref={listRef}>
        {messages.map((m, i) => {
          const isGame = Boolean(m.game?.url);
          const grouped = !isGame && i > 0 && messages[i - 1].id === m.id && !messages[i - 1].game;
          const platform = m.platform || roster?.find((p) => p.id === m.id)?.platform;
          return (
            <div
              key={i}
              className={`chat-message ${m.id === selfId ? 'own' : ''} ${grouped ? 'grouped' : ''}`}
              style={userColorStyle(m.id)}
            >
              {!grouped && (
                <span className="chat-author">
                  {m.nickname}
                  <ClientBadge platform={platform} />
                </span>
              )}
              {isGame ? (
                <GameInviteText game={m.game} />
              ) : (
                <span className="chat-text">{m.text}</span>
              )}
            </div>
          );
        })}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input
          placeholder="Mensagem..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
        <button type="submit" className="chat-send" aria-label="Enviar">
          <SendHorizontal size={16} />
        </button>
      </form>
    </div>
  );
}
