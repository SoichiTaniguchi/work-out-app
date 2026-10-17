// NAS同期のLast Write Wins判定に使う更新日時。保存形式は他の日時カラムと同じISO文字列。
export function nowIso(): string {
  return new Date().toISOString();
}
