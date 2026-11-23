// Pure calculations on state.
import { DAY, MILESTONES, PRODUCTS, MISSION_LIST } from './content.js';

export const dayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const keyToDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

export function rate(p) {
  const unitsPerDay = p.product === 'vape' ? 1 / Math.max(0.1, +p.daysPerDevice || 1) : Math.max(0, +p.perDay || 0);
  const unitPrice = p.product === 'vape' ? +p.packPrice || 0 : (+p.packPrice || 0) / Math.max(1, +p.perPack || 1);
  return { unitsPerDay, unitPrice, moneyPerDay: unitsPerDay * unitPrice };
}

export const unitLabel = (p, n = 2) => {
  const P = PRODUCTS[p.product];
  return Math.abs(n) === 1 ? P.unit : P.units;
};

export function currentRun(s) { return s.runs[s.runs.length - 1] || null; }

/** ms smoke free in current run (negative if quit date is in the future). */
export function elapsed(s, now = Date.now()) {
  const r = currentRun(s);
  return r ? now - r.start : 0;
}

export function runLengths(s, now = Date.now()) {
  return s.runs
    .map((r, i) => ({ ...r, i, length: Math.max(0, (r.end ?? now) - r.start), current: r.end == null }))
    .filter(r => r.start <= now);
}

export function lifetimeMs(s, now = Date.now()) {
  return runLengths(s, now).reduce((a, r) => a + r.length, 0);
}

export function savedFor(ms, profile) {
  const { unitsPerDay, moneyPerDay } = rate(profile);
  const d = Math.max(0, ms) / DAY;
  return { money: d * moneyPerDay, units: d * unitsPerDay };
}

export function splitDuration(ms) {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
}

export function humanDuration(ms) {
  const { d, h, m } = splitDuration(ms);
  if (d >= 365) { const y = d / 365.25; return `${y >= 10 ? Math.floor(y) : y.toFixed(1).replace(/\.0$/, '')} years`; }
  if (d >= 60) return `${Math.floor(d / 30.44)} months`;
  if (d >= 1) return `${d} day${d === 1 ? '' : 's'}${d < 7 && h ? ` ${h}h` : ''}`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m} min`;
}

export function milestoneLabel(ms) {
  const MINS = ms / 60e3;
  if (MINS < 60) return `${MINS} minutes`;
  const H = MINS / 60;
  if (H < 24) return `${H} hours`;
  const D = H / 24;
  if (D < 14) return `${D} day${D === 1 ? '' : 's'}`;
  if (D < 60) return `${Math.round(D / 7)} weeks`;
  if (D < 365) return `${Math.round(D / 30.44)} months`;
  const Y = Math.round(D / 365.25);
  return `${Y} year${Y === 1 ? '' : 's'}`;
}

/**
 * When health recovery started: your last cigarette. That's the later of the
 * smoke-free run start (if reached) and the last cigarette you logged.
 * Returns null when there's nothing to count from yet.
 */
export function healthAnchor(s, now = Date.now()) {
  const r = currentRun(s);
  let anchor = r && r.start <= now ? r.start : null;
  for (const t of s.smokeLog) if (t <= now && (anchor == null || t > anchor)) anchor = t;
  return anchor;
}

export function milestoneState(s, now = Date.now()) {
  const anchor = healthAnchor(s, now);
  const t = anchor == null ? -1 : now - anchor;
  const done = MILESTONES.filter(m => t >= m.at);
  const next = MILESTONES.find(m => t < m.at) || null;
  const prevAt = done.length ? done[done.length - 1].at : 0;
  const progress = next ? Math.max(0, (t - prevAt) / (next.at - prevAt)) : 1;
  return { t, anchor, done, next, progress };
}

// ---- Taper ----
/** Daily targets from taper start day to quit day (exclusive). Front-loaded: big cuts early, long tail at low counts. */
export function taperPlan(s) {
  const p = s.plan;
  if (p.mode !== 'taper' || !p.taperStartAt || !p.quitAt) return null;
  const start = startOfDay(p.taperStartAt);
  const quitDay = startOfDay(p.quitAt);
  const n = Math.max(1, daysBetween(start, quitDay));
  const from = Math.max(1, +p.taperFrom || +s.profile.perDay || 1);
  const days = [];
  for (let i = 0; i < n; i++) {
    const x = 1 - i / n;
    const target = i === 0 ? from : Math.max(1, Math.round(from * x * x));
    days.push({ day: addDays(start, i), target });
  }
  days.push({ day: quitDay, target: 0 });
  return { days, from, start, quitDay };
}

export function taperToday(s, now = Date.now()) {
  const plan = taperPlan(s);
  if (!plan) return null;
  const today = startOfDay(now);
  const idx = plan.days.findIndex(d => d.day === today);
  const { unitPrice } = rate(s.profile);
  const days = plan.days.map(d => {
    const n = smokedCount(s, d.day);
    const entry = s.diary[dayKey(d.day)];
    // "Logged" = at least one cigarette logged, or a diary entry saying smoke free.
    // Otherwise we don't know, so the day is counted at its target.
    const logged = d.day <= today && (n > 0 || (entry && !entry.smoked));
    return { ...d, actual: logged ? n : null };
  });
  const past = days.filter(d => d.day < today && d.target > 0);
  const bankedPast = past.reduce((a, d) => a + Math.max(0, plan.from - (d.actual ?? d.target)) * unitPrice, 0);
  // Today so far: the least you'll save if you stop at your target.
  const t = idx >= 0 ? days[idx] : null;
  const bankedToday = t && t.target > 0 ? Math.max(0, plan.from - Math.max(smokedCount(s, today), t.target)) * unitPrice : 0;
  const untracked = past.filter(d => d.actual == null).length;
  return { ...plan, days, idx, today: t, bankedPast, bankedToday, banked: bankedPast + bankedToday, untracked };
}

/** Money saved while cutting down: finished plans (savedExtra) + the current one. */
export function taperSavings(s, now = Date.now()) {
  const tp = s.plan.mode === 'taper' ? taperToday(s, now) : null;
  return (+s.savedExtra || 0) + (tp ? tp.banked : 0);
}

// ---- Smoke log ----
export function smokedBetween(s, from, to) { return s.smokeLog.filter(t => t >= from && t < to).sort((a, b) => a - b); }
export function smokedCount(s, dayStart) { return smokedBetween(s, dayStart, addDays(dayStart, 1)).length; }

/** Today's goal: taper target if tapering, otherwise your usual daily amount. */
const atTime = (hhmm, dayStart) => { const [h, m] = String(hhmm || '00:00').split(':').map(Number); const d = new Date(dayStart); d.setHours(h || 0, m || 0, 0, 0); return d.getTime(); };

/**
 * Spacing while cutting down: today's remaining cigarettes spread evenly
 * from your last one (or wake-up) to bedtime. Recomputed after every cigarette.
 * Returns null when not applicable, or { at, gap, remaining } / { done } / { late }.
 */
export function nextAllowed(s, now = Date.now()) {
  const sp = s.spacing;
  if (!sp?.on) return null;
  const tp = taperToday(s, now);
  if (!tp?.today || tp.today.target <= 0) return null;
  const today = startOfDay(now);
  const list = smokedBetween(s, today, addDays(today, 1));
  const remaining = tp.today.target - list.length;
  if (remaining <= 0) return { done: true };
  const wake = atTime(sp.wake, today);
  let sleep = atTime(sp.sleep, today);
  if (sleep <= wake) sleep = addDays(sleep, 1); // bedtime after midnight
  if (!list.length) return { at: wake, gap: (sleep - wake) / remaining, remaining };
  const from = Math.max(list[list.length - 1], wake);
  if (from >= sleep) return { late: true, remaining };
  const gap = (sleep - from) / remaining;
  return { at: from + gap, gap, remaining };
}

export function dailyGoal(s, now = Date.now()) {
  const tp = taperToday(s, now);
  if (tp?.today) return { goal: tp.today.target, kind: 'target' };
  return { goal: Math.round(+s.profile.perDay || 0), kind: 'usual' };
}

// ---- Diary ----
export function diaryStreaks(s, now = Date.now()) {
  const keys = new Set(Object.keys(s.diary));
  let current = 0;
  let t = startOfDay(now);
  if (!keys.has(dayKey(t))) t = addDays(t, -1); // today not logged yet doesn't break the streak
  while (keys.has(dayKey(t))) { current++; t = addDays(t, -1); }
  const sorted = [...keys].sort();
  let best = 0, run = 0, prev = null;
  for (const k of sorted) {
    const d = keyToDate(k).getTime();
    run = prev != null && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current) };
}

// ---- Day status for grid ----
export function dayStatus(s, dayStart) {
  const k = dayKey(dayStart);
  const end = addDays(dayStart, 1);
  const entry = s.diary[k];
  const slip = s.slips.some(t => t >= dayStart && t < end);
  if (slip || entry?.smoked) return 'smoked';
  const first = s.runs[0]?.start;
  if (first == null || end <= first || dayStart > Date.now()) return 'none';
  const covered = s.runs.some(r => r.start < end && (r.end ?? Date.now()) > dayStart);
  return covered ? 'free' : 'none';
}

// ---- Cravings ----
export function cravingHourGuess(s) {
  if (s.cravings.length < 3) return null;
  const counts = new Array(24).fill(0);
  s.cravings.forEach(c => counts[new Date(c.at).getHours()]++);
  return counts.indexOf(Math.max(...counts));
}

export function triggerCounts(s, sinceMs = Infinity, now = Date.now()) {
  const map = new Map();
  s.cravings.filter(c => now - c.at <= sinceMs).forEach(c => {
    ['where', 'feeling', 'doing', 'with'].forEach(cat => (c[cat] || []).forEach(tag => {
      map.set(tag, (map.get(tag) || 0) + 1);
    }));
  });
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function cravingTrend(s, days, now = Date.now()) {
  const out = [];
  const today = startOfDay(now);
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i), e = addDays(d, 1);
    const list = s.cravings.filter(c => c.at >= d && c.at < e);
    const avg = list.length ? list.reduce((a, c) => a + c.strength, 0) / list.length : 0;
    out.push({ day: d, count: list.length, avg });
  }
  return out;
}

// ---- Stats for badges ----
export function stats(s, now = Date.now()) {
  const runs = runLengths(s, now);
  const recordMs = runs.reduce((a, r) => Math.max(a, r.length), 0);
  const life = savedFor(lifetimeMs(s, now), s.profile);
  return {
    recordMs,
    lifetimeMoney: life.money + taperSavings(s, now),
    lifetimeUnits: life.units,
    cravingsResisted: s.cravings.length,
    diaryBest: diaryStreaks(s, now).best,
    missionsDone: MISSION_LIST.filter(m => s.missions[m.id]).length,
  };
}
