'use strict';

/**
 * Agents renderer — 240x60 canvas
 * Donut chart showing agent type distribution + legend
 */

const { createBaseCanvas, fmtNumber, COLORS, FONT_MONO, FONT_SANS } = require('./utils');

// Color mapping for agent types
const AGENT_COLORS = {
  'advisor': COLORS.accent,
  'main': COLORS.green,
  'subagent': COLORS.orange,
  'task': COLORS.red
};

function getAgentColor(agentType) {
  return AGENT_COLORS[agentType] || COLORS.gray;
}

/**
 * Render agent distribution donut chart
 * @param {Array} data - array of { agent_type, calls } sorted by calls DESC
 * @returns {string} data URL PNG
 */
function renderAgents(data) {
  const W = 240, H = 60;
  const { canvas, ctx } = createBaseCanvas(W, H);

  if (!data || data.length === 0) {
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '11px ' + FONT_SANS;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No agent data', W / 2, H / 2);
    return canvas.toDataURL('image/png');
  }

  const total = data.reduce((sum, d) => sum + (Number(d.calls) || 0), 0);
  if (total === 0) {
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '11px ' + FONT_SANS;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No agent data', W / 2, H / 2);
    return canvas.toDataURL('image/png');
  }

  // Donut chart on the left side
  const cx = 32;
  const cy = 32;
  const outerR = 22;
  const innerR = 14;

  let startAngle = -Math.PI / 2; // Start from top

  data.forEach(d => {
    const calls = Number(d.calls) || 0;
    const ratio = calls / total;
    const endAngle = startAngle + ratio * Math.PI * 2;
    const color = getAgentColor(d.agent_type);

    // Draw arc segment
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle, endAngle);
    ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    startAngle = endAngle;
  });

  // Center text: total calls
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 11px ' + FONT_MONO;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fmtNumber(total), cx, cy - 3);

  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '8px ' + FONT_SANS;
  ctx.fillText('total', cx, cy + 8);

  // Legend on the right side
  const legendX = 70;
  let legendY = 18;
  const lineH = 13;

  data.slice(0, 4).forEach(d => {
    const calls = Number(d.calls) || 0;
    const pct = ((calls / total) * 100).toFixed(0);
    const color = getAgentColor(d.agent_type);

    // Color dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(legendX + 4, legendY - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    // Agent name
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px ' + FONT_SANS;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(d.agent_type || 'unknown', legendX + 12, legendY);

    // Percentage
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '10px ' + FONT_MONO;
    ctx.textAlign = 'right';
    ctx.fillText(pct + '%', W - 12, legendY);

    legendY += lineH;
  });

  return canvas.toDataURL('image/png');
}

module.exports = { renderAgents };
