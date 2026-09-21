import React from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import { colors } from "@/theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { Folder } from "@/types";
import { useFolders } from "@/hooks/useFolders";

type Props = NativeStackScreenProps<RootStackParamList, "FolderList">;

export default function FolderListScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const { folders, reload, remove, duplicate, reorder } = useFolders(userId);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener("focus", reload);
    return unsubscribe;
  }, [navigation, reload]);

  const confirmDelete = (folder: Folder) => {
    Alert.alert("フォルダを削除", `「${folder.name}」を削除しますか?`, [
      { text: "キャンセル", style: "cancel" },
      { text: "削除", style: "destructive", onPress: () => remove(folder.id) },
    ]);
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Folder>) => (
    <Pressable
      style={[styles.row, isActive && styles.rowActive]}
      onPress={() => navigation.navigate("ExerciseList", { folderId: item.id })}
    >
      <Pressable onPressIn={drag} hitSlop={8}>
        <Text style={styles.handle}>≡</Text>
      </Pressable>
      <Text style={styles.folderName}>{item.name}</Text>
      <Pressable
        style={styles.iconButton}
        onPress={() => duplicate(item.id)}
        hitSlop={8}
      >
        <Text style={styles.iconText}>⧉</Text>
      </Pressable>
      <Pressable
        style={styles.iconButton}
        onPress={() => navigation.navigate("FolderEdit", { folderId: item.id, userId })}
        hitSlop={8}
      >
        <Text style={styles.iconText}>✎</Text>
      </Pressable>
      <Pressable style={styles.iconButton} onPress={() => confirmDelete(item)} hitSlop={8}>
        <Text style={styles.iconText}>🗑</Text>
      </Pressable>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>プログラム一覧</Text>
      </View>

      <DraggableFlatList
        contentContainerStyle={styles.list}
        data={folders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onDragEnd={({ data }) => reorder(data.map((f) => f.id))}
        ListEmptyComponent={<Text style={styles.empty}>まだプログラムがありません</Text>}
        ListFooterComponent={
          <Pressable
            style={styles.addRow}
            onPress={() => navigation.navigate("FolderEdit", { userId })}
          >
            <Text style={styles.addText}>+ プログラムを追加</Text>
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
    backgroundColor: colors.background,
  },
  rowActive: { borderColor: colors.borderStrong },
  handle: { color: colors.textFaint, width: 16 },
  folderName: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  iconButton: { paddingHorizontal: 4 },
  iconText: { fontSize: 16, color: colors.textMuted },
  empty: { textAlign: "center", color: colors.textFaint, fontSize: 13, paddingVertical: 20 },
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
