import React, { useEffect, useState } from "react";
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "@/theme/colors";

export interface YearMonth {
  year: number;
  month: number; // 0始まり
}

interface Props {
  visible: boolean;
  initial: YearMonth;
  today: YearMonth;
  onConfirm: (ym: YearMonth) => void;
  onClose: () => void;
}

const ITEM_H = 40;
const VISIBLE_ITEMS = 5;
const PAD = ITEM_H * ((VISIBLE_ITEMS - 1) / 2);
const YEARS_BACK = 10;

// 縦にスクロールして1つ選ぶホイール。止まった位置の項目が選ばれる
function Wheel({
  items,
  index,
  onChange,
}: {
  items: string[];
  index: number;
  onChange: (i: number) => void;
}) {
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    onChange(Math.min(Math.max(i, 0), items.length - 1));
  };
  return (
    <ScrollView
      style={styles.wheel}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      contentOffset={{ x: 0, y: index * ITEM_H }}
      contentContainerStyle={{ paddingVertical: PAD }}
      onMomentumScrollEnd={settle}
      onScrollEndDrag={settle}
    >
      {items.map((label) => (
        <View key={label} style={styles.item}>
          <Text style={styles.itemText}>{label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

export default function YearMonthPicker({ visible, initial, today, onConfirm, onClose }: Props) {
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, i) => today.year - YEARS_BACK + i);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  // 開くたびに、表示中の年月から選び直す
  useEffect(() => {
    if (visible) {
      setYear(initial.year);
      setMonth(initial.month);
    }
    // 開いた時だけ反映する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // 今年なら今月まで、それ以外は12か月。未来の月は選べない
  const maxMonth = year === today.year ? today.month : 11;
  const months = Array.from({ length: maxMonth + 1 }, (_, i) => i);
  const safeMonth = Math.min(month, maxMonth);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.cancel}>キャンセル</Text>
            </Pressable>
            <Text style={styles.title}>年月を選ぶ</Text>
            <Pressable onPress={() => onConfirm({ year, month: safeMonth })} hitSlop={10}>
              <Text style={styles.done}>完了</Text>
            </Pressable>
          </View>
          <View style={styles.wheels}>
            <View pointerEvents="none" style={styles.highlight} />
            <Wheel
              items={years.map((y) => `${y}年`)}
              index={years.indexOf(year)}
              onChange={(i) => setYear(years[i] ?? year)}
            />
            <Wheel
              key={maxMonth}
              items={months.map((m) => `${m + 1}月`)}
              index={safeMonth}
              onChange={(i) => setMonth(months[i] ?? safeMonth)}
            />
          </View>
          <Text style={styles.hint}>上下にスクロールして選ぶ（未来の月は選べません）</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  cancel: { fontSize: 15, color: colors.textMuted },
  title: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  done: { fontSize: 15, fontWeight: "700", color: colors.link },
  wheels: { flexDirection: "row", height: ITEM_H * VISIBLE_ITEMS },
  wheel: { flex: 1 },
  item: { height: ITEM_H, justifyContent: "center", alignItems: "center" },
  itemText: { fontSize: 16, color: colors.textPrimary },
  highlight: {
    position: "absolute",
    left: 16,
    right: 16,
    top: ITEM_H * ((VISIBLE_ITEMS - 1) / 2),
    height: ITEM_H,
    borderRadius: 8,
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  hint: { fontSize: 12, color: colors.textSecondary, textAlign: "center", marginTop: 8 },
});
