import { closest } from "../../../../src/LFW/bot/state/closest";
import { DummyEnum, dummy_updaters } from "../../../../src/LFW/bot/DummyEnum";
import { is_ray_hit } from "../../../../src/LFW/bot/utils/is_ray_hit";
import { NearestTargets } from "../../../../src/LFW/bot/NearestTargets";
import { manhattan_xz } from "../../../../src/LFW/helper/manhattan_xz";

import {
  esc,
  parseJsStringLiteral,
  parseValue,
  readCaseLines,
  renderValue,
  splitWs,
} from "./trace_util";

type Any = never;

const out: string[] = [];

function main(): void {
  const casePath = process.argv[2];
  if (!casePath) {
    process.stderr.write("usage: lfw_trace_bot_helpers.mjs <case-file>\n");
    process.exit(2);
  }

  const ents = new Map<string, unknown>();
  const nts = new Map<string, NearestTargets>();

  const nameOf = (v: unknown): string => {
    for (const [k, val] of ents) if (val === v) return k;
    return "?";
  };

  const entOf = (name: string): unknown => {
    if (!ents.has(name)) {
      process.stderr.write(`unknown entity '${name}'\n`);
      process.exit(2);
    }
    return ents.get(name);
  };

  for (const raw of readCaseLines(casePath)) {
    const t = splitWs(raw);
    if (t.length === 0) continue;
    const op = t[0]!;

    if (op === "de") {
      if (t.length !== 1) {
        process.stderr.write("de takes no operands\n");
        process.exit(2);
      }
      let i = 0;
      for (const [k, v] of Object.entries(DummyEnum)) {
        out.push(`de ${i++} ${esc(k)} ${esc(v as string)}`);
      }
      out.push(`de_updaters ${renderValue(Object.keys(dummy_updaters))}`);
      continue;
    }

    if (t.length < 3) {
      process.stderr.write(`too few operands: ${raw}\n`);
      process.exit(2);
    }

    if (op === "dxz") {
      const idx = [1];
      const a = parseJsStringLiteral(t[idx[0]!++]!);
      const b = parseJsStringLiteral(t[idx[0]!++]!);
      out.push(
        `dxz ${a} ${b} ` + renderValue(manhattan_xz(entOf(a) as Any, entOf(b) as Any)),
      );
      if (idx[0]! !== t.length) {
        process.stderr.write(`trailing token(s): ${raw}\n`);
        process.exit(2);
      }
      continue;
    }

    if (op === "ray") {
      const idx = [1];
      const a = parseJsStringLiteral(t[idx[0]!++]!);
      const b = parseJsStringLiteral(t[idx[0]!++]!);
      const ray = parseValue(t, idx);
      out.push(
        `ray ${a} ${b} ` +
          renderValue(is_ray_hit(entOf(a) as Any, entOf(b) as Any, ray as Any)),
      );
      if (idx[0]! !== t.length) {
        process.stderr.write(`trailing token(s): ${raw}\n`);
        process.exit(2);
      }
      continue;
    }

    if (op === "cl") {
      const idx = [1];
      const selfName = parseJsStringLiteral(t[idx[0]!++]!);
      const list: unknown[] = [];
      while (idx[0]! < t.length) list.push(entOf(parseJsStringLiteral(t[idx[0]!++]!)));
      const res = closest(entOf(selfName) as Any, ...(list as Any[]));
      out.push(`cl ${selfName} n=${list.length} res=${nameOf(res)}`);
      continue;
    }

    const sub = t[1]!;
    const name = parseJsStringLiteral(t[2]!);
    const idx = [3];

    if (op === "ent") {
      if (sub === "put") ents.set(name, parseValue(t, idx));
      else if (sub === "del") ents.delete(name);
      else {
        process.stderr.write(`unknown ent sub '${sub}'\n`);
        process.exit(2);
      }
      out.push(`ent ${name}`);
    } else if (op === "nt") {
      if (sub === "new") {
        nts.set(name, new NearestTargets(Number(parseValue(t, idx))));
      } else {
        const inst = nts.get(name);
        if (!inst) {
          process.stderr.write(`unknown nt '${name}'\n`);
          process.exit(2);
        }
        if (sub === "look") {
          const self = entOf(parseJsStringLiteral(t[idx[0]!++]!));
          const other = entOf(parseJsStringLiteral(t[idx[0]!++]!));
          inst.look(self as Any, other as Any);
        } else if (sub === "del") {
          const target = parseJsStringLiteral(t[idx[0]!++]!);
          const found = ents.has(target);
          const held = found ? ents.get(target) : undefined;
          inst.del((tgt) => found && tgt === held);
        } else if (sub === "sort") {
          inst.sort(entOf(parseJsStringLiteral(t[idx[0]!++]!)) as Any);
        } else if (sub === "clear") {
          inst.clear();
        } else if (sub !== "snap") {
          process.stderr.write(`unknown nt sub '${sub}'\n`);
          process.exit(2);
        }
      }

      const inst = nts.get(name)!;
      const first = inst.get();
      let line = `nt snap ${name} max=${renderValue(inst.max)}`;
      line += first
        ? ` get=${nameOf(first)} facing=${renderValue(first.facing)} x=${renderValue(first.position.x)}`
        : ` get=- facing=- x=-`;
      line += " targets=[";
      line += inst.targets.map((tg) => nameOf(tg)).join(",");
      line += "]";
      out.push(line);
    } else {
      process.stderr.write(`unknown op '${op}'\n`);
      process.exit(2);
    }

    if (idx[0]! !== t.length) {
      process.stderr.write(`trailing token(s): ${raw}\n`);
      process.exit(2);
    }
  }

  process.stdout.write(out.join("\n") + "\n");
}

main();
