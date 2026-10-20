"use client";

import { useState } from "react";
import { CalendarClock, Layers, Sparkles, Target } from "lucide-react";
import { StatCard } from "@/components/ds/data/StatCard";
import type { GrantProgram } from "@/lib/data/grants";
import { isClosingSoon, isExpired } from "./grantFormat";
import { needsReview } from "@/lib/grants/assessment";

/* KPI 4장 — 우선 추천(S/A) / 마감 임박 / 이번 주 신규 / 검토 후보(B). */

export function GrantsKpiRow({ programs, profileUpdatedAt }: { programs: GrantProgram[]; profileUpdatedAt: string }) {
  // "이번 주 신규" 기준 시각 — 마운트 시점에 고정 (렌더 순수성).
  const [weekAgo] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString());
  const live = programs.filter((p) => !p.dismissed && !isExpired(p));
  const reviewed = live.filter(p => !needsReview(p, profileUpdatedAt));
  const priority = reviewed.filter((p) => p.grade === "S" || p.grade === "A").length;
  const closing = live.filter(isClosingSoon).length;
  const fresh = live.filter((p) => p.createdAt >= weekAgo).length;
  const candidates = reviewed.filter((p) => p.grade === "B").length;

  return (
    <div className="sx-grid-m1" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
      <StatCard label="우선 추천 (S·A)" value={priority} unit="건" icon={<Sparkles size={18} />} note="최신 평가 · 자격 확인 후 검토" />
      <StatCard label="마감 임박" value={closing} unit="건" icon={<CalendarClock size={18} />} note="7일 이내 마감" />
      <StatCard label="이번 주 신규" value={fresh} unit="건" icon={<Layers size={18} />} note="최근 7일 수집" />
      <StatCard label="검토 후보 (B)" value={candidates} unit="건" icon={<Target size={18} />} note="시간 되면 검토" />
    </div>
  );
}
