import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const APP_NAME = "Little Fighter Wemake";
export const DIST = join(ROOT, "dist");
export const BRIDGE = join(ROOT, "desktop");
export const APP_SRC = join(BRIDGE, "app");
export const ICON = join(ROOT, "public", "favicon.ico");
const CREATE_REQUIRE_BANNER = 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);';

const TOOL_CONSOLE_CMD = `@echo off
cd /d "%~dp0.."
echo Little Fighter Wemake - data tool
echo.
"%~dp0..\\start.exe" --tool help
echo.
echo Examples:
echo   start.exe --tool make-data-zip -c conf.json5
echo   start.exe --tool make-data
echo.
echo Working directory: %CD%
`;

const README_TEXT = `Little Fighter Wemake 桌面客户端

怎么用
- 直接双击 start.exe 就是游戏本体；不接直播时以单机模式运行
- 接直播弹幕：在直播姬 / 幻星互动里启动本玩法即可，身份码由平台通过 start.exe code=xxxx 传入
- 本地调试：在本目录打开 cmd，执行  start.exe code=你的主播身份码，或 start.exe --room 12345（web 模式，免密钥）
- 拖拽转换：把 LF2 目录（或 conf 文件）拖到 start.exe 上，会自动开数据工具控制台并按拖入路径开始转换

窗口
- 没有系统标题栏：按住画面上方那条半透明区域可以拖动窗口，双击该区域可最大化/还原
- 右上角按钮依次是：最小化、最大化/还原、全屏、关闭
- 关闭窗口即整个程序退出（一个直播间同时只能开启一个玩法）

配置
- danmu.json5 里的 app_id / access_key / access_key_secret 是该玩法的开平应用密钥
- 游戏文件、弹幕桥、联机服务器存档（ranks/）、战绩存档（scores.json）、运行日志（logs.txt）都在本目录
- 完整命令行、danmu.json5 字段说明与常见问题见 help.md
- 命令行参数（均可用环境变量或 danmu.json5 代替）
  code / --room / --port / --game-port / --host / --lang / --server / --server-port / --server-lan / --tool / --user-data / --debug / --devtools / --help

托盘（任务栏右下角图标）
- 开启/关闭联机服务器：默认只监听本机 127.0.0.1:8080（被占用时自动向后找空闲端口）
- 勾选「允许局域网连接」后，同一网络下的其他人可以用「复制联机地址」得到的地址连你
- 菜单语言：启动用系统语言，游戏内切换时跟随；想固定用 --lang 指定；自定义文案放 langs\\ 目录（见 langs\\README.txt）
- 打开数据工具（命令行）：在本目录开一个控制台窗口（tools\\lfwm-console.cmd），里面会直接列出全部命令，
  光标已经停在本目录，直接敲  start.exe --tool make-data-zip -c conf.json5  就可以跑（无需另装 Node）
- 自动更新（仅安装版）：启动后自动检查，新版本会在后台下载，完成后按提示重启即可

转换器
- 数据转换用的 ffmpeg 与 magick 已随包附带（tools\\ 目录），数据工具会优先用它们，命令行里不用再装
- 想用自己那一份：在数据工具的配置里改 FFMPEG_CMD / MAGICK_CMD，或把 tools\\ 删掉改用 PATH 里的
`;

let PREFIX = "[desktop]";

export function set_prefix(prefix) {
  PREFIX = prefix;
}

export function step(msg) {
  console.log(`${PREFIX} ${msg}`);
}

export function fail(msg) {
  console.error(`${PREFIX} ${msg}`);
  process.exit(1);
}

export function read_pkg() {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
}

export function electron_version(pkg) {
  return String(pkg.devDependencies?.electron ?? pkg.dependencies?.electron ?? "").replace(/^[^\d]*/, "");
}

export function check_build_tools() {
  if (!existsSync(join(ROOT, "node_modules", "esbuild", "bin", "esbuild")))
    fail("根目录缺少 esbuild（先执行 npm i）");
  if (![join(ROOT, "node_modules", "ws"), join(ROOT, "desktop", "node_modules", "ws")].some((p) => existsSync(p)))
    fail("找不到 ws（根目录执行 npm i，或在 desktop 目录执行 npm i）");
  if (![join(ROOT, "server", "node_modules", "arg"), join(ROOT, "server", "node_modules", "dotenv")].every((p) => existsSync(p)))
    fail("缺少 server 依赖（先执行：cd server && npm i）");
}

export function quote(v) {
  return /[\s"]/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v;
}

function run_esbuild(entry, outfile, format, extra = []) {
  execFileSync(process.execPath, [
    join(ROOT, "node_modules", "esbuild", "bin", "esbuild"),
    entry,
    "--bundle",
    "--platform=node",
    `--format=${format}`,
    "--target=node22",
    ...extra,
    `--outfile=${outfile}`,
  ], { stdio: "inherit", cwd: ROOT });
}

export function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    out.push(full);
    if (statSync(full).isDirectory()) walk(full, out);
  }
  return out;
}

export function dir_size(dir) {
  return walk(dir).reduce((sum, f) => sum + (statSync(f).isFile() ? statSync(f).size : 0), 0);
}

export function find_converter(cmd, env_key) {
  const override = process.env[env_key];
  if (override) {
    const p = resolve(ROOT, override);
    if (existsSync(p)) return p;
    fail(`${env_key}=${override} 找不到文件`);
  }
  try {
    return execFileSync("where", [cmd], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] ?? "";
  } catch {
    return "";
  }
}

export function stage_app(app_dir, pkg, { updater = false } = {}) {
  writeFileSync(join(app_dir, "package.json"), `${JSON.stringify({
    name: "little-fighter-wemake",
    productName: APP_NAME,
    version: pkg.version,
    description: "Little Fighter Wemake desktop client",
    author: pkg.author?.name ?? "Gim",
    license: "UNLICENSED",
    private: true,
    type: "module",
    main: "main.mjs",
  }, null, 2)}\n`);
  copyFileSync(join(APP_SRC, "preload.cjs"), join(app_dir, "preload.cjs"));

  step("打包弹幕桥（esbuild bridge）");
  run_esbuild(join(BRIDGE, "index.mjs"), join(app_dir, "bridge.bundle.mjs"), "esm", [`--banner:js=${CREATE_REQUIRE_BANNER}`]);
  step("打包主进程（esbuild main）");
  const main_flags = ["--external:electron", `--define:__UPDATER__=${updater}`];
  if (updater) main_flags.push(`--banner:js=${CREATE_REQUIRE_BANNER}`);
  else main_flags.push("--alias:electron-updater=./scripts/updater-stub.mjs");
  run_esbuild(join(APP_SRC, "main.mjs"), join(app_dir, "main.mjs"), "esm", main_flags);
  step("打包内置联机服务器（esbuild server）");
  run_esbuild(join(ROOT, "server", "src", "index.ts"), join(app_dir, "server.bundle.cjs"), "cjs");
  step("打包数据工具（esbuild tool）");
  run_esbuild(join(ROOT, "tool", "src", "index.ts"), join(app_dir, "tool.bundle.cjs"), "cjs");
  copyFileSync(ICON, join(app_dir, "icon.ico"));
  if (!existsSync(join(app_dir, "main.mjs")) || !existsSync(join(app_dir, "bridge.bundle.mjs")))
    fail("主进程/弹幕桥打包失败");
  if (!existsSync(join(app_dir, "server.bundle.cjs")) || !existsSync(join(app_dir, "tool.bundle.cjs")))
    fail("服务器/数据工具打包失败");
}

export function stage_game(game_dir) {
  cpSync(DIST, game_dir, { recursive: true });
  rmSync(join(game_dir, "lfw.full.zip"), { force: true });
}

export function stage_extra(extra_dir, { converters = true } = {}) {
  const TOOLS = join(extra_dir, "tools");
  mkdirSync(TOOLS, { recursive: true });
  writeFileSync(join(TOOLS, "lfwm-console.cmd"), TOOL_CONSOLE_CMD.replace(/\n/g, "\r\n"));

  if (converters) {
    const ffmpeg = find_converter("ffmpeg", "FFMPEG_PATH");
    if (!ffmpeg) fail("找不到 ffmpeg（可用 FFMPEG_PATH=<路径> 指定，或加 --no-converters 不打进包里）");
    const magick = find_converter("magick", "MAGICK_PATH");
    if (!magick) fail("找不到 magick（可用 MAGICK_PATH=<路径> 指定，或加 --no-converters 不打进包里）");
    cpSync(ffmpeg, join(TOOLS, "ffmpeg.exe"));
    const im_dir = dirname(magick);
    const IM_SKIP = new Set(["unins000.exe", "unins000.dat", "uninstall", "www", "index.html", "ImageMagick.ico"]);
    for (const name of readdirSync(im_dir)) {
      if (IM_SKIP.has(name)) continue;
      cpSync(join(im_dir, name), join(TOOLS, name), { recursive: true });
    }
    step(`内置转换器: ffmpeg（${relative(ROOT, ffmpeg)}）+ magick（${im_dir}），tools 目录 ${(dir_size(TOOLS) / 1024 / 1024).toFixed(1)} MB`);
  }

  const conf_src = process.env.PLAYABLE_CONFIG
    ? resolve(ROOT, process.env.PLAYABLE_CONFIG)
    : [join(BRIDGE, "danmu.json5"), join(BRIDGE, "danmu.json")].find((p) => existsSync(p));
  if (conf_src && existsSync(conf_src)) {
    copyFileSync(conf_src, join(extra_dir, "danmu.json5"));
    const raw = readFileSync(conf_src, "utf8");
    const ready = /app_id\s*:\s*["']\S/.test(raw) && /access_key?\s*:\s*["']\S/.test(raw);
    step(`内置配置文件: ${relative(ROOT, conf_src)}${ready ? "" : "（app_id/access_key 看起来还是空的，上传前记得补）"}`);
  } else {
    copyFileSync(join(BRIDGE, "danmu.example.json5"), join(extra_dir, "danmu.json5"));
    step("未找到 desktop/danmu.json5，已放入 danmu.example.json5 作为默认配置（应用密钥为空，上传前请填写）");
  }
  writeFileSync(join(extra_dir, "readme.txt"), README_TEXT);
  copyFileSync(join(BRIDGE, "help.md"), join(extra_dir, "help.md"));
  mkdirSync(join(extra_dir, "langs"), { recursive: true });
  copyFileSync(join(BRIDGE, "langs", "README.txt"), join(extra_dir, "langs", "README.txt"));
}
