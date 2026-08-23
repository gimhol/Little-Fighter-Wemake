import type { TBinOp } from "./BinOp";

export interface IJudger<T> {
  result?: boolean;
  run(arg: T): boolean;
  readonly text: string;
  readonly err?: string;
  debug?(): string;
}
export interface IValGetter<T> {
  (e: T, word: string, op: TBinOp): any;
}
export interface IValGetterGetter<T> {
  (word: string): IValGetter<T> | undefined;
}
export interface IExpression<T1, T2 = T1> extends IJudger<T1 | T2> {
  readonly is_expression: true;
  readonly children: Array<IExpression<T1> | IJudger<T1 | T2> | "|" | "&">;
  readonly get_val?: IValGetter<T1 | T2>;
  readonly get_val_getter?: IValGetterGetter<T1 | T2>;
  before: string;
}
