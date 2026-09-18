import React from 'react';
import { X, Crown } from 'lucide-react';
import useSpeaking from '../lib/useSpeaking.js';
import { userColorStyle } from '../lib/userColor.js';
import ClientBadge from './ClientBadge.jsx';
import MicBadge from './MicBadge.jsx';

function ParticipantRow({ nickname, isSelf, userId, platform, micStream, isHost }) {
  const speaking = useSpeaking(micStream);
  const micOn = Boolean(micStream);

  return (
    <div className={`participant-row ${speaking ? 'speaking' : ''}`} style={userColorStyle(userId)}>
      <span className="participant-name">
        {nickname}
        {isSelf ? ' (você)' : ''}
      </span>
      <span className="participant-badges">
        {isHost && <Crown size={14} className="host-icon" title="Host da sala" />}
        <ClientBadge platform={platform} />
        <MicBadge on={micOn} />
      </span>
    </div>
  );
}

export default function ParticipantsSidebar({ roster, selfId, streams, selfStreams, className, onClose, hostId }) {
  return (
    <div className={`participants ${className || ''}`}>
      <div className="participants-title">
        Na sala — {roster.length}
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Fechar">
          <X size={18} />
        </button>
      </div>
      <div className="participants-list">
        {roster.map((m) => {
          const isSelf = m.id === selfId;
          const micStream = isSelf ? selfStreams.mic : streams[m.id]?.mic;
          return (
            <ParticipantRow
              key={m.id}
              userId={m.id}
              nickname={m.nickname}
              isSelf={isSelf}
              platform={m.platform}
              micStream={micStream}
              isHost={m.id === hostId}
            />
          );
        })}
      </div>
    </div>
  );
}
