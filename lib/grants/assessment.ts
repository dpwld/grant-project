export const REVIEW_VERSION = 3;

export interface GrantAssessment {
  version: number;
  status: "complete" | "failed";
  reviewedAt: string;
  profileUpdatedAt: string;
  inputKey: string;
  sourceStatus: "original" | "summary_only";
  sourceUrl: string;
  sourceError?: string;
  originalChars: number;
  truncated: boolean;
  attachmentsReviewed: false;
  error?: string;
}

export function grantInputKey(p: { title: string; summary: string; url: string; applyStart: string | null; applyEnd: string | null; targets: string[]; region: string; amountText: string; supportTypes: string[] }): string {
  return JSON.stringify([p.title, p.summary, p.url, p.applyStart, p.applyEnd, p.targets, p.region, p.amountText, p.supportTypes]);
}

export function needsReview(p: Parameters<typeof grantInputKey>[0] & { grade: string | null; assessment?: GrantAssessment | null }, profileUpdatedAt: string): boolean {
  return !p.grade || p.assessment?.status !== "complete" || p.assessment.version !== REVIEW_VERSION
    || p.assessment.profileUpdatedAt !== profileUpdatedAt || p.assessment.inputKey !== grantInputKey(p);
}
