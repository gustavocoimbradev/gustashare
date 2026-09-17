import React from 'react';

const OPTIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

export default function CameraPositionModal({ onSelect, onClose }) {
  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="position-box" onClick={(e) => e.stopPropagation()}>
        <h2>Onde fica sua câmera?</h2>
        <p className="invite-hint">Escolha o canto da tela pra sua facecam aparecer.</p>

        <div className="position-grid">
          {OPTIONS.map((id) => (
            <button
              key={id}
              type="button"
              className={`position-option ${id}`}
              onClick={() => onSelect(id)}
            >
              <span className="position-dot" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
