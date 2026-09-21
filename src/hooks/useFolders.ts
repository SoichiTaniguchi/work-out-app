import { useCallback, useEffect, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import type { Folder } from "@/types";
import {
  createFolder,
  deleteFolder,
  duplicateFolder,
  listFoldersByUser,
  reorderFolders,
  updateFolder,
} from "@/db/folders";

export function useFolders(userId: string) {
  const db = useSQLiteContext();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setFolders(await listFoldersByUser(db, userId));
    } finally {
      setLoading(false);
    }
  }, [db, userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    async (name: string) => {
      await createFolder(db, { userId, name });
      await reload();
    },
    [db, userId, reload]
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      await updateFolder(db, id, { name });
      await reload();
    },
    [db, reload]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteFolder(db, id);
      await reload();
    },
    [db, reload]
  );

  const duplicate = useCallback(
    async (id: string) => {
      await duplicateFolder(db, id);
      await reload();
    },
    [db, reload]
  );

  const reorder = useCallback(
    async (orderedFolderIds: string[]) => {
      setFolders((prev) =>
        orderedFolderIds
          .map((id) => prev.find((f) => f.id === id))
          .filter((f): f is Folder => !!f)
      );
      await reorderFolders(db, userId, orderedFolderIds);
    },
    [db, userId]
  );

  return { folders, loading, reload, create, rename, remove, duplicate, reorder };
}
