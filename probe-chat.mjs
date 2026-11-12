import { spawn } from 'child_process';
import http from 'http';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9226;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const chromeProc = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-extensions',
  `--remote-debugging-port=${CDP_PORT}`,
  '--user-data-dir=' + process.env.TEMP + '/chrome-chat-probe',
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
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK });
await send('Page.navigate', { url: 'http://localhost:1420/llm/chat' });
await wait(10000);

const probe = await send('Runtime.evaluate', {
  expression: `(() => {
    const rect = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), left: Math.round(r.left), w: Math.round(r.width) }; };
    const css = (el) => { if (!el) return null; const s = getComputedStyle(el); return { position: s.position, top: s.top, bottom: s.bottom, marginTop: s.marginTop, marginBottom: s.marginBottom, paddingTop: s.paddingTop, overflow: s.overflow, height: s.height, transform: s.transform, flex: s.flex }; };
    // Find the scrollable conversation element (the one with scrollbarGutter style or overflow auto)
    const scrollables = Array.from(document.querySelectorAll('*')).filter((el) => {
      const s = getComputedStyle(el);
      return (s.overflow === 'auto' || s.overflowY === 'auto') && el.clientHeight > 0 && el.scrollHeight > el.clientHeight;
    });
    const first = scrollables.map((el) => {
      const r = el.getBoundingClientRect();
      return { cls: el.className?.toString().slice(0,80), top: Math.round(r.top), bottom: Math.round(r.bottom), clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, scrollTop: el.scrollTop, maxScroll: el.scrollHeight - el.clientHeight };
    }).slice(0, 5);
    // Also capture the topmost conversation content / first message and the nav rail
    const navRail = rect('.chat-nav-rail');
    const navMain = rect('.nav-main');
    const firstMsg = (() => {
      const els = document.querySelectorAll('[role="log"] *, .message-item, [data-role]');
      return null;
    })();
    return JSON.stringify({
      winH: window.innerHeight,
      scrollables: first,
      navRail,
      stage: rect('.chat-stage'),
      row: (() => { const s = document.querySelector('.chat-stage')?.children[2]; if (!s) return null; const r = s.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), overflow: getComputedStyle(s).overflow, cls: s.className }; })(),
      threadDetail: (() => { const el = document.querySelector('.message-zoom'); const r = el?.getBoundingClientRect(); return r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), css: css(el) } : null; })(),
      conv: (() => { const el = document.querySelector('[role="log"]'); if (!el) return null; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), css: { position: s.position, inset: s.inset, overflow: s.overflow, height: s.height }, scrollTop: el.scrollTop }; })(),
      chatInput: rect('.chat-input, textarea'),
    });
  })()`,
  returnByValue: true,
});
console.log('=== PROBE ===');
console.log(probe?.result?.result?.value || JSON.stringify(probe?.result) || '(empty)');

// Inject a bunch of fake messages to test scrolling? Skip for now.
await send('Page.captureScreenshot', { format: 'png' }).then(async (res) => {
  const data = res?.result?.data;
  if (data) {
    const fs = await import('fs');
    fs.writeFileSync(process.cwd() + '/probe-chat.png', Buffer.from(data, 'base64'));
    console.log('=== SCREENSHOT: probe-chat.png ===');
  }
});
console.log('=== DONE ===');
setTimeout(() => process.exit(0), 300);
