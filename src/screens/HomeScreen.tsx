import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { getUser } from "@/db/users";
import { listFolderSummaries, type FolderSummary } from "@/db/folders";
import {
  getWorkoutStatsSince,
  getLatestPersonalRecord,
  type WorkoutStats,
  type LatestPersonalRecord,
} from "@/db/stats";
import { PR_LABELS } from "@/constants/recordFields";
import { getDailyLog, type DailyLog } from "@/db/dailyLogs";
import CollapsibleCalendar from "@/components/CollapsibleCalendar";
import { formatDateLabel, startOfWeekIso, todayKey } from "@/utils/dateRange";
import { runSyncQuietly } from "@/sync/runSync";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

// 1行バーに出す文。ラベルを含めて「体重 68.4kg ／ 体調 4 ／ 排便 あり」の形にする。
function formatDailyLogSummary(log: DailyLog | null): string {
  if (!log) return "体重・体調・排便を記録する";
  const parts = [
    log.weight !== null ? `体重 ${log.weight.toFixed(1)}kg` : null,
    log.condition !== null ? `体調 ${log.condition}` : null,
    log.bowelMoved === null ? null : log.bowelMoved ? "排便 あり" : "排便 なし",
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" ／ ") : "体重・体調・排便を記録する";
}

function formatPrValue(record: LatestPersonalRecord): string {
  const unit = record.type === "maxReps" ? "回" : "kg";
  return `${record.value}${unit}`;
}

export default function HomeScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const db = useSQLiteContext();

  // 記録する日。プログラム → 種目一覧 → 記録の各画面へ引き継ぐ。
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [userName, setUserName] = useState("");
  const [summaries, setSummaries] = useState<FolderSummary[]>([]);
  const [weekly, setWeekly] = useState<WorkoutStats>({ exerciseCount: 0, volume: 0 });
  const [latestPr, setLatestPr] = useState<LatestPersonalRecord | null>(null);
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);

  const reload = useCallback(async () => {
    const [user, folderSummaries, weeklyStats, pr] = await Promise.all([
      getUser(db, userId),
      listFolderSummaries(db, userId),
      getWorkoutStatsSince(db, userId, startOfWeekIso()),
      getLatestPersonalRecord(db, userId),
    ]);
    setUserName(user?.name ?? "");
    setSummaries(folderSummaries);
    setWeekly(weeklyStats);
    setLatestPr(pr);
  }, [db, userId]);

  // 選択日の体重・体調・排便。日付を変えたときと、入力画面から戻ったとき(focus)に読み直す。
  const loadDailyLog = useCallback(async () => {
    setDailyLog(await getDailyLog(db, userId, selectedDate));
  }, [db, userId, selectedDate]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    loadDailyLog();
  }, [loadDailyLog]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      reload();
      loadDailyLog();
    });
    return unsubscribe;
  }, [navigation, reload, loadDailyLog]);

  // 起動してユーザーを選んだ直後に一度だけ自動同期する(仕様書「アプリ起動時に自動同期」)。
  // 画面に戻るたびには走らせない。失敗しても黙って次の機会に回す。
  useEffect(() => {
    let cancelled = false;
    runSyncQuietly(db, userId).then(() => {
      if (!cancelled) reload();
    });
    return () => {
      cancelled = true;
    };
  }, [db, userId, reload]);

  return (
    <View style={styles.container}>
      {/* ヘッダーとカレンダーは固定し、プログラム以下だけをスクロールさせる */}
      <View style={styles.fixedArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>こんにちは</Text>
            <Text style={styles.userName}>{userName}さん</Text>
          </View>
          <Pressable onPress={() => navigation.navigate("Settings", { userId })}>
            <View style={styles.iconBox} />
          </Pressable>
        </View>

        <CollapsibleCalendar userId={userId} selected={selectedDate} onSelect={setSelectedDate} />

        {/* 1行の要約バー。スクロールしない位置に置き、タップで入力画面を開く */}
        <Pressable
          style={styles.dailyBar}
          onPress={() => navigation.navigate("DailyLog", { userId, date: selectedDate })}
        >
          <Text
            style={dailyLog ? styles.dailyBarValue : styles.dailyBarEmpty}
            numberOfLines={1}
          >
            {formatDailyLogSummary(dailyLog)}
          </Text>
          <Text style={styles.dailyBarChevron}>›</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>{formatDateLabel(selectedDate)}の記録 — プログラムを選ぶ</Text>
        {summaries.length === 0 ? (
          <Pressable
            style={styles.emptyCard}
            onPress={() => navigation.navigate("FolderEdit", { userId })}
          >
            <Text style={styles.emptyTitle}>プログラムがまだありません</Text>
            <Text style={styles.emptyDesc}>+ 最初のプログラムを作成する</Text>
          </Pressable>
        ) : (
          summaries.map(({ folder, exerciseCount, exerciseNames }) => (
            <Pressable
              key={folder.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate("ExerciseList", { folderId: folder.id, date: selectedDate })
              }
            >
              <Text style={styles.cardTitle}>{folder.name}</Text>
              <Text style={styles.cardDesc}>
                {exerciseCount === 0
                  ? "種目がまだ登録されていません"
                  : `${exerciseNames.slice(0, 3).join("・")}${exerciseCount > 3 ? ` 他${exerciseCount - 3}種目` : ""}`}
              </Text>
            </Pressable>
          ))
        )}

        <Pressable
          style={styles.manageLink}
          onPress={() => navigation.navigate("FolderList", { userId })}
        >
          <Text style={styles.manageLinkText}>プログラム/種目を管理 ›</Text>
        </Pressable>

        <Pressable
          style={styles.manageLink}
          onPress={() => navigation.navigate("DailyLogHistory", { userId })}
        >
          <Text style={styles.manageLinkText}>体重・体調の履歴 ›</Text>
        </Pressable>

        <View style={styles.row}>
          <View style={[styles.smallCard, { flex: 1 }]}>
            <Text style={styles.cardLabel}>自己ベスト更新</Text>
            <Text style={styles.smallCardValue}>
              {latestPr ? `${latestPr.exerciseName} ${formatPrValue(latestPr)}` : "-"}
            </Text>
            {latestPr && <Text style={styles.smallCardSub}>{PR_LABELS[latestPr.type]}</Text>}
          </View>
          <View style={[styles.smallCard, { flex: 1 }]}>
            <Text style={styles.cardLabel}>今週の記録</Text>
            <Text style={styles.smallCardValue}>{weekly.exerciseCount} 種目</Text>
            <Text style={styles.smallCardSub}>
              負荷量 {weekly.volume.toLocaleString()}kg
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  fixedArea: { paddingHorizontal: 20, paddingTop: 56, gap: 12 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingTop: 12, gap: 12 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  greeting: { fontSize: 12, color: colors.textMuted },
  userName: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  iconBox: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.borderStrong },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  card: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  cardLabel: { fontSize: 11, color: colors.textMuted },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  cardDesc: { fontSize: 12, color: colors.textSecondary },
  dailyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dailyBarValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  dailyBarEmpty: { flex: 1, fontSize: 13, color: colors.textMuted },
  dailyBarChevron: { fontSize: 16, color: colors.textFaint },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.textFaint,
    borderRadius: 12,
    gap: 4,
  },
  emptyTitle: { fontSize: 14, color: colors.textSecondary },
  emptyDesc: { fontSize: 13, color: colors.link, fontWeight: "600" },
  manageLink: { alignSelf: "flex-start", paddingVertical: 4 },
  manageLinkText: { fontSize: 13, color: colors.link, fontWeight: "600" },
  row: { flexDirection: "row", gap: 10, marginTop: 4 },
  smallCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    padding: 14,
  },
  smallCardValue: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginTop: 4 },
  smallCardSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
