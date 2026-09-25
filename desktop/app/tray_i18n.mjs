import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import JSON5 from "json5";

const DICT = {
  "": {
    server_on: "Multiplayer server: on (%1)",
    server_off: "Start multiplayer server",
    allow_lan: "Allow LAN connections",
    copy_server_addr: "Copy server address",
    allow_game_lan: "Allow LAN access to the game page",
    copy_game_addr: "Copy game page address",
    open_tool: "Open data tool (console)",
    copy_tool_cmd: "Copy data tool command",
    open_data_dir: "Open data folder",
    open_mods_dir: "Open mods folder (%1)",
    show_window: "Show game window",
    quit: "Quit",
    check_update: "Check for updates",
    checking_update: "Checking for updates…",
    downloading_update: "Downloading %1 (%2%)",
    update_found: "New version %1 found, downloading in background",
    update_ready: "Version %1 has been downloaded. It will apply after restart.",
    restart_update: "Restart and update to %1",
    up_to_date: "You're up to date",
    update_check_failed: "Update check failed",
    restart_now: "Restart now",
    later: "Later",
  },
  "zh-hans": {
    server_on: "联机服务器：已开启（%1）",
    server_off: "开启联机服务器",
    allow_lan: "允许局域网连接",
    copy_server_addr: "复制联机地址",
    allow_game_lan: "允许局域网访问游戏页面",
    copy_game_addr: "复制游戏页面地址",
    open_tool: "打开数据工具（命令行）",
    copy_tool_cmd: "复制数据工具命令",
    open_data_dir: "打开数据目录",
    open_mods_dir: "打开模组目录（%1）",
    show_window: "显示游戏窗口",
    quit: "退出",
    check_update: "检查更新",
    checking_update: "正在检查更新…",
    downloading_update: "正在下载新版本 %1（%2%）",
    update_found: "发现新版本 %1，正在后台下载",
    update_ready: "新版本 %1 已下载，重启后生效",
    restart_update: "重启并更新到 %1",
    up_to_date: "已是最新版本",
    update_check_failed: "检查更新失败",
    restart_now: "立即重启",
    later: "稍后",
  },
  "zh-hant": {
    server_on: "連線伺服器：已開啟（%1）",
    server_off: "開啟連線伺服器",
    allow_lan: "允許區域網路連線",
    copy_server_addr: "複製連線位址",
    allow_game_lan: "允許區域網路存取遊戲頁面",
    copy_game_addr: "複製遊戲頁面位址",
    open_tool: "開啟資料工具（命令列）",
    copy_tool_cmd: "複製資料工具命令",
    open_data_dir: "開啟資料目錄",
    open_mods_dir: "開啟模組目錄（%1）",
    show_window: "顯示遊戲視窗",
    quit: "關閉",
    check_update: "檢查更新",
    checking_update: "正在檢查更新…",
    downloading_update: "正在下載新版本 %1（%2%）",
    update_found: "發現新版本 %1，正在背景下載",
    update_ready: "新版本 %1 已下載，重新啟動後生效",
    restart_update: "重新啟動並更新至 %1",
    up_to_date: "已是最新版本",
    update_check_failed: "檢查更新失敗",
    restart_now: "立即重新啟動",
    later: "稍後",
  },
};

const ZH_HANT = new Set(["zh-hant", "zh-tw", "zh-hk", "zh-mo"]);

export function normalize_lang(lang) {
  const v = String(lang ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v.startsWith("zh")) return ZH_HANT.has(v) ? "zh-hant" : "zh-hans";
  if (v === "en" || v.startsWith("en-")) return "";
  const dash = v.indexOf("-");
  return dash < 0 ? v : v.slice(0, dash);
}

/**
 * 解析界面语言：命令行 > 系统语言（游戏内切换语言时托盘会跟随）
 * 返回 { lang, fixed }：fixed 为 true 时忽略游戏上报的语言
 */
export function resolve_lang(cli, locale) {
  const v = String(cli ?? "").trim().toLowerCase();
  if (!v || v === "auto") return { lang: normalize_lang(locale), fixed: false };
  return { lang: normalize_lang(v), fixed: true };
}

/**
 * 加载目录下的自定义文案：<语言码>.json5 / .json，每个文件是一个 { 键: 文案 } 对象
 * 覆盖或补充内置字典；%1/%2… 插值由 tray_text 处理
 */
export function load_tray_texts(dir) {
  const ret = { files: 0, keys: 0, errors: [] };
  let names;
  try {
    names = readdirSync(dir).sort();
  } catch {
    return ret;
  }
  for (const name of names) {
    const ext = extname(name).toLowerCase();
    if (ext !== ".json5" && ext !== ".json") continue;
    let obj;
    try {
      obj = JSON5.parse(readFileSync(join(dir, name), "utf8").replace(/^\uFEFF/, ""));
    } catch (e) {
      ret.errors.push(`${name}: ${e?.message ?? e}`);
      continue;
    }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      ret.errors.push(`${name}: 内容应为一个对象`);
      continue;
    }
    const code = normalize_lang(name.slice(0, -ext.length));
    const dst = DICT[code] ?? (DICT[code] = {});
    ret.files++;
    for (const key in obj) {
      const v = obj[key];
      if (typeof v !== "string") continue;
      dst[key] = v;
      ret.keys++;
    }
  }
  return ret;
}

export function tray_text(lang, key, ...args) {
  const table = DICT[normalize_lang(lang)] ?? DICT[""];
  let v = table[key] ?? DICT[""][key] ?? key;
  if (typeof v !== "string") return key;
  for (let i = 0; i < args.length; ++i) v = v.split(`%${i + 1}`).join(String(args[i]));
  return v;
}
