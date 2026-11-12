import { spawn } from 'child_process';
import http from 'http';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9228;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const chromeProc = spawn(chrome, ['--headless=new','--disable-gpu','--no-sandbox','--disable-extensions',`--remote-debugging-port=${CDP_PORT}`,'--user-data-dir='+process.env.TEMP+'/chrome-probe3','about:blank'], { stdio: ['ignore','ignore','pipe'] });
function getJson(path){return new Promise((res,rej)=>{http.get(`http://127.0.0.1:${CDP_PORT}${path}`,(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d));}catch(e){rej(e);}});}).on('error',rej);});}
let tabs=null; for(let i=0;i<30;i++){try{tabs=await getJson('/json/list');if(tabs?.length)break;}catch{}await wait(400);}
const tab=tabs.find(t=>t.type==='page')||tabs[0];
const ws=new WebSocket(tab.webSocketDebuggerUrl);let msgId=0;const pending=new Map();
function send(method,params={}){const id=++msgId;ws.send(JSON.stringify({id,method,params}));return new Promise((r)=>pending.set(id,r));}
ws.onmessage=(e)=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
const MOCK=`(function(){window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main',windowLabel:'main'},currentWebviewWindow:{label:'main'}},transformCallback:(cb)=>{window.__tauri_cb=cb;return 1;},unregisterCallback:()=>{},invoke:(cmd,args)=>{if(cmd==='get_license_status')return Promise.resolve({is_licensed:true});if(cmd==='llm_get_provider_presets')return Promise.resolve([]);if(cmd==='llm_get_api_providers')return Promise.resolve({providers:[]});if(cmd==='llm_list_installed_models')return Promise.resolve([]);if(cmd==='plugin:event|listen'){const id='x'+Math.random().toString(36).slice(2);const u=()=>Promise.resolve();u.id=id;return Promise.resolve(u);}if(cmd==='plugin:event|unlisten')return Promise.resolve();return Promise.resolve(null);},plugins:{event:{listen:(e,h)=>Promise.resolve(()=>{}),unlisten:()=>Promise.resolve(),emit:()=>Promise.resolve()}}};window.__TAURI_PLUGIN_HTTP__={};window.__TAURI_EVENT_PLUGIN_INTERNALS__={listen:()=>Promise.resolve(()=>{}),emit:()=>Promise.resolve(),unregisterListener:()=>{},registerListener:()=>{},_emit:()=>{},_listen:()=>{},_unlisten:()=>{}};window.__hideSplash=()=>{};})();`;
await send('Runtime.enable');await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
await send('Page.addScriptToEvaluateOnNewDocument',{source:MOCK});
await send('Page.navigate',{url:'http://localhost:1420/llm/chat'});await wait(10000);

const expression = [
  "(() => {",
  "  const info = (el, label) => { if (!el) return label + ': null'; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return label + ': top=' + Math.round(r.top) + ' bottom=' + Math.round(r.bottom) + ' h=' + Math.round(r.height) + ' flex=' + s.flex + ' hCss=' + s.height + ' disp=' + s.display + ' overflow=' + s.overflow + ' pos=' + s.position; };",
  "  const q = (sel) => document.querySelector(sel);",
  "  let chain = '';",
  "  let el = q('.message-zoom');",
  "  let depth = 0;",
  "  while (el && depth < 8) {",
  "    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);",
  "    chain += (depth + 1) + ' [' + (el.className?.toString().slice(0, 70) || el.tagName) + '] top=' + Math.round(r.top) + ' bot=' + Math.round(r.bottom) + ' h=' + Math.round(r.height) + ' flex=' + s.flex + ' h=' + s.height + ' ovf=' + s.overflow + '|';",
  "    el = el.parentElement; depth++;",
  "  }",
  "  const zoom = q('.message-zoom');",
  "  const p1 = zoom?.parentElement;",
  "  const p2 = p1?.parentElement;",
  "  const p3 = p2?.parentElement;",
  "  const inputWrap = zoom?.parentElement?.lastElementChild;",
  "  return JSON.stringify({ chain: chain, p1: info(p1, 'p1'), p2: info(p2, 'p2'), p3: info(p3, 'p3'), header: info(q('.header-page-glass'), 'header'), inputWrap: info(inputWrap, 'inputWrap'), main: info(q('main'), 'main') });",
  "})()"
].join("\n");

const r = await send('Runtime.evaluate', { expression, returnByValue: true });
console.log(r?.result?.result?.value || JSON.stringify(r?.result));
await send('Page.captureScreenshot',{format:'png'}).then(async(res)=>{if(res?.result?.data){const fs=await import('fs');fs.writeFileSync(process.cwd()+'/probe3.png',Buffer.from(res.result.data,'base64'));console.log('shot');}});
setTimeout(()=>process.exit(0),300);
