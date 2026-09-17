import React from 'react';

// Tooltip próprio via CSS (hover puro, sem re-render) — evita o title
// padrão feio do navegador/SO.
export default function Tooltip({ label, children }) {
  return (
    <span className="tooltip-wrap">
      {children}
      <span className="tooltip-bubble">{label}</span>
    </span>
  );
}
