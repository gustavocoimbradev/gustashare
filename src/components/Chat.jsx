import React, { useEffect, useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { userColorStyle } from '../lib/userColor.js';
import ClientBadge from './ClientBadge.jsx';

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
          const grouped = i > 0 && messages[i - 1].id === m.id;
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
              <span className="chat-text">{m.text}</span>
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
