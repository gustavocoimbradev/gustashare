import React, { useEffect, useState } from 'react';
import Home from './components/Home.jsx';
import RoomView from './components/RoomView.jsx';
import SoundsPage from './components/SoundsPage.jsx';
import UpdateOverlay from './components/UpdateOverlay.jsx';
import AlreadyOpenScreen from './components/AlreadyOpenScreen.jsx';
import { saveSession, loadSession } from './lib/storage.js';
import { parseInviteFromUrl, setRoomUrl, clearRoomUrl, isDesktop } from './lib/platform.js';
import { seoHome, seoRoom } from './lib/seo.js';
import { useSingleInstance } from './lib/singleInstance.js';

// Rota de debug pra ouvir/ajustar os efeitos sonoros (ver SoundsPage). Só
// existe no web — no desktop o Electron carrega direto de file://, sem
// barra de endereço pra digitar isso.
const isSoundsRoute = !isDesktop && typeof window !== 'undefined' && window.location.pathname === '/sounds';

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
  const [invite, setInvite] = useState(() => parseInviteFromUrl());
  // No desktop o Electron já bloqueia segunda instância no nível do SO
  // (app.requestSingleInstanceLock); aqui é só pra evitar duas abas do
  // navegador abertas ao mesmo tempo.
  const blocked = useSingleInstance(!isDesktop);

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
    if (session?.roomCode) {
      setRoomUrl(session.roomCode);
      seoRoom(session.roomCode);
      return;
    }
    if (invite?.roomCode) {
      seoRoom(invite.roomCode);
      return;
    }
    seoHome();
  }, [session, invite]);

  if (blocked) {
    return <AlreadyOpenScreen />;
  }

  if (isSoundsRoute) {
    return <SoundsPage onBack={() => window.location.assign('/')} />;
  }

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
          onLeave={() => {
            clearRoomUrl();
            setInvite(null);
            setSession(null);
          }}
          onSwitchRoom={(roomCode) => {
            saveSession(session.nickname, roomCode);
            setSession({ nickname: session.nickname, roomCode });
          }}
        />
      )}
    </>
  );
}
