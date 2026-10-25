import type { Database } from "better-sqlite3";
import { currentSeq, nextSeq } from "../db/schema.js";
import { ValidationError } from "./validate.js";
import {
  countChanges,
  emptyChanges,
  type PersonalRecordType,
  type RecordFieldType,
  type SyncChanges,
  type SyncRequest,
  type SyncResponse,
  type SyncSet,
  type SyncUser,
} from "./types.js";

// 受け取った変更のうち、サーバー側の方が新しくて採用しなかった行のid。
// 採用しなかったことをクライアントに伝えないと端末に古い値が残り続けるため、
// レスポンスにはサーバー側の行を必ず含めて返す。
interface RejectedIds {
  users: string[];
  folders: string[];
  exercises: string[];
  workoutLogs: string[];
  personalRecords: string[];
  dailyLogs: string[];
}

function emptyRejected(): RejectedIds {
  return {
    users: [],
    folders: [],
    exercises: [],
    workoutLogs: [],
    personalRecords: [],
    dailyLogs: [],
  };
}

// Last Write Wins。同時刻ならサーバー側を残す(端末ごとに結果がぶれないようにするため)。
function serverWins(existingUpdatedAt: string | undefined, incomingUpdatedAt: string): boolean {
  return existingUpdatedAt !== undefined && existingUpdatedAt >= incomingUpdatedAt;
}

export function applySync(db: Database, request: SyncRequest): SyncResponse {
  const run = db.transaction((): SyncResponse => {
    const rejected = emptyRejected();
    // 送られてきた変更が無ければ連番を進めない(受信だけの同期でcursorが動かないように)。
    const seq = countChanges(request.changes) > 0 ? nextSeq(db) : currentSeq(db);

    pushUsers(db, request.changes.users, seq, rejected);
    pushExercises(db, request, seq, rejected);
    pushFolders(db, request, seq, rejected);
    pushWorkoutLogs(db, request, seq, rejected);
    pushPersonalRecords(db, request, seq, rejected);
    pushDailyLogs(db, request, seq, rejected);

    return {
      cursor: seq,
      changes: pullChanges(db, request.userId, request.since ?? -1, rejected),
    };
  });

  return run();
}

/* ------------------------------------------------------------------ push */

interface ExistingRow {
  id: string;
  updated_at: string;
}

function pushUsers(db: Database, users: SyncUser[], seq: number, rejected: RejectedIds): void {
  const select = db.prepare("SELECT id, updated_at FROM users WHERE id = ?;");
  const upsert = db.prepare(`
    INSERT INTO users (id, name, updated_at, deleted_at, server_seq)
    VALUES (@id, @name, @updatedAt, @deletedAt, @seq)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      server_seq = excluded.server_seq;
  `);

  for (const user of users) {
    const existing = select.get(user.id) as ExistingRow | undefined;
    if (serverWins(existing?.updated_at, user.updatedAt)) {
      rejected.users.push(user.id);
      continue;
    }
    upsert.run({
      id: user.id,
      name: user.name,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      seq,
    });
  }
}

function pushExercises(
  db: Database,
  request: SyncRequest,
  seq: number,
  rejected: RejectedIds
): void {
  const select = db.prepare("SELECT id, updated_at FROM exercises WHERE id = ?;");
  const upsert = db.prepare(`
    INSERT INTO exercises
      (id, user_id, name, body_parts, equipment, field_definition, updated_at, deleted_at, server_seq)
    VALUES
      (@id, @userId, @name, @bodyParts, @equipment, @fieldDefinition, @updatedAt, @deletedAt, @seq)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      name = excluded.name,
      body_parts = excluded.body_parts,
      equipment = excluded.equipment,
      field_definition = excluded.field_definition,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      server_seq = excluded.server_seq;
  `);

  for (const exercise of request.changes.exercises) {
    if (exercise.userId !== request.userId) {
      throw new ValidationError(
        `exercise ${exercise.id} belongs to another user: ${exercise.userId}`
      );
    }

    const existing = select.get(exercise.id) as ExistingRow | undefined;
    if (serverWins(existing?.updated_at, exercise.updatedAt)) {
      rejected.exercises.push(exercise.id);
      continue;
    }

    upsert.run({
      id: exercise.id,
      userId: exercise.userId,
      name: exercise.name,
      bodyParts: JSON.stringify(exercise.bodyParts),
      equipment: exercise.equipment,
      fieldDefinition: JSON.stringify(exercise.fieldDefinition),
      updatedAt: exercise.updatedAt,
      deletedAt: exercise.deletedAt,
      seq,
    });
  }
}

function pushFolders(
  db: Database,
  request: SyncRequest,
  seq: number,
  rejected: RejectedIds
): void {
  const select = db.prepare("SELECT id, updated_at FROM folders WHERE id = ?;");
  const upsert = db.prepare(`
    INSERT INTO folders (id, user_id, name, order_index, updated_at, deleted_at, server_seq)
    VALUES (@id, @userId, @name, @order, @updatedAt, @deletedAt, @seq)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      name = excluded.name,
      order_index = excluded.order_index,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      server_seq = excluded.server_seq;
  `);
  const deleteLinks = db.prepare("DELETE FROM folder_exercises WHERE folder_id = ?;");
  const insertLink = db.prepare(
    "INSERT INTO folder_exercises (folder_id, exercise_id, order_index) VALUES (?, ?, ?);"
  );

  for (const folder of request.changes.folders) {
    if (folder.userId !== request.userId) {
      throw new ValidationError(`folder ${folder.id} belongs to another user: ${folder.userId}`);
    }

    const existing = select.get(folder.id) as ExistingRow | undefined;
    if (serverWins(existing?.updated_at, folder.updatedAt)) {
      rejected.folders.push(folder.id);
      continue;
    }

    upsert.run({
      id: folder.id,
      userId: folder.userId,
      name: folder.name,
      order: folder.order,
      updatedAt: folder.updatedAt,
      deletedAt: folder.deletedAt,
      seq,
    });

    // 所属リンクはフォルダの集約の一部なので、丸ごと入れ替える。
    deleteLinks.run(folder.id);
    if (folder.deletedAt === null) {
      folder.exerciseIds.forEach((exerciseId, index) => {
        insertLink.run(folder.id, exerciseId, index);
      });
    }
  }
}

function pushWorkoutLogs(
  db: Database,
  request: SyncRequest,
  seq: number,
  rejected: RejectedIds
): void {
  const select = db.prepare("SELECT id, updated_at FROM workout_logs WHERE id = ?;");
  const upsert = db.prepare(`
    INSERT INTO workout_logs (id, exercise_id, date, completed, updated_at, deleted_at, server_seq)
    VALUES (@id, @exerciseId, @date, @completed, @updatedAt, @deletedAt, @seq)
    ON CONFLICT(id) DO UPDATE SET
      exercise_id = excluded.exercise_id,
      date = excluded.date,
      completed = excluded.completed,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      server_seq = excluded.server_seq;
  `);
  const deleteSets = db.prepare("DELETE FROM set_logs WHERE workout_log_id = ?;");
  const insertSet = db.prepare(`
    INSERT INTO set_logs (workout_log_id, order_index, weight, reps, time_sec, distance_km, rpe)
    VALUES (@workoutLogId, @orderIndex, @weight, @reps, @timeSec, @distanceKm, @rpe);
  `);

  for (const log of request.changes.workoutLogs) {
    requireOwnedExercise(db, log.exerciseId, request.userId, `workout log ${log.id}`);

    const existing = select.get(log.id) as ExistingRow | undefined;
    if (serverWins(existing?.updated_at, log.updatedAt)) {
      rejected.workoutLogs.push(log.id);
      continue;
    }

    upsert.run({
      id: log.id,
      exerciseId: log.exerciseId,
      date: log.date,
      completed: log.completed ? 1 : 0,
      updatedAt: log.updatedAt,
      deletedAt: log.deletedAt,
      seq,
    });

    // セットは記録の集約の一部なので、アプリ側と同じく入れ替え方式。
    deleteSets.run(log.id);
    if (log.deletedAt === null) {
      log.sets.forEach((set, index) => {
        insertSet.run({
          workoutLogId: log.id,
          orderIndex: index,
          weight: set.weight ?? null,
          reps: set.reps ?? null,
          timeSec: set.timeSec ?? null,
          distanceKm: set.distanceKm ?? null,
          rpe: set.rpe ?? null,
        });
      });
    }
  }
}

function pushPersonalRecords(
  db: Database,
  request: SyncRequest,
  seq: number,
  rejected: RejectedIds
): void {
  const selectById = db.prepare("SELECT id, updated_at FROM personal_records WHERE id = ?;");
  // アプリは自己ベストを更新するたびに新しいidで作り直すため、同じ (種目, 種別) に
  // 別idの行が既にあることがある。UNIQUE制約と同じ粒度でも既存行を探す。
  const selectByKey = db.prepare(
    "SELECT id, updated_at FROM personal_records WHERE exercise_id = ? AND type = ?;"
  );
  const deleteById = db.prepare("DELETE FROM personal_records WHERE id = ?;");
  const upsert = db.prepare(`
    INSERT INTO personal_records
      (id, exercise_id, type, value, achieved_at, updated_at, deleted_at, server_seq)
    VALUES
      (@id, @exerciseId, @type, @value, @achievedAt, @updatedAt, @deletedAt, @seq)
    ON CONFLICT(id) DO UPDATE SET
      exercise_id = excluded.exercise_id,
      type = excluded.type,
      value = excluded.value,
      achieved_at = excluded.achieved_at,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      server_seq = excluded.server_seq;
  `);

  for (const record of request.changes.personalRecords) {
    requireOwnedExercise(db, record.exerciseId, request.userId, `personal record ${record.id}`);

    const existing = (selectById.get(record.id) ??
      selectByKey.get(record.exerciseId, record.type)) as ExistingRow | undefined;

    if (existing && serverWins(existing.updated_at, record.updatedAt)) {
      // サーバー側の行をそのまま返したいので、採用しなかったのはサーバー側のid。
      rejected.personalRecords.push(existing.id);
      continue;
    }

    if (existing && existing.id !== record.id) {
      deleteById.run(existing.id);
    }

    upsert.run({
      id: record.id,
      exerciseId: record.exerciseId,
      type: record.type,
      value: record.value,
      achievedAt: record.achievedAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
      seq,
    });
  }
}

function pushDailyLogs(
  db: Database,
  request: SyncRequest,
  seq: number,
  rejected: RejectedIds
): void {
  const selectById = db.prepare("SELECT id, updated_at FROM daily_logs WHERE id = ?;");
  // 同じ日の記録を2台の端末が別々に作ると、idが違う行が UNIQUE(user_id, date) でぶつかる。
  // そのため自己ベストと同じく、日付の粒度でも既存行を探す。
  const selectByKey = db.prepare(
    "SELECT id, updated_at FROM daily_logs WHERE user_id = ? AND date = ?;"
  );
  const deleteById = db.prepare("DELETE FROM daily_logs WHERE id = ?;");
  const upsert = db.prepare(`
    INSERT INTO daily_logs
      (id, user_id, date, weight, condition_level, bowel_moved, updated_at, deleted_at, server_seq)
    VALUES
      (@id, @userId, @date, @weight, @condition, @bowelMoved, @updatedAt, @deletedAt, @seq)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      date = excluded.date,
      weight = excluded.weight,
      condition_level = excluded.condition_level,
      bowel_moved = excluded.bowel_moved,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      server_seq = excluded.server_seq;
  `);

  for (const log of request.changes.dailyLogs) {
    if (log.userId !== request.userId) {
      throw new ValidationError(`daily log ${log.id} belongs to another user: ${log.userId}`);
    }

    const existing = (selectById.get(log.id) ??
      selectByKey.get(log.userId, log.date)) as ExistingRow | undefined;

    if (existing && serverWins(existing.updated_at, log.updatedAt)) {
      // サーバー側の行をそのまま返したいので、採用しなかったのはサーバー側のid。
      rejected.dailyLogs.push(existing.id);
      continue;
    }

    if (existing && existing.id !== log.id) {
      deleteById.run(existing.id);
    }

    upsert.run({
      id: log.id,
      userId: log.userId,
      date: log.date,
      weight: log.weight,
      condition: log.condition,
      bowelMoved: log.bowelMoved === null ? null : log.bowelMoved ? 1 : 0,
      updatedAt: log.updatedAt,
      deletedAt: log.deletedAt,
      seq,
    });
  }
}

// 他人のデータを書き換えられないよう、記録・自己ベストがぶら下がる種目の持ち主を確認する。
function requireOwnedExercise(
  db: Database,
  exerciseId: string,
  userId: string,
  subject: string
): void {
  const owner = db.prepare("SELECT user_id FROM exercises WHERE id = ?;").get(exerciseId) as
    | { user_id: string }
    | undefined;

  if (!owner) {
    throw new ValidationError(`${subject} references an unknown exercise: ${exerciseId}`);
  }
  if (owner.user_id !== userId) {
    throw new ValidationError(`${subject} belongs to another user: ${owner.user_id}`);
  }
}

/* ------------------------------------------------------------------ pull */

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

interface DailyLogRow {
  id: string;
  user_id: string;
  date: string;
  weight: number | null;
  condition_level: number | null;
  bowel_moved: number | null;
  updated_at: string;
  deleted_at: string | null;
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

// 「前回以降に更新された行」に加えて、今回採用しなかった行も必ず返す。
function idFilter(column: string, ids: string[]): string {
  return ids.length === 0 ? "" : ` OR ${column} IN (${ids.map(() => "?").join(", ")})`;
}

function pullChanges(
  db: Database,
  userId: string,
  since: number,
  rejected: RejectedIds
): SyncChanges {
  const changes = emptyChanges();

  // ユーザー一覧はログイン画面で全員分が必要なので、ユーザーで絞らない。
  const userRows = db
    .prepare(`SELECT * FROM users WHERE server_seq > ?${idFilter("id", rejected.users)};`)
    .all(since, ...rejected.users) as UserRow[];
  changes.users = userRows.map((row) => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));

  const exerciseRows = db
    .prepare(
      `SELECT * FROM exercises
       WHERE user_id = ? AND (server_seq > ?${idFilter("id", rejected.exercises)});`
    )
    .all(userId, since, ...rejected.exercises) as ExerciseRow[];
  changes.exercises = exerciseRows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    bodyParts: JSON.parse(row.body_parts) as string[],
    equipment: row.equipment,
    fieldDefinition: JSON.parse(row.field_definition) as RecordFieldType[],
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));

  const selectLinks = db.prepare(
    "SELECT exercise_id FROM folder_exercises WHERE folder_id = ? ORDER BY order_index ASC;"
  );
  const folderRows = db
    .prepare(
      `SELECT * FROM folders
       WHERE user_id = ? AND (server_seq > ?${idFilter("id", rejected.folders)});`
    )
    .all(userId, since, ...rejected.folders) as FolderRow[];
  changes.folders = folderRows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    order: row.order_index,
    exerciseIds: (selectLinks.all(row.id) as { exercise_id: string }[]).map(
      (link) => link.exercise_id
    ),
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));

  const selectSets = db.prepare(
    "SELECT * FROM set_logs WHERE workout_log_id = ? ORDER BY order_index ASC;"
  );
  const logRows = db
    .prepare(
      `SELECT wl.* FROM workout_logs wl
       INNER JOIN exercises e ON e.id = wl.exercise_id
       WHERE e.user_id = ? AND (wl.server_seq > ?${idFilter("wl.id", rejected.workoutLogs)});`
    )
    .all(userId, since, ...rejected.workoutLogs) as WorkoutLogRow[];
  changes.workoutLogs = logRows.map((row) => ({
    id: row.id,
    exerciseId: row.exercise_id,
    date: row.date,
    completed: row.completed === 1,
    sets: (selectSets.all(row.id) as SetLogRow[]).map(toSyncSet),
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));

  const recordRows = db
    .prepare(
      `SELECT pr.* FROM personal_records pr
       INNER JOIN exercises e ON e.id = pr.exercise_id
       WHERE e.user_id = ? AND (pr.server_seq > ?${idFilter("pr.id", rejected.personalRecords)});`
    )
    .all(userId, since, ...rejected.personalRecords) as PersonalRecordRow[];
  changes.personalRecords = recordRows.map((row) => ({
    id: row.id,
    exerciseId: row.exercise_id,
    type: row.type,
    value: row.value,
    achievedAt: row.achieved_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));

  const dailyLogRows = db
    .prepare(
      `SELECT * FROM daily_logs
       WHERE user_id = ? AND (server_seq > ?${idFilter("id", rejected.dailyLogs)});`
    )
    .all(userId, since, ...rejected.dailyLogs) as DailyLogRow[];
  changes.dailyLogs = dailyLogRows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    date: row.date,
    weight: row.weight,
    condition: row.condition_level,
    bowelMoved: row.bowel_moved === null ? null : row.bowel_moved === 1,
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
