// 体重グラフの期間と粒度。画面から切り離して単体で確かめられるようにしている。

import { parseDateKey, weekKeys } from "@/utils/dateRange";

export type Period = "1w" | "1m" | "3m" | "1y";
/** 日ごと、または期間に応じた平均(週/月) */
export type Granularity = "daily" | "average";

export const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: "1w", label: "1週間", days: 7 },
  { key: "1m", label: "1ヶ月", days: 30 },
  { key: "3m", label: "3ヶ月", days: 90 },
  { key: "1y", label: "1年", days: 365 },
];

export function periodDays(period: Period): number {
  return PERIODS.find((p) => p.key === period)?.days ?? 30;
}

// 平均の単位。1週間は平均にすると1点になってしまうので、平均を選べない。
export function averageUnit(period: Period): "week" | "month" | null {
  if (period === "1w") return null;
  return period === "1y" ? "month" : "week";
}

// 期間ごとの既定の粒度。長い期間は日ごとだと細かすぎるので平均にする。
export function defaultGranularity(period: Period): Granularity {
  return period === "3m" || period === "1y" ? "average" : "daily";
}

export interface WeightEntry {
  date: string; // "YYYY-MM-DD"
  weight: number;
}

export interface SeriesPoint {
  /** グラフの横軸と一覧に出す見出し */
  label: string;
  value: number;
}

function monthLabel(dateKey: string): string {
  return `${Number(dateKey.slice(5, 7))}月`;
}

function dayLabel(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 小数1桁に丸める。平均で桁が増えると一覧の数字が揃わないため。
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * グラフと一覧に出す点を作る。entries は日付の昇順。
 * daily はその日の値、average は週または月ごとの平均。
 */
export function buildWeightSeries(
  entries: WeightEntry[],
  period: Period,
  granularity: Granularity
): SeriesPoint[] {
  const unit = averageUnit(period);
  if (granularity === "daily" || unit === null) {
    return entries.map((entry) => ({ label: dayLabel(entry.date), value: entry.weight }));
  }

  // 週は月曜始まり、月は暦月でまとめる(どちらもカレンダーの区切りに合わせる)
  const buckets = new Map<string, { label: string; values: number[] }>();
  for (const entry of entries) {
    const key =
      unit === "month" ? entry.date.slice(0, 7) : (weekKeys(entry.date)[0] ?? entry.date);
    const label = unit === "month" ? monthLabel(entry.date) : dayLabel(key);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.values.push(entry.weight);
    } else {
      buckets.set(key, { label, values: [entry.weight] });
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, bucket]) => ({
      label: bucket.label,
      value: round1(bucket.values.reduce((sum, v) => sum + v, 0) / bucket.values.length),
    }));
}

// 一覧の見出し。平均のときは単位が分かるようにする。
export function seriesHeading(period: Period, granularity: Granularity): string {
  const unit = averageUnit(period);
  if (granularity === "daily" || unit === null) return "日ごと";
  return unit === "month" ? "月ごとの平均" : "週ごとの平均";
}
