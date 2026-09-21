import type { SQLiteDatabase } from "expo-sqlite";
import type { Exercise, RecordFieldType } from "@/types";
import { generateId } from "@/db/id";

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
     WHERE fe.folder_id = ?
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
    "SELECT * FROM exercises WHERE user_id = ? ORDER BY name ASC;",
    [userId]
  );
  return rows.map(rowToExercise);
}

export async function getExercise(db: SQLiteDatabase, id: string): Promise<Exercise | null> {
  const row = await db.getFirstAsync<ExerciseRow>("SELECT * FROM exercises WHERE id = ?;", [id]);
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
      `INSERT INTO exercises (id, user_id, name, body_parts, equipment, field_definition)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [
        exercise.id,
        exercise.userId,
        exercise.name,
        JSON.stringify(exercise.bodyParts),
        exercise.equipment,
        JSON.stringify(exercise.fieldDefinition),
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
    `UPDATE exercises SET user_id = ?, name = ?, body_parts = ?, equipment = ?, field_definition = ?
     WHERE id = ?;`,
    [
      patch.userId,
      patch.name,
      JSON.stringify(patch.bodyParts),
      patch.equipment,
      JSON.stringify(patch.fieldDefinition),
      id,
    ]
  );
}

export async function deleteExercise(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync("DELETE FROM exercises WHERE id = ?;", [id]);
}

export async function addExerciseToFolder(
  db: SQLiteDatabase,
  folderId: string,
  exerciseId: string
): Promise<void> {
  const { nextOrder } = (await db.getFirstAsync<{ nextOrder: number }>(
    "SELECT COALESCE(MAX(order_index) + 1, 0) as nextOrder FROM folder_exercises WHERE folder_id = ?;",
    [folderId]
  )) ?? { nextOrder: 0 };

  await db.runAsync(
    `INSERT OR IGNORE INTO folder_exercises (folder_id, exercise_id, order_index) VALUES (?, ?, ?);`,
    [folderId, exerciseId, nextOrder]
  );
}

export async function removeExerciseFromFolder(
  db: SQLiteDatabase,
  folderId: string,
  exerciseId: string
): Promise<void> {
  await db.runAsync(
    "DELETE FROM folder_exercises WHERE folder_id = ? AND exercise_id = ?;",
    [folderId, exerciseId]
  );
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
  });
}
