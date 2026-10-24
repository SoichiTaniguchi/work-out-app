import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, PanResponder, StyleSheet } from "react-native";
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

  // 週表示の前後移動は1週間、月表示は1か月
  const move = (delta: number) => {
    if (expanded) setViewMonth(shiftMonth(viewMonth, delta));
    else onSelect(addDays(selected, delta * 7) > today ? today : addDays(selected, delta * 7));
  };

  // 週表示のとき、カレンダーを左右にスワイプして前後の週へ移動する
  const swipe = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      !expanded && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderRelease: (_, g) => {
      if (g.dx < -40) move(1);
      else if (g.dx > 40) move(-1);
    },
  });

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
          {titleMonth.year}年{titleMonth.month + 1}月
        </Text>
        <Pressable onPress={() => move(1)} hitSlop={10} disabled={nextDisabled}>
          <Text style={[styles.arrow, nextDisabled && styles.arrowDisabled]}>›</Text>
        </Pressable>
        {expandable && (
          <Pressable style={styles.toggle} onPress={toggle} hitSlop={12}>
            <Text style={styles.toggleText}>{expanded ? "▴" : "▾"}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.weekRow}>
        {HEADER_DAYS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>

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
  toggle: {
    marginLeft: "auto",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: { fontSize: 22, lineHeight: 26, color: colors.link },
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
