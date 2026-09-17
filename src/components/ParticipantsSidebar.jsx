import React from 'react';
import useSpeaking from '../lib/useSpeaking.js';

function ParticipantRow({ nickname, isSelf, micStream }) {
  const speaking = useSpeaking(micStream);

  return (
    <div className={`participant-row ${speaking ? 'speaking' : ''}`}>
      <span className="participant-dot" />
      <span className="participant-name">
        {nickname}
        {isSelf ? ' (você)' : ''}
      </span>
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
          return <ParticipantRow key={m.id} nickname={m.nickname} isSelf={isSelf} micStream={micStream} />;
        })}
      </div>
    </div>
  );
}
