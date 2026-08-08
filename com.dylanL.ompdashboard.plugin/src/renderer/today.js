'use strict';

/**
 * Today renderer — 240x60 canvas
 * Three rows: Calls / Tokens / Cost
 * Bottom: live status dot
 */

const { createBaseCanvas, fmtNumber, fmtTokens, fmtCost, drawLabel, drawValue, drawSeparator, drawDot, COLORS, FONT_MONO, FONT_SANS } = require('./utils');

/**
 * Render today's stats to a data URL
 * @param {object} data - { calls, inputTokens, outputTokens, costTotal }
 * @param {string} [currency] - 'USD' or 'CNY'
 * @returns {string} data URL PNG
 */
function renderToday(data, currency, width = 320) {
  const W = width, H = 60;
  const { canvas, ctx } = createBaseCanvas(W, H);

  if (!data) {
    // No data state
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '11px ' + FONT_SANS;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No OMP data', W / 2, H / 2);
    return canvas.toDataURL('image/png');
  }

  const padX = 12;
  const calls = Number(data.calls) || 0;
  const inputTok = Number(data.inputTokens) || 0;
  const outputTok = Number(data.outputTokens) || 0;
  const totalTok = inputTok + outputTok;
  const cost = Number(data.costTotal) || 0;

  // Title
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '600 10px ' + FONT_SANS;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('OMP Today', padX, 12);

  // Separator under title
  drawSeparator(ctx, padX, 16, W - padX * 2);

  // Row 1: Calls
  drawLabel(ctx, 'Calls', padX, 28, 10);
  drawValue(ctx, fmtNumber(calls), W - padX, 28, 12, COLORS.text);

  // Row 2: Tokens
  drawLabel(ctx, 'Tokens', padX, 42, 10);
  drawValue(ctx, fmtTokens(totalTok), W - padX, 42, 12, COLORS.accent);

  // Row 3: Cost
  drawLabel(ctx, 'Cost', padX, 54, 10);
  drawValue(ctx, fmtCost(cost, currency), W - padX, 54, 12, COLORS.green);

  // Live status dot (bottom right, clear of Cost value)
  drawDot(ctx, W - padX - 30, 50, 2, COLORS.green);

  return canvas.toDataURL('image/png');
}

module.exports = { renderToday };
