import type { GrantGrade, GrantProfile, GrantProgram } from "@/lib/data/grants";

/* 지원사업 화면 공용 헬퍼 — 등급 색·마감 판정·프로필 완성도.
   D-day 계산은 pm/pmFormat의 dday/daysUntil을 그대로 재사용한다. */

export const GRADE_ORDER: GrantGrade[] = ["S", "A", "B", "C", "D"];

export const GRADE_COLOR: Record<GrantGrade, string> = {
  S: "#047857",
  A: "#0369a1",
  B: "#4f46e5",
  C: "#a16207",
  D: "#64748b",
};

export const GRADE_LABEL: Record<GrantGrade, string> = {
  S: "Review now",
  A: "Priority review",
  B: "Consider",
  C: "Low relevance",
  D: "Not relevant",
};

export const SOURCE_LABEL: Record<GrantProgram["source"], string> = {
  bizinfo: "Bizinfo",
  kstartup: "K-Startup",
  manual: "Manual import",
};

export const ELIGIBILITY_LABEL = {
  meets: "Meets",
  unclear: "Check source",
  fails: "Does not meet",
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
  { key: "companyName", label: "Company name" },
  { key: "entityType", label: "Company type" },
  { key: "foundedOn", label: "Founding date" },
  { key: "industry", label: "Industry" },
  { key: "regionSi", label: "City / province" },
  { key: "businessSummary", label: "Business summary" },
];

const RECOMMENDED_FIELDS: { key: keyof GrantProfile; label: string }[] = [
  { key: "keywords", label: "Matching keywords" },
  { key: "certifications", label: "Certifications" },
  { key: "employeeCount", label: "Employee count" },
  { key: "coreTech", label: "Core technology" },
  { key: "excludeKeywords", label: "Excluded keywords" },
];

const OPTIONAL_FIELDS: { key: keyof GrantProfile; label: string }[] = [
  { key: "revenueBand", label: "Revenue range" },
  { key: "achievements", label: "Achievements" },
  { key: "subIndustry", label: "Industry specialization" },
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
    { label: "Required", fields: REQUIRED_FIELDS },
    { label: "Recommended", fields: RECOMMENDED_FIELDS },
    { label: "Optional", fields: OPTIONAL_FIELDS },
  ];
  const tiers = specs.map(({ label, fields }) => {
    const rows = fields.map((f) => ({ ...f, done: profile ? filled(profile, f.key) : false }));
    return { label, fields: rows, done: rows.filter((r) => r.done).length, total: rows.length };
  });
  const done = tiers.reduce((n, t) => n + t.done, 0);
  const total = tiers.reduce((n, t) => n + t.total, 0);
  return { tiers, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}
