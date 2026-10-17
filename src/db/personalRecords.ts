import type { SQLiteDatabase } from "expo-sqlite";
import type { PersonalRecord, PersonalRecordType, SetLog } from "@/types";
import { generateId } from "@/db/id";
import { nowIso } from "@/db/timestamps";

interface PersonalRecordRow {
  id: string;
  exercise_id: string;
  type: PersonalRecordType;
  value: number;
  achieved_at: string;
  deleted_at: string | null;
}

function rowToPersonalRecord(row: PersonalRecordRow): PersonalRecord {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    type: row.type,
    value: row.value,
    achievedAt: row.achieved_at,
  };
}

export async function getPersonalRecords(
  db: SQLiteDatabase,
  exerciseId: string
): Promise<PersonalRecord[]> {
  const rows = await db.getAllAsync<PersonalRecordRow>(
    "SELECT * FROM personal_records WHERE exercise_id = ? AND deleted_at IS NULL;",
    [exerciseId]
  );
  return rows.map(rowToPersonalRecord);
}

// 完了サマリー用。指定日時以降に達成した自己ベストを種目名付きで返す。
export interface PersonalRecordWithExercise extends PersonalRecord {
  exerciseName: string;
}

export async function listPersonalRecordsSince(
  db: SQLiteDatabase,
  userId: string,
  sinceIso: string
): Promise<PersonalRecordWithExercise[]> {
  const rows = await db.getAllAsync<PersonalRecordRow & { exercise_name: string }>(
    `SELECT pr.*, e.name as exercise_name
     FROM personal_records pr
     INNER JOIN exercises e ON e.id = pr.exercise_id AND e.deleted_at IS NULL
     WHERE e.user_id = ? AND pr.achieved_at >= ? AND pr.deleted_at IS NULL
     ORDER BY pr.achieved_at ASC;`,
    [userId, sinceIso]
  );

  return rows.map((row) => ({ ...rowToPersonalRecord(row), exerciseName: row.exercise_name }));
}

function computeCandidates(sets: SetLog[]): Partial<Record<PersonalRecordType, number>> {
  const weights = sets.map((s) => s.weight).filter((v): v is number => v !== undefined);
  const reps = sets.map((s) => s.reps).filter((v): v is number => v !== undefined);
  const volumeSets = sets.filter((s) => s.weight !== undefined && s.reps !== undefined);

  const candidates: Partial<Record<PersonalRecordType, number>> = {};
  if (weights.length > 0) candidates.maxWeight = Math.max(...weights);
  if (reps.length > 0) candidates.maxReps = Math.max(...reps);
  if (volumeSets.length > 0) {
    candidates.maxVolume = volumeSets.reduce((sum, s) => sum + s.weight! * s.reps!, 0);
  }
  return candidates;
}

// セット完了時に呼び出し、自己ベストを更新した種別だけ返す(完了画面のPR通知に使う)
export async function evaluateAndSavePersonalRecords(
  db: SQLiteDatabase,
  exerciseId: string,
  sets: SetLog[]
): Promise<PersonalRecord[]> {
  const candidates = computeCandidates(sets);
  const achievedAt = new Date().toISOString();
  const updated: PersonalRecord[] = [];

  await db.withTransactionAsync(async () => {
    for (const [type, value] of Object.entries(candidates) as [PersonalRecordType, number][]) {
      // UNIQUE(exercise_id, type) と同じ粒度で引く。論理削除済みの行も INSERT OR REPLACE の
      // 衝突相手になるため、deleted_at でフィルタせずに取得して記録なし扱いにする。
      const existing = await db.getFirstAsync<PersonalRecordRow>(
        "SELECT * FROM personal_records WHERE exercise_id = ? AND type = ?;",
        [exerciseId, type]
      );

      if (existing && existing.deleted_at === null && existing.value >= value) {
        continue;
      }

      const record: PersonalRecord = { id: generateId("pr"), exerciseId, type, value, achievedAt };
      await db.runAsync(
        `INSERT OR REPLACE INTO personal_records
           (id, exercise_id, type, value, achieved_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [record.id, record.exerciseId, record.type, record.value, record.achievedAt, nowIso()]
      );
      updated.push(record);
    }
  });

  return updated;
}
