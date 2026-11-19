// P7 — "Stop sending customers to [voicemail.]" Reference: "Stop making content for [views.]" — blur-slide words,
// pill pops last; here the red pill is then struck through (a single 8f stroke) — voicemail is what Pulse replaces.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, ramp } from '../lib/Polish';
import { C, PaperFinish, PaperStage, Words } from '../kit';

export const Voicemail: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const exit = ramp(f, duration - 6, 6, EASE.exit);
  return (
    <AbsoluteFill>
      <PaperStage />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 480, opacity: 1 - exit, filter: exit > 0 ? `blur(${(exit * 14).toFixed(1)}px)` : undefined }}>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <Words words={[{ t: 'Stop', at: 0 }, { t: 'sending', at: 4 }, { t: 'customers', at: 8 }, { t: 'to', at: 12 }, { t: 'voicemail.', at: 18, pill: 'red', strikeAt: 40 }]} size={104} />
        </div>
      </div>
      <PaperFinish />
    </AbsoluteFill>
  );
};

