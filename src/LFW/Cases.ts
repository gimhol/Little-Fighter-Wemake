export class Cases {
  readonly name: string;
  readonly separator = '￥'
  readonly cases: string[] = [];
  protected times: number = 0;
  constructor(name: string) { this.name = name; }
  reset(): void {
    this.times = 0;
    this.cases.length = 0
  }
  push(mark: string, ...args: any[]): void {
    //"mark(100)￥mark(101):[aa,bb,cc]"
    const v = args.length ? `:[${args.join()}]` : ''
    this.cases.push(`${mark}(${++this.times})${v}`);
  }
  submit(): string {
    const ret = this.cases.join(this.separator)
    this.cases.length = 0;
    return ret;
  }
}