import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Volume1, Volume2, VolumeX, X } from 'lucide-react';
import useSpeaking from '../lib/useSpeaking.js';
import { userColorStyle } from '../lib/userColor.js';
import Tooltip from './Tooltip.jsx';
import ClientBadge from './ClientBadge.jsx';
import HostBadge from './HostBadge.jsx';
import MicBadge from './MicBadge.jsx';

export default function Tile({ nickname, isSelf, isHost, userId, platform, screenStream, camStream, micStream }) {
  const videoRef = useRef(null);
  const pipRef = useRef(null);
  const audioRef = useRef(null);
  const stageRef = useRef(null);
  const lastVolumeRef = useRef(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [hover, setHover] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [pipReady, setPipReady] = useState(false);
  const speaking = useSpeaking(micStream);

  const mainStream = screenStream || camStream;
  const showPip = !!screenStream && !!camStream;
  const silent = muted || volume === 0;

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
    const level = silent ? 0 : volume;
    if (audioRef.current) {
      audioRef.current.muted = isSelf || silent;
      audioRef.current.volume = level;
    }
    if (videoRef.current) {
      videoRef.current.muted = isSelf || silent;
      videoRef.current.volume = level;
    }
  }, [volume, silent, isSelf]);

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
      // iOS / browsers that only fullscreen <video> — overlay local
    }
    setExpanded(true);
  }

  function exitExpanded() {
    setExpanded(false);
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      document.exitFullscreen?.();
      document.webkitExitFullscreen?.();
    }
  }

  function toggleMute() {
    setMuted((wasMuted) => {
      if (wasMuted) {
        if (volume === 0) setVolume(lastVolumeRef.current || 1);
        return false;
      }
      if (volume > 0) lastVolumeRef.current = volume;
      return true;
    });
  }

  function onVolumeChange(e) {
    const next = parseFloat(e.target.value);
    setVolume(next);
    if (next === 0) {
      setMuted(true);
      return;
    }
    lastVolumeRef.current = next;
    setMuted(false);
  }

  const sliderValue = silent ? 0 : volume;
  const VolumeIcon = silent ? VolumeX : volume < 0.4 ? Volume1 : Volume2;

  return (
    <div
      className={`tile ${speaking ? 'speaking' : ''} ${expanded ? 'expanded' : ''}`}
      style={userColorStyle(userId)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div ref={stageRef} className={`tile-stage ${expanded ? 'expanded' : ''}`}>
        <div className="avatar">{nickname.slice(0, 2).toUpperCase()}</div>
        {mainStream ? (
          <video
            ref={videoRef}
            className={videoReady ? '' : 'is-pending'}
            autoPlay
            playsInline
            muted={isSelf || silent}
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

      <audio ref={audioRef} autoPlay muted={isSelf || silent} />

      <div className="tile-name">
        <span>
          {nickname}
          {isSelf ? ' (você)' : ''}
        </span>
        {isHost && <HostBadge />}
        <ClientBadge platform={platform} />
        <MicBadge on={Boolean(micStream)} />
      </div>

      {!isSelf && silent && !hover && (
        <div className="tile-muted-badge" title="Silenciado">
          <VolumeX size={13} />
        </div>
      )}

      {hover && (
        <div className="tile-overlay">
          {mainStream && (
            <Tooltip label="Tela cheia">
              <button type="button" className="tile-icon-btn" onClick={goFullscreen} aria-label="Tela cheia">
                <Maximize2 size={14} />
              </button>
            </Tooltip>
          )}
          {!isSelf && (
            <div className="tile-volume-wrap">
              <Tooltip label={silent ? 'Ativar som' : 'Silenciar'}>
                <button
                  type="button"
                  className={`tile-icon-btn ${silent ? 'muted' : ''}`}
                  onClick={toggleMute}
                  aria-label={silent ? 'Ativar som' : 'Silenciar'}
                >
                  <VolumeIcon size={15} />
                </button>
              </Tooltip>
              <input
                className="tile-volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={sliderValue}
                style={{ '--fill': `${sliderValue * 100}%` }}
                onChange={onVolumeChange}
                aria-label="Volume"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
