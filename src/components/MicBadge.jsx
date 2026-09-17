import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import Tooltip from './Tooltip.jsx';

export default function MicBadge({ on }) {
  return (
    <Tooltip label={on ? 'Microfone ligado' : 'Microfone desligado'}>
      <span className={`mic-badge ${on ? 'on' : 'off'}`} aria-label={on ? 'Microfone ligado' : 'Microfone desligado'}>
        {on ? <Mic size={11} strokeWidth={2.2} /> : <MicOff size={11} strokeWidth={2.2} />}
      </span>
    </Tooltip>
  );
}
