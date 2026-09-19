import React, { useState } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { roomUrlSlug } from '../lib/platform.js';

export default function InviteModal({ roomCode, onClose }) {
  const [copied, setCopied] = useState(false);
  const link = `https://gustashare.vercel.app/room/${roomUrlSlug(roomCode)}`;

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
        <div className="dialog-head">
          <h2>Convide alguém pra sala</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <p className="invite-hint">Compartilhe o link abaixo com o seu convidado</p>

        <div className="invite-link-row">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button type="button" className="on" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
