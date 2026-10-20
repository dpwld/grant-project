"use client";

import { ExternalLink, ListPlus, X } from "lucide-react";
import { Button } from "@/components/ds/core/Button";
import { Tag } from "@/components/ds/core/Tag";
import { EmptyState } from "@/components/ds/feedback/EmptyState";
import { dday, pillStyle } from "@/components/pm/pmFormat";
import type { GrantProgram } from "@/lib/data/grants";
import { needsReview } from "@/lib/grants/assessment";
import { GRADE_COLOR, GRADE_LABEL, SOURCE_LABEL, isClosingSoon, isExpired } from "./grantFormat";

/* 히어로 — "이번 주 먼저 검토할 3건". Poliflo의 결정 중심 레이아웃 차용:
   전체 목록 대신 지금 액션할 소수만 크게. */

interface GrantsHeroProps {
  programs: GrantProgram[];
  profileUpdatedAt?: string;
  onOpen: (p: GrantProgram) => void;
  onAddToSprint: (p: GrantProgram) => void;
  onDismiss: (p: GrantProgram) => void;
  addingId: string | null;
}

/** 상위 3건: 미제외·미만료·등급순(S→D)·동급이면 점수·마감 임박순. */
export function heroPicks(programs: GrantProgram[]): GrantProgram[] {
  const gradeRank = { S: 0, A: 1, B: 2, C: 3, D: 4 } as const;
  return programs
    .filter((p) => !p.dismissed && !isExpired(p) && p.grade && (p.grade === "S" || p.grade === "A" || p.grade === "B"))
    .sort((a, b) => {
      const g = gradeRank[a.grade!] - gradeRank[b.grade!];
      if (g !== 0) return g;
      const s = (b.score ?? 0) - (a.score ?? 0);
      if (s !== 0) return s;
      return (a.applyEnd ?? "9999").localeCompare(b.applyEnd ?? "9999");
    })
    .slice(0, 3);
}

export function GrantsHero({ programs, profileUpdatedAt = "", onOpen, onAddToSprint, onDismiss, addingId }: GrantsHeroProps) {
  const picks = heroPicks(programs.filter(p => !needsReview(p, profileUpdatedAt)));
  const active = programs.filter((p) => !p.dismissed && !isExpired(p));
  const pending = active.filter((p) => needsReview(p, profileUpdatedAt)).length;
  const evaluated = active.length - pending;
  const failed = active.filter(p => p.assessment?.status === "failed").length;
  const original = active.filter(p => !needsReview(p, profileUpdatedAt) && p.assessment?.sourceStatus === "original" && !p.assessment.truncated).length;

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-strong)", margin: 0 }}>Top {picks.length} to review this week</h2>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Verify eligibility in the official announcement before applying.</span>
      </div>

      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
        Eligible {active.length} · Reviewed {evaluated} · Pending or stale {pending} · Failed {failed}
      </p>

      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 12px" }}>
        Full source reviewed: {original} · Summary or partial source: {evaluated - original}. Some deadlines are unknown. Verify attachments and final eligibility separately.
      </p>
      {picks.length === 0 ? (
        <EmptyState
          title={pending > 0 ? "Some announcements still need review" : active.length > 0 ? "No recommended candidates among reviewed announcements" : "No open announcements yet"}
          description={pending > 0
            ? "Select Review remaining to process the queue. Unreviewed announcements may still be suitable."
            : active.length > 0
              ? `${evaluated} reviewed; no current S, A, or B candidates. Sync new announcements or check your profile and review details.`
              : "Sync or import announcements, then check their application periods."}
        />
      ) : (
        <div className="sx-grid-m1" style={{ display: "grid", gridTemplateColumns: `repeat(${picks.length}, 1fr)`, gap: 14 }}>
          {picks.map((p) => {
            const d = dday(p.applyEnd);
            const closing = isClosingSoon(p);
            return (
              <div
                key={p.id}
                style={{
                  background: "var(--surface-card)",
                  border: `1px solid color-mix(in srgb, ${GRADE_COLOR[p.grade!]} 35%, var(--border-default))`,
                  borderRadius: 16,
                  padding: "20px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ ...pillStyle(GRADE_COLOR[p.grade!]), padding: "3px 12px", fontSize: 14 }}>
                    {p.grade} · {p.score}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{GRADE_LABEL[p.grade!]}</span>
                  <span style={{ flex: 1 }} />
                  {d && (
                    <span
                      style={{
                        ...pillStyle(closing ? "var(--red-500, #ef4444)" : "var(--gray-500, #6b7280)"),
                        padding: "2px 10px",
                        fontSize: 12.5,
                      }}
                    >
                      {d.label}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onOpen(p)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    fontSize: 17,
                    fontWeight: 800,
                    lineHeight: 1.35,
                    color: "var(--text-strong)",
                  }}
                >
                  {p.title}
                </button>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <Tag size="sm">{SOURCE_LABEL[p.source]}</Tag>
                  {p.matchedTags.slice(0, 3).map((t) => (
                    <Tag key={t} size="sm" active>
                      {t}
                    </Tag>
                  ))}
                </div>

                <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55, flex: 1 }}>
                  {p.why || p.summary}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  {p.url && (
                    <Button variant="secondary" size="sm" onClick={() => window.open(p.url, "_blank", "noopener")}>
                      <ExternalLink size={14} /> View source
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    loading={addingId === p.id}
                    disabled={!!p.sprintTaskId}
                    onClick={() => onAddToSprint(p)}
                  >
                    <ListPlus size={14} /> {p.sprintTaskId ? "In Sprint Dashboard" : "Add to Sprint Dashboard"}
                  </Button>
                  <span style={{ flex: 1 }} />
                  <Button variant="ghost" size="sm" onClick={() => onDismiss(p)} title="Archive recommendation">
                    <X size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
