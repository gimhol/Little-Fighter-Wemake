// `ui_img_info`（validate_ui_img_info；4AH）的 TS 侧台面：真校验器 + 真 `Schema_IUIImgInfo`。
// op 与 `subjects/ui_img_info.cpp` 一一对应。
import { validate_ui_img_info } from "../../../../src/LFW/ui/utils/validate_ui_img_info";

import { esc, parseValue, readCaseLines, renderValue, splitWs } from "./trace_util";

const log: string[] = [];
function push(s: string): void {
  log.push(s);
}

function main(): void {
  const rows = readCaseLines(process.argv[2]!).map((line) => splitWs(line));
  for (const tokens of rows) {
    if (tokens.length === 0) continue;
    const op = tokens[0]!;
    const i = [1];
    const next = (): string => tokens[i[0]!++]!;

    if (op === "tag") {
      push(`tag|${esc(validate_ui_img_info.TAG)}`);
    } else if (op === "v" || op === "vd") {
      const vid = next();
      const value = parseValue(tokens, i);
      const errs: string[] = [];
      const warns: string[] = [];
      const ok =
        op === "v" ? validate_ui_img_info(value, errs, warns) : validate_ui_img_info(value);
      if (op === "v") {
        push(`v|${vid}|${ok ? "b1" : "b0"}|e=${errs.length}|w=${warns.length}`);
        errs.forEach((m, j) => push(`ve|${vid}|${j}|${esc(m)}`));
        warns.forEach((m, j) => push(`vw|${vid}|${j}|${esc(m)}`));
      } else {
        push(`vd|${vid}|${ok ? "b1" : "b0"}`);
      }
      push(`vv|${vid}|${renderValue(value)}`);
    } else {
      process.stderr.write(`unknown op '${op}'\n`);
      process.exit(2);
    }
  }
  process.stdout.write(log.join("\n") + "\n");
}

main();
