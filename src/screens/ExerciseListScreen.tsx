import React from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ExerciseList">;

// TODO: folderId に紐づく種目一覧をDBから取得する
const MOCK_EXERCISES = [
  { id: "e1", name: "ベンチプレス", tags: ["胸", "バーベル"], last: "前回: 60kg × 10 × 3set" },
  { id: "e2", name: "ダンベルフライ", tags: ["胸", "ダンベル"], last: "前回: 16kg × 12 × 3set" },
  { id: "e3", name: "腕立て伏せ", tags: ["胸", "自重"], last: "記録項目: 回数のみ" },
];

export default function ExerciseListScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>胸の日</Text>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={MOCK_EXERCISES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate("Record", { exerciseId: item.id })}
          >
            <Text style={styles.handle}>≡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.exerciseName}>{item.name}</Text>
              <View style={styles.tags}>
                {item.tags.map((t) => (
                  <Text key={t} style={styles.tag}>{t}</Text>
                ))}
              </View>
              <Text style={styles.last}>{item.last}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
        ListFooterComponent={
          <Pressable style={styles.addRow} onPress={() => navigation.navigate("ExerciseEdit", {})}>
            <Text style={styles.addText}>+ 種目を追加(複製/テンプレートから選択も可)</Text>
          </Pressable>
        }
      />
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
  list: { padding: 20, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  handle: { color: colors.textFaint, width: 16 },
  exerciseName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  tags: { flexDirection: "row", gap: 6, marginTop: 4 },
  tag: {
    backgroundColor: colors.border,
    borderRadius: 6,
    color: colors.textSecondary,
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  last: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
  chevron: { fontSize: 16, color: colors.textFaint },
  addRow: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.textFaint,
    borderRadius: 12,
    marginTop: 8,
  },
  addText: { color: colors.textMuted, fontSize: 14 },
});
