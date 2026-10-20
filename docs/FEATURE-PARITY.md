# Original Grants feature parity

Source: original GrantsWorkspace and its direct component/domain dependencies. The prior local-only prototype is superseded.

| Original workflow | Extraction |
| --- | --- |
| 추천 / 프로필 / 보관함 | Original components, complete profile fields and presets preserved |
| KPIs, top recommendations, filtering, grades, starred/feedback/archive/restore | Original components and classification logic; authenticated owned server records |
| Official Bizinfo / K-Startup full paginated collection | Original parsing/collection; owned D1 upsert preserving curation; user-owned API keys required |
| AI review, per-item sources/eligibility, progress, stop/resume, retry | Original assessment and bounded queue; real OpenAI request, user-owned key required |
| Review stale detection | Original review version + profile/content signature |
| Sprint task conversion | Independent service handoff to /import/grant; signed-in confirmation and durable task persistence in Sprint |
| Real record import | JSON import of actual announcements; no sample seed; validation before changes |
| Persistence and isolation | D1, owner-scoped profile/program/sync records; empty initial database |

Validation results and any remaining limitations are tracked in IMPLEMENTATION-REPORT.md, not assumed from this mapping.
