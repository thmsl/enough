// Local reminders. A PWA cannot schedule notifications without a push server,
// so these fire while the app is open or running in the background (checked every 30s),
// and missed ones are caught up (once) the next time you open the app.
import { state, update } from './store.js';
import { MILESTONES, HOUR } from './content.js';
import { elapsed, dayKey, taperToday, cravingHourGuess, milestoneLabel, startOfDay } from './calc.js';

export const supported = () => 'Notification' in window && 'serviceWorker' in navigator;

export async function requestPermission() {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

async function show(title, body, tag) {
  if (!supported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
  } catch {
    try { new Notification(title, { body, tag }); } catch { /* ignore */ }
  }
}

const atTime = (hhmm, now) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(startOfDay(now)); d.setHours(h, m, 0, 0); return d.getTime();
};

/** Mark milestones already reached as notified (e.g. after backdating) so we don't spam. */
export function silenceReached() {
  const t = elapsed(state);
  update(s => MILESTONES.forEach((m, i) => { if (t >= m.at) s.notified['ms' + i + ':' + s.runs.length] ??= Date.now(); }));
}

export function check(now = Date.now()) {
  const s = state, r = s.reminders;
  if (!s.setup || !r.enabled) return;
  const today = dayKey(now);
  const fire = [];
  const once = (key, title, body) => { if (!s.notified[key]) fire.push([key, title, body]); };
  const inWin = (t) => now >= t && now - t < 3 * HOUR;

  // Health milestones (per run, so a restart re-earns them)
  if (r.milestones) {
    const t = elapsed(s, now);
    MILESTONES.forEach((m, i) => {
      if (t >= m.at) once(`ms${i}:${s.runs.length}`, `${milestoneLabel(m.at)} smoke free`, `${m.title}. ${m.body}`);
    });
  }
  // Quit day
  const q = s.plan.quitAt;
  if (r.quitDay && q && q > s.createdAt && now >= q && now - q < 12 * HOUR) {
    once(`quit:${q}`, 'It’s quit day', 'Your smoke-free counter has started. You’ve got this.');
  }
  // Taper morning target
  const tp = taperToday(s, now);
  if (r.taper.on && tp?.today && tp.today.target > 0 && inWin(atTime(r.taper.time, now))) {
    once(`taper:${today}`, `Today’s target: ${tp.today.target}`, `Taper day ${tp.idx + 1} of ${tp.days.length - 1}. Quit day is getting closer.`);
  }
  // Diary nudge
  if (r.diary.on && r.diary.days.includes(new Date(now).getDay()) && !s.diary[today] && inWin(atTime(r.diary.time, now))) {
    once(`diary:${today}`, 'How did today go?', 'Take 20 seconds to check in on your diary.');
  }
  // Craving support
  const hour = r.craving.hour ?? cravingHourGuess(s);
  if (r.craving.on && hour != null) {
    const t = new Date(startOfDay(now)).setHours(hour, 0, 0, 0) - 10 * 60e3;
    if (inWin(t)) once(`crave:${today}`, 'Cravings often hit around now', 'Have a plan ready. Open Enough and tap SOS if it gets tough.');
  }

  if (!fire.length) return;
  update(st => fire.forEach(([key]) => { st.notified[key] = now; }));
  // Only show the newest few to avoid a burst after a long absence
  fire.slice(-3).forEach(([key, title, body]) => show(title, body, key));
}

export function start() {
  check();
  setInterval(check, 30e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}
