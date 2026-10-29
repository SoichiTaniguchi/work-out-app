import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { colors, conditionMeterFill } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { listWorkoutLogsSince, type WorkoutLogWithExercise } from "@/db/logs";
import { listPersonalRecordsSince, type PersonalRecordWithExercise } from "@/db/personalRecords";
import { getWorkoutStatsSince, type WorkoutStats } from "@/db/stats";
import { PR_LABELS } from "@/constants/recordFields";
import { formatSetSummary } from "@/utils/recordFormat";
import { startOfTodayIso, todayKey } from "@/utils/dateRange";
import { getDailyLog, type DailyLog } from "@/db/dailyLogs";

type Props = NativeStackScreenProps<RootStackParamList, "Summary">;

function formatPrValue(record: PersonalRecordWithExercise): string {
  return record.type === "maxReps" ? `${record.value}回` : `${record.value}kg`;
}

const CONDITION_LEVELS = [1, 2, 3, 4, 5];

// 体調が5段階のいくつかを図でも見せる。数字だけだと段階の幅が伝わらないため。
function ConditionMeter({ level }: { level: number }) {
  return (
    <View style={styles.meter}>
      {CONDITION_LEVELS.map((step) => (
        <View key={step} style={[styles.meterStep, step <= level && styles.meterStepOn]} />
      ))}
    </View>
  );
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
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);

  useEffect(() => {
    (async () => {
      const since = startOfTodayIso();
      const [todayLogs, todayRecords, todayStats, todayDailyLog] = await Promise.all([
        listWorkoutLogsSince(db, userId, since),
        listPersonalRecordsSince(db, userId, since),
        getWorkoutStatsSince(db, userId, since),
        getDailyLog(db, userId, todayKey()),
      ]);
      setLogs(todayLogs);
      setRecords(todayRecords);
      setStats(todayStats);
      setDailyLog(todayDailyLog);
    })();
  }, [db, userId]);

  const today = new Date();
  // 排便しか入っていない日は「未記録」として扱う(この画面では排便を出さないため)
  const hasBodyLog = dailyLog !== null && (dailyLog.weight !== null || dailyLog.condition !== null);

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

        {/* その日の体の記録。トレーニングの数字とは別のものなのでカードを分ける。
            排便はこの画面には出さない(まとめは人に見せることもあるため)。 */}
        {hasBodyLog ? (
          <View style={styles.bodyCard}>
            <Text style={styles.bodySectionTitle}>今日の体調</Text>
            <View style={styles.bodyRow}>
              <Text style={styles.bodyKey}>体重</Text>
              <Text style={dailyLog?.weight !== null ? styles.bodyValue : styles.bodyValueEmpty}>
                {dailyLog?.weight !== null && dailyLog?.weight !== undefined
                  ? `${dailyLog.weight.toFixed(1)} kg`
                  : "-"}
              </Text>
            </View>
            <View style={styles.bodyRow}>
              <Text style={styles.bodyKey}>体調</Text>
              {dailyLog !== null && dailyLog.condition !== null ? (
                <View style={styles.bodyConditionValue}>
                  <Text style={styles.bodyValue}>{dailyLog.condition} / 5</Text>
                  <ConditionMeter level={dailyLog.condition} />
                </View>
              ) : (
                <Text style={styles.bodyValueEmpty}>-</Text>
              )}
            </View>
          </View>
        ) : (
          <Pressable
            style={styles.bodyPrompt}
            onPress={() => navigation.navigate("DailyLog", { userId, date: todayKey() })}
          >
            <Text style={styles.bodyPromptText}>体重・体調は未記録</Text>
            <Text style={styles.bodyPromptAction}>記録する ›</Text>
          </Pressable>
        )}

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
              <Text style={styles.logName}>
                {log.exerciseName}
                {!log.completed && <Text style={styles.inProgressMark}> 実施中</Text>}
              </Text>
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
  bodyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  bodySectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  bodyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bodyKey: { fontSize: 13, color: colors.textMuted },
  bodyValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  bodyValueEmpty: { fontSize: 14, color: colors.textFaint },
  bodyConditionValue: { flexDirection: "row", alignItems: "center", gap: 8 },
  meter: { flexDirection: "row", gap: 3 },
  meterStep: { width: 14, height: 10, borderRadius: 2, backgroundColor: colors.border },
  meterStepOn: { backgroundColor: conditionMeterFill },
  bodyPrompt: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.link,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bodyPromptText: { fontSize: 13, color: colors.textSecondary },
  bodyPromptAction: { fontSize: 13, color: colors.link, fontWeight: "700" },
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
  inProgressMark: { fontSize: 11, fontWeight: "400", color: colors.warning },
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
