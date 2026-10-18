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
import { startOfWeekIso } from "@/utils/dateRange";
import { runSyncQuietly } from "@/sync/runSync";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

function formatPrValue(record: LatestPersonalRecord): string {
  const unit = record.type === "maxReps" ? "回" : "kg";
  return `${record.value}${unit}`;
}

export default function HomeScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const db = useSQLiteContext();

  const [userName, setUserName] = useState("");
  const [summaries, setSummaries] = useState<FolderSummary[]>([]);
  const [weekly, setWeekly] = useState<WorkoutStats>({ exerciseCount: 0, volume: 0 });
  const [latestPr, setLatestPr] = useState<LatestPersonalRecord | null>(null);

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

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", reload);
    return unsubscribe;
  }, [navigation, reload]);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>こんにちは</Text>
          <Text style={styles.userName}>{userName}さん</Text>
        </View>
        <Pressable onPress={() => navigation.navigate("Settings", { userId })}>
          <View style={styles.iconBox} />
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>プログラム</Text>
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
            onPress={() => navigation.navigate("ExerciseList", { folderId: folder.id })}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 56, gap: 12 },
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
