import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, Alert, AppState } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { Exercise, PersonalRecordType, RecordFieldType, SetLog, WorkoutLog } from "@/types";
import { getExercise } from "@/db/exercises";
import { getLastWorkoutLog, createWorkoutLog } from "@/db/logs";
import { evaluateAndSavePersonalRecords } from "@/db/personalRecords";
import { startRestTimerActivity, endRestTimerActivity } from "@/native/RestTimerActivity";
import { scheduleRestEndNotification, cancelRestEndNotification } from "@/timers/restTimer";

type Props = NativeStackScreenProps<RootStackParamList, "Record">;

const REST_DURATION_SECONDS = 90;
const DEFAULT_SET_COUNT = 3;

const FIELD_CONFIG: Record<
  RecordFieldType,
  { label: string; key: keyof SetLog; step?: number }
> = {
  weight: { label: "重量(kg)", key: "weight", step: 2.5 },
  reps: { label: "回数", key: "reps", step: 1 },
  time: { label: "時間(秒)", key: "timeSec" },
  distance: { label: "距離(km)", key: "distanceKm" },
  rpe: { label: "RPE", key: "rpe" },
};

const PR_LABELS: Record<PersonalRecordType, string> = {
  maxWeight: "最大重量",
  maxReps: "最大回数",
  maxVolume: "総ボリューム",
};

interface SetRowState {
  values: Partial<Record<RecordFieldType, string>>;
  done: boolean;
}

function formatSetSummary(set: SetLog, fields: RecordFieldType[]): string {
  const parts: string[] = [];
  if (fields.includes("weight") && fields.includes("reps") && set.weight !== undefined) {
    parts.push(`${set.weight}kg×${set.reps ?? "-"}`);
  } else {
    if (fields.includes("weight") && set.weight !== undefined) parts.push(`${set.weight}kg`);
    if (fields.includes("reps") && set.reps !== undefined) parts.push(`${set.reps}回`);
  }
  if (fields.includes("time") && set.timeSec !== undefined) parts.push(`${set.timeSec}秒`);
  if (fields.includes("distance") && set.distanceKm !== undefined) parts.push(`${set.distanceKm}km`);
  if (fields.includes("rpe") && set.rpe !== undefined) parts.push(`RPE${set.rpe}`);
  return parts.join(" ") || "-";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function RecordScreen({ navigation, route }: Props) {
  const { exerciseId } = route.params;
  const db = useSQLiteContext();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [lastLog, setLastLog] = useState<WorkoutLog | null>(null);
  const [sets, setSets] = useState<SetRowState[]>([]);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);

  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restEndAtRef = useRef<number | null>(null);
  const notificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const ex = await getExercise(db, exerciseId);
      const last = await getLastWorkoutLog(db, exerciseId);
      setExercise(ex);
      setLastLog(last);
      const initialCount = last ? last.sets.length : DEFAULT_SET_COUNT;
      setSets(
        Array.from({ length: initialCount }, () => ({ values: {}, done: false }))
      );
    })();
  }, [db, exerciseId]);

  const clearRestTimer = useCallback(() => {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    restEndAtRef.current = null;
    setRestSeconds(null);
    cancelRestEndNotification(notificationIdRef.current);
    notificationIdRef.current = null;
    endRestTimerActivity();
  }, []);

  useEffect(() => clearRestTimer, [clearRestTimer]);

  // 残り時間は「終了予定時刻 - 現在時刻」から毎回計算する。バックグラウンド中は
  // setIntervalがOSに一時停止されるため、単純にカウントダウンする実装だと復帰後に
  // 表示がずれる(止まっていた分だけ多く残っているように見える)。
  const tickRestTimer = useCallback(() => {
    const endAt = restEndAtRef.current;
    if (endAt === null) return;

    const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    setRestSeconds(remaining);

    if (remaining <= 0) {
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current);
        restIntervalRef.current = null;
      }
      restEndAtRef.current = null;
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") tickRestTimer();
    });
    return () => subscription.remove();
  }, [tickRestTimer]);

  const startRestTimer = useCallback(() => {
    clearRestTimer();
    restEndAtRef.current = Date.now() + REST_DURATION_SECONDS * 1000;
    setRestSeconds(REST_DURATION_SECONDS);
    restIntervalRef.current = setInterval(tickRestTimer, 1000);

    const exerciseName = exercise?.name ?? "";
    scheduleRestEndNotification(exerciseName, REST_DURATION_SECONDS).then((id) => {
      notificationIdRef.current = id;
    });
    startRestTimerActivity({ exerciseName, durationSeconds: REST_DURATION_SECONDS });
  }, [clearRestTimer, tickRestTimer, exercise]);

  const setFieldValue = (index: number, field: RecordFieldType, text: string) => {
    setSets((prev) =>
      prev.map((row, i) => (i === index ? { ...row, values: { ...row.values, [field]: text } } : row))
    );
  };

  const stepField = (index: number, field: RecordFieldType, delta: number) => {
    const config = FIELD_CONFIG[field];
    setSets((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const previousValue = lastLog?.sets[index]?.[config.key];
        const current = row.values[field];
        const base = current && current.trim() !== "" ? Number(current) : previousValue ?? 0;
        const next = Math.max(0, (Number.isNaN(base) ? 0 : base) + delta);
        return { ...row, values: { ...row.values, [field]: String(next) } };
      })
    );
  };

  const completeSet = (index: number) => {
    if (sets[index]?.done) return;
    setSets((prev) => prev.map((row, i) => (i === index ? { ...row, done: true } : row)));
    startRestTimer();
  };

  const addSet = () => {
    setSets((prev) => [...prev, { values: {}, done: false }]);
  };

  const handleFinish = async () => {
    if (!exercise) return;

    const resolvedSets: SetLog[] = sets
      .map((row, originalIndex) => {
        if (!row.done) return null;
        const set: SetLog = {};
        for (const field of exercise.fieldDefinition) {
          const config = FIELD_CONFIG[field];
          const raw = row.values[field];
          const previousValue = lastLog?.sets[originalIndex]?.[config.key];
          let value: number | undefined;
          if (raw !== undefined && raw.trim() !== "") {
            const parsed = Number(raw);
            value = Number.isNaN(parsed) ? undefined : parsed;
          } else {
            value = previousValue;
          }
          if (value !== undefined) {
            (set as Record<string, number>)[config.key] = value;
          }
        }
        return set;
      })
      .filter((s): s is SetLog => s !== null);

    clearRestTimer();

    if (resolvedSets.length === 0) {
      navigation.goBack();
      return;
    }

    await createWorkoutLog(db, exerciseId, new Date().toISOString(), resolvedSets);
    const newRecords = await evaluateAndSavePersonalRecords(db, exerciseId, resolvedSets);

    if (newRecords.length > 0) {
      const labels = newRecords.map((r) => PR_LABELS[r.type]).join("・");
      Alert.alert("自己ベスト更新!", `${labels} を更新しました`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  if (!exercise) {
    return <View style={styles.container} />;
  }

  const fields = exercise.fieldDefinition;
  const lastSummary = lastLog
    ? `前回(${formatDate(lastLog.date)}): ${lastLog.sets.map((s) => formatSetSummary(s, fields)).join(", ")}`
    : "前回の記録はありません";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>{exercise.name}</Text>
      </View>

      <Text style={styles.lastRecord}>{lastSummary}</Text>

      <View style={styles.sets}>
        <View style={styles.setHeaderRow}>
          <Text style={[styles.setHeaderCell, { width: 36 }]}>SET</Text>
          {fields.map((f) => (
            <Text key={f} style={styles.setHeaderCell}>{FIELD_CONFIG[f].label}</Text>
          ))}
          <View style={{ width: 32 }} />
        </View>

        {sets.map((row, i) => {
          const previous = lastLog?.sets[i];
          return (
            <View key={i} style={styles.setRow}>
              <Text style={styles.setIndex}>{i + 1}</Text>
              {fields.map((field) => {
                const config = FIELD_CONFIG[field];
                const previousValue = previous?.[config.key];
                return (
                  <View key={field} style={styles.fieldCell}>
                    <TextInput
                      style={styles.setInput}
                      value={row.values[field] ?? ""}
                      onChangeText={(text) => setFieldValue(i, field, text)}
                      placeholder={previousValue !== undefined ? String(previousValue) : "-"}
                      keyboardType="numeric"
                      editable={!row.done}
                    />
                    {config.step !== undefined && !row.done && (
                      <View style={styles.stepperRow}>
                        <Pressable onPress={() => stepField(i, field, -config.step!)} hitSlop={6}>
                          <Text style={styles.stepperText}>-{config.step}</Text>
                        </Pressable>
                        <Pressable onPress={() => stepField(i, field, config.step!)} hitSlop={6}>
                          <Text style={styles.stepperText}>+{config.step}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
              <Pressable
                style={[styles.checkButton, row.done && styles.checkButtonDone]}
                onPress={() => completeSet(i)}
              >
                {row.done && <Text style={styles.checkMark}>✓</Text>}
              </Pressable>
            </View>
          );
        })}

        <Pressable style={styles.addSetRow} onPress={addSet}>
          <Text style={styles.addSetText}>+ セット追加</Text>
        </Pressable>
      </View>

      {restSeconds !== null && (
        <View style={styles.restBar}>
          <Text style={styles.restLabel}>休憩中</Text>
          <Text style={styles.restTime}>
            {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, "0")}
          </Text>
          <Pressable onPress={clearRestTimer}>
            <Text style={styles.restSkip}>スキップ</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.finishButton} onPress={handleFinish}>
        <Text style={styles.finishButtonText}>この種目を完了</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 20,
    paddingTop: 56,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  back: { fontSize: 18, color: colors.textPrimary },
  title: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  lastRecord: { padding: 14, paddingHorizontal: 20, backgroundColor: colors.surface, fontSize: 12, color: colors.textSecondary },
  sets: { padding: 20, gap: 10, flex: 1 },
  setHeaderRow: { flexDirection: "row", gap: 8 },
  setHeaderCell: { flex: 1, fontSize: 11, color: colors.textMuted },
  setRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  setIndex: { width: 36, textAlign: "center", fontSize: 13, color: colors.textPrimary },
  fieldCell: { flex: 1, gap: 4 },
  setInput: {
    textAlign: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.textPrimary,
  },
  stepperRow: { flexDirection: "row", justifyContent: "space-between" },
  stepperText: { fontSize: 10, color: colors.link },
  checkButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkButtonDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: "#fff", fontSize: 12 },
  addSetRow: { alignItems: "center", paddingVertical: 10 },
  addSetText: { color: colors.textMuted, fontSize: 13 },
  restBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  restLabel: { color: "#fff", fontSize: 13 },
  restTime: { color: "#fff", fontSize: 20, fontWeight: "700" },
  restSkip: { color: "#d4d4d8", fontSize: 12 },
  finishButton: {
    margin: 20,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  finishButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
