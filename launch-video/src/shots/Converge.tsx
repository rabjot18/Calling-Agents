// P3 — "One number. [Every caller.]" Four caller sources converge into Pulse.
// Card: bezier-source-converge-merge (demo BezierSourceConvergeMerge.tsx), geometry and timings unchanged in t
// (design canvas 440×240 inside a 480×270 DesignStage at 4×, zoom raster): path M -22,y L 74,y C 186,y 214,120 332,120;
// draw-on 0.04+i·0.045 (+0.17, outQuad); converge 0.34→0.74 inOutCubic along the real curve; three-stage shrink
// 44→15 (first 75%) → 0 (last 25%); packets 2 integer cycles with i·0.13 phase + comet tail; erase 0.78→0.9 backwards;
// badge pulse +12% at 0.7–0.86; ripple 0.72–0.86; caption from 0.84; pan to centre 0.76–0.93.
// Retimed from 168f to this shot's 133f (t = frame / (duration−1)). Nodes stay greyscale; green only on packets + ripple.
// Added for Pulse: small labels left of each source (fade as the nodes start moving) + the top caption.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { DesignStage, E, lerp, seg } from '../lib/Motion';
import { EASE, softShadow } from '../lib/Polish';
import { C, FONT, PaperFinish, PaperStage, PulseMark, Words } from '../kit';

const ACCENT = C.pill;
const ACCENT_HI = C.signal;
const LINE = 'rgba(20,32,27,0.09)';
const XC = 332, YC = 120;
const SRCS = [
  { y: 36, icon: 'missed', c: '#2a2c33', label: 'Missed calls' },
  { y: 92, icon: 'moon', c: '#4b4e57', label: 'After hours' },
  { y: 148, icon: 'pin', c: '#6d7079', label: 'Google listing' },
  { y: 204, icon: 'globe', c: '#8f929c', label: 'Your website' },
];
const ICON: Record<string, React.ReactNode> = {
  missed: (<><path d="M5 4.5h3l1.5 4-2 1.3a10 10 0 0 0 4.7 4.7l1.3-2 4 1.5v3a1.6 1.6 0 0 1-1.7 1.6A14 14 0 0 1 3.4 6.2 1.6 1.6 0 0 1 5 4.5z" /><path d="M15 4l5 5M20 4l-5 5" /></>),
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />,
  pin: (<><path d="M12 21s-6-5.3-6-10.5a6 6 0 0 1 12 0C18 15.7 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.2" /></>),
  globe: (<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5s1.2-6.1 3.8-8.5z" /></>),
};
type Pt = { x: number; y: number };
const cubic = (y0: number, u: number): Pt => {
  const v = 1 - u;
  return { x: v * v * v * 74 + 3 * v * v * u * 186 + 3 * v * u * u * 214 + u * u * u * XC, y: v * v * v * y0 + 3 * v * v * u * y0 + 3 * v * u * u * YC + u * u * u * YC };
};
const mkGeom = (y0: number) => {
  const N = 1600; const cum = [0]; let px = 74, py = y0, acc = 0;
  for (let k = 1; k <= N; k++) { const p = cubic(y0, k / N); acc += Math.hypot(p.x - px, p.y - py); cum.push(acc); px = p.x; py = p.y; }
  const len = 96 + acc;
  const pointAt = (s: number): Pt => {
    const sc = Math.max(0, Math.min(len, s));
    if (sc <= 96) return { x: -22 + sc, y: y0 };
    const target = sc - 96; let lo = 0, hi = N;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < target) lo = m + 1; else hi = m; }
    const i = Math.max(1, lo); const s0 = cum[i - 1], s1 = cum[i];
    return cubic(y0, (i - 1 + (s1 > s0 ? (target - s0) / (s1 - s0) : 0)) / N);
  };
  return { len, pointAt, f0: 96 / len };
};
const GEOMS = SRCS.map((s) => mkGeom(s.y));
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const BADGE = 46;
const SHIFT = 352 - 240;

export const Converge: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const t = Math.min(1, f / (duration - 1));
  const conv = seg(t, 0.34, 0.74, E.inOutCubic);
  const erase = seg(t, 0.78, 0.9, E.outQuad);
  const pk = (seg(t, 0.1, 0.74) * 2) % 1;
  const pan = seg(t, 0.76, 0.93, EASE.smooth);
  const bp = seg(t, 0.16, 0.26, E.outCubic);
  const badgeScale = lerp(bp, 0.7, 1) * (1 + seg(t, 0.7, 0.78, E.outBack) * 0.12 - seg(t, 0.78, 0.86, E.outQuad) * 0.12);
  const ripple = seg(t, 0.72, 0.86, EASE.out);
  const cap = seg(t, 0.84, 0.92, EASE.out);
  const labels = 1 - seg(t, 0.32, 0.42, E.outQuad);

  return (
    <AbsoluteFill>
      <PaperStage />
      <Words words={[{ t: 'One', at: 4 }, { t: 'number.', at: 8 }, { t: 'Every caller.', at: 18, pill: 'green' }]} size={84} out={duration - 8} style={{ position: 'absolute', left: 0, right: 0, top: 96 }} />
      <DesignStage bg="transparent" raster="zoom">
        <div style={{ position: 'absolute', inset: 0, fontFamily: FONT }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 440, height: 240, margin: '-100px 0 0 -200px', transform: `translateX(${(-pan * SHIFT).toFixed(2)}px)` }}>
            <svg width={440} height={240} viewBox="0 0 440 240" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              <defs>
                <linearGradient id="cv-stroke" gradientUnits="userSpaceOnUse" x1={-22} y1={0} x2={XC} y2={0}>
                  <stop offset="0" stopColor="#b8c2bc" /><stop offset="0.45" stopColor="#7c8982" /><stop offset="1" stopColor="#1d3a30" />
                </linearGradient>
              </defs>
              {SRCS.map((s, i) => {
                const { len } = GEOMS[i];
                const draw = seg(t, 0.04 + i * 0.045, 0.21 + i * 0.045, E.outQuad);
                const off = erase > 0 ? -erase * len : len * (1 - draw);
                return <path key={i} d={`M -22,${s.y} L 74,${s.y} C 186,${s.y} 214,${YC} ${XC},${YC}`} fill="none" stroke="url(#cv-stroke)" strokeWidth={0.9} strokeLinecap="round"
                  strokeDasharray={len} strokeDashoffset={off.toFixed(1)} opacity={(draw * (1 - clamp01((erase - 0.85) / 0.15))).toFixed(3)} />;
              })}
            </svg>
            {SRCS.map((s, i) => {
              const { len, pointAt, f0 } = GEOMS[i];
              const pt = pointAt(len * (f0 + (1 - f0) * conv));
              const size = conv < 0.75 ? lerp(conv / 0.75, 44, 15) : lerp((conv - 0.75) / 0.25, 15, 0);
              const appear = seg(t, 0.02 + i * 0.04, 0.12 + i * 0.04, EASE.overshoot);
              const appearOp = seg(t, 0.02 + i * 0.04, 0.08 + i * 0.04, EASE.out);
              const ph = (pk + i * 0.13) % 1;
              const pkOp = seg(t, 0.1, 0.16) * (1 - seg(t, 0.7, 0.76)) * (1 - Math.abs(ph - 0.5) * 0.6);
              const k = size / 44;
              return (
                <React.Fragment key={i}>
                  <div style={{ position: 'absolute', left: 74 - 30 - 120, top: s.y - 19, width: 112, textAlign: 'right', fontSize: 9.5, fontWeight: 600, color: C.muted, opacity: appearOp * labels, whiteSpace: 'nowrap' }}>{s.label}</div>
                  {pkOp > 0.01 && Array.from({ length: 9 }, (_, j) => 9 - j).map((j) => {
                    const pj = ph - j * 0.0055; if (pj < 0) return null;
                    const q = pointAt(len * (f0 + (1 - f0) * pj)); const r = 2.6 * (1 - j / 10);
                    return <div key={`t${j}`} style={{ position: 'absolute', left: 0, top: 0, width: r * 2, height: r * 2, borderRadius: '50%', background: ACCENT, transform: `translate(${(q.x - r).toFixed(2)}px,${(q.y - r).toFixed(2)}px)`, opacity: (pkOp * 0.38 * (1 - j / 10)).toFixed(3) }} />;
                  })}
                  {pkOp > 0.01 && (() => { const q = pointAt(len * (f0 + (1 - f0) * ph)); return (
                    <div style={{ position: 'absolute', left: 0, top: 0, width: 6, height: 6, borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, ${ACCENT_HI}, ${ACCENT})`, boxShadow: '0 0 0 1.5px rgba(31,157,92,0.16), 0 1px 3px rgba(31,157,92,0.45)', transform: `translate(${(q.x - 3).toFixed(2)}px,${(q.y - 3).toFixed(2)}px)`, opacity: pkOp.toFixed(3) }} />
                  ); })()}
                  <div style={{ position: 'absolute', left: 0, top: 0, borderRadius: '50%', background: 'linear-gradient(180deg, #ffffff 0%, #f6f7f5 100%)', border: `0.5px solid ${LINE}`, boxSizing: 'border-box',
                    boxShadow: `inset 0 0.5px 0 #fff, ${softShadow(2 + 4 * k, { strength: 0.8 })}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.c,
                    width: Math.max(0.1, size), height: Math.max(0.1, size), transform: `translate(${(pt.x - size / 2).toFixed(2)}px,${(pt.y - size / 2).toFixed(2)}px) scale(${appear.toFixed(3)})`,
                    opacity: (appearOp * (conv > 0.92 ? clamp01((1 - conv) / 0.08) : 1)).toFixed(3) }}>
                    <svg width={Math.max(0.1, size * 0.46)} height={Math.max(0.1, size * 0.46)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{ICON[s.icon]}</svg>
                  </div>
                </React.Fragment>
              );
            })}
            <div style={{ position: 'absolute', left: XC - BADGE / 2, top: YC - BADGE / 2, width: BADGE, height: BADGE, borderRadius: '50%', border: `0.75px solid ${ACCENT}`, boxSizing: 'border-box', transform: `scale(${lerp(ripple, 1, 2.1)})`, opacity: ripple > 0 && ripple < 1 ? (1 - ripple) * 0.55 : 0 }} />
            <div style={{ position: 'absolute', width: BADGE, height: BADGE, left: XC - BADGE / 2, top: YC - BADGE / 2, borderRadius: '50%', background: 'linear-gradient(180deg, #ffffff 0%, #f6f7f5 100%)', border: `0.5px solid ${LINE}`, boxSizing: 'border-box',
              boxShadow: `inset 0 0.5px 0 #fff, ${softShadow(8, { strength: 1 })}`, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: bp, transform: `scale(${badgeScale})` }}>
              <PulseMark size={30} />
            </div>
            <div style={{ position: 'absolute', left: XC - 140, width: 280, top: YC + 34, textAlign: 'center', fontSize: 13, fontWeight: 650, color: C.ink, opacity: cap, transform: `translateY(${((1 - cap) * 4).toFixed(2)}px)` }}>
              Maya answers them all.
            </div>
          </div>
        </div>
      </DesignStage>
      <PaperFinish />
    </AbsoluteFill>
  );
};
