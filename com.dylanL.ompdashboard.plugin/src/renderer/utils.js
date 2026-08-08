'use strict';

/**
 * Shared canvas utilities for OMP Dashboard renderers
 * Apple dark style: #1C1C1E bg, SF Mono 700 numbers, accent #0A84FF
 */

const { createCanvas } = require('@napi-rs/canvas');

// Canvas color tokens (dark, fixed for Flexbar hardware)
const COLORS = {
  bg: '#000000',
  bgRaised: '#2C2C2E',
  accent: '#0A84FF',
  green: '#30D158',
  red: '#FF453A',
  orange: '#FF9F0A',
  gray: '#8E8E93',
  text: '#FFFFFF',
  textSecondary: 'rgba(235, 235, 245, 0.6)',
  separator: 'rgba(84, 84, 88, 0.6)'
};

const FONT_MONO = 'SF Mono, Menlo, monospace';
const FONT_SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif';

/**
 * Create a canvas with the standard dark background
 */
function createBaseCanvas(width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

/**
 * Format a number with thousands separators
 */
function fmtNumber(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('en-US');
}

/**
 * Format tokens: K for thousands, M for millions
 */
function fmtTokens(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

/**
 * Format cost with currency symbol
 */
function fmtCost(cost, currency) {
  if (cost === null || cost === undefined) cost = 0;
  if (currency === 'CNY') {
    return '¥' + Number(cost).toFixed(2);
  }
  return '$' + Number(cost).toFixed(2);
}

/**
 * Truncate a string to maxLen characters, adding ellipsis
 */
function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Draw a small label text (left-aligned, secondary color)
 */
function drawLabel(ctx, text, x, y, size) {
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = (size || 10) + 'px ' + FONT_SANS;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

/**
 * Draw a value text (right-aligned or specified, main color, mono font)
 */
function drawValue(ctx, text, x, y, size, color) {
  ctx.fillStyle = color || COLORS.text;
  ctx.font = '700 ' + (size || 12) + 'px ' + FONT_MONO;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

/**
 * Draw a section separator line
 */
function drawSeparator(ctx, x, y, width) {
  ctx.strokeStyle = COLORS.separator;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
}

/**
 * Draw a status dot
 */
function drawDot(ctx, x, y, radius, color) {
  ctx.fillStyle = color || COLORS.green;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Pick a color from green→orange→red gradient based on value ratio (0-1)
 */
function gradientColor(ratio) {
  if (ratio < 0.33) return COLORS.green;
  if (ratio < 0.66) return COLORS.orange;
  return COLORS.red;
}

module.exports = {
  COLORS,
  FONT_MONO,
  FONT_SANS,
  createBaseCanvas,
  fmtNumber,
  fmtTokens,
  fmtCost,
  truncate,
  drawLabel,
  drawValue,
  drawSeparator,
  drawDot,
  gradientColor
};
