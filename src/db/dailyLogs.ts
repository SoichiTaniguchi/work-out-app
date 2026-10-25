import type { SQLiteDatabase } from "expo-sqlite";
import { generateId } from "@/db/id";
import { nowIso } from "@/db/timestamps";

// 1日1行の体重・体調・排便の記録。種目には属さないため workout_logs とは別テーブル。
// 同期の単位になるので updated_at / deleted_at を持つ(同期はまだ未実装)。

export interface DailyLog {
  date: string; // "YYYY-MM-DD"
  weight: number | null; // kg、小数1桁
  condition: number | null; // 体調 1〜5
  bowelMoved: boolean | null; // 排便あり/なし
}

export interface DailyLogPatch {
  weight?: number | null;
  condition?: number | null;
  bowelMoved?: boolean | null;
}

interface DailyLogRow {
  date: string;
  weight: number | null;
  condition_level: number | null;
  bowel_moved: number | null;
}

function rowToDailyLog(row: DailyLogRow): DailyLog {
  return {
    date: row.date,
    weight: row.weight,
    condition: row.condition_level,
    bowelMoved: row.bowel_moved === null ? null : row.bowel_moved === 1,
  };
}

export async function getDailyLog(
  db: SQLiteDatabase,
  userId: string,
  date: string
): Promise<DailyLog | null> {
  const row = await db.getFirstAsync<DailyLogRow>(
    `SELECT date, weight, condition_level, bowel_moved FROM daily_logs
     WHERE user_id = ? AND date = ? AND deleted_at IS NULL;`,
    [userId, date]
  );
  return row ? rowToDailyLog(row) : null;
}

// 指定日より前で、最後に体重を記録した日の値。入力画面で「前回」として薄く表示する。
export async function getLatestWeightBefore(
  db: SQLiteDatabase,
  userId: string,
  date: string
): Promise<number | null> {
  const row = await db.getFirstAsync<{ weight: number }>(
    `SELECT weight FROM daily_logs
     WHERE user_id = ? AND date < ? AND weight IS NOT NULL AND deleted_at IS NULL
     ORDER BY date DESC LIMIT 1;`,
    [userId, date]
  );
  return row ? row.weight : null;
}

// 履歴用。fromDate 以降(YYYY-MM-DD の文字列比較で十分)を古い順に返す。
export async function listDailyLogsFrom(
  db: SQLiteDatabase,
  userId: string,
  fromDate: string
): Promise<DailyLog[]> {
  const rows = await db.getAllAsync<DailyLogRow>(
    `SELECT date, weight, condition_level, bowel_moved FROM daily_logs
     WHERE user_id = ? AND date >= ? AND deleted_at IS NULL
     ORDER BY date ASC;`,
    [userId, fromDate]
  );
  return rows.map(rowToDailyLog);
}

// patch で null/undefined の項目は既存の値を残す(この画面では値を消す操作は無い)。
export async function saveDailyLog(
  db: SQLiteDatabase,
  userId: string,
  date: string,
  patch: DailyLogPatch
): Promise<void> {
  const current = await getDailyLog(db, userId, date);
  const next: DailyLog = {
    date,
    weight: patch.weight ?? current?.weight ?? null,
    condition: patch.condition ?? current?.condition ?? null,
    bowelMoved: patch.bowelMoved ?? current?.bowelMoved ?? null,
  };

  // 既存行があれば id は変えない(UNIQUE(user_id, date) の衝突で ON CONFLICT が効く)。
  await db.runAsync(
    `INSERT INTO daily_logs
       (id, user_id, date, weight, condition_level, bowel_moved, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(user_id, date) DO UPDATE SET
       weight = excluded.weight,
       condition_level = excluded.condition_level,
       bowel_moved = excluded.bowel_moved,
       updated_at = excluded.updated_at,
       deleted_at = NULL;`,
    [
      generateId("dl"),
      userId,
      date,
      next.weight,
      next.condition,
      next.bowelMoved === null ? null : next.bowelMoved ? 1 : 0,
      nowIso(),
    ]
  );
}
