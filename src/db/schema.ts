import type { SQLiteDatabase } from "expo-sqlite";

// UserSelectScreen の MOCK_USERS と同じ id/name。
// ユーザーのCRUD/永続化自体は対象外のため、外部キー整合性のためだけに種目・フォルダより先にシードする。
const SEED_USERS = [
  { id: "u1", name: "そーいち" },
  { id: "u2", name: "お父さん" },
  { id: "u3", name: "お母さん" },
];

const DATABASE_VERSION = 6;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA foreign_keys = ON;");

  let { user_version: currentVersion } = (await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version;"
  )) ?? { user_version: 0 };

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS folders (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          order_index INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS exercises (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          body_parts TEXT NOT NULL,
          equipment TEXT NOT NULL DEFAULT '',
          field_definition TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS folder_exercises (
          folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
          exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
          order_index INTEGER NOT NULL,
          PRIMARY KEY (folder_id, exercise_id)
        );
      `);

      for (const user of SEED_USERS) {
        await db.runAsync("INSERT OR IGNORE INTO users (id, name) VALUES (?, ?);", [
          user.id,
          user.name,
        ]);
      }

      await db.execAsync("PRAGMA user_version = 1;");
    });
    currentVersion = 1;
  }

  if (currentVersion < 2) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS workout_logs (
          id TEXT PRIMARY KEY NOT NULL,
          exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
          date TEXT NOT NULL
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
          UNIQUE(exercise_id, type)
        );
      `);

      await db.execAsync("PRAGMA user_version = 2;");
    });
    currentVersion = 2;
  }

  if (currentVersion < 3) {
    await db.withTransactionAsync(async () => {
      // 「この種目を完了」を押したかどうか。セット完了ごとの保存では立たないので、
      // 種目一覧で「実施中」と「完了」を区別できる。既存の記録は実施中扱いになる。
      await db.execAsync(
        "ALTER TABLE workout_logs ADD COLUMN completed INTEGER NOT NULL DEFAULT 0;"
      );
      await db.execAsync("PRAGMA user_version = 3;");
    });
    currentVersion = 3;
  }

  if (currentVersion < 4) {
    await db.withTransactionAsync(async () => {
      // NAS同期の土台。updated_at でLast Write Winsを判定し、削除は deleted_at による
      // 論理削除にして「削除された」ことをサーバーへ伝えられるようにする。
      // ALTER TABLE のデフォルトには非定数を書けないので、空文字で追加してから現在時刻で埋める。
      for (const table of [
        "users",
        "folders",
        "exercises",
        "workout_logs",
        "personal_records",
      ]) {
        await db.execAsync(
          `ALTER TABLE ${table} ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
           ALTER TABLE ${table} ADD COLUMN deleted_at TEXT;`
        );
        await db.runAsync(`UPDATE ${table} SET updated_at = ? WHERE updated_at = '';`, [
          new Date().toISOString(),
        ]);
      }

      await db.execAsync("PRAGMA user_version = 4;");
    });
    currentVersion = 4;
  }

  if (currentVersion < 5) {
    await db.withTransactionAsync(async () => {
      // 端末ごとの設定と同期の状態。NASの接続先や「どこまで同期したか」を持つ。
      // 端末固有の情報なので、このテーブル自体は同期しない。
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      await db.execAsync("PRAGMA user_version = 5;");
    });
    currentVersion = 5;
  }

  if (currentVersion < 6) {
    await db.withTransactionAsync(async () => {
      // 体重・体調・排便の日次記録。1日1行(user_id と date で一意)。
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS daily_logs (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          weight REAL,
          condition_level INTEGER,
          bowel_moved INTEGER,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          UNIQUE(user_id, date)
        );
      `);
      await db.execAsync("PRAGMA user_version = 6;");
    });
    currentVersion = 6;
  }
}
