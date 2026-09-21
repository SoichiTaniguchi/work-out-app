import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { Exercise, PersonalRecord, PersonalRecordType, RecordFieldType, SetLog, WorkoutLog } from "@/types";
import { getExercise } from "@/db/exercises";
import { listWorkoutLogsByExercise } from "@/db/logs";
import { getPersonalRecords } from "@/db/personalRecords";
import { PR_LABELS } from "@/constants/recordFields";
import { formatSetSummary, formatDate } from "@/utils/recordFormat";
import LineChart, { LineChartPoint } from "@/components/LineChart";

type Props = NativeStackScreenProps<RootStackParamList, "History">;

type MetricKey = "maxWeight" | "volume" | "maxReps" | "maxTime" | "totalDistance" | "avgRpe";

interface MetricDef {
  key: MetricKey;
  label: string;
  compute: (sets: SetLog[]) => number | null;
  format: (value: number) => string;
}

function numbers(values: (number | undefined)[]): number[] {
  return values.filter((v): v is number => v !== undefined);
}

function resolveMetrics(fields: RecordFieldType[]): MetricDef[] {
  const metrics: MetricDef[] = [];

  if (fields.includes("weight")) {
    metrics.push({
      key: "maxWeight",
      label: "最大重量",
      compute: (sets) => {
        const values = numbers(sets.map((s) => s.weight));
        return values.length ? Math.max(...values) : null;
      },
      format: (v) => `${v}kg`,
    });
  }

  if (fields.includes("weight") && fields.includes("reps")) {
    metrics.push({
      key: "volume",
      label: "ボリューム",
      compute: (sets) => {
        const volume = sets
          .filter((s) => s.weight !== undefined && s.reps !== undefined)
          .reduce((sum, s) => sum + s.weight! * s.reps!, 0);
        return volume > 0 ? volume : null;
      },
      format: (v) => `${v}kg`,
    });
  }

  if (!fields.includes("weight") && fields.includes("reps")) {
    metrics.push({
      key: "maxReps",
      label: "最大回数",
      compute: (sets) => {
        const values = numbers(sets.map((s) => s.reps));
        return values.length ? Math.max(...values) : null;
      },
      format: (v) => `${v}回`,
    });
  }

  if (fields.includes("time")) {
    metrics.push({
      key: "maxTime",
      label: "最大時間",
      compute: (sets) => {
        const values = numbers(sets.map((s) => s.timeSec));
        return values.length ? Math.max(...values) : null;
      },
      format: (v) => `${v}秒`,
    });
  }

  if (fields.includes("distance")) {
    metrics.push({
      key: "totalDistance",
      label: "合計距離",
      compute: (sets) => {
        const values = numbers(sets.map((s) => s.distanceKm));
        return values.length ? values.reduce((a, b) => a + b, 0) : null;
      },
      format: (v) => `${v.toFixed(1)}km`,
    });
  }

  if (metrics.length === 0 && fields.includes("rpe")) {
    metrics.push({
      key: "avgRpe",
      label: "平均RPE",
      compute: (sets) => {
        const values = numbers(sets.map((s) => s.rpe));
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      },
      format: (v) => v.toFixed(1),
    });
  }

  return metrics;
}

function formatPrValue(type: PersonalRecordType, value: number): string {
  if (type === "maxReps") return `${value}回`;
  return `${value}kg`;
}

export default function HistoryScreen({ navigation, route }: Props) {
  const { exerciseId } = route.params;
  const db = useSQLiteContext();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);

  useEffect(() => {
    (async () => {
      const [ex, workoutLogs, personalRecords] = await Promise.all([
        getExercise(db, exerciseId),
        listWorkoutLogsByExercise(db, exerciseId),
        getPersonalRecords(db, exerciseId),
      ]);
      setExercise(ex);
      setLogs(workoutLogs);
      setRecords(personalRecords);
    })();
  }, [db, exerciseId]);

  const metrics = useMemo(
    () => (exercise ? resolveMetrics(exercise.fieldDefinition) : []),
    [exercise]
  );

  useEffect(() => {
    if (metrics.length > 0 && !metrics.some((m) => m.key === selectedMetric)) {
      setSelectedMetric(metrics[0].key);
    }
  }, [metrics, selectedMetric]);

  const activeMetric = metrics.find((m) => m.key === selectedMetric) ?? metrics[0];

  const chartPoints: LineChartPoint[] = activeMetric
    ? logs
        .map((log) => {
          const value = activeMetric.compute(log.sets);
          return value === null ? null : { label: formatDate(log.date), value };
        })
        .filter((p): p is LineChartPoint => p !== null)
    : [];

  const recentLogs = [...logs].reverse();

  if (!exercise) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>{exercise.name} 履歴</Text>
      </View>

      <View style={styles.prRow}>
        {(["maxWeight", "maxReps", "maxVolume"] as PersonalRecordType[]).map((type) => {
          const record = records.find((r) => r.type === type);
          return (
            <View key={type} style={styles.prChip}>
              <Text style={styles.prLabel}>{PR_LABELS[type]}</Text>
              <Text style={styles.prValue}>
                {record ? formatPrValue(type, record.value) : "-"}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.chartCard}>
        {metrics.length > 1 && (
          <View style={styles.metricTabs}>
            {metrics.map((m) => (
              <Pressable
                key={m.key}
                style={[styles.metricTab, m.key === activeMetric?.key && styles.metricTabActive]}
                onPress={() => setSelectedMetric(m.key)}
              >
                <Text
                  style={[
                    styles.metricTabText,
                    m.key === activeMetric?.key && styles.metricTabTextActive,
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {!metrics.length && <Text style={styles.chartLabel}>グラフに表示できる記録項目がありません</Text>}
        {activeMetric && (
          <LineChart points={chartPoints} formatValue={activeMetric.format} />
        )}
      </View>

      <Text style={styles.listTitle}>記録一覧</Text>
      <FlatList
        data={recentLogs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.logRow}>
            <Text style={styles.logDate}>{formatDate(item.date)}</Text>
            <Text style={styles.logSummary}>
              {item.sets.map((s) => formatSetSummary(s, exercise.fieldDefinition)).join(", ")}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>まだ記録がありません</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 56, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: -4 },
  back: { fontSize: 18, color: colors.textPrimary },
  title: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  prRow: { flexDirection: "row", gap: 10 },
  prChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  prLabel: { fontSize: 10, color: colors.textMuted },
  prValue: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginTop: 2 },
  chartCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 8 },
  chartLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  metricTabs: { flexDirection: "row", gap: 8 },
  metricTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  metricTabActive: { backgroundColor: colors.accent },
  metricTabText: { fontSize: 12, color: colors.textMuted },
  metricTabTextActive: { color: "#fff", fontWeight: "600" },
  listTitle: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  logRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  logDate: { fontSize: 13, color: colors.textPrimary },
  logSummary: { fontSize: 13, color: colors.textSecondary, flexShrink: 1, textAlign: "right" },
  empty: { textAlign: "center", color: colors.textFaint, fontSize: 13, paddingVertical: 20 },
});
