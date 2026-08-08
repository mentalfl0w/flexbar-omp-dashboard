'use strict';

// Crash capture: log unhandled rejections / exceptions instead of silently dying
process.on('unhandledRejection', (e) => {
  try { logger.error('UNHANDLED REJECTION: ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : String(e))); } catch (_) {}
});
process.on('uncaughtException', (e) => {
  try { logger.error('UNCAUGHT EXCEPTION: ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : String(e))); } catch (_) {}
});


/**
 * OMP Dashboard — Main plugin entry
 * Displays oh-my-pi (OMP) LLM usage statistics on Flexbar
 */

const { plugin, logger, pluginPath } = require('@eniac/flexdesigner');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const db = require('./db/connection');
const queries = require('./db/queries');
const { renderToday } = require('./renderer/today');
const { renderTrend } = require('./renderer/trend');
const { renderModels } = require('./renderer/models');
const { renderAgents } = require('./renderer/agents');
const { renderRecent } = require('./renderer/recent');
const { renderLive } = require('./renderer/live');
const { renderStrip } = require('./renderer/overviewstrip');

// CID constants
const CID = {
  FOLDER: 'com.dylanL.ompdashboard.folder',
  TODAY: 'com.dylanL.ompdashboard.today',
  SEVENDAY: 'com.dylanL.ompdashboard.sevenday',
  MODELS: 'com.dylanL.ompdashboard.models',
  AGENTS: 'com.dylanL.ompdashboard.agents',
  RECENT: 'com.dylanL.ompdashboard.recent',
  LIVE: 'com.dylanL.ompdashboard.live'
};

const STRIP_CID = 'com.dylanL.ompdashboard.overviewstrip';

function fmtTokCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

/**
 * OmpDashboardPlugin — encapsulates all OMP Dashboard state, lifecycle,
 * rendering, timers, and the overview strip logic.
 */
class OmpDashboardPlugin {
  constructor() {
    // omp binary probe cache
    this.ompPath = null;
    this.ompProbeDone = false;
    this.syncing = false;

    // Overview Strip (directDraw page) state: serialNumber -> { active, layout, timer }
    this.stripState = {};

    // key.uid -> key object + metadata
    this.keyData = {};
    // serialNumber -> { keys: [], timers: {} }
    this.serialCache = {};

    this.config = {
      dbPath: '~/.omp/stats.db',
      refreshInterval: 5000,
      currency: 'USD',
      liveWidth: 720,
      showToday: true,
      showSevenDay: true,
      showModels: true,
      showAgents: true,
      showRecent: true,
      showLive: true
    };

    // Serialized command queue: avoid plugin-channel concurrency timeouts
    this.cmdQueue = Promise.resolve();

    // Periodic stats sync timer (every 10 minutes)
    this.syncTimer = null;
  }

  // ==================== omp path / stats sync ====================

  findOmpPath(cb) {
    if (this.ompPath) return cb(this.ompPath);
    if (this.ompProbeDone) return cb(null);

    // Platform-aware binary lookup: `which` on POSIX, `where` on Windows
    const isWin = process.platform === 'win32';
    const lookupCmd = isWin ? 'where' : 'which';

    execFile(lookupCmd, ['omp'], { timeout: 10000 }, (err, stdout) => {
      if (!err && stdout && stdout.trim()) {
        // `where` on Windows may return multiple lines; take the first match
        this.ompPath = stdout.trim().split(/\r?\n/)[0];
        this.ompProbeDone = true;
        logger.info('omp found: ' + this.ompPath);
        return cb(this.ompPath);
      }
      // Fallback: probe common install locations per platform
      const candidates = isWin
        ? [
            path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'omp', 'omp.exe'),
            path.join(os.homedir(), '.omp', 'bin', 'omp.exe'),
            'C:\\Program Files\\omp\\omp.exe',
            'C:\\Program Files (x86)\\omp\\omp.exe'
          ]
        : process.platform === 'linux'
          ? ['/usr/local/bin/omp', '/usr/bin/omp', '/opt/local/bin/omp', '/snap/bin/omp']
          : ['/opt/homebrew/bin/omp', '/usr/local/bin/omp', '/usr/bin/omp', '/opt/local/bin/omp'];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          this.ompPath = p;
          this.ompProbeDone = true;
          logger.info('omp found: ' + p);
          return cb(p);
        }
      }
      this.ompProbeDone = true;
      logger.warn('omp binary not found — stats sync disabled (set PATH or install omp)');
      cb(null);
    });
  }

  syncStatsNow() {
    return new Promise((resolve) => {
      this.findOmpPath((bin) => {
        if (!bin || this.syncing) return resolve(false);
        this.syncing = true;
        execFile(bin, ['stats', '--summary'], { timeout: 60000 }, (err) => {
          this.syncing = false;
          if (err) logger.debug('omp stats sync: ' + (err.message || 'failed'));
          resolve(!err);
        });
      });
    });
  }

  // ==================== command queue ====================

  queued(fn) {
    this.cmdQueue = this.cmdQueue.then(fn).catch((e) => logger.debug('cmd error: ' + (e && e.message)));
    return this.cmdQueue;
  }

  // ==================== config ====================

  /**
   * Load configuration from FlexDesigner
   */
  async loadConfig() {
    try {
      const cfg = await plugin.getConfig();
      if (cfg) {
        this.config = Object.assign({}, this.config, cfg);
      }
    } catch (e) {
      logger.warn('Failed to load config, using defaults: ' + e.message);
    }

    // Initialize database connection
    db.init(this.config.dbPath);
  }

  // ==================== rendering ====================

  /**
   * Draw a single key with the given data URL
   */
  drawKey(serialNumber, key, dataUrl) {
    this.queued(() => {
      try {
        plugin.draw(serialNumber, key, 'base64', dataUrl);
      } catch (e) {
        logger.error('drawKey error: ' + e.message);
      }
    });
  }

  /**
   * Render and draw the Today key
   */
  async renderTodayKey(serialNumber, key) {
    try {
      const data = await queries.getTodayStats();
      const dataUrl = renderToday(data, this.config.currency, key.width || 320);
      this.drawKey(serialNumber, key, dataUrl);
    } catch (e) {
      logger.error('renderTodayKey error: ' + e.message);
    }
  }

  /**
   * Render and draw the 7-Day Trend key
   */
  async renderSevenDayKey(serialNumber, key) {
    try {
      const data = await queries.getDayTrend(7);
      const dataUrl = renderTrend(data, this.config.currency, key.width || 480);
      this.drawKey(serialNumber, key, dataUrl);
    } catch (e) {
      logger.error('renderSevenDayKey error: ' + e.message);
    }
  }

  /**
   * Render and draw the Agents key
   */
  async renderAgentsKey(serialNumber, key) {
    try {
      const data = await queries.getAgentStats(7);
      const dataUrl = renderAgents(data);
      this.drawKey(serialNumber, key, dataUrl);
    } catch (e) {
      logger.error('renderAgentsKey error: ' + e.message);
    }
  }

  /**
   * Setup dynamic Models key with sub-keys
   */
  async setupModelsKey(serialNumber, key) {
    try {
      const models = await queries.getModelStats(7);
      const rendered = renderModels(models, this.config.currency);

      plugin.dynamickey.clear(serialNumber, key);

      if (rendered.length === 0) {
        // Draw empty state on the container
        const { createCanvas } = require('@napi-rs/canvas');
        const canvas = createCanvas(240, 60);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1C1C1E';
        ctx.fillRect(0, 0, 240, 60);
        ctx.fillStyle = 'rgba(235, 235, 245, 0.6)';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No model data', 120, 30);
        this.drawKey(serialNumber, key, canvas.toDataURL('image/png'));
        return;
      }

      rendered.forEach((item, i) => {
        plugin.dynamickey.add(
          serialNumber, key, i,
          'base64', item.dataUrl, 240, item.userData
        );
      });

      // Wait 50ms then refresh (width change best practice)
      setTimeout(() => {
        try {
          plugin.dynamickey.refresh(serialNumber, key);
        } catch (e) {
          // ignore
        }
      }, 50);
    } catch (e) {
      logger.error('setupModelsKey error: ' + e.message);
    }
  }

  /**
   * Setup dynamic Recent key with sub-keys
   */
  async setupRecentKey(serialNumber, key) {
    try {
      const calls = await queries.getRecentCalls(8);
      const rendered = renderRecent(calls);

      plugin.dynamickey.clear(serialNumber, key);

      if (rendered.length === 0) {
        const { createCanvas } = require('@napi-rs/canvas');
        const canvas = createCanvas(240, 60);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1C1C1E';
        ctx.fillRect(0, 0, 240, 60);
        ctx.fillStyle = 'rgba(235, 235, 245, 0.6)';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No recent calls', 120, 30);
        this.drawKey(serialNumber, key, canvas.toDataURL('image/png'));
        return;
      }

      rendered.forEach((item, i) => {
        plugin.dynamickey.add(
          serialNumber, key, i,
          'base64', item.dataUrl, 240, item.userData
        );
      });

      setTimeout(() => {
        try {
          plugin.dynamickey.refresh(serialNumber, key);
        } catch (e) {
          // ignore
        }
      }, 50);
    } catch (e) {
      logger.error('setupRecentKey error: ' + e.message);
    }
  }

  /**
   * Render and draw the Live key (full width via directDraw)
   */
  async renderLiveKey(serialNumber, key) {
    try {
      const rates = await queries.getLiveRates();
      const today = await queries.getTodayStats();

      const liveW = (key.width && key.width >= 300) ? key.width : (this.config.liveWidth || 720);
      const dataUrl = renderLive({
        rates: rates,
        today: today,
        width: liveW,
        currency: this.config.currency
      });

      // Live key is a standard (non-directDraw) key — use regular draw.
      // directDraw would fail with "Plugin key is not a direct draw key".
      this.drawKey(serialNumber, key, dataUrl);
    } catch (e) {
      logger.error('renderLiveKey error: ' + e.message);
    }
  }

  // ==================== timers ====================

  /**
   * Start timers for a specific device/serial
   */
  startTimers(serialNumber) {
    const cache = this.serialCache[serialNumber];
    if (!cache) return;

    // Clear existing timers
    this.stopTimers(serialNumber);

    const interval = this.config.refreshInterval || 5000;

    // Fast refresh: today + live (every refreshInterval)
    cache.timers.fast = setInterval(async () => {
      for (const uid in this.keyData) {
        const kd = this.keyData[uid];
        if (kd.serialNumber !== serialNumber) continue;
        if (kd.cid === CID.TODAY) {
          await this.renderTodayKey(serialNumber, kd);
        } else if (kd.cid === CID.LIVE) {
          await this.renderLiveKey(serialNumber, kd);
        }
      }
    }, interval);

    // Slow refresh: sevenday, models, agents (every 60s)
    cache.timers.slow = setInterval(async () => {
      for (const uid in this.keyData) {
        const kd = this.keyData[uid];
        if (kd.serialNumber !== serialNumber) continue;
        if (kd.cid === CID.SEVENDAY) {
          await this.renderSevenDayKey(serialNumber, kd);
        } else if (kd.cid === CID.MODELS) {
          await this.setupModelsKey(serialNumber, kd);
        } else if (kd.cid === CID.AGENTS) {
          await this.renderAgentsKey(serialNumber, kd);
        }
      }
    }, 60000);
  }

  /**
   * Stop all timers for a device
   */
  stopTimers(serialNumber) {
    const cache = this.serialCache[serialNumber];
    if (!cache) return;
    if (cache.timers.fast) {
      clearInterval(cache.timers.fast);
      cache.timers.fast = null;
    }
    if (cache.timers.slow) {
      clearInterval(cache.timers.slow);
      cache.timers.slow = null;
    }
  }

  // ==================== key init ====================

  /**
   * Initialize a key when it comes alive
   */
  async initKey(serialNumber, key) {
    // Store key with serialNumber reference
    this.keyData[key.uid] = key;
    key.serialNumber = serialNumber;

    switch (key.cid) {
      case CID.TODAY:
        await this.renderTodayKey(serialNumber, key);
        break;
      case CID.SEVENDAY:
        await this.renderSevenDayKey(serialNumber, key);
        break;
      case CID.MODELS:
        await this.setupModelsKey(serialNumber, key);
        break;
      case CID.AGENTS:
        await this.renderAgentsKey(serialNumber, key);
        break;
      case CID.RECENT:
        await this.setupRecentKey(serialNumber, key);
        break;
      case CID.LIVE:
        await this.renderLiveKey(serialNumber, key);
        break;
      default:
        // Folder or unknown — just draw default
        try {
          plugin.draw(serialNumber, key, 'draw');
        } catch (e) {
          // ignore
        }
        break;
    }
  }

  // ==================== Overview Strip ====================

  async refreshStrip(sn, key, attempt = 0) {
    try {
      // Keep stats.db fresh so tokens/trend aren't stale — sync before rendering
      await this.syncStatsNow();
      const [today, trend, models, agents, recent, rates] = await Promise.all([
        queries.getTodayStats(),
        queries.getDayTrend(7),
        queries.getModelStats(7),
        queries.getAgentStats(7),
        queries.getRecentCalls(6),
        queries.getLiveRates()
      ]);
      const { dataURL, layout } = renderStrip({
        today: today || {},
        trend: trend || [],
        models: (models || []).slice(0, 3),
        agents: agents || [],
        recent: recent || [],
        rates: rates || {},
        currency: this.config.currency
      });
      this.stripState[sn] = this.stripState[sn] || {};
      this.stripState[sn].layout = layout;
      await plugin.directDraw(sn, key, dataURL, false, 0);
    } catch (e) {
      if (attempt < 3) {
        setTimeout(() => this.refreshStrip(sn, key, attempt + 1).catch(() => {}), 800 * (attempt + 1));
      } else {
        logger.debug('Overview strip draw failed: ' + (e && e.message));
      }
    }
  }

  enterStrip(sn, key) {
    if (this.stripState[sn] && this.stripState[sn].timer) clearInterval(this.stripState[sn].timer);
    this.stripState[sn] = { active: true, layout: [], timer: null };
    this.refreshStrip(sn, key).catch(() => {});
    this.stripState[sn].timer = setInterval(() => {
      this.refreshStrip(sn, key).catch(() => {});
    }, 5000);
    try { plugin.sendControlCommand(sn, 'hapic.click'); } catch (_) {}
    logger.info('Overview strip entered on device ' + sn);
  }

  exitStrip(sn) {
    const st = this.stripState[sn];
    if (st && st.timer) clearInterval(st.timer);
    delete this.stripState[sn];
  }

  // Touch on the strip page: tap a section to refresh + show summary
  async handleStripTouch(sn, payload) {
    const st = this.stripState[sn];
    if (!st || !st.active || !st.layout) return;
    // Only act on touch-UP — down and up both fire and would double-toggle
    if (payload.state !== 'up') return;
    const hit = st.layout.find((m) => payload.x >= m.x0 && payload.x < m.x1);
    if (!hit) return;
    logger.info('Strip touch: ' + hit.id + ' x=' + Math.round(payload.x));
    let msg = '';
    try {
      if (hit.id === 'today') {
        const t = await queries.getTodayStats();
        msg = 'Today: ' + (t ? t.calls : 0) + ' calls, ' + (t ? fmtTokCount((t.inputTokens || 0) + (t.outputTokens || 0)) : '0') + ' tok';
      } else if (hit.id === 'models') {
        const models = await queries.getModelStats(7);
        const per = (hit.x1 - hit.x0) / Math.max(models.length, 3);
        const idx = Math.floor((payload.x - hit.x0) / per);
        const m = models[idx];
        if (m) msg = m.model + ': ' + m.calls + ' calls, ' + m.cost.toFixed(2) + ' USD';
      } else {
        msg = hit.id + ' refreshed';
      }
    } catch (e) { /* ignore */ }
    if (msg) {
      plugin.showFlexbarSnackbarMessage(sn, msg.slice(0, 64), 'info', '', 2000, false).catch(() => {});
    }
    const key = Object.values(this.keyData).find((k) => k.cid === STRIP_CID);
    if (key) this.refreshStrip(sn, key).catch(() => {});
    try { plugin.sendControlCommand(sn, 'hapic.click'); } catch (_) {}
  }

  // ==================== Event Handlers ====================

  /**
   * plugin.alive — keys loaded, initialize rendering
   */
  async onAlive(payload) {
    const { serialNumber, keys } = payload;
    logger.info('OMP Dashboard alive on device ' + serialNumber + ' with ' + keys.length + ' keys');

    // Initialize serial cache
    this.serialCache[serialNumber] = { keys: [], timers: {} };

    // Load config and init DB
    await this.loadConfig();

    // Sync stats.db first (omp stats) so the dashboard shows real data
    await this.syncStatsNow();

    // Initialize each key
    for (const key of keys) {
      if (key.cid === STRIP_CID) {
        this.enterStrip(serialNumber, key);
        continue;
      }
      await this.initKey(serialNumber, key);
    }

    // Start refresh timers
    this.startTimers(serialNumber);
  }

  /**
   * plugin.dead — keys destroyed, cleanup
   */
  onDead(payload) {
    const { serialNumber, keys } = payload;
    logger.info('OMP Dashboard dead on device ' + serialNumber);

    this.stopTimers(serialNumber);
    this.exitStrip(serialNumber);

    // Remove key data
    keys.forEach(key => {
      delete this.keyData[key.uid];
    });

    delete this.serialCache[serialNumber];
  }

  /**
   * plugin.data — user interaction
   */
  onData(payload) {
    const { serialNumber, data } = payload;
    const key = data.key;

    // Interaction debug log
    logger.debug('Key pressed: ' + key.cid + ' pressType=' + (data.pressType || 'tap'));

    // Overview Strip entry key
    if (key.cid === STRIP_CID) {
      this.enterStrip(serialNumber, key);
      return { status: 'success', message: 'Strip entered' };
    }


    // Handle sub-key clicks for dynamic keys
    if (data.userData) {
      const ud = data.userData;

      // Models sub-key click
      if (key.cid === CID.MODELS) {
        const msg = ud.model + ': ' + ud.calls + ' calls, $' + Number(ud.cost).toFixed(2);
        try {
          plugin.showFlexbarSnackbarMessage(serialNumber, msg, 'info', 'chart-bar', 3000, false);
        } catch (e) {
          // ignore
        }
        return { status: 'success', message: 'Model info shown' };
      }

      // Recent sub-key click
      if (key.cid === CID.RECENT) {
        const timeShort = ud.time ? ud.time.match(/(\d{2}:\d{2})/)?.[0] || ud.time : '';
        const msg = timeShort + ' ' + ud.model + ' ' + ud.inputTokens + '→' + ud.outputTokens + ' $' + Number(ud.cost).toFixed(4);
        try {
          plugin.showFlexbarSnackbarMessage(serialNumber, msg, 'info', 'history', 3000, false);
        } catch (e) {
          // ignore
        }
        return { status: 'success', message: 'Recent call info shown' };
      }
    }

    // Handle long-press on dynamic containers → refresh
    if (data.pressType === 'long' || data.longPress) {
      if (key.cid === CID.MODELS) {
        this.setupModelsKey(serialNumber, key);
        return { status: 'success', message: 'Models refreshed' };
      }
      if (key.cid === CID.RECENT) {
        this.setupRecentKey(serialNumber, key);
        return { status: 'success', message: 'Recent refreshed' };
      }
    }

    // Handle single click on standard keys
    if (key.cid === CID.SEVENDAY) {
      // Click on 7-day → refresh
      this.renderSevenDayKey(serialNumber, key);
      return { status: 'success', message: 'Trend refreshed' };
    }

    if (key.cid === CID.AGENTS) {
      this.renderAgentsKey(serialNumber, key);
      return { status: 'success', message: 'Agents refreshed' };
    }

    return { status: 'success', message: 'Handled' };
  }

  /**
   * device.touch — touch events while the strip (directDraw page) is active
   */
  onTouch(payload) {
    const { serialNumber: sn } = payload;
    if (this.stripState[sn] && this.stripState[sn].active) {
      this.handleStripTouch(sn, payload).catch(() => {});
    }
  }

  /**
   * device.status — handle connect/disconnect
   */
  onDeviceStatus(devices) {
    devices.forEach(device => {
      if (device.status === 'disconnected') {
        logger.info('Device disconnected: ' + device.serialNumber);
        this.stopTimers(device.serialNumber);
      } else if (device.status === 'connected') {
        logger.info('Device connected: ' + device.serialNumber);
        // Timers will restart on next plugin.alive
      }
    });
  }

  /**
   * plugin.config.updated — reload config and reinitialize
   */
  async onConfigUpdated(payload) {
    logger.info('Config updated');
    this.config = Object.assign({}, this.config, payload.config || {});

    // Reinit DB if path changed
    db.init(this.config.dbPath);

    // Re-render all active keys
    for (const uid in this.keyData) {
      const kd = this.keyData[uid];
      await this.initKey(kd.serialNumber, kd);
    }

    // Restart timers with new interval
    for (const sn in this.serialCache) {
      this.startTimers(sn);
    }
  }

  // ==================== Lifecycle ====================

  /**
   * Register all event handlers and start the periodic sync.
   * Called once at plugin startup.
   */
  start() {
    plugin.on('plugin.alive', (payload) => { this.onAlive(payload).catch((e) => logger.error('onAlive error: ' + (e && e.message))); });
    plugin.on('plugin.dead', (payload) => { this.onDead(payload); });
    plugin.on('plugin.data', (payload) => { this.onData(payload); });
    plugin.on('device.touch', (payload) => { this.onTouch(payload); });
    plugin.on('device.status', (devices) => { this.onDeviceStatus(devices); });
    plugin.on('plugin.config.updated', (payload) => { this.onConfigUpdated(payload).catch((e) => logger.error('onConfigUpdated error: ' + (e && e.message))); });

    // Periodic stats sync: every 10 minutes refresh stats.db incrementally
    this.syncTimer = setInterval(() => {
      this.syncStatsNow().then((ok) => {
        if (ok) {
          // Re-render all active keys after sync
          for (const sn in this.serialCache) {
            for (const uid in this.keyData) {
              const kd = this.keyData[uid];
              if (kd.serialNumber === sn) {
                this.initKey(sn, kd).catch(() => {});
              }
            }
          }
        }
      }).catch(() => {});
    }, 300000);

    plugin.start();
  }
}

// Start the plugin
const pluginInstance = new OmpDashboardPlugin();
pluginInstance.start();
