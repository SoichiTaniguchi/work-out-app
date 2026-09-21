import type { SQLiteDatabase } from "expo-sqlite";

// UserSelectScreen の MOCK_USERS と同じ id/name。
// ユーザーのCRUD/永続化自体は対象外のため、外部キー整合性のためだけに種目・フォルダより先にシードする。
const SEED_USERS = [
  { id: "u1", name: "そーいち" },
  { id: "u2", name: "お父さん" },
  { id: "u3", name: "お母さん" },
];

const DATABASE_VERSION = 1;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA foreign_keys = ON;");

  const { user_version: currentVersion } = (await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version;"
  )) ?? { user_version: 0 };

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

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

    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
  });
}
