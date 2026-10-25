import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { listDailyLogsFrom, type DailyLog } from "@/db/dailyLogs";
import LineChart, { type LineChartPoint } from "@/components/LineChart";
import { addDays, todayKey } from "@/utils/dateRange";
import {
  averageUnit,
  buildWeightSeries,
  defaultGranularity,
  periodDays,
  PERIODS,
  seriesHeading,
  type Granularity,
  type Period,
} from "@/utils/weightSeries";

type Props = NativeStackScreenProps<RootStackParamList, "DailyLogHistory">;

function shortDate(key: string): string {
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
  const [period, setPeriod] = useState<Period>("1m");
  // 既定の粒度から変えたときだけ値が入る。期間を変えると既定に戻す。
  const [granularityOverride, setGranularityOverride] = useState<Granularity | null>(null);

  const granularity: Granularity = granularityOverride ?? defaultGranularity(period);
  const canAverage = averageUnit(period) !== null;

  const today = todayKey();
  const from = addDays(today, -(periodDays(period) - 1));

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      listDailyLogsFrom(db, userId, from).then((rows) => {
        if (!cancelled) setLogs(rows);
      });
    };
    load();
    // 入力画面から戻ったときに読み直す
    const unsubscribe = navigation.addListener("focus", load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [db, userId, navigation, from]);

  function changePeriod(next: Period) {
    setPeriod(next);
    // 期間が変わると既定の粒度も変わるので、選び直しは持ち越さない
    setGranularityOverride(null);
  }

  const series = useMemo(() => {
    const entries = logs
      .filter((log): log is DailyLog & { weight: number } => log.weight !== null)
      .map((log) => ({ date: log.date, weight: log.weight }));
    return buildWeightSeries(entries, period, granularity);
  }, [logs, period, granularity]);

  const chartPoints: LineChartPoint[] = series;
  const latest = series.length > 0 ? series[series.length - 1]!.value : null;
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
        {/* 期間 */}
        <View style={styles.segment}>
          {PERIODS.map((item) => {
            const selected = item.key === period;
            return (
              <Pressable
                key={item.key}
                style={[styles.segmentItem, selected && styles.segmentItemSelected]}
                onPress={() => changePeriod(item.key)}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            {/* 粒度。1週間は平均にすると1点になるので出さない */}
            {canAverage ? (
              <View style={styles.miniSegment}>
                <Pressable
                  style={[
                    styles.miniItem,
                    granularity === "daily" && styles.miniItemSelected,
                  ]}
                  onPress={() => setGranularityOverride("daily")}
                >
                  <Text
                    style={[
                      styles.miniText,
                      granularity === "daily" && styles.miniTextSelected,
                    ]}
                  >
                    日ごと
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.miniItem,
                    granularity === "average" && styles.miniItemSelected,
                  ]}
                  onPress={() => setGranularityOverride("average")}
                >
                  <Text
                    style={[
                      styles.miniText,
                      granularity === "average" && styles.miniTextSelected,
                    ]}
                  >
                    平均
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View />
            )}
            <Text style={styles.latestValue}>
              {latest !== null ? `${latest.toFixed(1)} kg` : "-"}
            </Text>
          </View>

          <LineChart
            points={chartPoints}
            height={180}
            formatValue={(value) => `${value.toFixed(1)}kg`}
          />
        </View>

        {/* 平均のときは、グラフと同じ区切りで一覧も出す */}
        {granularity === "average" ? (
          <>
            <Text style={styles.sectionLabel}>{seriesHeading(period, granularity)}</Text>
            {series.length === 0 ? (
              <Text style={styles.empty}>この期間に記録がありません</Text>
            ) : (
              [...series].reverse().map((point, index) => (
                <View key={`${point.label}-${index}`} style={styles.row}>
                  <Text style={styles.rowLabel}>{point.label}</Text>
                  <Text style={styles.rowValue}>{point.value.toFixed(1)} kg</Text>
                </View>
              ))
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>日ごと</Text>
            {newestFirst.length === 0 ? (
              <Text style={styles.empty}>この期間に記録がありません</Text>
            ) : (
              newestFirst.map((log) => (
                <Pressable
                  key={log.date}
                  style={styles.row}
                  onPress={() => navigation.navigate("DailyLog", { userId, date: log.date })}
                >
                  <Text style={styles.rowLabel}>{shortDate(log.date)}</Text>
                  <Text style={styles.rowSummary}>{summarize(log)}</Text>
                  <Text style={styles.rowChevron}>›</Text>
                </Pressable>
              ))
            )}
          </>
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
  segment: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    overflow: "hidden",
  },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 7 },
  segmentItemSelected: { backgroundColor: colors.accent },
  segmentText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  segmentTextSelected: { color: "#ffffff", fontWeight: "700" },
  chartCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  chartHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  miniSegment: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    overflow: "hidden",
  },
  miniItem: { paddingHorizontal: 10, paddingVertical: 3 },
  miniItemSelected: { backgroundColor: colors.accent },
  miniText: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  miniTextSelected: { color: "#ffffff", fontWeight: "700" },
  latestValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, marginTop: 4 },
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
  rowLabel: { width: 52, fontSize: 13, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  rowSummary: { flex: 1, fontSize: 14, color: colors.textPrimary },
  rowValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  rowChevron: { fontSize: 16, color: colors.textFaint },
});
