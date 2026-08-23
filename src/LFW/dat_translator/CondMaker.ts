export type CondBinOp = "==" | ">=" | "<=" | "!=" | "<" | ">" | (string & {})
export type CondValue = string | number | boolean;
export interface CondTermFormatter {
  (v1: CondValue, op: string, v2: CondValue): string;
}
export interface CondEdit<V1 extends CondValue = CondValue, V2 extends CondValue = CondValue> {
  (c: CondMaker<V1, V2>): CondMaker<V1, V2> | void;
}
export class CondMaker<V1 extends CondValue = CondValue, V2 extends CondValue = CondValue> {
  readonly __is_cond_maker__ = true;
  static readonly TAG = 'CondMaker'
  static readonly is = (v: any): v is CondMaker => v?.__is_cond_maker__ === true;
  private quote_on = false;
  private quote_char = '"';
  private quote(v: string): string {
    if (!this.quote_on) return v;
    return `${this.quote_char}${v.split(this.quote_char).join('\\' + this.quote_char)}${this.quote_char}`;
  }
  private parts: (string | CondMaker<V1, V2>)[] = [];
  private term: CondTermFormatter = (v1, op, v2) => `${v1}${op}${v2}`;
  private opok(func: string, ...op: (string | undefined)[]): void {
    const last = this.parts[this.parts.length - 1];
    if (op.some(v => v === last))
      return;
    throw new Error(
      `[CondMaker::${func}] missing operator: "${CondMaker.is(last) ? last.done() : last}" ` +
      `Use .and(...)/.or(...) between conditions. ` +
      `Current: "${this.done()}"`
    )
  }
  private assert_value(v: unknown, where: string): asserts v is CondValue {
    const t = typeof v;
    if (t !== 'string' && t !== 'number' && t !== 'boolean')
      throw new Error(
        `[CondMaker::${where}] invalid operand: ${JSON.stringify(v)} (${t}). ` +
        `Operands must be string | number | boolean.`
      );
  }
  private assert_op(op: unknown, where: string): asserts op is CondBinOp {
    if (typeof op !== 'string' || op.length === 0)
      throw new Error(
        `[CondMaker::${where}] invalid operator: ${JSON.stringify(op)}. ` +
        `Operator must be a non-empty string.`
      );
    if (op === '||' || op === '&&' || op === '!')
      throw new Error(
        `[CondMaker::${where}] reserved operator: "${op}". ` +
        `"||" / "&&" / "!" are reserved as logical separators and cannot be used as comparison operators.`
      );
  }
  private assert_fn(fn: unknown, where: string): asserts fn is Function {
    if (typeof fn !== 'function')
      throw new Error(
        `[CondMaker::${where}] expected a function, got: ${fn === null ? 'null' : typeof fn}.`
      );
  }
  private child(): CondMaker<V1, V2> {
    const c = new CondMaker<V1, V2>();
    c.term = this.term;
    c.quote_on = this.quote_on;
    c.quote_char = this.quote_char;
    return c;
  }
  quote_strings(on: boolean = true, quote: '"' | "'" = '"'): this {
    if (quote != '"' && quote != "'")
      throw new Error(
        `[CondMaker::quote_strings] unsupported quote character: "${quote}". ` +
        `Only '"' (double quote) or "'" (single quote) is allowed.`
      )
    this.quote_on = !!on;
    this.quote_char = quote;
    return this;
  }
  term_format(fn: CondTermFormatter): this {
    this.assert_fn(fn, 'term_format');
    this.term = fn;
    return this;
  }

  add(func: CondEdit<V1, V2>): this;
  add(v1: V1, op: CondBinOp, v2: V2): this;
  add(p1: V1 | CondEdit<V1, V2>, p2?: CondBinOp, p3?: V2): this
  add(p1: V1 | CondEdit<V1, V2>, p2?: CondBinOp, p3?: V2): this {
    if (typeof p1 === "function") return this.wrap(p1);
    this.opok('add', void 0, '||', '&&');
    if (p1 == void 0 || p2 == void 0 || p3 == void 0)
      throw new Error(
        `[CondMaker::add] incomplete comparison: missing operator or value` +
        `(got: add(${p1}, ${p2}, ${p3})). ` +
        `Use .add(v1, op, v2) / .and(v1, op, v2) / .or(v1, op, v2). ` +
        `Current: "${this.done()}"`
      );
    this.assert_value(p1, 'add');
    this.assert_value(p3, 'add');
    this.assert_op(p2, 'add');
    if (this.quote_on) {
      const v1 = typeof p1 == 'string' ? this.quote(p1) : p1;
      const v2 = typeof p3 == 'string' ? this.quote(p3) : p3;
      this.parts.push(this.term(v1, p2, v2));
    } else {
      this.parts.push(this.term(p1, p2, p3));
    }
    return this;
  }

  not(func: CondEdit<V1, V2>): this {
    this.assert_fn(func, 'not');
    this.opok('not', void 0, '||', '&&');
    this.parts.push("!");
    this.wrap(func);
    return this;
  }

  wrap(func: CondEdit<V1, V2>): this {
    this.assert_fn(func, 'wrap');
    this.opok('wrap', void 0, '||', '&&', '!');
    const c1 = this.child();
    const c2 = func(c1);
    this.parts.push(c2 instanceof CondMaker ? c2 : c1)
    return this;
  }

  one_of(v1: V1, ...v2: V2[]): this {
    this.assert_value(v1, 'one_of');
    if (!v2.length)
      throw new Error(
        `[CondMaker::one_of] at least one value is required (got: one_of(${v1})).`
      );
    this.opok('one_of', void 0, '||', '&&', '!');
    return this.wrap(c => v2.forEach(v => c.or(v1, "==", v)));
  }
  and_one_of(v1: V1, ...v2: V2[]): this {
    this.assert_value(v1, 'and_one_of');
    if (!v2.length)
      throw new Error(
        `[CondMaker::and_one_of] at least one value is required (got: and_one_of(${v1})).`
      );
    return this.and(c => v2.forEach(v => c.or(v1, "==", v)));
  }
  or_one_of(v1: V1, ...v2: V2[]): this {
    this.assert_value(v1, 'or_one_of');
    if (!v2.length)
      throw new Error(
        `[CondMaker::or_one_of] at least one value is required (got: or_one_of(${v1})).`
      );
    return this.or(c => v2.forEach(v => c.or(v1, "==", v)));
  }

  not_in(v1: V1, ...v2: V2[]): this {
    this.assert_value(v1, 'not_in');
    if (!v2.length)
      throw new Error(
        `[CondMaker::not_in] at least one value is required (got: not_in(${v1})).`
      );
    this.opok('not_in', void 0, '||', '&&', '!');
    return this.wrap(c => v2.forEach(v => c.and(v1, "!=", v)));
  }
  and_not_in(v1: V1, ...v2: V2[]): this {
    this.assert_value(v1, 'and_not_in');
    if (!v2.length)
      throw new Error(
        `[CondMaker::and_not_in] at least one value is required (got: and_not_in(${v1})).`
      );
    return this.and(c => v2.forEach(v => c.and(v1, "!=", v)));
  }
  or_not_in(v1: V1, ...v2: V2[]): this {
    this.assert_value(v1, 'or_not_in');
    if (!v2.length)
      throw new Error(
        `[CondMaker::or_not_in] at least one value is required (got: or_not_in(${v1})).`
      );
    return this.or(c => v2.forEach(v => c.and(v1, "!=", v)));
  }

  or(func: CondEdit<V1, V2>): this;
  or(v1: V1, op: CondBinOp, v2: V2): this;
  or(p1: V1 | CondEdit<V1, V2>, p2?: CondBinOp, p3?: V2): this {
    this.parts.length && this.parts.push("||");
    return this.add(p1, p2, p3);
  }

  and(func: CondEdit<V1, V2>): this;
  and(v1: V1, op: CondBinOp, v2: V2): this;
  and(p1: V1 | CondEdit<V1, V2>, p2?: CondBinOp, p3?: V2): this {
    this.parts.length && this.parts.push("&&");
    return this.add(p1, p2, p3);
  }

  toString(): string {
    return `${CondMaker.TAG} { text: ${this.done()} }`
  }
  done(): string {
    let ret = ''
    if (this.parts.length === 1 && CondMaker.is(this.parts[0]))
      ret = this.parts[0].done();
    else
      ret = this.parts.map(v => CondMaker.is(v) ? `(${v.done()})` : `${v}`.trim()).join("").replace(/\n|\r/g, "").trim()
    return ret;
  }
}
