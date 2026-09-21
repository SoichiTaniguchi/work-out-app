// 仕様書「API/データベース設計」に対応する型定義

export type RecordFieldType = "weight" | "reps" | "time" | "distance" | "rpe";

export interface User {
  id: string;
  name: string;
}

export interface Folder {
  id: string;
  userId: string;
  name: string;
  order: number;
}

export interface Exercise {
  id: string;
  userId: string;
  name: string;
  bodyParts: string[]; // 部位(自由入力・複数可)
  equipment: string;
  fieldDefinition: RecordFieldType[]; // 記録する項目(MVPは5種類の組み合わせ)
}

// 種目とフォルダは多対多(1種目を複数フォルダに所属させることが可能)。
// フォルダ内での表示順はこの中間テーブル側で持つ。
export interface FolderExercise {
  folderId: string;
  exerciseId: string;
  order: number;
}

export interface SetLog {
  weight?: number;
  reps?: number;
  timeSec?: number;
  distanceKm?: number;
  rpe?: number;
}

export interface WorkoutLog {
  id: string;
  exerciseId: string;
  date: string; // ISO date
  sets: SetLog[];
}

export type PersonalRecordType = "maxWeight" | "maxReps" | "maxVolume";

export interface PersonalRecord {
  id: string;
  exerciseId: string;
  type: PersonalRecordType;
  value: number;
  achievedAt: string; // ISO date
}
