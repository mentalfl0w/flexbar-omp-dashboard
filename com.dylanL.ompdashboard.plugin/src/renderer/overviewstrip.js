'use strict';

// OMP Overview Strip — full-width (2170px) dashboard bar via directDraw.
// Sections: Today | 7-Day Trend | Top Models | Live Rates.

const { createCanvas } = require('@napi-rs/canvas');

const BG = '#000000';
const BG_RAISED = '#1C1C1E';
const ACCENT = '#0A84FF';
const GREEN = '#30D158';
const ORANGE = '#FF9F0A';
const RED = '#FF453A';
const GRAY = '#8E8E93';
const TEXT = '#FFFFFF';
const MONO = '700 15px "SF Mono", Menlo, monospace';
const LABEL = '400 10px -apple-system, "SF Pro Text", sans-serif';

const SECTIONS = {
  today: { width: 420 },
  trend: { width: 480 },
  models: { width: 460 },
  agents: { width: 360 },
  recent: { width: 300 },
  live: { width: 150 }
};

function fmtCost(v, currency) {
  const sym = currency === 'CNY' ? '¥' : '$';
  if (v >= 1000) return sym + (v / 1000).toFixed(1) + 'k';
  if (v >= 100) return sym + v.toFixed(0);
  return sym + v.toFixed(2);
}

function fmtTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawToday(ctx, x, w, d, currency) {
  ctx.fillStyle = GRAY;
  ctx.font = LABEL;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('TODAY', x + 12, 6);

  const rows = [
    ['Calls', String(d.calls || 0), TEXT],
    ['Tokens', fmtTokens((d.inputTokens || 0) + (d.outputTokens || 0)), ACCENT],
    ['Cost', fmtCost(d.costTotal || 0, currency), GREEN]
  ];
  rows.forEach((r, i) => {
    ctx.fillStyle = GRAY;
    ctx.font = LABEL;
    ctx.textBaseline = 'middle';
    ctx.fillText(r[0], x + 12, 22 + i * 14);
    ctx.fillStyle = r[2];
    ctx.font = MONO;
    ctx.textAlign = 'right';
    ctx.fillText(r[1], x + w - 12, 22 + i * 14);
  });
}

function drawTrend(ctx, x, w, trend, currency) {
  ctx.fillStyle = GRAY;
  ctx.font = LABEL;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('7-DAY COST', x + 12, 6);

  if (!trend || trend.length === 0) {
    ctx.fillStyle = GRAY;
    ctx.font = LABEL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No data', x + w / 2, 34);
    return;
  }

  const x0 = x + 12, y0 = 18, x1 = x + w - 12, y1 = 46;
  const max = Math.max(...trend.map((t) => t.cost), 0.01);
  const n = trend.length;
  const pts = trend.map((t, i) => ({
    px: x0 + (n === 1 ? (x1 - x0) / 2 : (i / (n - 1)) * (x1 - x0)),
    py: y1 - (t.cost / max) * (y1 - y0 - 6)
  }));

  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  for (let g = 1; g < 3; g++) {
    const gy = y0 + ((y1 - y0) / 3) * g;
    ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x1, gy); ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(pts[0].px, y1);
  pts.forEach((p) => ctx.lineTo(p.px, p.py));
  ctx.lineTo(pts[pts.length - 1].px, y1);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, y0, 0, y1);
  grad.addColorStop(0, 'rgba(10,132,255,0.30)');
  grad.addColorStop(1, 'rgba(10,132,255,0.02)');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py)));
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();
  pts.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.px, p.py, 2, 0, Math.PI * 2);
    ctx.fillStyle = ACCENT;
    ctx.fill();
  });
  ctx.fillStyle = TEXT;
  ctx.font = MONO;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(fmtCost(max, currency), x1, y0 - 2);
}

function drawModels(ctx, x, w, models, currency) {
  ctx.fillStyle = GRAY;
  ctx.font = LABEL;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('TOP MODELS', x + 12, 6);

  if (!models || models.length === 0) {
    ctx.fillStyle = GRAY;
    ctx.font = LABEL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No data', x + w / 2, 34);
    return;
  }

  const maxCost = Math.max(...models.map((m) => m.cost), 0.01);
  models.slice(0, 3).forEach((m, i) => {
    const ry = 18 + i * 14;
    const name = (m.model || '?').length > 14 ? (m.model || '?').slice(0, 13) + '…' : (m.model || '?');
    ctx.fillStyle = TEXT;
    ctx.font = '600 9px "SF Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + 12, ry + 6);
    const bw = (w - 180) * (m.cost / maxCost);
    const barColor = m.cost / maxCost > 0.7 ? RED : m.cost / maxCost > 0.4 ? ORANGE : GREEN;
    ctx.fillStyle = BG_RAISED;
    roundRect(ctx, x + 120, ry + 1, w - 180, 7, 3);
    ctx.fill();
    ctx.fillStyle = barColor;
    roundRect(ctx, x + 120, ry + 1, Math.max(4, bw), 7, 3);
    ctx.fill();
    ctx.fillStyle = GRAY;
    ctx.font = '400 8px "SF Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(fmtCost(m.cost, currency), x + w - 12, ry + 6);
  });
}

function drawLive(ctx, x, w, rates) {
  ctx.fillStyle = GRAY;
  ctx.font = LABEL;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('LIVE 5M', x + 12, 6);

  const rows = [
    ['calls', String(rates.callsPerMin || 0), ACCENT],
    ['tokens', fmtTokens(rates.tokensPerMin || 0), ORANGE],
    ['cost', fmtCost(rates.costPerMin || 0, 'USD'), GREEN]
  ];
  rows.forEach((r, i) => {
    ctx.fillStyle = GRAY;
    ctx.font = LABEL;
    ctx.textBaseline = 'middle';
    ctx.fillText(r[0], x + 12, 22 + i * 14);
    ctx.fillStyle = r[2];
    ctx.font = MONO;
    ctx.textAlign = 'right';
    ctx.fillText(r[1], x + w - 12, 22 + i * 14);
  });
}

function drawAgents(ctx, x, w, agents) {
  ctx.fillStyle = GRAY;
  ctx.font = LABEL;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('AGENTS', x + 12, 6);

  if (!agents || agents.length === 0) {
    ctx.fillStyle = GRAY;
    ctx.font = LABEL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('-', x + w / 2, 34);
    return;
  }

  const total = agents.reduce((s, a) => s + (Number(a.calls) || 0), 0) || 1;
  const colors = [ACCENT, GREEN, ORANGE, RED, GRAY];
  const cx = x + 42, cy = 34, r = 20, ir = 12;
  let start = -Math.PI / 2;
  agents.slice(0, 5).forEach((a, i) => {
    const frac = (Number(a.calls) || 0) / total;
    const end = start + frac * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end);
    ctx.arc(cx, cy, ir, end, start, true);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    start = end;
  });
  // Legend (up to 3)
  let ly = 14;
  agents.slice(0, 3).forEach((a, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(x + 84, ly + 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TEXT;
    ctx.font = '400 9px "SF Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText((a.agent_type || '?').slice(0, 8), x + 92, ly + 2);
    ly += 12;
  });
}

function drawRecent(ctx, x, w, recent) {
  ctx.fillStyle = GRAY;
  ctx.font = LABEL;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('RECENT', x + 12, 6);

  if (!recent || recent.length === 0) {
    ctx.fillStyle = GRAY;
    ctx.font = LABEL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('-', x + w / 2, 34);
    return;
  }

  recent.slice(0, 3).forEach((r, i) => {
    const ry = 14 + i * 13;
    const t = (r.time || '').match(/(\d{2}:\d{2})/);
    ctx.fillStyle = ACCENT;
    ctx.font = '700 9px "SF Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(t ? t[1] : '', x + 12, ry + 3);
    ctx.fillStyle = TEXT;
    ctx.font = '400 9px "SF Mono", monospace';
    ctx.fillText((r.model || '?').slice(0, 8), x + 52, ry + 3);
  });
}

/**
 * Render the OMP overview strip (full width bar).
 * @param {object} d - { today, trend, models, rates, currency }
 * @returns {{ dataURL: string, layout: Array<{id,x0,x1}> }}
 */
function renderStrip(d) {
  const width = 2170;
  const canvas = createCanvas(width, 60);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, 60);

  const order = ['today', 'trend', 'models', 'agents', 'recent', 'live'];
  const layout = [];
  let x = 0;
  for (const id of order) {
    const w = SECTIONS[id].width;
    if (x + w > 2170) break;
    switch (id) {
      case 'today': drawToday(ctx, x, w, d.today || {}, d.currency); break;
      case 'trend': drawTrend(ctx, x, w, d.trend || [], d.currency); break;
      case 'models': drawModels(ctx, x, w, d.models || [], d.currency); break;
      case 'agents': drawAgents(ctx, x, w, d.agents || []); break;
      case 'recent': drawRecent(ctx, x, w, d.recent || []); break;
      case 'live': drawLive(ctx, x, w, d.rates || {}); break;
    }
    layout.push({ id, x0: x, x1: x + w });
    x += w;
  }
  return { dataURL: canvas.toDataURL('image/png'), layout };
}

module.exports = { renderStrip };
