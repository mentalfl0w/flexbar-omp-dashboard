'use strict';

/**
 * Recent calls renderer — for dynamic key sub-keys
 * Each call: 240x60 canvas
 * Time, model (truncated), in→out tokens, cost
 */

const { createBaseCanvas, fmtCost, truncate, COLORS, FONT_MONO, FONT_SANS } = require('./utils');

/**
 * Render a single recent call sub-key
 * @param {object} call - { time, model, input_tokens, output_tokens, cost }
 * @returns {string} data URL PNG
 */
function renderRecentItem(call) {
  const W = 240, H = 60;
  const { canvas, ctx } = createBaseCanvas(W, H);

  if (!call) {
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '11px ' + FONT_SANS;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No recent calls', W / 2, H / 2);
    return canvas.toDataURL('image/png');
  }

  const padX = 10;

  // Extract time from datetime string (format: "YYYY-MM-DD HH:MM:SS")
  let timeStr = call.time || '';
  // Show just HH:MM
  const timeMatch = timeStr.match(/(\d{2}:\d{2})/);
  const timeLabel = timeMatch ? timeMatch[1] : timeStr.slice(-5);

  const modelName = truncate(call.model || 'unknown', 10);
  const inputTok = Number(call.input_tokens) || 0;
  const outputTok = Number(call.output_tokens) || 0;
  const cost = Number(call.cost) || 0;

  // Time (top left, accent)
  ctx.fillStyle = COLORS.accent;
  ctx.font = '700 12px ' + FONT_MONO;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(timeLabel, padX, 20);

  // Model (top right, secondary)
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '10px ' + FONT_SANS;
  ctx.textAlign = 'right';
  ctx.fillText(modelName, W - padX, 20);

  // Tokens in→out (middle)
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 12px ' + FONT_MONO;
  ctx.textAlign = 'left';
  ctx.fillText(inputTok + '→' + outputTok, padX, 38);

  // Cost (bottom right, green)
  ctx.fillStyle = COLORS.green;
  ctx.font = '700 11px ' + FONT_MONO;
  ctx.textAlign = 'right';
  ctx.fillText(fmtCost(cost, 'USD'), W - padX, 38);

  // Separator
  ctx.strokeStyle = COLORS.separator;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, 48);
  ctx.lineTo(W - padX, 48);
  ctx.stroke();

  // Token flow bar (input vs output proportion)
  const totalTok = inputTok + outputTok || 1;
  const barW = W - padX * 2;
  const inputW = Math.max((inputTok / totalTok) * barW, 1);
  const outputW = barW - inputW;

  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(padX, 52, inputW, 3);
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(padX + inputW, 52, outputW, 3);

  return canvas.toDataURL('image/png');
}

/**
 * Render all recent call sub-keys
 * @param {Array} calls - array of { time, model, input_tokens, output_tokens, cost }
 * @returns {Array} array of { dataUrl, userData } for each call (max 16)
 */
function renderRecent(calls) {
  if (!calls || calls.length === 0) return [];

  const limited = calls.slice(0, 16);

  return limited.map((c, i) => ({
    dataUrl: renderRecentItem(c),
    userData: {
      index: i,
      time: c.time,
      model: c.model,
      inputTokens: Number(c.input_tokens) || 0,
      outputTokens: Number(c.output_tokens) || 0,
      cost: Number(c.cost) || 0
    }
  }));
}

module.exports = { renderRecent };
