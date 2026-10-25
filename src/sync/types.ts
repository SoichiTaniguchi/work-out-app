// POST /sync でやり取りするデータの形。サーバー側の server/src/sync/types.ts と同じ内容で、
// どちらかを変えたらもう一方も直すこと(アプリとサーバーは別パッケージのため共有できない)。

import type { PersonalRecordType, RecordFieldType } from "@/types";

export interface SyncRecordBase {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SyncUser extends SyncRecordBase {
  name: string;
}

export interface SyncFolder extends SyncRecordBase {
  userId: string;
  name: string;
  order: number;
  /** フォルダ内の並び順そのもの(配列の位置がorder_index)。 */
  exerciseIds: string[];
}

export interface SyncExercise extends SyncRecordBase {
  userId: string;
  name: string;
  bodyParts: string[];
  equipment: string;
  fieldDefinition: RecordFieldType[];
}

export interface SyncSet {
  weight?: number | null;
  reps?: number | null;
  timeSec?: number | null;
  distanceKm?: number | null;
  rpe?: number | null;
}

export interface SyncWorkoutLog extends SyncRecordBase {
  exerciseId: string;
  date: string;
  completed: boolean;
  /** セットの並び順そのもの(配列の位置がorder_index)。 */
  sets: SyncSet[];
}

export interface SyncPersonalRecord extends SyncRecordBase {
  exerciseId: string;
  type: PersonalRecordType;
  value: number;
  achievedAt: string;
}

export interface SyncDailyLog extends SyncRecordBase {
  userId: string;
  /** "YYYY-MM-DD" */
  date: string;
  weight: number | null;
  /** 体調 1〜5 */
  condition: number | null;
  bowelMoved: boolean | null;
}

export interface SyncChanges {
  users: SyncUser[];
  folders: SyncFolder[];
  exercises: SyncExercise[];
  workoutLogs: SyncWorkoutLog[];
  personalRecords: SyncPersonalRecord[];
  dailyLogs: SyncDailyLog[];
}

export interface SyncRequest {
  userId: string;
  since: number | null;
  changes: SyncChanges;
}

export interface SyncResponse {
  cursor: number;
  changes: SyncChanges;
}

export function emptyChanges(): SyncChanges {
  return {
    users: [],
    folders: [],
    exercises: [],
    workoutLogs: [],
    personalRecords: [],
    dailyLogs: [],
  };
}

export function countChanges(changes: SyncChanges): number {
  return (
    changes.users.length +
    changes.folders.length +
    changes.exercises.length +
    changes.workoutLogs.length +
    changes.personalRecords.length +
    changes.dailyLogs.length
  );
}
