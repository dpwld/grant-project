"use client";

import { ExternalLink, ListPlus, ThumbsDown, ThumbsUp } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ds/core/Badge";
import { Button } from "@/components/ds/core/Button";
import { Tag } from "@/components/ds/core/Tag";
import { Drawer } from "@/components/ds/feedback/Drawer";
import { dday, pillStyle } from "@/components/pm/pmFormat";
import { grantReviewPresentation } from "@/lib/grants/reviewPresentation";
import type { GrantProgram } from "@/lib/data/grants";
import { ELIGIBILITY_LABEL, GRADE_COLOR, GRADE_LABEL, SOURCE_LABEL, isClosingSoon, isExpired } from "./grantFormat";

/* 공고 상세 드로어 — AI why 전문 + 적합성 체크포인트 표 + 일정/액션. */

const ELIGIBILITY_TONE: Record<"meets" | "unclear" | "fails", BadgeTone> = {
  meets: "success",
  unclear: "warning",
  fails: "danger",
};

interface GrantDrawerProps {
  program: GrantProgram | null;
  profileUpdatedAt: string;
  onClose: () => void;
  onAddToSprint: (p: GrantProgram) => void;
  onFeedback: (p: GrantProgram, v: "up" | "down") => void;
  adding: boolean;
  onMatch: (p: GrantProgram) => void;
  matching: boolean;
}

export function GrantDrawer({ program: p, profileUpdatedAt, onClose, onAddToSprint, onFeedback, adding, onMatch, matching }: GrantDrawerProps) {
  const d = p ? dday(p.applyEnd) : null;
  const review = p ? grantReviewPresentation(p, profileUpdatedAt) : null;

  return (
    <Drawer open={!!p} onClose={onClose} title="공고 상세" width={560} closeOnOutside>
      {p && review && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {review.grade && (
              <span style={{ ...pillStyle(GRADE_COLOR[review.grade]), padding: "3px 12px", fontSize: 14 }}>
                {review.grade}{review.score != null ? ` · ${review.score}점` : ""}
              </span>
            )}
            {review.grade && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{GRADE_LABEL[review.grade]}</span>}
            {review.statusLabel && <Tag size="sm">{review.statusLabel}</Tag>}
            {review.failed && review.previous && <Tag size="sm">재심사 필요</Tag>}
            {review.previous && p.grade && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>이전 평가 {p.grade}{p.score != null ? ` · ${p.score}점` : ""}</span>}
            <Tag size="sm">{SOURCE_LABEL[p.source]}</Tag>
            {d && (
              <span
                style={{
                  ...pillStyle(d.overdue || isClosingSoon(p) ? "var(--red-500, #ef4444)" : "var(--gray-500, #6b7280)"),
                  padding: "2px 10px",
                  fontSize: 12.5,
                }}
              >
                {d.overdue ? "마감됨" : d.label}
              </span>
            )}
          </div>

          {review.previous && <p role="status" style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>재심사 필요 · 아래 이전 평가는 현재 기업 프로필과 공고에 대한 추천이 아닙니다.</p>}

          <h3 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.4, color: "var(--text-strong)", margin: 0 }}>{p.title}</h3>

          <Button variant="secondary" size="sm" loading={matching} disabled={p.dismissed || isExpired(p)} onClick={() => onMatch(p)}>
            {p.grade ? "이 공고 다시 평가" : "이 공고 AI 매칭"}
          </Button>

          <div style={{ display: "flex", gap: 8 }}>
            {p.url && (
              <Button variant="secondary" size="sm" onClick={() => window.open(p.url, "_blank", "noopener")}>
                <ExternalLink size={14} /> 공고 원문 보기
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              loading={adding}
              disabled={!!p.sprintTaskId}
              onClick={() => onAddToSprint(p)}
            >
              <ListPlus size={14} /> {p.sprintTaskId ? "Paceboard에 등록됨" : "Paceboard에 추가"}
            </Button>
            <span style={{ flex: 1 }} />
            <Button
              variant={p.feedback === "up" ? "soft" : "ghost"}
              size="sm"
              onClick={() => onFeedback(p, "up")}
              title="이 추천이 도움됨"
            >
              <ThumbsUp size={14} />
            </Button>
            <Button
              variant={p.feedback === "down" ? "soft" : "ghost"}
              size="sm"
              onClick={() => onFeedback(p, "down")}
              title="이 추천이 도움 안 됨"
            >
              <ThumbsDown size={14} />
            </Button>
          </div>

          <InfoGrid
            rows={[
              ["접수 기간", p.applyStart || p.applyEnd ? `${p.applyStart ?? "?"} ~ ${p.applyEnd ?? "?"}` : "공고 원문 확인"],
              ["지원 유형", p.supportTypes.join(", ") || "N/A"],
              ["지원 대상", p.targets.join(", ") || "N/A"],
              ["주관/지역", p.region || "N/A"],
              ["지원 규모", p.amountText || "공고 원문 확인"],
            ]}
          />

          {p.assessment && <section style={{ background: "var(--surface-subtle)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 12 }}>
            <SectionTitle>{review.failed ? "최근 심사 시도" : review.stale ? "이전 평가 심사 범위" : "심사 범위"}</SectionTitle>
            {p.assessment.status === "failed" ? <p>심사 실패: {p.assessment.error} · 다시 평가하면 재시도합니다.</p> : <>
              <p>{p.assessment.sourceStatus === "original" ? (p.assessment.truncated ? "공식 웹페이지 본문 일부 확인" : "공식 웹페이지 본문 확인") : "공식 본문 미확인 · 수집된 요약으로 평가"}</p>
              {p.assessment.sourceError && <p>{p.assessment.sourceError}</p>}
              <p>첨부 PDF·HWP 전체를 심사한 결과는 아닙니다. 신청 전 첨부의 세부 조건을 확인해주세요.</p>
            </>}
            <span style={{ fontSize: 12 }}>{new Date(p.assessment.reviewedAt).toLocaleString("ko-KR")}</span>
          </section>}
          {p.why && (
            <section>
              <SectionTitle>{review.stale ? "이전 평가 이유" : "AI 추천 이유"}</SectionTitle>
              <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text-default)", margin: 0, whiteSpace: "pre-wrap" }}>{p.why}</p>
              {p.matchedTags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {p.matchedTags.map((t) => (
                    <Tag key={t} size="sm" active={!review.stale}>
                      {t}
                    </Tag>
                  ))}
                </div>
              )}
            </section>
          )}

          {p.eligibility.length > 0 && (
            <section>
              <SectionTitle>{review.stale ? "이전 평가 적합성 체크포인트" : "적합성 체크포인트"}</SectionTitle>
              <div style={{ border: "1px solid var(--border-default)", borderRadius: 12, overflow: "hidden" }}>
                {p.eligibility.map((e, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: "10px 14px",
                      borderTop: i === 0 ? "none" : "1px solid var(--border-default)",
                    }}
                  >
                    <Badge tone={ELIGIBILITY_TONE[e.status]}>{ELIGIBILITY_LABEL[e.status]}</Badge>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{e.requirement}</div>
                      {e.note && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{e.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, marginBottom: 0 }}>
                {review.stale ? "이전 평가입니다. 재심사 전에는 현재 적합성으로 판단하지 마세요. " : ""}AI 판단은 참고용입니다: 신청 전 반드시 공고 원문의 자격요건을 확인하세요.
              </p>
            </section>
          )}

          {p.summary && (
            <section>
              <SectionTitle>공고 요약</SectionTitle>
              <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text-default)", margin: 0, whiteSpace: "pre-wrap" }}>{p.summary}</p>
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
      {children}
    </div>
  );
}

function InfoGrid({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", rowGap: 8, columnGap: 12, fontSize: 13.5 }}>
      {rows.map(([label, value]) => (
        <FragmentRow key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div style={{ color: "var(--text-muted)" }}>{label}</div>
      <div style={{ color: "var(--text-default)" }}>{value}</div>
    </>
  );
}
