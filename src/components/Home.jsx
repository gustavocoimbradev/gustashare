import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { saveSession, loadSession } from '../lib/storage.js';
import { PublicRoomsRegistry } from '../lib/RoomClient.js';
import { isDesktop, DESKTOP_DOWNLOAD_URL } from '../lib/platform.js';
import TitleBar from './TitleBar.jsx';

export default function Home({ onJoin, invite }) {
  const saved = loadSession();
  const [nickname, setNickname] = useState(saved.nickname);
  const [roomCode, setRoomCode] = useState(invite?.roomCode || saved.roomCode || '');
  const [publicRooms, setPublicRooms] = useState([]);
  const [joinDialog, setJoinDialog] = useState(null);
  const [dialogNickname, setDialogNickname] = useState('');

  useEffect(() => {
    window.gustashare?.setWindowMode('home');
    const saved = loadSession();
    if (saved.nickname) setNickname(saved.nickname);
    if (invite?.roomCode) {
      setRoomCode(invite.roomCode);
    } else if (saved.roomCode) {
      setRoomCode(saved.roomCode);
    }

    PublicRoomsRegistry.cleanup();
    const rooms = Object.values(PublicRoomsRegistry.getAll());
    setPublicRooms(rooms.sort((a, b) => b.createdAt - a.createdAt));
  }, [invite]);

  function submit(e) {
    e.preventDefault();
    const nick = nickname.trim();
    const code = roomCode.trim();
    if (!nick || !code) return;
    saveSession(nick, code);
    onJoin(nick, code);
  }

  function joinPublicRoom(room) {
    const nick = nickname.trim();
    if (!nick) {
      setDialogNickname('');
      setJoinDialog(room);
      return;
    }
    saveSession(nick, room.roomCode);
    onJoin(nick, room.roomCode);
  }

  function confirmJoinWithNickname() {
    const nick = dialogNickname.trim();
    if (!nick) return;
    setJoinDialog(null);
    saveSession(nick, joinDialog.roomCode);
    onJoin(nick, joinDialog.roomCode);
  }

  return (
    <div className="home">
      {isDesktop && <TitleBar canMaximize={false} />}
      <div className="home-main">
        <div className={`home-box ${publicRooms.length > 0 ? 'with-rooms' : ''}`}>
          <div className="home-card">
            <form onSubmit={submit}>
              <div className="home-hero">
                <h1>GustaShare</h1>
                <p className="home-slogan">Compartilhe sua tela gratuitamente</p>
                {invite?.roomCode ? (
                  <p className="invite-banner">
                    Você foi convidado para a sala <strong>{invite.roomCode}</strong>
                  </p>
                ) : null}
              </div>
              <div className="home-fields">
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
              </div>
              <div className="home-actions">
                <button type="submit">Entrar</button>
                {!isDesktop && (
                  <a className="home-download" href={DESKTOP_DOWNLOAD_URL}>
                    <Download size={14} />
                    Baixar versão desktop
                  </a>
                )}
              </div>
            </form>
          </div>

          {publicRooms.length > 0 && (
            <div className="home-public-rooms">
              <h3>Salas Públicas</h3>
              <div className="public-rooms-list">
                {publicRooms.map((room) => (
                  <button
                    key={room.roomCode}
                    type="button"
                    className="public-room-card"
                    onClick={() => joinPublicRoom(room)}
                  >
                    <div className="room-info">
                      <div className="room-name">{room.roomCode}</div>
                      <div className="room-host">{room.hostName || 'Host desconhecido'}</div>
                    </div>
                    <div className="room-count">{room.participantCount} {room.participantCount === 1 ? 'pessoa' : 'pessoas'}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {joinDialog && (
        <div className="picker-backdrop" onClick={() => setJoinDialog(null)}>
          <div className="invite-box" onClick={(e) => e.stopPropagation()}>
            <h2>Qual é seu nickname?</h2>
            <p className="invite-hint">Digite um nome para entrar na sala</p>
            <input
              type="text"
              placeholder="Seu nickname"
              value={dialogNickname}
              onChange={(e) => setDialogNickname(e.target.value)}
              maxLength={24}
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && confirmJoinWithNickname()}
            />
            <button
              type="button"
              className="leave-confirm"
              onClick={confirmJoinWithNickname}
              disabled={!dialogNickname.trim()}
            >
              Entrar
            </button>
            <button type="button" className="leave-cancel" onClick={() => setJoinDialog(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
