export type CondBinOp = "==" | ">=" | "<=" | "!=" | "<" | ">"
export type CondValue = string | number | boolean;
export interface CondEdit<V1 extends CondValue = CondValue, V2 extends CondValue = CondValue, BinOp extends CondBinOp = CondBinOp> {
  (c: CondMaker<V1, V2, BinOp>): unknown;
}
export class CondMaker<V1 extends CondValue = CondValue, V2 extends CondValue = CondValue, BinOp extends CondBinOp = CondBinOp> {
  readonly __is_cond_maker__ = true;
  static readonly TAG = 'CondMaker'
  static readonly is = (v: any): v is CondMaker => v?.__is_cond_maker__ === true;
  private parts: (CondValue | BinOp | CondMaker)[] = [];

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

  add(func: CondEdit<V1, V2>): this;
  add(v1: V1, op: BinOp, v2: V2): this;
  add(p1: V1 | CondEdit<V1, V2>, p2?: BinOp, p3?: V2): this
  add(p1: V1 | CondEdit<V1, V2>, p2?: BinOp, p3?: V2): this {
    if (typeof p1 === "function") return this.wrap(p1);
    this.opok('add', void 0, '||', '&&');
    this.parts.push(`${p1}${p2}${p3}`);
    return this;
  }

  not(func: CondEdit<V1, V2>): this {
    this.opok('not', void 0, '||', '&&');
    this.parts.push("!");
    this.wrap(func);
    return this;
  }

  wrap(func: CondEdit<V1, V2>): this {
    this.opok('wrap', void 0, '||', '&&', '!');
    const c1 = new CondMaker();
    const c2 = func(c1);
    this.parts.push(c2 instanceof CondMaker ? c2 : c1)
    return this;
  }

  one_of(v1: V1, ...v2: V2[]): this {
    this.opok('one_of', void 0, '||', '&&', '!');
    return this.wrap(c => v2.forEach(v => c.or(v1, "==", v)));
  }
  and_one_of(v1: V1, ...v2: V2[]): this {
    return this.and(c => v2.forEach(v => c.or(v1, "==", v)));
  }
  or_one_of(v1: V1, ...v2: V2[]): this {
    return this.or(c => v2.forEach(v => c.or(v1, "==", v)));
  }

  not_in(v1: V1, ...v2: V2[]): this {
    this.opok('not_in', void 0, '||', '&&', '!');
    return this.wrap(c => v2.forEach(v => c.and(v1, "!=", v)));
  }
  and_not_in(v1: V1, ...v2: V2[]): this {
    return this.and(c => v2.forEach(v => c.and(v1, "!=", v)));
  }
  or_not_in(v1: V1, ...v2: V2[]): this {
    return this.or(c => v2.forEach(v => c.and(v1, "!=", v)));
  }

  or(func: CondEdit<V1, V2>): this;
  or(v1: V1, op: BinOp, v2: V2): this;
  or(p1: V1 | CondEdit<V1, V2>, p2?: BinOp, p3?: V2): this {
    this.parts.length && this.parts.push("||");
    return this.add(p1, p2, p3);
  }

  and(func: CondEdit<V1, V2>): this;
  and(v1: V1, op: BinOp, v2: V2): this;
  and(p1: V1 | CondEdit<V1, V2>, p2?: BinOp, p3?: V2): this {
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
