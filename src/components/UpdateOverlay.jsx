import React, { useEffect, useState } from 'react';

export default function UpdateOverlay() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!window.gustashare?.onUpdateStatus) return undefined;
    return window.gustashare.onUpdateStatus(setStatus);
  }, []);

  if (!status || status.phase === 'idle') return null;

  return (
    <div className="update-overlay">
      <div className="update-box">
        <div className="update-title">
          {status.phase === 'installing'
            ? 'Instalando atualização...'
            : `Atualizando para v${status.version}...`}
        </div>
        <div className="update-bar">
          <div className="update-bar-fill" style={{ width: `${status.percent || 0}%` }} />
        </div>
        <div className="update-percent">{status.percent || 0}%</div>
        <div className="update-hint">Não feche o programa durante a atualização.</div>
      </div>
    </div>
  );
}
