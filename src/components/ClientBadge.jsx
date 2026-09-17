import React from 'react';
import { Globe, Monitor } from 'lucide-react';
import Tooltip from './Tooltip.jsx';

export default function ClientBadge({ platform }) {
  if (platform !== 'desktop' && platform !== 'web') return null;
  const isPc = platform === 'desktop';
  return (
    <Tooltip label={isPc ? 'App para Windows' : 'Navegador'}>
      <span className={`client-badge ${isPc ? 'pc' : 'web'}`} aria-label={isPc ? 'App para Windows' : 'Navegador'}>
        {isPc ? <Monitor size={11} strokeWidth={2.2} /> : <Globe size={11} strokeWidth={2.2} />}
      </span>
    </Tooltip>
  );
}
