import { spawn } from 'child_process';
import http from 'http';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9225;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const chromeProc = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-extensions',
  `--remote-debugging-port=${CDP_PORT}`,
  '--user-data-dir=' + process.env.TEMP + '/chrome-header-check',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}${path}`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

let tabs = null;
for (let i = 0; i < 30; i++) {
  try { tabs = await getJson('/json/list'); if (tabs?.length) break; } catch {}
  await wait(400);
}
if (!tabs?.length) { console.error('No CDP tab'); process.exit(1); }
const tab = tabs.find((t) => t.type === 'page') || tabs[0];

const ws = new WebSocket(tab.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
};
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

const MOCK = `
  (function () {
    window.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: 'main' },
        currentWebview: { label: 'main', windowLabel: 'main' },
        currentWebviewWindow: { label: 'main' },
      },
      transformCallback: (cb) => { window.__tauri_cb = cb; return 1; },
      unregisterCallback: () => {},
      invoke: (cmd, args) => {
        if (cmd === 'get_license_status') return Promise.resolve({ is_licensed: true, license_type: 'pro', license_key: 'x', hwid: 'x', message: 'ok' });
        if (cmd === 'llm_get_provider_presets') return Promise.resolve([]);
        if (cmd === 'llm_get_api_providers') return Promise.resolve({ providers: [] });
        if (cmd === 'llm_list_installed_models') return Promise.resolve([]);
        if (cmd === 'plugin:event|listen') {
          const id = 'x' + Math.random().toString(36).slice(2);
          const unlisten = () => Promise.resolve();
          unlisten.id = id; unlisten.event = args?.event; unlisten.target = args?.target;
          return Promise.resolve(unlisten);
        }
        if (cmd === 'plugin:event|unlisten') return Promise.resolve();
        return Promise.resolve(null);
      },
      plugins: {
        event: {
          listen: (e, h) => Promise.resolve(() => {}),
          unlisten: () => Promise.resolve(),
          emit: () => Promise.resolve(),
        },
      },
    };
    window.__TAURI_PLUGIN_HTTP__ = {};
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      listen: () => Promise.resolve(() => {}),
      emit: () => Promise.resolve(),
      unregisterListener: () => {},
      registerListener: () => {},
      _emit: () => {}, _listen: () => {}, _unlisten: () => {},
    };
    window.__hideSplash = () => {};
  })();
`;

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK });
await send('Page.navigate', { url: 'http://localhost:1420/llm/chat' });
await wait(9000);

const layout = await send('Runtime.evaluate', {
  expression: `(() => {
    const rect = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), w: Math.round(r.width) }; };
    const stage = document.querySelector('.chat-stage');
    const row = stage ? stage.children[2] : null;
    const main = row ? row.children[1] : null;
    const rr = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), w: Math.round(r.width) }; };
    return JSON.stringify({
      winH: window.innerHeight,
      bodyScrollH: document.body.scrollHeight,
      root: rect('.app-layout'),
      titlebar: rect('.titlebar'),
      stage: rect('.chat-stage'),
      navRail: rect('.chat-nav-rail'),
      innerRow: rr(row),
      main: rr(main),
      header: rect('.header-page-glass'),
      modelDropdown: rect('.chat-model-dropdown'),
      userChip: rect('.chat-user-chip'),
      chatStageClass: stage ? stage.className : null,
      innerRowClass: row ? row.className : null,
      stageComputed: stage ? (() => { const s = getComputedStyle(stage); return { display: s.display, position: s.position, margin: s.margin, padding: s.padding, flex: s.flex, transform: s.transform, height: s.height }; })() : null,
      rowComputed: row ? (() => { const s = getComputedStyle(row); return { display: s.display, position: s.position, margin: s.margin, padding: s.padding, flex: s.flex, transform: s.transform, top: s.top, height: s.height, overflow: s.overflow }; })() : null,
      stageChildren: stage ? Array.from(stage.children).map(c => c.className).join(' | ') : null,
      providerWrap: (() => { const el = document.getElementsByClassName('group/sidebar-wrapper')[0]; const r = el?.getBoundingClientRect(); return r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), w: Math.round(r.width) } : null; })(),
      threadDetail: (() => { const el = document.querySelector('.message-zoom'); const r = el?.getBoundingClientRect(); return r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) } : null; })(),
    });
  })()`,
  returnByValue: true,
});
console.log('=== HEADER STATE ===');
console.log(layout?.result?.result?.value || JSON.stringify(layout?.result) || '(empty)');
await send('Page.captureScreenshot', { format: 'png' }).then(async (res) => {
  const data = res?.result?.data;
  if (data) {
    const fs = await import('fs');
    fs.writeFileSync(process.cwd() + '/header-check.png', Buffer.from(data, 'base64'));
    console.log('=== SCREENSHOT: header-check.png ===');
  }
});
console.log('=== DONE ===');
setTimeout(() => process.exit(0), 500);
