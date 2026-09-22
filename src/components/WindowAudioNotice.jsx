import React from 'react';
import { Download, X } from 'lucide-react';
import { DESKTOP_DOWNLOAD_URL } from '../lib/platform.js';

export default function WindowAudioNotice({ onClose }) {
  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="invite-box desktop-only-box" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>Compartilhando sem áudio</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <p className="invite-hint">
          O navegador não permite capturar o áudio de uma aplicação específica — é uma limitação do
          próprio Chromium, não do GustaShare. Só quem está vendo sua tela não vai ouvir o som desse
          app. Na versão desktop isso não acontece: dá pra compartilhar uma janela com o áudio dela.
        </p>
        <a className="desktop-download-btn" href={DESKTOP_DOWNLOAD_URL}>
          <Download size={16} />
          Baixar versão desktop
        </a>
      </div>
    </div>
  );
}
