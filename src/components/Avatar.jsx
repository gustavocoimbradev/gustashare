import React from 'react';
import { userColorStyle } from '../lib/userColor.js';

export default function Avatar({ nickname, userId, size = 'sm' }) {
  const initials = nickname?.slice(0, 2).toUpperCase() || '?';
  return (
    <div
      className={`avatar avatar-${size}`}
      style={userColorStyle(userId)}
      title={nickname}
    >
      {initials}
    </div>
  );
}
