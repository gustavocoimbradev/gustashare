import React from 'react';
import { MonitorX } from 'lucide-react';

export default function AlreadyOpenScreen() {
  return (
    <div className="already-open">
      <div className="already-open-box">
        <MonitorX size={40} />
        <h1>O GustaShare já está aberto</h1>
        <p>Só dá pra usar em uma aba por vez. Feche essa ou volte pra outra que já está aberta.</p>
      </div>
    </div>
  );
}
