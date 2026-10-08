// `utils/schema` 家族（4W）的差分台面（TS 侧）：真 `SchemaValidator` + 生成表里的真 schema。
// 文法与 C++ 侧逐字一致，见 `schema.cpp` 头注。
import { check_phase_info, check_stage_info } from "../../../../src/LFW/loader/check_stage_info";
import { make_schema } from "../../../../src/LFW/utils/schema/make_schema";
import { SchemaValidator } from "../../../../src/LFW/utils/schema/validate_schema";

import { SCHEMA_TABLES } from "./gen/defines_schemas";

import { esc, keyOf, parseValue, readCaseLines, renderValue, splitWs } from "./trace_util";

const out: string[] = [];
const schemas = new Map<string, unknown>();
const validators = new Map<string, SchemaValidator>();
const values = new Map<string, unknown>();
const g_get_table = new Map<string, unknown>();

type Rec = Record<string, any>;

// 4AR：schema 字面里的 `$cls:X` 标记在 TS 侧还原成假类（C++ 侧保留标记字符串）。
class FakeNode {}
class FakeComp {}
const CLS_MAP: Rec = { FakeNode, FakeComp };

function deref(v: unknown): unknown {
  if (typeof v === "string" && v.startsWith("$cls:") && CLS_MAP[v.slice(5)]) return CLS_MAP[v.slice(5)];
  if (Array.isArray(v)) return v.map(deref);
  if (v !== null && typeof v === "object") {
    const o = v as Rec;
    for (const k of Object.keys(o)) o[k] = deref(o[k]);
    return o;
  }
  return v;
}

function psch_tree(s: unknown): string {
  if (s === undefined || s === null) return "k=u;t=u;p=u";
  const o = s as Rec;
  let r = "k=" + renderValue(o["key"]);
  const t = o["type"];
  r += ";t=" + renderValue(typeof t === "function" ? "$cls:" + (t as { name: string }).name : t);
  r += ";p=" + renderValue(o["path"]);
  if ("nullable" in o) r += ";n=" + renderValue(o["nullable"]);
  const props = o["properties"];
  if (props && typeof props === "object") {
    r += ";props=[";
    let first = true;
    for (const k of Object.keys(props as Rec)) {
      if (!first) r += ";";
      first = false;
      r += k + "={" + psch_tree((props as Rec)[k]) + "}";
    }
    r += "]";
  }
  const items = o["items"];
  if (items && typeof items === "object") r += ";items={" + psch_tree(items) + "}";
  return r;
}

function fail(what: string, detail: string): never {
  process.stderr.write(`${what}: ${detail}\n`);
  process.exit(2);
}

function findSchemaTable(name: string): unknown | undefined {
  for (const t of SCHEMA_TABLES) if (t.name === name) return t.value;
  return undefined;
}

function printMessages(tag: string, vid: string, ms: readonly string[]): void {
  for (let j = 0; j < ms.length; j++) out.push(`${tag}|${vid}|${j}|${esc(ms[j]!)}`);
}

function main(): void {
  const casePath = process.argv[2];
  if (!casePath) {
    process.stderr.write("usage: lfw_trace_schema.mjs <case-file>\n");
    process.exit(2);
  }

  for (const raw of readCaseLines(casePath)) {
    const t = splitWs(raw);
    if (t.length === 0) continue;
    const op = t[0]!;
    const i = [1];
    const next = (): string => t[i[0]!++]!;

    if (op === "nv") {
      validators.set(next(), new SchemaValidator());
    } else if (op === "sch") {
      const sid = next();
      const name = next();
      const s = findSchemaTable(name);
      if (s === undefined) fail("unknown schema table", name);
      schemas.set(sid, s);
    } else if (op === "schv") {
      const sid = next();
      schemas.set(sid, deref(parseValue(t, i)));
    } else if (op === "val") {
      const vid = next();
      const sid = next();
      const sv = schemas.get(sid);
      if (sv === undefined) fail("unbound schema", sid);
      const vv = validators.get(vid);
      if (vv === undefined) fail("unbound validator", vid);
      const value = parseValue(t, i);
      const b = vv.validate(value, sv as never);
      out.push(`v|${vid}|${sid}|${b ? "b1" : "b0"}|e=${vv.errors.length}|w=${vv.warnings.length}`);
      printMessages("ve", vid, vv.errors);
      printMessages("vw", vid, vv.warnings);
      out.push(`vv|${vid}|${renderValue(value)}`);
    } else if (op === "rz") {
      const vid = next();
      const vv = validators.get(vid);
      if (vv === undefined) fail("unbound validator", vid);
      vv.reset();
      out.push(`rz|${vid}|e=${vv.errors.length}|w=${vv.warnings.length}`);
    } else if (op === "cst") {
      const value = parseValue(t, i);
      const errs: string[] = [];
      const b = check_stage_info(value as never, errs);
      out.push(`cst|${b ? "b1" : "b0"}|e=${errs.length}`);
      printMessages("ce", "-", errs);
    } else if (op === "cph") {
      const stage = parseValue(t, i);
      const info = parseValue(t, i);
      const errs: string[] = [];
      const b = check_phase_info(stage as never, info as never, 0, errs);
      out.push(`cph|${b ? "b1" : "b0"}|e=${errs.length}`);
      printMessages("ce", "-", errs);
    } else if (op === "nvg" || op === "nvgo" || op === "nvso") {
      const vid = next();
      const v = new SchemaValidator();
      if (op !== "nvso") {
        v.instance_getter((raw: unknown, clazz: unknown, schema: unknown) => {
          out.push(`ig|${vid}|${renderValue(raw)}|${(clazz as { name: string }).name}|${esc(String((schema as Rec)["path"]))}`);
          const r = g_get_table.get(String(raw));
          return (r === undefined ? undefined : r) as never;
        });
      }
      if (op !== "nvgo") {
        v.instance_setter((value: unknown, raw: unknown, clazz: unknown, schema: unknown) => {
          out.push(`is|${vid}|${renderValue(value)}|${renderValue(raw)}|${(clazz as { name: string }).name}|${esc(String((schema as Rec)["path"]))}`);
        });
      }
      validators.set(vid, v);
    } else if (op === "gres") {
      const key = keyOf(next());
      g_get_table.set(key, parseValue(t, i));
    } else if (op === "vset") {
      values.set(next(), parseValue(t, i));
    } else if (op === "valv") {
      const vid = next();
      const vvid = next();
      const sid = next();
      const sv = schemas.get(sid);
      if (sv === undefined) fail("unbound schema", sid);
      const vv = validators.get(vid);
      if (vv === undefined) fail("unbound validator", vid);
      const val = values.get(vvid)!;
      const b = vv.validate(val, sv as never);
      out.push(`v|${vid}|${sid}|${b ? "b1" : "b0"}|e=${vv.errors.length}|w=${vv.warnings.length}`);
      printMessages("ve", vid, vv.errors);
      printMessages("vw", vid, vv.warnings);
    } else if (op === "gn" || op === "sn") {
      const vid = next();
      const vvid = next();
      const key = next();
      const vv = validators.get(vid);
      if (vv === undefined) fail("unbound validator", vid);
      const val = values.get(vvid)!;
      if (op === "gn") {
        try {
          const r = (val as Rec)[key];
          out.push(`gn|${vid}|${vvid}|${key}|ok|${renderValue(r)}`);
        } catch (e) {
          out.push(`gn|${vid}|${vvid}|${key}|err|${esc((e as Error).message ?? String(e))}`);
        }
      } else {
        const lit = parseValue(t, i);
        try {
          (val as Rec)[key] = lit;
          out.push(`sn|${vid}|${vvid}|${key}`);
        } catch (e) {
          out.push(`sn|${vid}|${vvid}|${key}|err|${esc((e as Error).message ?? String(e))}`);
        }
      }
    } else if (op === "mks") {
      const sid = next();
      // TS `make_schema` 根无 key 会抛；端口返回 undefined（头注里的已记录偏差），台面抹平。
      try {
        schemas.set(sid, make_schema(deref(parseValue(t, i)) as never));
      } catch {
        schemas.set(sid, undefined);
      }
    } else if (op === "psch") {
      const sid = next();
      if (!schemas.has(sid)) fail("unbound schema", sid);
      out.push(`psch|${sid}|${psch_tree(schemas.get(sid))}`);
    } else {
      process.stderr.write(`unknown op '${op}'\n`);
      process.exit(2);
    }
  }

  process.stdout.write(out.join("\n") + (out.length ? "\n" : ""));
}

main();
