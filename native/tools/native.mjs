#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const NATIVE = resolve(HERE, "..");
const REPO = resolve(NATIVE, "..");
const BUILD_DIR = join(NATIVE, "build", "msvc-x64");

const GODOT_PROJECT = join(NATIVE, "host", "godot", "project");
const GODOT_BUILD_DIR = join(NATIVE, "build", "godot");
const HOST_DATA = join(NATIVE, "build", "host-data");

// IntelliSense（`.vscode/c_cpp_properties.json` 的 `compileCommands`）用的**合并**编译数据库。
// 两份库覆盖的翻译单元不一样：`msvc-x64` 那份有 `native/lfw` + `tests` + `host/`（godot 除外），
// godot 那份多出 `native/host/godot/**` —— 而 C/C++ 扩展一次只认**一份**库。
// 合并规则：core 的条目优先。这样 `native/lfw/**` 在编辑器里也永远看不到 godot-cpp 的 include
// 路径（DESIGN §G8 的硬规则），`native/host/godot/**` 又拿得到真正的构建参数。
const CC_CORE_DB = join(BUILD_DIR, "compile_commands.json");
const CC_GODOT_DB = join(GODOT_BUILD_DIR, "compile_commands.json");
const CC_MERGED_DB = join(NATIVE, "build", "compile_commands.json");

const GEN_DIR = join(NATIVE, "build", "gen");

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function findVs() {
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const vswhere = join(pf86, "Microsoft Visual Studio", "Installer", "vswhere.exe");
  if (!existsSync(vswhere)) return null;
  try {
    const out = execFileSync(vswhere, ["-latest", "-products", "*", "-property", "installationPath"], {
      encoding: "utf8",
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

let hasOnPathMemo = new Map();
function hasOnPath(exe) {
  if (!hasOnPathMemo.has(exe)) {
    hasOnPathMemo.set(exe, spawnSync("where", [exe], { stdio: "ignore" }).status === 0);
  }
  return hasOnPathMemo.get(exe);
}

const VSENV_CACHE = join(GEN_DIR, "vsenv.json");
let vsenvMemo = null;

function vsTools() {
  if (vsenvMemo && vsenvMemo.tools) return vsenvMemo.tools;
  const vs = findVs();
  if (!vs) return null;
  const vcvars = join(vs, "VC", "Auxiliary", "Build", "vcvars64.bat");
  if (!existsSync(vcvars)) return null;
  const cmakeBin = join(vs, "Common7", "IDE", "CommonExtensions", "Microsoft", "CMake", "CMake", "bin");
  const ninjaBin = join(vs, "Common7", "IDE", "CommonExtensions", "Microsoft", "CMake", "Ninja");
  const extra = [];
  let cmakeExe = "cmake";
  if (!hasOnPath("cmake")) {
    cmakeExe = join(cmakeBin, "cmake.exe");
    extra.push(cmakeBin);
  }
  if (!hasOnPath("ninja") && existsSync(ninjaBin)) extra.push(ninjaBin);
  return { vcvars, cmakeExe, extra };
}

function vsEnv() {
  if (vsenvMemo && vsenvMemo.env) return vsenvMemo.env;
  const tools = vsTools();
  if (!tools) return process.env;

  const mtimeMs = statSync(tools.vcvars).mtimeMs;
  if (existsSync(VSENV_CACHE)) {
    try {
      const cached = JSON.parse(readFileSync(VSENV_CACHE, "utf8"));
      if (cached.vcvars === tools.vcvars && cached.mtimeMs === mtimeMs) {
        vsenvMemo = { tools, env: applyExtra(cached.env, tools.extra) };
        return vsenvMemo.env;
      }
    } catch {
      /* regenerate below */
    }
  }

  mkdirSync(GEN_DIR, { recursive: true });
  const capture = join(GEN_DIR, "capture-env.cmd");
  writeFileSync(capture, `@echo off\r\ncall "${tools.vcvars}" >nul\r\nset\r\nexit /b 0\r\n`);
  const out = execFileSync("cmd.exe", ["/d", "/c", capture], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const env = { ...process.env };
  for (const line of out.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    env[line.slice(0, i)] = line.slice(i + 1);
  }
  writeFileSync(VSENV_CACHE, JSON.stringify({ vcvars: tools.vcvars, mtimeMs, env }));
  vsenvMemo = { tools, env: applyExtra(env, tools.extra) };
  return vsenvMemo.env;
}

function applyExtra(env, extra) {
  if (!extra.length) return env;
  const key = Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "Path";
  return { ...env, [key]: `${extra.join(";")};${env[key] ?? ""}` };
}

function runCmake(args) {
  const tools = vsTools();
  if (!tools) {
    console.error(C.red("Visual Studio not found (vswhere returned nothing)"));
    return 1;
  }
  return spawnSync(tools.cmakeExe, args, { stdio: "inherit", env: vsEnv() }).status ?? 1;
}

const BIN = join(BUILD_DIR, "bin");

function step(name, fn) {
  console.log("");
  console.log(C.bold(`> ${name}`));
  const code = fn();
  if (code !== 0) {
    console.error(C.red(`x ${name} failed (exit ${code})`));
    process.exit(code);
  }
  console.log(C.green(`v ${name}`));
}

function readCompileDb(path) {
  if (!existsSync(path)) return null;
  try {
    const rows = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

// 只要**本仓库、且不在 `build/` 下**的翻译单元：godot 那份库里还有 godot-cpp 自己的上千条源码
// （在 `build/godot/host/godot/godot-cpp/**`），编辑器用不上，只会让文件大几倍。
function isEditorRelevant(file) {
  const f = file.replace(/\//g, "\\").toLowerCase();
  return f.startsWith(`${NATIVE.toLowerCase()}\\`) && !f.startsWith(`${join(NATIVE, "build").toLowerCase()}\\`);
}

// CMake 3.25+ 的 MSVC 生成器把 godot-cpp 的路径标成 `-external:I<dir>`（`/external:I` 的连字符写法，
// 语义只是"把这份头文件的警告降级"）。C/C++ 扩展对它的解析不稳 —— 不认识的开关会被整条丢掉 ⇒
// 又回到"cannot open source file godot_cpp/classes/…"。合并时降级成普通 `-I`：include 解析一致，
// 差别只在 external 警告等级（编辑器不编代码，无所谓）。
function normalizeExternalFlags(row) {
  if (typeof row.command !== "string") return row;
  if (!row.command.includes("-external:") && !row.command.includes("/external:")) return row;
  const command = row.command
    .replace(/-external:I/g, "-I")
    .replace(/\/external:I/g, "-I")
    .replace(/\s[-\/]external:W\d+/g, "");
  return { ...row, command };
}

// 头文件自己不会出现在库里（没人单独编它），但 C/C++ 扩展是**按"编辑器里打开的那个文件"**查条目的：
// 头文件查不到 ⇒ 退回 `includePath`/`defines`（godot 宿主那半边就又缺 godot-cpp 了，用户报的就是
// `lfw_godot_textures.h` 里的 `<godot_cpp/classes/image_texture.hpp>`）。
// 所以给每个头文件补一条：拿**同目录**（没有就沿父目录往上找，不出 `native/`）里某个源文件的
// 命令行，把输入文件那个 token 换成这个头。flags 逐字照抄 ⇒ core 的头拿 core 的 flags，
// godot 的头拿 godot 的（含 `-I…godot-cpp/gen/include`）。
function listHeaderFiles(dir = NATIVE, acc = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "build" || ent.name === ".git") continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) listHeaderFiles(full, acc);
    else if (/\.(h|hpp)$/i.test(ent.name)) acc.push(full);
  }
  return acc;
}

function templateFor(dir, byDir) {
  const stop = NATIVE.toLowerCase();
  for (let d = dir; d.toLowerCase().startsWith(stop); d = dirname(d)) {
    const tmpl = byDir.get(d.replace(/\//g, "\\").toLowerCase());
    if (tmpl) return tmpl;
  }
  return null;
}

function addHeaderEntries(merged) {
  const byDir = new Map();
  for (const row of merged.values()) {
    if (!/\.(c|cc|cpp|cxx)$/i.test(row.file)) continue;
    const dir = dirname(row.file.replace(/\//g, "\\")).toLowerCase();
    if (!byDir.has(dir)) byDir.set(dir, row);
  }
  let added = 0;
  for (const file of listHeaderFiles()) {
    const key = file.replace(/\//g, "\\").toLowerCase();
    if (merged.has(key)) continue;
    const tmpl = templateFor(dirname(file), byDir);
    if (!tmpl || typeof tmpl.command !== "string") continue;
    merged.set(key, { directory: tmpl.directory, file, command: tmpl.command.replace(tmpl.file, () => file) });
    added += 1;
  }
  return added;
}

// 合并两份库；两份都不在（还没 configure 过）时返回 null。
function mergeCompileDb() {
  const merged = new Map();
  for (const rows of [readCompileDb(CC_GODOT_DB), readCompileDb(CC_CORE_DB)]) {
    for (const row of rows ?? []) {
      if (!row?.file || !isEditorRelevant(row.file)) continue;
      merged.set(row.file.replace(/\//g, "\\").toLowerCase(), normalizeExternalFlags(row)); // 后写的赢 ⇒ core 优先
    }
  }
  if (merged.size === 0) return null;
  const headers = addHeaderEntries(merged);
  const out = [...merged.values()].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  writeFileSync(CC_MERGED_DB, `${JSON.stringify(out, null, 1)}\n`);
  return {
    count: out.length,
    headers,
    host: out.filter((r) => /host[\\/]godot/i.test(r.file)).length,
  };
}

function writeIntellisenseDb() {
  const r = mergeCompileDb();
  if (!r) {
    console.log(C.dim(`  IntelliSense：两份编译数据库都没有，先跑 configure`));
    return 0;
  }
  console.log(
    C.dim(
      `  IntelliSense -> ${CC_MERGED_DB}（${r.count} 条：源文件 + ${r.headers} 个头文件，其中 host/godot ${r.host}）`,
    ),
  );
  return 0;
}

function cmdIntellisense() {
  return writeIntellisenseDb();
}

function cmdConfigure() {
  const stamp = join(BUILD_DIR, "compile_commands.json");
  if (existsSync(BUILD_DIR) && existsSync(stamp)) {
    console.log(C.dim(`  ${BUILD_DIR} exists, skipping`));
    writeIntellisenseDb();
    return 0;
  }
  const code = runCmake([
    "-S",
    NATIVE,
    "-B",
    BUILD_DIR,
    "-G",
    "Ninja",
    "-DCMAKE_BUILD_TYPE=Release",
    // 显式钉住 MSVC：`vsTools()` 为了找 ninja 会把 msys64\mingw64\bin 塞到 PATH 最前，
    // 于是 CMake 的自动探测会挑上 `c++.exe`（g++），静默换掉整条工具链
    // （`.obj` 还是 g++ 编的、`/showIncludes` 依赖全丢）。目录名 `msvc-x64` 就该是 MSVC。
    "-DCMAKE_CXX_COMPILER=cl",
    "-DCMAKE_C_COMPILER=cl",
    "-DCMAKE_EXPORT_COMPILE_COMMANDS=ON",
  ]);
  if (code !== 0) return code;
  writeIntellisenseDb();
  return 0;
}

// 中文 VS 的 `cl.exe` 把 `/showIncludes` 的前置打成「注意: 包含文件:」，CMake 探到的
// `msvc_deps_prefix` 写进 `rules.ninja` 后与 ninja 拿到的字节对不上 ⇒ **头文件依赖一条都
// 记不下来**（`ninja -t deps` 是空的）：只改 `.h` 时 ninja 认为无事可做，编出来的还是旧目标。
// 这个坑很贵 —— 曾经把「已经修好」误判成「没修好」（`bot_env.h` 的 `id` 白加一轮）。
// 所以：头文件比对象新就把 `lfw|host|tests` 的对象目录整个删掉重编（`ninja` 自己的依赖
// 表不可信，只能按「头文件 mtime 比任何 .obj 新」这个粗粒度守卫兜底）。
function guardStaleObjectsAt(buildDir) {
  if (!existsSync(buildDir)) return false;
  const objMs = Math.max(newestMtime(join(buildDir, "lfw"), (f) => f.endsWith(".obj")),
                         newestMtime(join(buildDir, "host"), (f) => f.endsWith(".obj")),
                         newestMtime(join(buildDir, "tests"), (f) => f.endsWith(".obj")));
  if (objMs === 0) return false;
  const headerMs = Math.max(newestMtime(join(NATIVE, "lfw"), isHeader),
                            newestMtime(join(NATIVE, "host"), isHeader),
                            newestMtime(join(NATIVE, "tests"), isHeader));
  if (headerMs <= objMs) return false;
  console.log(C.dim("  头文件比 .obj 新（MSVC 的 /showIncludes 在中文 VS 下记不进依赖）⇒ 全量重编"));
  for (const sub of ["lfw", "host", "tests"]) {
    rmSync(join(buildDir, sub, "CMakeFiles"), { recursive: true, force: true });
  }
  return true;
}

const guardStaleObjects = () => guardStaleObjectsAt(BUILD_DIR);

function cmdBuild() {
  const subject = process.argv[3];
  guardStaleObjects();
  const args = ["--build", BUILD_DIR];
  if (subject) args.push("--target", `lfw_trace_${subject}`);
  const code = runCmake(args);
  if (code !== 0) return code;
  console.log(C.dim(`  -> ${BIN}${subject ? ` (target lfw_trace_${subject})` : ""}`));
  return 0;
}

function cmdLint() {
  const tools = ["check_lfw_cpp_includes.mjs", "check_mutation_anchors.mjs"];
  for (const tool of tools) {
    const code = spawnSync(process.execPath, [join(HERE, tool)], { stdio: "inherit" }).status ?? 1;
    if (code !== 0) return code;
  }
  return 0;
}

function cmdCoverage() {
  return (
    spawnSync(process.execPath, [join(HERE, "check_defines_coverage.mjs")], { stdio: "inherit" }).status ?? 1
  );
}

// Godot 宿主（DESIGN §G1）：把 `lfw_core` + `host/` 编成一个 GDExtension。
// 两份仓库外的输入走环境变量/既有目录（见 native/README.md「Godot 宿主」）：
//   GODOT_CPP_DIR            godot-cpp 的检出目录（仓库外）
//   native/build/godot-api/  由本机 Godot 自己 dump 的 `extension_api.json`
// 产物：`native/host/godot/project/bin/lfw_godot.dll`（`project/bin/` 已忽略）。
// ⚠ 这一支的头文件依赖**不可靠**（README「Godot 宿主」那条实测坑）：改了 `host/godot/**` 的 header
// 之后，ninja 可能只重编了一部分 `.o` ⇒ 类的布局/虚表一半新一半旧，表现是"跑得好好的、退出时崩"
// 或者**某些 UI 行为莫名其妙**（不是崩，就是反应不对 —— 比崩更难查）。
//
// 所以在 configure/build 之前自己判一次：`native/host` 或 `native/lfw` 下**任一 `.h/.hpp`** 比
// `lfw_godot.dir` 里最新的 `.obj` 还新 ⇒ 把整个对象目录删掉、全量重编（约 2.5 分钟）。
// 只看头文件：`.cpp` 自己的 mtime ninja 是**确定**跟踪的（那条不用我们兜）。
function newestMtime(dir, pred) {
  let ret = 0;
  if (!existsSync(dir)) return ret;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === ".git" || ent.name === "build") continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) ret = Math.max(ret, newestMtime(full, pred));
    else if (pred(full)) ret = Math.max(ret, statSync(full).mtimeMs);
  }
  return ret;
}

const isHeader = (f) => f.endsWith(".h") || f.endsWith(".hpp") || f.endsWith(".inc");

function cmdGodot() {
  const cppDir = process.env.GODOT_CPP_DIR;
  if (!cppDir) {
    console.error(C.red("GODOT_CPP_DIR is not set (path to a godot-cpp checkout, outside this repo)"));
    return 2;
  }
  guardStaleObjectsAt(GODOT_BUILD_DIR);
  const apiFile = join(NATIVE, "build", "godot-api", "extension_api.json");
  if (!existsSync(apiFile)) {
    console.error(C.red(`missing ${apiFile}`));
    console.error("  run in that folder: <godot-console> --headless --dump-extension-api --dump-gdextension-interface");
    return 2;
  }
  const dir = GODOT_BUILD_DIR;
  const code = runCmake([
    "-S",
    NATIVE,
    "-B",
    dir,
    "-G",
    "Ninja",
    "-DCMAKE_BUILD_TYPE=Release",
    // IntelliSense 那一半靠它（见 CC_MERGED_DB 的注释）：显式传，别指望环境变量里碰巧有
    "-DCMAKE_EXPORT_COMPILE_COMMANDS=ON",
    // 同 `cmdConfigure`：不钉住的话 PATH 里的 msys64 `c++.exe` 会被自动探测挑走
    "-DCMAKE_CXX_COMPILER=cl",
    "-DCMAKE_C_COMPILER=cl",
    "-DLFW_GODOT_HOST=ON",
    `-DLFW_GODOT_CPP_DIR=${cppDir}`,
    `-DGODOTCPP_CUSTOM_API_FILE=${apiFile}`,
    "-DGODOTCPP_TARGET=template_debug",
  ]);
  if (code !== 0) return code;
  writeIntellisenseDb();
  const built = runCmake(["--build", dir, "--target", "lfw_godot"]);
  if (built !== 0) return built;
  console.log(C.dim(`  -> ${join(NATIVE, "host", "godot", "project", "bin", "lfw_godot.dll")}`));
  return 0;
}

function cmdTest() {
  const r = spawnSync(
    process.execPath,
    [join(NATIVE, "tests", "differential", "run.mjs"), ...process.argv.slice(3)],
    { stdio: "inherit" },
  );
  return r.status ?? 1;
}

// Godot 可执行文件：`GODOT_BIN` → PATH（`godot4`/`godot`）→ 桌面上的官方构建。
// 同版本优先 `_console` 变体（Windows 上只有它会打 stdout，`[godot]` 那几行才看得见）。
function findGodot() {
  const env = process.env.GODOT_BIN;
  if (env && existsSync(env)) return env;
  for (const name of ["godot4", "godot"]) {
    const r = spawnSync("where", [name], { encoding: "utf8" });
    if (r.status === 0) {
      const first = (r.stdout ?? "").split(/\r?\n/).find((l) => l.trim());
      if (first) return first.trim();
    }
  }
  const home = process.env.USERPROFILE ?? "";
  const found = [];
  for (const desk of [join(home, "Desktop"), join(home, "OneDrive", "Desktop")]) {
    if (!existsSync(desk)) continue;
    for (const f of readdirSync(desk)) {
      if (/^Godot_v[\d.]+-stable_win64(_console)?\.exe$/i.test(f)) found.push(join(desk, f));
    }
  }
  if (found.length === 0) return null;
  const ver = (p) => {
    const m = /Godot_v(\d+)\.(\d+)(?:\.(\d+))?/.exec(p);
    return m ? Number(m[1]) * 1e6 + Number(m[2]) * 1e3 + Number(m[3] ?? 0) : 0;
  };
  found.sort((a, b) => {
    if (ver(a) !== ver(b)) return ver(b) - ver(a);
    return (/_console\.exe$/i.test(b) ? 1 : 0) - (/_console\.exe$/i.test(a) ? 1 : 0);
  });
  return found[0];
}

// `npm run godot [-- <扩展自己的参数>]`：编（缺则编）→ 让 Godot 认工程（缺则 import）→ 跑。
// 数据路径由这里补成绝对路径 —— Godot 跑工程时会把 cwd 切到工程目录，相对路径会找错地方。
function cmdGodotRun() {
  const bin = join(GODOT_PROJECT, "bin", "lfw_godot.dll");
  if (!existsSync(bin)) {
    console.log(C.dim("  lfw_godot.dll 不在，先编一次（npm run native godot 的同一套）"));
    const built = cmdGodot();
    if (built !== 0) return built;
  }
  const godot = findGodot();
  if (!godot) {
    console.error(C.red("找不到 Godot 可执行文件；设 GODOT_BIN 或用 `npm run native godot` 只编不跑"));
    return 2;
  }
  if (!existsSync(join(GODOT_PROJECT, ".godot", "extension_list.cfg"))) {
    console.log(C.dim("  首次运行：让 Godot 认这个工程（--headless --import）"));
    const imp = spawnSync(godot, ["--headless", "--import", "--path", GODOT_PROJECT], {
      stdio: "inherit",
    });
    if (imp.status !== 0) return imp.status ?? 1;
  }

  const userArgs = process.argv.slice(3);
  const headless = userArgs.includes("--headless");
  const rest = userArgs.filter((a) => a !== "--headless");
  const has = (flag) => rest.includes(flag);
  // 两种跑法（`--play` 是岔路口）：
  //   * `npm run godot`（一个扩展参数都不给）→ **开放模式**：不 boot_scene、不限帧数（关窗口才
  //     结束）、真节拍、不打帧摘要 —— 就是"玩"；
  //   * 给了参数（`npm run godot -- --frames 900 …`）或 `--headless` → 与以前一样：验收/诊断
  //     口径，缺省 `--frames 900 --delta 0.017`（三条摘要靠这一支）。
  const play = has("--play") || (!headless && rest.length === 0);

  const args = [];
  if (headless) args.push("--headless");
  args.push("--path", GODOT_PROJECT, "--");
  if (play && !has("--play")) args.push("--play");
  if (!has("--root")) args.push("--root", join(REPO, "dist"));
  if (!has("--zip")) {
    args.push("--zip", join(HOST_DATA, "prel"));
    const data = join(HOST_DATA, "data");
    if (existsSync(data)) args.push("--zip", data);
  }
  if (!play && !has("--frames")) args.push("--frames", has("--screenshot") ? "200" : "900");
  if (!play && !has("--delta")) args.push("--delta", "0.017");
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    // 存盘路径按「调用处」解成绝对路径：扩展拿到的 cwd 是工程目录
    if (a === "--screenshot" && rest[i + 1] && !isAbsolute(rest[i + 1])) {
      args.push(a, resolve(process.cwd(), rest[i + 1]));
      i += 1;
      continue;
    }
    args.push(a);
  }

  console.log(C.dim(`  ${godot}`));
  console.log(C.dim(`  ${args.join(" ")}`));
  if (play) {
    console.log(C.dim("  开放模式：玩到关窗口为止（想跑验收用 `npm run godot:headless`）"));
  }
  const r = spawnSync(godot, args, { stdio: "inherit", cwd: REPO });
  return r.status ?? 1;
}

const table = {
  configure: () => step("configure", cmdConfigure),
  build: () => step("build", cmdBuild),
  lint: () => step("lint", cmdLint),
  coverage: () => step("coverage", cmdCoverage),
  test: () => step("test", cmdTest),
  godot: () => step("godot", cmdGodot),
  "godot-run": cmdGodotRun,
  intellisense: () => step("intellisense", cmdIntellisense),
  all: () => {
    step("configure", cmdConfigure);
    step("build", cmdBuild);
    step("lint", cmdLint);
    step("coverage", cmdCoverage);
    step("test", cmdTest);
    console.log("");
    console.log(C.green(C.bold("all passed")));
    return 0;
  },
};

const SUB = process.argv[2] ?? "all";
if (!table[SUB]) {
  console.error(`unknown subcommand '${SUB}', available: ${Object.keys(table).join(" | ")}`);
  process.exit(2);
}

process.exit(table[SUB]());
