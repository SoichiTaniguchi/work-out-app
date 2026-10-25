import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { PREVIEW_PR } from "@/preview";

// プレビューのときだけ画面上部に出す帯。本番と取り違えて記録しないようにする。
export default function PreviewBanner() {
  const insets = useSafeAreaInsets();
  if (PREVIEW_PR === null) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top }]}>
      <Text style={styles.text}>テスト版 PR #{PREVIEW_PR}(本番とは別のデータ・同期しません)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.warning, paddingBottom: 4, alignItems: "center" },
  text: { fontSize: 12, fontWeight: "700", color: colors.textPrimary },
});
