import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { listWorkoutLogsSince, type WorkoutLogWithExercise } from "@/db/logs";
import { listPersonalRecordsSince, type PersonalRecordWithExercise } from "@/db/personalRecords";
import { getWorkoutStatsSince, type WorkoutStats } from "@/db/stats";
import { PR_LABELS } from "@/constants/recordFields";
import { formatSetSummary } from "@/utils/recordFormat";
import { startOfTodayIso } from "@/utils/dateRange";

type Props = NativeStackScreenProps<RootStackParamList, "Summary">;

function formatPrValue(record: PersonalRecordWithExercise): string {
  return record.type === "maxReps" ? `${record.value}回` : `${record.value}kg`;
}

function totalSets(logs: WorkoutLogWithExercise[]): number {
  return logs.reduce((sum, log) => sum + log.sets.length, 0);
}

export default function SummaryScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const db = useSQLiteContext();

  const [logs, setLogs] = useState<WorkoutLogWithExercise[]>([]);
  const [records, setRecords] = useState<PersonalRecordWithExercise[]>([]);
  const [stats, setStats] = useState<WorkoutStats>({ exerciseCount: 0, volume: 0 });

  useEffect(() => {
    (async () => {
      const since = startOfTodayIso();
      const [todayLogs, todayRecords, todayStats] = await Promise.all([
        listWorkoutLogsSince(db, userId, since),
        listPersonalRecordsSince(db, userId, since),
        getWorkoutStatsSince(db, userId, since),
      ]);
      setLogs(todayLogs);
      setRecords(todayRecords);
      setStats(todayStats);
    })();
  }, [db, userId]);

  const today = new Date();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>今日のまとめ</Text>
          <Text style={styles.date}>
            {today.getFullYear()}/{today.getMonth() + 1}/{today.getDate()}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>種目</Text>
            <Text style={styles.statValue}>{stats.exerciseCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>セット</Text>
            <Text style={styles.statValue}>{totalSets(logs)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>負荷量</Text>
            <Text style={styles.statValue}>{stats.volume.toLocaleString()}</Text>
            <Text style={styles.statUnit}>kg</Text>
          </View>
        </View>

        {records.length > 0 && (
          <View style={styles.prCard}>
            <Text style={styles.sectionTitle}>自己ベスト更新 🎉</Text>
            {records.map((record) => (
              <Text key={record.id} style={styles.prRow}>
                {record.exerciseName} — {PR_LABELS[record.type]} {formatPrValue(record)}
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>記録した種目</Text>
        {logs.length === 0 ? (
          <Text style={styles.empty}>今日はまだ記録がありません</Text>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={styles.logCard}>
              <Text style={styles.logName}>{log.exerciseName}</Text>
              <Text style={styles.logSets}>
                {log.sets.map((s) => formatSetSummary(s, log.fieldDefinition)).join(", ")}
              </Text>
            </View>
          ))
        )}

        <Pressable style={styles.homeButton} onPress={() => navigation.popToTop()}>
          <Text style={styles.homeButtonText}>ホームに戻る</Text>
        </Pressable>
      </ScrollView>
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
  date: { fontSize: 12, color: colors.textMuted },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  statRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
  },
  statLabel: { fontSize: 11, color: colors.textMuted },
  statValue: { fontSize: 20, fontWeight: "700", color: colors.textPrimary, marginTop: 2 },
  statUnit: { fontSize: 10, color: colors.textFaint },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textPrimary, marginTop: 8 },
  prCard: {
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 12,
    padding: 14,
    gap: 4,
    marginTop: 8,
  },
  prRow: { fontSize: 13, color: colors.textPrimary },
  logCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  logName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  logSets: { fontSize: 12, color: colors.textSecondary },
  empty: { fontSize: 13, color: colors.textFaint, textAlign: "center", paddingVertical: 20 },
  homeButton: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  homeButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
