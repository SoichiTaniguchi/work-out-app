import type { SQLiteDatabase } from "expo-sqlite";
import type { SetLog, WorkoutLog } from "@/types";
import { generateId } from "@/db/id";

interface WorkoutLogRow {
  id: string;
  exercise_id: string;
  date: string;
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

async function loadSets(db: SQLiteDatabase, workoutLogId: string): Promise<SetLog[]> {
  const rows = await db.getAllAsync<SetLogRow>(
    "SELECT * FROM set_logs WHERE workout_log_id = ? ORDER BY order_index ASC;",
    [workoutLogId]
  );
  return rows.map(rowToSetLog);
}

export async function getLastWorkoutLog(
  db: SQLiteDatabase,
  exerciseId: string
): Promise<WorkoutLog | null> {
  const row = await db.getFirstAsync<WorkoutLogRow>(
    "SELECT * FROM workout_logs WHERE exercise_id = ? ORDER BY date DESC LIMIT 1;",
    [exerciseId]
  );
  if (!row) return null;

  return {
    id: row.id,
    exerciseId: row.exercise_id,
    date: row.date,
    sets: await loadSets(db, row.id),
  };
}

export async function createWorkoutLog(
  db: SQLiteDatabase,
  exerciseId: string,
  date: string,
  sets: SetLog[]
): Promise<WorkoutLog> {
  const workoutLog: WorkoutLog = { id: generateId("wl"), exerciseId, date, sets };

  await db.withTransactionAsync(async () => {
    await db.runAsync("INSERT INTO workout_logs (id, exercise_id, date) VALUES (?, ?, ?);", [
      workoutLog.id,
      exerciseId,
      date,
    ]);

    for (let index = 0; index < sets.length; index += 1) {
      const set = sets[index];
      await db.runAsync(
        `INSERT INTO set_logs (workout_log_id, order_index, weight, reps, time_sec, distance_km, rpe)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          workoutLog.id,
          index,
          set.weight ?? null,
          set.reps ?? null,
          set.timeSec ?? null,
          set.distanceKm ?? null,
          set.rpe ?? null,
        ]
      );
    }
  });

  return workoutLog;
}
