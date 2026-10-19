#!/usr/bin/env node
// 步行骨架的 Node 冒烟（本环境没有浏览器）：把 `lfw/build/wasm/bin/lfw_wasm.mjs` 装起来，
// 灌数据进 MEMFS，构造 `LFW` + `World`，**由 JS 逐帧推**，把「真的跑在 wasm 里」的证据打出来。
//
// 用法（默认 = README「宿主三条摘要」的第 2 条命令；`--profile 1|2|3` 就是那三条）：
//   node native/web/smoke.mjs                      # profile 2
//   node native/web/smoke.mjs --profile 1          # prel-only / 300 帧
//   node native/web/smoke.mjs --bundle <dir>       # 走浏览器那条路（bundle.json + bundle.bin）
//   node native/web/smoke.mjs --live               # 三个槽换成 JS 定时器 + lfw_invoke 回灌
//
// 输出是**确定性的**（手动模式 + 固定 dt + 不打印任何墙钟/耗时）⇒ 连跑两次逐字节相同。
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

import {
  createLfwHost,
  nodeDirEntries,
  bundleEntries,
  LOG_LEVEL,
} from "./host.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const NATIVE = resolve(HERE, "..");
const REPO = resolve(NATIVE, "..");
const MODULE_PATH = join(NATIVE, "build", "wasm", "bin", "lfw_wasm.mjs");
const PREL = join(NATIVE, "build", "host-data", "prel");
const DATA = join(NATIVE, "build", "host-data", "data");

// README 的三条 MSVC 摘要（跨宿主对拍的参照）+ 各自的命令行口径。
const PROFILES = {
  1: { zips: [PREL], frames: 300, every: 300, stage: "", fighters: [], players: 2, vs: false, digest: "a7edd32e19a43ea9" },
  2: { zips: [PREL, DATA], frames: 900, every: 900, stage: "1", fighters: ["1", "4"], players: 2, vs: false, digest: "13945ad1144c968d" },
  3: { zips: [PREL, DATA], frames: 600, every: 600, stage: "0", fighters: ["1", "4"], players: 2, vs: true, digest: "61c42c78c9d0bcac" },
};

function parseArgs(argv) {
  const a = {
    profile: 2,
    zips: null,
    bundle: null,
    builtinData: join(REPO, "dist", "builtin_data"),
    frames: null,
    every: null,
    stage: null,
    fighters: [],
    players: null,
    vs: null,
    live: false,
    dev: false,
    state: false,
    logs: 8,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === "--profile") a.profile = Number(next());
    else if (k === "--prel-only") a.profile = 1;
    else if (k === "--prel") a.zips = [resolve(next())];
    else if (k === "--zip") (a.zips ??= []).push(resolve(next()));
    else if (k === "--bundle") a.bundle = resolve(next());
    else if (k === "--builtin-data") a.builtinData = resolve(next());
    else if (k === "--frames") a.frames = Number(next());
    else if (k === "--every") a.every = Number(next());
    else if (k === "--stage") a.stage = next();
    else if (k === "--fighter") a.fighters.push(next());
    else if (k === "--players") a.players = Number(next());
    else if (k === "--vs") a.vs = true;
    else if (k === "--live") a.live = true;
    else if (k === "--dev") a.dev = true;
    else if (k === "--state") a.state = true;
    else if (k === "--logs") a.logs = Number(next());
    else if (k === "--help" || k === "-h") {
      console.log("see the header of native/web/smoke.mjs");
      process.exit(0);
    } else throw new Error(`unknown argument: ${k}`);
  }
  const p = PROFILES[a.profile];
  if (!p) throw new Error(`unknown profile: ${a.profile} (1..3)`);
  return {
    ...a,
    zips: a.zips ?? p.zips,
    frames: a.frames ?? p.frames,
    every: a.every ?? p.every,
    stage: a.stage ?? p.stage,
    fighters: a.fighters.length > 0 ? a.fighters : p.fighters,
    players: a.players ?? p.players,
    vs: a.vs ?? p.vs,
    expected: p.digest,
  };
}

const args = parseArgs(process.argv.slice(2));
const lines = [];
const say = (s) => {
  lines.push(s);
  console.log(s);
};

const moduleFactory = (await import(pathToFileURL(MODULE_PATH).href)).default;

// ---- 1. 数据：先备好字节（node 读磁盘目录 / 读 bundle），再灌 MEMFS（W9）----
let entries = [];
let memZips = [];
let dataSource = "";
if (args.bundle !== null) {
  const index = JSON.parse(readFileSync(join(args.bundle, "bundle.json"), "utf8"));
  const bin = readFileSync(join(args.bundle, "bundle.bin"));
  entries = bundleEntries(index, bin, "/");
  memZips = index.roots.filter((r) => r !== "builtin_data").map((r) => `/${r}`);
  dataSource = `bundle ${args.bundle}`;
} else {
  entries = await nodeDirEntries(args.builtinData, "/builtin_data");
  for (const dir of args.zips) {
    const name = `/zip${memZips.length}`;
    entries = entries.concat(await nodeDirEntries(dir, name));
    memZips.push(name);
  }
  dataSource = `dirs ${[args.builtinData, ...args.zips].join(", ")}`;
}
const bytes = entries.reduce((n, e) => n + e.bytes.length, 0);

// ---- 2. 宿主 + 平台表（JS 只给时钟 + 日志）----
const host = await createLfwHost({
  moduleFactory,
  live: args.live,
  dev: args.dev,
});
host.install(entries);
host.create(args.dev);
for (const z of memZips) host.addZip(z);
host.load();

say(`[smoke] module    ${MODULE_PATH}`);
say(`[smoke] abi       lfw_abi_version()=${host.module._lfw_abi_version()}`);
say(
  `[smoke] platform  table=12槽/48B clock=${args.live ? "live(JS timer+lfw_invoke)" : "manual(add→0)"}` +
    ` log=JS callback`,
);
say(`[smoke] data      ${dataSource}`);
say(`[smoke] memfs     ${entries.length} files / ${bytes} bytes → ${memZips.join(" ")}`);
const counts = host.dataCounts();
say(
  `[smoke] loaded    fighters=${counts.fighters} weapons=${counts.weapons} balls=${counts.balls} ` +
    `entities=${counts.entities} stages=${counts.stages} bg=${counts.bgs} bots=${counts.bots} moves=${counts.moves}`,
);

host.boot({
  stage: args.stage,
  fighterA: args.fighters[0] ?? "",
  fighterB: args.fighters[1] ?? "",
  players: args.players,
  vs: args.vs,
});
const booted = host.stats();
say(
  `[smoke] boot      stage=${args.stage} vs=${args.vs ? 1 : 0} entities=${booted.entities} ` +
    `lifetime=${booted.lifetime}`,
);

// 这一帧之前唯一走进 WASM 的 JS 数据就是「时钟 + 日志」：把它们原样打出来。
const shown = host.logs.slice(0, args.logs);
for (const l of shown) {
  const tag = Object.keys(LOG_LEVEL).find((k) => LOG_LEVEL[k] === l.level) ?? "log";
  say(`[smoke] log(${tag})  ${l.text}`);
}
if (host.logs.length > shown.length) say(`[smoke] log(...)  +${host.logs.length - shown.length} more`);

// ---- 3. 推帧（JS 推时钟 → lfw_frame(dt)）----
const dt = 1000 / 60;
say(`[smoke] dt        ${dt} ms (UPS=60，与 lfw_run 同口径)`);
let invokes = 0;
for (let frame = 0; frame < args.frames; frame++) {
  host.frame(dt);
  invokes += host.pump();
  if (frame % args.every === 0 || frame === args.frames - 1) {
    const s = host.stats();
    say(
      `[smoke] frame ${String(frame).padStart(6)} entities=${s.entities} ghosts=${s.ghosts} ` +
        `lifetime=${s.lifetime} hp=${s.totalHp} digest=${host.digest()}`,
    );
    if (args.state) say(`[smoke]   ${host.dumpState()}`);
  }
}

const final = host.stats();
const digest = host.digest();
say(
  `[smoke] stats     frames=${final.frames} lifetime=${final.lifetime} entities=${final.entities} ` +
    `ghosts=${final.ghosts} totalHp=${final.totalHp} warns=${final.warns} errors=${final.errors} logs=${final.logs}`,
);
say(
  `[smoke] clock     wasm 读到的 now=${host.clockNowSeenByWasm()} js=${host.clockMs} ` +
    `(同一份 JS 时钟)`,
);
say(`[smoke] digest    ${digest}`);
say(
  digest === args.expected
    ? `[smoke] cross-host digest == MSVC lfw_run（profile ${args.profile}：${args.expected}）`
    : `[smoke] cross-host digest != MSVC 参照（profile ${args.profile} 期望 ${args.expected}）`,
);

// ---- 4. 反向回调探针（W4 的 (c)）----
host.probeSchedule(5);
if (args.live) {
  say(
    "[smoke] note      live: `LFW` ctor 里 `world.start_update()` ⇒ 端口自己的 Ticker 也在推世界",
  );
  say(
    "[smoke] note      所以 live 下每帧步进 2 次（lifetime=2×frames）。浏览器稳态只该让 Ticker 推。",
  );
} else {
  // 手动模式下三个槽的 `add` 都回 0（= ManualClock 的回落）⇒ 探针注册不上任何东西。
  host.pump();
  say("[smoke] probe     manual: add→0（没有句柄）⇒ 不可能有反向调用");
}
const probeFrames = args.live ? 3 : 0;
for (let i = 0; i < probeFrames; i++) {
  host.frame(dt);
  invokes += host.pump();
}
say(
  `[smoke] probe hits clock=${host.probeHits(0)} timeout=${host.probeHits(1)} ` +
    `render=${host.probeHits(2)} invokes=${invokes}`,
);

// ---- 4b. live 专属：世界由端口自己的 Ticker 推（一个 `lfw_frame` 都不调）----
if (args.live) {
  const before = host.stats();
  const tickerFrames = 120;
  for (let i = 0; i < tickerFrames; i++) {
    host.advance(dt);
    host.pump();
  }
  const after = host.stats();
  say(
    `[smoke] ticker    advance+pump ×${tickerFrames}（不调 lfw_frame）→ lifetime ` +
      `${before.lifetime}→${after.lifetime} frames(显式)=${after.frames} entities=${after.entities}`,
  );
}

// ---- 5. 收尾 ----
host.dispose();
say(`[smoke] done      ok（lines=${lines.length}）`);
