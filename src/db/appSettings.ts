import type { SQLiteDatabase } from "expo-sqlite";

// 端末ごとの設定と同期の状態。app_settings テーブルにキーと値で持つ。
// 同期対象ではない(この端末だけの情報)。

export const DEFAULT_SERVER_URL = "http://192.168.0.20:3000";

export type AppSettingKey =
  | "serverUrl"
  | "syncToken"
  /** サーバーから「どこまで受け取ったか」(POST /sync のcursor)。 */
  | "lastCursor"
  /** 前回ローカルの変更を送った時刻。これより新しい updated_at の行が未同期。 */
  | "lastPushedAt"
  /** 最後に同期が成功した時刻(画面表示用)。 */
  | "lastSyncedAt"
  /** 最後の同期が失敗していればその理由(画面表示用)。成功したら消す。 */
  | "lastSyncError";

export async function getSetting(
  db: SQLiteDatabase,
  key: AppSettingKey
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = ?;",
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(
  db: SQLiteDatabase,
  key: AppSettingKey,
  value: string | null
): Promise<void> {
  if (value === null) {
    await db.runAsync("DELETE FROM app_settings WHERE key = ?;", [key]);
    return;
  }
  await db.runAsync(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
    [key, value]
  );
}

export interface SyncSettings {
  serverUrl: string;
  syncToken: string | null;
  lastCursor: number | null;
  lastPushedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

export async function getSyncSettings(db: SQLiteDatabase): Promise<SyncSettings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM app_settings;"
  );
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const cursor = values.get("lastCursor");

  return {
    // 未設定なら自宅NASのアドレスを使う。設定画面から変更できる。
    serverUrl: values.get("serverUrl") ?? DEFAULT_SERVER_URL,
    syncToken: values.get("syncToken") ?? null,
    lastCursor: cursor === undefined ? null : Number(cursor),
    lastPushedAt: values.get("lastPushedAt") ?? null,
    lastSyncedAt: values.get("lastSyncedAt") ?? null,
    lastSyncError: values.get("lastSyncError") ?? null,
  };
}
