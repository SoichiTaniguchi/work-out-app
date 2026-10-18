import type { SQLiteDatabase } from "expo-sqlite";
import { getSyncSettings, setSetting } from "@/db/appSettings";
import { nowIso } from "@/db/timestamps";
import { applyRemoteChanges } from "@/sync/apply";
import { postSync, SyncError } from "@/sync/client";
import { collectLocalChanges } from "@/sync/collect";
import { countChanges } from "@/sync/types";

export interface SyncResult {
  sent: number;
  received: number;
}

// 同期1回分。ローカルの未送信分を送り、返ってきた変更を反映する。
// 失敗したら lastCursor / lastPushedAt を進めないので、次回また同じ範囲からやり直す。
export async function runSync(db: SQLiteDatabase, userId: string): Promise<SyncResult> {
  const settings = await getSyncSettings(db);
  // 収集より前の時刻を控える。送信中に書かれた変更を次回取りこぼさないため。
  const startedAt = nowIso();

  try {
    const changes = await collectLocalChanges(db, userId, settings.lastPushedAt);
    const response = await postSync(settings.serverUrl, settings.syncToken, {
      userId,
      since: settings.lastCursor,
      changes,
    });

    const received = await applyRemoteChanges(db, response.changes);

    await setSetting(db, "lastCursor", String(response.cursor));
    await setSetting(db, "lastPushedAt", startedAt);
    await setSetting(db, "lastSyncedAt", nowIso());
    await setSetting(db, "lastSyncError", null);

    return { sent: countChanges(changes), received };
  } catch (error) {
    const message = error instanceof SyncError ? error.message : String(error);
    await setSetting(db, "lastSyncError", message);

    // 反映に失敗した場合は、受信済みの範囲が中途半端な可能性がある。
    // 次回は全件取り直して整合性を回復する。
    if (!(error instanceof SyncError)) {
      await setSetting(db, "lastCursor", null);
    }

    throw error instanceof SyncError ? error : new SyncError(message);
  }
}

// 起動時や記録終了後の自動同期用。失敗しても画面を止めたくないので握りつぶす
// (理由は lastSyncError に残り、設定画面で確認できる)。
export async function runSyncQuietly(db: SQLiteDatabase, userId: string): Promise<void> {
  try {
    await runSync(db, userId);
  } catch {
    // 設定画面の「最終同期」表示に出るのでここでは何もしない
  }
}
