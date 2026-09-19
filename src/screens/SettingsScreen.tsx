import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export default function SettingsScreen({ navigation }: Props) {
  const rows = [
    { label: "ユーザー切り替え", value: "そーいち ›", onPress: () => navigation.replace("UserSelect") },
    { label: "NAS接続設定", value: "接続済み ›" },
    { label: "同期状態", value: "最終同期: 2分前", valueColor: colors.success },
    { label: "今すぐ同期", value: "⟳" },
    { label: "種目テンプレート管理", value: "›" },
    { label: "バージョン情報", value: "v0.1.0", valueColor: colors.textFaint },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>設定</Text>
      {rows.map((row) => (
        <Pressable key={row.label} style={styles.row} onPress={row.onPress}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={[styles.value, row.valueColor ? { color: row.valueColor } : null]}>{row.value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: "700", color: colors.textPrimary, padding: 20, paddingTop: 56 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 14, color: colors.textPrimary },
  value: { fontSize: 13, color: colors.textMuted },
});
