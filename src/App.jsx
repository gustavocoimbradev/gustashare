import React, { useState } from 'react';
import Home from './components/Home.jsx';
import RoomView from './components/RoomView.jsx';
import UpdateOverlay from './components/UpdateOverlay.jsx';

export default function App() {
  const [session, setSession] = useState(null); // { nickname, roomCode }

  return (
    <>
      <UpdateOverlay />
      {!session ? (
        <Home onJoin={(nickname, roomCode) => setSession({ nickname, roomCode })} />
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
