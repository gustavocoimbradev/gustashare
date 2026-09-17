import React, { useEffect, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';

export default function TitleBar({ canMaximize = true }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!window.gustashare?.isWindowMaximized) return undefined;
    window.gustashare.isWindowMaximized().then(setMaximized).catch(() => {});
    return window.gustashare.onWindowMaximized?.(setMaximized);
  }, []);

  function onDragDoubleClick() {
    if (canMaximize) window.gustashare?.maximizeWindow();
  }

  return (
    <div className="titlebar">
      <div className="titlebar-drag" onDoubleClick={onDragDoubleClick} />
      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-btn"
          onClick={() => window.gustashare?.minimizeWindow()}
          aria-label="Minimizar"
        >
          <Minus size={14} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          className={`titlebar-btn ${canMaximize ? '' : 'disabled'}`}
          onClick={() => canMaximize && window.gustashare?.maximizeWindow()}
          aria-label={maximized ? 'Restaurar' : 'Maximizar'}
          disabled={!canMaximize}
        >
          {maximized ? <Copy size={12} strokeWidth={2.2} /> : <Square size={12} strokeWidth={2.2} />}
        </button>
        <button
          type="button"
          className="titlebar-btn close"
          onClick={() => window.gustashare?.closeWindow()}
          aria-label="Fechar"
        >
          <X size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
