# Implementation and verification

## Preserved workflows

The original Grants recommendation, profile and archive components retain their fields, filters, presets, detail drawer and review queue. Original paginated collection, source verification, assessment signatures and bounded batch accounting are retained. Visual tokens use a monochrome palette and a locally hosted Pretendard font.

The browser-local prototype is superseded. Profiles, announcements, reviews, feedback, stars, archive state and sync history now use authenticated server APIs and owner-scoped D1 records. The initial database is empty.

## Server behavior

- Profile input, imports and patches are validated before persistence. Announcements are unique by owner, source and source ID.
- Reimporting official content preserves user feedback and curation. Atomic field patches preserve explicit nulls and unrelated fields.
- Every API resolves identity from the trusted hosting gateway. Missing identity is rejected, cross-origin mutations are rejected, and a caller cannot supply another owner in JSON.
- Bizinfo and K-Startup use real paginated HTTP adapters with user-owned keys. Missing/failed sources are reported individually; partial collection is not presented as complete.
- AI review uses a configured OpenAI model and server-only key. It checks official source content, validates the structured result and retains assessment provenance. Unsupported source URLs are not fetched.
- Profile/content changes invalidate earlier reviews. Stale or failed results do not supply current grade filters, ranking or recommendations. Historical results remain explicitly labelled.
- Sprint handoff opens an authenticated review page. The original page records a task link only after a validated response from that exact popup and configured Sprint origin. Empty source URLs are omitted; source IDs containing reserved URL characters remain editable.
- No copied company configuration, operational URLs, credentials, records or original Git history are included.

## Executed checks

Validated locally on 2026-10-20:

| Check | Result |
| --- | --- |
| Domain and review presentation suite | 9 tests passed: pagination, repeated-page detection, stale review signatures, queue accounting, source restrictions, input validation and historical-result display |
| Real Worker + D1 HTTP suite | Passed: authentication, ownership isolation, CSRF, CRUD, duplicate import preservation, explicit null, invalid-input preservation, missing integration settings and encoded record IDs |
| Worker restart | Previously saved profile and curation remained after stopping and restarting the Worker |
| Browser workflow | Saved a profile through the actual UI and confirmed it survived reload; disposable profile removed afterward |
| Fresh local migration | Applied successfully to an isolated empty database; second application was a no-op |
| Typecheck and production build | Passed after review fixes |

Integration fixtures use isolated verification owners on loopback. They are never part of migrations, runtime seeds or hosted data.

README examples use a separate explicit local helper, `scripts/readme-example.mjs`. It creates one fictional profile, eight fictional announcements and illustrative assessments, without any external API call. It refuses to overwrite a populated local workspace, rejects redirects and records fixture IDs for bounded cleanup. Captions identify both announcements and assessments as fictional; deployment databases remain empty.

## Configuration and current limits

- Live government API collection and paid AI responses have not been exercised with operator credentials. Configure the keys listed in README, then validate those connections with your own data.
- AI analysis checks supported official page text. It does not claim to inspect attached PDF/HWP documents or make an authoritative eligibility determination.
- Review batches are initiated by the browser. This release does not add a scheduled crawler or a durable background queue that resumes after the browser closes.
- The account is the data boundary; this release does not provide shared multi-account company workspaces.
- D1 stores owner-scoped JSON records. Current filtering loads the owner's announcements; large-volume performance has not been established.
- Sites supplies hosted authentication and storage. Moving to another host requires its own trusted authentication and storage adapter.

External dependencies and limitations are explicit in README. A successful build or local test does not imply those external connections have been verified.
