// S2 — "Who answers when you're" / "busy" ⌫ "with a customer?"
// Card: typewriter-moves A error-retype (demo TypewriterErrorRetype.tsx) — three speeds are the whole drama:
// type 2f/char → hesitate 16f (cursor blinks twice, 4f half-period) → delete 1.5f/char → retype 1.5f/char, no pause;
// cursor solid while typing/deleting, blinks when hesitating, blinks twice after the last char and is removed.
// Frame-exact substring (no eased typing). Per-char inline spans, left edge anchored → the line never reflows.
// Marker highlight sweeps under the retyped claim as it completes. Hold ≥50f after.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, ramp } from '../lib/Polish';
import { C, NightStage, Words, cond } from '../kit';

const A = 'busy';
const B = 'with a customer?';
const SIZE = 124;
const T1 = 20; // first word types, 2f/char → done 26
const PAUSE = T1 + (A.length - 1) * 2; // 26
const DS = PAUSE + 16; // 42 delete starts, 1.5f/char
const RS = DS + A.length * 1.5 + 4; // 52 retype starts
const END2 = RS + (B.length - 1) * 1.5; // 74.5
const OFF = END2 + 20; // two 5f blink cycles then gone

const cursorOn = (f: number) => {
  if (f >= OFF) return false;
  if (f >= END2) return Math.floor((f - END2) / 5) % 2 === 0;
  if (f >= DS) return true;
  if (f >= PAUSE) return Math.floor((f - PAUSE) / 4) % 2 === 0;
  return f >= T1 - 2;
};

export const Typewriter: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const n1 = f < T1 ? 0 : Math.min(A.length, Math.floor((f - T1) / 2) + 1);
  const removed = f < DS ? 0 : Math.min(A.length, Math.floor((f - DS) / 1.5) + 1);
  const n2 = f < RS ? 0 : Math.min(B.length, Math.floor((f - RS) / 1.5) + 1);
  const shown = A.slice(0, Math.max(0, n1 - removed)) + B.slice(0, n2);

  // left edge chosen so the finished two-line block is centred
  const measure = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(1100);
  useLayoutEffect(() => { if (measure.current) setW(measure.current.offsetWidth || 1100); }, []);
  const LEFT = (1920 - w) / 2;

  const hl = ramp(f, END2 - 2, 14, EASE.snappy);
  const exit = ramp(f, duration - 7, 7, EASE.exit);

  return (
    <AbsoluteFill>
      <NightStage glow={0.6} />
      <div ref={measure} style={{ position: 'absolute', visibility: 'hidden', ...cond(SIZE), whiteSpace: 'nowrap' }}>Who answers when you&apos;re</div>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - exit, filter: exit > 0 ? `blur(${(exit * 16).toFixed(2)}px)` : undefined }}>
        <Words
          words={["Who", "answers", "when", "you're"].map((t, i) => ({ t, at: i * 4 }))}
          size={SIZE} color={C.paper} align="left" gap="0.24em"
          style={{ position: 'absolute', left: LEFT, top: 540 - SIZE * 1.25 }}
        />
        <div style={{ position: 'absolute', left: LEFT, top: 540 + SIZE * 0.05, height: SIZE * 1.15, display: 'flex', alignItems: 'center' }}>
          {/* marker under the claim: signal green, left → right */}
          {hl > 0 && (
            <div style={{ position: 'absolute', left: -12, top: SIZE * 0.62, height: SIZE * 0.4, width: `calc((100% + 24px) * ${hl.toFixed(4)})`, borderRadius: 8,
              background: 'linear-gradient(90deg, rgba(61,214,140,0.42), rgba(61,214,140,0.30))', boxShadow: '0 0 40px rgba(61,214,140,0.25)' }} />
          )}
          {shown.split('').map((ch, i) => (
            <span key={i} style={{ ...cond(SIZE), color: i >= 0 && shown.startsWith(A.slice(0, 1)) && removed < A.length && n2 === 0 ? 'rgba(251,252,250,0.62)' : C.paper, position: 'relative', whiteSpace: 'pre' }}>{ch}</span>
          ))}
          {cursorOn(f) && (
            <span style={{ display: 'inline-block', width: 8, height: SIZE * 0.95, marginLeft: 6, borderRadius: 4, background: C.signal, boxShadow: '0 0 18px rgba(61,214,140,0.6)' }} />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
