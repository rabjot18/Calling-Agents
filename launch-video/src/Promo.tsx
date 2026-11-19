// Pulse launch film. Timing lives in timeline.ts (beat grid); shots are self-contained in src/shots.
import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from 'remotion';
import { DROP_BEAT, FPS, LEAK, MUSIC_START_S, SHOTS, TOTAL, beatF } from './timeline';
import { useArchivo } from './kit';
import { Hook } from './shots/Hook';
import { Typewriter } from './shots/Typewriter';
import { Reveal } from './shots/Reveal';
import { Leak } from './shots/Leak';
import { Today } from './shots/Today';
import { Converge } from './shots/Converge';
import { Urgent } from './shots/Urgent';
import { History } from './shots/History';
import { Funnel } from './shots/Funnel';
import { Voicemail } from './shots/Voicemail';
import { Outro } from './shots/Outro';
import { Sfx } from './sfx';
import { Voiceover, duckAt } from './vo';

export const Promo: React.FC<{ bgm: boolean }> = ({ bgm }) => {
  useArchivo();
  const s = SHOTS;
  const seq = (k: keyof typeof SHOTS, el: React.ReactNode) => (
    <Sequence key={k} from={s[k].from} durationInFrames={s[k].duration} name={k}>{el}</Sequence>
  );
  return (
    <AbsoluteFill style={{ background: '#06100b' }}>
      {seq('hook', <Hook duration={s.hook.duration} />)}
      {seq('type', <Typewriter duration={s.type.duration} />)}
      {seq('reveal', <Reveal duration={s.reveal.duration} dropAt={beatF(DROP_BEAT) - s.reveal.from} />)}
      {seq('today', <Today duration={s.today.duration} />)}
      {seq('converge', <Converge duration={s.converge.duration} />)}
      {seq('urgent', <Urgent duration={s.urgent.duration} />)}
      {seq('history', <History duration={s.history.duration} />)}
      {seq('funnel', <Funnel duration={s.funnel.duration} />)}
      {seq('voicemail', <Voicemail duration={s.voicemail.duration} />)}
      {seq('outro', <Outro duration={s.outro.duration} />)}
      <Sequence from={LEAK.peak - LEAK.pre} durationInFrames={LEAK.pre + LEAK.post} name="leak"><Leak pre={LEAK.pre} post={LEAK.post} /></Sequence>
      <Sfx />
      <Voiceover />
      {bgm && (
        <Audio src={staticFile('audio/bgm.mp3')} startFrom={Math.round(MUSIC_START_S * FPS)}
          volume={(f) => duckAt(f) * interpolate(f, [0, 8, TOTAL - 45, TOTAL - 1], [0, 0.7, 0.7, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      )}
    </AbsoluteFill>
  );
};
