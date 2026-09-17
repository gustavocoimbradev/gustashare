import React, { useState } from 'react';

function hwndFromSourceId(id) {
  // Formato do Electron no Windows: "window:<hwnd>:0"
  const match = /^window:(\d+):/.exec(id);
  return match ? parseInt(match[1], 10) : null;
}

export default function ScreenPickerModal({ sources, onConfirm, onCancel }) {
  const [selectedId, setSelectedId] = useState(sources[0]?.id || null);
  const [shareAudio, setShareAudio] = useState(true);

  const selected = sources.find((s) => s.id === selectedId);
  const isWindow = !!selected && !selected.isScreen;
  const screens = sources.filter((s) => s.isScreen);
  const windows = sources.filter((s) => !s.isScreen);

  function confirm() {
    if (!selectedId) return;
    onConfirm({
      id: selectedId,
      shareAudio,
      isScreen: !isWindow,
      hwnd: isWindow ? hwndFromSourceId(selectedId) : null,
    });
  }

  return (
    <div className="picker-backdrop" onClick={onCancel}>
      <div className="picker" onClick={(e) => e.stopPropagation()}>
        <h2>O que você quer compartilhar?</h2>

        <div className="picker-sources">
          {screens.length > 0 && (
            <>
              <div className="picker-section-title">Telas</div>
              <div className="picker-grid">
                {screens.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`picker-item ${selectedId === s.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <img src={s.thumbnail} alt={s.name} />
                    <span className="picker-item-label">
                      <span className="picker-item-text">{s.name || `Tela ${i + 1}`}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {windows.length > 0 && (
            <>
              <div className="picker-section-title">Janelas / aplicativos</div>
              <div className="picker-grid">
                {windows.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`picker-item ${selectedId === s.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <img src={s.thumbnail} alt={s.name} />
                    <span className="picker-item-label">
                      {s.appIcon && <img className="app-icon" src={s.appIcon} alt="" />}
                      <span className="picker-item-text">{s.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <label className="picker-audio">
          <input type="checkbox" checked={shareAudio} onChange={(e) => setShareAudio(e.target.checked)} />
          {isWindow ? 'Compartilhar áudio do app (se disponível nesta máquina)' : 'Compartilhar áudio do sistema'}
        </label>

        <div className="picker-actions">
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="on" onClick={confirm} disabled={!selectedId}>
            Compartilhar
          </button>
        </div>
      </div>
    </div>
  );
}
