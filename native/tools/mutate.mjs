#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const nativeScript = resolve(root, "native", "tools", "native.mjs");

// 变异体可能**卡死**（已经遇到过：`buff` 的「del_id 不截断」让台面一直转），
// 所以测试这一段的运行时间要有上限 —— 否则整个运行会挂在那里等人工去杀，
// 而「killed」就成了人手动杀出来的结果，不是运行器的判定。
const TEST_TIMEOUT_MS = 60_000;

function run(args, timeoutMs) {
  try {
    execFileSync(process.execPath, [nativeScript, ...args], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
      // MSVC 的 `/showIncludes` 打印在 stdout（中文 VS 的前缀与 CMake 写进 `rules.ninja` 的
      // `msvc_deps_prefix` 对不上 ⇒ ninja 不吞它，见 README（十七））。一个中等大小的 TU
      // 就能刷出近 1 MB，`execFileSync` 的默认 `maxBuffer` 正好是 1 MB ⇒ **撑爆后被误判成
      // "build failed"**（实测：`entity.mjs` 的 936 条里 935 条被记成 compile-error）。
      maxBuffer: 256 * 1024 * 1024,
    });
    return { ok: true, out: "" };
  } catch (e) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.toString();
    const tail = out.trimEnd().split(/\r?\n/).slice(-40).join("\n");
    return { ok: false, out: tail, timedOut: e.killed === true || e.signal != null };
  }
}

const specPath = process.argv[2];
if (!specPath) {
  process.stderr.write("usage: mutate.mjs <mutations.mjs>\n");
  process.exit(2);
}

const spec = (await import(pathToFileURL(resolve(process.cwd(), specPath)).href)).default;
const { subject, mutations } = spec;
// `cases` 可选：只跑这几份用例（`test <subject> <case>`）。差分里 subject 的
// 用例集会越攒越大（`entity` 已经有好几份），而一份变异通常只有一两份用例看得见
// —— 不写就照旧跑该 subject 的全部用例。
const specCases = Array.isArray(spec.cases) ? spec.cases : spec.cases ? [spec.cases] : [];

// 台面源文件（`tests/differential/subjects/<subject>.cpp`）：头文件变异要逼它重编，
// 见下面 `touchSubjectSource()` 的注释。
const subjectSource = resolve(root, "native", "tests", "differential", "subjects", `${subject}.cpp`);

// ⚠️ 本机 `build.ninja` 里**记不下**头文件依赖（中文 VS 的 `/showIncludes` 前置与
// `msvc_deps_prefix` 对不上，见 README（十七）/ DESIGN §161.4）⇒ 改头文件不会让任何
// `.obj` 过期。`native.mjs build` 现在靠「头文件 stamp 变了就全量重编」兜底；但变异运行器
// 里是它自己改文件、自己 build，所以这里仍旧把台面源文件顶一下，别指望别人替它擦。
// 台面源文件里往往**内联/实例化**了被改的类（MSVC 会把 vtable 与内联体以 COMDAT 放在台面的
// .obj 里，链接时又排在库的前面赢得挑选），于是「头文件变异」会**假存活**。运行器本来就会在
// 每条变异后把 spec 提到的文件写回一遍（顺带把它们的 mtime 顶新 ⇒ 下一条变异时自然会重编），
// 台面源文件不在这个集合里，得单独顶一下。
function touchSubjectSource() {
  if (!existsSync(subjectSource)) return;
  const now = new Date();
  utimesSync(subjectSource, now, now);
}

// 超时被杀的是子进程（node），台面 exe 可能是孙进程、还在转 —— 它占着
// `bin/lfw_trace_<subject>.exe`，会让后面那条变异的链接失败。
function killStuckSubjects() {
  spawnSync("taskkill", ["/F", "/IM", `lfw_trace_${subject}.exe`], { stdio: "ignore" });
}

function runTest(extraArgs) {
  for (const name of specCases.length ? specCases : [null]) {
    const args = ["test", subject];
    if (name) args.push(name);
    args.push(...extraArgs);
    const r = run(args, TEST_TIMEOUT_MS);
    if (r.timedOut) killStuckSubjects();
    if (!r.ok) return r;
  }
  return { ok: true, out: "" };
}

const originals = new Map();
// 锚点里的 `\n` 是 LF，而 autocrlf 的工作区是 CRLF ⇒ 匹配/替换在归一化副本上做，
// 写回时还原原文件的行尾。originals 始终存原始字节（restore / backup 用）。
const normals = new Map();
const normalize_eol = (s) => s.replace(/\r\n/g, "\n");
const restore_eol = (s, crlf) => (crlf ? s.replace(/\n/g, "\r\n") : s);
const badAnchors = [];
for (const m of mutations) {
  const file = resolve(root, m.file);
  if (!originals.has(file)) {
    if (!existsSync(file)) {
      process.stderr.write(`missing file: ${m.file}\n`);
      process.exit(2);
    }
    const raw = readFileSync(file, "utf8");
    originals.set(file, raw);
    normals.set(file, normalize_eol(raw));
  }
  const count = normals.get(file).split(normalize_eol(m.from)).length - 1;
  if (count !== 1) badAnchors.push(`[${m.note}] anchor occurs ${count} times in ${m.file}`);
}
if (badAnchors.length) {
  for (const line of badAnchors) process.stderr.write(`${line}\n`);
  process.stderr.write(`${badAnchors.length} bad anchor(s)\n`);
  process.exit(2);
}

for (const m of mutations) {
  if (!m.file.replace(/\\/g, "/").startsWith("native/lfw/")) {
    process.stderr.write(
      `mutation '[${m.note}]' targets ${m.file}; only native/lfw/** may be mutated ` +
        `(the TS side is reused across the run)\n`,
    );
    process.exit(2);
  }
}

// Windows 上刚编译完的源文件偶尔会被外部进程（编辑器/索引器）短暂占用；
// 这两处写入正落在 build 之后，所以对 EBUSY/EPERM 做一次退避重试。
function writeWithRetry(file, text) {
  for (let attempt = 0; attempt < 50; ++attempt) {
    try {
      writeFileSync(file, text);
      return;
    } catch (e) {
      if ((e.code !== "EBUSY" && e.code !== "EPERM") || attempt === 49) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
}

function restoreAll() {
  for (const [file, text] of originals) writeWithRetry(file, text);
}

function backupDir() {
  return resolve(root, "native", "build", "mutate-backup");
}

function backupOriginals() {
  const dir = backupDir();
  mkdirSync(dir, { recursive: true });
  const files = [];
  let index = 0;
  for (const [file, text] of originals) {
    const name = `f${index++}`;
    writeFileSync(resolve(dir, name), text, "utf8");
    files.push({ file, name });
  }
  writeFileSync(resolve(dir, "manifest.json"), JSON.stringify(files), "utf8");
}

// 被杀掉的上一趟会在「源码 = 变异体、obj 也是变异体」的中间态离开：恢复源码后 mtime 可能**早于**
// 那个 obj（恢复与最后一次编译前后脚），ninja 于是认为它是最新的 ⇒ 后面整趟都在测变异体
// （实测过：935 条全 compile-error、以及一条假的 `entity/main` drift）。这里把恢复过的文件对应
// 的 obj 删掉，逼下一趟重编 —— 宁可贵一点，不能拿变异体当基线。
function dropObjectsOf(restored) {
  const names = new Set(restored.map((f) => basename(f).toLowerCase()));
  const stack = [resolve(root, "native", "build")];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = resolve(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name.toLowerCase().endsWith(".obj") && names.has(e.name.toLowerCase())) {
        try {
          rmSync(p, { force: true });
        } catch {
          // 占用中（编辑器/索引器）：下一趟 `build` 还来得及，忽略。
        }
      }
    }
  }
}

function recoverFromInterruptedRun() {
  const dir = backupDir();
  const manifest = resolve(dir, "manifest.json");
  if (!existsSync(manifest)) return false;
  const files = JSON.parse(readFileSync(manifest, "utf8"));
  for (const f of files) writeFileSync(f.file, readFileSync(resolve(dir, f.name), "utf8"));
  rmSync(dir, { recursive: true, force: true });
  dropObjectsOf(files.map((f) => f.file));
  return true;
}

if (recoverFromInterruptedRun()) {
  process.stdout.write(
    "NOTE: recovered from an interrupted run (sources restored, rebuild required)\n",
  );
  run(["build"]);
}

// 基线必须先编一遍：`test` 不构建（见 README「`test` 不 build」），拿上一次（可能是变异体的）
// 二进制当基线就会得到一堆假 compile-error / 假 drift（实测踩过两次）。
if (!run(["build", subject]).ok) {
  process.stderr.write(`baseline build failed for '${subject}'\n`);
  process.exit(1);
}

const baseline = runTest([]);
if (!baseline.ok) {
  process.stderr.write(`baseline already failing for '${subject}':\n${baseline.out}\n`);
  process.exit(1);
}

backupOriginals();

const rows = [];
let killed = 0;
let survived = 0;
let compileError = 0;
let timeouts = 0;
const startedAt = Date.now();

for (const m of mutations) {
  const file = resolve(root, m.file);
  const raw = originals.get(file);
  const crlf = raw.includes("\r\n");
  const mutated = normals
    .get(file)
    .replace(normalize_eol(m.from), normalize_eol(m.to));
  writeWithRetry(file, restore_eol(mutated, crlf));
  if (!/\.cpp$/i.test(m.file)) touchSubjectSource();

  const t0 = Date.now();
  const built = run(["build", subject]);
  if (built.ok) {
    const tested = runTest(["--reuse-ts"]);
    rows.push({ note: m.note, survived: tested.ok, timeout: tested.timedOut, ms: Date.now() - t0 });
    if (tested.ok) ++survived;
    else ++killed;
    if (tested.timedOut) ++timeouts;
  } else {
    rows.push({ note: m.note, survived: false, compileError: true, ms: Date.now() - t0 });
    ++compileError;
  }
  process.stdout.write(`.${survived ? "|" : compileError ? "e" : ""}`);

  restoreAll();
}
process.stdout.write("\n");

restoreAll();
rmSync(backupDir(), { recursive: true, force: true });
run(["build"]);

const width = Math.max(...rows.map((r) => r.note.length));
for (const r of rows) {
  const status = r.compileError
    ? "compile-error"
    : r.survived
      ? "SURVIVED"
      : r.timeout
        ? "killed (timeout)"
        : "killed";
  process.stdout.write(`${r.note.padEnd(width)}  ${status}\n`);
}
const totalMs = Date.now() - startedAt;
const slowest = [...rows].sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0))[0];
process.stdout.write(
  `\nsubject ${subject}${specCases.length ? ` (cases: ${specCases.join(", ")})` : " (all cases)"}\n` +
    `${killed} killed, ${survived} survived, ${compileError} compile-error (of ${rows.length})` +
    (timeouts ? ` — ${timeouts} of the killed are timeouts (the mutant hangs)\n` : "\n") +
    `total ${(totalMs / 1000).toFixed(1)}s, ${(totalMs / rows.length).toFixed(0)} ms/mutation` +
    (slowest ? `, slowest '${slowest.note}' ${slowest.ms} ms\n` : "\n"),
);

process.exit(survived === 0 && compileError === 0 ? 0 : 1);
