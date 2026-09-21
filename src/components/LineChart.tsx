import React, { useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Polyline, Circle, Line, Text as SvgText } from "react-native-svg";
import { colors } from "@/theme/colors";

export interface LineChartPoint {
  label: string;
  value: number;
}

interface Props {
  points: LineChartPoint[];
  height?: number;
  formatValue?: (value: number) => string;
}

const PADDING = 24;

export default function LineChart({ points, height = 160, formatValue = (v) => String(v) }: Props) {
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (points.length < 2) {
    return (
      <View style={[styles.container, { height }]} onLayout={onLayout}>
        <Text style={styles.emptyText}>記録が2件以上たまるとグラフが表示されます</Text>
      </View>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const innerWidth = Math.max(width - PADDING * 2, 0);
  const innerHeight = height - PADDING * 2;

  const coords = points.map((p, i) => ({
    x: PADDING + (innerWidth * i) / (points.length - 1),
    y: PADDING + innerHeight - ((p.value - min) / range) * innerHeight,
  }));

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Line
            x1={PADDING}
            y1={height - PADDING}
            x2={width - PADDING}
            y2={height - PADDING}
            stroke={colors.border}
            strokeWidth={1}
          />
          <Polyline points={polylinePoints} fill="none" stroke={colors.accent} strokeWidth={2} />
          {coords.map((c, i) => (
            <Circle key={i} cx={c.x} cy={c.y} r={3} fill={colors.accent} />
          ))}
          <SvgText x={PADDING} y={PADDING - 8} fontSize={11} fill={colors.textMuted}>
            {formatValue(max)}
          </SvgText>
          <SvgText x={PADDING} y={height - PADDING + 16} fontSize={10} fill={colors.textFaint}>
            {points[0].label}
          </SvgText>
          <SvgText
            x={width - PADDING}
            y={height - PADDING + 16}
            fontSize={10}
            fill={colors.textFaint}
            textAnchor="end"
          >
            {points[points.length - 1].label}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", justifyContent: "center" },
  emptyText: { textAlign: "center", color: colors.textFaint, fontSize: 12 },
});
