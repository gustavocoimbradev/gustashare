import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const GAP = 10;
const PAD = 8;

export default function Tooltip({ label, children }) {
  const wrapRef = useRef(null);
  const bubbleRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);

  useLayoutEffect(() => {
    if (!open || !wrapRef.current || !bubbleRef.current) return;

    const wrap = wrapRef.current.getBoundingClientRect();
    const bubble = bubbleRef.current.getBoundingClientRect();
    const bw = bubble.width;
    const bh = bubble.height;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centerX = wrap.left + wrap.width / 2;
    const spaceAbove = wrap.top;
    const spaceBelow = vh - wrap.bottom;
    const below = spaceAbove < bh + GAP + PAD && spaceBelow > spaceAbove;

    let top = below ? wrap.bottom + GAP : wrap.top - GAP;
    let left = centerX - bw / 2;
    left = Math.min(vw - PAD - bw, Math.max(PAD, left));

    if (!below) {
      top = Math.max(PAD + bh, top);
    } else {
      top = Math.min(vh - PAD - bh, top);
    }

    const arrow = Math.min(bw - 12, Math.max(12, centerX - left));
    setCoords({ top, left, below, arrow });
  }, [open, label]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setCoords(null);
  }, [open]);

  return (
    <span
      className="tooltip-wrap"
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open &&
        createPortal(
          <span
            ref={bubbleRef}
            className={`tooltip-bubble tooltip-portal${coords?.below ? ' below' : ''}${coords ? ' placed' : ''}`}
            style={
              coords
                ? {
                    top: coords.top,
                    left: coords.left,
                    '--arrow-left': `${coords.arrow}px`,
                  }
                : undefined
            }
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  );
}
