#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const src_lfw = resolve(root, "src/LFW");
const src_defines = resolve(src_lfw, "defines");
const src_ui = resolve(src_lfw, "ui");
const gen_dir = resolve(root, "native/build/gen");

function walk(dir, out) {
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith(".ts")) out.push(p);
  }
  return out;
}

// defines/ 全量扫（枚举/字段表/schema）；ui/ 只扫带 `export const Schema_` 的文件
// （4AH 起 `Schema_IUIImgInfo` 在 UI 侧，其余 UI 导出不在本工具口径内）。
const modules = [
  ...walk(src_defines, []).filter((f) => f.split(/[\\/]/).pop() !== "index.ts"),
  ...walk(src_ui, []).filter((f) => /export\s+const\s+Schema_\w+/.test(readFileSync(f, "utf8"))),
];
const key = (f) => relative(src_lfw, f).replace(/\.ts$/, "").split("\\").join("/");
const alias = (f) => `M_${key(f).replace(/[^A-Za-z0-9]/g, "_")}`;

const lines = [];
for (const f of modules) {
  lines.push(
    `import * as ${alias(f)} from "${relative(gen_dir, src_lfw).split("\\").join("/")}/${key(f)}";`,
  );
}
lines.push("");
lines.push("const mods: [string, Record<string, unknown>][] = [");
for (const f of modules) lines.push(`  [${JSON.stringify(key(f))}, ${alias(f)} as unknown as Record<string, unknown>],`);
lines.push("];");
lines.push("");
lines.push("const seen = new Map<object, number>();");
lines.push("const groups: { names: string[]; kind: string }[] = [];");
lines.push("const out: { module: string; name: string; kind: string; count: number; group: number }[] = [];");
lines.push("const isMeta = (k: string) => /(Descriptions|Labels|Names|_NAMES|_LABEL_MAP|_DESC_MAP|_NAME_MAP|_descriptions|_labels)$/.test(k);");
lines.push("for (const [path, m] of mods) {");
lines.push("  for (const k of Object.keys(m)) {");
lines.push("    const v = m[k];");
lines.push("    if (v === null || typeof v !== 'object') continue;");
lines.push("    if (Array.isArray(v)) continue;");
lines.push("    const entries: [string, unknown][] = v instanceof Map ? [...v.entries()].map(([a, b]) => [String(a), b]) : Object.entries(v as Record<string, unknown>);");
lines.push("    if (entries.length === 0) continue;");
lines.push("    const isNumKey = (s: string) => /^-?\\d+$/.test(s);");
lines.push("    const hasReverse = entries.some(([kk, vv]) => isNumKey(kk) && typeof vv === 'string');");
lines.push("    const hasForward = entries.some(([kk, vv]) => !isNumKey(kk) && typeof vv === 'number');");
lines.push("    const allStrings = entries.every(([, vv]) => typeof vv === 'string');");
lines.push("    const allNumericKeys = entries.every(([kk]) => isNumKey(kk));");
lines.push("    let kind = 'other';");
lines.push("    let group = -1;");
lines.push("    if (k.startsWith('Schema_')) kind = 'schema';");
lines.push("    else if (k.endsWith('_fields')) kind = 'field-table';");
lines.push("    else if (isMeta(k) || (allNumericKeys && allStrings)) kind = 'label-map';");
lines.push("    else if (hasReverse && hasForward) kind = 'number-enum';");
lines.push("    else if (allStrings) kind = 'text-enum?';");
lines.push("    if (kind === 'number-enum' || kind === 'text-enum?') {");
lines.push("      const g = seen.get(v as object);");
lines.push("      if (g === undefined) {");
lines.push("        group = groups.length;");
lines.push("        seen.set(v as object, group);");
lines.push("        groups.push({ names: [k], kind });");
lines.push("      } else {");
lines.push("        group = g;");
lines.push("        groups[g].names.push(k);");
lines.push("        kind = 'alias';");
lines.push("      }");
lines.push("    }");
lines.push("    out.push({ module: path, name: k, kind, count: entries.length, group });");
lines.push("  }");
lines.push("}");
lines.push("const groupsInfo = groups.map((g) => ({ names: g.names, kind: g.kind }));");
lines.push("console.log(JSON.stringify({ found: out, groups: groupsInfo }));");

mkdirSync(gen_dir, { recursive: true });
const entry = join(gen_dir, "defines_coverage.ts");
writeFileSync(entry, lines.join("\n"));

const requireFromLfw = createRequire(join(root, "src", "LFW", "package.json"));
const esbuild = requireFromLfw("esbuild");
const bundle = join(gen_dir, "defines_coverage.mjs");
esbuild.buildSync({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile: bundle,
  logLevel: "warning",
});

const payload = JSON.parse(execFileSync(process.execPath, [bundle], { encoding: "utf8", maxBuffer: 1 << 28 }));
const found = payload.found;
const groups = payload.groups;

const enumHeader = readFileSync(resolve(root, "native/lfw/defines/all_enums.h"), "utf8");
const enumsExtra = readFileSync(resolve(root, "native/lfw/defines/all_enums_extra.h"), "utf8");
const fieldsHeader = readFileSync(resolve(root, "native/lfw/defines/fields_gen.h"), "utf8");
const schemasHeader = readFileSync(resolve(root, "native/lfw/defines/schemas_gen.h"), "utf8");

const registered = (text) => {
  const names = new Set();
  for (const m of text.matchAll(/\{\s*u"([^"]+)"\s*,\s*&/g)) names.add(m[1]);
  return names;
};
const cxxEnums = new Set([...registered(enumHeader), ...registered(enumsExtra)]);
const cxxFields = registered(fieldsHeader);
const cxxSchemas = registered(schemasHeader);

const tsFieldTables = new Set(found.filter((f) => f.kind === "field-table").map((f) => f.name));
const tsSchemas = new Set(found.filter((f) => f.kind === "schema").map((f) => f.name));
const tsNumberEnums = new Set(
  groups.filter((g) => g.kind === "number-enum").flatMap((g) => g.names),
);
const tsTextCandidates = new Set(
  groups.filter((g) => g.kind === "text-enum?").flatMap((g) => g.names),
);
const covered = (set, cxxSet) => new Set([...set].filter((n) => cxxSet.has(n)));

const report = [];
const review = [];

const checkGroups = (kind, cxxSet, soft) => {
  for (const g of groups.filter((x) => x.kind === kind)) {
    if (g.names.some((n) => cxxSet.has(n))) continue;
    (soft ? review : report).push(`${kind} MISSING in C++: ${g.names.join(" / ")}`);
  }
};
checkGroups("number-enum", cxxEnums, false);
checkGroups("text-enum?", cxxEnums, true);
for (const n of [...tsFieldTables].sort()) {
  if (!cxxFields.has(n)) report.push(`field-table MISSING in C++: ${n}`);
}
for (const n of [...cxxFields].sort()) {
  if (!tsFieldTables.has(n)) report.push(`field-table EXTRA in C++: ${n}`);
}
for (const n of [...tsSchemas].sort()) {
  if (!cxxSchemas.has(n)) report.push(`schema MISSING in C++: ${n}`);
}
for (const n of [...cxxSchemas].sort()) {
  if (!tsSchemas.has(n)) report.push(`schema EXTRA in C++: ${n}`);
}

process.stdout.write(`TS modules: ${modules.length}\n`);
process.stdout.write(`TS field tables: ${tsFieldTables.size}, C++ registered: ${cxxFields.size}\n`);
process.stdout.write(`TS schemas: ${tsSchemas.size}, C++ registered: ${cxxSchemas.size}\n`);
process.stdout.write(
  `TS enum groups: number=${groups.filter((g) => g.kind === "number-enum").length}` +
    ` text=${groups.filter((g) => g.kind === "text-enum?").length}` +
    ` (covered-by-any-name: ${covered(new Set(groups.flatMap((g) => g.names)), cxxEnums).size})` +
    `, C++ registered: ${cxxEnums.size}\n`,
);
const byKind = {};
for (const f of found) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
process.stdout.write(`kinds: ${JSON.stringify(byKind)}\n`);
if (review.length > 0) {
  process.stdout.write(`needs review (${review.length}) -- 不确定是不是枚举，人工确认:\n`);
  for (const r of review) process.stdout.write(`  ${r}\n`);
}
if (report.length === 0) {
  process.stdout.write("coverage: OK\n");
} else {
  process.stdout.write(`coverage problems (${report.length}):\n`);
  for (const r of report) process.stdout.write(`  ${r}\n`);
}
process.exit(report.length === 0 ? 0 : 1);
