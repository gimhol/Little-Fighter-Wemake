import { Ditto } from "../ditto/Instance";
import { BinOp, type TBinOp } from "../defines/BinOp";
import {
  type IExpression, type IJudger, type IValGetterGetter
} from "../defines/IExpression";
export function ALWAY_FALSE<T = unknown>(
  text: string,
  err?: string,
): IJudger<T> {
  return { run: () => false, text, err, result: false };
}
const a_included_b = (a: any[], b: any[]) => {
  return !b.length || b.findIndex((i) => a.indexOf(i) < 0) === -1;
};
export const predicate_maps: Record<BinOp, (a: any, b: any) => boolean> = {
  // eslint-disable-next-line eqeqeq
  "==": (a, b) => a == b,
  // eslint-disable-next-line eqeqeq
  "!=": (a, b) => a != b,
  ">=": (a, b) => a >= b,
  "<=": (a, b) => a <= b,
  "<": (a, b) => a < b,
  ">": (a, b) => a > b,
  "{{": a_included_b,
  "}}": (a: any[], b: any[]) => a_included_b(b, a),
  "!{": (a: any[], b: any[]) => !a_included_b(a, b),
  "!}": (a: any[], b: any[]) => !a_included_b(b, a),
};

export interface IExprDebug {
  text: string;
  result: boolean | undefined;
  err?: string;
  op?: any;
  val_1?: any;
  val_2?: any;
  before: string;
  not: boolean;
  children: IExprDebug[];
}

export function stringify_expr_debug(n: IExprDebug, depth = 0): string {
  const ind = '  '.repeat(depth);
  const link = n.before === '&' ? '&& ' : n.before === '|' ? '|| ' : '';
  const neg = n.not ? '!' : '';
  const res = n.result === void 0 ? '?' : String(n.result);
  const vals = n.op !== void 0
    ? `   [${JSON.stringify(n.val_1)} ${n.op} ${JSON.stringify(n.val_2)}]`
    : '';
  const err = n.err ? `   [ERR: ${n.err}]` : '';
  const lines = [`${ind}${link}${neg}${n.text || '(group)'} => ${res}${vals}${err}`];
  for (const c of n.children) lines.push(stringify_expr_debug(c, depth + 1));
  return lines.join('\n');
}

export class Expression<T1, T2 = T1> implements IExpression<T1, T2> {
  readonly is_expression = true;
  static is = (v: any): v is Expression<unknown> => v?.is_expression === true;
  readonly children: IExpression<T1, T2>[] = [];
  readonly get_val_getter: IValGetterGetter<T1 | T2>;
  err?: string | undefined;
  text: string = "";
  result?: boolean | undefined;
  before: string = "";
  not: boolean = false;

  op: any;
  val_1: any;
  val_2: any;

  constructor(
    arg_0: string | null,
    get_val_getter: IValGetterGetter<T1 | T2>,
  ) {
    this.get_val_getter = get_val_getter;
    if (typeof arg_0 === "string") {
      this.text = arg_0.replace(/\s|\n|\r/g, "");
      let p = 0;
      const count = this.text.length + 1;
      let i = 0;
      let letter: string = "";
      let before: string = "";

      for (; i < count; ++i) {
        letter = this.text[i] || '';
        if ("!" === letter && this.text[i + 1] === "(") {
          const child = new Expression<T1, T2>(
            this.text.substring(i + 2),
            get_val_getter,
          );
          child.not = true;
          child.before = before;
          i += child.text.length + 2;
          p = i + 2;
          this.children.push(child);
        } else if ("(" === letter) {
          const child = new Expression<T1, T2>(
            this.text.substring(i + 1),
            get_val_getter,
          );
          child.before = before;
          i += child.text.length + 1;
          p = i + 1;
          this.children.push(child);
        } else if ("|" === letter || "&" === letter) {
          let db = false
          if (this.text[i + 1] == letter) {
            db = true;
            ++i
          }
          // 仅在切片确实非空时才创建子判断；否则（如 `(...)` 分组后紧跟 &&/||，
          // 双字符检测 ++i 会让 p 与切片起点重合）跳过，避免产生 [empty text] 空节点
          if (p < (db ? i - 1 : i)) {
            const child = new Expression<T1, T2>(null, get_val_getter);
            child.judger(this.text.substring(p, db ? i - 1 : i).replace(/\)*$/g, ""))
            child.before = before;
            this.children.push(child);
            before = letter;
          } else {
            before = letter;
          }
          p = i + 1;
        } else if (")" === letter || '' === letter) {
          if (p < i) {
            const child = new Expression<T1, T2>(null, get_val_getter);
            child.judger(this.text.substring(p, i))
            child.before = before;
            this.children.push(child);
          }
          break;
        }
      }
      this.text = this.text.substring(0, i);
    }
  }
  private alway_false(err: string): void {
    this.err = err
    this.result = false;
    this.run = () => false;
  }
  private judger(text: string): void {
    this.text = text
    if (!text) return this.alway_false("[empty text]")

    const reg_result =
      text.match(/(\S*)\s*(==|!=|<=|>=|\{\{|\}\}|!\{|!\})\s?(\S*)/) ||
      text.match(/(\S*)\s*(=|<|>)\s?(\S*)/);
    if (!reg_result) return this.alway_false(`[wrong expression: ${text}]`);
    const [, word_1, op, word_2] = reg_result;
    this.op = op;
    if (!word_1 || !word_2) return this.alway_false(`[wrong expression: ${text}]`);
    const predicate = predicate_maps[op as TBinOp];
    if (!predicate) return this.alway_false(`wrong operator: ${op}`);

    const getter_1 = this.get_val_getter(word_1);
    const getter_2 = this.get_val_getter(word_2);
    let val_1: any = word_1;
    let val_2: any = word_2;
    if (
      op === BinOp.Include ||
      op === BinOp.IncludedBy ||
      op === BinOp.NotInclude ||
      op === BinOp.NotIncludedBy
    ) {
      if (!getter_1) val_1 = word_1.split(",");
      if (!getter_2) val_2 = word_2.split(",");
    }
    if (!getter_1 && !getter_2) {
      const result = this.result = predicate(
        this.val_1 = val_1,
        this.val_2 = val_2
      );
      Ditto.warn(
        "[Expression] warning,",
        JSON.stringify(text),
        "always got",
        result,
      );
      this.run = () => result
      return;
    }
    this.run = (t) => {
      const v1 = getter_1 ? getter_1(t, word_1, op as BinOp) : val_1
      const v2 = getter_2 ? getter_2(t, word_2, op as BinOp) : val_2
      this.val_1 = v1;   // 记录实际求值结果，便于调试打印
      this.val_2 = v2;
      this.result = predicate(v1, v2)
      return this.result;
    }
  }
  run = (e: T1): boolean => {
    let or_result = false;
    let and_result: boolean | undefined;
    const len = this.children.length;
    for (let i = 0; i < len; ++i) {
      const child = this.children[i]!;
      if (i === 0 || !child.before) {
        and_result = child.run(e);
      } else if (child.before === "&") {
        // AND 组已确定为 false --> 跳过该组后续操作数的求值
        if (and_result === false) continue;
        and_result = and_result! && child.run(e);
      } else if (child.before === "|") {
        or_result = or_result || and_result!;
        // 整体结果已确定为 true --> 短路返回
        if (or_result) return this.result = this.not ? false : true;
        and_result = child.run(e);
      }
    }
    if (and_result !== void 0) {
      or_result = or_result || and_result;
    }
    return this.result = this.not ? !or_result : or_result;
  };

  collect(): IExprDebug {
    const children: IExprDebug[] = this.children.map((c) =>
      Expression.is(c)
        ? c.collect()
        : {
            text: String((c as any)?.text ?? c),
            result: (c as any)?.result,
            err: (c as any)?.err,
            before: (c as any)?.before ?? '',
            not: (c as any)?.not ?? false,
            children: [],
          }
    );
    return {
      text: this.text,
      result: this.result,
      err: this.err,
      op: this.op,
      val_1: this.val_1,
      val_2: this.val_2,
      before: this.before,
      not: this.not,
      children,
    };
  }

  /** 将整棵判断树渲染成多行文本，便于 console.log 打印调试 */
  debug(): string {
    return stringify_expr_debug(this.collect());
  }
}