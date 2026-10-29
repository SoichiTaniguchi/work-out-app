import type { Database } from "better-sqlite3";

// アプリ側(src/db/schema.ts)のスキーマをそのまま写したもの。
// 違いは server_seq だけで、これは「どこまで受け取ったか」をクライアントが追うための
// サーバー内部の連番(端末の時計に依存しない取得位置)。
// updated_at は端末が書いた時刻で、Last Write Winsの勝ち負け判定にのみ使う。
export function createSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_seq INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      server_seq INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      server_seq INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      body_parts TEXT NOT NULL,
      equipment TEXT NOT NULL DEFAULT '',
      field_definition TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      server_seq INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folder_exercises (
      folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL,
      PRIMARY KEY (folder_id, exercise_id)
    );

    CREATE TABLE IF NOT EXISTS workout_logs (
      id TEXT PRIMARY KEY NOT NULL,
      exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      server_seq INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS set_logs (
      workout_log_id TEXT NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL,
      weight REAL,
      reps INTEGER,
      time_sec INTEGER,
      distance_km REAL,
      rpe REAL,
      PRIMARY KEY (workout_log_id, order_index)
    );

    CREATE TABLE IF NOT EXISTS personal_records (
      id TEXT PRIMARY KEY NOT NULL,
      exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      achieved_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      server_seq INTEGER NOT NULL,
      UNIQUE (exercise_id, type)
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      weight REAL,
      condition_level INTEGER,
      bowel_moved INTEGER,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      server_seq INTEGER NOT NULL,
      UNIQUE (user_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_users_seq ON users (server_seq);
    CREATE INDEX IF NOT EXISTS idx_folders_seq ON folders (server_seq);
    CREATE INDEX IF NOT EXISTS idx_exercises_seq ON exercises (server_seq);
    CREATE INDEX IF NOT EXISTS idx_workout_logs_seq ON workout_logs (server_seq);
    CREATE INDEX IF NOT EXISTS idx_personal_records_seq ON personal_records (server_seq);
    CREATE INDEX IF NOT EXISTS idx_daily_logs_seq ON daily_logs (server_seq);

    INSERT OR IGNORE INTO sync_state (id, last_seq) VALUES (1, 0);
  `);
}

// 同期1回分(1トランザクション)につき1つ払い出す。
// クライアントはレスポンスのcursorを保存し、次回 server_seq > cursor の行だけ受け取る。
export function nextSeq(db: Database): number {
  const row = db
    .prepare("UPDATE sync_state SET last_seq = last_seq + 1 WHERE id = 1 RETURNING last_seq;")
    .get() as { last_seq: number } | undefined;

  if (!row) {
    throw new Error("sync_state row is missing");
  }
  return row.last_seq;
}

export function currentSeq(db: Database): number {
  const row = db.prepare("SELECT last_seq FROM sync_state WHERE id = 1;").get() as
    | { last_seq: number }
    | undefined;
  return row?.last_seq ?? 0;
}
