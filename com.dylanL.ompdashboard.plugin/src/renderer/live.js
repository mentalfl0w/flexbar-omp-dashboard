'use strict';

/**
 * Live renderer — variable width (480/720/960) x 60 canvas
 * Three sections:
 * 1. Rates: calls/min, tokens/min, cost/min
 * 2. Today summary: calls | cost | tokens
 * 3. Bottom: activity status dots
 */

const { createBaseCanvas, fmtNumber, fmtTokens, fmtCost, drawSeparator, drawDot, COLORS, FONT_MONO, FONT_SANS } = require('./utils');

/**
 * Render live monitoring dashboard
 * @param {object} params - { rates: {callsPerMin, tokensPerMin, costPerMin}, today: {calls, inputTokens, outputTokens, costTotal}, width, currency }
 * @returns {string} data URL PNG
 */
function renderLive(params) {
  const width = params.width || 720;
  const W = width, H = 60;
  const { canvas, ctx } = createBaseCanvas(W, H);

  const rates = params.rates || { callsPerMin: 0, tokensPerMin: 0, costPerMin: 0 };
  const today = params.today || { calls: 0, inputTokens: 0, outputTokens: 0, costTotal: 0 };
  const currency = params.currency || 'USD';

  const padX = 12;

  // Title
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '600 10px ' + FONT_SANS;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('OMP Live Monitor', padX, 14);

  // Live dot next to title
  drawDot(ctx, padX + 108, 11, 3, COLORS.green);

  // Separator under title
  drawSeparator(ctx, padX, 18, W - padX * 2);

  // Section 1: Rates (left third)
  const sec1End = Math.floor(W * 0.38);
  const sec2Start = Math.floor(W * 0.40);
  const sec2End = Math.floor(W * 0.72);

  // Rates label
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '9px ' + FONT_SANS;
  ctx.textAlign = 'left';
  ctx.fillText('RATES/MIN', padX, 30);

  // Calls/min
  ctx.fillStyle = COLORS.accent;
  ctx.font = '700 13px ' + FONT_MONO;
  ctx.fillText(fmtNumber(rates.callsPerMin || 0), padX, 42);

  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '9px ' + FONT_SANS;
  ctx.fillText('calls', padX + ctx.measureText(fmtNumber(rates.callsPerMin || 0)).width + 4, 42);

  // Tokens/min
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 13px ' + FONT_MONO;
  ctx.fillText(fmtTokens(rates.tokensPerMin || 0), padX, 52);

  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '9px ' + FONT_SANS;
  const tokW = ctx.measureText(fmtTokens(rates.tokensPerMin || 0)).width;
  ctx.fillText('tok', padX + tokW + 4, 52);

  // Cost/min (right side of section 1)
  ctx.fillStyle = COLORS.green;
  ctx.font = '700 13px ' + FONT_MONO;
  ctx.textAlign = 'right';
  ctx.fillText(fmtCost(rates.costPerMin || 0, currency), sec1End, 42);

  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '9px ' + FONT_SANS;
  ctx.fillText('cost/min', sec1End, 52);

  // Vertical separator between section 1 and 2
  ctx.strokeStyle = COLORS.separator;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sec2Start, 22);
  ctx.lineTo(sec2Start, 50);
  ctx.stroke();

  // Section 2: Today summary
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '9px ' + FONT_SANS;
  ctx.textAlign = 'left';
  ctx.fillText('TODAY', sec2Start + 8, 30);

  const totalTok = (Number(today.inputTokens) || 0) + (Number(today.outputTokens) || 0);

  // Today calls
  ctx.fillStyle = COLORS.accent;
  ctx.font = '700 12px ' + FONT_MONO;
  ctx.fillText(fmtNumber(today.calls || 0), sec2Start + 8, 42);

  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '9px ' + FONT_SANS;
  const callsW = ctx.measureText(fmtNumber(today.calls || 0)).width;
  ctx.fillText('calls', sec2Start + 12 + callsW, 42);

  // Today tokens
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 12px ' + FONT_MONO;
  ctx.fillText(fmtTokens(totalTok), sec2Start + 8, 52);

  // Today cost (right side of section 2)
  ctx.fillStyle = COLORS.green;
  ctx.font = '700 12px ' + FONT_MONO;
  ctx.textAlign = 'right';
  ctx.fillText(fmtCost(today.costTotal || 0, currency), sec2End, 52);

  // Vertical separator between section 2 and 3
  ctx.strokeStyle = COLORS.separator;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sec2End + 4, 22);
  ctx.lineTo(sec2End + 4, 50);
  ctx.stroke();

  // Section 3: Activity status
  const sec3Start = sec2End + 12;
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '9px ' + FONT_SANS;
  ctx.textAlign = 'left';
  ctx.fillText('ACTIVE', sec3Start, 30);

  // Activity dots based on rates
  const isActive = (rates.callsPerMin || 0) > 0;
  const dotColor = isActive ? COLORS.green : COLORS.gray;

  // Main agent dot
  drawDot(ctx, sec3Start + 6, 42, 4, dotColor);
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '9px ' + FONT_SANS;
  ctx.fillText('main', sec3Start + 14, 45);

  // Advisor dot
  drawDot(ctx, sec3Start + 6, 50, 4, dotColor);
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText('advisor', sec3Start + 14, 50);

  // If width allows, add subagent dot
  if (W >= 720) {
    const saX = sec3Start + 80;
    drawDot(ctx, saX + 6, 42, 4, dotColor);
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText('sub', saX + 14, 45);

    // Refresh indicator
    if (W >= 960) {
      const riX = saX + 60;
      ctx.fillStyle = COLORS.textSecondary;
      ctx.font = '8px ' + FONT_SANS;
      ctx.fillText('auto-refresh', riX, 42);
      // Pulsing refresh dot
      drawDot(ctx, riX - 8, 39, 2, COLORS.accent);
    }
  }

  return canvas.toDataURL('image/png');
}

module.exports = { renderLive };
