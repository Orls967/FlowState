/** Min-heap biner sederhana untuk A*. */
export class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(val: number, key: number): void {
    const k = this.keys;
    const v = this.vals;
    k.push(key);
    v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }

  /** Ambil nilai dengan kunci terkecil; −1 bila kosong. */
  pop(): number {
    const k = this.keys;
    const v = this.vals;
    if (!k.length) return -1;
    const top = v[0];
    const lk = k.pop()!;
    const lv = v.pop()!;
    if (k.length) {
      let i = 0;
      const n = k.length;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && k[r] < k[l] ? r : l;
        if (k[c] >= lk) break;
        k[i] = k[c];
        v[i] = v[c];
        i = c;
      }
      k[i] = lk;
      v[i] = lv;
    }
    return top;
  }

  clear(): void {
    this.keys.length = 0;
    this.vals.length = 0;
  }
}
