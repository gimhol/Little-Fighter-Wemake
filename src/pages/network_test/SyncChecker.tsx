
type Value = string | null | undefined;

interface SyncCheckResult {
  baseline: Value;
  current: Value;
  pos?: number;
  frag_baseline?: string;
  frag_current?: string;
}

export class SyncChecker {
  public readonly name: string;
  public result?: SyncCheckResult;
  private started = false;
  private baseline: Value;
  constructor(name: string) {
    this.name = name;
  }
  reset() {
    this.started = false;
  }
  test(current: Value): SyncCheckResult | undefined {
    if (!this.started) {
      this.started = true;
      this.baseline = current;
      return this.result = void 0;
    }
    const { baseline } = this;
    if (baseline === current)
      return this.result = void 0;

    if (typeof baseline !== 'string' || typeof current !== 'string') {
      this.result = { baseline, current };
      return;
    }
    let pos = 0;
    const max = Math.min(baseline.length, current.length);
    while (pos < max && baseline[pos] === current[pos]) pos++;
    const from = Math.max(0, pos - 100);
    return this.result = {
      baseline,
      current,
      pos,
      frag_baseline: baseline.slice(from, pos + 100),
      frag_current: current.slice(from, pos + 100),
    };
  }
  print_error(): void {
    if (!this.result) return;
    console.error(`${this.name} not equal!`, this.result)
  }
}
