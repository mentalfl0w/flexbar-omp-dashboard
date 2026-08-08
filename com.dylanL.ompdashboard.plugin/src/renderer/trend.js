'use strict';

/**
 * Trend renderer — 480x60 canvas
 * Mini line chart of 7-day cost with points + line
 * X-axis weekday labels
 */

const { createBaseCanvas, fmtCost, COLORS, FONT_MONO, FONT_SANS } = require('./utils');

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Render 7-day trend chart
 * @param {Array} data - array of { day, calls, tokens, cost } ascending
 * @param {string} [currency]
 * @returns {string} data URL PNG
 */
function renderTrend(data, currency, width = 480) {
  const W = width, H = 60;
  const { canvas, ctx } = createBaseCanvas(W, H);

  if (!data || data.length === 0) {
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '11px ' + FONT_SANS;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No trend data', W / 2, H / 2);
    return canvas.toDataURL('image/png');
  }

  const padX = 12;
  const chartLeft = padX + 40;
  const chartRight = W - padX;
  const chartTop = 18;
  const chartBottom = 46;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;

  // Title
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '600 10px ' + FONT_SANS;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('7-Day Cost Trend', padX, 14);

  // Find max cost for scaling
  const costs = data.map(d => Number(d.cost) || 0);
  const maxCost = Math.max(...costs, 0.01);

  // Draw Y-axis labels (max and 0)
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '9px ' + FONT_MONO;
  ctx.textAlign = 'right';
  ctx.fillText(fmtCost(maxCost, currency).replace(/\.00$/, ''), chartLeft - 4, chartTop + 8);
  ctx.fillText('$0', chartLeft - 4, chartBottom);

  // Draw horizontal grid lines
  ctx.strokeStyle = 'rgba(84, 84, 88, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 2; i++) {
    const y = chartTop + (chartH / 2) * i;
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();
  }

  // Draw line + points
  const n = data.length;
  if (n > 0) {
    const stepX = n > 1 ? chartW / (n - 1) : 0;

    // Fill area under the line
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = chartLeft + (n > 1 ? stepX * i : chartW / 2);
      const y = chartBottom - (costs[i] / maxCost) * chartH;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.lineTo(n > 1 ? chartRight : chartLeft + chartW / 2, chartBottom);
    ctx.lineTo(chartLeft, chartBottom);
    ctx.closePath();
    ctx.fillStyle = 'rgba(10, 132, 255, 0.15)';
    ctx.fill();

    // Draw line
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = chartLeft + (n > 1 ? stepX * i : chartW / 2);
      const y = chartBottom - (costs[i] / maxCost) * chartH;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw points
    for (let i = 0; i < n; i++) {
      const x = chartLeft + (n > 1 ? stepX * i : chartW / 2);
      const y = chartBottom - (costs[i] / maxCost) * chartH;
      ctx.fillStyle = COLORS.accent;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Inner white dot
      ctx.fillStyle = COLORS.bg;
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // X-axis weekday labels
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '9px ' + FONT_SANS;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < n; i++) {
    const x = chartLeft + (n > 1 ? (chartW / (n - 1)) * i : chartW / 2);
    // Parse the day string to get weekday
    let label = '';
    if (data[i].day) {
      const d = new Date(data[i].day + 'T00:00:00');
      if (!isNaN(d)) {
        label = WEEKDAYS[d.getDay()];
      } else {
        label = data[i].day.slice(5); // MM-DD fallback
      }
    }
    ctx.fillText(label, x, 50);
  }

  return canvas.toDataURL('image/png');
}

module.exports = { renderTrend };
