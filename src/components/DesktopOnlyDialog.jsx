import React from 'react';
import { Download, X } from 'lucide-react';
import { DESKTOP_DOWNLOAD_URL } from '../lib/platform.js';

const TITLES = {
  mic: 'Ligar microfone',
  cam: 'Ligar câmera',
  screen: 'Compartilhar tela',
};

const BODY = 'Esta funcionalidade está disponível apenas na versão desktop do GustaShare.';

export default function DesktopOnlyDialog({ feature, onClose }) {
  const title = TITLES[feature] || TITLES.screen;

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="invite-box desktop-only-box" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <p className="invite-hint">{BODY}</p>
        <a className="desktop-download-btn" href={DESKTOP_DOWNLOAD_URL}>
          <Download size={16} />
          Baixar versão desktop
        </a>
      </div>
    </div>
  );
}
