import type { RecordFieldType, SetLog } from "@/types";

export function formatSetSummary(set: SetLog, fields: RecordFieldType[]): string {
  const parts: string[] = [];
  if (fields.includes("weight") && fields.includes("reps") && set.weight !== undefined) {
    parts.push(`${set.weight}kg×${set.reps ?? "-"}`);
  } else {
    if (fields.includes("weight") && set.weight !== undefined) parts.push(`${set.weight}kg`);
    if (fields.includes("reps") && set.reps !== undefined) parts.push(`${set.reps}回`);
  }
  if (fields.includes("time") && set.timeSec !== undefined) parts.push(`${set.timeSec}秒`);
  if (fields.includes("distance") && set.distanceKm !== undefined) parts.push(`${set.distanceKm}km`);
  if (fields.includes("rpe") && set.rpe !== undefined) parts.push(`RPE${set.rpe}`);
  return parts.join(" ") || "-";
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
