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
