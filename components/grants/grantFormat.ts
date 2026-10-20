import type { GrantGrade, GrantProfile, GrantProgram } from "@/lib/data/grants";

/* 지원사업 화면 공용 헬퍼 — 등급 색·마감 판정·프로필 완성도.
   D-day 계산은 pm/pmFormat의 dday/daysUntil을 그대로 재사용한다. */

export const GRADE_ORDER: GrantGrade[] = ["S", "A", "B", "C", "D"];

export const GRADE_COLOR: Record<GrantGrade, string> = {
  S: "#18181b",
  A: "#3f3f46",
  B: "#52525b",
  C: "#71717a",
  D: "#a1a1aa",
};

export const GRADE_LABEL: Record<GrantGrade, string> = {
  S: "즉시 검토",
  A: "우선 검토",
  B: "검토 후보",
  C: "관련성 낮음",
  D: "무관",
};

export const SOURCE_LABEL: Record<GrantProgram["source"], string> = {
  bizinfo: "기업마당",
  kstartup: "K-Startup",
  manual: "수동 등록",
};

export const ELIGIBILITY_LABEL = {
  meets: "충족",
  unclear: "원문 확인",
  fails: "미충족",
} as const;

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function isExpired(p: GrantProgram): boolean {
  return !!p.applyEnd && p.applyEnd < todayIso();
}

/** 마감 7일 이내(만료 제외). */
export function isClosingSoon(p: GrantProgram): boolean {
  if (!p.applyEnd || isExpired(p)) return false;
  const diff = (new Date(p.applyEnd + "T00:00:00").getTime() - new Date(todayIso() + "T00:00:00").getTime()) / 86400000;
  return diff <= 7;
}

/* 프로필 완성도 — 필수/추천/선택 3단. 필드 존재 여부만 본다. */
const REQUIRED_FIELDS: { key: keyof GrantProfile; label: string }[] = [
  { key: "companyName", label: "회사명" },
  { key: "entityType", label: "기업 형태" },
  { key: "foundedOn", label: "설립일(업력)" },
  { key: "industry", label: "업종" },
  { key: "regionSi", label: "소재지(시)" },
  { key: "businessSummary", label: "사업 요약" },
];

const RECOMMENDED_FIELDS: { key: keyof GrantProfile; label: string }[] = [
  { key: "keywords", label: "매칭 키워드" },
  { key: "certifications", label: "보유 인증" },
  { key: "employeeCount", label: "직원 수" },
  { key: "coreTech", label: "핵심 기술" },
  { key: "excludeKeywords", label: "제외 키워드" },
];

const OPTIONAL_FIELDS: { key: keyof GrantProfile; label: string }[] = [
  { key: "revenueBand", label: "매출 구간" },
  { key: "achievements", label: "주요 실적" },
  { key: "subIndustry", label: "세부 업종" },
];

function filled(profile: GrantProfile, key: keyof GrantProfile): boolean {
  const v = profile[key];
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return true;
  return String(v).trim().length > 0;
}

export interface CompletenessTier {
  label: string;
  fields: { key: keyof GrantProfile; label: string; done: boolean }[];
  done: number;
  total: number;
}

export interface Completeness {
  tiers: CompletenessTier[];
  pct: number;
}

export function profileCompleteness(profile: GrantProfile | null): Completeness {
  const specs: { label: string; fields: typeof REQUIRED_FIELDS }[] = [
    { label: "필수", fields: REQUIRED_FIELDS },
    { label: "추천", fields: RECOMMENDED_FIELDS },
    { label: "선택", fields: OPTIONAL_FIELDS },
  ];
  const tiers = specs.map(({ label, fields }) => {
    const rows = fields.map((f) => ({ ...f, done: profile ? filled(profile, f.key) : false }));
    return { label, fields: rows, done: rows.filter((r) => r.done).length, total: rows.length };
  });
  const done = tiers.reduce((n, t) => n + t.done, 0);
  const total = tiers.reduce((n, t) => n + t.total, 0);
  return { tiers, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}
