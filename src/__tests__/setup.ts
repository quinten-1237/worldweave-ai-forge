// Polyfill localStorage for Zustand persist in node tests.
class Mem {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  get length() { return this.m.size; }
}
const g = globalThis as unknown as { window?: { localStorage: Mem }; localStorage?: Mem };
const storage = new Mem();
g.window = g.window ?? { localStorage: storage };
g.localStorage = g.window.localStorage;
