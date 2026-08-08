'use strict';

/**
 * SQLite connection manager for OMP stats.db
 * Priority 1: node:sqlite (DatabaseSync, Node 22.5+) with read-only mode
 * Priority 2: sqlite3 CLI fallback via child_process.execFile (macOS/Linux only)
 * On Windows the sqlite3 CLI is not expected, so only node:sqlite is used.
 * All failures return null gracefully — UI shows "No OMP data detected"
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

let DatabaseSync = null;
try {
  const nodeSqlite = require('node:sqlite');
  DatabaseSync = nodeSqlite.DatabaseSync;
} catch (e) {
  // node:sqlite not available, will fall back to CLI
}

let dbInstance = null;
let dbPathResolved = null;
let useCli = false;
let cliAvailable = null;

// Secondary DB: OMP agent.db — realtime usage_cost_history (stats.db writer is often stale).
// Kept in sync with init(); queries fall back here for live cost/call data.
let agentDbInstance = null;
let agentDbPathResolved = null;

/**
 * Resolve a path that may start with ~ to an absolute path.
 * Uses os.homedir() which returns C:\Users\<user> on Windows and
 * /home/<user> (or /Users/<user> on macOS) on POSIX systems.
 */
function resolvePath(p) {
  if (!p) return null;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1));
  return p;
}

/**
 * Check if a file exists at the given path
 */
function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch (e) {
    return false;
  }
}

/**
 * Check if sqlite3 CLI is available on the system.
 * On Windows the `which` utility does not exist; use `where` instead.
 * The sqlite3 CLI is uncommon on Windows, so this typically returns false there.
 */
function checkCliAvailable() {
  // Windows has no `which` command; use `where` (built-in to cmd.exe)
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'where' : 'which';
  return new Promise((resolve) => {
    execFile(cmd, ['sqlite3'], { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        cliAvailable = false;
      } else {
        cliAvailable = true;
      }
      resolve(cliAvailable);
    });
  });
}

/**
 * Query via sqlite3 CLI as fallback
 * @param {string} sql - SQL query
 * @param {Array} params - parameters (named ? in SQL)
 * @returns {Promise<Array|null>} rows or null
 */
function queryCli(sql, params) {
  return new Promise((resolve) => {
    // Build CLI arguments: db path + query
    // For params, we use sqlite3's .param feature or inline escaping
    let finalSql = sql;
    if (params && Array.isArray(params) && params.length > 0) {
      // Replace ? placeholders with properly escaped values
      let idx = 0;
      finalSql = sql.replace(/\?/g, () => {
        const v = params[idx++];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return String(v);
        // Escape single quotes for string values
        return "'" + String(v).replace(/'/g, "''") + "'";
      });
    }

    execFile('sqlite3', [
      dbPathResolved,
      '-json',
      finalSql
    ], { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        return resolve(null);
      }
      const trimmed = stdout.trim();
      if (!trimmed) {
        return resolve([]);
      }
      try {
        const rows = JSON.parse(trimmed);
        resolve(Array.isArray(rows) ? rows : []);
      } catch (e) {
        resolve(null);
      }
    });
  });
}

/**
 * Initialize the database connection with the given path
 * @param {string} dbPath - path to stats.db (may contain ~)
 * @returns {boolean} true if database is available
 */
function init(dbPath) {
  close();
  dbPathResolved = resolvePath(dbPath);
  agentDbPathResolved = resolvePath('~/.omp/agent/agent.db');

  if (!dbPathResolved || !fileExists(dbPathResolved)) {
    dbInstance = null;
    useCli = false;
    return false;
  }

  // Try node:sqlite first
  if (DatabaseSync) {
    try {
      dbInstance = new DatabaseSync('file:' + dbPathResolved + '?mode=ro');
      // Set busy timeout for concurrent read safety
      try {
        dbInstance.exec('PRAGMA busy_timeout = 3000;');
      } catch (e) {
        // non-fatal
      }
      useCli = false;
      // Open agent.db for realtime usage_cost_history (stats.db syncs slowly)
      try {
        agentDbInstance = new DatabaseSync('file:' + agentDbPathResolved + '?mode=ro');
        try { agentDbInstance.exec('PRAGMA busy_timeout = 3000;'); } catch (e2) {}
      } catch (e2) {
        agentDbInstance = null;
      }
      return true;
    } catch (e) {
      dbInstance = null;
    }
  }

  // Fall back to CLI — mark as available, will check lazily.
  // The sqlite3 CLI is not bundled on Windows; skip CLI fallback there
  // and report the database as unavailable when node:sqlite is missing.
  if (process.platform === 'win32') {
    useCli = false;
    dbInstance = null;
    return false;
  }
  useCli = true;
  dbInstance = null;
  return true;
}

/**
 * Get the current DatabaseSync instance (null if using CLI or unavailable)
 */
function getDb() {
  return dbInstance;
}

/**
 * Execute a query and return rows
 * Works with both node:sqlite and CLI fallback
 * @param {string} sql - SQL query with ? placeholders
 * @param {Array} [params] - parameter values
 * @returns {Promise<Array|null>} array of row objects, or null on error
 */
async function query(sql, params) {
  // If no path resolved or file doesn't exist
  if (!dbPathResolved || !fileExists(dbPathResolved)) {
    return null;
  }

  // node:sqlite path
  if (dbInstance && !useCli) {
    try {
      const stmt = dbInstance.prepare(sql);
      const rows = params && params.length > 0 ? stmt.all(...params) : stmt.all();
      return rows;
    } catch (e) {
      return null;
    }
  }

  // CLI fallback path
  if (useCli) {
    if (cliAvailable === null) {
      await checkCliAvailable();
    }
    if (cliAvailable === false) {
      return null;
    }
    return queryCli(sql, params);
  }

  return null;
}

/**
 * Close the database connection
 */
/**
 * Query the realtime agent.db (usage_cost_history) — returns rows or null.
 * Falls back to sqlite3 CLI if node:sqlite unavailable.
 */
async function queryAgent(sql, params) {
  if (agentDbInstance) {
    try {
      const stmt = agentDbInstance.prepare(sql);
      const rows = stmt.all(...(params || []));
      return rows;
    } catch (e) {
      return null;
    }
  }
  // CLI fallback for agent.db (macOS/Linux only — no sqlite3 CLI on Windows)
  if (process.platform === 'win32') return null;
  if (!agentDbPathResolved || !fileExists(agentDbPathResolved)) return null;
  return queryCliWithPath(agentDbPathResolved, sql, params);
}

function queryCliWithPath(dbPath, sql, params) {
  return new Promise((resolve) => {
    let finalSql = sql;
    if (params && Array.isArray(params) && params.length > 0) {
      let idx = 0;
      finalSql = sql.replace(/\?/g, () => {
        const v = params[idx++];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return String(v);
        return "'" + String(v).replace(/'/g, "''") + "'";
      });
    }
    execFile('sqlite3', [dbPath, '-json', finalSql], { timeout: 10000 }, (err, stdout) => {
      if (err) return resolve(null);
      const trimmed = stdout.trim();
      if (!trimmed) return resolve([]);
      try {
        const rows = JSON.parse(trimmed);
        resolve(Array.isArray(rows) ? rows : []);
      } catch (e) { resolve(null); }
    });
  });
}

function close() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {
      // ignore
    }
  }
  dbInstance = null;
}

/**
 * Check if the database is available (file exists and either node:sqlite or CLI works)
 * @returns {Promise<boolean>}
 */
async function isAvailable() {
  if (!dbPathResolved || !fileExists(dbPathResolved)) {
    return false;
  }
  if (dbInstance && !useCli) {
    return true;
  }
  if (useCli) {
    if (cliAvailable === null) {
      await checkCliAvailable();
    }
    return cliAvailable === true;
  }
  return false;
}

// (exports appended below)
module.exports = {
  init,
  query,
  queryAgent,
  close
};
