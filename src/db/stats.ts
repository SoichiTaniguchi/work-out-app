import type { SQLiteDatabase } from "expo-sqlite";
import type { PersonalRecordType } from "@/types";

export interface WeeklyStats {
  exerciseCount: number;
  volume: number;
}

// 指定日時以降に記録した種目数(ユニーク)と負荷量(Σ 重量×回数)
export async function getWeeklyStats(
  db: SQLiteDatabase,
  userId: string,
  sinceIso: string
): Promise<WeeklyStats> {
  const row = await db.getFirstAsync<{ exerciseCount: number; volume: number | null }>(
    `SELECT COUNT(DISTINCT wl.exercise_id) as exerciseCount,
            SUM(CASE WHEN sl.weight IS NOT NULL AND sl.reps IS NOT NULL
                     THEN sl.weight * sl.reps ELSE 0 END) as volume
     FROM workout_logs wl
     INNER JOIN exercises e ON e.id = wl.exercise_id
     LEFT JOIN set_logs sl ON sl.workout_log_id = wl.id
     WHERE e.user_id = ? AND wl.date >= ?;`,
    [userId, sinceIso]
  );

  return { exerciseCount: row?.exerciseCount ?? 0, volume: row?.volume ?? 0 };
}

export interface LatestPersonalRecord {
  exerciseName: string;
  type: PersonalRecordType;
  value: number;
  achievedAt: string;
}

export async function getLatestPersonalRecord(
  db: SQLiteDatabase,
  userId: string
): Promise<LatestPersonalRecord | null> {
  return db.getFirstAsync<LatestPersonalRecord>(
    `SELECT e.name as exerciseName, pr.type as type, pr.value as value, pr.achieved_at as achievedAt
     FROM personal_records pr
     INNER JOIN exercises e ON e.id = pr.exercise_id
     WHERE e.user_id = ?
     ORDER BY pr.achieved_at DESC
     LIMIT 1;`,
    [userId]
  );
}
