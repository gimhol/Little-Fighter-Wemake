// `ui_style`（Style / isClass）的 TS 侧台面，op 与 `subjects/ui_style.cpp` 一一对应。
import { Style } from "../../../../src/LFW/ui/Style";
import { isClass } from "../../../../src/LFW/ui/utils/isClass";

import { keyOf, readCaseLines, renderValue, splitWs } from "./trace_util";

type Rec = Record<string, any>;

const log: string[] = [];
function push(s: string): void {
  log.push(s);
}
const num = (n: number): string => renderValue(n);

function sv(v: unknown): string {
  if (v === undefined) return "u";
  if (v === null) return "z";
  return renderValue(v);
}

function kind_to_value(raw: string): { ok: boolean; value?: unknown } {
  if (raw === "-" || raw === "u") return { ok: true, value: undefined };
  if (raw === "z") return { ok: true, value: null };
  if (raw.startsWith("str:")) return { ok: true, value: raw.slice(4) };
  if (raw.startsWith("num:")) return { ok: true, value: Number(raw.slice(4)) };
  if (raw.startsWith("bool:")) return { ok: true, value: Number(raw.slice(5)) !== 0 };
  return { ok: false };
}

const objs = new Map<string, Rec>();
const styles = new Map<string, Style>();
const style_of_obj = new Map<string, Style>();

class ClassA {}
class ClassB extends ClassA {}
class ClassC extends ClassB {}
const classes: Record<string, unknown> = { a: ClassA, b: ClassB, c: ClassC, none: null };

function main(): void {
  const rows = readCaseLines(process.argv[2]!).map((line) => splitWs(line));
  for (const tokens of rows) {
    if (tokens.length === 0) continue;
    const op = tokens[0]!;
    const i = [1];
    const nextKey = (): string => keyOf(tokens[i[0]!++]!);

    if (op === "obj") {
      objs.set(tokens[i[0]!++]!, {});
    } else if (op === "oset") {
      const oid = tokens[i[0]!++]!;
      const field = nextKey();
      const v = kind_to_value(tokens[i[0]!++]!);
      if (!v.ok) {
        push("oset|bad");
        continue;
      }
      objs.get(oid)![field] = v.value;
    } else if (op === "sf") {
      const sid = tokens[i[0]!++]!;
      const oid = tokens[i[0]!++]!;
      const s = Style.from(objs.get(oid) as never);
      const eq = style_of_obj.get(oid) === s;
      style_of_obj.set(oid, s);
      styles.set(sid, s);
      push(`sf|eq=${eq ? 1 : 0}|ver=${num(s.version)}`);
    } else if (op === "sget") {
      const s = styles.get(tokens[i[0]!++]!)!;
      const field = nextKey();
      push(`sget|${field}|${sv((s as unknown as Rec)[field])}`);
    } else if (op === "sset") {
      const s = styles.get(tokens[i[0]!++]!)!;
      const field = nextKey();
      const v = kind_to_value(tokens[i[0]!++]!);
      if (!v.ok) {
        push("sset|bad");
        continue;
      }
      (s as unknown as Rec)[field] = v.value;
    } else if (op === "sver") {
      const s = styles.get(tokens[i[0]!++]!)!;
      push(`sver|${num(s.version)}`);
    } else if (op === "stouch") {
      styles.get(tokens[i[0]!++]!)!.touch();
      push("stouch");
    } else if (op === "sassign") {
      const s = styles.get(tokens[i[0]!++]!)!;
      const oid = tokens[i[0]!++]!;
      s.assign(objs.get(oid) as never);
      push(`sassign|ver=${num(s.version)}`);
    } else if (op === "sdata") {
      const s = styles.get(tokens[i[0]!++]!)!;
      const oid = tokens[i[0]!++]!;
      s.data = objs.get(oid) as never;
      push(`sdata|ver=${num(s.version)}`);
    } else if (op === "sdatastyle") {
      const s = styles.get(tokens[i[0]!++]!)!;
      const other = styles.get(tokens[i[0]!++]!)!;
      s.data = other as never;
      push(`sdatastyle|ver=${num(s.version)}`);
    } else if (op === "snew") {
      styles.set(tokens[i[0]!++]!, new Style());
    } else if (op === "iscls") {
      const which = tokens[i[0]!++]!;
      const target = tokens[i[0]!++]!;
      const r = isClass(classes[which], classes[target] as never);
      push(`iscls|${which}|${target}|${r ? 1 : 0}`);
    } else {
      process.stderr.write(`unknown op '${op}'\n`);
      process.exit(2);
    }
  }
  process.stdout.write(log.join("\n") + "\n");
}

main();
