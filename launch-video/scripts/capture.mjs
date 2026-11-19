// Captures the real Pulse pages for the launch video: 2x full-page textures + element boxes (layout.json).
// Source: the ISOLATED demo app on :3200 (fictional "Fern & Fade Salon", seeded by scratchpad pulse-demo/seed.cjs).
// Never point this at the real app on :3100 — that holds real accounts.
// Run: node scripts/capture.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BASE = 'http://localhost:3200';
const OUT = path.resolve('public/textures');
const LAYOUT = path.resolve('src/layout.json');
const CHROME = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const login = await page.request.post(`${BASE}/api/auth/login`, { data: { email: 'demo@pulse.example', password: 'demo-pulse-123' } });
if (!login.ok()) throw new Error(`login failed ${login.status()}`);

const settle = async () => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
};
const boxes = (sel) => page.$$eval(sel, (els) => els.map((e) => {
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height), text: (e.textContent || '').trim().slice(0, 80) };
}));
const pageH = () => page.evaluate(() => document.documentElement.scrollHeight);
const bgAt = (sel) => page.$eval(sel, (e) => getComputedStyle(e).backgroundColor);

const layout = {};

// 1) Today: the hour-ruled day page
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await settle();
layout.today = {
  pageH: await pageH(),
  entries: await boxes('.day .entry'),
  day: (await boxes('.day'))[0],
  hours: await boxes('.day .hour'),
  head: (await boxes('main h1'))[0],
  aside: await boxes('main aside'),
  rail: (await boxes('.rail'))[0],
  dayBg: await bgAt('.day'),
};
await page.screenshot({ path: `${OUT}/today.png`, fullPage: true });

// 2) Call history with the urgent call open
await page.goto(`${BASE}/dashboard/history`, { waitUntil: 'networkidle' });
await settle();
await page.getByRole('button', { name: /Dana Ruiz/ }).first().click();
await page.waitForTimeout(700);
layout.history = {
  pageH: await pageH(),
  rows: await boxes('main button[aria-pressed]'),
  detail: (await boxes('section[aria-label="Selected call"]'))[0],
  summary: (await boxes('section[aria-label="Selected call"] p.mt-4'))[0],
  transcript: await boxes('section[aria-label="Selected call"] ol li'),
  name: (await boxes('section[aria-label="Selected call"] h2'))[0],
};
await page.screenshot({ path: `${OUT}/history.png`, fullPage: true });

// 3) Call history with Sara (booked, name read-back transcript)
await page.getByRole('button', { name: /Sara Mendes/ }).first().click();
await page.waitForTimeout(700);
layout.historySara = {
  pageH: await pageH(),
  transcript: await boxes('section[aria-label="Selected call"] ol li'),
  detail: (await boxes('section[aria-label="Selected call"]'))[0],
};
await page.screenshot({ path: `${OUT}/history-sara.png`, fullPage: true });

fs.writeFileSync(LAYOUT, JSON.stringify(layout, null, 2));
console.log('today', layout.today.pageH, 'entries', layout.today.entries.length, 'dayBg', layout.today.dayBg);
console.log('history', layout.history.pageH, 'rows', layout.history.rows.length, 'lines', layout.history.transcript.length);
await browser.close();
