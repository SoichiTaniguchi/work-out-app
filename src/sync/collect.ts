import type { SQLiteDatabase } from "expo-sqlite";
import type { PersonalRecordType, RecordFieldType } from "@/types";
import {
  emptyChanges,
  type SyncChanges,
  type SyncSet,
} from "@/sync/types";

// 前回送信した時刻より updated_at が新しい行が「まだ送っていない変更」。
// 行ごとの未同期フラグは持たず、既に全テーブルにある updated_at で判定する。
// 論理削除された行も送る必要があるので、ここでは deleted_at で絞らない。

interface UserRow {
  id: string;
  name: string;
  updated_at: string;
  deleted_at: string | null;
}

interface FolderRow {
  id: string;
  user_id: string;
  name: string;
  order_index: number;
  updated_at: string;
  deleted_at: string | null;
}

interface ExerciseRow {
  id: string;
  user_id: string;
  name: string;
  body_parts: string;
  equipment: string;
  field_definition: string;
  updated_at: string;
  deleted_at: string | null;
}

interface WorkoutLogRow {
  id: string;
  exercise_id: string;
  date: string;
  completed: number;
  updated_at: string;
  deleted_at: string | null;
}

interface SetLogRow {
  weight: number | null;
  reps: number | null;
  time_sec: number | null;
  distance_km: number | null;
  rpe: number | null;
}

interface PersonalRecordRow {
  id: string;
  exercise_id: string;
  type: PersonalRecordType;
  value: number;
  achieved_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export async function collectLocalChanges(
  db: SQLiteDatabase,
  userId: string,
  lastPushedAt: string | null
): Promise<SyncChanges> {
  // 初回同期(未送信)は空文字と比較して全件対象にする。
  const since = lastPushedAt ?? "";
  const changes = emptyChanges();

  // ユーザー一覧は家族で共有するため、ユーザーで絞らない。
  const users = await db.getAllAsync<UserRow>(
    "SELECT * FROM users WHERE updated_at > ?;",
    [since]
  );
  changes.users = users.map((row) => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));

  const exercises = await db.getAllAsync<ExerciseRow>(
    "SELECT * FROM exercises WHERE user_id = ? AND updated_at > ?;",
    [userId, since]
  );
  changes.exercises = exercises.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    bodyParts: JSON.parse(row.body_parts) as string[],
    equipment: row.equipment,
    fieldDefinition: JSON.parse(row.field_definition) as RecordFieldType[],
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));

  const folders = await db.getAllAsync<FolderRow>(
    "SELECT * FROM folders WHERE user_id = ? AND updated_at > ?;",
    [userId, since]
  );
  changes.folders = await Promise.all(
    folders.map(async (row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      order: row.order_index,
      exerciseIds: (
        await db.getAllAsync<{ exercise_id: string }>(
          "SELECT exercise_id FROM folder_exercises WHERE folder_id = ? ORDER BY order_index ASC;",
          [row.id]
        )
      ).map((link) => link.exercise_id),
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }))
  );

  const logs = await db.getAllAsync<WorkoutLogRow>(
    `SELECT wl.* FROM workout_logs wl
     INNER JOIN exercises e ON e.id = wl.exercise_id
     WHERE e.user_id = ? AND wl.updated_at > ?;`,
    [userId, since]
  );
  changes.workoutLogs = await Promise.all(
    logs.map(async (row) => ({
      id: row.id,
      exerciseId: row.exercise_id,
      date: row.date,
      completed: row.completed === 1,
      sets: (
        await db.getAllAsync<SetLogRow>(
          "SELECT * FROM set_logs WHERE workout_log_id = ? ORDER BY order_index ASC;",
          [row.id]
        )
      ).map(toSyncSet),
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }))
  );

  const records = await db.getAllAsync<PersonalRecordRow>(
    `SELECT pr.* FROM personal_records pr
     INNER JOIN exercises e ON e.id = pr.exercise_id
     WHERE e.user_id = ? AND pr.updated_at > ?;`,
    [userId, since]
  );
  changes.personalRecords = records.map((row) => ({
    id: row.id,
    exerciseId: row.exercise_id,
    type: row.type,
    value: row.value,
    achievedAt: row.achieved_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));

  return changes;
}

function toSyncSet(row: SetLogRow): SyncSet {
  return {
    weight: row.weight,
    reps: row.reps,
    timeSec: row.time_sec,
    distanceKm: row.distance_km,
    rpe: row.rpe,
  };
}
