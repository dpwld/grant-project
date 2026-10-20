"use client";

import { Star, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Tag } from "@/components/ds/core/Tag";
import { dday, pillStyle } from "@/components/pm/pmFormat";
import { grantReviewPresentation } from "@/lib/grants/reviewPresentation";
import type { GrantProgram } from "@/lib/data/grants";
import { GRADE_COLOR, SOURCE_LABEL, isClosingSoon } from "./grantFormat";

/* 공고 카드 — 등급 배지·출처·제목·태그·AI 요약 한 줄·D-day·큐레이션 버튼. */

interface GrantCardProps {
  program: GrantProgram;
  profileUpdatedAt: string;
  onOpen: () => void;
  onToggleStar: () => void;
  onFeedback: (v: "up" | "down") => void;
  onDismiss: () => void;
}

export function GrantCard({ program: p, profileUpdatedAt, onOpen, onToggleStar, onFeedback, onDismiss }: GrantCardProps) {
  const review = grantReviewPresentation(p, profileUpdatedAt);
  const d = dday(p.applyEnd);
  const closing = isClosingSoon(p);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-default)",
        borderRadius: 14,
        padding: "16px 18px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {review.grade ? (
          <span
            style={{
              ...pillStyle(GRADE_COLOR[review.grade]),
              padding: "2px 10px",
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {review.grade}
            {review.score != null && <span style={{ fontWeight: 500 }}>{review.score}</span>}
          </span>
        ) : (
          <Tag size="sm">{review.statusLabel}</Tag>
        )}
        {review.failed && review.previous && <Tag size="sm">재심사 필요</Tag>}
        {review.previous && p.grade && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>이전 평가 {p.grade}{p.score != null ? ` · ${p.score}점` : ""}</span>}
        <Tag size="sm">{SOURCE_LABEL[p.source]}</Tag>
        <span style={{ flex: 1 }} />
        {d && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: closing || d.overdue ? "var(--red-500, #ef4444)" : "var(--text-muted)",
            }}
          >
            {d.overdue ? "마감" : d.label}
          </span>
        )}
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", lineHeight: 1.35 }}>{p.title}</div>

      {(p.matchedTags.length > 0 || p.supportTypes.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {review.previous && p.matchedTags.length > 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>이전 평가 키워드</span>}
          {p.matchedTags.slice(0, 3).map((t) => (
            <Tag key={t} size="sm" active={!review.stale}>
              {t}
            </Tag>
          ))}
          {p.supportTypes.slice(0, 2).map((t) => (
            <Tag key={t} size="sm">
              {t}
            </Tag>
          ))}
        </div>
      )}

      {(p.why || p.summary) && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {p.why ? `${review.stale ? "이전 평가 · " : ""}${p.why}` : p.summary}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: "auto" }} onClick={(e) => e.stopPropagation()}>
        <IconBtn label={p.starred ? "별표 해제" : "별표"} active={p.starred} onClick={onToggleStar}>
          <Star size={15} fill={p.starred ? "currentColor" : "none"} />
        </IconBtn>
        <IconBtn label="도움됨" active={p.feedback === "up"} onClick={() => onFeedback("up")}>
          <ThumbsUp size={15} />
        </IconBtn>
        <IconBtn label="도움 안 됨" active={p.feedback === "down"} onClick={() => onFeedback("down")}>
          <ThumbsDown size={15} />
        </IconBtn>
        <span style={{ flex: 1 }} />
        <IconBtn label="추천에서 빼기" onClick={onDismiss}>
          <X size={15} />
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      style={{
        border: "none",
        background: active ? "color-mix(in srgb, var(--blue-500, #3b82f6) 12%, transparent)" : "transparent",
        color: active ? "var(--blue-500, #3b82f6)" : "var(--text-muted)",
        borderRadius: 8,
        padding: 6,
        cursor: "pointer",
        display: "inline-flex",
      }}
    >
      {children}
    </button>
  );
}
