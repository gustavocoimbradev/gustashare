import React, { useEffect, useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';

export default function Chat({ messages, onSend, selfId }) {
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
          return (
            <div key={i} className={`chat-message ${m.id === selfId ? 'own' : ''} ${grouped ? 'grouped' : ''}`}>
              {!grouped && <span className="chat-author">{m.nickname}</span>}
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
