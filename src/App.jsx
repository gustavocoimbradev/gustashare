import React, { useState } from 'react';
import Home from './components/Home.jsx';
import RoomView from './components/RoomView.jsx';

export default function App() {
  const [session, setSession] = useState(null); // { nickname, roomCode }

  if (!session) {
    return <Home onJoin={(nickname, roomCode) => setSession({ nickname, roomCode })} />;
  }

  return (
    <RoomView
      key={`${session.nickname}:${session.roomCode}`}
      nickname={session.nickname}
      roomCode={session.roomCode}
      onLeave={() => setSession(null)}
    />
  );
}
