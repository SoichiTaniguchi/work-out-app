import type { SQLiteDatabase } from "expo-sqlite";
import type { User } from "@/types";
import { generateId } from "@/db/id";
import { nowIso } from "@/db/timestamps";

export async function listUsers(db: SQLiteDatabase): Promise<User[]> {
  return db.getAllAsync<User>(
    "SELECT id, name FROM users WHERE deleted_at IS NULL ORDER BY name ASC;"
  );
}

export async function getUser(db: SQLiteDatabase, userId: string): Promise<User | null> {
  return db.getFirstAsync<User>(
    "SELECT id, name FROM users WHERE id = ? AND deleted_at IS NULL;",
    [userId]
  );
}

export async function createUser(db: SQLiteDatabase, name: string): Promise<User> {
  const user: User = { id: generateId("us"), name };
  await db.runAsync("INSERT INTO users (id, name, updated_at) VALUES (?, ?, ?);", [
    user.id,
    user.name,
    nowIso(),
  ]);
  return user;
}

export async function updateUser(
  db: SQLiteDatabase,
  id: string,
  patch: { name: string }
): Promise<void> {
  await db.runAsync("UPDATE users SET name = ?, updated_at = ? WHERE id = ?;", [
    patch.name,
    nowIso(),
    id,
  ]);
}

// 論理削除。FKの ON DELETE CASCADE は物理削除でしか働かないので、配下のプログラム・種目と
// その記録・自己ベスト、日次記録にも明示的に deleted_at を打つ。
export async function deleteUser(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowIso();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE personal_records SET deleted_at = ?, updated_at = ?
       WHERE deleted_at IS NULL
         AND exercise_id IN (SELECT id FROM exercises WHERE user_id = ?);`,
      [now, now, id]
    );
    await db.runAsync(
      `UPDATE workout_logs SET deleted_at = ?, updated_at = ?
       WHERE deleted_at IS NULL
         AND exercise_id IN (SELECT id FROM exercises WHERE user_id = ?);`,
      [now, now, id]
    );
    await db.runAsync(
      "DELETE FROM folder_exercises WHERE folder_id IN (SELECT id FROM folders WHERE user_id = ?);",
      [id]
    );
    await db.runAsync(
      "UPDATE exercises SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND deleted_at IS NULL;",
      [now, now, id]
    );
    await db.runAsync(
      "UPDATE folders SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND deleted_at IS NULL;",
      [now, now, id]
    );
    // 日次記録(体重・体調・排便)はユーザーに直接ぶら下がる
    await db.runAsync(
      "UPDATE daily_logs SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND deleted_at IS NULL;",
      [now, now, id]
    );
    await db.runAsync("UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ?;", [
      now,
      now,
      id,
    ]);
  });
}
