import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { saveSession, loadSession } from '../lib/storage.js';
import { isDesktop, DESKTOP_DOWNLOAD_URL } from '../lib/platform.js';

export default function Home({ onJoin, invite }) {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');

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

  const invitedBy = invite?.from?.trim();

  return (
    <div className="home">
      <form className="home-card" onSubmit={submit}>
        <h1>GustaShare</h1>
        {invite?.roomCode ? (
          <p className="invite-banner">
            {invitedBy ? (
              <>
                <strong>{invitedBy}</strong> te convidou para a sala <strong>{invite.roomCode}</strong>
              </>
            ) : (
              <>
                Você foi convidado para a sala <strong>{invite.roomCode}</strong>
              </>
            )}
          </p>
        ) : null}
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
          readOnly={Boolean(invite?.roomCode)}
        />
        <button type="submit">Entrar</button>
        <p className="hint">
          {invite?.roomCode
            ? 'Entre com um nickname para assistir e usar o chat.'
            : 'Se a sala não existir, ela é criada na hora.'}
        </p>
        {!isDesktop && (
          <a className="home-download" href={DESKTOP_DOWNLOAD_URL}>
            <Download size={14} />
            Baixar versão para Windows
          </a>
        )}
      </form>
    </div>
  );
}
