// `ui_base`（UI 叶层）的 TS 侧台面，op 与 `subjects/ui_base.cpp` 一一对应。
import { RGBA_MAP } from "../../../../src/LFW/ui/utils/color_map";
import { hex_to_rgba } from "../../../../src/LFW/ui/utils/hex_to_rgba";
import { int_to_rgba } from "../../../../src/LFW/ui/utils/int_to_rgba";
import { parse_rgba } from "../../../../src/LFW/ui/utils/parse_rgba";
import { parse_call_func_expression } from "../../../../src/LFW/ui/utils/parse_call_func_expression";
import { read_func_args } from "../../../../src/LFW/ui/utils/read_func_args";
import { CrossInfo } from "../../../../src/LFW/ui/CrossInfo";

import { keyOf, readCaseLines, renderValue, splitWs } from "./trace_util";

type Rec = Record<string, any>;

const log: string[] = [];
function push(s: string): void {
  log.push(s);
}
const num = (n: number): string => renderValue(n);
const render_value = (v: unknown): string => renderValue(v);

function dump_rgba(c: { r: number; g: number; b: number; a: number }): string {
  return `${num(c.r)},${num(c.g)},${num(c.b)},${num(c.a)}`;
}

function kind_to_value(raw: string): { ok: boolean; value?: unknown; undef?: boolean } {
  if (raw === "-" || raw === "u") return { ok: true, undef: true };
  if (raw === "z") return { ok: true, value: null };
  if (raw.startsWith("str:")) return { ok: true, value: raw.slice(4) };
  if (raw.startsWith("num:")) return { ok: true, value: Number(raw.slice(4)) };
  return { ok: false };
}

function main(): void {
  const t = readCaseLines(process.argv[2]!).map((line) => splitWs(line));
  for (const tokens of t) {
    if (tokens.length === 0) continue;
    const op = tokens[0]!;
    const i = [1];
    const nextKey = (): string => keyOf(tokens[i[0]!++]!);

    if (op === "hex") {
      const src = nextKey();
      const c = hex_to_rgba(src);
      push(`hex|${src}|${c ? dump_rgba(c) : "null"}`);
    } else if (op === "inti") {
      const n = Number(tokens[i[0]!++]!);
      const c = int_to_rgba(n);
      push(`inti|${num(n)}|${c ? dump_rgba(c) : "null"}`);
    } else if (op === "col" || op === "colget") {
      const kind = nextKey();
      const parsed = kind_to_value(kind);
      if (!parsed.ok) {
        push(`${op}|${kind}|bad`);
        continue;
      }
      const r =
        op === "col"
          ? parse_rgba(parsed.value as never)
          : (RGBA_MAP.get((parsed.undef ? undefined : parsed.value) as never) as Rec);
      let body: string;
      if (r === undefined) body = op === "colget" && parsed.undef ? "undef" : "null";
      else if (r === null) body = "null";
      else body = dump_rgba(r as Rec);
      push(`${op}|${kind}|${body}`);
    } else if (op === "callexpr") {
      const text = nextKey();
      const r = parse_call_func_expression(text);
      if (!r) {
        push("callexpr|null");
      } else {
        push(`callexpr|${r.id}|${r.name}|${r.args.join(",")}|e${r.enabled ? 1 : 0}`);
      }
    } else if (op === "funcargs") {
      const text = nextKey();
      const name = nextKey();
      const min = i[0] < tokens.length ? Number(tokens[i[0]!++]!) : -1;
      const r = read_func_args(text, name, min);
      push(r ? `funcargs|${r.join(",")}` : "funcargs|null");
    } else if (op === "cross" || op === "crossmix") {
      const a = new CrossInfo({
        left: Number(tokens[i[0]!++]!),
        top: Number(tokens[i[0]!++]!),
        right: Number(tokens[i[0]!++]!),
        bottom: Number(tokens[i[0]!++]!),
        mid_x: Number(tokens[i[0]!++]!),
        mid_y: Number(tokens[i[0]!++]!),
      });
      const o: Rec = { left: a.left, top: a.top, right: a.right };
      if (op === "cross") {
        o["bottom"] = a.bottom;
        o["mid_x"] = a.mid_x;
        o["mid_y"] = a.mid_y;
      } else {
        o["bottom"] = "9";
        o["mid_y"] = null;
      }
      const b = new CrossInfo(o);
      const c = b.clone();
      push(
        `cross|${num(b.left)},${num(b.top)},${num(b.right)},${num(b.bottom)}|${num(b.mid_x)},${num(b.mid_y)}|cmp=${a.compare(b) ? 1 : 0}|clone=${num(c.left)},${num(c.top)},${num(c.right)},${num(c.bottom)},${num(c.mid_x)},${num(c.mid_y)}`,
      );
    } else {
      process.stderr.write(`unknown op '${op}'\n`);
      process.exit(2);
    }
  }
  process.stdout.write(log.join("\n") + "\n");
}

main();
