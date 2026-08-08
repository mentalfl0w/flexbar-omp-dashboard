<template>
  <v-app :theme="currentTheme">
    <v-main>
      <!-- Frosted glass toolbar -->
      <div class="toolbar">
        <v-toolbar flat color="transparent" height="56">
          <v-btn icon flat @click="goBack">
            <v-icon>mdi-chevron-left</v-icon>
          </v-btn>
          <v-toolbar-title class="toolbar-title">
            {{ $t('Live.Title') }}
          </v-toolbar-title>
        </v-toolbar>
      </div>

      <v-container class="info-container" max-width="640">
        <div class="card-group">
          <div class="card">
            <div class="card-header">
              <v-icon color="primary" size="24">mdi-pulse</v-icon>
              <span class="card-title">{{ $t('Live.Title') }}</span>
            </div>
            <p class="card-desc">
              {{ $t('Live.Tip') }}
            </p>
          </div>
        </div>

        <div class="card-group">
          <div class="card-group-title">Features</div>
          <div class="card">
            <div class="feature-item">
              <v-icon color="primary" size="20">mdi-speedometer</v-icon>
              <div class="feature-content">
                <div class="feature-title">Real-time Rates</div>
                <div class="feature-desc">Calls/min, tokens/min, and cost/min computed from the last 60 seconds of OMP activity.</div>
              </div>
            </div>
            <div class="feature-item">
              <v-icon color="green" size="20">mdi-calendar-today</v-icon>
              <div class="feature-content">
                <div class="feature-title">Today Summary</div>
                <div class="feature-desc">Total calls, token consumption, and cost for the current day.</div>
              </div>
            </div>
            <div class="feature-item">
              <v-icon color="orange" size="20">mdi-circle-medium</v-icon>
              <div class="feature-content">
                <div class="feature-title">Activity Status</div>
                <div class="feature-desc">Live indicator dots showing active agent types (main, advisor, subagent).</div>
              </div>
            </div>
          </div>
        </div>

        <div class="card-group">
          <div class="card-group-title">Configuration</div>
          <div class="card">
            <div class="config-item">
              <span class="config-label">Width</span>
              <span class="config-value">{{ liveWidth }}px</span>
            </div>
            <div class="config-item">
              <span class="config-label">Refresh Interval</span>
              <span class="config-value">{{ refreshInterval / 1000 }}s</span>
            </div>
            <div class="config-item">
              <span class="config-label">Currency</span>
              <span class="config-value">{{ currency }}</span>
            </div>
          </div>
        </div>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const currentTheme = ref(
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
);

const liveWidth = ref(720);
const refreshInterval = ref(5000);
const currency = ref('USD');

let themeMediaQuery = null;

function handleThemeChange(e) {
  currentTheme.value = e.matches ? 'dark' : 'light';
}

function goBack() {
  if (window.history && window.history.length > 1) {
    window.history.back();
  }
}

async function loadConfig() {
  try {
    if (window.flexDesigner && window.flexDesigner.getConfig) {
      const cfg = await window.flexDesigner.getConfig();
      if (cfg) {
        liveWidth.value = cfg.liveWidth || 720;
        refreshInterval.value = cfg.refreshInterval || 5000;
        currency.value = cfg.currency || 'USD';
      }
    }
  } catch (e) {
    // Use defaults
  }
}

onMounted(() => {
  loadConfig();
  themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  themeMediaQuery.addEventListener('change', handleThemeChange);
});

onBeforeUnmount(() => {
  if (themeMediaQuery) {
    themeMediaQuery.removeEventListener('change', handleThemeChange);
  }
});
</script>

<style scoped>
.toolbar {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid rgba(60, 60, 67, 0.18);
}

:deep(.v-theme-dark) .toolbar {
  background: rgba(28, 28, 30, 0.7);
  border-bottom: 1px solid rgba(84, 84, 88, 0.4);
}

.toolbar-title {
  font-size: 17px;
  font-weight: 600;
}

.info-container {
  padding: 16px;
}

.card-group {
  margin-bottom: 24px;
}

.card-group-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(60, 60, 67, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: 8px;
  padding-left: 4px;
}

:deep(.v-theme-dark) .card-group-title {
  color: rgba(235, 235, 245, 0.6);
}

.card {
  background: #FFFFFF;
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

:deep(.v-theme-dark) .card {
  background: #1C1C1E;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.card-title {
  font-size: 17px;
  font-weight: 600;
}

.card-desc {
  font-size: 14px;
  line-height: 1.5;
  color: rgba(60, 60, 67, 0.6);
  margin: 0;
}

:deep(.v-theme-dark) .card-desc {
  color: rgba(235, 235, 245, 0.6);
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
}

.feature-item:not(:last-child) {
  border-bottom: 1px solid rgba(60, 60, 67, 0.12);
}

:deep(.v-theme-dark) .feature-item:not(:last-child) {
  border-bottom: 1px solid rgba(84, 84, 88, 0.3);
}

.feature-content {
  flex: 1;
}

.feature-title {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 2px;
}

.feature-desc {
  font-size: 13px;
  color: rgba(60, 60, 67, 0.6);
  line-height: 1.4;
}

:deep(.v-theme-dark) .feature-desc {
  color: rgba(235, 235, 245, 0.6);
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.config-item:not(:last-child) {
  border-bottom: 1px solid rgba(60, 60, 67, 0.12);
}

:deep(.v-theme-dark) .config-item:not(:last-child) {
  border-bottom: 1px solid rgba(84, 84, 88, 0.3);
}

.config-label {
  font-size: 15px;
}

.config-value {
  font-size: 15px;
  font-weight: 500;
  color: #007AFF;
}

:deep(.v-theme-dark) .config-value {
  color: #0A84FF;
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .toolbar {
    background: #FFFFFF;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  :deep(.v-theme-dark) .toolbar {
    background: #1C1C1E;
  }
}
</style>
