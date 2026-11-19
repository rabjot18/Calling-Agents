// P1 + P2 — the real Today page (captured from the demo app) as a window card.
// P1 "Every call, [answered.]": the card tilts up from rotX 42° to flat (reference: tilted dashboard under a pill caption).
// P2 "Written straight into [your day.]": camera pushes into the day column while the afternoon's calls drop into their
// hour lines. Card: row-embed (demo RowEmbed.tsx) — cues spaced 10→7f (12/22/31/39/46 pattern), 12f flight with
// bezier(.5,0,.8,.75) so rows still carry speed into the slot, perspective translateY(−120·air) rotateX(16°·air),
// scale 1.06→0.995 then 4f press back to 1, slot patch = the sheet's sampled colour (#ffffff) + faint dashed slot,
// contact shadow tightens near landing, 2px seam from the centre out (5f) fading (8f) — here in Pulse green, clipped to the row.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { PageCam, type CamKey } from '../lib/PageCam';
import { EASE, ramp } from '../lib/Polish';
import { C, PaperFinish, PaperStage, Words } from '../kit';
import layout from '../layout.json';

const L = layout.today;
const SRC = 'textures/today.png';
const P2 = 118; // local frame where P2 starts (8 beats)
const ROWS = L.entries.slice(4); // 1:22 pm onward fill in during P2
const CUES = [P2 + 22, P2 + 32, P2 + 41, P2 + 49, P2 + 56];
const FLY = 12;
const FLY_EASE = Easing.bezier(0.5, 0, 0.8, 0.75);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const airOf = (f: number, cue: number) => 1 - interpolate(f, [cue, cue + FLY], [0, 1], { ...clamp, easing: FLY_EASE });

const KEYS: CamKey[] = [
  { frame: 0, cx: 714, cy: 600, zoom: 0.78, rotX: 46, persp: 1500 },
  { frame: 54, cx: 714, cy: 520, zoom: 0.84, rotX: 0, persp: 1500 },
  { frame: P2, cx: 700, cy: 520, zoom: 0.87, rotX: 0, persp: 1500 },
  { frame: P2 + 24, cx: 655, cy: 540, zoom: 1.6, rotX: 0, persp: 1500 },
  { frame: P2 + 80, cx: 655, cy: 630, zoom: 1.7, rotX: 0, persp: 1500 },
  { frame: 236, cx: 655, cy: 645, zoom: 1.72, rotX: 0, persp: 1500 },
];

export const Today: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const tex = staticFile(SRC);
  const rise = ramp(f, 0, 30, EASE.out);
  return (
    <AbsoluteFill>
      <PaperStage />
      <div style={{ position: 'absolute', left: 0, top: 96, width: 1920, height: 1080, opacity: rise }}>
        <PageCam src={SRC} pageH={L.pageH} keys={KEYS} bg="transparent" ease={Easing.bezier(0.45, 0, 0.15, 1)}
          card={{ w: 1430, h: 1080, radius: 22, shadow: '0 2px 0 rgba(255,255,255,0.9) inset, 0 40px 90px -20px rgba(29,58,48,0.35), 0 12px 30px rgba(29,58,48,0.12)' }}>
          {ROWS.map((r, i) => {
            const cue = CUES[i];
            const land = cue + FLY;
            const patch = interpolate(f, [land, land + 2], [1, 0], clamp);
            const hint = interpolate(f, [cue - 6, cue + 4], [0.55, 1], clamp);
            let flyer: React.ReactNode = null;
            let contact: React.ReactNode = null;
            if (f >= cue && f < land + 4) {
              const air = airOf(f, cue);
              const p = 1 - air;
              const scale = f < land ? 1.06 - 0.065 * p : interpolate(f, [land, land + 4], [0.995, 1], { ...clamp, easing: Easing.out(Easing.quad) });
              const vy = 120 * (airOf(f - 0.5, cue) - airOf(f + 0.5, cue));
              const mb = f < land ? Math.min(3.2, vy * 0.22) : 0;
              flyer = (
                <div style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, zIndex: 3, opacity: interpolate(f, [cue, cue + 3], [0, 1], clamp),
                  transform: `perspective(900px) translateY(${(-120 * air).toFixed(2)}px) rotateX(${(16 * air).toFixed(3)}deg) scale(${scale.toFixed(4)})`, filter: mb > 0.25 ? `url(#tmb-${i})` : undefined }}>
                  {mb > 0.25 && (<svg width={0} height={0} style={{ position: 'absolute' }}><filter id={`tmb-${i}`} x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation={`0 ${mb.toFixed(2)}`} /></filter></svg>)}
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff', backgroundImage: `url(${tex})`, backgroundSize: `1920px ${L.pageH}px`, backgroundPosition: `-${r.x}px -${r.y}px`,
                    boxShadow: `0 0 0 1px rgba(29,58,48,${(0.08 * air).toFixed(3)}), 0 ${(34 * air).toFixed(1)}px ${(64 * air).toFixed(1)}px -${(10 * air).toFixed(1)}px rgba(22,32,27,${(0.26 * air).toFixed(3)}), 0 ${(6 * air).toFixed(1)}px ${(14 * air).toFixed(1)}px rgba(22,32,27,${(0.1 * air).toFixed(3)})` }} />
                </div>
              );
              const near = interpolate(air, [0, 0.5], [1, 0], clamp);
              const cOp = f < land ? near * 0.5 : interpolate(f, [land, land + 3], [0.5, 0], clamp);
              contact = <div style={{ position: 'absolute', left: r.x + 10, top: r.y + 6, width: r.w - 20, height: r.h - 6, borderRadius: 10, zIndex: 2, boxShadow: `0 ${(2 + 6 * air).toFixed(1)}px ${(6 + 18 * air).toFixed(1)}px rgba(22,32,27,${(0.22 * cOp).toFixed(3)})` }} />;
            }
            let seam: React.ReactNode = null;
            if (f >= land && f < land + 8) {
              const spread = interpolate(f, [land, land + 5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
              const sw = r.w * spread;
              seam = <div style={{ position: 'absolute', left: r.x + (r.w - sw) / 2, top: r.y + r.h - 2, width: sw, height: 2, borderRadius: 1, zIndex: 4, opacity: interpolate(f, [land, land + 2, land + 8], [1, 1, 0], clamp),
                background: 'linear-gradient(90deg, rgba(31,157,92,0) 0%, #1f9d5c 18%, #3dd68c 50%, #1f9d5c 82%, rgba(31,157,92,0) 100%)', boxShadow: '0 0 7px rgba(61,214,140,0.5)' }} />;
            }
            return (
              <React.Fragment key={i}>
                {patch > 0 && (
                  <div style={{ position: 'absolute', left: r.x - 2, top: r.y - 4, width: r.w + 4, height: r.h + 8, background: C.sheet, opacity: patch, zIndex: 1 }}>
                    {f >= P2 && <div style={{ position: 'absolute', left: 8, top: 10, width: r.w - 16, height: r.h - 12, borderRadius: 8, border: '1px dashed rgba(29,58,48,0.22)', boxSizing: 'border-box', opacity: hint * ramp(f, P2, 10, EASE.out), background: 'rgba(29,58,48,0.02)' }} />}
                  </div>
                )}
                {contact}
                {flyer}
                {seam}
              </React.Fragment>
            );
          })}
        </PageCam>
      </div>
      {/* caption band: paper fades over the top of the page so the line reads clean */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 230, background: 'linear-gradient(180deg, rgba(251,252,250,1) 0%, rgba(251,252,250,0.94) 55%, rgba(251,252,250,0) 100%)' }} />
      <Words words={[{ t: 'Every', at: 6 }, { t: 'call,', at: 10 }, { t: 'answered.', at: 18, pill: 'green' }]} size={84} out={P2 - 10} style={{ position: 'absolute', left: 0, right: 0, top: 70 }} />
      <Words words={[{ t: 'Written', at: P2 }, { t: 'straight', at: P2 + 4 }, { t: 'into', at: P2 + 8 }, { t: 'your day.', at: P2 + 16, pill: 'green' }]} size={84} out={duration - 8} style={{ position: 'absolute', left: 0, right: 0, top: 70 }} />
      <PaperFinish />
    </AbsoluteFill>
  );
};
