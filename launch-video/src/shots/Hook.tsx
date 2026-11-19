// S1 — "You just missed [a booking.] → [a regular.] → [$140.]" → "a call."
// Card: pill-slot-cycle (demo PillSlotCycle.tsx) — stem anchored left and dead still while the slot cycles;
// new pill rolls in from +120px with rotateX -38°→0 + velocity-based vertical blur, old one exits up -130px;
// beat 21–22f per pill (first 8f swap, rest is reading time); finale overshoot back(1.4) 14f; then smooth re-centre.
// Stem words enter with blur-slide. Red pills: these are losses (red = urgent/problem in Pulse's system).
import React, { useLayoutEffect, useRef, useState } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { EASE, mix, ramp } from '../lib/Polish';
import { C, NightStage, Words, cond } from '../kit';

const PILLS = ['a booking.', 'a regular.', '$140.'];
const SIZE = 132;
const STEM_LEFT = 250;
const STEM_GAP = 34;
const WORD_GAP = 34;
const CYC = 24; // first pill swaps in
const BEAT = 22; // per pill (1.5 music beats ≈ 22f)
const SWAP = 8;
const FIN = 14;
const CENTER = 24;
const CYC_END = CYC + PILLS.length * BEAT; // 90

const VBlur: React.FC<{ id: string; std: number }> = ({ id, std }) => (
  <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
    <filter id={id} x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation={`0 ${std.toFixed(2)}`} /></filter>
  </svg>
);

const RedPill: React.FC<{ text: string; lift?: number; style?: React.CSSProperties }> = ({ text, lift = 0, style }) => (
  <div style={{
    ...cond(SIZE * 0.9, 800), color: '#fff', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
    padding: `${SIZE * 0.1}px ${SIZE * 0.24}px ${SIZE * 0.13}px`, borderRadius: SIZE * 0.2,
    background: `linear-gradient(180deg, #e44a3e 0%, ${C.ribbon} 100%)`,
    boxShadow: `inset 0 2px 0 rgba(255,255,255,0.28), 0 ${10 + lift * 30}px ${30 + lift * 50}px rgba(0,0,0,${(0.35 + lift * 0.2).toFixed(2)}), 0 0 60px rgba(210,59,49,0.28)`,
    ...style,
  }}>{text}</div>
);

const inYAt = (bf: number) => mix(120, 0, ramp(bf, 0, SWAP, EASE.snappy));
const outYAt = (bf: number) => mix(0, -130, ramp(bf, 0, SWAP - 1, EASE.exit));

export const Hook: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const finalRef = useRef<HTMLDivElement>(null);
  const [finalW, setFinalW] = useState(1300);
  useLayoutEffect(() => { if (finalRef.current) setFinalW(finalRef.current.offsetWidth || 1300); }, []);

  const rel = f - CYC;
  const idx = Math.max(0, Math.min(Math.floor(rel / BEAT), PILLS.length - 1));
  const bf = rel - idx * BEAT;
  const isFin = f >= CYC_END;
  const finT = interpolate(f, [CYC_END, CYC_END + FIN], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.4)) });
  const centerT = ramp(f, CYC_END + FIN - 2, CENTER, EASE.smooth);
  const shiftX = centerT * ((1920 - finalW) / 2 - STEM_LEFT);
  const exit = ramp(f, duration - 7, 7, EASE.exit);

  let slot: React.ReactNode = null;
  if (!isFin && rel >= 0) {
    const inT = ramp(bf, 0, SWAP, EASE.snappy);
    const inBlur = Math.min(14, Math.abs(inYAt(bf + 0.5) - inYAt(bf - 0.5)) * 0.55);
    const outT = ramp(bf, 0, SWAP - 1, EASE.exit);
    const outBlur = Math.min(12, Math.abs(outYAt(bf + 0.5) - outYAt(bf - 0.5)) * 0.45);
    const prev = idx > 0 ? PILLS[idx - 1] : null;
    slot = (
      <div style={{ position: 'relative', display: 'inline-block', perspective: 1400 }}>
        <VBlur id="h-in" std={inBlur} />
        <VBlur id="h-out" std={outBlur} />
        <RedPill text={PILLS[idx]} style={{ visibility: 'hidden' }} />
        {prev && outT < 1 && (
          <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '50% 100%', opacity: 1 - outT, filter: outBlur > 0.3 ? 'url(#h-out)' : undefined,
            transform: `translateY(${outYAt(bf).toFixed(2)}px) rotateX(${(34 * outT).toFixed(2)}deg) scale(${mix(1, 0.94, outT).toFixed(4)})` }}>
            <RedPill text={prev} lift={outT} />
          </div>
        )}
        <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '50% 0%', opacity: idx === 0 ? inT : Math.min(1, inT * 1.6), filter: inBlur > 0.3 ? 'url(#h-in)' : undefined,
          transform: `translateY(${inYAt(bf).toFixed(2)}px) rotateX(${(-38 * (1 - inT)).toFixed(2)}deg) scale(${mix(0.94, 1, inT).toFixed(4)})` }}>
          <RedPill text={PILLS[idx]} lift={1 - inT} />
        </div>
      </div>
    );
  } else if (isFin) {
    const lastOut = ramp(f, CYC_END, 7, EASE.exit);
    slot = (
      <div style={{ position: 'relative', display: 'inline-block', perspective: 1400 }}>
        <span style={{ ...cond(SIZE), color: C.paper, display: 'inline-block', marginLeft: WORD_GAP - STEM_GAP, opacity: Math.min(1, finT * 1.4), transform: `translateY(${((1 - finT) * 90).toFixed(2)}px)` }}>
          a call.
        </span>
        {lastOut < 1 && (
          <div style={{ position: 'absolute', left: 0, top: -8, transformOrigin: '50% 100%', opacity: 1 - lastOut,
            transform: `translateY(${(-130 * lastOut).toFixed(2)}px) rotateX(${(34 * lastOut).toFixed(2)}deg) scale(${mix(1, 0.94, lastOut).toFixed(4)})` }}>
            <RedPill text={PILLS[PILLS.length - 1]} lift={lastOut} />
          </div>
        )}
      </div>
    );
  }

  return (
    <AbsoluteFill>
      <NightStage glow={0.4} />
      <div ref={finalRef} style={{ position: 'absolute', visibility: 'hidden', display: 'flex', gap: WORD_GAP }}>
        <span style={cond(SIZE)}>You just missed</span>
        <span style={cond(SIZE)}>a call.</span>
      </div>
      <div style={{
        position: 'absolute', left: STEM_LEFT, top: 540, display: 'flex', alignItems: 'center', gap: STEM_GAP,
        transform: `translate(${shiftX.toFixed(2)}px, -50%)`, opacity: 1 - exit, filter: exit > 0 ? `blur(${(exit * 16).toFixed(2)}px)` : undefined,
      }}>
        <Words words={[{ t: 'You', at: 0 }, { t: 'just', at: 4 }, { t: 'missed', at: 8 }]} size={SIZE} color={C.paper} blur={18} gap="0.24em" />
        {slot}
      </div>
    </AbsoluteFill>
  );
};
