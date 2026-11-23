// localStorage-backed state with import/export.

const KEY = 'enough.v1';
const listeners = new Set();

export const defaults = () => ({
  v: 1,
  setup: false,
  createdAt: Date.now(),
  profile: {
    product: 'cig',     // cig | roll | vape
    perDay: 15,         // cigarettes / roll-ups per day
    perPack: 20,        // units per pack / pouch
    packPrice: 10,      // price per pack / pouch / device
    daysPerDevice: 3,   // vape: how many days one device lasts
    currency: guessCurrency(),
    reasons: [],
  },
  plan: { mode: 'now', quitAt: null, taperStartAt: null, taperFrom: null },
  runs: [],            // [{ start, end|null }]  smoke-free runs, last one is current
  slips: [],           // [timestamps]
  smokeLog: [],
  savedExtra: 0,       // money saved during finished cut-down plans        // [timestamps] every cigarette logged one by one
  cravings: [],        // [{ id, at, strength, where:[], feeling:[], doing:[], with:[], note }]
  diary: {},           // { 'YYYY-MM-DD': { smoked, strength, count, note, at } }
  missions: {},        // { id: doneAt }
  badges: {},          // { id: earnedAt }
  notified: {},        // { key: timestamp } fired notifications
  reminders: {
    enabled: false,
    diary: { on: true, time: '21:00', days: [0, 1, 2, 3, 4, 5, 6] },
    craving: { on: true, hour: null },   // null = auto from log
    milestones: true,
    taper: { on: true, time: '08:00' },
    quitDay: true,
  },
  spacing: { on: true, wake: '07:30', sleep: '23:00' },  // spread cut-down cigarettes over waking hours
  ui: { theme: 'auto', accent: 'sky' },
});

function guessCurrency() {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    const map = { US: 'USD', GB: 'GBP', CH: 'CHF', CA: 'CAD', AU: 'AUD', NZ: 'NZD', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', JP: 'JPY', IN: 'INR', BR: 'BRL', MX: 'MXN', ZA: 'ZAR', SG: 'SGD', HK: 'HKD' };
    return map[region] || 'EUR';
  } catch { return 'EUR'; }
}

function merge(base, over) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over ?? base;
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    out[k] = (k in base && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]))
      ? merge(base[k], over[k]) : over[k];
  }
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(defaults(), JSON.parse(raw));
  } catch (e) { console.warn('Could not load state', e); }
  return defaults();
}

export let state = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('Could not save state', e); }
  listeners.forEach(fn => fn(state));
}

export function update(fn) { fn(state); save(); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function reset() { state = defaults(); save(); }

export function exportJSON() {
  return JSON.stringify({ app: 'enough', exportedAt: new Date().toISOString(), data: state }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  const data = parsed && parsed.app === 'enough' ? parsed.data : parsed;
  if (!data || typeof data !== 'object' || !('profile' in data) || !Array.isArray(data.runs)) {
    throw new Error('This file does not look like an Enough backup.');
  }
  state = merge(defaults(), data);
  save();
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
