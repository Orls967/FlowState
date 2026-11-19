// localStorage bisa melempar galat (mode privat, situs diblokir) — selalu dibungkus try/catch.
export function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* abaikan: preferensi hanya untuk kenyamanan */
  }
}
