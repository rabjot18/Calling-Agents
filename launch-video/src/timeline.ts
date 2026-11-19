// Single source of truth for timing. Every shot boundary sits on the BGM beat grid.
// BGM: Mixkit "House Vibez" — librosa grid fit 122.006 BPM (T = 0.49178 s, residual ≤19 ms).
// The film starts at music time 49.27 s (bar 22, on-grid). Beat 28 = 63.04 s = the drop (bar 29).
export const FPS = 30;
export const T_BEAT = 0.49178;
export const MUSIC_START_S = 49.27;
export const beatF = (n: number) => Math.round(n * T_BEAT * FPS);

export const DROP_BEAT = 28;

// [from beat, to beat]
const B = {
  hook: [0, 10], // S1 "You just missed [pill-slot]"
  type: [10, 19], // S2 typewriter error-retype
  reveal: [19, 35], // S3 "Meet" → ring collapse on the drop → lockup
  today: [35, 51], // P1+P2 Today page tilt-up + row-embed
  converge: [51, 60], // P3 sources converge into Pulse
  urgent: [60, 67], // P4 urgent toast
  history: [67, 79], // P5 cursor flyover on call history
  funnel: [79, 87], // P6 funnel chips
  voicemail: [87, 92], // P7 "Stop sending customers to voicemail"
  outro: [92, 108], // O1 lockup tag + CTA
} as const;

export type ShotKey = keyof typeof B;
export const SHOTS = Object.fromEntries(
  Object.entries(B).map(([k, [a, b]]) => [k, { from: beatF(a), duration: beatF(b) - beatF(a), beatFrom: a, beatTo: b }]),
) as Record<ShotKey, { from: number; duration: number; beatFrom: number; beatTo: number }>;

export const TOTAL = beatF(B.outro[1]);
// Light-leak hand-off (dark → paper), hard cut hidden in the peak at the start of `today`.
export const LEAK = { peak: SHOTS.today.from, pre: 14, post: 22 };
