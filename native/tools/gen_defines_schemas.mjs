#!/usr/bin/env node
// 生成 `native/lfw/defines/schemas_gen.h` 与差分台面的 `subjects/gen/defines_schemas.ts`。
//
// 由来（4W）：`src/LFW/defines/*.ts` 里的 `Schema_*` 是 `make_schema(...)` 的**纯数据**产物
// （无函数、无类实例；探针确认只有 object/string/boolean/number），照 `gen_defines_fields.mjs`
// 的先例整体 dump 成 JSON5 表，台面两侧（C++ 用生成表、TS 用真模块）对同一份数据做差分。
// 4AH 起扫描根扩到 `src/LFW/defines` + `src/LFW/ui`（`Schema_IUIImgInfo` 在 UI 侧）。

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const src_lfw = resolve(root, "src/LFW");
const scan_dirs = [resolve(src_lfw, "defines"), resolve(src_lfw, "ui")];
const gen_dir = resolve(root, "native/build/gen");
const subject_gen_dir = resolve(root, "native/tests/differential/subjects/gen");
const out_header = resolve(root, "native/lfw/defines/schemas_gen.h");
const out_ts = resolve(root, "native/tests/differential/subjects/gen/defines_schemas.ts");

const relNoExt = (from, f) => relative(from, f).replace(/\.ts$/, "").split("\\").join("/");
const relFromGen = (f) => relNoExt(gen_dir, f);
const relFromSubjectGen = (f) => relNoExt(subject_gen_dir, f);

function walk(dir, out) {
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith(".ts")) out.push(p);
  }
  return out;
}

const modules = [];
for (const dir of scan_dirs) {
  for (const f of walk(dir, [])) {
    const base = f.split(/[\\/]/).pop();
    if (base === "index.ts") continue;
    if (!/export\s+(?:const|let|var|function|class)\s+Schema_\w+/.test(readFileSync(f, "utf8"))) {
      continue;
    }
    modules.push(f);
  }
}

if (modules.length === 0) {
  console.error("gen_defines_schemas: no modules with Schema_ found");
  process.exit(1);
}

const modPath = (f) => relNoExt(src_lfw, f);
const aliasFor = (f) => `S_${modPath(f).replace(/[^A-Za-z0-9]/g, "_")}`;

const entry = [];
for (const f of modules) {
  entry.push(`import * as ${aliasFor(f)} from "${relFromGen(f)}";`);
}
entry.push("");
entry.push("function plain(v) {");
entry.push("  if (v instanceof Map) {");
entry.push("    const o = {};");
entry.push("    for (const [k, x] of v) o[String(k)] = plain(x);");
entry.push("    return o;");
entry.push("  }");
entry.push("  if (Array.isArray(v)) return v.map((x) => {");
entry.push("    if (typeof x === 'undefined') throw new Error('Schema 数组里出现 undefined');");
entry.push("    return plain(x);");
entry.push("  });");
entry.push("  if (v !== null && typeof v === 'object') {");
entry.push("    const o = {};");
entry.push("    for (const k of Object.keys(v)) {");
entry.push("      if (typeof v[k] === 'undefined') continue;");
entry.push("      o[k] = plain(v[k]);");
entry.push("    }");
entry.push("    return o;");
entry.push("  }");
entry.push("  if (typeof v === 'function') throw new Error('Schema 里出现函数（无法 dump）: ' + v);");
entry.push("  if (typeof v === 'undefined') throw new Error('Schema 里出现 undefined');");
entry.push("  return v;");
entry.push("}");
entry.push("");
entry.push("const out = [];");
entry.push("const seen = new Set();");
entry.push("for (const [path, m] of [");
for (const f of modules) {
  entry.push(`  [${JSON.stringify(modPath(f))}, ${aliasFor(f)}],`);
}
entry.push("]) {");
entry.push("  for (const k of Object.keys(m).sort()) {");
entry.push("    if (!k.startsWith('Schema_')) continue;");
entry.push("    if (seen.has(k)) throw new Error('Schema 重名: ' + k);");
entry.push("    seen.add(k);");
entry.push("    out.push({ name: k, value: plain(m[k]), module: path });");
entry.push("  }");
entry.push("}");
entry.push("console.log(JSON.stringify(out));");

mkdirSync(gen_dir, { recursive: true });
mkdirSync(dirname(out_ts), { recursive: true });

const entryPath = join(gen_dir, "defines_schemas_dump.ts");
writeFileSync(entryPath, entry.join("\n"));

const requireFromLfw = createRequire(join(root, "src", "LFW", "package.json"));
const esbuild = requireFromLfw("esbuild");
const bundle = join(gen_dir, "defines_schemas_dump.mjs");
esbuild.buildSync({
  entryPoints: [entryPath],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile: bundle,
  logLevel: "warning",
});

const json = execFileSync(process.execPath, [bundle], { encoding: "utf8", maxBuffer: 1 << 28 });
const tables = JSON.parse(json);
tables.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

function cxxU16(text) {
  let out = 'u"';
  for (const ch of text) {
    const u = ch.codePointAt(0);
    if (u === 0x22) out += '\\"';
    else if (u === 0x5c) out += "\\\\";
    else if (u < 0x20) out += "\\u" + u.toString(16).padStart(4, "0");
    else if (u <= 0x7e) out += ch;
    else if (u <= 0xffff) out += "\\u" + u.toString(16).padStart(4, "0");
    else {
      const v = u - 0x10000;
      out += "\\u" + (0xd800 + (v >> 10)).toString(16).padStart(4, "0");
      out += "\\u" + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, "0");
    }
  }
  return out + '"';
}

const CHUNK = 8000;

function chunkText(s) {
  const parts = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + CHUNK, s.length);
    const c = s.charCodeAt(end - 1);
    if (c >= 0xd800 && c <= 0xdbff && end < s.length) end -= 1;
    parts.push(s.slice(i, end));
    i = end;
  }
  return parts;
}

function rawLiteralFor(text) {
  let d = "J";
  while (text.includes(`)${d}"`)) d += "x";
  return chunkText(text)
    .map((c) => `uR"${d}(${c})${d}"`)
    .join("\n      ");
}

function snake(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

const header = [];
header.push("#pragma once");
header.push("");
header.push("#include <vector>");
header.push("");
header.push('#include "lfw/core/json5.h"');
header.push('#include "lfw/core/value.h"');
header.push("");
header.push("namespace lfw {");
header.push("");
for (const t of tables) {
  const text = JSON.stringify(t.value);
  header.push(`inline const Value& ${snake(t.name)}() {`);
  header.push(`  static const Value v = json5_parse(`);
  header.push(`      ${rawLiteralFor(text)}).value;`);
  header.push("  return v;");
  header.push("}");
  header.push("");
}
header.push("struct SchemaTableRef {");
header.push("  const char16_t* name;");
header.push("  const Value& (*get)();");
header.push("};");
header.push("");
header.push("inline const std::vector<SchemaTableRef>& all_schema_table_refs() {");
header.push("  static const std::vector<SchemaTableRef> t = {");
for (const t of tables) {
  header.push(`    {${cxxU16(t.name)}, &${snake(t.name)}},`);
}
header.push("  };");
header.push("  return t;");
header.push("}");
header.push("");
header.push("}");
header.push("");
writeFileSync(out_header, header.join("\n"));

const tsOut = [];
const aliases = new Map();
let idx = 0;
for (const f of modules) {
  const name = `S${idx++}`;
  aliases.set(modPath(f), name);
  tsOut.push(`import * as ${name} from "${relFromSubjectGen(f)}";`);
}
tsOut.push("");
tsOut.push("export const SCHEMA_TABLES: { name: string; value: unknown }[] = [");
for (const t of tables) {
  tsOut.push(`  { name: ${JSON.stringify(t.name)}, value: ${aliases.get(t.module)}.${t.name} },`);
}
tsOut.push("];");
tsOut.push("");
writeFileSync(out_ts, tsOut.join("\n"));

process.stdout.write(`modules=${modules.length} schemas=${tables.length}\n`);
for (const t of tables) process.stdout.write(`  ${t.name} -> ${snake(t.name)}()\n`);
process.stdout.write(`-> ${relative(root, out_header)}\n-> ${relative(root, out_ts)}\n`);
