import React from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "History">;

// TODO: exerciseId の記録一覧・最大重量推移をDBから取得する
const MOCK_LOGS = [
  { date: "9/18", summary: "60kg × 10,9,8" },
  { date: "9/11", summary: "57.5kg × 10,10,9" },
  { date: "9/4", summary: "55kg × 10,10,10" },
];

export default function HistoryScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>ベンチプレス 履歴</Text>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartLabel}>最大重量の推移(kg)</Text>
        {/* TODO: react-native-svg 等でグラフ描画。ここでは領域のみ確保 */}
        <View style={styles.chartPlaceholder} />
      </View>

      <Text style={styles.listTitle}>記録一覧</Text>
      <FlatList
        data={MOCK_LOGS}
        keyExtractor={(item) => item.date}
        renderItem={({ item }) => (
          <View style={styles.logRow}>
            <Text style={styles.logDate}>{item.date}</Text>
            <Text style={styles.logSummary}>{item.summary}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 56, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: -4 },
  back: { fontSize: 18, color: colors.textPrimary },
  title: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  chartCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16 },
  chartLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  chartPlaceholder: { height: 120, backgroundColor: colors.surface, borderRadius: 8 },
  listTitle: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  logRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  logDate: { fontSize: 13, color: colors.textPrimary },
  logSummary: { fontSize: 13, color: colors.textSecondary },
});
