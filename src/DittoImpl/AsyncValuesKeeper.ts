
export class AsyncValuesKeeper<V> {

  readonly values = new Map<string, V>();
  protected _pending = new Map<string, Promise<V>>();

  get(key: string): V | undefined {
    return this.values.get(key)
  }

  has(key: string): boolean {
    return this.values.has(key)
  }
  
  fetch(key: string, job: () => Promise<V>): Promise<V> {
    if (this.values.has(key)) return Promise.resolve(this.values.get(key)!);

    let ret = this._pending.get(key);
    if (ret) return ret;
    const promise = Promise.resolve().then(job);

    ret = promise.then(value => {
      if (this.consume(key, promise))
        this.values.set(key, value);
      return value;
    });
    ret.catch(() => {
      this.consume(key, promise)
    });
    this._pending.set(key, promise);
    return ret;
  }

  private consume(key: string, promise: Promise<V>): boolean {
    if (this._pending.get(key) !== promise)
      return false;
    this._pending.delete(key);
    return true;
  }

  async overwrite(key: string, job: () => Promise<V>): Promise<V> {
    this._pending.delete(key);   // 让在途 fetch 不再写回
    const value = await job();
    this.values.set(key, value);
    return value;
  }

  clean(): void {
    this.values.clear();
    this._pending.clear();
  }

  del(key: string): V | undefined {
    const ret = this.values.get(key);
    this.values.delete(key);
    this._pending.delete(key);
    return ret;
  }
}
