import React from 'react';
import { Monitor, Download, X } from 'lucide-react';
import { DESKTOP_DOWNLOAD_URL } from '../lib/platform.js';

export default function DesktopPromoBanner({ onClose }) {
  return (
    <div className="desktop-promo-banner">
      <Monitor size={18} className="desktop-promo-icon" />
      <p className="desktop-promo-text">
        <strong>Você tá no navegador.</strong> Compartilhar uma aplicação específica sai sem áudio aqui — limitação do
        navegador. A versão desktop resolve isso, entrega áudio e imagem com mais qualidade e roda mais leve.
      </p>
      <a className="desktop-promo-btn" href={DESKTOP_DOWNLOAD_URL}>
        <Download size={15} />
        Baixar versão desktop
      </a>
      <button type="button" className="desktop-promo-close" onClick={onClose} aria-label="Fechar aviso">
        <X size={16} />
      </button>
    </div>
  );
}
