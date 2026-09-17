import React, { useEffect, useRef, useState } from 'react';
import useSpeaking from '../lib/useSpeaking.js';

export default function Tile({ nickname, isSelf, screenStream, camStream, micStream, cameraPosition }) {
  const videoRef = useRef(null);
  const pipRef = useRef(null);
  const audioRef = useRef(null);
  const [volume, setVolume] = useState(1);
  const [hover, setHover] = useState(false);
  const speaking = useSpeaking(micStream);

  const mainStream = screenStream || camStream;
  const showPip = !!screenStream && !!camStream;

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
    if (audioRef.current) audioRef.current.volume = volume;
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  function goFullscreen() {
    if (videoRef.current?.requestFullscreen) videoRef.current.requestFullscreen();
  }

  return (
    <div
      className={`tile ${speaking ? 'speaking' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {mainStream ? (
        <video ref={videoRef} autoPlay playsInline muted={isSelf} />
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

      <audio ref={audioRef} autoPlay muted={isSelf} />

      <div className="tile-name">
        {nickname}
        {isSelf ? ' (você)' : ''}
      </div>

      {hover && (
        <div className="tile-overlay">
          {mainStream && (
            <button className="expand" onClick={goFullscreen} title="Tela cheia">
              ⛶
            </button>
          )}
          {!isSelf && (
            <input
              className="volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              title="Volume"
            />
          )}
        </div>
      )}
    </div>
  );
}
