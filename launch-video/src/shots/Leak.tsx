// T1 — dark → paper hand-off. Card: transition-hidden-cut C light-leak-burn (demo LightLeakBurn.tsx):
// a three-tone leak sweeps on a diagonal; at its peak it swallows >70% of the frame and the hard cut to the new
// scene happens inside that peak; the leak then clears off with the new scene already in place.
// Re-coloured from warm amber to Pulse greens (cloth → signal → mint core). Used once in the film (Q4).
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export const Leak: React.FC<{ pre: number; post: number }> = ({ pre, post }) => {
  const f = useCurrentFrame();
  const x = interpolate(f, [0, pre, pre + post], [-1.15, 0, 1.25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const env = interpolate(f, [0, pre - 3, pre + 2, pre + post], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const flash = interpolate(f, [pre - 5, pre, pre + 6], [0, 0.9, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: -800, height: 2680, width: 3600, left: 960 - 1800 + x * 2600, transform: 'rotate(-20deg)', opacity: env,
        background: 'linear-gradient(90deg, rgba(29,58,48,0) 0%, rgba(29,58,48,0.55) 18%, rgba(61,214,140,0.85) 34%, #eafff3 47%, #f6fff9 53%, rgba(61,214,140,0.85) 66%, rgba(29,58,48,0.5) 82%, rgba(29,58,48,0) 100%)',
        filter: 'blur(40px)',
      }} />
      <div style={{ position: 'absolute', inset: 0, opacity: flash, background: 'radial-gradient(ellipse 80% 80% at 50% 50%, #f4fff8 0%, rgba(160,240,200,0.9) 55%, rgba(61,214,140,0.6) 100%)' }} />
    </AbsoluteFill>
  );
};
