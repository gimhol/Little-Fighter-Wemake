import { app, BrowserWindow, Menu, Tray, clipboard, dialog, ipcMain, nativeImage, shell } from "electron";
import { spawn } from "node:child_process";
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer as create_http_server } from "node:http";
import { createServer as create_net_server } from "node:net";
import { networkInterfaces } from "node:os";
import { dirname, basename, extname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import JSON5 from "json5";
import { load_tray_texts, normalize_lang, resolve_lang, tray_text } from "./tray_i18n.mjs";

const LOG_TAG = "[lfwm]";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_BRIDGE_PORT = 8066;
const DEFAULT_GAME_PORT = 8067;
const DEFAULT_SERVER_PORT = 8080;
const PORT_TRIES = 20;
const LOG_MAX_BYTES = 512 * 1024;
const WIDTH = 1191;
const HEIGHT = 675;
const MIN_WIDTH = 794;
const MIN_HEIGHT = 450;
const MODS_DIR_NAME = "mods";
const MODS_CONFIG_NAMES = ["mods.json5", "mods.json"];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".zip": "application/zip",
  ".wasm": "application/wasm",
  ".glsl": "text/plain; charset=utf-8",
};

const BRIDGE_ARGS = [
  "code", "room", "mode", "app-id", "access-key", "access-key-secret", "open-host",
  "sessdata", "uid", "join", "pick", "cheer", "leave", "join-cooldown",
];

const HELP_TEXT = `用法: start.exe [选项]

双击 start.exe 即单机运行；接直播时由直播姬 / 幻星互动以 start.exe code=<主播身份码> 拉起；
把 LF2 目录（或数据工具 conf 文件）拖到 start.exe 上则会打开数据工具开始转换。

窗口与托盘:
  顶部半透明条可拖动窗口（双击最大化/还原）；关闭窗口即退出
  托盘菜单可开关联机服务器、允许局域网连接、允许局域网访问游戏页面、复制地址、打开数据工具与数据目录

选项:
  code=<code> / --code <code>  主播身份码（通常由平台带入）
  --room <id>                  以 web 模式收指定直播间弹幕（本地调试免密钥）
  --host <host>                监听地址（默认 127.0.0.1）
  --port <port>                弹幕桥端口（默认 8066）
  --game-port <port>           游戏页面端口（默认 8067）
  --server                     启动时开启联机服务器（默认仅本机 127.0.0.1:8080）
  --server-port <port>         联机服务器起始端口（默认 8080，被占用时自动向后找）
  --server-lan                 联机服务器监听局域网
  --lang <code>                界面语言：默认用系统语言（游戏内切换时跟随），可固定为 zh-hans / zh-hant / en 等（语言文件放 langs/）
  --mods <目录>                额外模组目录（可再指向一个放 *.zip 的目录，比默认目录后加载 = 优先级更高）
  --no-mods                    不自动加载模组目录（排查问题时用）
  --tool <命令...>             参数原样交给数据工具，如 --tool help、--tool make-data-zip -c conf.json5
  --user-data <目录>           指定用户数据目录（多实例调试用）
  --debug                      打印弹幕事件日志
  --devtools                   打开开发者工具
  --screenshot <path>          启动后截取窗口画面为 PNG
  --help, -h                   显示本帮助

弹幕桥参数（也可写进同目录 danmu.json5；优先级 命令行 > 环境变量 > danmu.json5）:
  --mode <web|open>  --app-id <id>  --access-key <key>  --access-key-secret <sk>
  --sessdata <value>  --uid <id>
  --join <kw1,kw2>  --pick <kw=角色,...>  --cheer <kw1,kw2>  --leave <kw1,kw2>  --join-cooldown <ms>

模组:
  程序目录 mods/ 与 用户数据目录 mods/ 下的 *.zip 启动时自动加载（等同入口页「添加模组」）
  内含 index.json 的「自定义游戏包」zip 会当作自定义游戏包，整个游戏被替换
  目录里可放 mods.json5 控制顺序/禁用：{ order: ["a.zip"], disabled: ["b.zip"] }

更完整的说明见程序目录 help.md
`;

let app_dir = "";
let data_dir = "";
let win = null;
let bridge = null;
let bridge_port = DEFAULT_BRIDGE_PORT;
let tray = null;
let server_proc = null;
let game_server = null;
let closing = false;

const ARGS = parse_args(process.argv.slice(app.isPackaged ? 1 : 2));
const SERVER_STATE = { on: false, lan: false, base_port: DEFAULT_SERVER_PORT, port: DEFAULT_SERVER_PORT };
const GAME_STATE = { lan: false, host: DEFAULT_HOST, port: DEFAULT_GAME_PORT };
let APP_LANG = "";
let APP_LANG_FIXED = false;
const UPDATER_ENABLED = typeof __UPDATER__ === "boolean" && __UPDATER__;
const UPDATE_STATE = { phase: "idle", version: "", percent: 0, manual: false };
let updater = null;

if (typeof ARGS["user-data"] === "string") app.setPath("userData", resolve(ARGS["user-data"]));

function log(msg) {
  console.log(`${LOG_TAG} ${msg}`);
}

function setup_log(dir) {
  try {
    const file = join(dir, "logs.txt");
    if (existsSync(file) && statSync(file).size > LOG_MAX_BYTES) rmSync(file);
    const fmt = (v) => (typeof v === "string" ? v : v instanceof Error ? v.stack ?? v.message : (() => {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    })());
    for (const level of ["log", "warn", "error"]) {
      const origin = console[level].bind(console);
      console[level] = (...parts) => {
        try {
          appendFileSync(file, `${new Date().toLocaleTimeString("zh-CN", { hour12: false })} ${parts.map(fmt).join(" ")}\n`);
        } catch {
          void 0;
        }
        origin(...parts);
      };
    }
  } catch {
    void 0;
  }
}

function parse_args(argv) {
  const ret = {};
  for (let i = 0; i < argv.length; ++i) {
    const a = argv[i];
    const eq = /^(?:--)?([A-Za-z][\w-]*)=(.*)$/.exec(a);
    if (eq) {
      ret[eq[1].toLowerCase()] = eq[2];
      continue;
    }
    if (!a.startsWith("--")) continue;
    const key = a.slice(2).toLowerCase();
    const next = argv[i + 1];
    ret[key] = next && !next.startsWith("--") ? argv[++i] : true;
  }
  return ret;
}

function find_dropped_paths(argv) {
  const ret = [];
  for (let i = 0; i < argv.length; ++i) {
    const a = argv[i];
    if (/^(?:--?)?[A-Za-z][\w-]*=/.test(a)) continue;
    if (a.startsWith("-")) {
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) ++i;
      continue;
    }
    if (isAbsolute(a) && existsSync(a)) ret.push(a);
  }
  return ret;
}

function load_config(...paths) {
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      return JSON5.parse(readFileSync(p, "utf8")) ?? {};
    } catch (e) {
      console.warn(LOG_TAG, `配置文件解析失败: ${p}`, e.message);
      return {};
    }
  }
  return {};
}

/** 模组目录：目录下的 *.zip 启动时自动加载（在数据包之后加载，所以模组会覆盖本体数据） */
const MODS = { dirs: [], items: [] };

function to_name_list(v) {
  if (typeof v === "string") return [v];
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string");
}

/**
 * 扫描一个模组目录，返回要加载的 zip（按加载顺序）
 *
 * 目录里可放 mods.json5 / mods.json：
 * - `order`: 列出的按该顺序先加载（越靠后优先级越高），未列出的按文件名排在最后
 * - `disabled`: 不加载
 */
function scan_mods_dir(dir) {
  let names = [];
  try {
    names = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.zip$/i.test(e.name))
      .map((e) => e.name);
  } catch {
    return [];
  }
  if (!names.length) return [];
  const conf = load_config(...MODS_CONFIG_NAMES.map((n) => join(dir, n)));
  const disabled = new Set(to_name_list(conf.disabled).map((v) => v.toLowerCase()));
  const order = new Map(to_name_list(conf.order).map((v, i) => [v.toLowerCase(), i]));
  names = names.filter((v) => !disabled.has(v.toLowerCase()));
  const rank = (name) => order.get(name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
  names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return names.map((name) => {
    const path = join(dir, name);
    let size = 0;
    try {
      size = statSync(path).size;
    } catch {
      void 0;
    }
    return { id: path, name, dir, size };
  });
}

/** 收集模组目录：程序目录 > 用户数据目录 > `--mods` 指定的目录（越后面加载优先级越高） */
function setup_mods() {
  const dirs = [];
  if (ARGS["no-mods"] !== true) {
    dirs.push(join(data_dir, MODS_DIR_NAME));
    const user_dir = join(app.getPath("userData"), MODS_DIR_NAME);
    if (user_dir !== dirs[0]) dirs.push(user_dir);
    if (typeof ARGS.mods === "string") dirs.push(resolve(ARGS.mods));
  }
  MODS.dirs = dirs;
  for (const dir of dirs) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      void 0;
    }
  }
  MODS.items = dirs.flatMap((dir) => scan_mods_dir(dir));
  if (!dirs.length) log("模组: 已用 --no-mods 关闭自动加载");
  else if (!MODS.items.length) log(`模组: 未找到 zip（把模组包放进 ${dirs[0]} 即可自动加载）`);
  else log(`模组: 已加载 ${MODS.items.length} 个（${MODS.items.map((v) => v.name).join(", ")}）`);
}

function not_found(res) {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("not found");
}

function serve_file(req, res, dir, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  } catch {
    return not_found(res);
  }
  const target = rel === "" ? "index.html" : rel;
  const full = normalize(join(dir, target));
  if (full !== dir && !full.startsWith(dir + sep)) return not_found(res);
  let st;
  try {
    st = statSync(full);
  } catch {
    return not_found(res);
  }
  if (st.isDirectory()) return serve_file(req, res, dir, `${target.replace(/\/+$/, "")}/index.html`);
  const headers = {
    "content-type": MIME[extname(full).toLowerCase()] ?? "application/octet-stream",
    "cache-control": "no-cache",
    "accept-ranges": "bytes",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range) {
    const start = range[1] === "" ? st.size - Number(range[2]) : Number(range[1]);
    const end = range[2] === "" || range[1] === "" ? st.size - 1 : Number(range[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || end >= st.size) {
      res.writeHead(416, { "content-range": `bytes */${st.size}` });
      return res.end();
    }
    res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${st.size}`, "content-length": end - start + 1 });
    createReadStream(full, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, "content-length": st.size });
  createReadStream(full).pipe(res);
}

function make_game_server(dir) {
  return create_http_server((req, res) => {
    let pathname = "/";
    try {
      pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    } catch {
      return not_found(res);
    }
    serve_file(req, res, dir, pathname);
  });
}

function listen_server(server, host, port) {
  return new Promise((ok) => {
    server.once("error", (e) => ok(e.code === "EADDRINUSE" ? null : e));
    server.once("listening", () => ok(true));
    server.listen(port, host);
  });
}

async function listen_first_free(server, host, port) {
  for (let i = 0; i < PORT_TRIES; ++i) {
    const ret = await listen_server(server, host, port + i);
    if (ret === true) return server.address().port;
    if (ret instanceof Error) throw ret;
  }
  throw new Error(`端口 ${port}~${port + PORT_TRIES - 1} 全部被占用`);
}

function check_port_free(host, port) {
  return new Promise((ok) => {
    const server = create_net_server();
    server.once("error", (e) => ok(e.code === "EADDRINUSE" ? false : true));
    server.once("listening", () => server.close(() => ok(true)));
    server.listen(port, host);
  });
}

async function load_bridge() {
  for (const rel of ["bridge.bundle.mjs", "../index.mjs"]) {
    const file = join(app_dir, rel);
    if (!existsSync(file)) continue;
    return await import(pathToFileURL(file).href);
  }
  throw new Error("找不到弹幕桥代码（bridge.bundle.mjs）");
}

function lan_ip() {
  const skip_name = /wsl|vEthernet|hyper-v|vmware|virtualbox|virtual|tun|tap|docker|loopback|tailscale|zerotier|singbox/i;
  const all = [];
  const good = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    const skip = skip_name.test(name);
    for (const info of list ?? []) {
      if (info.family !== "IPv4" || info.internal) continue;
      if (/^169\.254\./.test(info.address)) continue;
      all.push(info.address);
      if (!skip && !/^192\.168\.56\./.test(info.address)) good.push(info.address);
    }
  }
  return (
    good.find((ip) => /^192\.168\./.test(ip)) ??
    good.find((ip) => /^10\./.test(ip)) ??
    good.find((ip) => /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) ??
    good[0] ??
    all[0] ??
    ""
  );
}

function server_addr() {
  const host = SERVER_STATE.lan ? lan_ip() || "0.0.0.0" : "127.0.0.1";
  return `${host}:${SERVER_STATE.port}`;
}

let starting_server = false;
async function start_server(lan) {
  if (server_proc || starting_server) return;
  const entry = join(app_dir, "server.bundle.cjs");
  if (!existsSync(entry)) {
    log("内置联机服务器不可用：安装包缺少 server.bundle.cjs");
    return;
  }
  SERVER_STATE.lan = !!lan;
  const host = SERVER_STATE.lan ? "0.0.0.0" : "127.0.0.1";
  starting_server = true;
  let port = 0;
  try {
    for (let i = 0; i < PORT_TRIES && !port; ++i) {
      if (await check_port_free(host, SERVER_STATE.base_port + i)) port = SERVER_STATE.base_port + i;
    }
  } catch (e) {
    log(`联机服务器启动失败：${e?.message ?? e}`);
    return;
  } finally {
    starting_server = false;
  }
  if (!port) {
    log(`联机服务器启动失败：端口 ${SERVER_STATE.base_port}~${SERVER_STATE.base_port + PORT_TRIES - 1} 全部被占用`);
    return;
  }
  if (port !== SERVER_STATE.base_port) log(`端口 ${SERVER_STATE.base_port} 被占用，联机服务器改用 ${port}`);
  SERVER_STATE.port = port;
  const child = spawn(process.execPath, [entry, "--port", String(port), "--host", host], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", RANKS_DIR: join(data_dir, "ranks") },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  server_proc = child;
  SERVER_STATE.on = true;
  child.stdout?.on("data", (d) => log(`[server] ${String(d).trimEnd()}`));
  child.stderr?.on("data", (d) => log(`[server] ${String(d).trimEnd()}`));
  child.on("exit", (code) => {
    if (server_proc !== child) return;
    server_proc = null;
    SERVER_STATE.on = false;
    log(`联机服务器已停止（退出码 ${code ?? 0}）`);
    refresh_tray();
  });
  log(`联机服务器已启动: ${server_addr()}${SERVER_STATE.lan ? "（局域网可连）" : "（仅本机）"}`);
  refresh_tray();
}

function stop_server() {
  const child = server_proc;
  if (!child) return;
  server_proc = null;
  SERVER_STATE.on = false;
  child.kill();
  refresh_tray();
}

function set_server_lan(lan) {
  if (!SERVER_STATE.on) {
    start_server(lan);
    return;
  }
  stop_server();
  setTimeout(() => start_server(lan), 300);
}

function game_page_host() {
  return GAME_STATE.lan ? "127.0.0.1" : GAME_STATE.host;
}

function game_page_addr(host) {
  return `http://${host}:${GAME_STATE.port}/`;
}

function game_page_url() {
  const page_host = game_page_host();
  const lan_host = GAME_STATE.lan ? lan_ip() : "";
  const ws = !bridge
    ? ""
    : bridge_port === DEFAULT_BRIDGE_PORT && page_host === "127.0.0.1" && !lan_host
      ? "1"
      : `ws://${lan_host || page_host}:${bridge_port}`;
  return `http://${page_host}:${GAME_STATE.port}/#/${ws ? `?DANMU_WS=${ws}` : ""}`;
}

async function set_game_lan(lan) {
  if (!game_server || lan === GAME_STATE.lan) return;
  const old_host = GAME_STATE.host;
  const old_port = GAME_STATE.port;
  try {
    await new Promise((ok) => {
      if (!game_server.listening) return ok();
      game_server.close(() => ok());
      game_server.closeAllConnections?.();
    });
    const port = await listen_first_free(game_server, lan ? "0.0.0.0" : "127.0.0.1", old_port);
    GAME_STATE.host = lan ? "0.0.0.0" : "127.0.0.1";
    GAME_STATE.lan = !!lan;
    GAME_STATE.port = port;
    if (lan) log(`游戏页面已允许局域网访问: ${game_page_addr(lan_ip() || "0.0.0.0")}`);
    else log(`游戏页面已恢复仅本机: ${game_page_addr("127.0.0.1")}`);
    if (win) await win.loadURL(game_page_url());
  } catch (e) {
    log(`切换游戏页面局域网访问失败：${e?.message ?? e}，尝试恢复原监听`);
    try {
      GAME_STATE.port = await listen_first_free(game_server, old_host, old_port);
    } catch (e2) {
      log(`恢复原监听失败：${e2?.message ?? e2}`);
    }
  }
  refresh_tray();
}

function open_tool_console(tool_args = []) {
  const dir = dirname(process.execPath);
  const exe = basename(process.execPath);
  const quoted_exe = /[\s"]/.test(exe) ? `"${exe}"` : exe;
  const batch = join(dir, "tools", "lfwm-console.cmd");
  const command = tool_args.length
    ? `cmd /k "${quoted_exe} --tool ${tool_args.map((p) => `"${p}"`).join(" ")}"`
    : existsSync(batch)
      ? `cmd /k "${batch}"`
      : `cmd /k ${quoted_exe} --tool help`;
  const line = `start "Little Fighter Wemake 数据工具" /D "${dir}" ${command}`;
  try {
    const child = spawn("cmd.exe", ["/c", line], { detached: true, stdio: "ignore", windowsVerbatimArguments: true });
    child.unref();
    return child;
  } catch (e) {
    console.warn(LOG_TAG, "打开数据工具失败", e);
  }
}

function updater_menu_items(t) {
  if (UPDATE_STATE.phase === "downloading") return [{ label: t("downloading_update", UPDATE_STATE.version, UPDATE_STATE.percent), enabled: false }];
  if (UPDATE_STATE.phase === "ready") return [{ label: t("restart_update", UPDATE_STATE.version), click: () => quit_and_install() }];
  if (UPDATE_STATE.phase === "checking") return [{ label: t("checking_update"), enabled: false }];
  return [{ label: t("check_update"), click: () => check_updates(true) }];
}

function check_updates(manual) {
  if (!updater || UPDATE_STATE.phase !== "idle") return;
  UPDATE_STATE.manual = !!manual;
  updater.checkForUpdates().catch((e) => console.warn(LOG_TAG, "检查更新失败", e));
}

function quit_and_install() {
  if (!updater) return;
  log("正在重启并安装更新");
  updater.quitAndInstall(true, true);
}

async function setup_updater() {
  const { autoUpdater } = await import("electron-updater");
  updater = autoUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.logger = {
    info: (...a) => log(a.map(String).join(" ")),
    warn: (...a) => log(a.map(String).join(" ")),
    error: (...a) => log(a.map(String).join(" ")),
    debug: () => void 0,
  };
  autoUpdater.on("checking-for-update", () => {
    UPDATE_STATE.phase = "checking";
    refresh_tray();
  });
  autoUpdater.on("update-available", (info) => {
    UPDATE_STATE.phase = "downloading";
    UPDATE_STATE.version = info.version;
    UPDATE_STATE.percent = 0;
    log(`发现新版本 ${info.version}，开始后台下载`);
    refresh_tray();
    if (UPDATE_STATE.manual) void dialog.showMessageBox({ type: "info", message: tray_text(APP_LANG, "update_found", info.version) });
  });
  autoUpdater.on("update-not-available", () => {
    UPDATE_STATE.phase = "idle";
    refresh_tray();
    if (UPDATE_STATE.manual) void dialog.showMessageBox({ type: "info", message: tray_text(APP_LANG, "up_to_date") });
    UPDATE_STATE.manual = false;
  });
  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.round(progress.percent);
    if (percent >= UPDATE_STATE.percent + 10 || percent === 100) {
      UPDATE_STATE.percent = percent;
      refresh_tray();
    }
  });
  autoUpdater.on("update-downloaded", (info) => {
    UPDATE_STATE.phase = "ready";
    UPDATE_STATE.version = info.version;
    UPDATE_STATE.percent = 100;
    log(`新版本 ${info.version} 已下载，等待重启安装`);
    refresh_tray();
    void dialog.showMessageBox({
      type: "info",
      message: tray_text(APP_LANG, "update_ready", info.version),
      buttons: [tray_text(APP_LANG, "restart_now"), tray_text(APP_LANG, "later")],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) quit_and_install();
    });
  });
  autoUpdater.on("error", (e) => {
    log(`检查更新失败: ${e?.message ?? e}`);
    UPDATE_STATE.phase = "idle";
    refresh_tray();
    if (UPDATE_STATE.manual) {
      UPDATE_STATE.manual = false;
      void dialog.showMessageBox({ type: "warning", message: tray_text(APP_LANG, "update_check_failed") });
    }
  });
  log(`更新检测: 已启用（当前 v${app.getVersion()}）`);
  setTimeout(() => check_updates(false), 6000);
  setInterval(() => check_updates(false), 3 * 60 * 60 * 1000);
}

function refresh_tray() {
  if (!tray) return;
  const t = (key, ...args) => tray_text(APP_LANG, key, ...args);
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: SERVER_STATE.on ? t("server_on", server_addr()) : t("server_off"),
      click: () => (SERVER_STATE.on ? stop_server() : start_server(SERVER_STATE.lan)),
    },
    {
      label: t("allow_lan"),
      type: "checkbox",
      checked: SERVER_STATE.lan,
      click: (item) => set_server_lan(!!item.checked),
    },
    {
      label: t("copy_server_addr"),
      enabled: SERVER_STATE.on,
      click: () => clipboard.writeText(server_addr()),
    },
    { type: "separator" },
    {
      label: t("allow_game_lan"),
      type: "checkbox",
      checked: GAME_STATE.lan,
      click: (item) => void set_game_lan(!!item.checked),
    },
    {
      label: t("copy_game_addr"),
      click: () => clipboard.writeText(game_page_addr(GAME_STATE.lan ? lan_ip() || "0.0.0.0" : "127.0.0.1")),
    },
    { type: "separator" },
    ...(UPDATER_ENABLED ? [...updater_menu_items(t), { type: "separator" }] : []),
    { label: t("open_tool"), click: () => open_tool_console() },
    { label: t("copy_tool_cmd"), click: () => clipboard.writeText(`"${process.execPath}" --tool `) },
    { label: t("open_data_dir"), click: () => void shell.openPath(data_dir) },
    { label: t("open_mods_dir", MODS.items.length), enabled: MODS.dirs.length > 0, click: () => void shell.openPath(MODS.dirs[0]) },
    { type: "separator" },
    { label: t("show_window"), click: () => { win?.show(); win?.focus(); } },
    { label: t("quit"), click: () => void shutdown("托盘退出") },
  ]));
}

function make_tray() {
  const icon_file = join(app_dir, "icon.ico");
  try {
    tray = new Tray(existsSync(icon_file) ? nativeImage.createFromPath(icon_file) : nativeImage.createEmpty());
  } catch (e) {
    console.warn(LOG_TAG, "托盘图标创建失败", e);
    tray = null;
    return;
  }
  tray.setToolTip("Little Fighter Wemake");
  tray.on("double-click", () => { win?.show(); win?.focus(); });
  refresh_tray();
}

function run_tool(tool_args) {
  const entry = join(app.getAppPath(), "tool.bundle.cjs");
  if (!existsSync(entry)) {
    console.error(`${LOG_TAG} 安装包里没有数据工具（tool.bundle.cjs）`);
    app.exit(1);
    return;
  }
  const child = spawn(process.execPath, [entry, ...tool_args], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "inherit",
  });
  child.on("exit", (code) => app.exit(code ?? 0));
}

async function shutdown(reason) {
  if (closing) return;
  closing = true;
  log(`正在关闭（${reason}）`);
  stop_server();
  try {
    await bridge?.stop_bridge?.();
  } catch (e) {
    console.warn(LOG_TAG, "关闭弹幕桥时出错", e);
  }
  app.exit(0);
}

async function main() {
  const args = ARGS;
  await app.whenReady();
  Menu.setApplicationMenu(null);
  app_dir = app.getAppPath();
  data_dir = app.isPackaged ? dirname(process.execPath) : app_dir;
  setup_log(data_dir);
  SERVER_STATE.base_port = Number(args["server-port"] ?? DEFAULT_SERVER_PORT);
  SERVER_STATE.port = SERVER_STATE.base_port;
  setup_mods();

  const game_dir = app.isPackaged ? join(process.resourcesPath, "game") : resolve(app_dir, "..", "..", "dist");
  if (!existsSync(join(game_dir, "index.html"))) {
    log(`找不到游戏文件（${join(game_dir, "index.html")}），安装包可能不完整`);
    app.exit(1);
    return;
  }

  const host = String(args.host ?? DEFAULT_HOST);
  bridge_port = Number(args.port ?? DEFAULT_BRIDGE_PORT);
  const game_port_want = Number(args["game-port"] ?? DEFAULT_GAME_PORT);

  if (!(await check_port_free(host, bridge_port))) {
    log(`端口 ${bridge_port} 已被占用：可能已经开着一个玩法（一个直播间同时只能开一个）`);
    app.exit(1);
    return;
  }

  const config_json5 = join(data_dir, "danmu.json5");
  const config_json = join(data_dir, "danmu.json");
  const conf = load_config(config_json5, config_json);
  const texts = load_tray_texts(join(data_dir, "langs"));
  const lang = resolve_lang(args.lang, app.getLocale());
  APP_LANG = lang.lang;
  APP_LANG_FIXED = lang.fixed;
  const code = typeof args.code === "string" ? args.code : String(conf.code ?? "");
  const room = typeof args.room === "string" ? args.room : String(conf.room ?? "");
  const creds_ready = !!conf.app_id && !!conf.access_key && !!conf.access_key_secret;

  log(`程序目录: ${data_dir}`);
  if (existsSync(config_json5) || existsSync(config_json))
    log(`配置: ${existsSync(config_json5) ? config_json5 : config_json}（应用密钥${creds_ready ? "已设置" : "未设置"}，身份码${code ? "已传入" : "未传入"}）`);
  log(`界面语言: ${APP_LANG_FIXED ? `固定为 ${APP_LANG || "en"}` : `启动用 ${APP_LANG || "en"}（游戏内切换时跟随）`}`);
  for (const e of texts.errors) log(`自定义文案读取失败：${e}`);
  if (texts.files) log(`自定义文案: langs/ 已加载 ${texts.files} 个文件（${texts.keys} 条）`);

  if (creds_ready && code || room || args.dry) {
    const bridge_args = [];
    if (existsSync(config_json5)) bridge_args.push("--config", config_json5);
    else if (existsSync(config_json)) bridge_args.push("--config", config_json);
    for (const key of BRIDGE_ARGS) {
      const v = args[key];
      if (v === void 0 || v === true) continue;
      bridge_args.push(`--${key}`, String(v));
    }
    bridge_args.push("--host", host, "--port", String(bridge_port), "--scores", join(data_dir, "scores.json"));
    if (args.debug) bridge_args.push("--debug");
    process.argv = [process.argv[0], join(data_dir, "start.exe"), ...bridge_args];
    bridge = await load_bridge();
  } else {
    log("未配置直播弹幕：以单机桌面模式启动（想接弹幕就填 danmu.json5 的应用密钥，或由直播姬带 code= 启动）");
  }

  game_server = make_game_server(game_dir);
  GAME_STATE.host = host;
  GAME_STATE.lan = host === "0.0.0.0" || host === "::";
  GAME_STATE.port = await listen_first_free(game_server, host, game_port_want);
  const page_url = game_page_url();

  log(`游戏页面: ${game_page_addr(game_page_host())}`);
  if (GAME_STATE.lan) log(`游戏页面（局域网）: ${game_page_addr(lan_ip() || "0.0.0.0")}`);
  if (bridge) {
    log(`弹幕桥: ws://${game_page_host()}:${bridge_port}（榜单页 http://${game_page_host()}:${bridge_port}/）`);
    if (GAME_STATE.lan) log(`弹幕桥（局域网）: ws://${lan_ip()}:${bridge_port}（榜单页 http://${lan_ip()}:${bridge_port}/）`);
  } else {
    log("弹幕桥: 未启动（单机模式不收弹幕；配好 danmu.json5 或带 code= / --room 启动后才会监听 8066）");
  }

  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    frame: false,
    backgroundColor: "#000000",
    title: "Little Fighter Wemake",
    webPreferences: {
      preload: join(app_dir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.once("ready-to-show", () => win?.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => void 0);
    return { action: "deny" };
  });
  win.on("maximize", () => win?.webContents.send("lfj:maximized", true));
  win.on("unmaximize", () => win?.webContents.send("lfj:maximized", false));
  await win.loadURL(page_url);

  make_tray();
  if (UPDATER_ENABLED) void setup_updater().catch((e) => console.warn(LOG_TAG, "更新模块初始化失败", e));
  if (args.server) start_server(args["server-lan"] === true);

  if (args.devtools) win.webContents.openDevTools({ mode: "detach" });

  if (args["shell-test"]) {
    setTimeout(async () => {
      const info = await win?.webContents.executeJavaScript(`(() => {
        const bar = document.querySelector('[class*=top_bar]');
        const drag = bar ? bar.querySelector('[class*=wails_drag]') : null;
        return JSON.stringify({
          runtime: typeof window.runtime,
          api: [typeof runtime?.WindowMinimise, typeof runtime?.WindowToggleMaximise, typeof runtime?.WindowIsMaximised, typeof runtime?.Quit],
          buttons: bar ? bar.querySelectorAll('button').length : -1,
          app_region: drag ? getComputedStyle(drag).webkitAppRegion : null,
        });
      })()`);
      log(`shell-test renderer: ${info}`);
      log(`shell-test window: ${JSON.stringify(win?.getBounds())}`);
      win?.maximize();
      log(`shell-test maximize -> ${win?.isMaximized()}`);
      win?.unmaximize();
      log(`shell-test unmaximize -> ${win?.isMaximized()}`);
      win?.minimize();
      log(`shell-test minimize -> ${win?.isMinimized()}`);
      win?.restore();
      log("shell-test 点击右上角关闭按钮");
      await win?.webContents.executeJavaScript(`(() => {
        const bar = document.querySelector('[class*=top_bar]');
        const btns = bar ? Array.from(bar.querySelectorAll('button')) : [];
        const last = btns[btns.length - 1];
        if (last) last.click();
        return btns.length;
      })()`);
    }, Number(args["shell-test-delay"] ?? 5000));
  }

  if (typeof args.screenshot === "string") {
    const out = resolve(args.screenshot);
    setTimeout(async () => {
      try {
        const image = await win?.webContents.capturePage();
        if (image) {
          writeFileSync(out, image.toPNG());
          log(`截图已保存: ${out}`);
        }
      } catch (e) {
        console.warn(LOG_TAG, "截图失败", e);
      }
    }, Number(args["screenshot-delay"] ?? 6000));
  }
}

const win_of = (event) => BrowserWindow.fromWebContents(event.sender);

ipcMain.on("lfj:minimize", (e) => win_of(e)?.minimize());
ipcMain.on("lfj:toggle-maximize", (e) => {
  const w = win_of(e);
  if (!w) return;
  if (w.isMaximized()) w.unmaximize();
  else w.maximize();
});
ipcMain.handle("lfj:is-maximized", (e) => win_of(e)?.isMaximized() ?? false);
ipcMain.handle("lfj:is-fullscreen", (e) => win_of(e)?.isFullScreen() ?? false);

/** 模组目录里待加载的 zip（游戏页面启动时来取；见 src/desktop_mods.ts） */
ipcMain.handle("lfwm:mods", () => ({
  dirs: MODS.dirs,
  items: MODS.items.map(({ id, name, dir, size }) => ({ id, name, dir, size })),
}));
ipcMain.handle("lfwm:mod", (_e, id) => {
  const item = MODS.items.find((v) => v.id === id);
  if (!item) return null;
  try {
    const data = readFileSync(item.id);
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } catch (e) {
    console.warn(LOG_TAG, `模组读取失败: ${item.id}`, e);
    return null;
  }
});
ipcMain.on("lfj:fullscreen", (e, on) => win_of(e)?.setFullScreen(!!on));
ipcMain.on("lfj:quit", () => void shutdown("点击关闭按钮"));
ipcMain.on("lfj:lang", (_e, lang) => {
  if (APP_LANG_FIXED) return;
  const next = normalize_lang(lang);
  if (next === APP_LANG) return;
  APP_LANG = next;
  refresh_tray();
});

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.setAppUserModelId("ink.gim.lfwm");
app.on("window-all-closed", () => void shutdown("游戏窗口已关闭"));
app.on("second-instance", () => {
  win?.restore();
  win?.focus();
});
process.on("SIGTERM", () => void shutdown("SIGTERM"));

const TOOL_FLAG_INDEX = process.argv.indexOf("--tool");
const HELP_FLAG = process.argv.slice(app.isPackaged ? 1 : 2).some((a) => a === "--help" || a === "-h");
const DROPPED_PATHS = find_dropped_paths(process.argv.slice(app.isPackaged ? 1 : 2));
if (TOOL_FLAG_INDEX >= 0) run_tool(process.argv.slice(TOOL_FLAG_INDEX + 1));
else if (HELP_FLAG) {
  app.whenReady().then(() => {
    console.log(HELP_TEXT);
    app.exit(0);
  });
} else if (DROPPED_PATHS.length) {
  const child = open_tool_console(DROPPED_PATHS);
  if (child) {
    child.once("spawn", () => app.exit(0));
    child.once("error", () => app.exit(0));
  } else {
    app.exit(0);
  }
} else if (!app.requestSingleInstanceLock()) app.quit();
else void main().catch((e) => {
  console.error(LOG_TAG, "启动失败", e);
  app.exit(1);
});