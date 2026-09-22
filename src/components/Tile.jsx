import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, MonitorX, Volume1, Volume2, VolumeX, X } from 'lucide-react';
import useSpeaking from '../lib/useSpeaking.js';
import { userColor, userColorStyle } from '../lib/userColor.js';
import Tooltip from './Tooltip.jsx';
import ClientBadge from './ClientBadge.jsx';
import HostBadge from './HostBadge.jsx';
import MicBadge from './MicBadge.jsx';

const NET_QUALITY_LABEL = { 1: 'Internet fraca', 2: 'Internet mediana', 3: 'Internet boa' };

// Rotulado explicitamente (Ping/Buffer/FPS) em vez de só números soltos —
// bitrate e perda entram só quando disponíveis/relevantes, sem label fixo
// pra não empapuçar o pill à toa.
function formatNetStats(stats) {
  const parts = [
    `Ping: ${stats.rttMs != null ? `${stats.rttMs}ms` : '—'}`,
    `Buffer: ${stats.bufferMs != null ? `${stats.bufferMs}ms` : '—'}`,
    `FPS: ${stats.fps != null ? stats.fps : '—'}`,
  ];
  if (stats.bitrateKbps != null) parts.push(`${stats.bitrateKbps}kbps`);
  if (stats.lossPct) parts.push(`${stats.lossPct}% perda`);
  return parts.join(' · ');
}

// ----- Traço "olha isso aqui" (desenho efêmero sobre tela/câmera) -----
//
// Cada ponto guarda o instante em que foi desenhado; no loop de render a
// gente descarta os mais antigos (os primeiros do traço) assim que
// passam de DRAW_FADE_MS — como são sempre os do INÍCIO que vencem
// primeiro, o traço "recua" visualmente a partir da ponta onde a pessoa
// começou a desenhar, sumindo suavemente até não sobrar nada. Isso já
// cobre o "parou no meio e ainda tem que sumir" de graça: sem novos
// pontos chegando, todos os pontos existentes acabam vencendo um a um.
const DRAW_FADE_MS = 1100;
const DRAW_SEND_INTERVAL_MS = 35; // throttle de rede — o desenho local não é throttled
// Sutil de propósito: é só um "olha isso aqui", não pode competir com o
// conteúdo da tela por baixo. Cor por autor (não fixa) — cada um assina
// o próprio traço com a mesma cor do seu avatar.
const DRAW_MAX_ALPHA = 0.65;

// `object-fit: contain` deixa a área realmente ocupada pelo vídeo menor
// que a caixa do elemento quando a proporção não bate (comum em captura
// de tela) — sem isso o traço ficaria deslocado/esticado. `originRect`
// opcional subtrai um offset (pra converter de coordenada de viewport pra
// coordenada relativa ao stage, usado só no desenho no canvas).
function computeContentRect(video, originRect) {
  const videoRect = video.getBoundingClientRect();
  const boxW = videoRect.width;
  const boxH = videoRect.height;
  const ox = originRect ? originRect.left : 0;
  const oy = originRect ? originRect.top : 0;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || !boxW || !boxH) {
    return { left: videoRect.left - ox, top: videoRect.top - oy, width: boxW, height: boxH };
  }
  const scale = Math.min(boxW / vw, boxH / vh);
  const w = vw * scale;
  const h = vh * scale;
  return {
    left: videoRect.left - ox + (boxW - w) / 2,
    top: videoRect.top - oy + (boxH - h) / 2,
    width: w,
    height: h,
  };
}

function VolumeControl({ label, volume, silent, open, onToggleOpen, onChange, compact }) {
  const VolumeIcon = silent ? VolumeX : volume < 0.4 ? Volume1 : Volume2;
  const sliderValue = silent ? 0 : volume;
  return (
    <div className="tile-volume-wrap">
      <Tooltip label={label}>
        <button
          type="button"
          className={`tile-icon-btn ${compact ? 'tile-icon-btn-sm' : ''} ${silent ? 'muted' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleOpen();
          }}
          aria-label={label}
        >
          <VolumeIcon size={compact ? 12 : 15} />
        </button>
      </Tooltip>
      {open && (
        <div className="tile-volume-popup" onClick={(e) => e.stopPropagation()}>
          <input
            className="tile-volume tile-volume-vertical"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={sliderValue}
            style={{ '--fill': `${sliderValue * 100}%` }}
            onChange={onChange}
            aria-label={label}
          />
        </div>
      )}
    </div>
  );
}

export default function Tile({
  nickname,
  isSelf,
  isHost,
  userId,
  platform,
  screenStream,
  camStream,
  micStream,
  stats,
  pendingMedia,
  client,
  focused = false,
  onFocus,
  onStopWatching,
}) {
  const videoRef = useRef(null);
  const pipRef = useRef(null);
  const audioRef = useRef(null);
  const stageRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const strokesRef = useRef(new Map()); // `${authorId}:${strokeId}` -> { points: [{x,y,t}] }
  const drawRafRef = useRef(null);
  const pointerStartRef = useRef(null); // {x,y} em coords de cliente, pra distinguir clique de arraste
  const draggingRef = useRef(false);
  const justDraggedRef = useRef(false); // suprime o onClick de foco logo depois de um arraste
  const strokeIdRef = useRef(null);
  const lastDrawSentRef = useRef(0);
  const stopWatchOnExitRef = useRef(false); // Esc em fullscreen real: espera o fullscreenchange confirmar antes de desmontar
  const [micVolume, setMicVolume] = useState(1);
  const [micMuted, setMicMuted] = useState(false);
  const [streamVolume, setStreamVolume] = useState(1);
  const [streamMuted, setStreamMuted] = useState(false);
  const [micSliderOpen, setMicSliderOpen] = useState(false);
  const [streamSliderOpen, setStreamSliderOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [pipReady, setPipReady] = useState(false);
  const speaking = useSpeaking(micStream);

  const mainStream = screenStream || camStream;
  const activeMediaType = screenStream ? 'screen' : camStream ? 'cam' : null;
  const showPip = !!screenStream && !!camStream;
  const micSilent = micMuted || micVolume === 0;
  // Volume da transmissão é independente do mic: só toca quando o card está
  // focado (assistindo), e mesmo assim pode ser silenciada manualmente.
  const streamManualSilent = streamMuted || streamVolume === 0;
  const streamSilent = !focused || streamManualSilent;

  useEffect(() => {
    if (!hover) {
      setMicSliderOpen(false);
      setStreamSliderOpen(false);
    }
  }, [hover]);

  useEffect(() => {
    setVideoReady(false);
    const video = videoRef.current;
    if (!video) return undefined;
    video.srcObject = mainStream || null;
    if (!mainStream) return undefined;
    const onPlaying = () => setVideoReady(true);
    video.addEventListener('playing', onPlaying);
    video.play().catch(() => {});
    return () => video.removeEventListener('playing', onPlaying);
  }, [mainStream]);

  useEffect(() => {
    setPipReady(false);
    const video = pipRef.current;
    if (!video) return undefined;
    video.srcObject = showPip ? camStream : null;
    if (!showPip || !camStream) return undefined;
    const onPlaying = () => setPipReady(true);
    video.addEventListener('playing', onPlaying);
    video.play().catch(() => {});
    return () => video.removeEventListener('playing', onPlaying);
  }, [showPip, camStream]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = micStream || null;
    if (micStream) audio.play().catch(() => {});
  }, [micStream]);

  useEffect(() => {
    const level = micSilent ? 0 : micVolume;
    if (audioRef.current) {
      audioRef.current.muted = isSelf || micSilent;
      audioRef.current.volume = level;
    }
  }, [micVolume, micSilent, isSelf]);

  useEffect(() => {
    const level = streamSilent ? 0 : streamVolume;
    if (videoRef.current) {
      videoRef.current.muted = isSelf || streamSilent;
      videoRef.current.volume = level;
    }
  }, [streamVolume, streamSilent, isSelf]);

  useEffect(() => {
    function onFullscreenChange() {
      const node = document.fullscreenElement || document.webkitFullscreenElement;
      if (node && node !== stageRef.current) setExpanded(false);
      if (!node) {
        if (expanded) setExpanded(false);
        // Só desmonta o card (via onStopWatching) DEPOIS que o navegador
        // confirmou que saiu do fullscreen de verdade — chamar isso antes
        // (no mesmo tick do Esc) removia o elemento do DOM no meio da
        // transição e prendia a tela em fullscreen visualmente.
        if (stopWatchOnExitRef.current) {
          stopWatchOnExitRef.current = false;
          onStopWatching?.();
        }
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return undefined;
    function onKey(e) {
      if (e.key !== 'Escape') return;
      // Esc na tela expandida sai de vez (como o botão "Parar de assistir"),
      // não só volta pro modo spotlight — senão o usuário precisa de dois
      // gestos diferentes (Esc + clique) pra sair da tela de alguém.
      const inRealFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (inRealFullscreen) {
        stopWatchOnExitRef.current = true;
        document.exitFullscreen?.().catch(() => {});
        document.webkitExitFullscreen?.();
      } else {
        exitExpanded();
        onStopWatching?.();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // Traços de OUTRAS pessoas desenhando nessa mesma tela/câmera — os
  // nossos próprios já entram direto em `strokesRef` na hora do gesto
  // (ver `appendLocalDrawPoint`), sem esperar o eco da rede.
  useEffect(() => {
    if (!client || !userId || !activeMediaType) return undefined;
    function onDrawPoint(e) {
      const msg = e.detail;
      if (!msg || msg.authorId === client.peer?.id) return;
      if (msg.targetId !== userId || msg.mediaType !== activeMediaType) return;
      const key = `${msg.authorId}:${msg.strokeId}`;
      let stroke = strokesRef.current.get(key);
      if (!stroke) {
        stroke = { points: [], authorId: msg.authorId };
        strokesRef.current.set(key, stroke);
      }
      stroke.points.push({ x: msg.x, y: msg.y, t: performance.now() });
      ensureDrawLoop();
    }
    client.addEventListener('draw-point', onDrawPoint);
    return () => client.removeEventListener('draw-point', onDrawPoint);
  }, [client, userId, activeMediaType]);

  function ensureDrawLoop() {
    if (drawRafRef.current) return;
    const loop = () => {
      const hasActive = renderDrawFrame();
      drawRafRef.current = hasActive ? requestAnimationFrame(loop) : null;
    };
    drawRafRef.current = requestAnimationFrame(loop);
  }

  function renderDrawFrame() {
    const canvas = drawCanvasRef.current;
    const stage = stageRef.current;
    const video = videoRef.current;
    if (!canvas || !stage || !video || !mainStream) {
      strokesRef.current.clear();
      return false;
    }

    const dpr = window.devicePixelRatio || 1;
    const cssW = stage.clientWidth;
    const cssH = stage.clientHeight;
    const pxW = Math.max(1, Math.round(cssW * dpr));
    const pxH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const now = performance.now();
    const stageRect = stage.getBoundingClientRect();
    const contentRect = computeContentRect(video, stageRect);
    let hasActive = false;

    for (const [key, stroke] of strokesRef.current) {
      // Os pontos mais antigos (início do traço) vencem primeiro — é isso
      // que dá o efeito de "recuar a partir da ponta oposta".
      while (stroke.points.length && now - stroke.points[0].t > DRAW_FADE_MS) {
        stroke.points.shift();
      }
      if (!stroke.points.length) {
        strokesRef.current.delete(key);
        continue;
      }
      hasActive = true;
      drawStrokeOnCanvas(ctx, stroke.points, contentRect, now, stroke.authorId);
    }

    return hasActive;
  }

  function drawStrokeOnCanvas(ctx, points, rect, now, authorId) {
    const color = userColor(authorId).hex;

    if (points.length === 1) {
      const p = points[0];
      const alpha = Math.max(0, (1 - (now - p.t) / DRAW_FADE_MS) * DRAW_MAX_ALPHA);
      if (alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(rect.left + p.x * rect.width, rect.top + p.y * rect.height, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const alpha = Math.max(0, (1 - (now - b.t) / DRAW_FADE_MS) * DRAW_MAX_ALPHA);
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1.5 + alpha * 1.5;
      ctx.shadowBlur = 4 * alpha;
      ctx.beginPath();
      ctx.moveTo(rect.left + a.x * rect.width, rect.top + a.y * rect.height);
      ctx.lineTo(rect.left + b.x * rect.width, rect.top + b.y * rect.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  function appendLocalDrawPoint(clientX, clientY) {
    const video = videoRef.current;
    if (!video || !client || !userId || !activeMediaType) return;
    const rect = computeContentRect(video);
    if (!rect.width || !rect.height) return;
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));

    const key = `${client.peer.id}:${strokeIdRef.current}`;
    let stroke = strokesRef.current.get(key);
    if (!stroke) {
      stroke = { points: [], authorId: client.peer.id };
      strokesRef.current.set(key, stroke);
    }
    stroke.points.push({ x, y, t: performance.now() });
    ensureDrawLoop();

    // Rede: throttled — o desenho local acima já roda em frequência cheia,
    // isso aqui só controla quanto os OUTROS espectadores recebem.
    const now = Date.now();
    if (now - lastDrawSentRef.current >= DRAW_SEND_INTERVAL_MS) {
      lastDrawSentRef.current = now;
      client.sendDrawPoint({ targetId: userId, mediaType: activeMediaType, strokeId: strokeIdRef.current, x, y });
    }
  }

  function onStagePointerDown(e) {
    if (!mainStream || e.button !== 0 || !client) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    draggingRef.current = false;
  }

  function onStagePointerMove(e) {
    if (!pointerStartRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (!draggingRef.current) {
      // Margem antes de considerar "arrastou" — clique simples (foco do
      // card) não pode virar um risquinho sem querer.
      if (Math.hypot(dx, dy) < 4) return;
      draggingRef.current = true;
      strokeIdRef.current = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      try {
        e.target.setPointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    }
    appendLocalDrawPoint(e.clientX, e.clientY);
  }

  function endStrokeIfDragging(e) {
    if (!draggingRef.current) {
      pointerStartRef.current = null;
      return;
    }
    if (client && userId && activeMediaType && strokeIdRef.current) {
      client.sendDrawEnd({ targetId: userId, mediaType: activeMediaType, strokeId: strokeIdRef.current });
    }
    try {
      e?.target?.releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    strokeIdRef.current = null;
    pointerStartRef.current = null;
    draggingRef.current = false;
    justDraggedRef.current = true;
  }

  useEffect(() => {
    return () => {
      if (drawRafRef.current) cancelAnimationFrame(drawRafRef.current);
    };
  }, []);

  async function goFullscreen() {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } catch {
      // iOS / browsers que só dão fullscreen em <video> — cai pro overlay local
    }
    // Precisa marcar `expanded` mesmo quando o Fullscreen API real funciona
    // (antes só marcava no fallback) — senão o listener de Esc logo abaixo
    // nunca liga durante fullscreen de verdade, que é o caso comum.
    setExpanded(true);
  }

  function handleStageClick() {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    if (!mainStream || focused) return;
    onFocus?.();
  }

  function stopWatching(e) {
    e.stopPropagation();
    onStopWatching?.();
  }

  function exitExpanded() {
    setExpanded(false);
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      document.exitFullscreen?.();
      document.webkitExitFullscreen?.();
    }
  }

  function onMicVolumeChange(e) {
    const next = parseFloat(e.target.value);
    setMicVolume(next);
    setMicMuted(next === 0);
  }

  function onStreamVolumeChange(e) {
    const next = parseFloat(e.target.value);
    setStreamVolume(next);
    setStreamMuted(next === 0);
  }

  const netStatsText = stats ? formatNetStats(stats) : null;

  return (
    <div
      className={`tile ${speaking ? 'speaking' : ''} ${expanded ? 'expanded' : ''} ${focused ? 'focused' : ''}`}
      style={userColorStyle(userId)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        ref={stageRef}
        className={`tile-stage ${expanded ? 'expanded' : ''} ${mainStream && !focused ? 'watchable' : ''}`}
        onClick={handleStageClick}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={endStrokeIfDragging}
        onPointerLeave={endStrokeIfDragging}
        onPointerCancel={endStrokeIfDragging}
      >
        <div className="avatar">{nickname.slice(0, 2).toUpperCase()}</div>
        {mainStream ? (
          <video
            ref={videoRef}
            className={videoReady ? '' : 'is-pending'}
            autoPlay
            playsInline
            muted={isSelf || streamSilent}
          />
        ) : null}

        {/* "Olha isso aqui" — traço efêmero que qualquer um pode desenhar
            arrastando o mouse/dedo sobre a tela/câmera compartilhada.
            `pointer-events: none`: a captura do gesto é no .tile-stage,
            o canvas é só o desenho por cima. */}
        {mainStream && <canvas ref={drawCanvasRef} className="tile-draw-canvas" />}

        {/* Enquanto a mídia não chega (sinalizada mas call ainda não conectou)
            OU já conectou mas o primeiro frame ainda não decodificou — cobre
            o avatar com preto + spinner em vez de deixar o círculo com as
            iniciais aparecendo, que passava a falsa impressão de erro. */}
        {((pendingMedia && !mainStream) || (mainStream && !videoReady)) && (
          <div className="tile-pending-fill">
            <span className="tile-pending-spinner-lg" />
            {pendingMedia && !mainStream && (
              <span className="tile-pending-label">
                {pendingMedia === 'screen' ? 'Carregando tela…' : 'Carregando câmera…'}
              </span>
            )}
          </div>
        )}

        {stats && (
          <div className="tile-net" title={netStatsText}>
            <span className="tile-net-text">{netStatsText}</span>
          </div>
        )}

        {stats && (
          <div className="tile-net-badge-wrap">
            <Tooltip label={NET_QUALITY_LABEL[stats.quality] || 'Internet'}>
              <span
                className={`tile-net-badge tile-net-q${stats.quality}`}
                aria-label={NET_QUALITY_LABEL[stats.quality] || 'Internet'}
              >
                <i />
                <i />
                <i />
              </span>
            </Tooltip>
          </div>
        )}

        {showPip && (
          <div className={`pip-cam ${pipReady ? '' : 'is-pending'}`}>
            <div className="pip-cam-mask">
              <video ref={pipRef} autoPlay playsInline muted={isSelf} />
            </div>
          </div>
        )}

        {expanded && (
          <button type="button" className="tile-expanded-close" onClick={exitExpanded} aria-label="Sair da tela cheia">
            <X size={18} />
          </button>
        )}
      </div>

      <audio ref={audioRef} autoPlay muted={isSelf || micSilent} />

      <div className="tile-name">
        <span>
          {nickname}
          {isSelf ? ' (você)' : ''}
        </span>
        {isHost && <HostBadge />}
        <ClientBadge platform={platform} />
        <MicBadge on={Boolean(micStream)} />
      </div>

      {!isSelf && micSilent && !hover && (
        <div className="tile-muted-badge" title="Mic silenciado">
          <VolumeX size={13} />
        </div>
      )}

      {hover && (
        <div className="tile-overlay">
          {focused && mainStream && (
            <Tooltip label="Tela cheia">
              <button type="button" className="tile-icon-btn" onClick={goFullscreen} aria-label="Tela cheia">
                <Maximize2 size={14} />
              </button>
            </Tooltip>
          )}

          {focused && (
            <Tooltip label="Parar de assistir">
              <button type="button" className="tile-icon-btn" onClick={stopWatching} aria-label="Parar de assistir">
                <MonitorX size={16} />
              </button>
            </Tooltip>
          )}

          {focused && !isSelf && (
            <VolumeControl
              label="Volume transmissão"
              volume={streamVolume}
              silent={streamManualSilent}
              open={streamSliderOpen}
              onToggleOpen={() =>
                setStreamSliderOpen((o) => {
                  if (!o) setMicSliderOpen(false);
                  return !o;
                })
              }
              onChange={onStreamVolumeChange}
            />
          )}

          {!isSelf && (
            <VolumeControl
              label="Volume microfone"
              volume={micVolume}
              silent={micSilent}
              open={micSliderOpen}
              onToggleOpen={() =>
                setMicSliderOpen((o) => {
                  if (!o) setStreamSliderOpen(false);
                  return !o;
                })
              }
              onChange={onMicVolumeChange}
            />
          )}
        </div>
      )}
    </div>
  );
}
