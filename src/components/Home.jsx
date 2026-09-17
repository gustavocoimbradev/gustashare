import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { saveSession, loadSession } from '../lib/storage.js';
import { isDesktop, DESKTOP_DOWNLOAD_URL } from '../lib/platform.js';
import TitleBar from './TitleBar.jsx';

export default function Home({ onJoin, invite }) {
  const saved = loadSession();
  const [nickname, setNickname] = useState(saved.nickname);
  const [roomCode, setRoomCode] = useState(invite?.roomCode || saved.roomCode || '');

  useEffect(() => {
    window.gustashare?.setWindowMode('home');
    const saved = loadSession();
    if (saved.nickname) setNickname(saved.nickname);
    if (invite?.roomCode) {
      setRoomCode(invite.roomCode);
    } else if (saved.roomCode) {
      setRoomCode(saved.roomCode);
    }
  }, [invite]);

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
      {isDesktop && <TitleBar canMaximize={false} />}
      <div className="home-main">
        <form className="home-card" onSubmit={submit}>
        <h1>GustaShare</h1>
        {invite?.roomCode ? (
          <p className="invite-banner">
            Você foi convidado para a sala <strong>{invite.roomCode}</strong>
          </p>
        ) : null}
        <input
          placeholder="Seu nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={24}
          autoFocus
        />
        {!invite?.roomCode && (
          <input
            placeholder="Código da sala"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            maxLength={24}
          />
        )}
        <button type="submit">Entrar</button>
        {!isDesktop && (
          <a className="home-download" href={DESKTOP_DOWNLOAD_URL}>
            <Download size={14} />
            Baixar versão desktop
          </a>
        )}
        </form>
      </div>
    </div>
  );
}
