import type { SQLiteDatabase } from "expo-sqlite";
import type { User } from "@/types";

export async function getUser(db: SQLiteDatabase, userId: string): Promise<User | null> {
  return db.getFirstAsync<User>("SELECT id, name FROM users WHERE id = ?;", [userId]);
}
