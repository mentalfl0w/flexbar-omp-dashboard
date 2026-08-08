'use strict';

/**
 * SQL query functions for OMP stats.db
 * Each function wraps in try-catch and returns null on failure.
 * nowMs parameter is optional for testability.
 *
 * IMPORTANT: The messages.timestamp column stores epoch MILLISECONDS (not seconds).
 * All SQL comparisons use strftime('%s','now') * 1000 to match.
 * date()/datetime() functions divide timestamp by 1000 to convert to seconds.
 */

const { query, queryAgent } = require('./connection');

/**
 * Get current unix timestamp in milliseconds
 */
function now() {
  return Date.now();
}

/**
 * Get the start of today (local midnight) as epoch milliseconds
 */
function startOfTodayMs(nowMs) {
  const n = nowMs || now();
  const d = new Date(n);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Today's stats: calls, inputTokens, outputTokens, costTotal
 * @param {number} [nowMs] - optional current timestamp (ms) for testing
 * @returns {Promise<object|null>}
 */
async function getTodayStats(nowMs) {
  try {
    const startTs = startOfTodayMs(nowMs);
    const sql = `
      SELECT
        COUNT(*) as calls,
        COALESCE(SUM(input_tokens), 0) as inputTokens,
        COALESCE(SUM(output_tokens), 0) as outputTokens,
        COALESCE(ROUND(SUM(cost_total), 4), 0) as costTotal
      FROM messages
      WHERE timestamp >= ?
    `;
    const rows = await query(sql, [startTs]);
    if (!rows || rows.length === 0) return null;
    return rows[0];
  } catch (e) {
    return null;
  }
}

/**
 * Daily trend for the last N days
 * @param {number} [days=7] - number of days
 * @returns {Promise<Array|null>} array of { day, calls, tokens, cost } ascending by date
 */
async function getDayTrend(days) {
  days = days || 7;
  try {
    const sql = `
      SELECT
        date(timestamp / 1000, 'unixepoch', 'localtime') as day,
        COUNT(*) as calls,
        COALESCE(SUM(total_tokens), 0) as tokens,
        COALESCE(ROUND(SUM(cost_total), 4), 0) as cost
      FROM messages
      WHERE timestamp >= strftime('%s', 'now', ?) * 1000
      GROUP BY day
      ORDER BY day ASC
    `;
    const rows = await query(sql, ['-' + days + ' days']);
    return rows;
  } catch (e) {
    return null;
  }
}

/**
 * Model statistics for the last N days
 * @param {number} [days=7]
 * @returns {Promise<Array|null>} array of { model, calls, tokens, cost } sorted by cost DESC
 */
async function getModelStats(days) {
  days = days || 7;
  try {
    const sql = `
      SELECT
        model,
        COUNT(*) as calls,
        COALESCE(SUM(total_tokens), 0) as tokens,
        COALESCE(ROUND(SUM(cost_total), 4), 0) as cost
      FROM messages
      WHERE timestamp >= strftime('%s', 'now', ?) * 1000
      GROUP BY model
      ORDER BY cost DESC
    `;
    const rows = await query(sql, ['-' + days + ' days']);
    return rows;
  } catch (e) {
    return null;
  }
}

/**
 * Agent type statistics
 * @param {number} [days=7]
 * @returns {Promise<Array|null>} array of { agent_type, calls } sorted by calls DESC
 */
async function getAgentStats(days) {
  days = days || 7;
  try {
    const sql = `
      SELECT
        agent_type,
        COUNT(*) as calls
      FROM messages
      WHERE timestamp >= strftime('%s', 'now', ?) * 1000
      GROUP BY agent_type
      ORDER BY calls DESC
    `;
    const rows = await query(sql, ['-' + days + ' days']);
    return rows;
  } catch (e) {
    return null;
  }
}

/**
 * Recent call records
 * @param {number} [limit=8]
 * @returns {Promise<Array|null>} array of { time, model, input_tokens, output_tokens, cost }
 */
async function getRecentCalls(limit) {
  limit = limit || 8;
  try {
    const sql = `
      SELECT
        datetime(timestamp / 1000, 'unixepoch', 'localtime') as time,
        model,
        input_tokens,
        output_tokens,
        ROUND(cost_total, 4) as cost
      FROM messages
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    const rows = await query(sql, [limit]);
    return rows;
  } catch (e) {
    return null;
  }
}

/**
 * Live rates: compute per-minute rates over the last 60 seconds
 * @param {number} [nowMs] - optional current timestamp (ms) for testing
 * @returns {Promise<object|null>} { callsPerMin, tokensPerMin, costPerMin }
 */
async function getLiveRates(nowMs) {
  // Realtime source: agent.db usage_cost_history — BUT it's written once per
  // REQUEST COMPLETION (~1/min during a chat), so a 60s window is mostly 0.
  // Use a 5-minute window for stable per-minute rates.
  const n = nowMs || now();
  const WINDOW = 300000; // 5 min
  try {
    const sql = `
      SELECT
        COUNT(*) as c5m,
        COALESCE(ROUND(SUM(cost_usd), 4), 0) as cost5m
      FROM usage_cost_history
      WHERE recorded_at >= ?
    `;
    const rows = await queryAgent(sql, [n - WINDOW]);
    let calls = 0, cost = 0;
    if (rows && rows.length) {
      calls = rows[0].c5m || 0;
      cost = rows[0].cost5m || 0;
    }
    // Tokens from stats.db (same 5-min window, as synced)
    let tokens = 0;
    try {
      const tokRows = await query(
        'SELECT COALESCE(SUM(input_tokens + output_tokens), 0) as t FROM messages WHERE timestamp >= ?',
        [n - WINDOW]
      );
      if (tokRows && tokRows.length) tokens = tokRows[0].t || 0;
    } catch (e) { /* tokens optional */ }
    return { callsPerMin: calls, tokensPerMin: tokens, costPerMin: cost };
  } catch (e) {
    return null;
  }
}

module.exports = {
  getTodayStats,
  getDayTrend,
  getModelStats,
  getAgentStats,
  getRecentCalls,
  getLiveRates
};
