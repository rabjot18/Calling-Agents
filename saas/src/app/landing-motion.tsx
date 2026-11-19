"use client";
import { motion, useInView, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

// Motion pieces for the landing page. Everything is paper in the appointment-book world: sheets lean toward the
// pointer, screens lie back on the desk and straighten as you reach them, conversations play out line by line.
// With reduced motion, each piece renders its finished, still state.

export const EASE = [0.16, 1, 0.3, 1] as const;

// The sheet leans toward a fine pointer, as if lifted at the corner. Touch devices get no tilt.
export function Tilt({ children, max = 5, className }: { children: React.ReactNode; max?: number; className?: string }) {
  const still = useReducedMotion();
  const [fine, setFine] = useState(false);
  useEffect(() => setFine(window.matchMedia("(pointer: fine)").matches), []);
  const rx = useSpring(0, { stiffness: 140, damping: 18 });
  const ry = useSpring(0, { stiffness: 140, damping: 18 });
  const on = fine && !still;
  return (
    <motion.div
      className={className}
      style={on ? { rotateX: rx, rotateY: ry, transformPerspective: 1500 } : undefined}
      onPointerMove={on ? (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 2 * max);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 2 * max);
      } : undefined}
      onPointerLeave={on ? () => { rx.set(0); ry.set(0); } : undefined}
    >
      {children}
    </motion.div>
  );
}

// A screen lying back on the desk that straightens as it reaches the middle of the viewport (scroll-linked).
export function ScrollTilt({ children, rotateX = 0, rotateY = 0, scale = 1, origin = "center bottom", className }: {
  children: React.ReactNode; rotateX?: number; rotateY?: number; scale?: number; origin?: string; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center 0.55"] });
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });
  const rX = useTransform(p, [0, 1], [rotateX, 0]);
  const rY = useTransform(p, [0, 1], [rotateY, 0]);
  const s = useTransform(p, [0, 1], [scale, 1]);
  return (
    <div ref={ref} className={className}>
      <motion.div style={still ? undefined : { rotateX: rX, rotateY: rY, scale: s, transformPerspective: 1800, transformOrigin: origin }}>{children}</motion.div>
    </div>
  );
}

// A short exchange that plays out once it's on screen: caller lines appear, Maya "types" for a moment, then answers.
// Every bubble is always in the layout (hidden ones keep their space), so nothing jumps.
type Line = { who: "Caller" | "Maya"; t: string };
export function Conversation({ lines, replay = false, className, bubbleClass = "" }: { lines: Line[]; replay?: boolean; className?: string; bubbleClass?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  const seen = useInView(ref, { once: true, amount: 0.5 });
  // 0 hidden · 1 typing · 2 shown. Server render shows everything; it hides only once the script is running.
  const [state, setState] = useState<number[]>(() => lines.map(() => (replay ? 0 : 2)));
  const armed = useRef(replay);
  useEffect(() => {
    if (still || armed.current) return;
    armed.current = true;
    const r = ref.current?.getBoundingClientRect();
    if (r && r.top < window.innerHeight * 0.5) return; // already read on load: leave it written
    setState(lines.map(() => 0));
  }, [still, lines]);
  const started = useRef(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const hidden = state.every((s) => s === 0);
  useEffect(() => {
    if (still || !seen || !hidden || started.current) return;
    started.current = true; // the timers own the sequence from here; re-renders must not restart or cancel it
    let at = 250;
    lines.forEach((l, i) => {
      if (l.who === "Maya") {
        timers.current.push(window.setTimeout(() => setState((s) => s.map((v, k) => (k === i ? 1 : v))), at));
        at += 750;
      }
      timers.current.push(window.setTimeout(() => setState((s) => s.map((v, k) => (k === i ? 2 : v))), at));
      at += l.who === "Maya" ? 900 : 650;
    });
  }, [seen, still, lines, hidden]);
  return (
    <div ref={ref} className={className}>
      {lines.map((l, i) => (
        <div key={i} data-s={still ? 2 : state[i]} className={`bubble talk ${l.who === "Caller" ? "caller" : "maya"} ${bubbleClass}`}>
          <b>{l.who}</b>
          <span className="say">{l.t}</span>
          <span className="dots" aria-hidden="true"><i /><i /><i /></span>
        </div>
      ))}
    </div>
  );
}

// Arms the CSS reveal system (.rv → .rv.in) once the script runs; without it, everything simply shows.
export function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = [...el.querySelectorAll<HTMLElement>(".rv")];
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { rootMargin: "0px 0px -12% 0px" },
    );
    // Anything already on screen at load stays put; only what's below the fold waits to arrive.
    targets.forEach((t) => { if (t.getBoundingClientRect().top < window.innerHeight * 0.9) t.classList.add("in"); else io.observe(t); });
    el.classList.add("armed");
    return () => io.disconnect();
  }, [root]);
}
