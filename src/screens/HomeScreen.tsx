import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation, route }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>こんにちは</Text>
          <Text style={styles.userName}>そーいちさん</Text>
        </View>
        <Pressable onPress={() => navigation.navigate("Settings")}>
          <View style={styles.iconBox} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>今日のプログラム</Text>
        <Text style={styles.cardTitle}>胸の日</Text>
        <Text style={styles.cardDesc}>ベンチプレス・ダンベルフライ 他3種目</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate("ExerciseList", { folderId: "f1" })}
        >
          <Text style={styles.primaryButtonText}>記録を始める</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.manageLink}
        onPress={() => navigation.navigate("FolderList", { userId: route.params.userId })}
      >
        <Text style={styles.manageLinkText}>プログラム/種目を管理 ›</Text>
      </Pressable>

      <View style={styles.row}>
        <View style={[styles.smallCard, { flex: 1 }]}>
          <Text style={styles.cardLabel}>自己ベスト更新</Text>
          <Text style={styles.smallCardValue}>ベンチプレス 65kg</Text>
        </View>
        <View style={[styles.smallCard, { flex: 1 }]}>
          <Text style={styles.cardLabel}>今週の記録</Text>
          <Text style={styles.smallCardValue}>3 回</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 56, gap: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { fontSize: 12, color: colors.textMuted },
  userName: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  iconBox: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.borderStrong },
  card: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    padding: 18,
    gap: 8,
  },
  cardLabel: { fontSize: 11, color: colors.textMuted },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  cardDesc: { fontSize: 13, color: colors.textSecondary },
  primaryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 6,
  },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  manageLink: { alignSelf: "flex-start" },
  manageLinkText: { fontSize: 13, color: colors.link, fontWeight: "600" },
  row: { flexDirection: "row", gap: 10 },
  smallCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    padding: 14,
  },
  smallCardValue: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginTop: 4 },
});
