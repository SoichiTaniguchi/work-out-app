// ワイヤーフレームで使用した配色をそのままトークン化
export const colors = {
  background: "#ffffff",
  surface: "#f4f4f5",
  border: "#e4e4e7",
  borderStrong: "#d4d4d8",
  textPrimary: "#18181b",
  textSecondary: "#52525b",
  textMuted: "#71717a",
  textFaint: "#a1a1aa",
  accent: "#18181b",
  success: "#22c55e",
  warning: "#fbbf24",
  danger: "#dc2626",
  link: "#2563eb",
} as const;

// 体調1〜5の背景色。最も濃い5でも中間色にとどめ、黒い日付とドットが読めるようにしている。
export const conditionTints = ["#f0fdf4", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80"] as const;

// 体調(1〜5)に対応する背景色。未記録は null。
export function conditionTint(level: number | null | undefined): string | null {
  if (level === null || level === undefined) return null;
  return conditionTints[Math.min(5, Math.max(1, level)) - 1] ?? null;
}
