import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { listDailyLogsFrom, type DailyLog } from "@/db/dailyLogs";
import LineChart, { type LineChartPoint } from "@/components/LineChart";
import { addDays, todayKey } from "@/utils/dateRange";

type Props = NativeStackScreenProps<RootStackParamList, "DailyLogHistory">;

const HISTORY_DAYS = 30;

function shortDate(key: string): string {
  // "2026-10-26" → "10/26"
  return key.slice(5).replace("-", "/");
}

function summarize(log: DailyLog): string {
  const parts = [
    log.weight !== null ? `${log.weight.toFixed(1)} kg` : null,
    log.condition !== null ? `体調 ${log.condition}` : null,
    log.bowelMoved === null ? null : log.bowelMoved ? "排便 あり" : "排便 なし",
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" ／ ") : "-";
}

export default function DailyLogHistoryScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const db = useSQLiteContext();
  const [logs, setLogs] = useState<DailyLog[]>([]);

  const today = todayKey();

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      listDailyLogsFrom(db, userId, addDays(today, -(HISTORY_DAYS - 1))).then(setLogs);
    });
    listDailyLogsFrom(db, userId, addDays(today, -(HISTORY_DAYS - 1))).then(setLogs);
    return unsubscribe;
  }, [db, userId, navigation, today]);

  const weightPoints: LineChartPoint[] = logs
    .filter((log): log is DailyLog & { weight: number } => log.weight !== null)
    .map((log) => ({ label: log.date, value: log.weight }));

  const newestFirst = [...logs].reverse();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>体重・体調の履歴</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>体重の推移（直近{HISTORY_DAYS}日）</Text>
        <View style={styles.chartCard}>
          <LineChart
            points={weightPoints}
            height={180}
            formatValue={(value) => `${value.toFixed(1)}kg`}
          />
        </View>

        <Text style={styles.sectionLabel}>日ごと</Text>
        {newestFirst.length === 0 ? (
          <Text style={styles.empty}>まだ記録がありません</Text>
        ) : (
          newestFirst.map((log) => (
            <Pressable
              key={log.date}
              style={styles.row}
              onPress={() => navigation.navigate("DailyLog", { userId, date: log.date })}
            >
              <Text style={styles.rowDate}>{shortDate(log.date)}</Text>
              <Text style={styles.rowValue}>{summarize(log)}</Text>
              <Text style={styles.rowChevron}>›</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 56 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  back: { fontSize: 18, color: colors.textSecondary },
  title: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  content: { padding: 20, paddingTop: 0, gap: 12 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginTop: 8 },
  chartCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 8,
  },
  empty: { fontSize: 14, color: colors.textMuted, paddingVertical: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  rowDate: { width: 48, fontSize: 13, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  rowValue: { flex: 1, fontSize: 14, color: colors.textPrimary },
  rowChevron: { fontSize: 16, color: colors.textFaint },
});
