// P5 — "Every call, [summarised.]" Cursor tour of the real Call history page.
// Card: cursor-flyover (demo CursorFlyover.tsx). Kept: camera table interpolated with bezier(.55,0,.18,1) (crisp start,
// soft landing), ~8% hop out between stations, directional SpeedBlur (amount .09, max 8); the cursor is the hand, the
// camera the eye — cursor leaves 2f earlier on a light arc (swift 16f), camera flies 20f, cursor aims a beat then presses
// (3f to 0.84, overshoot back) at leg+22; 18f ring ripple per click (0.3→1.5); cursor drawn in screen space at a fixed 40px.
// Stations (page CSS px from layout + the 2x capture): Sara's row → "Call back" → the name read-back line in the transcript.
// Three stations instead of four (shot budget 177f); no pull-back — the shot ends holding on the transcript.
import React from 'react';
import { AbsoluteFill, staticFile, Img, useCurrentFrame } from 'remotion';
import { EASE, SpeedBlur, bezier, mix, ramp } from '../lib/Polish';
import { C, PaperFinish, PaperStage, Words } from '../kit';
import layout from '../layout.json';

const PH = layout.historySara.pageH;
const SPELL = layout.historySara.transcript[4]; // "Let me make sure I have that right: S for sun, A for apple…"
const TARGETS = [
  { x: 560, y: 823 }, // Sara Mendes row
  { x: 1044, y: 504 }, // Call back button
  { x: SPELL.x + 240, y: SPELL.y + 22 }, // read-back line
];
const CAMS = [
  { x: 900, y: 560, s: 0.84 },
  { x: 640, y: 760, s: 1.45 },
  { x: 1100, y: 470, s: 1.5 },
  { x: 1140, y: 800, s: 1.62 },
];
const LEG0 = 22, LEG = 44;
const legStart = (k: number) => LEG0 + k * LEG;
const clickAt = (k: number) => legStart(k) + 22;
const CAM_EASE = bezier(0.55, 0, 0.18, 1);

const camAt = (f: number) => {
  let { x, y, s } = CAMS[0];
  s *= mix(0.94, 1, ramp(f, 0, 22, EASE.snappy));
  let hop = 0;
  for (let k = 0; k < 3; k++) {
    const u = ramp(f, legStart(k) + 2, 20, CAM_EASE);
    const to = CAMS[k + 1];
    x = mix(x, to.x, u); y = mix(y, to.y, u); s = mix(s, to.s, u);
    if (k > 0 && u > 0 && u < 1) hop = 0.08 * Math.sin(Math.PI * u);
  }
  return { x, y, s: s * (1 - hop) * (1 + 0.012 * ramp(f, clickAt(2) + 10, 30, EASE.smooth)) };
};
const cursorAt = (f: number) => {
  let x = 1000, y = 640;
  for (let k = 0; k < 3; k++) {
    const u = ramp(f, legStart(k), 16, EASE.swift);
    const to = TARGETS[k];
    const dx = to.x - x, dy = to.y - y, len = Math.max(1, Math.hypot(dx, dy));
    const bow = Math.sin(Math.PI * u) * Math.min(90, len * 0.12);
    const nx = mix(x, to.x, u) + (-dy / len) * bow, ny = mix(y, to.y, u) + (dx / len) * bow;
    x = nx; y = ny;
  }
  return { x, y };
};

const Cursor: React.FC<{ press: number }> = ({ press }) => (
  <svg viewBox="0 0 24 24" width={40} height={40} style={{ position: 'absolute', left: -3, top: -2, overflow: 'visible', filter: 'drop-shadow(0 2px 2px rgba(12,26,20,0.35)) drop-shadow(0 8px 12px rgba(12,26,20,0.25))', transform: `scale(${(1 - 0.16 * press).toFixed(3)})`, transformOrigin: '3px 2px' }}>
    <path d="M4.5 2.5 L4.5 19.2 L8.9 15 L11.9 21.6 L14.9 20.3 L11.9 13.8 L18.2 13.4 Z" fill="#0d1a14" stroke="#ffffff" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
);

export const History: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const cam = camAt(f);
  const scr = (ff: number) => { const c = camAt(ff); return { x: 960 - c.x * c.s, y: 560 - c.y * c.s }; };
  const a = scr(f + 0.5), b = scr(f - 0.5);
  const cur = cursorAt(f);
  const cx = 960 + (cur.x - cam.x) * cam.s, cy = 560 + (cur.y - cam.y) * cam.s;
  let press = 0, ripple = -1;
  for (let k = 0; k < 3; k++) {
    const pf = f - clickAt(k);
    if (pf > -2 && pf < 8) press = Math.max(press, pf < 1 ? ramp(pf, -2, 3, EASE.swift) : 1 - ramp(pf, 1, 6, EASE.overshoot));
    if (pf >= 0 && pf < 18) ripple = pf / 18;
  }
  // station 3 response: marker sweeps under the read-back sentence
  const mark = ramp(f, clickAt(2) + 2, 16, EASE.snappy);
  const intro = ramp(f, 0, 12, EASE.out);
  return (
    <AbsoluteFill>
      <PaperStage />
      <SpeedBlur vx={a.x - b.x} vy={a.y - b.y} amount={0.09} max={8}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: PH, transformOrigin: '0 0', opacity: intro,
          transform: `translate(${(960 - cam.x * cam.s).toFixed(2)}px, ${(560 - cam.y * cam.s).toFixed(2)}px) scale(${cam.s.toFixed(5)})` }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 1832, height: PH, borderRadius: 22, overflow: 'hidden', boxShadow: '0 40px 90px -20px rgba(29,58,48,0.35), 0 12px 30px rgba(29,58,48,0.12)' }}>
            <Img src={staticFile('textures/history-sara.png')} style={{ position: 'absolute', width: 1920, height: PH }} />
            {mark > 0 && (
              <div style={{ position: 'absolute', left: SPELL.x + 64, top: SPELL.y + 6, height: SPELL.h - 10, width: (SPELL.w - 60) * mark, borderRadius: 6, background: 'rgba(61,214,140,0.22)', boxShadow: 'inset 0 -3px 0 rgba(31,157,92,0.55)' }} />
            )}
          </div>
        </div>
      </SpeedBlur>
      {ripple >= 0 && (
        <div style={{ position: 'absolute', left: cx - 40, top: cy - 40, width: 80, height: 80, borderRadius: 40, border: `3px solid rgba(31,157,92,${((1 - ripple) * 0.9).toFixed(3)})`, background: `rgba(61,214,140,${((1 - ripple) * 0.14).toFixed(3)})`, transform: `scale(${(0.3 + EASE.out(ripple) * 1.2).toFixed(3)})` }} />
      )}
      <div style={{ position: 'absolute', left: cx, top: cy, opacity: intro }}><Cursor press={press} /></div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 230, background: 'linear-gradient(180deg, rgba(251,252,250,1) 0%, rgba(251,252,250,0.94) 55%, rgba(251,252,250,0) 100%)' }} />
      <Words words={[{ t: 'Every', at: 4 }, { t: 'call,', at: 8 }, { t: 'summarised.', at: 16, pill: 'green' }]} size={84} out={LEG0 + 2 * LEG - 6} style={{ position: 'absolute', left: 0, right: 0, top: 70 }} />
      <Words words={[{ t: 'Names', at: LEG0 + 2 * LEG }, { t: 'spelled', at: LEG0 + 2 * LEG + 4 }, { t: 'back,', at: LEG0 + 2 * LEG + 8 }, { t: 'letter by letter.', at: LEG0 + 2 * LEG + 16, pill: 'green' }]} size={84} out={duration - 8} style={{ position: 'absolute', left: 0, right: 0, top: 70 }} />
      <PaperFinish />
    </AbsoluteFill>
  );
};
