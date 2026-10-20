import type { CSSProperties } from "react";
const pmToday=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul"}).format(new Date());
export function pillStyle(color: string): CSSProperties {
  return {
    background: `color-mix(in srgb, ${color} 14%, transparent)`,
    color: `color-mix(in srgb, ${color} 72%, var(--text-strong))`,
    borderRadius: 999,
    fontWeight: 600,
    width: "auto",
  };
}


export function dday(due: string | null): { label: string; overdue: boolean; dueToday: boolean } | null {
  if (!due) return null;
  const today = new Date(pmToday() + "T00:00:00");
  const d = new Date(due + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return { label: "D-day", overdue: false, dueToday: true };
  if (diff > 0) return { label: `D-${diff}`, overdue: false, dueToday: false };
  return { label: `D+${-diff}`, overdue: true, dueToday: false };
}


export function daysUntil(due: string | null): number | null {
  if (!due) return null;
  const today = new Date(pmToday() + "T00:00:00");
  const d = new Date(due + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}


