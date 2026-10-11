import type { SQLiteDatabase } from "expo-sqlite";
import type { User } from "@/types";
import { generateId } from "@/db/id";

export async function listUsers(db: SQLiteDatabase): Promise<User[]> {
  return db.getAllAsync<User>("SELECT id, name FROM users ORDER BY name ASC;");
}

export async function getUser(db: SQLiteDatabase, userId: string): Promise<User | null> {
  return db.getFirstAsync<User>("SELECT id, name FROM users WHERE id = ?;", [userId]);
}

export async function createUser(db: SQLiteDatabase, name: string): Promise<User> {
  const user: User = { id: generateId("us"), name };
  await db.runAsync("INSERT INTO users (id, name) VALUES (?, ?);", [user.id, user.name]);
  return user;
}

export async function updateUser(
  db: SQLiteDatabase,
  id: string,
  patch: { name: string }
): Promise<void> {
  await db.runAsync("UPDATE users SET name = ? WHERE id = ?;", [patch.name, id]);
}

// folders.user_id / exercises.user_id が ON DELETE CASCADE なので、
// このユーザーのプログラム・種目と、種目に紐づく記録・自己ベストも連鎖削除される。
export async function deleteUser(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync("DELETE FROM users WHERE id = ?;", [id]);
}
