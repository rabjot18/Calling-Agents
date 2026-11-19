// O1 — dark close. Reference: orb → "● Pulse" with a glowing green tag sliding out ("Intelligent tracking for content
// funnels") → "Start your [Free trial] today."  Pulse: the lockup (already introduced on the drop) blurs in — no second
// collapse, one technique one lead — the signal-green tag slides out from behind the wordmark and the group re-centres
// as it grows; then the CTA lands with the signal pill and holds well past 1s.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, ramp } from '../lib/Polish';
import { C, NightStage, PulseMark, Words, body, cond } from '../kit';

const TAG = 'Answers. Books. Remembers.';
const TAG_W = 560;

export const Outro: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const inn = ramp(f, 0, 18, EASE.out);
  const tag = ramp(f, 22, 22, EASE.snappy);
  const tagText = ramp(f, 34, 14, EASE.out);
  const lockOut = ramp(f, 104, 10, EASE.exit);
  const CTA = 114;
  return (
    <AbsoluteFill>
      <NightStage glow={0.8} />
      {lockOut < 1 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: inn * (1 - lockOut),
          filter: inn < 0.999 || lockOut > 0 ? `blur(${((1 - inn) * 18 + lockOut * 16).toFixed(1)}px)` : undefined, transform: `scale(${(0.96 + 0.04 * inn).toFixed(4)})` }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <PulseMark size={128} tone="night" />
            <span style={{ ...cond(140, 800), color: '#f3f7f4', marginLeft: 34, textShadow: '0 0 40px rgba(61,214,140,0.22)' }}>Pulse</span>
            <div style={{ width: TAG_W * tag, marginLeft: 30 * tag, height: 112, overflow: 'hidden', borderRadius: 18, position: 'relative',
              background: 'linear-gradient(90deg, rgba(61,214,140,0.95), rgba(46,190,120,0.75))', boxShadow: `0 0 ${60 * tag}px rgba(61,214,140,0.55)` }}>
              <div style={{ position: 'absolute', left: 30, top: 0, height: 112, width: TAG_W - 50, display: 'flex', alignItems: 'center', ...body(34, 700), color: '#05261a', whiteSpace: 'nowrap', opacity: tagText,
                transform: `translateX(${((1 - tagText) * 20).toFixed(1)}px)`, filter: tagText < 0.999 ? `blur(${((1 - tagText) * 6).toFixed(1)}px)` : undefined }}>{TAG}</div>
            </div>
          </div>
        </div>
      )}
      {f >= CTA - 1 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 440 }}>
          <Words words={[{ t: 'Start', at: CTA }, { t: 'answering', at: CTA + 4 }, { t: 'every', at: CTA + 8 }, { t: 'call', at: CTA + 12 }, { t: 'today.', at: CTA + 20, pill: 'signal' }]} size={112} color={C.paper} />
          <div style={{ marginTop: 44, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, opacity: ramp(f, CTA + 32, 16, EASE.out), transform: `translateY(${((1 - ramp(f, CTA + 32, 16, EASE.out)) * 12).toFixed(1)}px)` }}>
            <PulseMark size={44} tone="night" />
            <span style={{ ...cond(40, 800), color: '#f3f7f4' }}>Pulse</span>
            <span style={{ ...body(30, 500), color: 'rgba(251,252,250,0.6)', marginLeft: 10 }}>Set up your receptionist in 10 minutes.</span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
