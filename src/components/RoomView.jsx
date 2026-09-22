import React, { useEffect, useRef, useState, useCallback } from 'react';
import RoomClient from '../lib/RoomClient.js';
import Tile from './Tile.jsx';
import Chat from './Chat.jsx';
import ScreenPickerModal from './ScreenPickerModal.jsx';
import WindowAudioNotice from './WindowAudioNotice.jsx';
import DesktopPromoBanner from './DesktopPromoBanner.jsx';
import ParticipantsSidebar from './ParticipantsSidebar.jsx';
import Dock from './Dock.jsx';
import { LogOut, AlertTriangle, X as CloseIcon } from 'lucide-react';
import TitleBar from './TitleBar.jsx';
import { playJoinSound, playLeaveSound, playChatSound, playMediaOnSound, playMicOnSound, playMicOffSound } from '../lib/sounds.js';
import { captureWindowNative } from '../lib/nativeCapture.js';
import { SCREEN_DISPLAY_MEDIA } from '../lib/webrtc.js';
import { isDesktop } from '../lib/platform.js';
import { isPermanentRoomName } from '../lib/permanentRooms.js';
import { watchRoomAndAnnounceJoin } from '../lib/pushNotifications.js';
import { notifyLocalChat } from '../lib/localNotifications.js';

const STREAM_WARNING_LABEL = {
  screen: (nick) => `${nick} não está conseguindo ver sua tela.`,
  cam: (nick) => `${nick} não está conseguindo ver sua câmera.`,
  mic: (nick) => `${nick} não está conseguindo ouvir seu áudio.`,
};

export default function RoomView({ nickname, roomCode, onLeave, onSwitchRoom }) {
  const isPermanentRoom = isPermanentRoomName(roomCode);
  const clientRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [selfId, setSelfId] = useState(null);
  const [roster, setRoster] = useState([]);
  const [streams, setStreams] = useState({}); // peerId -> {screen, cam, mic}
  const [selfStreams, setSelfStreams] = useState({ screen: null, cam: null, mic: null });
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [hostId, setHostId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [screenSources, setScreenSources] = useState(null);
  const [showWindowAudioNotice, setShowWindowAudioNotice] = useState(false);
  const [showDesktopPromo, setShowDesktopPromo] = useState(!isDesktop);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(null);
  const [streamWarnings, setStreamWarnings] = useState({}); // `${peerId}:${type}` -> { peerId, type }
  const [focusedId, setFocusedId] = useState(null);
  const nativeCaptureRef = useRef(null);

  useEffect(() => {
    window.gustashare?.setWindowMode('room');
  }, []);

  useEffect(() => {
    const client = new RoomClient(nickname, roomCode);
    clientRef.current = client;

    const onRoster = (e) => setRoster(e.detail);
    const onStream = (e) => {
      const { peerId, type, stream } = e.detail;
      setStreams((prev) => ({ ...prev, [peerId]: { ...prev[peerId], [type]: stream } }));
      if (type === 'screen' || type === 'cam') playMediaOnSound();
      else if (type === 'mic') playMicOnSound();
    };
    const onStreamRemoved = (e) => {
      const { peerId, type } = e.detail;
      if (type === 'mic') playMicOffSound();
      setStreams((prev) => {
        const entry = { ...(prev[peerId] || {}) };
        delete entry[type];
        return { ...prev, [peerId]: entry };
      });
    };
    const onPeerJoined = (e) => {
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
    };
    const onPeerLeft = (e) => {
      playLeaveSound();
      const member = typeof e.detail === 'object' && e.detail ? e.detail : { id: e.detail };
      const peerId = member.id;
      setStreams((prev) => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
      setRoster((prev) => prev.filter((m) => m.id !== peerId));
      setStreamWarnings((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (key.startsWith(`${peerId}:`)) delete next[key];
        }
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
    };
    const onSelfStream = (e) => {
      const { type, stream } = e.detail;
      setSelfStreams((prev) => ({ ...prev, [type]: stream }));
    };
    const onChat = (e) => {
      setMessages((prev) => [...prev, e.detail]);
      if (e.detail.id !== client.peer?.id) {
        playChatSound();
        notifyLocalChat(e.detail.nickname, e.detail.text);
      }
    };
    const onStreamFailed = (e) => {
      const { peerId, type } = e.detail;
      setStreamWarnings((prev) => ({ ...prev, [`${peerId}:${type}`]: { peerId, type } }));
    };
    const onStreamRecovered = (e) => {
      const { peerId, type } = e.detail;
      setStreamWarnings((prev) => {
        const key = `${peerId}:${type}`;
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };

    client.addEventListener('roster', onRoster);
    client.addEventListener('stream', onStream);
    client.addEventListener('stream-removed', onStreamRemoved);
    client.addEventListener('peer-joined', onPeerJoined);
    client.addEventListener('peer-left', onPeerLeft);
    client.addEventListener('self-stream', onSelfStream);
    client.addEventListener('chat', onChat);
    client.addEventListener('stream-failed', onStreamFailed);
    client.addEventListener('stream-recovered', onStreamRecovered);

    const onPublicToggle = (e) => setIsPublic(e.detail);
    client.addEventListener('public-toggle', onPublicToggle);

    const onHostInfo = (e) => setHostId(e.detail);
    client.addEventListener('host-info', onHostInfo);

    // `ready` só vira true quando o roster de verdade (host + demais
    // membros) chega — não basta o nosso próprio peer ter conectado no
    // broker de sinalização. Sem isso a sala aparecia "pronta" cedo demais
    // e a pessoa se via sozinha por alguns segundos até o roster real
    // chegar (ver `room-ready` em RoomClient).
    const onRoomReady = () => setReady(true);
    client.addEventListener('room-ready', onRoomReady);

    client.start().then(() => {
      setSelfId(client.peer.id);
      setIsHost(client.isHost);
      watchRoomAndAnnounceJoin(roomCode, nickname);
    });

    return () => {
      nativeCaptureRef.current?.stop();
      nativeCaptureRef.current = null;
      client.removeEventListener('roster', onRoster);
      client.removeEventListener('stream', onStream);
      client.removeEventListener('stream-removed', onStreamRemoved);
      client.removeEventListener('peer-joined', onPeerJoined);
      client.removeEventListener('peer-left', onPeerLeft);
      client.removeEventListener('self-stream', onSelfStream);
      client.removeEventListener('chat', onChat);
      client.removeEventListener('stream-failed', onStreamFailed);
      client.removeEventListener('stream-recovered', onStreamRecovered);
      client.removeEventListener('public-toggle', onPublicToggle);
      client.removeEventListener('host-info', onHostInfo);
      client.removeEventListener('room-ready', onRoomReady);
      client.leave();
    };
  }, [nickname, roomCode]);

  // Trava de segurança: se por algum motivo (broker fora do ar, host
  // inalcançável, rede bloqueando WebSocket) a sala nunca ficar pronta,
  // não deixa a pessoa presa no spinner pra sempre — avisa que algo deu
  // errado depois de 30s em vez de girar infinitamente.
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => {
    if (ready) {
      setLoadTimedOut(false);
      return undefined;
    }
    const timer = setTimeout(() => setLoadTimedOut(true), 30000);
    return () => clearTimeout(timer);
  }, [ready, nickname, roomCode]);

  useEffect(() => {
    if (!focusedId) return;
    const s = focusedId === selfId ? selfStreams : streams[focusedId];
    if (!s?.screen && !s?.cam) setFocusedId(null);
  }, [focusedId, selfId, streams, selfStreams]);

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

    // Desktop: o `useSystemPicker` do Electron só existe no macOS — no
    // Windows ele nunca aparece, e sem escolha o handler do main process
    // cai direto pra "primeira fonte" (tela inteira) sem perguntar nada.
    // Por isso no desktop SEMPRE mostramos nosso próprio picker antes de
    // chamar getDisplayMedia, em vez de deixar o Electron decidir.
    if (isDesktop) {
      try {
        const sources = await window.gustashare.listScreenSources();
        if (sources?.length) {
          setScreenSources(sources);
          return;
        }
      } catch (err) {
        console.error('Falha ao listar fontes de captura:', err);
      }
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(SCREEN_DISPLAY_MEDIA);
      await startShareFromDisplayMedia(stream);
    } catch (err) {
      if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') return;
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

    // Web pura: sem módulo nativo pra cobrir isso, compartilhar uma janela
    // específica nunca vem com áudio (limitação do Chromium, não nossa) —
    // avisa e oferece a versão desktop, que resolve isso.
    if (!isDesktop && settings.displaySurface === 'window' && stream.getAudioTracks().length === 0) {
      setShowWindowAudioNotice(true);
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

    // Sem captura nativa, o Chromium rejeita o pedido inteiro se pedirmos
    // audio:true numa fonte tipo "window" (não sabe entregar áudio isolado
    // de janela) — falhava calado aqui. Só telas suportam áudio nesse
    // caminho de fallback.
    const fallbackChoice = choice.isScreen ? choice : { ...choice, shareAudio: false };

    window.gustashare.setScreenPickerChoice(fallbackChoice);
    try {
      await clientRef.current.setScreen(true, fallbackChoice);
      setScreenOn(true);
    } catch {
      // usuário cancelou no diálogo nativo, ou a captura falhou
    }
  }

  function cancelScreenSource() {
    setScreenSources(null);
  }

  function togglePublic() {
    clientRef.current.setPublic(!isPublic);
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

  function dismissStreamWarning(key) {
    setStreamWarnings((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
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
      {showWindowAudioNotice && <WindowAudioNotice onClose={() => setShowWindowAudioNotice(false)} />}
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
      {showDesktopPromo && <DesktopPromoBanner onClose={() => setShowDesktopPromo(false)} />}
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
            {loadTimedOut ? (
              <>
                <AlertTriangle size={30} />
                <h2>Não foi possível entrar na sala</h2>
                <p className="connecting-hint">
                  Algo deu errado ao conectar — pode ser sua internet ou instabilidade no servidor de sinalização.
                </p>
                <button type="button" className="connecting-retry" onClick={() => window.location.reload()}>
                  Tentar de novo
                </button>
              </>
            ) : (
              <>
                <div className="connecting-spinner" />
                <h2>Acessando a sala</h2>
              </>
            )}
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
          hostId={hostId}
          currentRoomCode={roomCode}
          onSwitchRoom={onSwitchRoom}
        />

        <div className="grid-wrap">
          {Object.keys(streamWarnings).length > 0 && (
            <div className="stream-warnings">
              {Object.entries(streamWarnings).map(([key, w]) => {
                const member = roster.find((m) => m.id === w.peerId);
                const label = STREAM_WARNING_LABEL[w.type];
                return (
                  <div key={key} className="stream-warning">
                    <AlertTriangle size={16} />
                    <span>{label ? label(member?.nickname || 'Alguém') : 'Algo deu errado com sua transmissão pra alguém na sala.'}</span>
                    <button type="button" onClick={() => dismissStreamWarning(key)} aria-label="Dispensar aviso">
                      <CloseIcon size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {focusedId ? (
            <div className="grid-focus-mode">
              <div className="grid-focus-main">
                {roster
                  .filter((m) => m.id === focusedId)
                  .map((m) => {
                    const isSelf = m.id === selfId;
                    const s = isSelf ? selfStreams : streams[m.id] || {};
                    return (
                      <Tile
                        key={m.id}
                        userId={m.id}
                        nickname={m.nickname}
                        isSelf={isSelf}
                        isHost={m.id === hostId}
                        platform={m.platform}
                        screenStream={s.screen}
                        camStream={s.cam}
                        micStream={s.mic}
                        focused
                        onStopWatching={() => setFocusedId(null)}
                      />
                    );
                  })}
              </div>
              <div className="grid-focus-strip">
                {roster
                  .filter((m) => m.id !== focusedId)
                  .map((m) => {
                    const isSelf = m.id === selfId;
                    const s = isSelf ? selfStreams : streams[m.id] || {};
                    return (
                      <Tile
                        key={m.id}
                        userId={m.id}
                        nickname={m.nickname}
                        isSelf={isSelf}
                        isHost={m.id === hostId}
                        platform={m.platform}
                        screenStream={s.screen}
                        camStream={s.cam}
                        micStream={s.mic}
                        onFocus={() => setFocusedId(m.id)}
                      />
                    );
                  })}
              </div>
            </div>
          ) : (
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
                    isHost={m.id === hostId}
                    platform={m.platform}
                    screenStream={s.screen}
                    camStream={s.cam}
                    micStream={s.mic}
                    onFocus={() => setFocusedId(m.id)}
                  />
                );
              })}
            </div>
          )}

          <Dock
            isPermanentRoom={isPermanentRoom}
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
            isHost={isHost}
            isPublic={isPublic}
            onTogglePublic={togglePublic}
          />
        </div>

        <Chat
          className={mobilePanel === 'chat' ? 'open' : ''}
          onClose={() => setMobilePanel(null)}
          messages={messages}
          onSend={sendChat}
          selfId={selfId}
          roster={roster}
          hostId={hostId}
        />
      </div>
    </div>
  );
}
