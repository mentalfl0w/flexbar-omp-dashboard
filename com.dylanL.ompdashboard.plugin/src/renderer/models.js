'use strict';

/**
 * Models renderer — for dynamic key sub-keys
 * Each model: 240x60 canvas
 * Model name (truncated 10 chars), cost, call count
 * Background color gradient: green→orange→red based on cost ratio
 */

const { createBaseCanvas, fmtNumber, fmtCost, truncate, COLORS, FONT_MONO, FONT_SANS, gradientColor } = require('./utils');

/**
 * Render a single model sub-key
 * @param {object} model - { model, calls, cost }
 * @param {number} maxCost - max cost across all models (for gradient)
 * @param {string} [currency]
 * @returns {string} data URL PNG
 */
function renderModel(model, maxCost, currency) {
  const W = 240, H = 60;
  const { canvas, ctx } = createBaseCanvas(W, H);

  if (!model) {
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '11px ' + FONT_SANS;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No data', W / 2, H / 2);
    return canvas.toDataURL('image/png');
  }

  const padX = 10;
  const name = truncate(model.model || 'unknown', 10);
  const calls = Number(model.calls) || 0;
  const cost = Number(model.cost) || 0;
  const maxC = Math.max(maxCost || 0, 0.01);
  const ratio = cost / maxC;

  // Left accent bar based on cost gradient
  const accentColor = gradientColor(ratio);
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, 3, H);

  // Model name (top left, large)
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 13px ' + FONT_MONO;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(name, padX + 4, 22);

  // Cost (middle, accent color)
  ctx.fillStyle = accentColor;
  ctx.font = '700 14px ' + FONT_MONO;
  ctx.fillText(fmtCost(cost, currency), padX + 4, 42);

  // Call count (bottom right, secondary)
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '10px ' + FONT_SANS;
  ctx.textAlign = 'right';
  ctx.fillText(fmtNumber(calls) + ' calls', W - padX, 42);

  // Bottom separator
  ctx.strokeStyle = COLORS.separator;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, 52);
  ctx.lineTo(W - padX, 52);
  ctx.stroke();

  // Percentage bar at bottom
  const barW = W - padX * 2;
  const fillW = Math.max(barW * ratio, 2);
  ctx.fillStyle = accentColor;
  ctx.fillRect(padX, 54, fillW, 3);

  return canvas.toDataURL('image/png');
}

/**
 * Render all model sub-keys
 * @param {Array} models - array of { model, calls, cost }
 * @param {string} [currency]
 * @returns {Array} array of { dataUrl, userData } for each model (max 16)
 */
function renderModels(models, currency) {
  if (!models || models.length === 0) return [];

  const maxCost = Math.max(...models.map(m => Number(m.cost) || 0), 0.01);
  const limited = models.slice(0, 16);

  return limited.map((m, i) => ({
    dataUrl: renderModel(m, maxCost, currency),
    userData: {
      index: i,
      model: m.model,
      calls: Number(m.calls) || 0,
      cost: Number(m.cost) || 0
    }
  }));
}

module.exports = { renderModels };
