import React, { useEffect, useRef, useState, useCallback } from 'react';
import RoomClient from '../lib/RoomClient.js';
import Tile from './Tile.jsx';
import Chat from './Chat.jsx';
import ScreenPickerModal from './ScreenPickerModal.jsx';
import ParticipantsSidebar from './ParticipantsSidebar.jsx';
import Dock from './Dock.jsx';
import { LogOut } from 'lucide-react';
import TitleBar from './TitleBar.jsx';
import { playJoinSound, playLeaveSound, playChatSound, playMediaOnSound, playMicOnSound, playMicOffSound } from '../lib/sounds.js';
import { captureWindowNative } from '../lib/nativeCapture.js';
import { SCREEN_DISPLAY_MEDIA } from '../lib/webrtc.js';
import { isDesktop } from '../lib/platform.js';

export default function RoomView({ nickname, roomCode, onLeave }) {
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
  const [screenSources, setScreenSources] = useState(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(null);
  const nativeCaptureRef = useRef(null);

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
      if (type === 'screen' || type === 'cam') playMediaOnSound();
      else if (type === 'mic') playMicOnSound();
    });

    client.addEventListener('stream-removed', (e) => {
      const { peerId, type } = e.detail;
      if (type === 'mic') playMicOffSound();
      setStreams((prev) => {
        const entry = { ...(prev[peerId] || {}) };
        delete entry[type];
        return { ...prev, [peerId]: entry };
      });
    });

    client.addEventListener('peer-joined', (e) => {
      playJoinSound();
      const member = e.detail;
      if (!member?.id || member.id === client.peer?.id) return;
      setMessages((prev) => [
        ...prev,
        {
          id: member.id,
          nickname: member.nickname,
          platform: member.platform,
          event: 'join',
          ts: Date.now(),
        },
      ]);
    });

    client.addEventListener('peer-left', (e) => {
      playLeaveSound();
      const member = typeof e.detail === 'object' && e.detail ? e.detail : { id: e.detail };
      const peerId = member.id;
      setStreams((prev) => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
      if (!peerId || peerId === client.peer?.id) return;
      setMessages((prev) => [
        ...prev,
        {
          id: peerId,
          nickname: member.nickname,
          platform: member.platform,
          event: 'leave',
          ts: Date.now(),
        },
      ]);
    });

    client.addEventListener('self-stream', (e) => {
      const { type, stream } = e.detail;
      setSelfStreams((prev) => ({ ...prev, [type]: stream }));
    });

    client.addEventListener('chat', (e) => {
      setMessages((prev) => [...prev, e.detail]);
      if (e.detail.id !== client.peer?.id) {
        playChatSound();
      }
    });

    client.start().then(() => {
      setSelfId(client.peer.id);
      setReady(true);
    });

    return () => {
      nativeCaptureRef.current?.stop();
      nativeCaptureRef.current = null;
      client.leave();
    };
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
    } catch {
      setCamOn(!next);
    }
  }, [camOn]);

  const toggleScreen = useCallback(async () => {
    if (screenOn) {
      nativeCaptureRef.current?.stop();
      nativeCaptureRef.current = null;
      await clientRef.current.setScreen(false);
      setScreenOn(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(SCREEN_DISPLAY_MEDIA);
      await startShareFromDisplayMedia(stream);
    } catch (err) {
      if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') return;
      const sources = await window.gustashare?.listScreenSources?.();
      if (sources?.length) setScreenSources(sources);
    }
  }, [screenOn]);

  async function startShareFromDisplayMedia(stream) {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const settings = videoTrack.getSettings?.() || {};
    const looksLikeWindow = settings.displaySurface === 'window' || settings.displaySurface !== 'monitor';

    if (looksLikeWindow && window.gustashare) {
      const available = await window.gustashare.nativeCaptureAvailable?.().catch(() => false);
      if (available) {
        const info = await window.gustashare.findCaptureSource?.(videoTrack.label).catch(() => null);
        if (info?.hwnd) {
          try {
            const capture = await captureWindowNative({
              hwnd: info.hwnd,
              wantsAudio: true,
              video: false,
            });
            const nativeAudio = capture.stream.getAudioTracks();
            if (nativeAudio.length) {
              stream.getAudioTracks().forEach((t) => t.stop());
            }
            nativeCaptureRef.current = {
              stop() {
                capture.stop();
              },
            };
            const mixed = new MediaStream([...stream.getVideoTracks(), ...(nativeAudio.length ? nativeAudio : stream.getAudioTracks())]);
            videoTrack.addEventListener('ended', () => {
              nativeCaptureRef.current?.stop();
              nativeCaptureRef.current = null;
              clientRef.current?.setScreen(false);
              setScreenOn(false);
            });
            clientRef.current.setScreenFromStream(mixed);
            setScreenOn(true);
            return;
          } catch (err) {
            console.error('Áudio nativo falhou, usando o stream do picker:', err);
          }
        }
      }
    }

    videoTrack.addEventListener('ended', () => {
      nativeCaptureRef.current?.stop();
      nativeCaptureRef.current = null;
      clientRef.current?.setScreen(false);
      setScreenOn(false);
    });
    clientRef.current.setScreenFromStream(stream);
    setScreenOn(true);
  }

  async function confirmScreenSource(choice) {
    setScreenSources(null);

    // Janela específica: tenta o módulo de captura nativo primeiro (vídeo
    // sem tela preta + áudio isolado do processo, quando disponível).
    // Sem isso, cai pro caminho normal (getDisplayMedia), que pra janelas
    // funciona só o vídeo, sem áudio — limitação do Chromium.
    if (!choice.isScreen && choice.hwnd) {
      const available = await window.gustashare.nativeCaptureAvailable().catch(() => false);
      if (available) {
        try {
          const capture = await captureWindowNative({ hwnd: choice.hwnd, wantsAudio: choice.shareAudio });
          nativeCaptureRef.current = capture;
          clientRef.current.setScreenFromStream(capture.stream);
          setScreenOn(true);
          return;
        } catch (err) {
          console.error('Captura nativa falhou, caindo pro getDisplayMedia:', err);
        }
      }
    }

    window.gustashare.setScreenPickerChoice(choice);
    try {
      await clientRef.current.setScreen(true, choice);
      setScreenOn(true);
    } catch {
      // usuário cancelou no diálogo nativo, ou a captura falhou
    }
  }

  function cancelScreenSource() {
    setScreenSources(null);
  }

  function sendChat(text) {
    clientRef.current.sendChat(text);
  }

  function inviteGame(_nick, game) {
    clientRef.current.sendChat(`${nickname} convidou vocês para jogar ${game.name}`, {
      game: { name: game.name, url: game.url, domain: game.domain },
    });
  }

  function toggleMobilePanel(name) {
    setMobilePanel((current) => (current === name ? null : name));
  }

  function confirmLeave() {
    nativeCaptureRef.current?.stop();
    nativeCaptureRef.current = null;
    onLeave?.();
  }

  return (
    <div className="room">
      {screenSources && (
        <ScreenPickerModal
          sources={screenSources}
          onConfirm={confirmScreenSource}
          onCancel={cancelScreenSource}
        />
      )}
      {leaveOpen && (
        <div className="picker-backdrop" onClick={() => setLeaveOpen(false)}>
          <div className="invite-box leave-box" onClick={(e) => e.stopPropagation()}>
            <h2>Abandonar sala?</h2>
            <p className="invite-hint">Você está prestes a sair dessa sala. Tem certeza que quer fazer isso?</p>
            <button type="button" className="leave-confirm" onClick={confirmLeave}>
              <LogOut size={16} />
              Abandonar sala
            </button>
            <button type="button" className="leave-cancel" onClick={() => setLeaveOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isDesktop && <TitleBar />}
      <div className="topbar">
        <div className="brand">GustaShare</div>
        <button type="button" className="leave-btn" onClick={() => setLeaveOpen(true)}>
          <LogOut size={15} />
          <span className="leave-full">Abandonar sala</span>
          <span className="leave-short">Sair</span>
        </button>
      </div>

      {!ready && (
        <div className="connecting-overlay">
          <div className="connecting-box">
            <div className="connecting-spinner" />
            <h2>Acessando a sala</h2>
          </div>
        </div>
      )}

      <div className={`room-body ${mobilePanel ? `panel-${mobilePanel}` : ''}`}>
        <button
          type="button"
          className={`mobile-sheet-backdrop ${mobilePanel ? 'open' : ''}`}
          aria-label="Fechar painel"
          onClick={() => setMobilePanel(null)}
        />
        <ParticipantsSidebar
          className={mobilePanel === 'users' ? 'open' : ''}
          onClose={() => setMobilePanel(null)}
          roster={roster}
          selfId={selfId}
          streams={streams}
          selfStreams={selfStreams}
        />

        <div className="grid-wrap">
          <div className="grid">
            {roster.map((m) => {
              const isSelf = m.id === selfId;
              const s = isSelf ? selfStreams : streams[m.id] || {};
              return (
                <Tile
                  key={m.id}
                  userId={m.id}
                  nickname={m.nickname}
                  isSelf={isSelf}
                  platform={m.platform}
                  screenStream={s.screen}
                  camStream={s.cam}
                  micStream={s.mic}
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
            onInviteGame={inviteGame}
            usersOpen={mobilePanel === 'users'}
            chatOpen={mobilePanel === 'chat'}
            onToggleUsers={() => toggleMobilePanel('users')}
            onToggleChat={() => toggleMobilePanel('chat')}
          />
        </div>

        <Chat
          className={mobilePanel === 'chat' ? 'open' : ''}
          onClose={() => setMobilePanel(null)}
          messages={messages}
          onSend={sendChat}
          selfId={selfId}
          roster={roster}
        />
      </div>
    </div>
  );
}
