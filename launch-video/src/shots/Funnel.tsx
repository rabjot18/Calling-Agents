// P6 — "This week, [on autopilot.]" Funnel chips slide along a conveyor, counters roll, the strip ends on ● Pulse.
// Reference: "2.7K Clicks → [2.5%] → 0 Leads → 39 Calls → 16 Customers ● Pulse" sliding strip. No card covers this
// exactly; built from the library's DigitRoll (odometer) + the film's motion tokens: snappy 12f strip steps on the beat,
// chips pop with the overshoot token, one item per beat, then a 1s+ hold on the landed strip (the third slam).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { DigitRoll } from '../lib/DigitRoll';
import { EASE, mix, ramp } from '../lib/Polish';
import { C, PaperFinish, PaperStage, PulseMark, Words, cond } from '../kit';
import { T_BEAT, FPS } from '../timeline';

const BEAT = T_BEAT * FPS;
type Item = { kind: 'chip'; value: string; label: string; w: number } | { kind: 'arrow'; note: string; w: number } | { kind: 'brand'; w: number };
const ITEMS: Item[] = [
  { kind: 'chip', value: '38', label: 'calls', w: 330 },
  { kind: 'arrow', note: '100%', w: 120 },
  { kind: 'chip', value: '38', label: 'answered', w: 420 },
  { kind: 'arrow', note: '37%', w: 120 },
  { kind: 'chip', value: '14', label: 'booked', w: 360 },
  { kind: 'arrow', note: '≈ $117 each', w: 120 },
  { kind: 'chip', value: '$1,640', label: 'in bookings', w: 560 },
  { kind: 'brand', w: 300 },
];
const GAP = 30;
const X: number[] = [];
ITEMS.reduce((acc, it, i) => { X[i] = acc; return acc + it.w + GAP; }, 0);
// chip k (and its arrow) on beat k; brand on beat 4.5
const APPEAR = ITEMS.map((it, i) => Math.round((it.kind === 'brand' ? 4.6 : Math.floor(i / 2) + (i % 2) * 0.45) * BEAT) + 4);

export const Funnel: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  // strip offset: keep the newest item right of centre; at the end centre the last chip + brand
  let off = 960 - (X[0] + ITEMS[0].w / 2);
  ITEMS.forEach((it, i) => {
    if (i === 0) return;
    const target = i === ITEMS.length - 1 ? 960 - (X[6] + (X[7] + ITEMS[7].w - X[6]) / 2) : 1180 - (X[i] + it.w / 2);
    off = mix(off, Math.min(target, off), ramp(f, APPEAR[i] - 2, 12, EASE.snappy));
  });
  const exit = ramp(f, duration - 7, 7, EASE.exit);
  return (
    <AbsoluteFill>
      <PaperStage />
      <Words words={[{ t: 'This', at: 0 }, { t: 'week,', at: 4 }, { t: 'on autopilot.', at: 12, pill: 'green' }]} size={84} out={duration - 8} style={{ position: 'absolute', left: 0, right: 0, top: 220 }} />
      <div style={{ position: 'absolute', left: 0, top: 560, transform: `translateX(${off.toFixed(2)}px)`, opacity: 1 - exit, filter: exit > 0 ? `blur(${(exit * 12).toFixed(1)}px)` : undefined }}>
        {ITEMS.map((it, i) => {
          const p = ramp(f, APPEAR[i], 14, EASE.overshoot);
          const o = ramp(f, APPEAR[i], 6, EASE.out);
          const common: React.CSSProperties = { position: 'absolute', left: X[i], top: 0, transform: `translateY(-50%) scale(${mix(0.7, 1, p).toFixed(4)})`, opacity: o, filter: o < 0.999 ? `blur(${((1 - o) * 10).toFixed(1)}px)` : undefined };
          if (it.kind === 'chip') {
            return (
              <div key={i} style={{ ...common, width: it.w, height: 124, borderRadius: 22, background: `linear-gradient(180deg, #22302a, ${C.ink})`, boxShadow: '0 24px 50px -16px rgba(22,32,27,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                <span style={{ ...cond(64, 800), display: 'inline-flex' }}><DigitRoll value={it.value} delay={APPEAR[i] + 2} fontSize={64} color="#ffffff" /></span>
                <span style={{ ...cond(52, 650), color: 'rgba(251,252,250,0.6)' }}>{it.label}</span>
              </div>
            );
          }
          if (it.kind === 'arrow') {
            return (
              <div key={i} style={{ ...common, width: it.w, height: 124, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 96, height: 96, borderRadius: 22, background: `linear-gradient(180deg, #27b16a, ${C.pill})`, boxShadow: '0 0 34px rgba(61,214,140,0.45), inset 0 1px 0 rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width={46} height={46} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </div>
                <div style={{ ...cond(26, 750), color: C.pill, marginTop: 10, background: 'rgba(31,157,92,0.1)', padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>{it.note}</div>
              </div>
            );
          }
          return (
            <div key={i} style={{ ...common, width: it.w, height: 124, display: 'flex', alignItems: 'center', gap: 20, paddingLeft: 20 }}>
              <PulseMark size={92} />
              <span style={{ ...cond(92, 800), color: C.ink }}>Pulse</span>
            </div>
          );
        })}
      </div>
      <PaperFinish />
    </AbsoluteFill>
  );
};
