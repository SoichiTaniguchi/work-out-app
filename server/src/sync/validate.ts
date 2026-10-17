import {
  emptyChanges,
  type PersonalRecordType,
  type RecordFieldType,
  type SyncChanges,
  type SyncExercise,
  type SyncFolder,
  type SyncPersonalRecord,
  type SyncRequest,
  type SyncSet,
  type SyncUser,
  type SyncWorkoutLog,
} from "./types.js";

// 外から来るJSONをそのままSQLに流さないための検証。
// 壊れたリクエストは400で返したいので、専用のエラー型でパスを添えて投げる。
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const FIELD_TYPES: readonly RecordFieldType[] = ["weight", "reps", "time", "distance", "rpe"];
const PR_TYPES: readonly PersonalRecordType[] = ["maxWeight", "maxReps", "maxVolume"];

function fail(path: string, expected: string): never {
  throw new ValidationError(`${path} must be ${expected}`);
}

function asObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(path, "an object");
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(path, "an array");
  }
  return value;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== "string" || value === "") {
    fail(path, "a non-empty string");
  }
  return value;
}

function asNullableString(value: unknown, path: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return asString(value, path);
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "a finite number");
  }
  return value;
}

function asNullableNumber(value: unknown, path: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return asNumber(value, path);
}

function asBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    fail(path, "a boolean");
  }
  return value;
}

function asStringArray(value: unknown, path: string): string[] {
  return asArray(value, path).map((item, index) => asString(item, `${path}[${index}]`));
}

function asEnum<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  const text = asString(value, path);
  if (!allowed.includes(text as T)) {
    fail(path, `one of ${allowed.join(" / ")}`);
  }
  return text as T;
}

interface Base {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
}

function parseBase(row: Record<string, unknown>, path: string): Base {
  return {
    id: asString(row.id, `${path}.id`),
    updatedAt: asString(row.updatedAt, `${path}.updatedAt`),
    deletedAt: asNullableString(row.deletedAt, `${path}.deletedAt`),
  };
}

function parseList<T>(
  value: unknown,
  path: string,
  parse: (row: Record<string, unknown>, itemPath: string) => T
): T[] {
  return asArray(value ?? [], path).map((item, index) => {
    const itemPath = `${path}[${index}]`;
    return parse(asObject(item, itemPath), itemPath);
  });
}

function parseUser(row: Record<string, unknown>, path: string): SyncUser {
  return { ...parseBase(row, path), name: asString(row.name, `${path}.name`) };
}

function parseFolder(row: Record<string, unknown>, path: string): SyncFolder {
  return {
    ...parseBase(row, path),
    userId: asString(row.userId, `${path}.userId`),
    name: asString(row.name, `${path}.name`),
    order: asNumber(row.order, `${path}.order`),
    exerciseIds: asStringArray(row.exerciseIds ?? [], `${path}.exerciseIds`),
  };
}

function parseExercise(row: Record<string, unknown>, path: string): SyncExercise {
  return {
    ...parseBase(row, path),
    userId: asString(row.userId, `${path}.userId`),
    name: asString(row.name, `${path}.name`),
    bodyParts: asStringArray(row.bodyParts ?? [], `${path}.bodyParts`),
    // 器具は未入力を空文字で持つので、ここだけ空文字を許す
    equipment: typeof row.equipment === "string" ? row.equipment : "",
    fieldDefinition: asArray(row.fieldDefinition, `${path}.fieldDefinition`).map((item, index) =>
      asEnum(item, `${path}.fieldDefinition[${index}]`, FIELD_TYPES)
    ),
  };
}

function parseSet(row: Record<string, unknown>, path: string): SyncSet {
  return {
    weight: asNullableNumber(row.weight, `${path}.weight`),
    reps: asNullableNumber(row.reps, `${path}.reps`),
    timeSec: asNullableNumber(row.timeSec, `${path}.timeSec`),
    distanceKm: asNullableNumber(row.distanceKm, `${path}.distanceKm`),
    rpe: asNullableNumber(row.rpe, `${path}.rpe`),
  };
}

function parseWorkoutLog(row: Record<string, unknown>, path: string): SyncWorkoutLog {
  return {
    ...parseBase(row, path),
    exerciseId: asString(row.exerciseId, `${path}.exerciseId`),
    date: asString(row.date, `${path}.date`),
    completed: asBoolean(row.completed ?? false, `${path}.completed`),
    sets: parseList(row.sets, `${path}.sets`, parseSet),
  };
}

function parsePersonalRecord(row: Record<string, unknown>, path: string): SyncPersonalRecord {
  return {
    ...parseBase(row, path),
    exerciseId: asString(row.exerciseId, `${path}.exerciseId`),
    type: asEnum(row.type, `${path}.type`, PR_TYPES),
    value: asNumber(row.value, `${path}.value`),
    achievedAt: asString(row.achievedAt, `${path}.achievedAt`),
  };
}

function parseChanges(value: unknown, path: string): SyncChanges {
  if (value === undefined || value === null) {
    return emptyChanges();
  }
  const changes = asObject(value, path);

  return {
    users: parseList(changes.users, `${path}.users`, parseUser),
    folders: parseList(changes.folders, `${path}.folders`, parseFolder),
    exercises: parseList(changes.exercises, `${path}.exercises`, parseExercise),
    workoutLogs: parseList(changes.workoutLogs, `${path}.workoutLogs`, parseWorkoutLog),
    personalRecords: parseList(
      changes.personalRecords,
      `${path}.personalRecords`,
      parsePersonalRecord
    ),
  };
}

export function parseSyncRequest(body: unknown): SyncRequest {
  const root = asObject(body, "body");
  const since = root.since ?? null;

  if (since !== null && (typeof since !== "number" || !Number.isInteger(since) || since < 0)) {
    fail("body.since", "a non-negative integer or null");
  }

  return {
    userId: asString(root.userId, "body.userId"),
    since: since as number | null,
    changes: parseChanges(root.changes, "body.changes"),
  };
}
