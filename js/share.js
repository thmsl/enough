// Draws a progress card to a canvas and shares (or downloads) it.

export async function shareCard({ days, money, latest, units }) {
  const c = document.createElement('canvas');
  const S = 1080; c.width = S; c.height = S;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, '#2f6fed'); grad.addColorStop(1, '#7048e8');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);

  // soft circles
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.beginPath(); g.arc(S * 0.85, S * 0.15, 260, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(S * 0.1, S * 0.95, 200, 0, Math.PI * 2); g.fill();

  const font = (w, px) => `${w} ${px}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  g.fillStyle = '#ffffff';
  g.font = font(600, 44); g.fillText('Enough.', 90, 140);
  g.font = font(800, 300); g.fillText(String(days), 80, 470);
  g.font = font(500, 56); g.fillStyle = '#dfe6ff';
  g.fillText(days === 1 ? 'day smoke free' : 'days smoke free', 90, 560);

  g.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(g, 90, 640, 420, 180, 28); roundRect(g, 570, 640, 420, 180, 28);
  g.fillStyle = '#ffffff'; g.font = font(700, 64);
  g.fillText(money, 130, 740); g.fillText(units, 610, 740);
  g.fillStyle = '#dfe6ff'; g.font = font(500, 34);
  g.fillText('saved', 130, 790); g.fillText('not smoked', 610, 790);

  if (latest) {
    g.fillStyle = '#ffffff'; g.font = font(600, 40);
    g.fillText('Latest: ' + latest, 90, 930, S - 180);
  }

  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], `enough-${days}-days.png`, { type: 'image/png' });
  const text = `${days} ${days === 1 ? 'day' : 'days'} smoke free and ${money} saved.`;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill();
}
