import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function InviteModal({ roomCode, nickname, onClose }) {
  const [copied, setCopied] = useState(false);
  const link = `https://gustashare.vercel.app/room/${encodeURIComponent(roomCode)}?from=${encodeURIComponent(
    nickname
  )}`;

  function copy() {
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="invite-box" onClick={(e) => e.stopPropagation()}>
        <h2>Convide alguém pra sala</h2>
        <p className="invite-hint">Quem abrir esse link entra direto nessa sala.</p>

        <div className="invite-link-row">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button type="button" className="on" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        <div className="picker-actions">
          <button type="button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
