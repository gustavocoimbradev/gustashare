import React from 'react';
import { Crown } from 'lucide-react';
import Tooltip from './Tooltip.jsx';

export default function HostBadge() {
  return (
    <Tooltip label="Host da sala">
      <span className="client-badge host" aria-label="Host da sala">
        <Crown size={11} strokeWidth={2.2} />
      </span>
    </Tooltip>
  );
}
