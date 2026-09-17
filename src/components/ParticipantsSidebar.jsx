import React from 'react';
import useSpeaking from '../lib/useSpeaking.js';
import { userColorStyle } from '../lib/userColor.js';
import ClientBadge from './ClientBadge.jsx';

function ParticipantRow({ nickname, isSelf, userId, platform, micStream }) {
  const speaking = useSpeaking(micStream);

  return (
    <div className={`participant-row ${speaking ? 'speaking' : ''}`} style={userColorStyle(userId)}>
      <span className="participant-dot" />
      <span className="participant-name">
        {nickname}
        {isSelf ? ' (você)' : ''}
      </span>
      <ClientBadge platform={platform} />
    </div>
  );
}

export default function ParticipantsSidebar({ roster, selfId, streams, selfStreams }) {
  return (
    <div className="participants">
      <div className="participants-title">Na sala — {roster.length}</div>
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
            />
          );
        })}
      </div>
    </div>
  );
}
