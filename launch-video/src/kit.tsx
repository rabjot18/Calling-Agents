// Shared visual kit for the Pulse launch video. Tokens come from saas/DESIGN.md (see DESIGN-SPEC.md).
import React from 'react';
import { continueRender, delayRender, staticFile, useCurrentFrame } from 'remotion';
import { EASE, Grain, Vignette, mix, ramp } from './lib/Polish';

export const C = {
  cloth: '#1d3a30',
  paper: '#fbfcfa',
  sheet: '#ffffff',
  ink: '#16201b',
  muted: '#55655b',
  rule: '#e1e7e0',
  ribbon: '#b3261e',
  red: '#d23b31', // logo centre bar
  signal: '#3dd68c', // video-only extension: cloth hue raised to light (glow + pills on dark)
  pill: '#1f9d5c', // green pill carrying white text on paper
  night0: '#06100b',
  night1: '#0c1a13',
};

export const FONT = '"Archivo", -apple-system, "Helvetica Neue", Arial, sans-serif';

// Archivo variable font from the app's own build (has the wdth axis used by the app's `.cond` cut).
let fontHandle: number | null = null;
export const useArchivo = () => {
  const [h] = React.useState(() => {
    if (fontHandle !== null) return null;
    fontHandle = delayRender('Archivo');
    return fontHandle;
  });
  React.useEffect(() => {
    if (h === null) return;
    const files = ['db545dba463279ae-s.p.1cp9-4nby68jc.woff2', '068feab4deafcd0f-s.0_kz_z3o_slvt.woff2', '2e482247ef29dcb9-s.3gj6ciom31zjc.woff2'];
    Promise.all(
      files.map((f) => {
        const ff = new FontFace('Archivo', `url(${staticFile(`fonts/${f}`)}) format("woff2")`, { weight: '100 900', stretch: '62% 125%' });
        return ff.load().then((x) => (document.fonts as unknown as Set<FontFace>).add(x)).catch(() => undefined);
      }),
    ).then(() => continueRender(h));
  }, [h]);
};

// Condensed headline style (the app's `.cond`: font-stretch 80%).
export const cond = (size: number, weight = 800): React.CSSProperties => ({
  fontFamily: FONT, fontSize: size, fontWeight: weight, fontStretch: '80%', letterSpacing: '-0.01em', lineHeight: 1,
});
export const body = (size: number, weight = 500): React.CSSProperties => ({
  fontFamily: FONT, fontSize: size, fontWeight: weight, letterSpacing: '-0.005em', lineHeight: 1.2,
});

// ───────── blur-slide words (card: blur-slide; three channels share one p) ─────────
export type W = { t: string; at: number; dur?: number; pill?: 'green' | 'red' | 'signal'; color?: string; strikeAt?: number };
export const Words: React.FC<{
  words: W[]; size: number; dy?: number; blur?: number; gap?: string; style?: React.CSSProperties;
  color?: string; weight?: number; out?: number; outDur?: number; align?: 'left' | 'center';
}> = ({ words, size, dy, blur = 18, gap = '0.26em', style, color = C.ink, weight = 800, out, outDur = 8, align = 'center' }) => {
  const f = useCurrentFrame();
  const o = out === undefined ? 0 : ramp(f, out, outDur, EASE.exit);
  const DY = dy ?? size * 0.38;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: align === 'center' ? 'center' : 'flex-start', gap, whiteSpace: 'nowrap', fontSize: size,
      opacity: 1 - o, filter: o > 0.001 ? `blur(${(o * 14).toFixed(2)}px)` : undefined, transform: `translateY(${(-o * size * 0.2).toFixed(2)}px)`,
      ...style,
    }}>
      {words.map((w, i) => {
        const p = ramp(f, w.at, w.dur ?? 22, EASE.out);
        if (w.pill) return <Pill key={i} text={w.t} at={w.at} size={size} kind={w.pill} strikeAt={w.strikeAt} />;
        return (
          <span key={i} style={{
            ...cond(size, weight), color: w.color ?? color, display: 'inline-block', opacity: p,
            transform: `translateY(${((1 - p) * DY).toFixed(2)}px)`, filter: p >= 0.999 ? undefined : `blur(${((1 - p) * blur).toFixed(2)}px)`,
          }}>{w.t}</span>
        );
      })}
    </div>
  );
};

// Highlight pill: pops in with the one permitted overshoot (1.08) + blur, like the reference's green word pills.
export const Pill: React.FC<{ text: string; at: number; size: number; kind?: 'green' | 'red' | 'signal'; glow?: boolean; strikeAt?: number }> = ({ text, at, size, kind = 'green', glow = true, strikeAt }) => {
  const f = useCurrentFrame();
  const p = ramp(f, at, 16, EASE.overshoot);
  const o = ramp(f, at, 6, EASE.out);
  const bg = kind === 'red' ? `linear-gradient(180deg, #e0463b, ${C.ribbon})` : kind === 'signal' ? `linear-gradient(180deg, #5be3a1, ${C.signal})` : `linear-gradient(180deg, #27b16a, ${C.pill})`;
  const fg = kind === 'signal' ? '#06281a' : '#ffffff';
  const gc = kind === 'red' ? '210,59,49' : '61,214,140';
  return (
    <span style={{
      ...cond(size * 0.86, 800), color: fg, display: 'inline-flex', alignItems: 'center', position: 'relative', padding: `${size * 0.1}px ${size * 0.26}px ${size * 0.12}px`,
      borderRadius: size * 0.2, background: bg, opacity: o,
      transform: `scale(${mix(0.6, 1, p).toFixed(4)})`, transformOrigin: '20% 60%',
      filter: o < 0.999 ? `blur(${((1 - o) * 10).toFixed(2)}px)` : undefined,
      boxShadow: glow ? `inset 0 1px 0 rgba(255,255,255,0.35), 0 0 ${size * 0.5}px rgba(${gc},${(0.35 * o).toFixed(3)})` : 'inset 0 1px 0 rgba(255,255,255,0.35)',
    }}>
      {text}
      {strikeAt !== undefined && f >= strikeAt && (
        <span style={{ position: 'absolute', left: size * 0.16, top: '52%', height: Math.max(4, size * 0.07), borderRadius: 4, background: '#fbfcfa',
          width: `calc((100% - ${size * 0.32}px) * ${ramp(f, strikeAt, 8, EASE.snappy).toFixed(4)})`, transform: 'rotate(-2deg)', transformOrigin: '0 50%' }} />
      )}
    </span>
  );
};

// ───────── stages ─────────
export const NightStage: React.FC<{ glow?: number; children?: React.ReactNode }> = ({ glow = 0.5, children }) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: `linear-gradient(180deg, ${C.night1} 0%, ${C.night0} 70%)` }}>
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 55% 50% at 50% 42%, rgba(61,214,140,${(0.07 * glow).toFixed(3)}) 0%, rgba(61,214,140,0) 70%)` }} />
    {children}
    <Vignette strength={0.55} inner={0.42} color="#000000" />
    <Grain opacity={0.08} blend="soft-light" />
  </div>
);

export const PaperStage: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: `linear-gradient(180deg, #fdfefd 0%, ${C.paper} 55%, #f1f4f0 100%)` }}>
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 55% at 50% 20%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 72%)' }} />
    {children}
  </div>
);
export const PaperFinish: React.FC = () => (
  <>
    <Vignette strength={0.12} inner={0.55} color="#1d3a30" />
    <Grain opacity={0.04} />
  </>
);

// ───────── brand mark (same drawing as saas/src/app/icon.svg) ─────────
const BARS: [number, number][] = [[5, 6], [8.5, 11], [12, 15], [15.5, 8], [19, 4]];
export const PulseMark: React.FC<{ size: number; tone?: 'night' | 'paper'; style?: React.CSSProperties }> = ({ size, tone = 'paper', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', overflow: 'visible', ...style }}>
    <rect width="24" height="24" rx="6" fill={C.cloth} stroke={tone === 'night' ? 'rgba(61,214,140,0.45)' : 'none'} strokeWidth={0.4} />
    {BARS.map(([x, h]) => (
      <line key={x} x1={x} x2={x} y1={12 - h / 2} y2={12 + h / 2} stroke={x === 12 ? C.red : C.paper} strokeWidth="2.2" strokeLinecap="round" />
    ))}
  </svg>
);

export const Wordmark: React.FC<{ size: number; color?: string; gap?: number }> = ({ size, color = C.ink, gap }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: gap ?? size * 0.28 }}>
    <PulseMark size={size * 1.1} tone={color === C.ink ? 'paper' : 'night'} />
    <span style={{ ...cond(size, 800), color }}>Pulse</span>
  </div>
);
