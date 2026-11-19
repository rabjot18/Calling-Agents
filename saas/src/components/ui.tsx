"use client";
import type { ReactNode } from "react";

// The primary action. Kept under its old name so every step reads the same.
export function SlideButton({ label, onClick, disabled, type = "button" }: { label: string; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button type={type} className="btn btn-lg w-full sm:w-auto sm:min-w-[180px]" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

// Pulse mark: a book-cloth tile holding a voice pulse. Five uneven bars read as speech; the tallest,
// in ribbon red, is the call that just came in. Same drawing as src/app/icon.svg (the favicon).
const PULSE_BARS: [x: number, h: number][] = [[5, 6], [8.5, 11], [12, 15], [15.5, 8], [19, 4]];
export function PulseMark({ light = false, size = 22 }: { light?: boolean; size?: number }) {
  const bar = light ? "#1d3a30" : "#fbfcfa";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill={light ? "#eaf1ec" : "#1d3a30"} />
      {PULSE_BARS.map(([x, h]) => (
        <line key={x} x1={x} x2={x} y1={12 - h / 2} y2={12 + h / 2} stroke={x === 12 ? "#d23b31" : bar} strokeWidth="2.2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

export function Logo({ light = false, size = 22 }: { light?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5" style={{ color: light ? "var(--cloth-ink)" : "var(--ink)" }}>
      <PulseMark light={light} size={size + 2} />
      <span className="cond font-bold tracking-tight" style={{ fontSize: size * 1.05 }}>Pulse</span>
    </span>
  );
}

export function Stack({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-4 ${className}`}>{children}</div>;
}

const Svg = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
export const BackIcon = () => <Svg size={20}><path d="M15 18l-6-6 6-6" /></Svg>;
export const TodayIcon = () => <Svg><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" /><path d="M8 14h4" /></Svg>;
export const InboxIcon = () => <Svg><path d="M4 13.5l2.2-7.1A2 2 0 0 1 8.1 5h7.8a2 2 0 0 1 1.9 1.4L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z" /><path d="M4 13.5h4.5l1.2 2h4.6l1.2-2H20" /></Svg>;
export const BookIcon = () => <Svg><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15.5H6.5A1.5 1.5 0 0 0 5 20z" /><path d="M5 20a1.5 1.5 0 0 0 1.5 1.5H19M9 7h6" /></Svg>;
export const CheckCalIcon = () => <Svg><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" /><path d="M9 15l2 2 4-4" /></Svg>;
export const ChartIcon = () => <Svg><path d="M4 20h16" /><path d="M7 16v-5M12 16V6M17 16v-8" /></Svg>;
export const SlidersIcon = () => <Svg><path d="M5 20v-6M5 10V4M12 20v-8M12 8V4M19 20v-4M19 12V4" /><path d="M3 14h4M10 8h4M17 16h4" /></Svg>;
export const PhoneIcon = () => <Svg size={16}><path d="M5 4h3l1.5 4-2 1.2a11 11 0 0 0 5.3 5.3l1.2-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 3 6.2 2 2 0 0 1 5 4z" /></Svg>;
export const XIcon = () => <Svg size={16}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const PlayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5l13 7.5-13 7.5z" /></svg>
);
export const MicIcon = ({ size = 22 }: { size?: number }) => (
  <Svg size={size}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Svg>
);

export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json", ...(init?.headers ?? {}) } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}
