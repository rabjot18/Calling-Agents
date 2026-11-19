"use client";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

// Honour the OS "reduce motion" setting everywhere. Motion here only ever reports a state change.
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export const spring = { type: "spring", stiffness: 520, damping: 40 } as const;

// Shown while an uploaded menu or price list is being read: a line moves down the page like a finger reading it.
export function ScanPreview({ src, label }: { src?: string; label: string }) {
  return (
    <div className="sheet relative w-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="w-full max-h-64 object-cover opacity-70" /> : <div className="h-40 bg-[repeating-linear-gradient(180deg,#fff_0_27px,var(--rule)_27px_28px)]" />}
      <motion.div aria-hidden="true" className="absolute inset-x-0 h-0 border-t-2 border-[var(--pen)] shadow-[0_0_0_6px_rgba(36,71,122,.12)]"
        initial={{ top: "8%" }} animate={{ top: ["8%", "92%"] }} transition={{ duration: 1.8, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }} />
      <p className="absolute bottom-3 left-3 bg-white border border-[var(--rule)] rounded-[4px] px-2.5 py-1 text-sm font-semibold" aria-live="polite">{label}</p>
    </div>
  );
}

// Setup is a book: moving to the next step turns the page over the left spine (back turns it the other way).
// The new step is already in place underneath, so nothing waits on the animation. Survives remounts between
// steps that render different layouts, so every step change turns a page.
let lastTurnKey: string | null = null;
export function PageTurn({ turnKey, dir, className = "", children }: { turnKey: string; dir: 1 | -1; className?: string; children: ReactNode }) {
  const still = useReducedMotion();
  const [leaf, setLeaf] = useState<{ id: number; dir: 1 | -1 } | null>(null);
  const n = useRef(0);
  useEffect(() => {
    if (lastTurnKey !== null && lastTurnKey !== turnKey && !still) setLeaf({ id: ++n.current, dir });
    lastTurnKey = turnKey;
  }, [turnKey, dir, still]);
  return (
    <div className={`relative ${className}`}>
      {children}
      <AnimatePresence>
        {leaf && (
          <motion.div key={leaf.id} aria-hidden="true" className="turn-leaf"
            initial={{ rotateY: 0 }} animate={{ rotateY: leaf.dir > 0 ? -178 : 178 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.62, ease: [0.62, 0, 0.3, 1] }} onAnimationComplete={() => setLeaf(null)}
            style={{ transformOrigin: leaf.dir > 0 ? "left center" : "right center", transformPerspective: 2200 }}>
            <motion.span className="turn-shade" initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} transition={{ duration: 0.6 }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Progress segments fill from where the owner was to where they are now.
let lastSection = 0;
export function StepFill({ section, total = 5 }: { section: number; total?: number }) {
  const from = useRef(lastSection);
  useEffect(() => { lastSection = section; }, [section]);
  return (
    <div className="mt-1.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }} aria-hidden="true">
      {Array.from({ length: total }, (_, k) => k + 1).map((n) => (
        <span key={n} className="h-1 rounded-full bg-[var(--rule)] overflow-hidden">
          <motion.span className="block h-full bg-[var(--cloth)] origin-left"
            initial={{ scaleX: n <= from.current ? 1 : 0 }} animate={{ scaleX: n <= section ? 1 : 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: n > from.current ? 0.15 + (n - from.current - 1) * 0.1 : 0 }} />
        </span>
      ))}
    </div>
  );
}
