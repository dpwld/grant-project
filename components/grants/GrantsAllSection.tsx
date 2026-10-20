"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ds/forms/Input";
import { Select } from "@/components/ds/forms/Select";
import { Switch } from "@/components/ds/forms/Switch";
import { Tag } from "@/components/ds/core/Tag";
import { EmptyState } from "@/components/ds/feedback/EmptyState";
import { grantReviewPresentation } from "@/lib/grants/reviewPresentation";
import type { GrantGrade, GrantProgram } from "@/lib/data/grants";
import { GRADE_COLOR, GRADE_ORDER, isExpired } from "./grantFormat";
import { GrantCard } from "./GrantCard";

/* 전체 매칭 섹션 — 기본 접힘. 펼치면 검색·등급·출처·정렬·마감 숨김 필터. */

interface GrantsAllSectionProps {
  programs: GrantProgram[];
  profileUpdatedAt: string;
  onOpen: (p: GrantProgram) => void;
  onToggleStar: (p: GrantProgram) => void;
  onFeedback: (p: GrantProgram, v: "up" | "down") => void;
  onDismiss: (p: GrantProgram) => void;
}

type SortKey = "score" | "deadline";

export function GrantsAllSection({ programs, profileUpdatedAt, onOpen, onToggleStar, onFeedback, onDismiss }: GrantsAllSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [q, setQ] = useState("");
  const [grades, setGrades] = useState<Set<GrantGrade>>(new Set());
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState<SortKey>("score");
  const [hideExpired, setHideExpired] = useState(true);

  const live = useMemo(() => programs.filter((p) => !p.dismissed), [programs]);
  const expiredCount = useMemo(() => live.filter(isExpired).length, [live]);

  const filtered = useMemo(() => {
    let list = live;
    if (hideExpired) list = list.filter((p) => !isExpired(p));
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(needle) ||
          p.summary.toLowerCase().includes(needle) ||
          p.why.toLowerCase().includes(needle) ||
          p.matchedTags.some((t) => t.toLowerCase().includes(needle)),
      );
    }
    if (grades.size > 0) list = list.filter((p) => { const grade = grantReviewPresentation(p, profileUpdatedAt).grade; return grade != null && grades.has(grade); });
    if (source !== "all") list = list.filter((p) => p.source === source);
    return [...list].sort((a, b) => {
      if (sort === "deadline") return (a.applyEnd ?? "9999").localeCompare(b.applyEnd ?? "9999");
      const aReview = grantReviewPresentation(a, profileUpdatedAt), bReview = grantReviewPresentation(b, profileUpdatedAt);
      const g = aReview.rank - bReview.rank;
      if (g !== 0) return g;
      return (bReview.score ?? -1) - (aReview.score ?? -1);
    });
  }, [live, q, grades, source, sort, hideExpired, profileUpdatedAt]);

  return (
    <section style={{ borderTop: "1px solid var(--border-default)", paddingTop: 16 }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 15,
          fontWeight: 700,
          color: "var(--text-strong)",
        }}
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        All announcements ({live.length})
        {!expanded && <span style={{ fontSize: 12.5, fontWeight: 400, color: "var(--text-muted)" }}>: expand to search and filter</span>}
      </button>

      {expanded && (
        <div className="sx-anim-view" style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <div style={{ width: 240 }}>
              <Input size="sm" icon={<Search size={14} />} placeholder="Search announcements" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {GRADE_ORDER.map((g) => (
                <Tag
                  key={g}
                  size="sm"
                  active={grades.has(g)}
                  dotColor={GRADE_COLOR[g]}
                  onClick={() =>
                    setGrades((prev) => {
                      const next = new Set(prev);
                      if (next.has(g)) next.delete(g);
                      else next.add(g);
                      return next;
                    })
                  }
                >
                  {g}
                </Tag>
              ))}
            </div>
            <Select
              size="sm"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              options={[
                { value: "all", label: "All sources" },
                { value: "bizinfo", label: "Bizinfo" },
                { value: "kstartup", label: "K-Startup" },
                { value: "manual", label: "Manual import" },
              ]}
            />
            <Select
              size="sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              options={[
                { value: "score", label: "Grade and score" },
                { value: "deadline", label: "Closing soonest" },
              ]}
            />
            <span style={{ flex: 1 }} />
            <Switch size="sm" checked={hideExpired} onChange={(e) => setHideExpired(e.target.checked)}>
              Hide closed announcements{expiredCount > 0 ? ` (${expiredCount})` : ""}
            </Switch>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No matching announcements" description="Try changing your search or filters." />
          ) : (
            <div className="sx-grid-m1" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {filtered.map((p) => (
                <GrantCard
                  key={p.id}
                  program={p}
                  profileUpdatedAt={profileUpdatedAt}
                  onOpen={() => onOpen(p)}
                  onToggleStar={() => onToggleStar(p)}
                  onFeedback={(v) => onFeedback(p, v)}
                  onDismiss={() => onDismiss(p)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
