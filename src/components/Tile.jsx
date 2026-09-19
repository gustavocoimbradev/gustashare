import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, MonitorX, Volume1, Volume2, VolumeX, X } from 'lucide-react';
import useSpeaking from '../lib/useSpeaking.js';
import { userColorStyle } from '../lib/userColor.js';
import Tooltip from './Tooltip.jsx';
import ClientBadge from './ClientBadge.jsx';
import HostBadge from './HostBadge.jsx';
import MicBadge from './MicBadge.jsx';

function VolumeControl({ label, mutedLabel, volume, silent, open, onToggleOpen, onChange }) {
  const VolumeIcon = silent ? VolumeX : volume < 0.4 ? Volume1 : Volume2;
  const sliderValue = silent ? 0 : volume;
  return (
    <div className="tile-volume-wrap">
      <Tooltip label={silent ? mutedLabel : label}>
        <button
          type="button"
          className={`tile-icon-btn ${silent ? 'muted' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleOpen();
          }}
          aria-label={silent ? mutedLabel : label}
        >
          <VolumeIcon size={15} />
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
  focused = false,
  onFocus,
  onStopWatching,
}) {
  const videoRef = useRef(null);
  const pipRef = useRef(null);
  const audioRef = useRef(null);
  const stageRef = useRef(null);
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
      if (!node && expanded) setExpanded(false);
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
      if (e.key === 'Escape') setExpanded(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  async function goFullscreen() {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        return;
      }
      if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        return;
      }
    } catch {
      // iOS / browsers que só dão fullscreen em <video> — cai pro overlay local
    }
    setExpanded(true);
  }

  function handleStageClick() {
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
              label="Silenciar transmissão"
              mutedLabel="Ativar som da transmissão"
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
              label="Silenciar microfone"
              mutedLabel="Ativar microfone"
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
