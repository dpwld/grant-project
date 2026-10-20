import type { GrantProgram } from '../data/grants';
import { needsReview } from './assessment.ts';

/** Retained AI output is historical until its profile and source revisions match. */
export function grantReviewPresentation(program: GrantProgram, profileUpdatedAt: string) {
 const stale = needsReview(program, profileUpdatedAt);
 const failed = program.assessment?.status === 'failed';
 const previous = stale && Boolean(program.grade || program.why || program.eligibility.length || program.matchedTags.length);
 const grade = stale ? null : program.grade;
 return {
  stale, failed, previous, grade,
  score: stale ? null : program.score,
  rank: grade ? ['S', 'A', 'B', 'C', 'D'].indexOf(grade) : 5,
  statusLabel: failed ? 'Review failed' : stale ? previous ? 'Review again' : 'Not reviewed' : null,
 };
}
