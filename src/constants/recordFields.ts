import type { PersonalRecordType, RecordFieldType, SetLog } from "@/types";

export const FIELD_CONFIG: Record<
  RecordFieldType,
  { label: string; key: keyof SetLog; step?: number }
> = {
  weight: { label: "重量(kg)", key: "weight", step: 2.5 },
  reps: { label: "回数", key: "reps", step: 1 },
  time: { label: "時間(秒)", key: "timeSec" },
  distance: { label: "距離(km)", key: "distanceKm" },
  rpe: { label: "RPE", key: "rpe" },
};

export const PR_LABELS: Record<PersonalRecordType, string> = {
  maxWeight: "最大重量",
  maxReps: "最大回数",
  maxVolume: "総ボリューム",
};
