import React, { useEffect, useState } from 'react';
import Home from './components/Home.jsx';
import RoomView from './components/RoomView.jsx';
import UpdateOverlay from './components/UpdateOverlay.jsx';
import { saveSession, loadSession } from './lib/storage.js';
import { parseInviteFromUrl, setRoomUrl } from './lib/platform.js';

function sessionFromUrl() {
  const invite = parseInviteFromUrl();
  const saved = loadSession();
  const nickname = saved.nickname.trim();
  if (!invite?.roomCode || !nickname) return null;
  saveSession(nickname, invite.roomCode);
  return { nickname, roomCode: invite.roomCode };
}

export default function App() {
  const [session, setSession] = useState(sessionFromUrl);
  const [invite] = useState(() => parseInviteFromUrl());

  useEffect(() => {
    if (!window.gustashare?.onDeepLink) return undefined;
    return window.gustashare.onDeepLink(({ roomCode, nickname }) => {
      if (!roomCode) return;
      const nick = nickname || 'Convidado';
      saveSession(nick, roomCode);
      setSession({ nickname: nick, roomCode });
    });
  }, []);

  useEffect(() => {
    if (session?.roomCode) setRoomUrl(session.roomCode);
  }, [session]);

  return (
    <>
      <UpdateOverlay />
      {!session ? (
        <Home
          invite={invite}
          onJoin={(nickname, roomCode) => setSession({ nickname, roomCode })}
        />
      ) : (
        <RoomView
          key={`${session.nickname}:${session.roomCode}`}
          nickname={session.nickname}
          roomCode={session.roomCode}
        />
      )}
    </>
  );
}
