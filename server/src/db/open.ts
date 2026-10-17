import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { createSchema } from "./schema.js";

// NASのボリューム上にDBファイルを置く想定。初回起動時はディレクトリごと作る。
// ":memory:" を渡すとテスト用のインメモリDBになる。
export function openDatabase(path: string): Database.Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new Database(path);
  // WAL: 同期中の書き込みと読み取りが互いをブロックしないようにする。
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  createSchema(db);

  return db;
}
