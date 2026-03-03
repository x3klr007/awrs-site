// AWRS React dashboard micro-frontend bundle.
// Loads React from CDN and renders the ocean-themed dashboard to match the provided design kit/screenshot.
// Exposes window.AWRSDashboardMicrofrontend.mount(selector) / unmount(selector).

const dataBus = (() => {
  const subs = new Set();
  return {
    emit(payload) { subs.forEach((fn) => fn(payload)); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
})();

const rawKeyMap = {
  temp: 'temp',
  humidity: 'humidity',
  pressure: 'pressure',
  ph: 'ph',
  pH: 'ph',
  tds: 'tds',
  h2s: 'h2s',
  h2s_ppm: 'h2s',
  co: 'co',
  co_ppm: 'co',
  o2: 'o2',
  do_mgL: 'o2',
  waterLevel: 'waterLevel',
  water_level: 'waterLevel'
};

function toFiniteNumber(value) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalize(payload) {
  let input = payload;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { return {}; }
  }
  if (!input || typeof input !== 'object') return {};
  const normalized = {};
  Object.entries(rawKeyMap).forEach(([raw, key]) => {
    if (input[raw] === undefined) return;
    const n = toFiniteNumber(input[raw]);
    if (n !== null) normalized[key] = n;
  });
  return normalized;
}

function wrapExistingAPIs() {
  const api = window.awrsDashboard;
  if (!api) return;
  const origSetData = api.setData?.bind(api);
  const origProcess = api.processArduinoData?.bind(api);
  const origSetConn = api.setConnection?.bind(api);

  if (origSetData) {
    api.setData = (payload) => {
      const res = origSetData(payload);
      dataBus.emit(payload);
      return res;
    };
  }
  if (origProcess) {
    api.processArduinoData = (payload) => {
      const res = origProcess(payload);
      if (res !== false) dataBus.emit(payload);
      return res;
    };
  }
  if (origSetConn) {
    api.setConnection = (flag) => {
      const res = origSetConn(flag);
      dataBus.emit({ __connection: flag });
      return res;
    };
  }
}

const defaults = {
  temp: 24.5,
  humidity: 68.2,
  pressure: 1012,
  ph: 7.8,
  tds: 342,
  h2s: 0.5,
  co: 2.1,
  o2: 20.9,
  waterLevel: 3.2,
};

const roots = new Map();

function injectStylesOnce() {
  const id = 'awrs-dashboard-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    :root {
      --awrs-bg: #f5f9fa;
      --awrs-card: #f0f6f7;
      --awrs-muted: #e5eeef;
      --awrs-border: #d2dcde;
      --awrs-text: #0b1b2b;
      --awrs-text-muted: #5f8190;
      --awrs-primary: #0f8fd6;
      --awrs-primary-2: #1ac8e0;
      --awrs-success: #10b981;
      --awrs-danger: #d94040;
      --awrs-danger-bg: #ffecec;
      --awrs-success-bg: #e8ffef;
      --awrs-progress: #4fc3f7;
      --awrs-progress-track: #e5f6ff;
      --awrs-card-radius: 14px;
      --awrs-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 6px 18px rgba(15,143,214,0.08);
    }

    .awrs-panel { font-family: "Inter", system-ui, -apple-system, sans-serif; color: var(--awrs-text); background: var(--awrs-bg); padding: 16px; }
    .awrs-hero { background: linear-gradient(135deg, #0f8dc5, #15d1ff); color: #fff; border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; box-shadow: var(--awrs-shadow); }
    .awrs-hero-left { display: flex; align-items: center; gap: 12px; }
    .awrs-hero-title { font-weight: 700; font-size: 20px; letter-spacing: -0.02em; }
    .awrs-hero-sub { font-size: 12px; opacity: 0.9; }
    .awrs-cta { border: none; border-radius: 999px; padding: 8px 14px; background: #ef4444; color: #fff; font-weight: 600; cursor: pointer; box-shadow: var(--awrs-shadow); display: inline-flex; align-items: center; gap: 6px; }
    .awrs-card { background: var(--awrs-card); border: 1px solid var(--awrs-border); border-radius: var(--awrs-card-radius); box-shadow: var(--awrs-shadow); padding: 16px 18px; margin-top: 14px; }
    .awrs-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .awrs-title { font-weight: 700; font-size: 16px; color: var(--awrs-primary); display: flex; gap: 8px; align-items: center; }
    .awrs-badge { font-size: 12px; padding: 4px 10px; border-radius: 999px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
    .awrs-badge.offline { background: var(--awrs-danger-bg); color: var(--awrs-danger); }
    .awrs-badge.online { background: var(--awrs-success-bg); color: var(--awrs-success); }
    .awrs-video { position: relative; background: #0c1f1f; color: #8aa5a5; height: 230px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; text-align: center; }
    .awrs-video::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.35)); }
    .awrs-video-content { position: relative; z-index: 1; display: grid; gap: 4px; }
    .awrs-video h3 { margin: 0; font-size: 24px; color: #d0e7e7; }
    .awrs-video small { color: #8aa5a5; }
    .awrs-water-row { margin-top: 12px; background: linear-gradient(90deg, rgba(19,200,240,0.08), rgba(12,143,214,0.04)); border: 1px solid var(--awrs-border); border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; }
    .awrs-water-val { font-weight: 700; color: var(--awrs-primary); font-size: 20px; }
    .awrs-progress-track { width: 100%; height: 8px; background: var(--awrs-progress-track); border-radius: 999px; overflow: hidden; margin-top: 6px; }
    .awrs-progress-fill { height: 100%; background: linear-gradient(90deg, var(--awrs-primary), var(--awrs-primary-2)); border-radius: 999px; transition: width 0.3s ease; }
    .awrs-grid3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
    .awrs-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
    .awrs-tile { background: rgba(255,255,255,0.7); border: 1px solid var(--awrs-border); border-radius: 12px; padding: 12px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.6); }
    .awrs-tile-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-size: 13px; color: var(--awrs-text); }
    .awrs-value { font-weight: 700; font-size: 22px; color: var(--awrs-primary); }
    .awrs-sub { font-size: 12px; color: var(--awrs-text-muted); }
    .awrs-bar { margin-top: 6px; background: #e9f4ec; border-radius: 999px; height: 6px; overflow: hidden; }
    .awrs-bar-fill { height: 100%; background: linear-gradient(90deg, #22c55e, #47c98b); }
    .awrs-bar-red { height: 6px; background: linear-gradient(90deg, #ef4444, #f59e0b); border-radius: 999px; }
    .awrs-card-muted { background: #f7fbfc; }
    @media (max-width: 900px) { .awrs-grid3 { grid-template-columns: repeat(2, minmax(0,1fr)); } }
    @media (max-width: 640px) { .awrs-grid3, .awrs-grid2 { grid-template-columns: repeat(1, minmax(0,1fr)); } }
  `;
  document.head.appendChild(style);
}

async function loadReact() {
  const React = await import('https://esm.sh/react@18.2.0');
  const ReactDOM = await import('https://esm.sh/react-dom@18.2.0/client');
  return { React, ReactDOM };
}

function statusFrom(state) {
  if (!state.connected) return { text: 'Offline', className: 'status-offline' };
  const stale = Date.now() - state.lastUpdated > 10000;
  if (stale) return { text: 'Stale', className: 'status-stale' };
  return { text: 'Online', className: 'status-online' };
}

// Inline SVG helpers (match the fallback markup)
const svgAttrs = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

const Icons = {
  thermometer: (React) => React.createElement('svg', svgAttrs, React.createElement('path', { d: 'M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z' })),
  humidity: (React) => React.createElement('svg', svgAttrs,
    React.createElement('path', { d: 'M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7 2.9 7 2.9s-2.15 6.16-2.29 6.16c-1.14.93-1.71 2.03-1.71 3.19 0 2.22 1.8 4.05 4 4.05z' }),
    React.createElement('path', { d: 'M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97' })),
  pressure: (React) => React.createElement('svg', svgAttrs,
    React.createElement('path', { d: 'm12 14 4-4' }),
    React.createElement('path', { d: 'M3.34 19a10 10 0 1 1 17.32 0' })),
  target: (React) => React.createElement('svg', { ...svgAttrs, width: 24, height: 24 },
    React.createElement('circle', { cx: 12, cy: 12, r: 10 }),
    React.createElement('circle', { cx: 12, cy: 12, r: 6 }),
    React.createElement('circle', { cx: 12, cy: 12, r: 2 })),
  droplets: (React) => React.createElement('svg', svgAttrs,
    React.createElement('path', { d: 'M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7 2.9 7 2.9s-2.15 6.16-2.29 6.16c-1.14.93-1.71 2.03-1.71 3.19 0 2.22 1.8 4.05 4 4.05z' }),
    React.createElement('path', { d: 'M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97' })),
  gas: (React) => React.createElement('svg', svgAttrs,
    React.createElement('path', { d: 'M12.8 19.6A2 2 0 1 0 14 16H2' }),
    React.createElement('path', { d: 'M17.5 8a2.5 2.5 0 1 1 2 4H2' }),
    React.createElement('path', { d: 'M9.8 4.4A2 2 0 1 1 11 8H2' })),
  video: (React) => React.createElement('svg', svgAttrs,
    React.createElement('path', { d: 'm22 8-6 4 6 4V8Z' }),
    React.createElement('rect', { width: 14, height: 12, x: 2, y: 6, rx: 2, ry: 2 }))
};

function Dashboard({ state }) {
  const { React } = window.__awrsReact;
  const status = statusFrom(state);
  const metrics = state.metrics;
  const metric = (key, decimals = 1) => Number.isFinite(metrics[key]) ? metrics[key].toFixed(decimals) : 'NaN';

  const StatusPill = ({ isOnline }) => React.createElement('span', {
    className: `awrs-badge ${isOnline ? 'online' : 'offline'}`
  }, isOnline ? 'online' : 'offline');

  const MetricTile = ({ label, unit, valueKey, icon, decimals = 1, barColor = 'green' }) => {
    const val = metrics[valueKey];
    const isOnline = Number.isFinite(val);
    const pct = Math.max(0, Math.min(100, (Number(val) / 100) * 100));
    return React.createElement('div', { className: 'awrs-tile' },
      React.createElement('div', { className: 'awrs-tile-header' },
        React.createElement('span', null, icon, ' ', label),
        React.createElement(StatusPill, { isOnline })
      ),
      React.createElement('div', { className: 'awrs-value' }, `${metric(valueKey, decimals)} ${unit}`)
    );
  };

  const GasTile = ({ label, keyName, max = 100, unit = 'ppm' }) => {
    const val = metrics[keyName];
    const isOnline = Number.isFinite(val);
    const pct = Math.max(0, Math.min(100, (Number(val) / max) * 100));
    return React.createElement('div', { className: 'awrs-tile awrs-card-muted' },
      React.createElement('div', { className: 'awrs-tile-header' },
        React.createElement('span', null, label),
        React.createElement(StatusPill, { isOnline })
      ),
      React.createElement('div', { className: 'awrs-value', style: { color: '#22c55e' } }, `${metric(keyName, 1)} ${unit}`),
      React.createElement('div', { className: 'awrs-bar' },
        React.createElement('div', { className: 'awrs-bar-fill', style: { width: `${pct.toFixed(1)}%` } })
      )
    );
  };

  return React.createElement('div', { className: 'awrs-panel' },
    React.createElement('div', { className: 'awrs-hero' },
      React.createElement('div', { className: 'awrs-hero-left' },
        Icons.target(React),
        React.createElement('div', null,
          React.createElement('div', { className: 'awrs-hero-title' }, 'AWRS Dashboard'),
          React.createElement('div', { className: 'awrs-hero-sub' }, 'Real-time environmental and water quality monitoring')
        )
      ),
      React.createElement('button', { className: 'awrs-cta' }, status.className === 'status-online' ? 'Connected' : 'Connect')
    ),

    React.createElement('div', { className: 'awrs-card' },
      React.createElement('div', { className: 'awrs-card-header' },
        React.createElement('div', { className: 'awrs-title' }, Icons.video(React), 'Camera & Water Level'),
        React.createElement(StatusPill, { isOnline: Number.isFinite(metrics.waterLevel) })
      ),
      React.createElement('div', { className: 'awrs-video' },
        React.createElement('div', { className: 'awrs-video-content' },
          React.createElement('h3', null, 'Live Camera Feed'),
          React.createElement('small', null, 'Camera Offline'),
          React.createElement('small', null, 'Connect Raspberry Pi Camera')
        )
      ),
      React.createElement('div', { className: 'awrs-water-row' },
        React.createElement('div', null,
          React.createElement('div', { className: 'awrs-sub' }, 'Water Level Distance'),
          React.createElement('div', { className: 'awrs-progress-track' },
            React.createElement('div', { className: 'awrs-progress-fill', style: { width: `${Math.min(100, Math.max(0, (Number(metrics.waterLevel) / 10) * 100))}%` } })
          ),
          React.createElement('div', { className: 'awrs-sub' }, 'Distance from well surface to water surface')
        ),
        React.createElement('div', { className: 'awrs-water-val' }, `${metric('waterLevel', 1)} meters`)
      )
    ),

    React.createElement('div', { className: 'awrs-card' },
      React.createElement('div', { className: 'awrs-card-header' },
        React.createElement('div', { className: 'awrs-title', style: { color: '#1fa06a' } }, Icons.target(React), 'Well Integrity'),
        React.createElement(StatusPill, { isOnline: status.className === 'status-online' })
      ),
      React.createElement('div', { className: 'awrs-grid3' },
        React.createElement(MetricTile, { label: 'Temperature', unit: '°C', valueKey: 'temp', icon: Icons.thermometer(React) }),
        React.createElement(MetricTile, { label: 'Humidity', unit: '%', valueKey: 'humidity', icon: Icons.humidity(React) }),
        React.createElement(MetricTile, { label: 'Air Pressure', unit: 'hPa', valueKey: 'pressure', icon: Icons.pressure(React), decimals: 0 })
      ),
      React.createElement('div', { className: 'awrs-card', style: { background: '#f7fbfc', marginTop: 12, borderColor: '#e1ebee' } },
        React.createElement('div', { className: 'awrs-title', style: { marginBottom: 10 } }, Icons.gas(React), 'Gas Measurements'),
        React.createElement('div', { className: 'awrs-grid3' },
          React.createElement(GasTile, { label: 'H₂S Gas', keyName: 'h2s', max: 5 }),
          React.createElement(GasTile, { label: 'CO Gas', keyName: 'co', max: 50 }),
          React.createElement(GasTile, { label: 'O₂ Gas', keyName: 'o2', max: 25, unit: '%' })
        )
      )
    ),

    React.createElement('div', { className: 'awrs-card' },
      React.createElement('div', { className: 'awrs-card-header' },
        React.createElement('div', { className: 'awrs-title' }, Icons.droplets(React), 'Water Integrity'),
        React.createElement(StatusPill, { isOnline: status.className === 'status-online' })
      ),
      React.createElement('div', { className: 'awrs-grid2' },
        React.createElement('div', { className: 'awrs-tile awrs-card-muted' },
          React.createElement('div', { className: 'awrs-tile-header' },
            React.createElement('span', null, 'pH Level'),
            React.createElement(StatusPill, { isOnline: Number.isFinite(metrics.ph) })
          ),
          React.createElement('div', { className: 'awrs-value', style: { color: '#22c55e' } }, `${metric('ph', 1)} pH`),
          React.createElement('div', { className: 'awrs-sub' }, 'Quality Level'),
          React.createElement('div', { className: 'awrs-bar-red' })
        ),
        React.createElement('div', { className: 'awrs-tile awrs-card-muted' },
          React.createElement('div', { className: 'awrs-tile-header' },
            React.createElement('span', null, 'TDS (Minerals)'),
            React.createElement(StatusPill, { isOnline: Number.isFinite(metrics.tds) })
          ),
          React.createElement('div', { className: 'awrs-value', style: { color: '#22c55e' } }, `${metric('tds', 0)} ppm`),
          React.createElement('div', { className: 'awrs-sub' }, 'Quality Level'),
          React.createElement('div', { className: 'awrs-bar-red' })
        )
      )
    )
  );
}

function createState(initial) {
  return {
    connected: true,
    lastUpdated: Date.now(),
    metrics: { ...defaults, ...(initial?.metrics || initial || {}) },
  };
}

function mount(selector) {
  const target = document.querySelector(selector);
  if (!target) return;

  wrapExistingAPIs();
  injectStylesOnce();

  const initialState = (() => {
    if (window.awrsDashboard?.getState) return window.awrsDashboard.getState();
    return createState({});
  })();

  loadReact().then(({ React, ReactDOM }) => {
    window.__awrsReact = { React };
    const { useState, useEffect } = React;
    const { createRoot } = ReactDOM;

    const RootComp = () => {
      const [state, setState] = useState(() => createState(initialState));

      useEffect(() => {
        const unsub = dataBus.subscribe((payload) => {
          if (payload && payload.__connection !== undefined) {
            setState((prev) => ({ ...prev, connected: !!payload.__connection }));
            return;
          }
          const normalized = normalize(payload);
          if (!Object.keys(normalized).length) return;
          setState((prev) => ({
            ...prev,
            connected: true,
            lastUpdated: Date.now(),
            metrics: { ...prev.metrics, ...normalized },
          }));
        });

        const evtHandler = (e) => {
          if (!e || e.detail === undefined) return;
          dataBus.emit(e.detail);
        };
        window.addEventListener('awrs:sensor-data', evtHandler);
        return () => {
          unsub();
          window.removeEventListener('awrs:sensor-data', evtHandler);
        };
      }, []);

      useEffect(() => {
        const id = setInterval(() => setState((prev) => ({ ...prev })), 1000);
        return () => clearInterval(id);
      }, []);

      return React.createElement(Dashboard, { state });
    };

    const root = createRoot(target);
    roots.set(selector, root);
    root.render(React.createElement(RootComp));
  });
}

function unmount(selector) {
  const root = roots.get(selector);
  if (root) {
    root.unmount();
    roots.delete(selector);
  }
}

window.AWRSDashboardMicrofrontend = { mount, unmount };

export {}; // keep module scope
