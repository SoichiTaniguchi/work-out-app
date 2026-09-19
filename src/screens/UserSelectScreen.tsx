import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "UserSelect">;

// TODO: 実データはローカルDB(SQLite)のusersテーブルから取得する
const MOCK_USERS = [
  { id: "u1", name: "そーいち" },
  { id: "u2", name: "お父さん" },
  { id: "u3", name: "お母さん" },
];

export default function UserSelectScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>筋トレ記録</Text>
      <Text style={styles.subtitle}>利用するユーザーを選んでください</Text>

      <View style={styles.list}>
        {MOCK_USERS.map((user) => (
          <Pressable
            key={user.id}
            style={styles.card}
            onPress={() => navigation.replace("Home", { userId: user.id })}
          >
            <View style={styles.avatar} />
            <Text style={styles.userName}>{user.name}</Text>
          </Pressable>
        ))}

        <Pressable style={styles.addCard}>
          <Text style={styles.addText}>+ ユーザーを追加</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>パスワード不要・タップして切替</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    paddingTop: 64,
    paddingHorizontal: 24,
    gap: 32,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textMuted },
  list: { width: "100%", gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.borderStrong },
  userName: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  addCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.textFaint,
    borderRadius: 12,
  },
  addText: { color: colors.textMuted, fontSize: 14 },
  note: { marginTop: "auto", fontSize: 11, color: colors.textFaint, marginBottom: 24 },
});
