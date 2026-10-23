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

// 指定した日のローカル0時〜翌0時。[startIso, endIso) の半開区間として使う。
export function dayRangeIso(day: Date): { startIso: string; endIso: string } {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

// 指定した月(month は 0 始まり)のローカル1日0時〜翌月1日0時。
export function monthRangeIso(year: number, month: number): { startIso: string; endIso: string } {
  return {
    startIso: new Date(year, month, 1).toISOString(),
    endIso: new Date(year, month + 1, 1).toISOString(),
  };
}

// 過去日の新規記録の保存時刻。タイムゾーンや夏時間で日付がずれにくいよう、その日の正午に固定する。
export function noonIso(day: Date): string {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).toISOString();
}

// ローカル日付のキー(YYYY-MM-DD)。カレンダーで「記録がある日」を突き合わせるのに使う。
export function localDateKey(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${month}-${date}`;
}
