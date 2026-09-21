import { useCallback, useEffect, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import type { Exercise } from "@/types";
import {
  addExerciseToFolder,
  deleteExercise,
  listExercisesByFolder,
  removeExerciseFromFolder,
  reorderExercisesInFolder,
} from "@/db/exercises";

// フォルダ内の種目一覧。ExerciseListScreen と FolderEditScreen の両方で使う。
export function useFolderExercises(folderId: string) {
  const db = useSQLiteContext();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setExercises(await listExercisesByFolder(db, folderId));
    } finally {
      setLoading(false);
    }
  }, [db, folderId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const reorder = useCallback(
    async (orderedExerciseIds: string[]) => {
      setExercises((prev) =>
        orderedExerciseIds
          .map((id) => prev.find((e) => e.id === id))
          .filter((e): e is Exercise => !!e)
      );
      await reorderExercisesInFolder(db, folderId, orderedExerciseIds);
    },
    [db, folderId]
  );

  // フォルダからの除外(種目自体は残る)
  const removeFromFolder = useCallback(
    async (exerciseId: string) => {
      await removeExerciseFromFolder(db, folderId, exerciseId);
      await reload();
    },
    [db, folderId, reload]
  );

  // 種目そのものを削除(所属する全フォルダから消える)
  const deletePermanently = useCallback(
    async (exerciseId: string) => {
      await deleteExercise(db, exerciseId);
      await reload();
    },
    [db, reload]
  );

  const addExisting = useCallback(
    async (exerciseId: string) => {
      await addExerciseToFolder(db, folderId, exerciseId);
      await reload();
    },
    [db, folderId, reload]
  );

  return { exercises, loading, reload, reorder, removeFromFolder, deletePermanently, addExisting };
}
