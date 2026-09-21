// crypto.randomUUID 等のネイティブUUID実装に依存せず、追加パッケージなしでID生成する
export function generateId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}
