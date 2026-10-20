"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ds/core/Button";
import { Tag } from "@/components/ds/core/Tag";
import { ProgressBar } from "@/components/ds/feedback/ProgressBar";
import { FormField } from "@/components/ds/forms/FormField";
import { Input } from "@/components/ds/forms/Input";
import { Textarea } from "@/components/ds/forms/Textarea";
import { EMPTY_PROFILE, type GrantProfile } from "@/lib/data/grants";
import { profileCompleteness } from "./grantFormat";

/* 기업 프로필 탭 — AI 매칭의 근거가 되는 단일 프로필(id=1).
   필수/추천/선택 3단으로 나눠 완성도를 보여준다 (Poliflo 프로필 완성도 패턴). */

/** 매칭 기준 프리셋 — 버튼으로 채우고 자유롭게 수정 가능. 빈 값 = 서버 기본(자금 지원). */
const FOCUS_PRESETS: { label: string; text: string }[] = [
  { label: "자금 지원 (기본)", text: "" },
  {
    label: "특허·IP 지원",
    text: "특허·지식재산(IP) 지원이 핵심인 공고 — 특허 출원·등록 비용 지원, IP 사업화·컨설팅(IP 나래·IP 디딤돌 등), 해외 출원 지원, 특허 기반 R&D. 일반 운영자금이나 교육 위주 공고는 관련성 낮음으로 평가.",
  },
  {
    label: "전체 (제한 없음)",
    text: "지원 형태 제한 없음 — 자금·특허·인증·수출·인력·공간 등 기업 사업과 관련되면 형태와 무관하게 평가.",
  },
];

interface GrantsProfileTabProps {
  profile: GrantProfile | null;
  saving: boolean;
  onSave: (p: GrantProfile) => void;
}

export function GrantsProfileTab({ profile, saving, onSave }: GrantsProfileTabProps) {
  // key-based remount는 부모(GrantsWorkspace)가 담당 — 여기서는 초기값으로만 사용.
  const [form, setForm] = useState<GrantProfile>(profile ?? EMPTY_PROFILE);
  const comp = profileCompleteness(form);

  const set = <K extends keyof GrantProfile>(key: K, value: GrantProfile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 860 }}>
      <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: 14, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}>프로필 완성도 {comp.pct}%</span>
          {comp.tiers.map((t) => (
            <span key={t.label} style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              {t.label} {t.done}/{t.total}
            </span>
          ))}
        </div>
        <ProgressBar value={comp.pct} />
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "10px 0 0" }}>
          프로필이 자세할수록 AI 매칭 등급의 정확도가 올라갑니다. 필수 항목부터 채워주세요.
        </p>
      </div>

      <Section title="AI 매칭 기준" hint="이번 검색에서 어떤 지원을 찾을지 — 매칭 등급이 이 기준을 따릅니다">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FOCUS_PRESETS.map((p) => (
            <Button key={p.label} size="sm"
              variant={form.matchFocus === p.text || (p.text === "" && form.matchFocus === "") ? "secondary" : "ghost"}
              onClick={() => set("matchFocus", p.text)}>
              {p.label}
            </Button>
          ))}
        </div>
        <FormField label="기준 (자유 서술 — 비워두면 기본: 자금 지원 중심)">
          <Textarea className="sx-ghost" rows={3} value={form.matchFocus}
            onChange={(e) => set("matchFocus", e.target.value)}
            placeholder="예: 특허·지식재산(IP) 지원이 핵심인 공고 — 출원·등록 비용, IP 사업화, 해외 출원 지원 등" />
        </FormField>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>
          기준을 바꾼 뒤에는 저장하고 매칭 탭에서 <b>전체 재매칭</b>을 실행해야 등급에 반영됩니다.
        </p>
      </Section>

      <Section title="필수" hint="매칭의 기본 근거">
        <Row>
          <FormField label="회사명">
            <Input className="sx-ghost" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="회사명 입력" />
          </FormField>
          <FormField label="기업 형태">
            <Input className="sx-ghost" value={form.entityType} onChange={(e) => set("entityType", e.target.value)} placeholder="법인 (주식회사)" />
          </FormField>
        </Row>
        <Row>
          <FormField label="설립일">
            <Input className="sx-ghost" type="date" value={form.foundedOn ?? ""} onChange={(e) => set("foundedOn", e.target.value || null)} />
          </FormField>
          <FormField label="업종">
            <Input className="sx-ghost" value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="주업종 입력" />
          </FormField>
        </Row>
        <Row>
          <FormField label="소재지 (시)">
            <Input className="sx-ghost" value={form.regionSi} onChange={(e) => set("regionSi", e.target.value)} placeholder="시·도 입력" />
          </FormField>
          <FormField label="소재지 (구)">
            <Input className="sx-ghost" value={form.regionGu} onChange={(e) => set("regionGu", e.target.value)} placeholder="시·군·구 입력" />
          </FormField>
        </Row>
        <FormField label="사업 요약">
          <Textarea
            className="sx-ghost"
            rows={3}
            value={form.businessSummary}
            onChange={(e) => set("businessSummary", e.target.value)}
            placeholder="무엇을 만들고 누구에게 파는지 2~3문장"
          />
        </FormField>
      </Section>

      <Section title="추천" hint="등급 정확도를 크게 올리는 항목">
        <ChipEditor label="매칭 키워드" hint="이 키워드가 공고와 겹치면 가점" values={form.keywords} onChange={(v) => set("keywords", v)} placeholder="사업 관련 키워드" />
        <ChipEditor label="보유 인증" values={form.certifications} onChange={(v) => set("certifications", v)} placeholder="예: 벤처기업인증" />
        <Row>
          <FormField label="직원 수">
            <Input
              className="sx-ghost"
              type="number"
              value={form.employeeCount == null ? "" : String(form.employeeCount)}
              onChange={(e) => set("employeeCount", e.target.value === "" ? null : Number(e.target.value))}
              suffix="명"
            />
          </FormField>
          <FormField label="핵심 기술">
            <Input className="sx-ghost" value={form.coreTech} onChange={(e) => set("coreTech", e.target.value)} placeholder="보유 기술과 차별점" />
          </FormField>
        </Row>
        <ChipEditor
          label="제외 키워드"
          hint="선호하지 않는 분야를 입력합니다. 실제 모집 대상을 함께 평가합니다."
          values={form.excludeKeywords}
          onChange={(v) => set("excludeKeywords", v)}
          placeholder="예: 소상공인"
        />
      </Section>

      <Section title="선택" hint="여유 있을 때">
        <Row>
          <FormField label="매출 구간">
            <Input className="sx-ghost" value={form.revenueBand} onChange={(e) => set("revenueBand", e.target.value)} placeholder="예: 10억 미만" />
          </FormField>
          <FormField label="세부 업종">
            <Input className="sx-ghost" value={form.subIndustry} onChange={(e) => set("subIndustry", e.target.value)} placeholder="사업의 세부 업종" />
          </FormField>
        </Row>
        <FormField label="주요 실적">
          <Textarea
            className="sx-ghost"
            rows={3}
            value={form.achievements}
            onChange={(e) => set("achievements", e.target.value)}
            placeholder="수상, 투자 유치, 주요 계약 등"
          />
        </FormField>
      </Section>

      <div>
        <Button variant="primary" loading={saving} onClick={() => onSave(form)}>
          프로필 저장
        </Button>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-strong)", margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{hint}</span>
      </div>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="sx-grid-m1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {children}
    </div>
  );
}

function ChipEditor({
  label,
  hint,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  };

  return (
    <FormField label={label} hint={hint}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {values.map((v) => (
          <Tag key={v} size="sm" onRemove={() => onChange(values.filter((x) => x !== v))}>
            {v}
          </Tag>
        ))}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div style={{ width: 160 }}>
            <Input
              className="sx-ghost"
              size="sm"
              value={draft}
              placeholder={placeholder}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={add} title="추가">
            <Plus size={14} />
          </Button>
        </div>
      </div>
    </FormField>
  );
}
