import type { SQLiteDatabase } from "expo-sqlite";
import type { Exercise, RecordFieldType } from "@/types";
import { generateId } from "@/db/id";
import { nowIso } from "@/db/timestamps";

interface ExerciseRow {
  id: string;
  user_id: string;
  name: string;
  body_parts: string;
  equipment: string;
  field_definition: string;
}

function rowToExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    bodyParts: JSON.parse(row.body_parts) as string[],
    equipment: row.equipment,
    fieldDefinition: JSON.parse(row.field_definition) as RecordFieldType[],
  };
}

export async function listExercisesByFolder(
  db: SQLiteDatabase,
  folderId: string
): Promise<Exercise[]> {
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT e.* FROM exercises e
     INNER JOIN folder_exercises fe ON fe.exercise_id = e.id
     WHERE fe.folder_id = ? AND e.deleted_at IS NULL
     ORDER BY fe.order_index ASC;`,
    [folderId]
  );
  return rows.map(rowToExercise);
}

export async function listExercisesByUser(
  db: SQLiteDatabase,
  userId: string
): Promise<Exercise[]> {
  const rows = await db.getAllAsync<ExerciseRow>(
    "SELECT * FROM exercises WHERE user_id = ? AND deleted_at IS NULL ORDER BY name ASC;",
    [userId]
  );
  return rows.map(rowToExercise);
}

// ユーザーの種目に実際に設定されている部位(プリセット9部位に無いユーザー独自の部位も含む)。
// 部位マスタのテーブルは持たず、使われている部位がそのまま選択肢になる。
export async function listUsedBodyParts(
  db: SQLiteDatabase,
  userId: string
): Promise<string[]> {
  const rows = await db.getAllAsync<{ body_parts: string }>(
    "SELECT body_parts FROM exercises WHERE user_id = ? AND deleted_at IS NULL;",
    [userId]
  );

  const parts = new Set<string>();
  for (const row of rows) {
    for (const part of JSON.parse(row.body_parts) as string[]) {
      if (part) parts.add(part);
    }
  }
  return [...parts];
}

export async function getExercise(db: SQLiteDatabase, id: string): Promise<Exercise | null> {
  const row = await db.getFirstAsync<ExerciseRow>(
    "SELECT * FROM exercises WHERE id = ? AND deleted_at IS NULL;",
    [id]
  );
  return row ? rowToExercise(row) : null;
}

export interface ExerciseInput {
  userId: string;
  name: string;
  bodyParts: string[];
  equipment: string;
  fieldDefinition: RecordFieldType[];
}

export async function createExercise(
  db: SQLiteDatabase,
  input: ExerciseInput,
  opts?: { folderId?: string }
): Promise<Exercise> {
  const exercise: Exercise = { id: generateId("ex"), ...input };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO exercises (id, user_id, name, body_parts, equipment, field_definition, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        exercise.id,
        exercise.userId,
        exercise.name,
        JSON.stringify(exercise.bodyParts),
        exercise.equipment,
        JSON.stringify(exercise.fieldDefinition),
        nowIso(),
      ]
    );

    if (opts?.folderId) {
      await addExerciseToFolder(db, opts.folderId, exercise.id);
    }
  });

  return exercise;
}

export async function updateExercise(
  db: SQLiteDatabase,
  id: string,
  patch: ExerciseInput
): Promise<void> {
  await db.runAsync(
    `UPDATE exercises
     SET user_id = ?, name = ?, body_parts = ?, equipment = ?, field_definition = ?, updated_at = ?
     WHERE id = ?;`,
    [
      patch.userId,
      patch.name,
      JSON.stringify(patch.bodyParts),
      patch.equipment,
      JSON.stringify(patch.fieldDefinition),
      nowIso(),
      id,
    ]
  );
}

// 論理削除。記録と自己ベストにも deleted_at を打ち、所属リンクは物理削除したうえで
// 中身が変わったフォルダの updated_at を更新する(リンクはフォルダの集約の一部のため)。
export async function deleteExercise(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowIso();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE folders SET updated_at = ?
       WHERE id IN (SELECT folder_id FROM folder_exercises WHERE exercise_id = ?);`,
      [now, id]
    );
    await db.runAsync("DELETE FROM folder_exercises WHERE exercise_id = ?;", [id]);
    await db.runAsync(
      "UPDATE personal_records SET deleted_at = ?, updated_at = ? WHERE exercise_id = ? AND deleted_at IS NULL;",
      [now, now, id]
    );
    await db.runAsync(
      "UPDATE workout_logs SET deleted_at = ?, updated_at = ? WHERE exercise_id = ? AND deleted_at IS NULL;",
      [now, now, id]
    );
    await db.runAsync("UPDATE exercises SET deleted_at = ?, updated_at = ? WHERE id = ?;", [
      now,
      now,
      id,
    ]);
  });
}

export async function addExerciseToFolder(
  db: SQLiteDatabase,
  folderId: string,
  exerciseId: string
): Promise<void> {
  const { nextOrder } = (await db.getFirstAsync<{ nextOrder: number }>(
    `SELECT COALESCE(MAX(fe.order_index) + 1, 0) as nextOrder
     FROM folder_exercises fe
     INNER JOIN exercises e ON e.id = fe.exercise_id AND e.deleted_at IS NULL
     WHERE fe.folder_id = ?;`,
    [folderId]
  )) ?? { nextOrder: 0 };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR IGNORE INTO folder_exercises (folder_id, exercise_id, order_index) VALUES (?, ?, ?);`,
      [folderId, exerciseId, nextOrder]
    );
    await db.runAsync("UPDATE folders SET updated_at = ? WHERE id = ?;", [nowIso(), folderId]);
  });
}

export async function removeExerciseFromFolder(
  db: SQLiteDatabase,
  folderId: string,
  exerciseId: string
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM folder_exercises WHERE folder_id = ? AND exercise_id = ?;", [
      folderId,
      exerciseId,
    ]);
    await db.runAsync("UPDATE folders SET updated_at = ? WHERE id = ?;", [nowIso(), folderId]);
  });
}

export async function reorderExercisesInFolder(
  db: SQLiteDatabase,
  folderId: string,
  orderedExerciseIds: string[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (let index = 0; index < orderedExerciseIds.length; index += 1) {
      await db.runAsync(
        "UPDATE folder_exercises SET order_index = ? WHERE folder_id = ? AND exercise_id = ?;",
        [index, folderId, orderedExerciseIds[index]]
      );
    }
    await db.runAsync("UPDATE folders SET updated_at = ? WHERE id = ?;", [nowIso(), folderId]);
  });
}
