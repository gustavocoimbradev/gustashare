import React from 'react';
import { Download } from 'lucide-react';
import { DESKTOP_DOWNLOAD_URL } from '../lib/platform.js';

const COPY = {
  mic: {
    title: 'Microfone só no desktop',
    body: 'Na versão web você assiste e usa o chat. Ligar o microfone está disponível no GustaShare para Windows.',
  },
  cam: {
    title: 'Câmera só no desktop',
    body: 'Na versão web você assiste e usa o chat. Ligar a câmera está disponível no GustaShare para Windows.',
  },
  screen: {
    title: 'Compartilhar tela só no desktop',
    body: 'Na versão web você assiste e usa o chat. Compartilhar tela está disponível no GustaShare para Windows.',
  },
};

export default function DesktopOnlyDialog({ feature, onClose }) {
  const copy = COPY[feature] || COPY.screen;

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="invite-box desktop-only-box" onClick={(e) => e.stopPropagation()}>
        <h2>{copy.title}</h2>
        <p className="invite-hint">{copy.body}</p>
        <div className="picker-actions desktop-only-actions">
          <button type="button" onClick={onClose}>
            Continuar assistindo
          </button>
          <a className="desktop-download-btn" href={DESKTOP_DOWNLOAD_URL}>
            <Download size={16} />
            Baixar para Windows
          </a>
        </div>
      </div>
    </div>
  );
}
