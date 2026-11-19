// S3 — "Meet" → green orb → ring collapses ON THE DROP → PulseMark + "Pulse" + tagline.
// Card: logo-shrink-wordmark-lockup (demo LogoShrinkWordmarkLockup.tsx), re-skinned from neon violet to Pulse signal green.
// Kept from the demo: scale 5.4→1 inOutCubic over t 0.02–0.28 with a +6% sin brake 0.26–0.37; arcs spin -150° outCubic
// while shrinking; gap heals 0.10–0.28; mark cross-fades in 0.24–0.32 (the mark itself never rotates); shockwave 0.28–0.46;
// two zoom-trail ghosts at speed; icon shifts left 0.34–0.47; letters stagger in from 0.46 (+8px, 2.5px blur); tagline 0.72–0.84.
// Lockup t is mapped to 132f exactly as the demo, and positioned so t=0.28 (landing) = the music drop.
// The "Meet" prelude borrows the reference's motion-blurred title sweep.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { E, lerp, seg } from '../lib/Motion';
import { EASE, mix, ramp } from '../lib/Polish';
import { C, FONT, NightStage, PulseMark, cond } from '../kit';

const LOCK_DUR = 132;
const ICON = 120; // demo 30 × 4
const GAP = 36;
const TAG = 'THE AI RECEPTIONIST FOR SMALL BUSINESS';

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
};
const Arcs: React.FC<{ col: string; w: number; blur: number; opacity: number }> = ({ col, w, blur, opacity }) => (
  <g opacity={opacity}>
    {[[-32, 122], [148, 302]].map(([a, b], i) => (
      <path key={i} d={arcPath(15, 15, 10.5, a, b)} fill="none" stroke={col} strokeWidth={w} strokeLinecap="round" style={blur ? { filter: `blur(${blur}px)` } : undefined} />
    ))}
  </g>
);
const scaleAt = (t: number) => lerp(seg(t, 0.02, 0.28, E.inOutCubic), 5.4, 1) * (1 + Math.sin(seg(t, 0.26, 0.37) * Math.PI) * 0.06);
const spinAt = (t: number) => -150 * seg(t, 0, 0.3, E.outCubic);

export const Reveal: React.FC<{ duration: number; dropAt: number }> = ({ duration, dropAt }) => {
  const f = useCurrentFrame();
  const L0 = dropAt - Math.round(0.28 * (LOCK_DUR - 1)); // landing frame = drop
  const t = Math.max(0, Math.min(1, (f - L0) / (LOCK_DUR - 1)));
  const live = f >= L0;
  const DT = 1 / (LOCK_DUR - 1);

  const wordRef = useRef<HTMLSpanElement>(null);
  const [WORD_W, setWW] = useState(300);
  useLayoutEffect(() => { if (wordRef.current) setWW(wordRef.current.offsetWidth || 300); }, []);
  const SHIFT = -(ICON + GAP + WORD_W) / 2 + ICON / 2;
  const ROW_LEFT = SHIFT + ICON / 2 + GAP;

  // ── "Meet" prelude: sweeps in from the right with horizontal smear, holds, then collapses into the orb
  const meetIn = ramp(f, 2, 18, EASE.snappy);
  const meetX = (1 - meetIn) * 900;
  const meetV = Math.abs((1 - ramp(f + 0.5, 2, 18, EASE.snappy)) * 900 - (1 - ramp(f - 0.5, 2, 18, EASE.snappy)) * 900);
  const meetOut = ramp(f, L0 - 26, 22, EASE.exit);
  const orb = ramp(f, L0 - 20, 22, EASE.out) * (1 - seg(t, 0.05, 0.25, E.inOutCubic));

  // ── lockup
  const s = scaleAt(t);
  const spin = spinAt(t);
  const shift = seg(t, 0.34, 0.47, E.inOutCubic) * SHIFT;
  const heal = seg(t, 0.1, 0.28, E.inOutQuad);
  const markIn = seg(t, 0.24, 0.32, E.inOutQuad);
  const trail = Math.min(1, Math.abs(scaleAt(t) - scaleAt(t - DT)) / 0.35);
  const wave = seg(t, 0.28, 0.46, E.outCubic);
  const haloR = lerp(seg(t, 0.02, 0.3, E.inOutCubic), 600, 136);
  const haloA = 0.55 - 0.3 * seg(t, 0.3, 0.5, E.outCubic);
  const appear = seg(t, 0, 0.04);
  const exit = ramp(f, duration - 6, 6, EASE.exit);

  const icon = (sc: number, rot: number, opacity: number, ghost = false) => (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: ICON, height: ICON, margin: `${-ICON / 2}px 0 0 ${-ICON / 2}px`, transform: `translateX(${shift}px) scale(${sc})`, opacity }}>
      <svg viewBox="0 0 30 30" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', transform: `rotate(${rot}deg)` }}>
        <Arcs col="rgba(61,214,140,0.62)" w={6.5} blur={2.5} opacity={1 - heal} />
        {!ghost && <Arcs col={heal > 0.5 ? '#ffffff' : '#c9f7de'} w={3.4} blur={0} opacity={(1 - heal * 0.75) * (1 - markIn)} />}
        {!ghost && <circle cx={15} cy={15} r={10.5} fill="none" stroke="#fff" strokeWidth={5.5} opacity={heal * (1 - markIn)} />}
      </svg>
      {!ghost && markIn > 0 && <PulseMark size={ICON} tone="night" style={{ position: 'absolute', left: 0, top: 0, opacity: markIn }} />}
    </div>
  );

  return (
    <AbsoluteFill style={{ opacity: 1 - exit }}>
      <NightStage glow={0.9} />
      {/* Meet */}
      {meetOut < 1 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={0} height={0} style={{ position: 'absolute' }}><filter id="meet-mb" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation={`${Math.min(40, meetV * 0.35).toFixed(2)} 0`} /></filter></svg>
          <span style={{
            ...cond(300, 800), color: C.paper, display: 'inline-block',
            transform: `translateX(${meetX.toFixed(1)}px) scale(${mix(1, 0.2, meetOut).toFixed(4)})`, opacity: Math.min(1, meetIn * 2) * (1 - meetOut),
            filter: meetV > 1 ? 'url(#meet-mb)' : meetOut > 0 ? `blur(${(meetOut * 30).toFixed(1)}px)` : undefined,
            textShadow: '0 0 60px rgba(61,214,140,0.25)',
          }}>Meet</span>
        </div>
      )}
      {/* orb the word collapses into: the energy the ring is made of */}
      {orb > 0.01 && (
        <div style={{ position: 'absolute', left: 960 - 260, top: 540 - 260, width: 520, height: 520, borderRadius: '50%', opacity: orb,
          background: 'radial-gradient(circle, rgba(120,240,180,0.95) 0%, rgba(61,214,140,0.75) 22%, rgba(61,214,140,0.18) 52%, rgba(61,214,140,0) 70%)', filter: 'blur(8px)' }} />
      )}
      {live && (
        <div style={{ position: 'absolute', inset: 0, opacity: appear }}>
          <div style={{ position: 'absolute', left: `calc(50% + ${shift}px - ${haloR}px)`, top: `calc(50% - ${haloR}px)`, width: haloR * 2, height: haloR * 2, borderRadius: '50%', opacity: haloA,
            background: 'radial-gradient(circle, rgba(61,214,140,0.42) 0%, rgba(61,214,140,0.12) 38%, rgba(61,214,140,0) 70%)' }} />
          {wave > 0 && wave < 1 && (
            <div style={{ position: 'absolute', left: `calc(50% - ${lerp(wave, 64, 280)}px)`, top: `calc(50% - ${lerp(wave, 64, 280)}px)`, width: lerp(wave, 128, 560), height: lerp(wave, 128, 560),
              borderRadius: '50%', boxSizing: 'border-box', border: `${lerp(wave, 3.6, 1)}px solid rgba(200,255,225,${(0.55 * (1 - wave)).toFixed(3)})`,
              boxShadow: `0 0 ${lerp(wave, 16, 40)}px rgba(61,214,140,${(0.45 * (1 - wave)).toFixed(3)})` }} />
          )}
          {trail > 0.02 && icon(scaleAt(t - 2 * DT), spinAt(t - 2 * DT), 0.16 * trail, true)}
          {trail > 0.02 && icon(scaleAt(t - DT), spinAt(t - DT), 0.3 * trail, true)}
          {icon(s, spin, 1)}
          <div style={{ position: 'absolute', left: `calc(50% + ${ROW_LEFT}px)`, top: '50%', height: ICON, marginTop: -ICON / 2, display: 'flex', alignItems: 'center' }}>
            <span ref={wordRef} style={{ display: 'inline-flex' }}>
              {'Pulse'.split('').map((ch, i) => {
                const lk = seg(t, 0.46 + i * 0.035, 0.46 + i * 0.035 + 0.1, E.outCubic);
                return (
                  <span key={i} style={{ ...cond(132, 800), color: '#f3f7f4', whiteSpace: 'pre', opacity: lk, transform: `translateX(${lerp(lk, 32, 0)}px)`,
                    filter: lk < 0.999 ? `blur(${lerp(lk, 10, 0).toFixed(2)}px)` : undefined, textShadow: '0 0 40px rgba(61,214,140,0.22)' }}>{ch}</span>
                );
              })}
            </span>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(50% + 120px)', textAlign: 'center', color: C.signal, fontFamily: FONT, fontWeight: 650, fontSize: 28, letterSpacing: '0.2em',
            opacity: seg(t, 0.72, 0.84, E.outQuad), transform: `translateY(${lerp(seg(t, 0.72, 0.86, E.outCubic), 12, 0)}px)` }}>{TAG}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};
