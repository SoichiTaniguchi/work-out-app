// POST /sync のリクエスト・レスポンスの形。アプリ側(src/types/index.ts)の型に
// 同期用の updatedAt / deletedAt を足したもの。
//
// folder_exercises と set_logs はidを持たないため単独では同期せず、
// 親(フォルダ・記録)の一部として exerciseIds / sets に埋め込んで送受信する。

export type RecordFieldType = "weight" | "reps" | "time" | "distance" | "rpe";
export type PersonalRecordType = "maxWeight" | "maxReps" | "maxVolume";

export interface SyncRecordBase {
  id: string;
  /** 端末が書き込んだ時刻(ISO)。Last Write Winsの判定に使う。 */
  updatedAt: string;
  /** 論理削除された時刻(ISO)。未削除はnull。 */
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

export interface SyncChanges {
  users: SyncUser[];
  folders: SyncFolder[];
  exercises: SyncExercise[];
  workoutLogs: SyncWorkoutLog[];
  personalRecords: SyncPersonalRecord[];
}

export interface SyncRequest {
  /** 同期する対象のユーザー。ユーザー一覧だけは全員分をやり取りする。 */
  userId: string;
  /** 前回のレスポンスのcursor。初回同期はnull(サーバーの全データを受け取る)。 */
  since: number | null;
  changes: SyncChanges;
}

export interface SyncResponse {
  /** 次回のsinceに渡す値。 */
  cursor: number;
  changes: SyncChanges;
}

export function emptyChanges(): SyncChanges {
  return { users: [], folders: [], exercises: [], workoutLogs: [], personalRecords: [] };
}

export function countChanges(changes: SyncChanges): number {
  return (
    changes.users.length +
    changes.folders.length +
    changes.exercises.length +
    changes.workoutLogs.length +
    changes.personalRecords.length
  );
}
