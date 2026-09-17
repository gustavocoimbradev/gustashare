import React, { useEffect, useState } from 'react';

// So aparece quando o SO nao tem seletor nativo de compartilhamento de tela
// (ver electron/main.js). Em Windows 10/11 modernos, o proprio Windows
// mostra o dialogo — este componente e o fallback garantido.
export default function ScreenPickerModal() {
  const [sources, setSources] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [shareAudio, setShareAudio] = useState(true);

  useEffect(() => {
    if (!window.gustashare?.onScreenPickerSources) return undefined;
    return window.gustashare.onScreenPickerSources((list) => {
      setSources(list);
      setSelectedId(list[0]?.id || null);
      setShareAudio(true);
    });
  }, []);

  if (!sources) return null;

  const selected = sources.find((s) => s.id === selectedId);
  const isWindow = !!selected && !selected.isScreen;
  const screens = sources.filter((s) => s.isScreen);
  const windows = sources.filter((s) => !s.isScreen);

  function confirm() {
    if (!selectedId) return;
    window.gustashare.chooseScreenSource({ id: selectedId, shareAudio: !isWindow && shareAudio });
    setSources(null);
  }

  function cancel() {
    window.gustashare.chooseScreenSource({ cancelled: true });
    setSources(null);
  }

  return (
    <div className="picker-backdrop">
      <div className="picker">
        <h2>O que você quer compartilhar?</h2>

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
                  <span>{s.name || `Tela ${i + 1}`}</span>
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
                  <span>
                    {s.appIcon && <img className="app-icon" src={s.appIcon} alt="" />}
                    {s.name}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <label className="picker-audio">
          <input
            type="checkbox"
            checked={!isWindow && shareAudio}
            disabled={isWindow}
            onChange={(e) => setShareAudio(e.target.checked)}
          />
          {isWindow
            ? 'Áudio isolado do app não é suportado nesta captura — só o vídeo será compartilhado'
            : 'Compartilhar áudio do sistema'}
        </label>

        <div className="picker-actions">
          <button type="button" onClick={cancel}>
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
