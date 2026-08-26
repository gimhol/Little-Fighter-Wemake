export class Cases {
  readonly name: string;
  readonly separator = '￥'
  readonly cases: string[] = [];
  protected times: number = 0;
  protected _debuging: boolean = false;
  constructor(name: string) { this.name = name; }
  get debugging() { return this._debuging }
  debug(v: boolean): void {
    this._debuging = v;
    this.times = 0;
    this.cases.length = 0;
  }
  reset(): void {
    this.times = 0;
    this.cases.length = 0
  }
  push(mark: string, ...args: any[]): void {
    const m = `[${mark || ''}#${++this.times}]`
    const v = args.length ? `:(${args.join()})` : ''
    this.cases.push(`${m}${v}`);
  }
  submit(): string {
    const ret = this.cases.join(this.separator)
    this.cases.length = 0;
    return ret;
  }
}