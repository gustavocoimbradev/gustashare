import React, { useEffect, useRef, useState, useCallback } from 'react';
import RoomClient from '../lib/RoomClient.js';
import Tile from './Tile.jsx';
import Chat from './Chat.jsx';
import ScreenPickerModal from './ScreenPickerModal.jsx';
import ParticipantsSidebar from './ParticipantsSidebar.jsx';
import Dock from './Dock.jsx';
import CameraPositionModal from './CameraPositionModal.jsx';
import { playJoinSound, playLeaveSound } from '../lib/sounds.js';

export default function RoomView({ nickname, roomCode }) {
  const clientRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [selfId, setSelfId] = useState(null);
  const [roster, setRoster] = useState([]);
  const [streams, setStreams] = useState({}); // peerId -> {screen, cam, mic}
  const [selfStreams, setSelfStreams] = useState({ screen: null, cam: null, mic: null });
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [messages, setMessages] = useState([]);
  const [cameraPositions, setCameraPositions] = useState({});
  const [positionPromptOpen, setPositionPromptOpen] = useState(false);

  useEffect(() => {
    window.gustashare?.setWindowMode('room');
  }, []);

  useEffect(() => {
    const client = new RoomClient(nickname, roomCode);
    clientRef.current = client;

    client.addEventListener('roster', (e) => setRoster(e.detail));

    client.addEventListener('stream', (e) => {
      const { peerId, type, stream } = e.detail;
      setStreams((prev) => ({ ...prev, [peerId]: { ...prev[peerId], [type]: stream } }));
    });

    client.addEventListener('stream-removed', (e) => {
      const { peerId, type } = e.detail;
      setStreams((prev) => {
        const entry = { ...(prev[peerId] || {}) };
        delete entry[type];
        return { ...prev, [peerId]: entry };
      });
    });

    client.addEventListener('peer-joined', () => {
      playJoinSound();
    });

    client.addEventListener('peer-left', (e) => {
      playLeaveSound();
      const peerId = e.detail;
      setStreams((prev) => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    });

    client.addEventListener('self-stream', (e) => {
      const { type, stream } = e.detail;
      setSelfStreams((prev) => ({ ...prev, [type]: stream }));
    });

    client.addEventListener('chat', (e) => {
      setMessages((prev) => [...prev, e.detail]);
    });

    client.addEventListener('camera-positions', (e) => {
      setCameraPositions(e.detail);
    });

    client.start().then(() => {
      setSelfId(client.peer.id);
      setReady(true);
    });

    return () => client.leave();
  }, [nickname, roomCode]);

  const toggleMic = useCallback(async () => {
    const next = !micOn;
    setMicOn(next);
    try {
      await clientRef.current.setMic(next);
    } catch {
      setMicOn(!next);
    }
  }, [micOn]);

  const toggleCam = useCallback(async () => {
    const next = !camOn;
    setCamOn(next);
    try {
      await clientRef.current.setCam(next);
      if (next && screenOn) setPositionPromptOpen(true);
    } catch {
      setCamOn(!next);
    }
  }, [camOn, screenOn]);

  const toggleScreen = useCallback(async () => {
    const next = !screenOn;
    if (!next) {
      await clientRef.current.setScreen(false);
      setScreenOn(false);
      return;
    }
    try {
      await clientRef.current.setScreen(true);
      setScreenOn(true);
      if (camOn) setPositionPromptOpen(true);
    } catch {
      // usuário cancelou o seletor de tela
    }
  }, [screenOn, camOn]);

  function selectCameraPosition(position) {
    clientRef.current.sendCameraPosition(position);
    setPositionPromptOpen(false);
  }

  function sendChat(text) {
    clientRef.current.sendChat(text);
  }

  return (
    <div className="room">
      <ScreenPickerModal />
      {positionPromptOpen && (
        <CameraPositionModal
          onSelect={selectCameraPosition}
          onClose={() => setPositionPromptOpen(false)}
        />
      )}

      <div className="topbar">
        <div className="room-code">
          Sala: <strong>{roomCode}</strong>
        </div>
      </div>

      {!ready && <div className="connecting">Conectando…</div>}

      <div className="room-body">
        <ParticipantsSidebar roster={roster} selfId={selfId} streams={streams} selfStreams={selfStreams} />

        <div className="grid-wrap">
          <div className="grid">
            {roster.map((m) => {
              const isSelf = m.id === selfId;
              const s = isSelf ? selfStreams : streams[m.id] || {};
              return (
                <Tile
                  key={m.id}
                  nickname={m.nickname}
                  isSelf={isSelf}
                  screenStream={s.screen}
                  camStream={s.cam}
                  micStream={s.mic}
                  cameraPosition={cameraPositions[m.id]}
                />
              );
            })}
          </div>

          <Dock
            micOn={micOn}
            camOn={camOn}
            screenOn={screenOn}
            onToggleMic={toggleMic}
            onToggleCam={toggleCam}
            onToggleScreen={toggleScreen}
            roomCode={roomCode}
            nickname={nickname}
          />
        </div>

        <Chat messages={messages} onSend={sendChat} selfId={selfId} />
      </div>
    </div>
  );
}
