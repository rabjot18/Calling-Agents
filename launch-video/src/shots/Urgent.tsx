// P4 — "Knows what's [urgent.]" Split layout like the reference ("And know which platform" + UI on the right):
// caption left, the real Today page right, the urgent row (red ribbon) lit, and a notification toast springs in
// (reference: "Call Booked" toast with a coloured glow from the bottom edge — here red, because urgent is red in Pulse).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { PageCam, type CamKey } from '../lib/PageCam';
import { springAt } from '../lib/Look';
import { EASE, mix, ramp, softShadow } from '../lib/Polish';
import { C, FONT, PaperFinish, PaperStage, Words, body, cond } from '../kit';
import layout from '../layout.json';

const L = layout.today;
const DANA = L.entries.find((e) => e.text.includes('Dana'))!;
const KEYS: CamKey[] = [
  { frame: 0, cx: DANA.x + 260, cy: DANA.y + 40, zoom: 1.32 },
  { frame: 103, cx: DANA.x + 240, cy: DANA.y + 34, zoom: 1.42 },
];
const TOAST_AT = 26;

export const Urgent: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const lit = ramp(f, 12, 14, EASE.out);
  const sp = f < TOAST_AT ? 0 : springAt(f, TOAST_AT, { damping: 14, stiffness: 190 });
  const glow = ramp(f, TOAST_AT, 20, EASE.out);
  const exit = ramp(f, duration - 7, 7, EASE.exit);
  return (
    <AbsoluteFill>
      <PaperStage />
      <div style={{ position: 'absolute', left: 360, top: 0, width: 1920, height: 1080 }}>
        <PageCam src="textures/today.png" pageH={L.pageH} keys={KEYS} bg="transparent"
          card={{ w: 1430, h: 1080, radius: 22, shadow: '0 40px 90px -20px rgba(29,58,48,0.35), 0 12px 30px rgba(29,58,48,0.12)' }}>
          {/* urgent row lit: red hairline frame + soft red bloom, clipped to the row's rounded box */}
          <div style={{ position: 'absolute', left: DANA.x - 6, top: DANA.y - 6, width: DANA.w + 12, height: DANA.h + 12, borderRadius: 12, opacity: lit,
            boxShadow: `0 0 0 2px rgba(210,59,49,0.85), 0 0 34px rgba(210,59,49,${(0.35 * lit).toFixed(3)})`, background: 'rgba(210,59,49,0.04)' }} />
        </PageCam>
      </div>
      {/* bottom-edge glow, the reference's colour wash, in ribbon red */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 520, opacity: glow * 0.9, background: 'radial-gradient(ellipse 70% 100% at 62% 100%, rgba(210,59,49,0.30) 0%, rgba(210,59,49,0.10) 45%, rgba(210,59,49,0) 75%)' }} />
      {/* left caption over a paper fade */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 900, background: 'linear-gradient(90deg, rgba(251,252,250,1) 0%, rgba(251,252,250,0.96) 62%, rgba(251,252,250,0) 100%)' }} />
      <div style={{ position: 'absolute', left: 140, top: 400, opacity: 1 - exit }}>
        <Words words={[{ t: 'Knows', at: 2 }, { t: "what's", at: 6 }]} size={104} align="left" />
        <div style={{ marginTop: 18 }}><Words words={[{ t: 'urgent.', at: 14, pill: 'red' }]} size={104} align="left" /></div>
        <div style={{ ...body(28, 500), color: C.muted, marginTop: 30, width: 560, opacity: ramp(f, 30, 16, EASE.out) }}>Emergencies jump the queue and reach you first.</div>
      </div>
      {/* toast */}
      <div style={{
        position: 'absolute', right: 120, top: 120, width: 660, borderRadius: 22, padding: '24px 28px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.97)',
        border: '1px solid rgba(22,32,27,0.08)', boxShadow: `${softShadow(30, { strength: 1.3 })}, 0 30px 80px -10px rgba(210,59,49,${(0.35 * glow).toFixed(3)})`,
        opacity: Math.min(1, sp * 1.6) * (1 - exit), transform: `translateY(${mix(-220, 0, sp).toFixed(2)}px) scale(${mix(0.92, 1, sp).toFixed(4)})`, fontFamily: FONT,
        display: 'flex', gap: 22, alignItems: 'flex-start',
      }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(210,59,49,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={30} height={36} viewBox="0 0 10 12"><path d="M0 0h10v12L5 8.6 0 12z" fill={C.ribbon} /></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ ...cond(36, 800), color: C.ink }}>Urgent call · Dana Ruiz</span>
            <span style={{ ...body(22, 500), color: C.muted }}>now</span>
          </div>
          <div style={{ ...body(25, 500), color: C.ink, marginTop: 10, lineHeight: 1.35 }}>Scalp reaction after Monday&apos;s colour. Wants a call back today.</div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <span style={{ ...body(22, 650), color: '#fff', background: C.cloth, padding: '9px 18px', borderRadius: 10 }}>Call back</span>
            <span style={{ ...body(22, 600), color: C.ink, border: '1px solid rgba(22,32,27,0.14)', padding: '8px 18px', borderRadius: 10 }}>Open call</span>
          </div>
        </div>
      </div>
      <PaperFinish />
    </AbsoluteFill>
  );
};
