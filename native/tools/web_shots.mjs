#!/usr/bin/env node
// 用 **CDP**（Chrome DevTools 协议）驱动无头 Chrome 跑 **Web 版**并截图 —— 拿来当 Godot 端的参照物。
// 零依赖：Node 22+ 内置 `WebSocket`（不需要 puppeteer/playwright）；Electron 在本机 `whenReady()` 会卡死
//（试过 `--no-sandbox`/`--disable-gpu` 都不行），所以走真浏览器。
//
//   node native/tools/serve_dist.mjs                       # 另开一个终端（或后台）
//   node native/tools/web_shots.mjs --out native/build/web
//   node native/tools/web_shots.mjs --url http://127.0.0.1:5177/index.html --scale 1.5
//
// 浏览器：`CHROME_BIN` → 标准安装路径（Chrome / Edge）。截图与 Godot 侧同名状态对齐：
//   web-launch（启动页）→ 点一下 → web-entry（入口菜单）→ Game Start → web-after-game-start
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const NATIVE = resolve(HERE, "..");

const argv = process.argv.slice(2);
let out = join(NATIVE, "build", "web");
let url = "http://127.0.0.1:5177/index.html";
let width = 794;
let height = 450;
let scale = 1.5;
let keepOpen = false;
let everyS = 0; // > 0 = 按这个间隔连拍（诊断"卡在装载页"用）
let dumpUi = false; // `--dump-ui`：每拍一张图顺带把 UI 节点树（`cross`/`geo`）打出来
let uiPage = ""; // `--ui-page <id>`：装载完直接把这一页设到第 0 层，只拍这一页（与宿主同名开关对齐）
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--out") out = argv[++i];
  else if (argv[i] === "--url") url = argv[++i];
  else if (argv[i] === "--width") width = Number(argv[++i]);
  else if (argv[i] === "--height") height = Number(argv[++i]);
  else if (argv[i] === "--scale") scale = Number(argv[++i]);
  else if (argv[i] === "--every-s") everyS = Number(argv[++i]);
  else if (argv[i] === "--dump-ui") dumpUi = true;
  else if (argv[i] === "--ui-page") uiPage = argv[++i];
  else if (argv[i] === "--keep-open") keepOpen = true;
}
mkdirSync(out, { recursive: true });

function findBrowser() {
  const cands = [
    process.env.CHROME_BIN,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  for (const c of cands) if (existsSync(c)) return c;
  throw new Error("no Chrome/Edge found; set CHROME_BIN");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const win_w = Math.round(width * scale);
const win_h = Math.round(height * scale);
const profile = mkdtempSync(join(tmpdir(), "lfw-web-"));
const debugPort = 9222 + Math.floor(Math.random() * 200);
const browser = findBrowser();

const child = spawn(
  browser,
  [
    // 无头模式（默认）在本机跑不出游戏（装载链停在 `builtin_data/launch/*.ui.json` 中间，见
    // `--probe` 输出）；`--headful` 用真窗口跑，拿来确认「Web 版本身没问题，是无头环境的问题」。
    ...(argv.includes("--headful") ? [] : ["--headless=new"]),
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    `--window-size=${win_w},${win_h}`,
    "--hide-scrollbars",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=Translate,BackForwardCache",
    ...(argv.includes("--headful") ? ["--window-position=1220,30"] : []),
    // WebGL：默认要求走真 GPU（本机有独显，Godot 都报了 NVIDIA）；软件 GL 下 three.js 会渲染不全。
    // `--swiftshader` 时才退回软件渲染。
    ...(argv.includes("--swiftshader")
      ? ["--enable-unsafe-swiftshader"]
      : ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"]),
    "about:blank", // 先空白页：`Page.addScriptToEvaluateOnNewDocument` 要在导航前装好（请求日志用）
  ],
  { stdio: "ignore" },
);

function cleanup() {
  try {
    child.kill();
  } catch {
    /* 已退出 */
  }
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* 占用中就留着 */
  }
}
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

async function waitForDebugger() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* 还没起来 */
    }
    await sleep(200);
  }
  throw new Error(`devtools endpoint not ready on :${debugPort}`);
}

const wsUrl = await waitForDebugger();
const ws = new WebSocket(wsUrl);
await new Promise((ok, bad) => {
  ws.onopen = ok;
  ws.onerror = bad;
});

let nextId = 1;
const pending = new Map();
const consoleLines = [];
const pageErrors = [];
const netLines = [];
// 只关心「游戏资源」那一类：脚本/样式/文档不记（否则噪声太大）。
const NET_TYPES = new Set(["XHR", "Fetch", "Image", "Media", "Other", "Font", "Manifest"]);
const NET_URL = /\.(zip|json|json5|xml|png|jpg|jpeg|webp|mp3|wav|ogg|glb|gltf|dat)(\?|$)/i;
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { ok, bad } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) bad(new Error(JSON.stringify(msg.error)));
    else ok(msg.result);
    return;
  }
  if (msg.method === "Network.requestWillBeSent") {
    const u = msg.params.request.url;
    if (NET_TYPES.has(msg.params.type) && NET_URL.test(u)) netLines.push(`REQ ${msg.params.type} ${u}`);
  }
  if (msg.method === "Network.responseReceived") {
    const u = msg.params.response.url;
    if (NET_TYPES.has(msg.params.type) && NET_URL.test(u)) {
      netLines.push(`RES ${msg.params.response.status} ${msg.params.type} ${u} [${msg.params.response.mimeType}]`);
    }
  }
  if (msg.method === "Network.loadingFailed") {
    netLines.push(`FAIL ${msg.params.errorText} (${msg.params.type})`);
  }
  if (netLines.length > 400) netLines.splice(0, netLines.length - 400);
  if (msg.method === "Runtime.consoleAPICalled") {
    const text = (msg.params.args ?? []).map((a) => a.value ?? a.description ?? a.type).join(" ");
    consoleLines.push(`[${msg.params.type}] ${text}`);
  }
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    pageErrors.push(d.exception?.description ?? d.text ?? "unknown exception");
  }
  if (msg.method === "Log.entryAdded") {
    const e = msg.params.entry;
    if (e.level === "error" || e.level === "warning") consoleLines.push(`[${e.level}] ${e.text}`);
  }
};

function cdp(method, params = {}) {
  const id = nextId++;
  return new Promise((ok, bad) => {
    pending.set(id, { ok, bad });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression, awaitPromise = false) {
  const r = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) return `eval-error: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ""}`;
  return r.result?.value;
}

async function shot(name) {
  const r = await cdp("Page.captureScreenshot", { format: "png" });
  const file = join(out, `${name}.png`);
  writeFileSync(file, Buffer.from(r.data, "base64"));
  console.log(`  -> ${file}`);
  if (dumpUi) await dump_ui(name);
}

// UI 节点树事实（`cross` = 自身盒、`geo` = 含 `pos` 的全局盒；与 Godot 宿主 `--ui-dump` 的
// `box=` 同一套量）。拿它做**数值**比对，比看像素可靠得多。
async function dump_ui(tag) {
  const tree = await evaluate(`(() => {
    const i = window.lfw;
    if (!i || !i.layers || !i.layers.all) return "(no lfw)";
    const f = (v) => (typeof v === "number" && isFinite(v) ? v.toFixed(1) : String(v));
    const out = [];
    const walk = (n, d) => {
      const pad = "  ".repeat(d);
      let head = pad + (n.id ?? "?");
      try {
        const c = n.cross;
        if (c) head += " cross=(" + f(c.left) + "," + f(c.top) + " " + f(c.right - c.left) + "x" + f(c.bottom - c.top) + ")";
      } catch { head += " cross=<err>"; }
      try {
        const g = n.geo;
        if (g) head += " geo=(" + f(g.pos_x) + "," + f(g.pos_y) + " " + f(g.left) + "," + f(g.top) + "," + f(g.right) + "," + f(g.bottom) + ")";
      } catch { head += " geo=<err>"; }
      try { head += " vis=" + (n.visible ? 1 : 0); } catch { /* skip */ }
      try { if (n.text && n.text.text) head += ' text="' + String(n.text.text).replace(/\\n/g, "\\\\n") + '"'; } catch { /* skip */ }
      out.push(head);
      for (const ch of n.children || []) walk(ch, d + 1);
    };
    for (const l of i.layers.all) for (const p of l.pages || []) walk(p, 0);
    return out.join("\\n");
  })()`);
  console.log(`  [ui ${tag}]`);
  for (const line of String(tree).split("\n")) console.log(`    ${line}`);
}

async function click(x, y) {
  const base = { x: Math.round(x), y: Math.round(y), button: "left", clickCount: 1 };
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", ...base, button: "none" });
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", ...base });
  await sleep(60);
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", ...base });
}

async function key(text, code, vk) {
  await cdp("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    text,
    key: text,
    code,
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
  });
  // 游戏按「按住多少帧」记一次按键（`key_hit_duration` = 10 帧 ≈ 167ms@60FPS），
  // 太短的敲击在真实时间下可能整段落在两帧之间 ⇒ 压 120ms。
  await sleep(120);
  await cdp("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: text,
    code,
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
  });
}

async function dump_req_log(label) {
  const raw = await evaluate("JSON.stringify((window.__req_log || []).map(r => r.t + ' ' + r.k + ' ' + r.url))");
  let list = [];
  try {
    list = JSON.parse(raw);
  } catch {
    console.log(`  ! 请求日志读取失败: ${raw}`);
    return;
  }
  console.log(`  [${label}] 脚本侧请求 ${list.length} 条:`);
  for (const line of list.slice(-40)) console.log(`    ${line}`);
}

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Log.enable");
await cdp("Network.enable");

// 请求旁路日志：把每一次 fetch/XHR 连**发起点的调用栈**记下来（诊断「某个资源压根没请求」时用）。
await cdp("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => {
    const log = (window.__req_log = []);
    const t0 = Date.now();
    const st = (skip) => (new Error()).stack.split("\\n").slice(skip, skip + 5).map(s => s.trim()).join(" <- ");
    const orig_fetch = window.fetch;
    window.fetch = function (...args) {
      const arg = args[0];
      const url = typeof arg === "string" ? arg : (arg && arg.url) || String(arg);
      log.push({ t: Date.now() - t0, k: "fetch", url: String(url), st: st(2) });
      return orig_fetch.apply(this, args);
    };
    const orig_open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u, ...rest) {
      log.push({ t: Date.now() - t0, k: "xhr", url: String(u), st: st(2) });
      this.addEventListener("loadend", () => {
        let len = -1;
        try {
          len = this.response instanceof ArrayBuffer ? this.response.byteLength : (this.response?.size ?? -1);
        } catch {
          /* response 读不出来就算了 */
        }
        log.push({ t: Date.now() - t0, k: "xhr-done", url: String(u), status: this.status, len });
      });
      return orig_open.call(this, m, u, ...rest);
    };
  })();`,
});

console.log(`web_shots: ${url}  ${win_w}x${win_h}  browser=${browser}`);
await cdp("Page.navigate", { url });
// 等游戏画布真的起来（画布尺寸 > 0 才算 layout 完成）
for (let i = 0; i < 60; i++) {
  const ok = await evaluate(
    "(() => { const c = document.querySelector('canvas'); return !!c && c.width > 100 && c.height > 50; })()",
  );
  if (ok) break;
  await sleep(500);
}
const canvasInfo = await evaluate(
  "(() => { const c = document.querySelector('canvas'); return c ? `${c.width}x${c.height} css=${c.clientWidth}x${c.clientHeight}` : 'no canvas'; })()",
);
console.log(`canvas: ${canvasInfo}`);

// `--probe`：页面里到底卡在哪一步（fetch 了哪些资源 / 有没有 LFW 实例 / WebGL 能不能用）。
if (argv.includes("--probe") || argv.includes("--probe-only")) {
  const probe = await evaluate(`(() => {
    const res = performance.getEntriesByType('resource').map(r => r.name.split('/').pop());
    const gl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
    const lfwKeys = Object.keys(window).filter(k => /lfw|ditto/i.test(k));
    const zips = (() => { try { return JSON.stringify(window.LFW && window.LFW.ZIPS); } catch (e) { return 'err:' + e.message; } })();
    const inst = window.lfw || null;
    const pages = (() => { try { return JSON.stringify((inst.layers.bottom.pages || []).map(p => p.id)); } catch (e) { return 'err:' + e.message; } })();
    const loadingEl = document.querySelector('[class*=loading]') ? document.querySelector('[class*=loading]').className : null;
    return JSON.stringify({ res: res.slice(0, 24), gl, lfwKeys, zips, pages, loadingEl, vis: document.visibilityState });
  })()`);
  console.log(`probe: ${probe}`);
  // 装载页卡死时的第二层探针：DOM 跑到哪一步 / 持久化（localforage→IndexedDB）能不能用 / 有没有别的事件流阻塞。
  const probe2 = await evaluate(`(async () => {
    const root = document.getElementById('root');
    const idb = await (async () => {
      try {
        const dbs = await indexedDB.databases();
        return JSON.stringify(dbs.map(d => d.name + ':' + (d.version ?? '?')));
      } catch (e) { return 'err:' + e.message }
    })();
    const ls = (() => { try { return JSON.stringify(Object.keys(localStorage).slice(0, 12)); } catch (e) { return 'err:' + e.message } })();
    return JSON.stringify({
      rootChildren: root ? root.children.length : -1,
      rootHtml: root ? root.innerHTML.slice(0, 300) : null,
      rootClasses: root ? root.firstElementChild?.className : null,
      idb, ls, fonts: document.fonts.status,
    });
  })()`, true);
  console.log(`probe2: ${probe2}`);
  await dump_req_log("probe");

  // `--eval <js>`：在页面里跑一段表达式（支持 await），把结果打出来 —— 之后驱动 Web 版也靠它。
  const evalIdx = argv.indexOf("--eval");
  if (evalIdx >= 0) {
    const expr = argv[evalIdx + 1];
    console.log(`eval: ${await evaluate(`(async () => { try { return String(await (${expr})); } catch (e) { return "THROW: " + e; } })()`, true)}`);
  }
  console.log(`net: ${netLines.length ? netLines.slice(-12).join(" | ") : "(没看到 zip/json 请求)"}`);
  if (argv.includes("--probe-only")) {
    ws.close();
    cleanup();
    process.exit(0);
  }
}

// 连拍模式：诊断"一直卡在装载页"时用（`--every-s 5`）。每拍打一行页面状态与网络，便于定位阶段。
// `--ui-page <id>`：装载完把这一页设到第 0 层、只拍这一页 —— 与宿主 `--ui-page <id>` 一一对应
//（拿它当参照物做逐像素/逐节点对比时，不用为了看一页把整条流程点出来）。
if (uiPage) {
  console.log("  等装载完成（首页 `init` 出现）…");
  const t0 = Date.now();
  for (;;) {
    const ok = await evaluate(
      "(() => { const i = window.lfw; return !!(i && i.ui && i.ui.id && i.uis && i.uis.all && i.uis.all.length); })()",
    );
    if (ok) break;
    if (Date.now() - t0 > 300000) {
      console.log("  ! 等装载超时");
      break;
    }
    await sleep(500);
  }
  // 目标页在**哪张表**里取决于它是谁：内建启动页（`builtin_data/launch/*`）一进场就在，prel/data 那两张
  // 表要等「点一下启动页」把包 import 进来才会 `uis.add` ⇒ 先等 20s，还没出现就点一下再接着等。
  const has_page = () =>
    evaluate(`(window.lfw.uis.all || []).some((v) => v.id === ${JSON.stringify(uiPage)})`);
  let clicked = false;
  const tWait = Date.now();
  for (;;) {
    if (await has_page()) break;
    if (!clicked && Date.now() - tWait > 20000) {
      const b = JSON.parse(
        await evaluate(
          "(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return JSON.stringify({ l: r.left, t: r.top, w: r.width, h: r.height }); })()",
        ),
      );
      console.log("  目标页还不在表里 ⇒ 点一下启动页，把 prel/data 那两张表 import 进来");
      await click(b.l + b.w / 2, b.t + b.h / 2);
      clicked = true;
    }
    if (Date.now() - tWait > 300000) {
      console.log("  ! 等目标页超时");
      break;
    }
    await sleep(500);
  }
  const set = await evaluate(
    `(async () => {
      const i = window.lfw;
      const id = ${JSON.stringify(uiPage)};
      const all = (i.uis.all || []).map((v) => v.id);
      if (!all.includes(id)) return "no such page id; have: " + all.join(",");
      i.layers.set_page({ id }, 0);
      await new Promise((r) => setTimeout(r, 600));
      return "ok ui.id=" + i.ui.id;
    })()`,
    true,
  );
  console.log(`  set_page ${uiPage}: ${set}`);
  // 画布在页面里的 box（Web 侧也是 contain 缩放）—— 归一化相减时按它裁。
  const cbox = await evaluate(
    "(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return JSON.stringify({ l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }); })()",
  );
  console.log(`  canvas box: ${cbox}`);
  await sleep(2500); // 图片解码 + 第一帧 UI + 平滑收敛
  await shot(`web-ui-page-${uiPage}`);
  if (!keepOpen) {
    ws.close();
    cleanup();
    process.exit(0);
  }
} else if (everyS > 0) {
  for (let i = 1; i * everyS <= 120; i++) {
    await sleep(everyS * 1000);
    const info = await evaluate(`(() => {
      const inst = window.lfw || null;
      const pages = (() => { try { return JSON.stringify((inst.layers.bottom.pages || []).map(p => p.id)); } catch (e) { return '-'; } })();
      const res = performance.getEntriesByType('resource').filter(r => /\\.(zip|json)/.test(r.name)).map(r => r.name.split('/').pop() + ':' + Math.round(r.duration) + 'ms');
      const loading = !!document.querySelector('[class*=loading_img]');
      return JSON.stringify({ lfw: !!inst, pages, res, loading });
    })()`);
    console.log(`  t=${i * everyS}s  ${info}`);
    if (netLines.length) console.log(`       net: ${netLines.slice(-12).join("\n            ")}`);
    await dump_req_log(`t=${i * everyS}s`);
    await shot(`seq-${String(i * everyS).padStart(3, "0")}s`);
  }
} else {
  // 与 Godot 侧同名状态一一对应（README「开放模式现在能走到哪」里那条 `--click` + `--key` 脚本）：
  //   init → entry → main_page → stage_mode_prepare_page → 对局
  // Godot 那边是**定帧**驱动；Web 这边是真实时间（60FPS），所以用「轮询状态 + 等待」代替 `@frame`。
  const ui_id = "(() => { const i = window.lfw; return i && i.ui && i.ui.id ? String(i.ui.id) : ''; })()";

  async function wait_ui(want, timeoutMs, label) {
    const t0 = Date.now();
    let last = "";
    for (;;) {
      const v = await evaluate(ui_id);
      if (v === want) {
        console.log(`  [${label}] ui.id=${v}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
        return true;
      }
      if (v !== last) {
        console.log(`  [${label}] ui.id: ${last || "(空)"} → ${v || "(空)"}  t=${((Date.now() - t0) / 1000).toFixed(1)}s`);
        last = v;
      }
      if (Date.now() - t0 > timeoutMs) {
        console.log(`  ! [${label}] 超时 ${timeoutMs}ms（停在 ui.id="${v}"）`);
        return false;
      }
      await sleep(200);
    }
  }

  console.log("  等首页（`init`：启动页 + 点击提示）…");
  await wait_ui("init", 120000, "init");
  await sleep(2500); // 标题图 / 背景图解码 + 第一帧 UI
  await shot("web-init");

  // 逻辑像素（794x450）→ 页面像素：走 canvas 的 box（Web 侧也是 contain 缩放）。
  const box = JSON.parse(
    await evaluate(
      "(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return JSON.stringify({ l: r.left, t: r.top, w: r.width, h: r.height }); })()",
    ),
  );
  const at = (lx, ly) => [box.l + (lx * box.w) / 794, box.t + (ly * box.h) / 450];
  console.log(`  canvas box: ${box.w.toFixed(1)}x${box.h.toFixed(1)} @ ${box.l.toFixed(1)},${box.t.toFixed(1)}`);

  // 与 Godot 的 `--click '397,225@10'` 同一个点（画布中心 = 点击提示）。
  const [ex, ey] = at(397, 225);
  await click(ex, ey);
  // init 页点一下 ⇒ 进 Introduction 动画 ⇒（prel 装完 + 动画走完）自动 `set_page(entry)`。
  await wait_ui("entry", 120000, "entry");
  await sleep(1500);
  await shot("web-entry");

  // `j` → 游戏键 a：入口页 `btn_game_start` 自带 auto_focus ⇒ 直接 Game Start（装 data.zip，33MB）。
  await key("j", "KeyJ", 74);
  await wait_ui("main_page", 300000, "main_page");
  await sleep(1500);
  await shot("web-main-page");

  // 下面整段对齐 Godot 的键串（README「开放模式现在能走到哪」，`--key` 之间 20 帧 ≈ 350ms@60FPS）：
  //   `s`×3 换焦点（→ 闯关模式/Stage Mode）+ `j` ⇒ 八人框；`j` 连打 ⇒ 加入 + 倒计时收尾 + 选电脑人数；
  //   最后 `w w j` 命中 `btn_fight` 开打。
  const press = async (ch, code, vk) => {
    await key(ch, code, vk);
    await sleep(240);
  };
  const KEY = { j: ["KeyJ", 74], s: ["KeyS", 83], w: ["KeyW", 87] };
  const tap = (name) => press(name, KEY[name][0], KEY[name][1]);

  for (let i = 0; i < 3; i++) await tap("s");
  await tap("j");
  await wait_ui("stage_mode_prepare_page", 60000, "stage_prepare");
  await sleep(1200);
  await shot("web-stage-prepare");

  for (let i = 0; i < 40; i++) await tap("j");
  // 加入之后的那一档（= 宿主 `realkeys-vs-prepare.png`）：八人框里有玩家，头像 + 名字/角色/队伍
  // 三行文字都在 —— 对"头像 + 头像下方文字"这类只在**加入之后**才出现的东西，这是参照物。
  await shot("web-stage-prepare-joined");
  await tap("w");
  await tap("w");
  await tap("j");

  // 等到真对局：场上有实体（Godot 那边是 `--frames 1800` 那一拍）。
  console.log("  等对局（场上实体数 > 1）…");
  const t0 = Date.now();
  for (;;) {
    const n = await evaluate("(() => { const i = window.lfw; return i && i.world && i.world.entities ? i.world.entities.length : -1; })()");
    if (n > 1) {
      console.log(`  场上实体 ${n} 个（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
      break;
    }
    if (Date.now() - t0 > 90000) {
      console.log(`  ! 等对局超时（实体数 ${n}，ui.id=${await evaluate(ui_id)}）`);
      break;
    }
    await sleep(500);
  }
  await sleep(3000);
  await shot("web-match-running");
  console.log(`  提示：想继续观察，加 --keep-open；想按时连拍用 --every-s。`);
}

console.log(`web_shots: done（控制台 ${consoleLines.length} 行、异常 ${pageErrors.length} 条）`);
await dump_req_log("结束时");
for (const line of consoleLines.slice(-10)) console.log(`  c ${line}`);
for (const e of pageErrors.slice(0, 5)) console.log(`  ! ${e}`);
if (!keepOpen) {
  ws.close();
  cleanup();
  process.exit(0);
}
