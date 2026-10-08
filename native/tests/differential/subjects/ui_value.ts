// `ui_value`（read_info_value）的 TS 侧台面，op 与 `subjects/ui_value.cpp` 一一对应。
import {
  find_ui_value,
  is_0_or_1,
  parse_ui_value,
  unsafe_is_array,
  unsafe_is_object,
} from "../../../../src/LFW/ui/read_info_value";

import { keyOf, readCaseLines, renderValue, splitWs } from "./trace_util";

type Rec = Record<string, any>;

const log: string[] = [];
function push(s: string): void {
  log.push(s);
}

function sv(v: unknown): string {
  if (v === undefined) return "u";
  if (v === null) return "z";
  return renderValue(v);
}

function kind_to_value(raw: string): { ok: boolean; value?: unknown } {
  if (raw === "-" || raw === "u") return { ok: true, value: undefined };
  if (raw === "z") return { ok: true, value: null };
  if (raw === "arr") return { ok: true, value: [] };
  if (raw === "arr12") return { ok: true, value: [1, 2] };
  if (raw === "obj") return { ok: true, value: {} };
  if (raw.startsWith("str:")) return { ok: true, value: raw.slice(4) };
  if (raw.startsWith("num:")) return { ok: true, value: Number(raw.slice(4)) };
  if (raw.startsWith("bool:")) return { ok: true, value: Number(raw.slice(5)) !== 0 };
  return { ok: false };
}

function type_of_token(raw: string): { ok: boolean; value?: unknown } {
  if (raw === "null") return { ok: true, value: null };
  if (raw === "bool") return { ok: true, value: "boolean" };
  if (raw === "num") return { ok: true, value: "number" };
  if (raw === "str") return { ok: true, value: "string" };
  if (raw === "j01") return { ok: true, value: is_0_or_1 };
  if (raw === "jobj") return { ok: true, value: unsafe_is_object() };
  if (raw === "jarr") return { ok: true, value: unsafe_is_array };
  return { ok: false };
}

const uis = new Map<string, Rec>();

function values_group(id: string, group: string): Rec {
  const o = uis.get(id)!;
  o[group] ??= {};
  return o[group] as Rec;
}

function report(prefix: string, type: unknown, ui: unknown, v: unknown): void {
  try {
    const out = parse_ui_value(ui as never, type as never, v);
    push(out === null ? `${prefix}|null` : `${prefix}|v|${sv(out)}`);
  } catch (e) {
    const rec = e as Rec;
    const msg = rec["error"] ? rec["error"].message : (e as Error).message;
    push(`${prefix}|err|${msg}`);
  }
}

function main(): void {
  const rows = readCaseLines(process.argv[2]!).map((line) => splitWs(line));
  for (const tokens of rows) {
    if (tokens.length === 0) continue;
    const op = tokens[0]!;
    const i = [1];
    const nextKey = (): string => keyOf(tokens[i[0]!++]!);

    if (op === "uinew") {
      uis.set(tokens[i[0]!++]!, {});
    } else if (op === "uparent") {
      const id = tokens[i[0]!++]!;
      const pid = tokens[i[0]!++]!;
      uis.get(id)!["parent"] = uis.get(pid);
    } else if (op === "val" || op === "tval") {
      const id = tokens[i[0]!++]!;
      const name = nextKey();
      const v = kind_to_value(nextKey());
      if (!v.ok) {
        push(`${op}|bad`);
        continue;
      }
      values_group(id, op === "val" ? "values" : "template_values")[name] = v.value;
    } else if (op === "find") {
      const id = tokens[i[0]!++]!;
      const name = nextKey();
      push(`find|${name}|${sv(find_ui_value(uis.get(id) as never, name))}`);
    } else if (op === "puv") {
      const id = tokens[i[0]!++]!;
      const type = type_of_token(tokens[i[0]!++]!);
      if (!type.ok) {
        push("puv|badtype");
        continue;
      }
      const v = kind_to_value(nextKey());
      if (!v.ok) {
        push("puv|badkind");
        continue;
      }
      report("puv", type.value, uis.get(id), v.value);
    } else if (op === "puierr") {
      const type = type_of_token(tokens[i[0]!++]!);
      if (!type.ok) {
        push("puierr|badtype");
        continue;
      }
      const ui = kind_to_value(nextKey());
      if (!ui.ok) {
        push("puierr|badui");
        continue;
      }
      const v = kind_to_value(nextKey());
      if (!v.ok) {
        push("puierr|badkind");
        continue;
      }
      report("puierr", type.value, ui.value, v.value);
    } else {
      process.stderr.write(`unknown op '${op}'\n`);
      process.exit(2);
    }
  }
  process.stdout.write(log.join("\n") + "\n");
}

main();
