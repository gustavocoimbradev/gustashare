import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Volume1, Volume2, VolumeX } from 'lucide-react';
import useSpeaking from '../lib/useSpeaking.js';
import { userColorStyle } from '../lib/userColor.js';
import Tooltip from './Tooltip.jsx';

export default function Tile({ nickname, isSelf, userId, screenStream, camStream, micStream, cameraPosition }) {
  const videoRef = useRef(null);
  const pipRef = useRef(null);
  const audioRef = useRef(null);
  const lastVolumeRef = useRef(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [hover, setHover] = useState(false);
  const speaking = useSpeaking(micStream);

  const mainStream = screenStream || camStream;
  const showPip = !!screenStream && !!camStream;
  const silent = muted || volume === 0;

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = mainStream || null;
  }, [mainStream]);

  useEffect(() => {
    if (pipRef.current) pipRef.current.srcObject = showPip ? camStream : null;
  }, [showPip, camStream]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = micStream || null;
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

  function goFullscreen() {
    if (videoRef.current?.requestFullscreen) videoRef.current.requestFullscreen();
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
      className={`tile ${speaking ? 'speaking' : ''}`}
      style={userColorStyle(userId)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {mainStream ? (
        <video ref={videoRef} autoPlay playsInline muted={isSelf || silent} />
      ) : (
        <div className="avatar">{nickname.slice(0, 2).toUpperCase()}</div>
      )}

      {showPip && (
        <video
          ref={pipRef}
          autoPlay
          playsInline
          muted={isSelf}
          className={`pip-cam ${cameraPosition || 'bottom-right'}`}
        />
      )}

      <audio ref={audioRef} autoPlay muted={isSelf || silent} />

      <div className="tile-name">
        {nickname}
        {isSelf ? ' (você)' : ''}
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
