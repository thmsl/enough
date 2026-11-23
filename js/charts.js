// Tiny SVG/HTML charts. Single series, accent color, thin marks, hover/tap tooltips.

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/**
 * Vertical bar chart.
 * data: [{ value, label?, tip, ghost? }]  label = x tick (sparse ok)
 */
export function barChart(data, { height = 160, fmt = v => v, aria = 'Bar chart', ref = null, refLabel = '' } = {}) {
  const W = 320, H = height, padL = 34, padB = 20, padT = 8;
  const max = niceMax(Math.max(...data.map(d => d.value), ref ?? 0, 0));
  const n = data.length;
  const slot = (W - padL) / n;
  const gap = Math.min(2 + slot * 0.25, 6);
  const bw = Math.max(1.5, slot - gap);
  const y = v => padT + (H - padT - padB) * (1 - v / max);
  const r = Math.min(4, bw / 2);

  const grid = [0, 0.5, 1].map(f => {
    const v = max * f, yy = y(v);
    return `<line x1="${padL}" x2="${W}" y1="${yy}" y2="${yy}" class="grid"/>
      <text x="${padL - 6}" y="${yy + 3}" class="tick" text-anchor="end">${esc(fmt(v))}</text>`;
  }).join('');

  const bars = data.map((d, i) => {
    const x = padL + i * slot + gap / 2;
    const h = Math.max(0, y(0) - y(d.value));
    const top = y(0) - h;
    // rounded top, square base
    const path = h > 0.5
      ? `M${x},${y(0)} V${top + Math.min(r, h)} Q${x},${top} ${x + Math.min(r, h)},${top} H${x + bw - Math.min(r, h)} Q${x + bw},${top} ${x + bw},${top + Math.min(r, h)} V${y(0)} Z`
      : '';
    const label = d.label ? `<text x="${x + bw / 2}" y="${H - 5}" class="tick" text-anchor="middle">${esc(d.label)}</text>` : '';
    const tgt = d.target != null ? `<line x1="${x - 1}" x2="${x + bw + 1}" y1="${y(d.target)}" y2="${y(d.target)}" class="target"/>` : '';
    return `<g class="bar ${d.ghost ? 'ghost' : ''} ${d.hi ? 'hi' : ''} ${d.over ? 'over' : ''}" data-tip="${esc(d.tip)}">
      <rect x="${padL + i * slot}" y="${padT}" width="${slot}" height="${H - padT - padB}" class="hit"/>
      ${path ? `<path d="${path}"/>` : ''}${tgt}${label}</g>`;
  }).join('');

  const refLine = ref != null ? `<line x1="${padL}" x2="${W}" y1="${y(ref)}" y2="${y(ref)}" class="ref"/>
    <text x="${W}" y="${y(ref) - 4}" class="tick ref-label" text-anchor="end">${esc(refLabel)}</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">
    ${grid}<line x1="${padL}" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="axis"/>${bars}${refLine}</svg>`;
}

/** Horizontal labelled bars (HTML), for ranked categories. */
export function hbars(data, { max = 8, fmt = v => v } = {}) {
  if (!data.length) return '';
  const top = data.slice(0, max);
  const m = Math.max(...top.map(d => d.value));
  return `<div class="hbars">${top.map(d => `
    <div class="hbar" data-tip="${esc(d.label)}: ${esc(fmt(d.value))}">
      <span class="hbar-label">${esc(d.label)}</span>
      <span class="hbar-track"><span class="hbar-fill" style="width:${(d.value / m) * 100}%"></span></span>
      <span class="hbar-value">${esc(fmt(d.value))}</span>
    </div>`).join('')}</div>`;
}

/** Ring progress (SVG). */
export function ring(frac, { size = 84, stroke = 8, color = 'var(--accent)', label = '', sub = '' } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, frac));
  return `<div class="ring" style="--size:${size}px">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}"
        transform="rotate(-90 ${size / 2} ${size / 2})" class="ring-fill"/>
    </svg>
    <div class="ring-center"><strong>${Math.floor(f * 100)}%</strong></div>
    <div class="ring-label">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>
  </div>`;
}

// Shared tooltip: hover on desktop, tap on touch.
export function initTooltips() {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'status');
  document.body.appendChild(tip);
  let active = null;
  const show = (el, x, y) => {
    active?.classList.remove('active');
    active = el; el.classList.add('active');
    tip.textContent = el.dataset.tip;
    tip.style.display = 'block';
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2)) + 'px';
    tip.style.top = Math.max(8, y - h - 14) + 'px';
  };
  const hide = () => { tip.style.display = 'none'; active?.classList.remove('active'); active = null; };
  document.addEventListener('pointermove', e => {
    const el = e.target.closest?.('[data-tip]');
    if (el && e.pointerType === 'mouse') show(el, e.clientX, e.clientY);
    else if (!el && e.pointerType === 'mouse') hide();
  });
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest?.('[data-tip]');
    if (el && e.pointerType !== 'mouse') show(el, e.clientX, e.clientY); else if (!el) hide();
  });
  window.addEventListener('scroll', hide, { passive: true });
}
