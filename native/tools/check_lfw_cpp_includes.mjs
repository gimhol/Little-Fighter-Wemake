#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const NATIVE = resolve(HERE, "..");
const LFW = join(NATIVE, "lfw");

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const ALLOWED_SYSTEM_HEADERS = new Set([
  "cstddef", "cstdint", "cfloat", "climits", "cstdbool", "version",
  "limits", "type_traits", "initializer_list", "concepts", "compare",
  "cmath", "numbers", "complex", "bit",
  "array", "vector", "string", "string_view", "span", "optional", "variant",
  "tuple", "utility", "map", "unordered_map", "set", "unordered_set",
  "algorithm", "numeric", "iterator", "ranges", "memory", "functional",
  "new", "memory_resource",
  "charconv",
]);

const FORBIDDEN_SYSTEM_HEADERS = new Map([
  ["filesystem", "host filesystem; core must not do IO"],
  ["fstream", "host file IO"],
  ["iostream", "host standard streams"],
  ["sstream", "string streams (locale dependent)"],
  ["cstdio", "C standard IO"],
  ["cstdlib", "rand / exit / host environment"],
  ["thread", "threads; not available on WASM"],
  ["mutex", "thread synchronization"],
  ["shared_mutex", "thread synchronization"],
  ["condition_variable", "thread synchronization"],
  ["future", "threads / async"],
  ["atomic", "implies concurrency; core is single threaded"],
  ["chrono", "host clock; use injected IClock"],
  ["ctime", "host clock"],
  ["random", "distribution is implementation defined; use core/mersenne_twister.h"],
  ["regex", "locale / implementation defined matching"],
  ["locale", "locale dependent; use js_string"],
  ["cstring", "only allowed in files listed in CSTRING_ALLOW"],
]);

// 尖括号侧按**模式**禁（不用逐个拼大小写）：`<Windows.h>` / `<windowsx.h>` 都算。
const FORBIDDEN_SYSTEM_HEADER_PATTERNS = [
  { re: /^windows/i, why: "Windows host API" },
];

// 引号侧：平台实现（Godot / Emscripten / SDL / Windows）**只能**落在 `native/host/**`。
// 引号形式原本只检查「有没有跑出 `native/lfw`」⇒ `#include "godot_cpp/godot.hpp"` 会静默通过
//（从 `native/lfw/ui/` 解析成 `native/lfw/ui/godot_cpp/godot.hpp`，仍在 `native/lfw` 里）。
// 这里**显式点名**目标名，命中即 error（DESIGN §G10）。
const FORBIDDEN_QUOTED_HEADERS = [
  { re: /^godot_cpp\//, why: "Godot implementation must live in native/host/godot" },
  { re: /^emscripten\.h$/, why: "Emscripten implementation must live in native/host/wasm" },
  { re: /^SDL/i, why: "platform implementation must live in native/host" },
  { re: /^windows/i, why: "Windows implementation must live in native/host" },
];

const FORBIDDEN_CALLS = [
  {
    re: /\bstd::(round|rint|nearbyint|lround|llround)\s*\(/,
    why: "rounding differs from JS; use lfw::js_round()",
  },
  {
    re: /\bstd::to_string\s*\(/,
    why: "not shortest round-trip; use lfw::js_number_to_string()",
  },
];

const FORBIDDEN_TOKENS = [
  { re: /\bthrow\b/, why: "lfw has no exceptions" },
  { re: /(^|[^\w.])try\s*\{/, why: "lfw has no exceptions" },
  { re: /\bcatch\s*\(/, why: "lfw has no exceptions" },
  { re: /\btypeid\b/, why: "lfw has no RTTI" },
  { re: /\bdynamic_cast\b/, why: "lfw has no RTTI" },
];

const CSTRING_ALLOW = new Set(["core/js_num.cpp"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(h|cpp|hpp|cc)$/.test(name)) out.push(p);
  }
  return out;
}

function stripCommentsAndStrings(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "")
    .replace(/"(?:\\.|[^"\\])*"/g, (m) => '"' + " ".repeat(Math.max(0, m.length - 2)) + '"');
}

function stripCommentsForIncludes(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

function lineOf(src, index) {
  return src.slice(0, index).split("\n").length;
}

const files = walk(LFW).sort();
let problems = 0;
let warnings = 0;
let clean = 0;

console.log(C.bold(`checking ${files.length} C++ sources under ${relative(process.cwd(), LFW)}`));
console.log("");

for (const file of files) {
  const rel = relative(LFW, file).split(sep).join("/");
  const raw = readFileSync(file, "utf8");
  const msgs = [];

  const incSrc = stripCommentsForIncludes(raw);
  const incRe = /^[ \t]*#[ \t]*include[ \t]*([<"])([^>"]+)[>"]/gm;
  for (let m; (m = incRe.exec(incSrc)); ) {
    const bracket = m[1];
    const target = m[2];
    const line = lineOf(incSrc, m.index);

    if (bracket === "<") {
      const key = target.trim();
      if (ALLOWED_SYSTEM_HEADERS.has(key)) continue;
      if (key === "cstring" && CSTRING_ALLOW.has(rel)) continue;

      const pattern = FORBIDDEN_SYSTEM_HEADER_PATTERNS.find((p) => p.re.test(key));
      const reason = FORBIDDEN_SYSTEM_HEADERS.get(key) ?? (pattern ? pattern.why : null);
      if (reason !== null && reason !== undefined) {
        msgs.push({ line, level: "error", text: `#include <${key}> is banned - ${reason}` });
      } else {
        msgs.push({ line, level: "error", text: `#include <${key}> is not whitelisted` });
      }
    } else {
      const named = FORBIDDEN_QUOTED_HEADERS.find((p) => p.re.test(target));
      if (named) {
        msgs.push({
          line,
          level: "error",
          text: `#include "${target}" is banned - ${named.why} (README 硬规则)`,
        });
        continue;
      }
      const resolved = resolve(dirname(file), target);
      if (!resolved.startsWith(LFW + sep) && resolved !== LFW) {
        msgs.push({ line, level: "error", text: `#include "${target}" escapes native/lfw` });
      }
    }
  }

  const code = stripCommentsAndStrings(raw);

  for (const { re, why } of FORBIDDEN_CALLS) {
    const g = new RegExp(re.source, "g");
    for (let m; (m = g.exec(code)); ) {
      msgs.push({ line: lineOf(code, m.index), level: "error", text: `${m[0].trim()} - ${why}` });
    }
  }

  for (const { re, why } of FORBIDDEN_TOKENS) {
    const g = new RegExp(re.source, "g");
    for (let m; (m = g.exec(code)); ) {
      msgs.push({ line: lineOf(code, m.index), level: "error", text: `${m[0].trim()} - ${why}` });
    }
  }

  for (const m of code.matchAll(/(^|[^\w>:.])(new|delete)\s/g)) {
    msgs.push({ line: lineOf(code, m.index), level: "warn", text: `raw ${m[2]} - prefer std::unique_ptr / std::vector` });
  }

  if (msgs.length === 0) {
    clean++;
    continue;
  }

  const errs = msgs.filter((m) => m.level === "error");
  const warns = msgs.filter((m) => m.level === "warn");
  problems += errs.length;
  warnings += warns.length;

  console.log(`${errs.length ? C.red("x") : C.yellow("!")} ${rel}`);
  for (const m of errs) console.log(C.red(`    ${m.line}: ${m.text}`));
  for (const m of warns) console.log(C.yellow(`    ${m.line}: ${m.text}`));
}

console.log("");
console.log(
  `${C.green(String(clean))} clean / ` +
    `${problems ? C.red(String(problems)) : "0"} failed / ` +
    `${warnings ? C.yellow(String(warnings)) : "0"} warnings`,
);

process.exit(problems === 0 ? 0 : 1);
