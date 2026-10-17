import type { SQLiteDatabase } from "expo-sqlite";
import type { RecordFieldType, SetLog, WorkoutLog } from "@/types";
import { generateId } from "@/db/id";
import { nowIso } from "@/db/timestamps";

interface WorkoutLogRow {
  id: string;
  exercise_id: string;
  date: string;
  completed: number;
}

interface SetLogRow {
  workout_log_id: string;
  order_index: number;
  weight: number | null;
  reps: number | null;
  time_sec: number | null;
  distance_km: number | null;
  rpe: number | null;
}

function rowToSetLog(row: SetLogRow): SetLog {
  const set: SetLog = {};
  if (row.weight !== null) set.weight = row.weight;
  if (row.reps !== null) set.reps = row.reps;
  if (row.time_sec !== null) set.timeSec = row.time_sec;
  if (row.distance_km !== null) set.distanceKm = row.distance_km;
  if (row.rpe !== null) set.rpe = row.rpe;
  return set;
}

async function rowToWorkoutLog(db: SQLiteDatabase, row: WorkoutLogRow): Promise<WorkoutLog> {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    date: row.date,
    completed: row.completed === 1,
    sets: await loadSets(db, row.id),
  };
}

async function loadSets(db: SQLiteDatabase, workoutLogId: string): Promise<SetLog[]> {
  const rows = await db.getAllAsync<SetLogRow>(
    "SELECT * FROM set_logs WHERE workout_log_id = ? ORDER BY order_index ASC;",
    [workoutLogId]
  );
  return rows.map(rowToSetLog);
}

// 完了サマリー用。種目名と記録項目定義を一緒に返すので、画面側で種目を引き直さずに表示できる。
export interface WorkoutLogWithExercise extends WorkoutLog {
  exerciseName: string;
  fieldDefinition: RecordFieldType[];
}

export async function listWorkoutLogsSince(
  db: SQLiteDatabase,
  userId: string,
  sinceIso: string
): Promise<WorkoutLogWithExercise[]> {
  const rows = await db.getAllAsync<
    WorkoutLogRow & { exercise_name: string; field_definition: string }
  >(
    `SELECT wl.*, e.name as exercise_name, e.field_definition as field_definition
     FROM workout_logs wl
     INNER JOIN exercises e ON e.id = wl.exercise_id AND e.deleted_at IS NULL
     WHERE e.user_id = ? AND wl.date >= ? AND wl.deleted_at IS NULL
     ORDER BY wl.date ASC;`,
    [userId, sinceIso]
  );

  return Promise.all(
    rows.map(async (row) => ({
      ...(await rowToWorkoutLog(db, row)),
      exerciseName: row.exercise_name,
      fieldDefinition: JSON.parse(row.field_definition) as RecordFieldType[],
    }))
  );
}

export async function listWorkoutLogsByExercise(
  db: SQLiteDatabase,
  exerciseId: string
): Promise<WorkoutLog[]> {
  const rows = await db.getAllAsync<WorkoutLogRow>(
    "SELECT * FROM workout_logs WHERE exercise_id = ? AND deleted_at IS NULL ORDER BY date ASC;",
    [exerciseId]
  );

  return Promise.all(rows.map((row) => rowToWorkoutLog(db, row)));
}

// beforeIso を渡すとその日時より前の記録に限定する。記録画面が「前回値」として
// 今日の記録自身を拾わないために使う。
export async function getLastWorkoutLog(
  db: SQLiteDatabase,
  exerciseId: string,
  beforeIso?: string
): Promise<WorkoutLog | null> {
  const row = beforeIso
    ? await db.getFirstAsync<WorkoutLogRow>(
        `SELECT * FROM workout_logs
         WHERE exercise_id = ? AND date < ? AND deleted_at IS NULL
         ORDER BY date DESC LIMIT 1;`,
        [exerciseId, beforeIso]
      )
    : await db.getFirstAsync<WorkoutLogRow>(
        `SELECT * FROM workout_logs
         WHERE exercise_id = ? AND deleted_at IS NULL
         ORDER BY date DESC LIMIT 1;`,
        [exerciseId]
      );
  return row ? rowToWorkoutLog(db, row) : null;
}

// その日すでに記録済みなら、その記録に追記する(1日1種目1レコード)。
export async function getWorkoutLogSince(
  db: SQLiteDatabase,
  exerciseId: string,
  sinceIso: string
): Promise<WorkoutLog | null> {
  const row = await db.getFirstAsync<WorkoutLogRow>(
    `SELECT * FROM workout_logs
     WHERE exercise_id = ? AND date >= ? AND deleted_at IS NULL
     ORDER BY date DESC LIMIT 1;`,
    [exerciseId, sinceIso]
  );
  return row ? rowToWorkoutLog(db, row) : null;
}

// 「この種目を完了」を押したときだけ立てる。セット単位の保存では変更しない。
export async function markWorkoutLogCompleted(
  db: SQLiteDatabase,
  workoutLogId: string
): Promise<void> {
  await db.runAsync("UPDATE workout_logs SET completed = 1, updated_at = ? WHERE id = ?;", [
    nowIso(),
    workoutLogId,
  ]);
}

// セット数が増減するため、入れ替え方式で更新する。
export async function replaceWorkoutLogSets(
  db: SQLiteDatabase,
  workoutLogId: string,
  sets: SetLog[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM set_logs WHERE workout_log_id = ?;", [workoutLogId]);
    await insertSets(db, workoutLogId, sets);
    // セットは記録の集約の一部なので、記録そのものが更新されたものとして扱う
    await db.runAsync("UPDATE workout_logs SET updated_at = ? WHERE id = ?;", [
      nowIso(),
      workoutLogId,
    ]);
  });
}

export async function createWorkoutLog(
  db: SQLiteDatabase,
  exerciseId: string,
  date: string,
  sets: SetLog[]
): Promise<WorkoutLog> {
  const workoutLog: WorkoutLog = {
    id: generateId("wl"),
    exerciseId,
    date,
    sets,
    completed: false,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO workout_logs (id, exercise_id, date, updated_at) VALUES (?, ?, ?, ?);",
      [workoutLog.id, exerciseId, date, nowIso()]
    );
    await insertSets(db, workoutLog.id, sets);
  });

  return workoutLog;
}

async function insertSets(
  db: SQLiteDatabase,
  workoutLogId: string,
  sets: SetLog[]
): Promise<void> {
  for (let index = 0; index < sets.length; index += 1) {
    const set = sets[index];
    await db.runAsync(
      `INSERT INTO set_logs (workout_log_id, order_index, weight, reps, time_sec, distance_km, rpe)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        workoutLogId,
        index,
        set.weight ?? null,
        set.reps ?? null,
        set.timeSec ?? null,
        set.distanceKm ?? null,
        set.rpe ?? null,
      ]
    );
  }
}
