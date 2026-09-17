import React, { useEffect, useState } from 'react';
import { saveSession, loadSession } from '../lib/storage.js';

export default function Home({ onJoin }) {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');

  useEffect(() => {
    window.gustashare?.setWindowMode('home');
    const saved = loadSession();
    if (saved.nickname) setNickname(saved.nickname);
    if (saved.roomCode) setRoomCode(saved.roomCode);
  }, []);

  function submit(e) {
    e.preventDefault();
    const nick = nickname.trim();
    const code = roomCode.trim();
    if (!nick || !code) return;
    saveSession(nick, code);
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
