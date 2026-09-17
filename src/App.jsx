import React, { useEffect, useState } from 'react';
import Home from './components/Home.jsx';
import RoomView from './components/RoomView.jsx';
import UpdateOverlay from './components/UpdateOverlay.jsx';
import { saveSession } from './lib/storage.js';
import { parseInviteFromUrl } from './lib/platform.js';

export default function App() {
  const [session, setSession] = useState(null); // { nickname, roomCode }
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
