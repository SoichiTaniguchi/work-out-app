import type { SQLiteDatabase } from "expo-sqlite";
import type { SyncChanges } from "@/sync/types";

// サーバーから受け取った変更をローカルDBに反映する。
// サーバー側でもLast Write Winsで解決済みだが、送信してから受信するまでの間に
// この端末で編集された行を潰さないよう、ローカルでも updated_at を比べて新しい方を残す。
//
// 親子関係(種目 → 記録)のため、users → exercises → folders → workout_logs →
// personal_records の順に適用する。外部キーが有効なので順序を崩すと失敗する。

export async function applyRemoteChanges(
  db: SQLiteDatabase,
  changes: SyncChanges
): Promise<number> {
  let applied = 0;

  await db.withTransactionAsync(async () => {
    for (const user of changes.users) {
      if (!(await isNewer(db, "users", user.id, user.updatedAt))) continue;
      await db.runAsync(
        `INSERT INTO users (id, name, updated_at, deleted_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at;`,
        [user.id, user.name, user.updatedAt, user.deletedAt]
      );
      applied += 1;
    }

    for (const exercise of changes.exercises) {
      if (!(await isNewer(db, "exercises", exercise.id, exercise.updatedAt))) continue;
      await db.runAsync(
        `INSERT INTO exercises
           (id, user_id, name, body_parts, equipment, field_definition, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           name = excluded.name,
           body_parts = excluded.body_parts,
           equipment = excluded.equipment,
           field_definition = excluded.field_definition,
           updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at;`,
        [
          exercise.id,
          exercise.userId,
          exercise.name,
          JSON.stringify(exercise.bodyParts),
          exercise.equipment,
          JSON.stringify(exercise.fieldDefinition),
          exercise.updatedAt,
          exercise.deletedAt,
        ]
      );
      applied += 1;
    }

    for (const folder of changes.folders) {
      if (!(await isNewer(db, "folders", folder.id, folder.updatedAt))) continue;
      await db.runAsync(
        `INSERT INTO folders (id, user_id, name, order_index, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           name = excluded.name,
           order_index = excluded.order_index,
           updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at;`,
        [folder.id, folder.userId, folder.name, folder.order, folder.updatedAt, folder.deletedAt]
      );

      // 所属リンクはフォルダの集約の一部なので丸ごと入れ替える。
      await db.runAsync("DELETE FROM folder_exercises WHERE folder_id = ?;", [folder.id]);
      if (folder.deletedAt === null) {
        for (let index = 0; index < folder.exerciseIds.length; index += 1) {
          // 種目がまだこの端末に無い場合は外部キーで落ちるため、存在するものだけ繋ぐ
          await db.runAsync(
            `INSERT OR IGNORE INTO folder_exercises (folder_id, exercise_id, order_index)
             SELECT ?, id, ? FROM exercises WHERE id = ?;`,
            [folder.id, index, folder.exerciseIds[index]]
          );
        }
      }
      applied += 1;
    }

    for (const log of changes.workoutLogs) {
      if (!(await isNewer(db, "workout_logs", log.id, log.updatedAt))) continue;
      if (!(await exerciseExists(db, log.exerciseId))) continue;

      await db.runAsync(
        `INSERT INTO workout_logs (id, exercise_id, date, completed, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           exercise_id = excluded.exercise_id,
           date = excluded.date,
           completed = excluded.completed,
           updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at;`,
        [log.id, log.exerciseId, log.date, log.completed ? 1 : 0, log.updatedAt, log.deletedAt]
      );

      // セットは記録の集約の一部なので入れ替え方式(アプリ内の保存処理と同じ)。
      await db.runAsync("DELETE FROM set_logs WHERE workout_log_id = ?;", [log.id]);
      if (log.deletedAt === null) {
        for (let index = 0; index < log.sets.length; index += 1) {
          const set = log.sets[index];
          await db.runAsync(
            `INSERT INTO set_logs
               (workout_log_id, order_index, weight, reps, time_sec, distance_km, rpe)
             VALUES (?, ?, ?, ?, ?, ?, ?);`,
            [
              log.id,
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
      applied += 1;
    }

    for (const record of changes.personalRecords) {
      if (!(await isNewer(db, "personal_records", record.id, record.updatedAt))) continue;
      if (!(await exerciseExists(db, record.exerciseId))) continue;

      // UNIQUE(exercise_id, type) があるため、同じ種目・種別の別idの行は先に片付ける。
      await db.runAsync(
        "DELETE FROM personal_records WHERE exercise_id = ? AND type = ? AND id <> ?;",
        [record.exerciseId, record.type, record.id]
      );
      await db.runAsync(
        `INSERT INTO personal_records
           (id, exercise_id, type, value, achieved_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           exercise_id = excluded.exercise_id,
           type = excluded.type,
           value = excluded.value,
           achieved_at = excluded.achieved_at,
           updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at;`,
        [
          record.id,
          record.exerciseId,
          record.type,
          record.value,
          record.achievedAt,
          record.updatedAt,
          record.deletedAt,
        ]
      );
      applied += 1;
    }
  });

  return applied;
}

async function isNewer(
  db: SQLiteDatabase,
  table: "users" | "folders" | "exercises" | "workout_logs" | "personal_records",
  id: string,
  updatedAt: string
): Promise<boolean> {
  const row = await db.getFirstAsync<{ updated_at: string }>(
    `SELECT updated_at FROM ${table} WHERE id = ?;`,
    [id]
  );
  return row === null || updatedAt > row.updated_at;
}

// 種目がこの端末に無い記録・自己ベストは、外部キーで落ちるので飛ばす。
// 種目は同じ応答の中で先に適用されるため、通常は起こらない。
async function exerciseExists(db: SQLiteDatabase, exerciseId: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ id: string }>("SELECT id FROM exercises WHERE id = ?;", [
    exerciseId,
  ]);
  return row !== null;
}
