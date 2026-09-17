import React, { useEffect, useState } from 'react';

const NICK_KEY = 'gustashare:nickname';
const ROOM_KEY = 'gustashare:roomCode';

export default function Home({ onJoin }) {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');

  useEffect(() => {
    window.gustashare?.setWindowMode('home');
    try {
      const savedNick = localStorage.getItem(NICK_KEY);
      const savedRoom = localStorage.getItem(ROOM_KEY);
      if (savedNick) setNickname(savedNick);
      if (savedRoom) setRoomCode(savedRoom);
    } catch {
      // localStorage indisponível — segue sem persistência
    }
  }, []);

  function submit(e) {
    e.preventDefault();
    const nick = nickname.trim();
    const code = roomCode.trim();
    if (!nick || !code) return;
    try {
      localStorage.setItem(NICK_KEY, nick);
      localStorage.setItem(ROOM_KEY, code);
    } catch {
      // localStorage indisponível — só não persiste
    }
    onJoin(nick, code);
  }

  return (
    <div className="home">
      <form className="home-card" onSubmit={submit}>
        <h1>GustaShare</h1>
        <input
          placeholder="Seu nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={24}
          autoFocus
        />
        <input
          placeholder="Código da sala"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          maxLength={24}
        />
        <button type="submit">Entrar</button>
        <p className="hint">Se a sala não existir, ela é criada na hora.</p>
      </form>
    </div>
  );
}
