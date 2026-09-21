import type { SQLiteDatabase } from "expo-sqlite";
import type { PersonalRecord, PersonalRecordType, SetLog } from "@/types";
import { generateId } from "@/db/id";

interface PersonalRecordRow {
  id: string;
  exercise_id: string;
  type: PersonalRecordType;
  value: number;
  achieved_at: string;
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
    "SELECT * FROM personal_records WHERE exercise_id = ?;",
    [exerciseId]
  );
  return rows.map(rowToPersonalRecord);
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
      const existing = await db.getFirstAsync<PersonalRecordRow>(
        "SELECT * FROM personal_records WHERE exercise_id = ? AND type = ?;",
        [exerciseId, type]
      );

      if (existing && existing.value >= value) {
        continue;
      }

      const record: PersonalRecord = { id: generateId("pr"), exerciseId, type, value, achievedAt };
      await db.runAsync(
        `INSERT OR REPLACE INTO personal_records (id, exercise_id, type, value, achieved_at)
         VALUES (?, ?, ?, ?, ?);`,
        [record.id, record.exerciseId, record.type, record.value, record.achievedAt]
      );
      updated.push(record);
    }
  });

  return updated;
}
