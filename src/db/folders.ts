import type { SQLiteDatabase } from "expo-sqlite";
import type { Folder } from "@/types";
import { generateId } from "@/db/id";
import { nowIso } from "@/db/timestamps";

interface FolderRow {
  id: string;
  user_id: string;
  name: string;
  order_index: number;
}

function rowToFolder(row: FolderRow): Folder {
  return { id: row.id, userId: row.user_id, name: row.name, order: row.order_index };
}

export async function listFoldersByUser(db: SQLiteDatabase, userId: string): Promise<Folder[]> {
  const rows = await db.getAllAsync<FolderRow>(
    "SELECT * FROM folders WHERE user_id = ? AND deleted_at IS NULL ORDER BY order_index ASC;",
    [userId]
  );
  return rows.map(rowToFolder);
}

export interface FolderSummary {
  folder: Folder;
  exerciseCount: number;
  exerciseNames: string[];
}

// ホーム画面用。フォルダごとに listExercisesByFolder を呼ぶN+1を避けるため1クエリで取得する。
export async function listFolderSummaries(
  db: SQLiteDatabase,
  userId: string
): Promise<FolderSummary[]> {
  const rows = await db.getAllAsync<FolderRow & { exercise_name: string | null }>(
    `SELECT f.*, e.name as exercise_name
     FROM folders f
     LEFT JOIN folder_exercises fe ON fe.folder_id = f.id
     LEFT JOIN exercises e ON e.id = fe.exercise_id AND e.deleted_at IS NULL
     WHERE f.user_id = ? AND f.deleted_at IS NULL
     ORDER BY f.order_index ASC, fe.order_index ASC;`,
    [userId]
  );

  const summaries: FolderSummary[] = [];
  for (const row of rows) {
    let summary = summaries.find((s) => s.folder.id === row.id);
    if (!summary) {
      summary = { folder: rowToFolder(row), exerciseCount: 0, exerciseNames: [] };
      summaries.push(summary);
    }
    if (row.exercise_name !== null) {
      summary.exerciseCount += 1;
      summary.exerciseNames.push(row.exercise_name);
    }
  }
  return summaries;
}

export async function getFolder(db: SQLiteDatabase, id: string): Promise<Folder | null> {
  const row = await db.getFirstAsync<FolderRow>(
    "SELECT * FROM folders WHERE id = ? AND deleted_at IS NULL;",
    [id]
  );
  return row ? rowToFolder(row) : null;
}

export async function createFolder(
  db: SQLiteDatabase,
  input: { userId: string; name: string }
): Promise<Folder> {
  const { nextOrder } = (await db.getFirstAsync<{ nextOrder: number }>(
    `SELECT COALESCE(MAX(order_index) + 1, 0) as nextOrder
     FROM folders WHERE user_id = ? AND deleted_at IS NULL;`,
    [input.userId]
  )) ?? { nextOrder: 0 };

  const folder: Folder = { id: generateId("fd"), userId: input.userId, name: input.name, order: nextOrder };

  await db.runAsync(
    "INSERT INTO folders (id, user_id, name, order_index, updated_at) VALUES (?, ?, ?, ?, ?);",
    [folder.id, folder.userId, folder.name, folder.order, nowIso()]
  );

  return folder;
}

export async function updateFolder(
  db: SQLiteDatabase,
  id: string,
  patch: { name: string }
): Promise<void> {
  await db.runAsync("UPDATE folders SET name = ?, updated_at = ? WHERE id = ?;", [
    patch.name,
    nowIso(),
    id,
  ]);
}

export async function deleteFolder(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    // 所属リンクはフォルダの集約の一部なので物理削除でよい(種目自体は他のフォルダで使う)
    await db.runAsync("DELETE FROM folder_exercises WHERE folder_id = ?;", [id]);
    await db.runAsync("UPDATE folders SET deleted_at = ?, updated_at = ? WHERE id = ?;", [
      now,
      now,
      id,
    ]);
  });
}

export async function reorderFolders(
  db: SQLiteDatabase,
  userId: string,
  orderedFolderIds: string[]
): Promise<void> {
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    for (let index = 0; index < orderedFolderIds.length; index += 1) {
      await db.runAsync(
        "UPDATE folders SET order_index = ?, updated_at = ? WHERE id = ? AND user_id = ?;",
        [index, now, orderedFolderIds[index], userId]
      );
    }
  });
}

// 「テンプレート化」: 新しいフォルダを作り、既存の種目群を同じ並び順でリンクする(種目自体は複製せず共有する)。
export async function duplicateFolder(db: SQLiteDatabase, id: string): Promise<Folder> {
  const source = await getFolder(db, id);
  if (!source) {
    throw new Error(`Folder not found: ${id}`);
  }

  const links = await db.getAllAsync<{ exercise_id: string; order_index: number }>(
    `SELECT fe.exercise_id, fe.order_index
     FROM folder_exercises fe
     INNER JOIN exercises e ON e.id = fe.exercise_id AND e.deleted_at IS NULL
     WHERE fe.folder_id = ?
     ORDER BY fe.order_index ASC;`,
    [id]
  );

  const newFolder = await createFolder(db, { userId: source.userId, name: `${source.name} のコピー` });

  await db.withTransactionAsync(async () => {
    for (const link of links) {
      await db.runAsync(
        "INSERT INTO folder_exercises (folder_id, exercise_id, order_index) VALUES (?, ?, ?);",
        [newFolder.id, link.exercise_id, link.order_index]
      );
    }
  });

  return newFolder;
}
