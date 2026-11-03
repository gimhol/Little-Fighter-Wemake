
type Value = string | null | undefined;

interface SyncCheckResult {
  value1: Value;
  value2: Value;
  pos?: number;
  frag_value1?: string;
  frag_value2?: string;
}

export class SyncChecker {
  public readonly name: string;
  public result?: SyncCheckResult;
  private started = false;
  private value1: Value;
  constructor(name: string) {
    this.name = name;
  }
  reset() {
    this.started = false;
  }
  test(value2: Value): SyncCheckResult | undefined {
    if (!this.started) {
      this.started = true;
      this.value1 = value2;
      return this.result = void 0;
    }
    const { value1 } = this;
    if (value1 === value2)
      return this.result = void 0;

    if (typeof value1 !== 'string' || typeof value2 !== 'string') {
      this.result = { value1: value1, value2: value2 };
      return;
    }
    let pos = 0;
    const max = Math.min(value1.length, value2.length);
    while (pos < max && value1[pos] === value2[pos]) pos++;
    const from = Math.max(0, pos - 50);
    return this.result = {
      value1,
      value2,
      pos,
      frag_value1: value1.slice(from, pos + 50),
      frag_value2: value2.slice(from, pos + 50),
    };
  }
  print_error(): void {
    if (!this.result) return;
    console.error(`${this.name} not equal!`, this.result)
  }
}
