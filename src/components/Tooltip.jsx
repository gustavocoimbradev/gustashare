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
    const { width: bw, height: bh } = bubbleRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centerX = wrap.left + wrap.width / 2;
    const canFitAbove = wrap.top - GAP - bh >= PAD;
    const below = !canFitAbove && vh - wrap.bottom - GAP - bh >= PAD;

    let top = below ? wrap.bottom + GAP : wrap.top - GAP - bh;
    top = Math.min(vh - PAD - bh, Math.max(PAD, top));

    let left = centerX - bw / 2;
    left = Math.min(vw - PAD - bw, Math.max(PAD, left));

    const arrow = Math.min(bw - 10, Math.max(10, centerX - left));
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
