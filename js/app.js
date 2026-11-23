import { state, update, save, subscribe, reset, exportJSON, importJSON, uid } from './store.js';
import { MILESTONES, RINGS, BADGES, MISSIONS, MISSION_LIST, TAGS, TAG_LABELS, TIPS, PRODUCTS, CURRENCIES, DAY, WEEK, MONTH, YEAR } from './content.js';
import * as C from './calc.js';
import { barChart, hbars, ring, initTooltips } from './charts.js';
import * as N from './notify.js';
import { shareCard } from './share.js';

// ---------- helpers ----------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const view = $('#view');
const ui = { projection: '1m', trendDays: 30, trendMetric: 'count', triggerCat: 'all', onboardStep: 0 };
let draft = null;

const money = (v, compact = false) => {
  const cur = state.profile.currency;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: compact || Math.abs(v) >= 1000 ? 0 : 2, minimumFractionDigits: compact || Math.abs(v) >= 1000 ? 0 : 2 }).format(v);
  } catch { return `${v.toFixed(2)} ${cur}`; }
};
const num = (v, d = 0) => new Intl.NumberFormat(undefined, { maximumFractionDigits: d }).format(v);
const fmtDate = (t, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => new Date(t).toLocaleDateString(undefined, opts);
const fmtDateTime = t => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtTime = t => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const toLocalInput = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const unitWord = n => C.unitLabel(state.profile, n);
const P = () => PRODUCTS[state.profile.product];

function toast(msg, icon = '✓') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${icon}</span><span>${esc(msg)}</span>`;
  const box = $('#toasts');
  while (box.children.length >= 2) box.firstElementChild.remove();
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

// ---------- modal ----------
const modal = $('#modal');
function openModal(html, onMount) {
  modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  if (!modal.open) modal.showModal();
  onMount?.(modal);
}
function closeModal() { if (modal.open) modal.close(); modal.innerHTML = ''; clearInterval(sosTimer); }
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
modal.addEventListener('close', () => clearInterval(sosTimer));

// ---------- routing ----------
const ROUTES = ['home', 'health', 'cravings', 'diary', 'journey', 'settings'];
const route = () => { const r = location.hash.slice(1); return ROUTES.includes(r) ? r : 'home'; };
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

function render() {
  applyTheme();
  document.body.classList.toggle('onboarding', !state.setup);
  if (!state.setup) { view.innerHTML = renderOnboarding(); return; }
  const r = route();
  $$('#nav a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + r ? 'page' : 'false'));
  view.innerHTML = ({ home: renderHome, health: renderHealth, cravings: renderCravings, diary: renderDiary, journey: renderJourney, settings: renderSettings })[r]();
  tick();
}

function applyTheme() {
  const a = state.ui.accent || 'sky';
  if (a === 'sky') document.documentElement.removeAttribute('data-accent');
  else document.documentElement.setAttribute('data-accent', a);
  const t = state.ui.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

// ---------- onboarding ----------
function renderOnboarding() {
  draft ??= { ...structuredClone(state.profile), mode: 'now', when: toLocalInput(Date.now() + DAY), back: toLocalInput(Date.now() - DAY), taperFrom: state.profile.perDay, reasonsText: '' };
  const step = ui.onboardStep, d = draft;
  const dots = `<div class="dots">${[0, 1, 2, 3, 4].map(i => `<span class="${i === step ? 'on' : ''}"></span>`).join('')}</div>`;
  const nav = (next = 'Continue') => `<div class="ob-nav">
    ${step > 0 ? `<button class="btn ghost" data-action="ob-back">Back</button>` : '<span></span>'}
    <button class="btn primary" data-action="ob-next">${next}</button></div>`;

  if (step === 0) return `<section class="onboard hero-ob">
    <div class="logo-big" aria-hidden="true">${logoSvg()}</div>
    <h1>Enough.</h1>
    <p class="lead">Count every second since you stopped. Watch the money and your health come back.</p>
    <p class="muted small">No account. No ads. Everything stays on this device.</p>
    <button class="btn primary big" data-action="ob-next">Get started</button>
    <label class="btn ghost">Restore a backup<input type="file" accept="application/json,.json" data-action="import" hidden></label>
  </section>`;

  if (step === 1) return `<section class="onboard">${dots}
    <h2>What do you smoke?</h2>
    <div class="choice-list">
      ${Object.entries(PRODUCTS).map(([k, p]) => `
        <label class="choice ${d.product === k ? 'on' : ''}">
          <input type="radio" name="product" value="${k}" ${d.product === k ? 'checked' : ''} data-draft="product">
          <span class="choice-icon">${{ cig: '🚬', roll: '🌿', vape: '💨' }[k]}</span>
          <span><strong>${p.label}</strong><small>${{ cig: 'Priced by the pack', roll: 'Priced by the pouch', vape: 'Priced by the device' }[k]}</small></span>
        </label>`).join('')}
    </div>${nav()}</section>`;

  if (step === 2) {
    const p = PRODUCTS[d.product];
    return `<section class="onboard">${dots}
    <h2>How much, and what does it cost?</h2>
    <div class="form">
      ${d.product === 'vape' ? `
        <label>How many days does one device last?<input type="number" min="0.1" step="0.1" inputmode="decimal" value="${d.daysPerDevice}" data-draft="daysPerDevice"></label>
        <label>Price per device<input type="number" min="0" step="0.01" inputmode="decimal" value="${d.packPrice}" data-draft="packPrice"></label>
      ` : `
        <label>How many a day?<input type="number" min="1" step="1" inputmode="numeric" value="${d.perDay}" data-draft="perDay"></label>
        <label>${p.perPackLabel}<input type="number" min="1" step="1" inputmode="numeric" value="${d.perPack}" data-draft="perPack"></label>
        <label>Price per ${p.pack}<input type="number" min="0" step="0.01" inputmode="decimal" value="${d.packPrice}" data-draft="packPrice"></label>
      `}
      <label>Currency<select data-draft="currency">${CURRENCIES.map(c => `<option ${c === d.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    </div>${nav()}</section>`;
  }

  if (step === 3) {
    const modes = [
      ['now', 'Quit right now', 'The counter starts this second.'],
      ['date', 'Pick a quit date', 'Count down to the day.'],
      ...(d.product !== 'vape' ? [['taper', 'Cut down to a date', 'A daily target that steps down to zero.']] : []),
      ['back', 'I already stopped', 'Backdate to when you stopped.'],
    ];
    return `<section class="onboard">${dots}
    <h2>When do you stop?</h2>
    <div class="choice-list">${modes.map(([k, t, s]) => `
      <label class="choice ${d.mode === k ? 'on' : ''}"><input type="radio" name="mode" value="${k}" ${d.mode === k ? 'checked' : ''} data-draft="mode">
      <span><strong>${t}</strong><small>${s}</small></span></label>`).join('')}</div>
    <div class="form">
      ${d.mode === 'date' || d.mode === 'taper' ? `<label>Quit day<input type="datetime-local" value="${d.when}" min="${toLocalInput(Date.now())}" data-draft="when"></label>` : ''}
      ${d.mode === 'taper' ? `<label>Start from (${PRODUCTS[d.product].units} per day)<input type="number" min="1" value="${d.taperFrom}" data-draft="taperFrom"></label>
        <p class="muted small">The plan cuts hardest at the start, so the low-count days near the end get more time.</p>` : ''}
      ${d.mode === 'back' ? `<label>When did you stop?<input type="datetime-local" value="${d.back}" max="${toLocalInput(Date.now())}" data-draft="back"></label>` : ''}
    </div>${nav()}</section>`;
  }

  return `<section class="onboard">${dots}
    <h2>Why are you quitting?</h2>
    <p class="muted">One reason per line. We’ll show them to you when a craving hits. Optional.</p>
    <div class="form"><textarea rows="5" placeholder="My kids&#10;Breathing on the stairs&#10;Saving for a trip" data-draft="reasonsText">${esc(d.reasonsText)}</textarea></div>
    ${nav('Start')}</section>`;
}

function finishOnboarding() {
  const d = draft, now = Date.now();
  let quitAt = now;
  if (d.mode === 'date' || d.mode === 'taper') quitAt = new Date(d.when).getTime();
  if (d.mode === 'back') quitAt = Math.min(now, new Date(d.back).getTime());
  if (!isFinite(quitAt)) { toast('Please pick a valid date', '⚠️'); return; }
  if ((d.mode === 'date' || d.mode === 'taper') && quitAt <= now) quitAt = now;
  update(s => {
    const { mode, when, back, taperFrom, reasonsText, ...profile } = d;
    s.profile = { ...s.profile, ...profile, reasons: reasonsText.split('\n').map(x => x.trim()).filter(Boolean) };
    s.plan = { mode: d.mode === 'back' ? 'now' : d.mode, quitAt, taperStartAt: d.mode === 'taper' ? now : null, taperFrom: +taperFrom || +profile.perDay };
    s.runs = [{ start: quitAt, end: null }];
    s.setup = true; s.createdAt = now;
  });
  N.silenceReached();
  if (d.mode === 'date' || d.mode === 'taper') update(s => { s.missions['0.1'] = now; });
  if (state.profile.reasons.length >= 3) update(s => { s.missions['0.0'] = now; });
  draft = null; ui.onboardStep = 0;
  location.hash = '#home'; render();
}

// ---------- home ----------
function renderHome() {
  const t = C.elapsed(state);
  const { done, next } = C.milestoneState(state);
  const tp = C.taperToday(state);
  const hour = new Date().getHours();
  const needsDiary = !state.diary[C.dayKey()] && hour >= 17;

  if (t < 0) {
    return `
    <section class="hero-b">
      <p class="label">Quit day in</p>
      <p class="countdown" data-live="clock"></p>
      <p class="muted">${new Date(C.currentRun(state).start).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
      <div class="links"><button class="text-btn" data-action="quit-now">Quit now instead</button><button class="text-btn" data-action="edit-plan">Change date</button></div>
    </section>
    ${state.profile.product !== 'vape' ? renderSmokeLog() : ''}
    ${needsDiary ? diaryNudge() : ''}
    ${tp ? renderTaper(tp) : `<section class="card"><h3>Get ready</h3><p class="behind">Use the days before quit day to log your cravings. It shows you which triggers to plan for.</p>
      <div class="row gap" style="margin-top:14px"><button class="btn primary" data-action="log-craving">Log a craving</button><a class="btn ghost" href="#journey">See missions</a></div></section>`}`;
  }

  const behind = done.slice(-4).map(m => esc(m.title)).join(' · ');
  return `
    <section class="hero-b">
      <p class="label">Smoke free for</p>
      <div class="big" data-live="big">0</div>
      <p class="words" data-live="words"></p>
      <p class="since">since ${fmtDateTime(C.currentRun(state).start)}</p>
    </section>

    <section class="pair">
      <div><strong data-live="money">–</strong><span>kept in your pocket</span></div>
      <div><strong data-live="units">–</strong><span>not ${state.profile.product === 'vape' ? 'bought' : 'smoked'}</span></div>
    </section>

    ${C.taperSavings(state) > 0 ? `<p class="muted small carry">+ ${money(C.taperSavings(state))} saved while cutting down · <span data-live="money-total"></span> in total</p>` : ''}

    <div class="home-actions">
      <button class="btn primary" data-action="log-craving">Log a craving</button>
      <button class="btn ghost" data-action="share">Share</button>
    </div>
    <p class="home-slip"><button class="text-btn danger" data-action="slip">I smoked</button></p>

    ${needsDiary ? diaryNudge() : ''}

    ${next ? `<section class="card"><h3>Next for your body</h3>
      <div class="next-body"><span class="dot"></span><div class="grow"><p class="t">${esc(next.title)}</p>
      <small><span data-live="next-left"></span> · ${esc(next.body)}</small></div></div>
      <div class="progress"><span data-live="next-bar"></span></div>
    </section>` : ''}
    ${done.length ? `<section class="card"><h3>Already behind you</h3>
      <p class="behind">${behind}${done.length > 4 ? ` <a href="#health">+${done.length - 4} more</a>` : ''}</p></section>` : ''}
    ${renderProjection()}
  `;
}

const diaryNudge = () => `<section class="card nudge"><div><strong>How did today go?</strong><p class="muted small">Check in on your diary.</p></div><button class="btn primary small" data-action="diary-edit" data-day="${C.dayKey()}">Check in</button></section>`;

/** Big number + words for the hero: days if ≥1 day, else hours, else minutes. */
function heroParts(ms) {
  const { d, h, m, s } = C.splitDuration(ms);
  const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (d >= 1) return { big: d, words: `<b>${d === 1 ? 'day' : 'days'}</b>, ${pl(h, 'hour')}, ${pl(m, 'minute')}, ${pad(s)}s` };
  if (h >= 1) return { big: h, words: `<b>${h === 1 ? 'hour' : 'hours'}</b>, ${pl(m, 'minute')}, ${pad(s)}s` };
  return { big: m, words: `<b>${m === 1 ? 'minute' : 'minutes'}</b>, ${pad(s)} seconds` };
}

function renderSmokeLog() {
  const today = C.startOfDay();
  const list = C.smokedBetween(state, today, C.addDays(today, 1));
  const n = list.length;
  const { goal, kind } = C.dailyGoal(state);
  const left = goal - n;
  const over = n > goal;
  const status = kind === 'target'
    ? (over ? `${n - goal} over today’s target` : left === 0 ? 'Target reached. That’s it for today.' : `${left} left before you reach today’s target`)
    : (over ? `${n - goal} more than your usual ${goal}` : `Your usual is ${goal} a day`);
  const last = list[list.length - 1] ?? state.smokeLog.filter(t => t <= Date.now()).sort((x, y) => y - x)[0];
  const dots = goal > 0 && goal <= 40
    ? `<div class="cig-dots" aria-hidden="true">${Array.from({ length: Math.max(goal, n) }, (_, i) => `<i class="${i < n ? (i < goal ? 'f' : 'x') : ''}"></i>`).join('')}</div>`
    : `<div class="progress ${over ? 'over' : ''}"><span style="width:${goal > 0 ? Math.min(100, (n / goal) * 100) : (n ? 100 : 0)}%"></span></div>`;
  return `<section class="card smokelog ${over ? 'over' : ''}">
    <h3>Today</h3>
    <p class="count"><strong>${n}</strong><span>/ ${goal}</span></p>
    ${dots}
    <p class="muted small">${status}</p>
    ${renderNextCig()}
    ${last ? `<div class="since-last"><span>Since your last one</span><strong data-live="since-last" data-last="${last}"></strong></div>` : ''}
    <div class="row gap"><button class="btn primary grow" data-action="smoke-plus" aria-label="Log one">+1</button>
      ${n ? `<button class="btn ghost" data-action="smoke-undo">Undo</button>` : ''}</div>
    ${renderWeekLog()}
    <button class="link-btn" data-action="smoke-day">Add or fix a past day</button>
  </section>`;
}

function renderWeekLog() {
  if (!state.smokeLog.length) return '';
  const today = C.startOfDay();
  const plan = C.taperPlan(state);
  const usual = Math.round(+state.profile.perDay || 0);
  const data = Array.from({ length: 7 }, (_, i) => {
    const d = C.addDays(today, i - 6), n = C.smokedCount(state, d);
    const target = plan?.days.find(x => x.day === d)?.target;
    return { value: n, target, over: target != null && n > target, label: fmtDate(d, { weekday: 'narrow' }), hi: i === 6,
      tip: `${fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}: ${n} logged${target != null ? ` · target ${target}` : ''}` };
  });
  return `<p class="label" style="margin-top:26px">Last 7 days</p>
    ${barChart(data, { height: 120, ref: usual, refLabel: `usual ${usual}`, aria: 'Logged per day, last 7 days' })}
    ${plan ? `<p class="legend"><span class="sw solid"></span>Smoked <span class="sw smoked"></span>Over target <span class="sw target"></span>Target</p>` : ''}`;
}

function renderTaper(tp) {
  const max = Math.max(tp.from, ...tp.days.map(d => d.actual ?? 0));
  const today = C.startOfDay();
  const steps = tp.days.map((d, i) => {
    const cls = d.day < today ? 'past' : i === tp.idx ? 'today' : '';
    const has = d.actual != null;
    const over = has && d.actual > d.target;
    const tip = `${fmtDate(d.day, { weekday: 'short', day: 'numeric', month: 'short' })}: ${d.target === 0 ? 'quit day' : 'target ' + d.target}${has ? ` · smoked ${d.actual}` : ''}`;
    return `<div class="step ${cls} ${has ? 'tracked' : ''}" data-tip="${tip}">
      <span class="t" style="height:${Math.max(4, (d.target / max) * 100)}%"></span>
      ${has ? `<span class="a ${over ? 'over' : ''}" style="height:${(d.actual / max) * 100}%"></span>` : ''}</div>`;
  }).join('');
  const tracked = tp.days.filter(d => d.actual != null && d.day < today);
  const onTarget = tracked.filter(d => d.actual <= d.target).length;
  return `<section class="card taper">
    <div class="row between"><h3>Taper plan</h3><span class="muted small">Day ${Math.max(1, tp.idx + 1)} of ${tp.days.length - 1}</span></div>
    <div class="staircase">${steps}</div>
    <div class="row between small muted"><span>${fmtDate(tp.start, { day: 'numeric', month: 'short' })} · ${tp.from}/day</span><span>Quit day · 0</span></div>
    <p class="legend"><span class="sw ghost"></span>Target <span class="sw solid"></span>Smoked <span class="sw smoked"></span>Over target</p>
    ${tracked.length ? `<p class="small">On target ${onTarget} of ${tracked.length} day${tracked.length === 1 ? '' : 's'}.</p>` : ''}
    ${tp.untracked ? `<p class="muted small">${tp.untracked} day${tp.untracked === 1 ? '' : 's'} not logged, counted at target. <button class="link-btn" style="margin:0" data-action="smoke-day">Fill in</button></p>` : ''}
    <p class="banked">Already banked: <strong>${money(tp.banked)}</strong>${tp.bankedToday ? `<br><span class="muted small">including ${money(tp.bankedToday)} today, if you stay within ${tp.today.target}</span>` : ''}</p>
  </section>`;
}

function renderNextCig() {
  const nx = C.nextAllowed(state);
  if (!nx || nx.done) return '';
  if (nx.late) return `<div class="next-cig"><span class="label">Next one</span><p class="muted small">Past your bedtime (${esc(state.spacing.sleep)}). Nothing scheduled until tomorrow.</p></div>`;
  return `<div class="next-cig" data-live-next="${Math.round(nx.at)}">
    <span class="label">Next one from</span>
    <div class="row between"><strong>${fmtTime(nx.at)}</strong><span class="next-left" data-live="next-cig"></span></div>
    <p class="muted small">${nx.remaining} left, spread every ${C.humanDuration(nx.gap)} until ${esc(state.spacing.sleep)}. <a href="#settings" class="link">Change hours</a></p>
  </div>`;
}

function logSmoke() {
  const before = C.smokedCount(state, C.startOfDay());
  const { goal, kind } = C.dailyGoal(state);
  const nx = C.nextAllowed(state);
  const early = nx?.at && Date.now() < nx.at ? nx.at - Date.now() : 0;
  update(s => { s.smokeLog.push(Date.now()); });
  const n = before + 1;
  if (early > 60e3 && n <= goal) { toast(`Logged, ${C.humanDuration(early)} early. Try to stretch the next one.`, '⏱'); return; }
  if (kind === 'target') {
    if (n === goal) toast('That’s today’s target. Done for the day.', '🎯');
    else if (n > goal) toast(`${n - goal} over target. Tomorrow is a new step.`, '•');
    else toast(`${goal - n} left today`, '✓');
  } else toast(`Logged · ${n} today`, '✓');
}

function renderProjection() {
  const run = C.currentRun(state);
  const start = run.start, now = Date.now();
  const { moneyPerDay } = C.rate(state.profile);
  const spans = {
    '1w': { n: 7, step: DAY, word: 'Day', lab: i => `d${i + 1}` },
    '1m': { n: 30, step: DAY, word: 'Day', lab: i => (i + 1) % 7 === 0 ? `d${i + 1}` : '' },
    '3m': { n: 13, step: WEEK, word: 'Week', lab: i => (i + 1) % 4 === 0 ? `w${i + 1}` : '' },
    '1y': { n: 12, step: MONTH, word: 'Month', lab: i => (i + 1) % 3 === 0 ? `m${i + 1}` : '' },
  };
  const sp = spans[ui.projection];
  const data = Array.from({ length: sp.n }, (_, i) => {
    const end = start + (i + 1) * sp.step;
    const v = (i + 1) * sp.step / DAY * moneyPerDay;
    const reached = end <= now;
    return { value: v, label: sp.lab(i), ghost: !reached, hi: !reached && end - sp.step <= now, tip: `${sp.word} ${i + 1}: ${money(v)}${reached ? '' : ' (projected)'}` };
  });
  const total = sp.n * sp.step / DAY * moneyPerDay;
  return `<section class="card">
    <div class="row between wrap"><h3>Projected savings</h3>
      <div class="seg" role="tablist">${['1w', '1m', '3m', '1y'].map(k => `<button role="tab" aria-selected="${ui.projection === k}" data-action="proj" data-v="${k}">${k.toUpperCase()}</button>`).join('')}</div></div>
    <p class="big-number">${money(total)}<small> and ${num(total / C.rate(state.profile).unitPrice || 0)} not smoked after ${{ '1w': '1 week', '1m': '1 month', '3m': '3 months', '1y': '1 year' }[ui.projection]}</small></p>
    ${barChart(data, { fmt: v => money(v, true), aria: 'Cumulative savings projection' })}
    <p class="legend"><span class="sw solid"></span>Saved <span class="sw ghost"></span>Still to come</p>
  </section>`;
}

// ---------- health ----------
function renderHealth() {
  const { t, anchor, done, next, progress } = C.milestoneState(state);
  const preQuit = C.elapsed(state) < 0;
  const intro = anchor == null
    ? 'Recovery starts from the last one you logged. Tap +1 on the home screen, or reach quit day.'
    : `Counting from the last one you logged, ${fmtDateTime(anchor)}. ${done.length} of ${MILESTONES.length} milestones reached.${preQuit ? ' Each one restarts the clock. Until quit day, it shows how far you get between them.' : ''}`;
  return `
    <h1 class="page-title">Health recovery</h1>
    <section class="card"><div class="rings" data-live="rings"></div>
    <p class="muted small">${intro}</p></section>
    <ol class="milestones">
      ${MILESTONES.map((m, i) => {
        const reached = t >= m.at;
        const isNext = next === m;
        return `<li class="ms ${reached ? 'done' : ''} ${isNext ? 'next' : ''}">
          <div class="ms-dot">${reached ? '✓' : ''}</div>
          <div class="ms-body">
            <p class="eyebrow">${C.milestoneLabel(m.at)}${reached
              ? `<span class="ms-state done">✓ Reached ${fmtDate(anchor + m.at, { day: 'numeric', month: 'short' })}, ${fmtTime(anchor + m.at)}</span>`
              : isNext ? `<span class="ms-state next">In progress</span>` : ''}</p>
            <h3>${esc(m.title)}</h3>
            <p>${esc(m.body)}</p>
            ${isNext ? `<div class="progress"><span style="width:${progress * 100}%"></span></div><p class="muted small">${C.humanDuration(m.at - t)} to go</p>` : ''}
            <details class="cite"><summary>Source</summary><a href="${m.src.url}" target="_blank" rel="noopener">${esc(m.src.name)}</a></details>
          </div></li>`;
      }).join('')}
    </ol>
    <p class="muted small disclaimer">General population figures from public health sources. Your own body may differ — this is not medical advice.</p>`;
}

function ringsHtml() {
  const t = Math.max(0, C.milestoneState(state).t);
  return RINGS.map(r => ring(t / r.full, { color: r.color, label: r.label, sub: t >= r.full ? 'recovered' : C.humanDuration(r.full - t) + ' left' })).join('');
}

// ---------- cravings ----------
function renderCravings() {
  const list = [...state.cravings].sort((a, b) => b.at - a.at);
  const week = list.filter(c => Date.now() - c.at < WEEK);
  const avg = week.length ? week.reduce((a, c) => a + c.strength, 0) / week.length : 0;
  const trend = C.cravingTrend(state, ui.trendDays);
  const metric = ui.trendMetric;
  const data = trend.map((d, i) => ({
    value: metric === 'count' ? d.count : d.avg,
    label: (ui.trendDays - 1 - i) % (ui.trendDays / 3) === 0 ? fmtDate(d.day, { day: 'numeric', month: 'short' }) : '',
    tip: `${fmtDate(d.day, { weekday: 'short', day: 'numeric', month: 'short' })}: ${d.count} craving${d.count === 1 ? '' : 's'}${d.count ? `, avg strength ${d.avg.toFixed(1)}` : ''}`,
  }));
  const cats = ['all', ...Object.keys(TAGS)];
  const all = C.triggerCounts(state);
  const filtered = ui.triggerCat === 'all' ? all : all.filter(x => TAGS[ui.triggerCat].includes(x.label));

  return `
    <h1 class="page-title">Cravings</h1>
    <div class="actions two"><button class="btn primary" data-action="log-craving">Log a craving</button><button class="btn ghost" data-action="sos">Help me now</button></div>
    <p class="muted small center">Logging a craving you rode out never resets your counter.</p>
    <div class="tiles">
      <div class="tile"><span class="tile-label">This week</span><strong>${week.length}</strong></div>
      <div class="tile"><span class="tile-label">Avg strength</span><strong>${week.length ? avg.toFixed(1) : '–'}<small>/10</small></strong></div>
      <div class="tile"><span class="tile-label">Ridden out</span><strong>${state.cravings.length}</strong></div>
    </div>
    <section class="card">
      <div class="row between wrap"><h3>${metric === 'count' ? 'Cravings per day' : 'Average strength'}</h3>
        <div class="seg">${[30, 60, 90].map(d => `<button aria-selected="${ui.trendDays === d}" data-action="trend-days" data-v="${d}">${d}d</button>`).join('')}</div></div>
      <div class="seg mini">${[['count', 'Count'], ['avg', 'Strength']].map(([k, l]) => `<button aria-selected="${metric === k}" data-action="trend-metric" data-v="${k}">${l}</button>`).join('')}</div>
      ${state.cravings.length ? barChart(data, { fmt: v => num(v, 1), aria: 'Craving trend' }) : emptyState('No cravings logged yet. Log one the next time it hits.')}
    </section>
    <section class="card">
      <div class="row between wrap"><h3>Top triggers</h3>
        <select class="select-sm" data-action="trigger-cat">${cats.map(c => `<option value="${c}" ${ui.triggerCat === c ? 'selected' : ''}>${c === 'all' ? 'All tags' : TAG_LABELS[c].replace('?', '')}</option>`).join('')}</select></div>
      ${filtered.length ? hbars(filtered, { fmt: v => `${v}×` }) : emptyState('Tag your cravings to see what sets you off.')}
    </section>
    <section class="card">
      <h3>Recent</h3>
      ${list.length ? `<ul class="log">${list.slice(0, 30).map(c => `
        <li><div class="strength s${Math.round(c.strength / 2)}">${c.strength}</div>
        <div class="grow"><strong>${fmtDate(c.at, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(c.at)}</strong>
        <p class="muted small">${esc(['where', 'feeling', 'doing', 'with'].flatMap(k => c[k] || []).join(' · ') || 'No tags')}${c.note ? ' — ' + esc(c.note) : ''}</p></div>
        <button class="icon-btn" data-action="del-craving" data-id="${c.id}" aria-label="Delete">✕</button></li>`).join('')}</ul>` : emptyState('Nothing here yet.')}
    </section>`;
}
const emptyState = msg => `<p class="empty">${esc(msg)}</p>`;

function cravingForm(prefill = {}) {
  const c = { strength: 5, where: [], feeling: [], doing: [], with: [], note: '', ...prefill };
  openModal(`
    <header class="sheet-head"><h2>Log a craving</h2><button class="icon-btn" data-action="close" aria-label="Close">✕</button></header>
    <form id="craving-form" class="form">
      <label>Strength <output id="sv">${c.strength}</output>/10
        <input type="range" min="0" max="10" step="1" name="strength" value="${c.strength}" oninput="document.getElementById('sv').textContent=this.value"></label>
      ${Object.entries(TAGS).map(([cat, tags]) => `
        <fieldset><legend>${TAG_LABELS[cat]}</legend><div class="chips">
        ${tags.map(t => `<label class="chip"><input type="checkbox" name="${cat}" value="${esc(t)}" ${c[cat].includes(t) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}
        </div></fieldset>`).join('')}
      <label>Note<input name="note" placeholder="Optional" value="${esc(c.note)}"></label>
      <p class="muted small">Riding out a craving never resets your counter.</p>
      <button class="btn primary big" type="submit">Save craving</button>
    </form>`, m => {
    $('#craving-form', m).addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const entry = { id: uid(), at: Date.now(), strength: +fd.get('strength'), note: fd.get('note').trim() };
      Object.keys(TAGS).forEach(k => { entry[k] = fd.getAll(k); });
      update(s => { s.cravings.push(entry); });
      closeModal(); toast('Craving logged. Well ridden.', '🌊');
    });
  });
}

// ---------- SOS ----------
let sosTimer;
function openSOS() {
  const reasons = state.profile.reasons;
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  const end = Date.now() + 5 * 60e3;
  openModal(`
    <header class="sheet-head"><h2>Ride it out</h2><button class="icon-btn" data-action="close" aria-label="Close">✕</button></header>
    <div class="sos">
      <div class="breath"><div class="breath-circle"></div><span id="breath-label">Breathe in</span></div>
      <p class="sos-timer" id="sos-timer">5:00</p>
      <p class="muted small center">Cravings peak and pass. Follow the circle until the timer runs out.</p>
      <p class="tip">💡 ${esc(tip)}</p>
      ${reasons.length ? `<div class="reasons"><p class="eyebrow">Your reasons</p><ul>${reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}
      <button class="btn primary big" data-action="sos-done">I made it — log this craving</button>
    </div>`);
  const phases = [['Breathe in', 4000], ['Hold', 4000], ['Breathe out', 6000]];
  let pi = 0, phaseEnd = Date.now() + phases[0][1];
  clearInterval(sosTimer);
  sosTimer = setInterval(() => {
    const now = Date.now();
    const left = Math.max(0, end - now);
    const el = $('#sos-timer');
    if (!el) return clearInterval(sosTimer);
    el.textContent = `${Math.floor(left / 60e3)}:${pad(Math.floor(left / 1000) % 60)}`;
    if (left === 0) el.textContent = 'You did it.';
    if (now >= phaseEnd) { pi = (pi + 1) % 3; phaseEnd = now + phases[pi][1]; $('#breath-label').textContent = phases[pi][0]; }
  }, 250);
}

// ---------- slip ----------
function confirmSlip() {
  const run = C.currentRun(state);
  openModal(`
    <header class="sheet-head"><h2>You smoked</h2><button class="icon-btn" data-action="close" aria-label="Close">✕</button></header>
    <p>It happens. A slip is information, not failure. Your counter will restart from the time below, and this run of <strong>${C.humanDuration(C.elapsed(state))}</strong> is saved in your history.</p>
    <form id="slip-form" class="form">
      <label>When?<input type="datetime-local" name="at" value="${toLocalInput(Date.now())}" min="${toLocalInput(run.start)}" max="${toLocalInput(Date.now())}"></label>
      <button class="btn danger big" type="submit">Restart my counter</button>
      <button class="btn ghost" type="button" data-action="close">Cancel</button>
    </form>`, m => $('#slip-form', m).addEventListener('submit', e => {
    e.preventDefault();
    const at = Math.min(Date.now(), Math.max(run.start, new Date(new FormData(e.target).get('at')).getTime() || Date.now()));
    slip(at); closeModal(); toast('Counter restarted. Keep going.', '↺');
  }));
}

/** Leaving a cut-down plan: keep the money it saved. */
function bankTaper(s) {
  if (s.plan.mode !== 'taper') return;
  const tp = C.taperToday(s);
  if (tp) s.savedExtra = (+s.savedExtra || 0) + tp.bankedPast;
}

function slip(at) {
  update(s => {
    const r = s.runs[s.runs.length - 1];
    if (!r || at < r.start) return;
    r.end = at;
    s.slips.push(at);
    s.smokeLog.push(at);
    s.runs.push({ start: at, end: null });
    bankTaper(s);
    s.plan.mode = 'now'; s.plan.quitAt = at;
  });
}

// ---------- diary ----------
function renderDiary() {
  const { current, best } = C.diaryStreaks(state);
  const today = C.dayKey();
  const keys = Object.keys(state.diary).sort().reverse();
  const groups = {};
  keys.forEach(k => { const m = k.slice(0, 7); (groups[m] ||= []).push(k); });
  const t = state.diary[today];
  return `
    <h1 class="page-title">Diary</h1>
    <div class="tiles">
      <div class="tile"><span class="tile-label">Logging streak</span><strong>${current}<small> day${current === 1 ? '' : 's'}</small></strong></div>
      <div class="tile"><span class="tile-label">Best streak</span><strong>${best}</strong></div>
    </div>
    <section class="card ${t ? '' : 'nudge'}">
      ${t ? `<div class="row between"><div><p class="eyebrow">Today</p>${entrySummary(t)}</div><button class="btn ghost small" data-action="diary-edit" data-day="${today}">Edit</button></div>`
      : `<div><strong>Today</strong><p class="muted small">One entry a day. Takes 20 seconds.</p></div><button class="btn primary small" data-action="diary-edit" data-day="${today}">Check in</button>`}
    </section>
    <div class="row gap"><button class="btn ghost small" data-action="diary-past">+ Add a missed day</button></div>
    ${Object.entries(groups).map(([m, ks]) => `
      <h3 class="month">${new Date(m + '-01T12:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
      <ul class="log diary-list">${ks.map(k => { const e = state.diary[k]; return `
        <li data-action="diary-edit" data-day="${k}" tabindex="0" role="button">
          <div class="dstat ${e.smoked ? 'smoked' : 'free'}">${e.smoked ? '✕' : '✓'}</div>
          <div class="grow"><strong>${C.keyToDate(k).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric' })}</strong>
          <p class="muted small">${e.smoked ? 'Smoked' : 'Smoke free'} · ${e.count} craving${e.count === 1 ? '' : 's'} · strength ${e.strength}/10${e.note ? ' — ' + esc(e.note) : ''}</p></div></li>`; }).join('')}</ul>`).join('') || emptyState('Your diary entries will appear here.')}`;
}
const entrySummary = e => `<p><strong>${e.smoked ? 'Smoked' : 'Smoke free'}</strong> · ${e.count} craving${e.count === 1 ? '' : 's'} · strength ${e.strength}/10</p>${e.note ? `<p class="muted small">${esc(e.note)}</p>` : ''}`;

function diaryForm(day) {
  const existing = state.diary[day];
  const start = C.keyToDate(day).getTime(), end = C.addDays(start, 1);
  const logged = state.cravings.filter(c => c.at >= start && c.at < end);
  const smokedN = C.smokedCount(state, start);
  const e = existing || { smoked: smokedN > 0, strength: logged.length ? Math.round(logged.reduce((a, c) => a + c.strength, 0) / logged.length) : 3, count: logged.length, note: '' };
  openModal(`
    <header class="sheet-head"><h2>${day === C.dayKey() ? 'Today' : C.keyToDate(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h2><button class="icon-btn" data-action="close" aria-label="Close">✕</button></header>
    <form id="diary-form" class="form">
      <div class="seg wide" role="radiogroup">
        <label><input type="radio" name="smoked" value="0" ${!e.smoked ? 'checked' : ''}><span>✓ Smoke free</span></label>
        <label><input type="radio" name="smoked" value="1" ${e.smoked ? 'checked' : ''}><span>✕ Smoked</span></label>
      </div>
      <label>Craving strength <output id="dsv">${e.strength}</output>/10
        <input type="range" min="0" max="10" name="strength" value="${e.strength}" oninput="document.getElementById('dsv').textContent=this.value"></label>
      <label>Number of cravings<input type="number" min="0" inputmode="numeric" name="count" value="${e.count}"></label>
      <label>Notes<textarea name="note" rows="3" placeholder="What helped? What was hard?">${esc(e.note)}</textarea></label>
      <button class="btn primary big" type="submit">Save</button>
      ${existing ? `<button class="btn danger-ghost" type="button" data-action="diary-del" data-day="${day}">Delete entry</button>` : ''}
    </form>`, m => $('#diary-form', m).addEventListener('submit', ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const entry = { smoked: fd.get('smoked') === '1', strength: +fd.get('strength'), count: Math.max(0, +fd.get('count') || 0), note: fd.get('note').trim(), at: Date.now() };
    const run = C.currentRun(state);
    const wasSmoked = existing?.smoked;
    update(s => { s.diary[day] = entry; });
    closeModal();
    toast('Diary saved');
    // A smoked day inside the current run: offer to restart the counter.
    if (entry.smoked && !wasSmoked && run && run.start < end && run.start <= Date.now() && C.elapsed(state) > 0) {
      const at = day === C.dayKey() ? Date.now() : Math.max(run.start, end - 1);
      openModal(`<header class="sheet-head"><h2>Restart your counter?</h2></header>
        <p>You marked ${day === C.dayKey() ? 'today' : 'this day'} as smoked, inside your current smoke-free run.</p>
        <div class="form"><button class="btn danger big" data-action="slip-at" data-at="${at}">Restart from ${day === C.dayKey() ? 'now' : 'end of that day'}</button>
        <button class="btn ghost" data-action="close">Keep my counter</button></div>`);
    }
  }));
}

// ---------- smoke history ----------
function smokeMaxDay() {
  // Only days before the smoke-free run (or up to today while you're still smoking).
  const run = C.currentRun(state);
  if (!run || C.elapsed(state) < 0) return C.startOfDay();
  return C.addDays(C.startOfDay(run.start), -1);
}

function renderSmokeHistory() {
  const log = state.smokeLog;
  const head = `<div class="row between"><h3>Daily log</h3><button class="btn ghost small" data-action="smoke-day">+ Past day</button></div>`;
  if (!log.length) return `<section class="card">${head}${emptyState('Nothing logged yet. Tap +1 on the home screen, or add a past day.')}</section>`;
  const today = C.startOfDay();
  const first = C.startOfDay(Math.min(...log));
  const span = Math.min(30, Math.max(7, C.daysBetween(first, today) + 1));
  const plan = C.taperPlan(state);
  const targetOn = d => plan?.days.find(x => x.day === d)?.target;
  const usual = Math.round(+state.profile.perDay || 0);
  const data = Array.from({ length: span }, (_, i) => {
    const d = C.addDays(today, i - span + 1), n = C.smokedCount(state, d), t = targetOn(d);
    return { value: n, label: (span - 1 - i) % Math.ceil(span / 5) === 0 ? fmtDate(d, { day: 'numeric', month: 'short' }) : '',
      tip: `${fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}: ${n} logged${t != null ? ` · target ${t}` : ''}` };
  });
  const byDay = new Map();
  log.forEach(t => { const k = C.dayKey(t); byDay.set(k, (byDay.get(k) || 0) + 1); });
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const avg = log.length / days.length;
  return `<section class="card">${head}
    <div class="tiles compact">
      <div class="tile"><span class="tile-label">Total</span><strong>${log.length}</strong></div>
      <div class="tile"><span class="tile-label">Days logged</span><strong>${days.length}</strong></div>
      <div class="tile"><span class="tile-label">Daily avg</span><strong>${num(avg, 1)}</strong></div>
    </div>
    ${barChart(data, { height: 140, ref: usual, refLabel: `usual ${usual}`, aria: 'Logged per day' })}
    <ul class="log daylist">${days.slice(0, 30).map(([k, n]) => {
      const t = targetOn(C.keyToDate(k).getTime());
      return `<li data-action="smoke-day" data-day="${k}" tabindex="0" role="button">
        <div class="grow"><strong>${C.keyToDate(k).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</strong>
        ${t != null ? `<p class="muted small">Target ${t}${n > t ? ` · ${n - t} over` : ' · on target'}</p>` : ''}</div>
        <span class="daycount ${t != null && n > t ? 'over' : ''}">${n}</span></li>`;
    }).join('')}</ul>
  </section>`;
}

function smokeDayForm(day) {
  const max = smokeMaxDay();
  const def = day || C.dayKey(Math.min(max, C.addDays(C.startOfDay(), -1)));
  const countFor = k => C.smokedCount(state, C.keyToDate(k).getTime());
  openModal(`<header class="sheet-head"><h2>A past day</h2><button class="icon-btn" data-action="close" aria-label="Close">✕</button></header>
    <form id="smoke-day-form" class="form">
      <label>Day<input type="date" name="d" max="${C.dayKey(max)}" value="${def}" required></label>
      <label>How many?<input type="number" name="n" min="0" max="200" inputmode="numeric" value="${countFor(def)}" required></label>
      <p class="muted small" id="sd-hint"></p>
      <button class="btn primary big">Save</button>
    </form>`, m => {
    const f = $('#smoke-day-form', m);
    const hint = () => {
      const k = f.d.value; if (!k) return;
      const c = countFor(k);
      $('#sd-hint', m).textContent = c ? `Currently ${c} logged for this day. Saving replaces it.` : 'Nothing logged for this day yet.';
    };
    f.d.addEventListener('change', () => { if (f.d.value) f.n.value = countFor(f.d.value); hint(); });
    hint();
    f.addEventListener('submit', e => {
      e.preventDefault();
      const start = C.keyToDate(f.d.value).getTime();
      if (!isFinite(start) || start > max) return toast('Pick a day before your smoke-free run', '⚠️');
      const n = Math.max(0, Math.min(200, Math.round(+f.n.value || 0)));
      const end = C.addDays(start, 1);
      // Spread the cigarettes across the waking day (8:00–22:00, or until now for today).
      let from = start + 8 * 36e5, to = Math.min(start + 22 * 36e5, Date.now());
      if (to <= from) { from = start; to = Math.max(start + 1, Date.now()); }
      const times = Array.from({ length: n }, (_, i) => Math.round(from + (to - from) * (n === 1 ? 0.5 : i / (n - 1))));
      update(s => { s.smokeLog = s.smokeLog.filter(t => t < start || t >= end).concat(times); });
      closeModal(); toast(`Saved ${n} for ${fmtDate(start, { weekday: 'short', day: 'numeric', month: 'short' })}`);
    });
  });
}

function diaryPast() {
  openModal(`<header class="sheet-head"><h2>Add a missed day</h2><button class="icon-btn" data-action="close" aria-label="Close">✕</button></header>
    <form id="past-form" class="form"><label>Which day?<input type="date" name="d" max="${C.dayKey()}" value="${C.dayKey(C.addDays(Date.now(), -1))}" required></label>
    <button class="btn primary big">Continue</button></form>`, m => $('#past-form', m).addEventListener('submit', e => {
    e.preventDefault(); const d = new FormData(e.target).get('d'); if (d) diaryForm(d);
  }));
}

// ---------- journey ----------
function renderJourney() {
  const runs = C.runLengths(state).reverse();
  const record = runs.reduce((a, r) => Math.max(a, r.length), 0);
  const cur = runs.find(r => r.current);
  const st = C.stats(state);
  const doneCount = st.missionsDone;
  const nextMission = MISSION_LIST.find(m => !state.missions[m.id]);
  // day grid: last 20 weeks, columns = weeks
  const weeks = 20;
  const today = C.startOfDay();
  const offset = (new Date(today).getDay() + 6) % 7; // Monday-first
  const gridStart = C.addDays(today, -(weeks - 1) * 7 - offset);
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = C.addDays(gridStart, i);
    const status = d > today ? 'future' : C.dayStatus(state, d);
    cells.push(`<span class="cell ${status}" data-tip="${fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}: ${{ free: 'smoke free', smoked: 'smoked', none: 'not tracked', future: '' }[status]}"></span>`);
  }

  return `
    <h1 class="page-title">Journey</h1>
    <div class="tiles">
      <div class="tile"><span class="tile-label">Current run</span><strong>${cur && cur.length > 0 ? C.humanDuration(cur.length) : '–'}</strong></div>
      <div class="tile"><span class="tile-label">Record</span><strong>${record ? C.humanDuration(record) : '–'}</strong></div>
      <div class="tile"><span class="tile-label">Total saved</span><strong>${money(st.lifetimeMoney, true)}</strong></div>
    </div>
    <div class="actions"><button class="btn ghost" data-action="share">Share progress card</button></div>

    ${state.profile.product !== 'vape' ? renderSmokeHistory() : ''}

    <section class="card"><h3>Smoke-free days</h3>
      <div class="grid-wrap"><div class="daygrid" style="--weeks:${weeks}">${cells.join('')}</div></div>
      <p class="legend"><span class="sw free"></span>Smoke free <span class="sw smoked"></span>Smoked <span class="sw none"></span>Not tracked</p>
    </section>

    <section class="card"><h3>Badges <span class="muted small">${Object.keys(state.badges).length}/${BADGES.length}</span></h3>
      <div class="badges">${BADGES.map(b => {
        const got = state.badges[b.id];
        const desc = b.money ? `Saved ${money(b.money, true)}` : b.id === 'u100' ? '100 not smoked' : b.desc;
        return `<div class="badge ${got ? 'got' : ''}" data-tip="${esc(b.name)} — ${esc(desc)}${got ? ' · earned ' + fmtDate(got) : ''}">
          <span class="b-icon">${b.icon}</span><span class="b-name">${esc(b.name)}</span></div>`;
      }).join('')}</div>
    </section>

    <section class="card"><div class="row between"><h3>Missions</h3><span class="muted small">${doneCount}/${MISSION_LIST.length}</span></div>
      <div class="progress"><span style="width:${doneCount / MISSION_LIST.length * 100}%"></span></div>
      ${MISSIONS.map(([phase], pi) => `
        <details class="phase" ${nextMission?.phase === phase ? 'open' : ''}>
          <summary><strong>${esc(phase)}</strong><span class="muted small">${MISSION_LIST.filter(m => m.phase === phase && state.missions[m.id]).length}/${MISSION_LIST.filter(m => m.phase === phase).length}</span></summary>
          <ul class="missions">${MISSION_LIST.filter(m => m.phase === phase).map(m => `
            <li class="${state.missions[m.id] ? 'done' : ''} ${nextMission === m ? 'next' : ''}">
              <label><input type="checkbox" data-action="mission" data-id="${m.id}" ${state.missions[m.id] ? 'checked' : ''}>
              <span><strong>${esc(m.title)}</strong><small>${esc(m.body)}</small></span></label></li>`).join('')}</ul>
        </details>`).join('')}
    </section>

    <section class="card"><h3>Smoke-free runs</h3>
      <ul class="log">${runs.map(r => `<li>
        <div class="grow"><strong>${C.humanDuration(r.length)} ${r.length === record && record > 0 ? '<span class="pill">Record</span>' : ''} ${r.current ? '<span class="pill live">Now</span>' : ''}</strong>
        <p class="muted small">${fmtDateTime(r.start)} → ${r.current ? 'now' : fmtDateTime(r.end)}</p></div></li>`).join('') || emptyState('Your first run starts on quit day.')}</ul>
    </section>`;
}

// ---------- settings ----------
function renderSettings() {
  const p = state.profile, r = state.reminders, pl = state.plan;
  const perm = N.supported() ? Notification.permission : 'unsupported';
  const guess = C.cravingHourGuess(state);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `
    <h1 class="page-title">Settings</h1>
    <section class="card"><h3>What you smoked</h3>
      <div class="form" data-scope="profile">
        <label>Product<select data-set="profile.product">${Object.entries(PRODUCTS).map(([k, x]) => `<option value="${k}" ${p.product === k ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>
        ${p.product === 'vape' ? `
          <label>Days per device<input type="number" min="0.1" step="0.1" value="${p.daysPerDevice}" data-set="profile.daysPerDevice"></label>
          <label>Price per device<input type="number" min="0" step="0.01" value="${p.packPrice}" data-set="profile.packPrice"></label>`
        : `<label>How many a day?<input type="number" min="1" value="${p.perDay}" data-set="profile.perDay"></label>
          <label>${P().perPackLabel}<input type="number" min="1" value="${p.perPack}" data-set="profile.perPack"></label>
          <label>Price per ${P().pack}<input type="number" min="0" step="0.01" value="${p.packPrice}" data-set="profile.packPrice"></label>`}
        <label>Currency<select data-set="profile.currency">${CURRENCIES.map(c => `<option ${c === p.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      </div>
      <p class="muted small">That’s ${money(C.rate(p).moneyPerDay)} a day, ${money(C.rate(p).moneyPerDay * 365.25, true)} a year.</p>
    </section>

    <section class="card"><h3>Quit plan</h3>
      <p>${C.elapsed(state) < 0 ? `Quit day: <strong>${fmtDateTime(pl.quitAt)}</strong>${pl.mode === 'taper' ? ' (tapering)' : ''}` : `Counting since <strong>${fmtDateTime(C.currentRun(state).start)}</strong>`}</p>
      <button class="btn ghost small" data-action="edit-plan">Change</button>
    </section>

    ${pl.mode === 'taper' ? `<section class="card"><h3>Spacing while cutting down</h3>
      <label class="switch"><input type="checkbox" data-set="spacing.on" ${state.spacing.on ? 'checked' : ''}><span>Spread today’s count over my waking hours</span></label>
      <div class="row gap wrap ${state.spacing.on ? '' : 'disabled'}" style="margin-top:14px">
        <label class="small muted">Wake up <input type="time" class="input-sm" value="${state.spacing.wake}" data-set="spacing.wake"></label>
        <label class="small muted">Bedtime <input type="time" class="input-sm" value="${state.spacing.sleep}" data-set="spacing.sleep"></label>
      </div>
      <p class="muted small" style="margin-top:10px">The home screen shows when your next one is due. Waiting longer than that always counts as a win.</p>
    </section>` : ''}

    <section class="card"><h3>My reasons</h3>
      <textarea rows="4" data-set="profile.reasons" placeholder="One per line">${esc(p.reasons.join('\n'))}</textarea>
      <p class="muted small">Shown in the SOS screen when a craving hits.</p>
    </section>

    <section class="card"><h3>Reminders</h3>
      ${perm === 'unsupported' ? `<p class="muted small">This browser doesn’t support notifications. On iPhone, add Enough to your Home Screen first.</p>` : `
      <label class="switch"><input type="checkbox" data-action="reminders-toggle" ${r.enabled && perm === 'granted' ? 'checked' : ''}><span>Enable reminders</span></label>
      ${perm === 'denied' ? `<p class="muted small">Notifications are blocked for this site. Allow them in your browser settings.</p>` : ''}
      <div class="form ${r.enabled ? '' : 'disabled'}">
        <label class="switch"><input type="checkbox" data-set="reminders.diary.on" ${r.diary.on ? 'checked' : ''}><span>Daily diary nudge</span></label>
        <div class="row gap wrap"><input type="time" value="${r.diary.time}" data-set="reminders.diary.time" class="input-sm">
          <div class="chips">${days.map((d, i) => `<label class="chip sm"><input type="checkbox" data-action="diary-day" data-v="${i}" ${r.diary.days.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div></div>
        <label class="switch"><input type="checkbox" data-set="reminders.craving.on" ${r.craving.on ? 'checked' : ''}><span>Craving support nudge</span></label>
        <label>Hour<select data-set="reminders.craving.hour" class="input-sm">
          <option value="" ${r.craving.hour == null ? 'selected' : ''}>Auto${guess != null ? ` (${pad(guess)}:00 from your log)` : ' (log 3+ cravings)'}</option>
          ${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${r.craving.hour === h ? 'selected' : ''}>${pad(h)}:00</option>`).join('')}</select></label>
        <label class="switch"><input type="checkbox" data-set="reminders.milestones" ${r.milestones ? 'checked' : ''}><span>Health milestones</span></label>
        <label class="switch"><input type="checkbox" data-set="reminders.quitDay" ${r.quitDay ? 'checked' : ''}><span>Quit day</span></label>
        <label class="switch"><input type="checkbox" data-set="reminders.taper.on" ${r.taper.on ? 'checked' : ''}><span>Morning taper target</span></label>
        <input type="time" value="${r.taper.time}" data-set="reminders.taper.time" class="input-sm">
      </div>
      <p class="muted small">Web apps can’t schedule alarms on their own, so reminders fire while Enough is open or running in the background, and missed ones show up when you return.</p>`}
    </section>

    <section class="card"><h3>Appearance</h3>
      <div class="seg">${['auto', 'light', 'dark'].map(t => `<button aria-selected="${state.ui.theme === t}" data-action="theme" data-v="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      <div class="swatches">${[['sky', 'Sky', '#2f6fed'], ['grape', 'Grape', '#7048e8'], ['lagoon', 'Lagoon', '#0789ad']].map(([k, l, c]) =>
        `<button class="swatch" aria-pressed="${(state.ui.accent || 'sky') === k}" data-action="accent" data-v="${k}"><i style="background:${c}"></i>${l}</button>`).join('')}</div>
    </section>

    <section class="card"><h3>Your data</h3>
      <p class="muted small">Everything is stored only in this browser. Export a backup to move devices or keep it safe.</p>
      <div class="row gap wrap">
        <button class="btn ghost" data-action="export">Export backup</button>
        <label class="btn ghost">Import backup<input type="file" accept="application/json,.json" data-action="import" hidden></label>
        <button class="btn danger-ghost" data-action="wipe">Erase everything</button>
      </div>
    </section>
    <p class="muted small center disclaimer">Enough is a self-help tracker, not medical advice. For support, talk to your doctor or a local quit line.</p>`;
}

function editPlan() {
  const pl = state.plan;
  const future = C.elapsed(state) < 0;
  openModal(`<header class="sheet-head"><h2>Change quit plan</h2><button class="icon-btn" data-action="close" aria-label="Close">✕</button></header>
    <form id="plan-form" class="form">
      <label>Plan<select name="mode">
        <option value="now">Quit now</option>
        <option value="date" ${future && pl.mode === 'date' ? 'selected' : ''}>Quit on a date</option>
        ${state.profile.product !== 'vape' ? `<option value="taper" ${future && pl.mode === 'taper' ? 'selected' : ''}>Cut down to a date</option>` : ''}
        <option value="back" ${!future ? 'selected' : ''}>Correct when I stopped</option>
      </select></label>
      <label>Date & time<input type="datetime-local" name="when" value="${toLocalInput(pl.quitAt || Date.now())}"></label>
      <label class="taper-only">Taper from (per day)<input type="number" min="1" name="from" value="${pl.taperFrom || state.profile.perDay}"></label>
      <button class="btn primary big">Save</button>
    </form>`, m => {
    const f = $('#plan-form', m);
    const sync = () => { f.querySelector('.taper-only').hidden = f.mode.value !== 'taper'; f.when.closest('label').hidden = f.mode.value === 'now'; };
    f.mode.addEventListener('change', sync); sync();
    f.addEventListener('submit', e => {
      e.preventDefault();
      const mode = f.mode.value, now = Date.now();
      let at = mode === 'now' ? now : new Date(f.when.value).getTime();
      if (!isFinite(at)) return toast('Pick a valid date', '⚠️');
      if (mode === 'back') at = Math.min(at, now);
      if ((mode === 'date' || mode === 'taper') && at <= now) return toast('Quit date must be in the future', '⚠️');
      update(s => {
        const r = s.runs[s.runs.length - 1];
        const prev = s.runs[s.runs.length - 2];
        if (prev && at < (prev.end ?? 0)) at = prev.end;
        if (r) r.start = at; else s.runs.push({ start: at, end: null });
        if (mode !== 'taper') bankTaper(s);
        s.plan = { mode: mode === 'back' ? 'now' : mode, quitAt: at, taperStartAt: mode === 'taper' ? (s.plan.mode === 'taper' && s.plan.taperStartAt ? s.plan.taperStartAt : now) : null, taperFrom: +f.from.value || s.profile.perDay };
      });
      N.silenceReached();
      closeModal(); toast('Plan updated');
    });
  });
}

// ---------- events ----------
function setPath(obj, path, val) {
  const ks = path.split('.'); const last = ks.pop();
  ks.reduce((o, k) => o[k], obj)[last] = val;
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'INPUT' && el.type === 'file') return;
  const a = el.dataset.action;
  switch (a) {
    case 'close': closeModal(); break;
    case 'ob-next':
      if (ui.onboardStep >= 4) finishOnboarding(); else { ui.onboardStep++; render(); }
      break;
    case 'ob-back': ui.onboardStep = Math.max(0, ui.onboardStep - 1); render(); break;
    case 'log-craving': cravingForm(); break;
    case 'sos': openSOS(); break;
    case 'sos-done': clearInterval(sosTimer); cravingForm(); break;
    case 'slip': confirmSlip(); break;
    case 'smoke-plus': if (C.elapsed(state) >= 0) confirmSlip(); else logSmoke(); break;
    case 'smoke-day': smokeDayForm(el.dataset.day); break;
    case 'smoke-undo': {
      const today = C.startOfDay();
      update(s => { const i = s.smokeLog.findLastIndex(t => t >= today); if (i >= 0) s.smokeLog.splice(i, 1); });
      toast('Removed the last one', '↶');
      break;
    }
    case 'slip-at': slip(+el.dataset.at); closeModal(); toast('Counter restarted. Keep going.', '↺'); break;
    case 'quit-now':
      if (confirm('Start your smoke-free counter right now?')) update(s => { bankTaper(s); s.runs[s.runs.length - 1].start = Date.now(); s.plan.quitAt = Date.now(); s.plan.mode = 'now'; });
      break;
    case 'edit-plan': editPlan(); break;
    case 'proj': ui.projection = el.dataset.v; render(); break;
    case 'trend-days': ui.trendDays = +el.dataset.v; render(); break;
    case 'trend-metric': ui.trendMetric = el.dataset.v; render(); break;
    case 'del-craving': if (confirm('Delete this craving?')) update(s => { s.cravings = s.cravings.filter(c => c.id !== el.dataset.id); }); break;
    case 'diary-edit': diaryForm(el.dataset.day); break;
    case 'diary-past': diaryPast(); break;
    case 'diary-del': if (confirm('Delete this diary entry?')) { update(s => { delete s.diary[el.dataset.day]; }); closeModal(); } break;
    case 'share': {
      const t = Math.max(0, C.elapsed(state));
      const sv = C.savedFor(t, state.profile);
      const { done } = C.milestoneState(state);
      await shareCard({ days: Math.floor(t / DAY), money: money(sv.money, sv.money >= 100), units: `${num(Math.floor(sv.units))}`, latest: done.length ? done[done.length - 1].title : '' });
      break;
    }
    case 'theme': update(s => { s.ui.theme = el.dataset.v; }); break;
    case 'accent': update(s => { s.ui.accent = el.dataset.v; }); break;
    case 'export': {
      const blob = new Blob([exportJSON()], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob); link.download = `enough-backup-${C.dayKey()}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      break;
    }
    case 'wipe':
      if (confirm('Erase all your data from this device? Export a backup first if you might want it back.')) { reset(); draft = null; ui.onboardStep = 0; location.hash = ''; render(); }
      break;
  }
});

document.addEventListener('change', async e => {
  const el = e.target;
  const a = el.dataset.action;
  if (a === 'import' && el.files?.[0]) {
    const text = await el.files[0].text();
    el.value = '';
    try {
      if (state.setup && !confirm('Replace all current data with this backup?')) return;
      importJSON(text); draft = null; toast('Backup restored'); render();
    } catch (err) { toast(err.message || 'Import failed', '⚠️'); }
    return;
  }
  if (a === 'mission') { update(s => { if (el.checked) s.missions[el.dataset.id] = Date.now(); else delete s.missions[el.dataset.id]; }); return; }
  if (a === 'trigger-cat') { ui.triggerCat = el.value; render(); return; }
  if (a === 'diary-day') {
    update(s => { const v = +el.dataset.v; const set = new Set(s.reminders.diary.days); el.checked ? set.add(v) : set.delete(v); s.reminders.diary.days = [...set].sort(); });
    return;
  }
  if (a === 'reminders-toggle') {
    if (el.checked) {
      const res = await N.requestPermission();
      if (res !== 'granted') { el.checked = false; toast('Notifications were not allowed', '⚠️'); render(); return; }
      N.silenceReached();
    }
    update(s => { s.reminders.enabled = el.checked; });
    return;
  }
  if (el.dataset.set) {
    const path = el.dataset.set;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (path === 'profile.reasons') v = el.value.split('\n').map(x => x.trim()).filter(Boolean);
    else if (el.type === 'number') { v = parseFloat(v); if (!isFinite(v) || v < 0) return render(); }
    else if (path === 'reminders.craving.hour') v = v === '' ? null : +v;
    update(s => setPath(s, path, v));
    return;
  }
  if (el.dataset.draft) { readDraft(el); if (el.type === 'radio') render(); }
});

document.addEventListener('input', e => {
  if (e.target.dataset.draft && e.target.type !== 'radio') readDraft(e.target);
});
function readDraft(el) {
  const k = el.dataset.draft;
  draft[k] = el.type === 'number' ? (parseFloat(el.value) || 0) : el.value;
  if (k === 'perDay') draft.taperFrom = draft.perDay;
}

document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('li[data-action]')) { e.preventDefault(); e.target.click(); }
});

// ---------- live tick ----------
let lastBadgeCheck = 0;
function tick() {
  if (!state.setup) return;
  const now = Date.now();
  const t = C.elapsed(state, now);
  const set = (k, v) => $$(`[data-live="${k}"]`).forEach(el => { if (el.innerHTML !== v) el.innerHTML = v; });
  if (t < 0) {
    const { d, h, m, s } = C.splitDuration(-t);
    set('clock', d >= 1
      ? `<b>${d} ${d === 1 ? 'day' : 'days'}</b> ${h} h <small>${pad(m)} min ${pad(s)} s</small>`
      : `<b>${h} h</b> ${pad(m)} min <small>${pad(s)} s</small>`);
    if (-t < 1000) setTimeout(render, 1100);
  } else {
    const hp = heroParts(t);
    set('big', String(hp.big));
    set('words', hp.words);
    const sv = C.savedFor(t, state.profile);
    set('money', money(sv.money));
    set('money-total', money(sv.money + C.taperSavings(state, now)));
    set('units', num(sv.units, state.profile.product === 'vape' ? 1 : 0));
    const ms = C.milestoneState(state, now);
    if (ms.next) {
      set('next-left', 'in ' + C.humanDuration(ms.next.at - ms.t));
      $$('[data-live="next-bar"]').forEach(el => { el.style.width = (ms.progress * 100).toFixed(2) + '%'; });
    }
  }
  $$('[data-live-next]').forEach(box => {
    const left = +box.dataset.liveNext - now;
    const el = box.querySelector('[data-live="next-cig"]');
    const ready = left <= 0;
    box.classList.toggle('ready', ready);
    const v = ready ? 'Now, if you need it' : `in ${left < 60e3 ? '<1 min' : C.humanDuration(left)}`;
    if (el && el.textContent !== v) el.textContent = v;
  });
  $$('[data-live="since-last"]').forEach(el => {
    const { d, h, m, s: sec } = C.splitDuration(now - +el.dataset.last);
    const v = `${d ? d + 'd ' : ''}${d ? pad(h) : h}:${pad(m)}:${pad(sec)}`;
    if (el.textContent !== v) el.textContent = v;
  });
  const rings = $$('[data-live="rings"]');
  if (rings.length) { const h = ringsHtml(); rings.forEach(el => { if (el.innerHTML !== h) el.innerHTML = h; }); }

  if (now - lastBadgeCheck > 5000) {
    lastBadgeCheck = now;
    const st = C.stats(state, now);
    const fresh = BADGES.filter(b => !state.badges[b.id] && b.test(st));
    if (fresh.length) {
      update(s => fresh.forEach(b => { s.badges[b.id] = now; }));
      fresh.slice(-2).forEach(b => toast(`Badge earned: ${b.name}`, b.icon));
    }
  }
}

function logoSvg() {
  return `<img src="icons/icon.svg" alt="" width="96" height="96">`;
}

// ---------- boot ----------
subscribe(() => render());
initTooltips();
render();
setInterval(tick, 1000);
N.start();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
}
