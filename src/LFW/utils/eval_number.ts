import type { TNumberExpr } from "../defines/IDirectorData";

export type TEvalContext = Record<string, number>;

export function eval_number(value: TNumberExpr | null | undefined, ctx: TEvalContext): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const src = value.trim();
  if (!src) return 0;

  let i = 0;
  const skip = () => {
    while (i < src.length && (src[i] === " " || src[i] === "\t")) i++;
  };
  const fail = (): never => {
    throw new Error(`[eval_number] invalid expression: "${value}"`);
  };

  function parse_expr(): number {
    let v = parse_term();
    for (; ;) {
      skip();
      const c = src[i];
      if (c !== "+" && c !== "-") return v;
      i++;
      const r = parse_term();
      v = c === "+" ? v + r : v - r;
    }
  }
  function parse_term(): number {
    let v = parse_factor();
    for (; ;) {
      skip();
      const c = src[i];
      if (c !== "*" && c !== "/") return v;
      i++;
      const r = parse_factor();
      v = c === "*" ? v * r : v / r;
    }
  }
  function parse_factor(): number {
    skip();
    const c = src[i];
    if (c === "+") { i++; return parse_factor(); }
    if (c === "-") { i++; return -parse_factor(); }
    if (c === "(") {
      i++;
      const v = parse_expr();
      skip();
      if (src[i] !== ")") fail();
      i++;
      return v;
    }
    const num = /^\d+(?:\.\d+)?/.exec(src.slice(i));
    if (num) {
      i += num[0].length;
      return Number(num[0]);
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (name) {
      i += name[0].length;
      const v = ctx[name[0]];
      if (v === void 0) fail();
      return v;
    }
    return fail();
  }

  const ret = parse_expr();
  skip();
  if (i !== src.length) fail();
  return ret;
}
