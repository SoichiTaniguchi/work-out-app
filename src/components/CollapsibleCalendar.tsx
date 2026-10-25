import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, View, Text, Pressable, PanResponder, StyleSheet } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { useSQLiteContext } from "expo-sqlite";
import { useIsFocused } from "@react-navigation/native";
import { colors } from "@/theme/colors";
import { listLoggedDaysInMonth } from "@/db/logs";
import {
  addDays,
  monthWeeks,
  parseDateKey,
  todayKey,
  weekKeys,
  weekdayLabel,
} from "@/utils/dateRange";

interface Props {
  userId: string;
  selected: string;
  onSelect: (dateKey: string) => void;
  // false なら週表示(1行)のみ。種目一覧のように、日付の切り替えだけ使う画面向け。
  expandable?: boolean;
}

interface YearMonth {
  year: number;
  month: number; // 0始まり
}

function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

// 展開・折りたたみボタンのアイコン(案3: カレンダーの形)
function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={16} rx={3} stroke={color} strokeWidth={1.6} />
      <Line x1={3} y1={10} x2={21} y2={10} stroke={color} strokeWidth={1.6} />
      <Line x1={8} y1={3} x2={8} y2={7} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={16} y1={3} x2={16} y2={7} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

const HEADER_DAYS = ["月", "火", "水", "木", "金", "土", "日"];

// 初期は1週間分だけ表示し、▾ で月表示に展開する。記録がある日はドット、今日は枠、
// 未来の日付はグレーで選べない。
export default function CollapsibleCalendar({ userId, selected, onSelect, expandable = true }: Props) {
  const db = useSQLiteContext();
  const isFocused = useIsFocused();
  const [expanded, setExpanded] = useState(false);
  const selectedDate = parseDateKey(selected);
  const [viewMonth, setViewMonth] = useState<YearMonth>({
    year: selectedDate.getFullYear(),
    month: selectedDate.getMonth(),
  });
  const [loggedDays, setLoggedDays] = useState<Set<string>>(new Set());

  // 週表示のときは選択日の月、月表示のときは閲覧中の月を基準にする
  const anchor: YearMonth = expanded
    ? viewMonth
    : { year: selectedDate.getFullYear(), month: selectedDate.getMonth() };

  // 週をまたいで月が変わる日にもドットを出すため、前後1か月分も読む
  const loadLoggedDays = useCallback(async () => {
    const months = [-1, 0, 1].map((delta) => shiftMonth(anchor, delta));
    const results = await Promise.all(
      months.map((m) => listLoggedDaysInMonth(db, userId, m.year, m.month))
    );
    setLoggedDays(new Set(results.flat()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userId, anchor.year, anchor.month]);

  // 記録画面から戻ったときにドットを更新する
  useEffect(() => {
    if (isFocused) loadLoggedDays();
  }, [isFocused, loadLoggedDays]);

  const today = todayKey();
  const weeks = expanded ? monthWeeks(viewMonth.year, viewMonth.month) : [weekKeys(selected)];

  const toggle = () => {
    if (!expanded) setViewMonth({ year: selectedDate.getFullYear(), month: selectedDate.getMonth() });
    setExpanded(!expanded);
  };

  // 「今日」に戻る。月表示のときは今日の月も表示する
  const goToday = () => {
    const t = parseDateKey(today);
    onSelect(today);
    setViewMonth({ year: t.getFullYear(), month: t.getMonth() });
  };

  // 週表示の前後移動は1週間、月表示は1か月
  const move = (delta: number) => {
    if (expanded) setViewMonth(shiftMonth(viewMonth, delta));
    else onSelect(addDays(selected, delta * 7) > today ? today : addDays(selected, delta * 7));
  };

  // 週表示のとき、週の行を指に合わせて左右に動かす。離したら前後の週へ切り替える
  const dragX = useRef(new Animated.Value(0)).current;
  const [rowWidth, setRowWidth] = useState(300);
  const settle = () => Animated.spring(dragX, { toValue: 0, useNativeDriver: true }).start();
  const swipe = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      !expanded && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderMove: (_, g) => dragX.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      const step = g.dx < -40 ? 1 : g.dx > 40 ? -1 : 0;
      if (step === 0) {
        settle();
        return;
      }
      // 行を外へ流し切ってから日付を切り替え、反対側から戻す
      Animated.timing(dragX, {
        toValue: -step * rowWidth,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        dragX.setValue(step * rowWidth);
        move(step);
        Animated.timing(dragX, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      });
    },
    onPanResponderTerminate: settle,
  });

  // 週表示の見出しは「10/19〜10/25」の形式
  const shortDate = (key: string) => {
    const d = parseDateKey(key);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  const weekTitle = (() => {
    const w = weekKeys(selected);
    return `${shortDate(w[0]!)}〜${shortDate(w[6]!)}`;
  })();

  const titleMonth = anchor;
  const nextDisabled = expanded
    ? isAfterMonth(shiftMonth(viewMonth, 1), today)
    : weekKeys(selected)[6]! >= today;

  return (
    <View style={styles.container} {...swipe.panHandlers}>
      <View style={styles.titleRow}>
        <Pressable onPress={() => move(-1)} hitSlop={10}>
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <Text style={styles.title}>
          {expanded ? `${titleMonth.year}年${titleMonth.month + 1}月` : weekTitle}
        </Text>
        <Pressable onPress={() => move(1)} hitSlop={10} disabled={nextDisabled}>
          <Text style={[styles.arrow, nextDisabled && styles.arrowDisabled]}>›</Text>
        </Pressable>
        <View style={styles.rightActions}>
          {selected !== today && (
            <Pressable onPress={goToday} hitSlop={10}>
              <Text style={styles.todayText}>今日</Text>
            </Pressable>
          )}
          {expandable && (
            <Pressable style={styles.toggle} onPress={toggle} hitSlop={12}>
              <CalendarIcon color={expanded ? colors.link : colors.textPrimary} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.weekRow}>
        {HEADER_DAYS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>

      {/* 外枠の内側でだけ見えるように切り抜く(スワイプ中の週が枠からはみ出さない) */}
      <View style={styles.clip}>
      <Animated.View
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        style={{ transform: [{ translateX: dragX }] }}
      >
        {weeks.map((week) => (
          <View key={week[0]} style={styles.weekRow}>
            {week.map((key) => {
              const isFuture = key > today;
              const isSelected = key === selected;
              const outOfMonth = expanded && parseDateKey(key).getMonth() !== viewMonth.month;
              return (
                <Pressable
                  key={key}
                  style={styles.dayCell}
                  disabled={isFuture}
                  onPress={() => onSelect(key)}
                  accessibilityLabel={key + " " + weekdayLabel(key)}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      key === today && styles.dayToday,
                      isSelected && styles.daySelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        (isFuture || outOfMonth) && styles.dayTextMuted,
                        isSelected && styles.dayTextSelected,
                      ]}
                    >
                      {parseDateKey(key).getDate()}
                    </Text>
                  </View>
                  <View style={[styles.dot, loggedDays.has(key) && styles.dotOn]} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </Animated.View>
      </View>
    </View>
  );
}

// 翌月が「今日の月」より後か
function isAfterMonth(ym: YearMonth, todayKeyValue: string): boolean {
  const t = parseDateKey(todayKeyValue);
  return ym.year > t.getFullYear() || (ym.year === t.getFullYear() && ym.month > t.getMonth());
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 2,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  title: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  arrow: { fontSize: 20, color: colors.textPrimary, paddingHorizontal: 6 },
  arrowDisabled: { color: colors.textFaint },
  clip: { marginHorizontal: -10, paddingHorizontal: 10, overflow: "hidden" },
  rightActions: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 12 },
  todayText: { fontSize: 14, fontWeight: "500", color: colors.link },
  toggle: { padding: 4 },
  weekRow: { flexDirection: "row" },
  weekdayLabel: { flex: 1, textAlign: "center", fontSize: 10, color: colors.textMuted },
  dayCell: { flex: 1, alignItems: "center", paddingVertical: 0 },
  dayCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  dayToday: { borderColor: colors.accent },
  daySelected: { backgroundColor: colors.accent },
  dayText: { fontSize: 13, color: colors.textPrimary },
  dayTextMuted: { color: colors.textFaint },
  dayTextSelected: { color: "#fff", fontWeight: "700" },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 0, backgroundColor: "transparent" },
  dotOn: { backgroundColor: colors.success },
});
