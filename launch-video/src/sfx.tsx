// Central SFX table. Every `at` is the ACTION frame, derived from SHOTS + an offset; `peak` is the file's measured
// energy-peak time (audio-manifest.json) so the audible hit lands on the action: Sequence from = at − peak·30.
// Only picture-unique actions get a sound (the BGM already carries the beat); repeats alternate samples and fall in volume.
// All files: Freesound CC0 previews — see public/audio/sfx/FREESOUND-CREDITS.md.
import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';
import { SHOTS, beatF, DROP_BEAT } from './timeline';

const S = SHOTS;
type Cue = { at: number; src: string; peak: number; volume: number; startFrom?: number; dur?: number; note: string };

const WHOOSH_A = { src: 'fs-683101.mp3', peak: 0.225 }; // quick woosh
const WHOOSH_B = { src: 'fs-838158.mp3', peak: 0.185 }; // whoosh
const SWOOSH = { src: 'fs-632763.mp3', peak: 0.075 }; // transition swoosh
const TYPING = 'fs-447909.mp3';
const CLICK = { src: 'fs-534103.mp3', peak: 0.035 };
const RISER = { src: 'fs-859482.mp3', peak: 2.285 };
const HIT = { src: 'fs-746474.mp3', peak: 0.615 };
const SHIMMER = { src: 'fs-714565.mp3', peak: 0.735 };
const POP = { src: 'fs-683587.mp3', peak: 0.005 };
const SCRIBBLE = 'fs-257518.mp3';

const drop = beatF(DROP_BEAT);
export const CUES: Cue[] = [
  // S1 pill slot: three swaps + the payoff (alternate samples, falling volume)
  { at: S.hook.from + 24, ...WHOOSH_A, volume: 0.45, note: 'pill 1 rolls in' },
  { at: S.hook.from + 46, ...WHOOSH_B, volume: 0.32, note: 'pill 2' },
  { at: S.hook.from + 68, ...WHOOSH_A, volume: 0.34, note: 'pill 3' },
  { at: S.hook.from + 90, ...WHOOSH_B, volume: 0.28, note: 'pill flies off, "a call." lands' },
  // S2 typewriter: windows cut from one keyboard take (typing / backspace / fast retype)
  { at: S.type.from + 20, src: TYPING, peak: 0, startFrom: 12, dur: 8, volume: 0.55, note: 'types "busy"' },
  { at: S.type.from + 42, src: TYPING, peak: 0, startFrom: 40, dur: 7, volume: 0.42, note: 'backspaces' },
  { at: S.type.from + 52, src: TYPING, peak: 0, startFrom: 54, dur: 24, volume: 0.55, note: 'retypes "with a customer?"' },
  // S3 riser peaks on the drop; a hit under the ring landing; shimmer under the tagline
  { at: drop, ...RISER, volume: 0.45, note: 'riser into the drop' },
  { at: drop, ...HIT, volume: 0.42, note: 'ring lands = drop' },
  { at: S.reveal.from + 190, ...SHIMMER, volume: 0.32, note: 'tagline' },
  // light-leak hand-off
  { at: S.today.from - 10, ...SWOOSH, volume: 0.5, note: 'green leak sweep → cut at peak' },
  // P2 camera push into the day column
  { at: S.today.from + 118 + 6, ...WHOOSH_B, volume: 0.24, note: 'push in' },
  // P3 badge receives the sources
  { at: S.converge.from + Math.round(0.72 * (S.converge.duration - 1)), ...POP, volume: 0.42, note: 'badge pulse' },
  // P4 toast
  { at: S.urgent.from + 26, ...WHOOSH_A, volume: 0.24, note: 'toast drops in' },
  { at: S.urgent.from + 30, ...POP, volume: 0.45, note: 'toast settles' },
  // P5 three clicks, falling volume
  { at: S.history.from + 44, ...CLICK, volume: 0.7, note: 'click Sara row' },
  { at: S.history.from + 88, ...CLICK, volume: 0.6, note: 'click Call back' },
  { at: S.history.from + 132, ...CLICK, volume: 0.52, note: 'click read-back line' },
  // P6 chips pop on the beat, brand lands
  { at: S.funnel.from + 4, ...POP, volume: 0.4, note: 'chip 38 calls' },
  { at: S.funnel.from + 19, ...POP, volume: 0.34, note: 'chip answered' },
  { at: S.funnel.from + 34, ...POP, volume: 0.3, note: 'chip booked' },
  { at: S.funnel.from + 48, ...POP, volume: 0.28, note: 'chip $' },
  { at: S.funnel.from + 72, ...SHIMMER, volume: 0.3, note: 'Pulse lands at the strip end' },
  // P7 strike through "voicemail"
  { at: S.voicemail.from + 40, src: SCRIBBLE, peak: 0, startFrom: 21, dur: 16, volume: 0.9, note: 'strike-through' },
  // O1 tag slides out; CTA pill
  { at: S.outro.from + 22, ...WHOOSH_A, volume: 0.3, note: 'tag slides out' },
  { at: S.outro.from + 134, ...SHIMMER, volume: 0.28, note: 'CTA pill' },
];

export const Sfx: React.FC = () => (
  <>
    {CUES.map((c, i) => {
      const from = Math.max(0, c.at - Math.round(c.peak * 30));
      return (
        <Sequence key={i} from={from} durationInFrames={c.dur ?? 150} name={`sfx: ${c.note}`}>
          <Audio src={staticFile(`audio/sfx/${c.src}`)} volume={c.volume} startFrom={c.startFrom ?? 0} />
        </Sequence>
      );
    })}
  </>
);
