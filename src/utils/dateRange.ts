// workout_logs.date は toISOString() で保存しているので、ローカル時刻で境界を求めてから
// ISO文字列に変換すれば文字列比較で範囲を絞れる。

export function startOfTodayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

// 週の起算日は月曜
export function startOfWeekIso(): string {
  const now = new Date();
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  return monday.toISOString();
}

// ---- 日付指定(YYYY-MM-DD。ローカルタイムゾーンの暦日)----
// 画面間の受け渡しには、タイムゾーンに依存しない "YYYY-MM-DD" 文字列を使う。

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function localDateKey(date: Date): string {
  return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
}

export function todayKey(): string {
  return localDateKey(new Date());
}

// ローカルのその日の0時
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

// 選んだ日の0時〜翌0時。startIso 以上 endIso 未満で絞る。
export function dayRangeIso(key: string): { startIso: string; endIso: string } {
  const start = parseDateKey(key);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

// month は Date と同じく0始まり
export function monthRangeIso(year: number, month: number): { startIso: string; endIso: string } {
  return {
    startIso: new Date(year, month, 1).toISOString(),
    endIso: new Date(year, month + 1, 1).toISOString(),
  };
}

// 過去日の新規記録の保存時刻。正午なら、タイムゾーンの扱いが多少ずれても日付が変わらない。
export function noonIso(key: string): string {
  const date = parseDateKey(key);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).toISOString();
}

// 新規記録の保存時刻。今日は現在時刻、それ以外はその日の正午。
export function recordTimestampIso(key: string): string {
  return key === todayKey() ? new Date().toISOString() : noonIso(key);
}

// 月曜始まりの1週間(7日分)
export function weekKeys(key: string): string[] {
  const date = parseDateKey(key);
  const monday = addDays(key, -((date.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// 月曜始まりの月表示。前後の月の日も含めて7日×N週に揃える。
export function monthWeeks(year: number, month: number): string[][] {
  const first = localDateKey(new Date(year, month, 1));
  const last = localDateKey(new Date(year, month + 1, 0));
  const weeks: string[][] = [];
  let cursor = weekKeys(first)[0];
  while (cursor <= last) {
    weeks.push(weekKeys(cursor));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function weekdayLabel(key: string): string {
  return WEEKDAYS[parseDateKey(key).getDay()];
}

// 例: 10月21日(水)
export function formatDateLabel(key: string): string {
  const date = parseDateKey(key);
  return date.getMonth() + 1 + "月" + date.getDate() + "日(" + weekdayLabel(key) + ")";
}
