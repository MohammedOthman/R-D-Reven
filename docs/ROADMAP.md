# Roadmap

Build order, as agreed with the user. Each item is a separate piece of work —
do not start the next one before the current one is reviewed and accepted.

## Phase 0 — Foundation (this phase)

Monorepo, tech stack, design system, app shell, database/migration pipeline
with zero product tables, docs. No features. Complete.

## Phase 1 — Core identity

1. **Authentication** — sign-up, sign-in, sign-out, password reset, session
   lifecycle, per PRD S01 (Sign-in / SSO) and AUTH-01–05. **Complete.**
   Custom-built (email/password; JWT access + rotated opaque refresh tokens
   in httpOnly cookies), not a third-party provider or Auth.js — see
   `docs/DECISIONS.md`. Enterprise SSO (OIDC/SAML) is deliberately deferred,
   not designed against here — add it as its own feature when a customer
   contract requires it. Password reset emails are logged, not sent — no
   transactional email provider has been chosen yet (also in
   `docs/DECISIONS.md`); that decision blocks real password-reset delivery
   but nothing else in this phase.
2. **Tenant / Organization** — tenant creation, settings, timezone/language,
   per PRD S02 (Tenant setup) and ADM-01–04. **Complete.** `Tenant` and
   `Membership` linking `User` to a tenant with a role. A user with no
   tenant is routed to `/create-organization` (a third route group,
   `(onboarding)`) right after sign-up; creating one makes them its owner.
   See `docs/ARCHITECTURE.md`. Building this also surfaced and fixed a real
   gap in Authentication: the 15-minute access token had no renewal path
   anywhere, so any session simply stopped working after 15 minutes. Fixed
   with silent refresh on both the page-load path (`apps/web/proxy.ts`) and
   the client-fetch path (`apiFetch` in `src/lib/api/client.ts`) — see
   `docs/ARCHITECTURE.md`'s "Silent session renewal" section before
   touching either.
3. **Roles and Permissions (RBAC)** — the deny-by-default doctrine from PRD
   §2.2 and the capability matrix in §2.3. **Complete.** `Membership.role`
   grew to the full six tiers (`OWNER`, `ADMIN`, `EXECUTIVE`, `MANAGER`,
   `REVIEWER`, `GUEST`). `RoleGuard` + `@RequireRole(...)` is the mechanism
   every later domain module builds its own capability checks on — it
   already doubles as tenant-isolation enforcement (AUTH-01) and logs every
   denial (AUTH-05). ADM-02 (invite members) and ADM-03 (assign roles;
   never let the last active Owner be removed) are built with a real
   Administration page (owner/admin only) — invitations, not full account
   merging: an invited email that already has an account is rejected, not
   merged in. Field-level policy for finance data (the other half of
   AUTH-03) has nothing to apply to yet — no finance-bearing object exists
   until Revenue Share ships. See `docs/ARCHITECTURE.md`. Building this
   found two more real, live-only bugs (a CORS method allowlist blocking
   every `PATCH`/`DELETE` from the browser, and `apiFetch` throwing on a
   `201` with an empty body) — both in `docs/DECISIONS.md`, worth reading
   before assuming "works from `curl`" means "works from the browser."

These three are load-bearing for everything after them — every later feature
assumes an authenticated user, a tenant, and an enforced role.

## Phase 2 — Partner data

4. **Partner** — the partner-company record (PRD §4.2: legal/display name,
   identifiers, segment, status, domains). **Complete.** The first genuinely
   new module boundary (`portfolio`) and the first table where every PRD
   §4.1 data rule actually applies — optimistic concurrency (`version`,
   enforced in the update's `WHERE` clause, not read-then-compare) included.
   No new nav item — PRD §3.1 already places "partner profiles" inside the
   existing "Partnerships" surface, so that's what got wired up instead of
   inventing IA the PRD didn't specify. `identifiers` (JSON) and `segment`
   (free text) are deliberately unshaped — the PRD names neither a specific
   identifier scheme nor a taxonomy (that's ADM-05, P1, not built); CSV
   Import (next) is what actually populates `identifiers` from a real
   source system. See `docs/ARCHITECTURE.md` for the role-access
   interpretation (no matrix row is named "Partner," only "Portfolio read"
   and "Partnership edit" — documented in `docs/DECISIONS.md`).
5. **Partnership** — the governed relationship, owner, health, cadence.
   **Complete.** PRD §4.3's state machine (`Prospect → Qualified → Planning →
Active → At Risk → Paused → Terminated → Archived`) is an enforced
   transition graph, not just a status field — including recovery moves
   (Active ⇄ At Risk ⇄ Paused) the PRD's own arrow-chain never draws; see
   `docs/DECISIONS.md` for why that's a documented interpretation rather
   than a literal reading. Field requirements (owner from Qualified; motion,
   objective, cadence, health and next-review to reach Active) follow PRD
   Table 67 exactly, gated by target stage rather than a `NOT NULL` column.
   One Partnership per Partner for now (PRD's INV-001, pending Program).
   Scoped to PORT-01/03/04 only — PORT-05 (health formula), PORT-06 (bulk
   assign), PORT-07 (saved views) and PORT-08 (merge duplicates) are all P1/
   P2 in the PRD itself and explicitly deferred. `program` isn't modeled at
   all yet (a separate unbuilt entity); `motion`/`cadence` stay free text for
   the same ADM-05-not-built reason `segment` does on Partner. The two
   PRD-named analytics events (`partnership_created`, `partnership_activated`)
   are logged now, ahead of a real events pipeline (Roadmap Phase 4). See
   `docs/ARCHITECTURE.md` for the full module writeup and `docs/DECISIONS.md`
   for every interpretation call.
6. **CSV Import and Partnership Activation** — PRD Golden Workflow A
   (FLOW-A), the import wizard (S03), dedup/activation rules. **Complete.**
   Partnership activation itself was already built in item 5 — this item's
   net-new scope is the upload → map → preview → commit pipeline
   (`ImportBatch`/`ImportRow`, a literal implementation of IMP-02's "staging
   batch" requirement, since no such entity is named in PRD Table 12). A
   committed row creates a Partner and a Prospect-stage Partnership
   together; activation stays the existing manual per-relationship flow,
   matching FLOW-A's own primary flow (import, then a separate later
   "manager opens a relationship... activates" step). Dedup (IMP-05) is
   exact-legal-name-or-domain-overlap with explainable reasons, not fuzzy
   matching. Scoped to IMP-01/02/04/05/06/07 plus FLOW-A's own acceptance
   criteria (rejected rows downloadable, provenance retained, idempotent
   commit) — IMP-03's reusable saved mapping, IMP-08's richer error-file
   structure, IMP-09 rollback and IMP-10's per-field provenance are all P1
   and deferred. CSV only (not XLSX); file upload only (not a CRM
   connector — `integrations` is still reserved). Import capability
   (upload/map/commit) is Owner/Admin only, narrower than Partnership's
   Owner/Admin/Manager — S03's own screen-actor line names "Admin"
   specifically. See `docs/ARCHITECTURE.md` for the full module writeup and
   `docs/DECISIONS.md` for every interpretation call.

## Phase 3 — Execution

7. **Initiative, Milestone, Action, and Blocker** — PRD §6.5, S07.
   **Complete.** The first `execution`-module feature. `Milestone` and
   `Blocker` aren't separate PRD entities — Milestone is Initiative's own
   child object (INIT-02) and "Blocker" is Action's `BLOCKED` status plus a
   reason field (INIT-04). Both Initiative's and Action's state machines
   allow a recovery move (Active⇄Blocked, In Progress⇄Blocked) Table 13's
   arrow-chain never draws, matching Partnership's own documented deviation.
   The completion gate is FLOW-B/T-007's acceptance criterion implemented
   literally: completing requires a completion disposition (a scoped stand-
   in for INIT-07's "outcome disposition," since `Outcome` is Phase 4) and a
   remaining-actions treatment, and is blocked by any still-`BLOCKED` action
   unless an audited override reason is given. RBAC genuinely differs from
   every prior module — §2.3's "Initiatives/actions" row denies Reviewer
   entirely, unlike "Portfolio read." "Initiatives" is a real, dedicated
   top-level nav surface (Table 10), not a reused one. Scoped to INIT-01–04/
   06/07 (all P0) — INIT-05 (overdue detection), INIT-08 (timeline view),
   INIT-09 (bulk update) and INIT-10 (clone) are P1/P2 and deferred; no
   notification infrastructure exists anywhere in this codebase yet. See
   `docs/ARCHITECTURE.md` for the full module writeup and `docs/DECISIONS.md`
   for every interpretation call.
8. **Review, Decision, and Follow-up Actions** — PRD Golden Workflow B
   (FLOW-B), S08/S09. **Complete.** "Follow-up Actions" reuses the existing
   `Action` entity from item 7 rather than a new one — `initiativeId` is now
   optional, `reviewId` was added, and updates moved to a flat
   `PATCH /tenants/:tenantId/actions/:actionId` usable from either parent.
   Review's state machine (Scheduled → In Preparation → In Progress →
   Completed) is the only one of the four built so far with no PRD-
   undocumented recovery move — nothing suggests a "stuck" state to recover
   from. The Scheduled → In Preparation transition captures a real snapshot
   (partnership + linked initiatives' stage/health) under a freshly
   generated id. Completing a review (T-008) is flatly blocked — no
   override, unlike Initiative's T-007 gate — by any still-pending decision
   or open follow-up, and propagates its next-review date onto the parent
   Partnership. Decision's approval workflow (DEC-02/INV-004) makes
   Executive's "Approve" capability real for the first time (Partnership's
   own "Approve" cell stayed deferred, since no approval workflow existed
   yet) — Owner/Executive only, never a decision's own creator, checked
   live end-to-end. See `docs/ARCHITECTURE.md` for the full module writeup
   and `docs/DECISIONS.md` for every interpretation call.

## Phase 4 — Proof

9. **Evidence, Outcome, and Verification** — PRD §6.7, S11/S12, FLOW-B's
   conclusion. **Complete.** Table 12 names Contribution and Evidence as two
   distinct entities — Contribution is the claim of observed work linked to
   a partnership, initiative, action or outcome (EVD-01); Evidence is the
   provenance-linked file/reference that backs a contribution or, directly,
   an outcome's verification (needed for INV-003's "at least one accessible
   evidence record" gate). Outcome's state machine (Draft → Submitted →
   Verification Required → Verified → Rejected → Superseded) reads Table
   13's chain as a reachability list rather than a strict sequence — a
   verifier takes one of three actions from Submitted, and Verification
   Required gets the same documented recovery move back to Submitted every
   other "stuck state" in this codebase gets; Superseded stays unreachable
   the same way Review's Reopened does (OUT-04 is P1, deferred).
   Verification carries the same separation-of-duties gate Decision's
   approval got (INV-004-style, here for INV-003/T-010) — never the
   outcome's own creator, checked before the assignment check, live
   end-to-end with a real second account. §2.3's "Evidence/outcomes" row is
   a genuinely different shape from every prior module: Reviewer's cell is
   "Verify if assigned" (a real, assignment-gated capability, not the flat
   denial Initiatives/Reviews give Reviewer), and Guest's "Contribute if
   granted" stays denied pending the Share Grant mechanism (R1.1, not
   built). File evidence (EVD-02) is stored on local disk under
   `apps/api/var/evidence-storage/` — a proportionate MVP stand-in for the
   PRD's "files live in object storage" principle, the same substitution
   local Postgres already is for a managed database — with a server-computed
   SHA-256 checksum, a type/size allowlist, and real malware scanning
   deferred (no AV integration exists anywhere in this codebase, the same
   category of gap as "no transactional email provider"). Scoped to
   EVD-01/02/04 and OUT-01/02/03/05 (all P0) — EVD-03/05 and OUT-04 are P1/
   R1.1 and deferred. See `docs/ARCHITECTURE.md` for the full module
   writeup and `docs/DECISIONS.md` for every interpretation call.
10. **Audit Timeline and Audit Search** — PRD §6.11, S16, AUD-01/02.
    **Complete.** The first `audit-operations`-module feature. A single
    `AuditEvent` model, appended by `recordAuditEvent()` — a plain
    exported function every already-built domain service (14 of them:
    Tenant, Membership, Invitation, Partner, Partnership, ImportBatch,
    Initiative, Milestone, Action, Review, Decision, Contribution,
    Evidence, Outcome) calls directly after a material mutation (creation
    or a lifecycle/state transition — the same boundary the codebase's
    existing analytics-event `Logger` calls already mark), not a
    constructor-injected NestJS provider — that would have cascaded into
    request-scoping every one of those 14 singleton services, a
    codebase-wide change this feature doesn't justify. A write failure is
    caught and logged, never blocks the mutation it describes. AUD-02's
    search (`GET /tenants/:tenantId/audit-events`) enforces §2.3's
    "Audit/export" row's real per-role _scoping_ (not just an allow/deny
    gate) — Admin/Executive read broadly, Manager/Reviewer are forced to
    their own actor scope regardless of the filter they request. A real,
    independently-gated top-level nav item at `/audit` — Table 10 lists
    Audit as Administration page content, but that role's own RBAC is
    broader than Administration's owner/admin-only gate, so it wasn't
    folded in. AUD-03 (export, P1) is deferred. See `docs/ARCHITECTURE.md`
    for the full module writeup and `docs/DECISIONS.md` for every
    interpretation call.

## Phase 5 — Management view and data out

11. **Command Center** — PRD S04, the dashboard that makes every prior
    feature's exceptions/due-work visible in one place. **Complete.** The
    first `intelligence`-module feature — pure read-aggregation (counts and
    capped lists via `Promise.all`) across Partnership, Initiative, Action,
    Decision and Outcome; no new tables. No requirement table exists for
    S04 at all (DASH-01–06 is claimed but never appears in the §6
    backlog) — grounded instead in Table 10/31's screen spec and US-006
    (traces to PORT/RPT, not its own domain). KPI counts are always
    separately queried, never derived from the capped 10-row display
    lists. "Reviews due" reads `Partnership.nextReviewAt` directly, the
    field every prior feature already treats as authoritative, with a
    7-day due-soon window (no PRD-named cutoff exists). Integration health
    and finance-restricted data render their real absence (no
    `integrations` connection or finance object exists yet) via the same
    `EmptyState` "no blank dashboards" pattern (PRD §3.2) used elsewhere,
    not a faked result. This is the first feature to replace
    `apps/web/app/[locale]/(app)/page.tsx` wholesale — Command Center's nav
    item has pointed at `/` since the app shell was built, so the Phase-0
    placeholder page and its `home` translation namespace are both fully
    removed. RBAC borrows "Portfolio read"'s shape (Reviewer included,
    Guest excluded — Guest sees a lighter message at `/` rather than a
    hard Forbidden page, since it's every role's default landing page).
    See `docs/ARCHITECTURE.md` for the full module writeup and
    `docs/DECISIONS.md` for every interpretation call.
12. **Authorized CSV Export** — same row/field policy as the initiating user
    (PRD §2.2), logged as a material event. **Complete.** A cross-cutting
    mechanism (`common/csv.ts`'s shared `csvEscape`/`toCsv`, also now used
    by CSV Import's own error-file download), not a standalone screen —
    wired into three existing lists: Partnerships, Initiatives and Audit.
    Every export endpoint calls the exact same query its sibling JSON list
    route already calls, so exported rows can never drift from the UI
    (T-022's acceptance gate, satisfied by construction, not by a parallel
    implementation). `export_completed` is logged both as the PRD-named
    analytics event and a real audit event. Audit's own export closes
    AUD-03 (flagged P1/deferred when Audit was built) now that the general
    mechanism exists. Reviews/Decisions and Evidence/Outcomes exports are
    the same mechanism, not yet wired — a mechanical follow-up. See
    `docs/ARCHITECTURE.md` for the full writeup and `docs/DECISIONS.md`
    for every interpretation call.

This completes v1 — every item Phases 1 through 5 named. Phase 6 below
(branch `v2`) picks up the two Golden Workflows v1 deliberately deferred.

## Phase 6 — v2: Revenue-Share Pack and controlled external collaboration

Built on the `v2` branch. Two Golden Workflows the v1 scope deliberately
left for later (PRD §18's proof-gated evolution) — v1's own retained-
workflow, trusted-evidence and safe-sharing loop is what earns the right
to build these next, per the PRD's own "final build instruction" (Table
68). CRM integration beyond the first connector is **v3**, not v2 — every
item below stays connector-free, the same manual/CSV-first posture v1's
CSV Import already established for onboarding.

13. **Agreements and Commercial Rules** — PRD §6.8, S10, AGR-01/02/04/05
    (P0/R1) and RULE-01–04 (P0/Module). **Complete.** Not explicitly named
    in the user's v2 scope, but load-bearing regardless: CLM-02 requires
    every Partner Claim to link "one partner, revenue event **and
    applicable agreement/rule**" — Claims cannot exist without this first.
    `Agreement` (Captured → In Review → Effective → Amended → Suspended →
    Expired → Terminated, Table 13; `Effective`/`Amended` reachable only as
    the automatic, transactional side effect of approving a version, never
    set directly) and `Commercial Rule` (tenant-wide, no state machine of
    its own — Table 13 has no row for it) are both a genuine two-tier
    parent + versioned-child shape, the first entities in this codebase to
    need it. Each version is immutable once approved (INV-002 —
    corrections create a superseding version), and two approved siblings
    of the same parent can never have overlapping effective dates
    (AGR-02/RULE-03, checked at approval time). `Commercial Rule`'s
    condition/operator definition runs through a small, fixed, explainable
    DSL (`RULE_OPERATORS`, not arbitrary code) so RULE-04's "explain rule
    evaluation as inputs, conditions, result and version" stays safe and
    reproducible; RULE-02's "test against historical/sample events" is
    scoped to caller-supplied sample cases, since Revenue Event (the real
    historical data) doesn't exist yet. RBAC is its own §2.3 row — Reviewer
    holds approval authority here, not Owner/Executive as elsewhere. AGR-03
    (Obligations) is P1 and expected to defer, matching every prior P1 item
    across v1. This is also what finally gives the `agreements` nav item
    (`comingLater: true` since the app shell was first built) a real
    destination — plus its own `/agreements/rules` surface for Commercial
    Rules. See `docs/ARCHITECTURE.md` for the full module writeup and
    `docs/DECISIONS.md` for every interpretation call (including two bugs
    live QA caught: a missing child-row `version` column, and an ICU
    curly-brace parse failure in one translated hint).
14. **Revenue Event and Partner Claim** — PRD Golden Workflow C (FLOW-C),
    §6.9, S13, CLM-01–08 (all P0/Module). `Revenue Event` import stays
    manual/CSV-entry only, the same posture CSV Import already established
    — no connector exists yet (`integrations` stays reserved for v3) so
    nothing here can be a live sync. `Partner Claim`'s own state machine
    (Draft → Submitted → Evidence Check → Eligibility Review → Attribution
    Review → Approved/Rejected → Disputed → Closed, Table 13) is FLOW-C's
    spine: submit with evidence-completeness check (CLM-03), select the
    rule version effective on the *event* date per INV-007 (not the
    current rule version — a historical-reproduction requirement, T-012),
    calculate explainable eligibility with no silent default to eligible
    (CLM-05), allocate `Attribution` shares that reconcile to the
    configured total (CLM-06, T-013), and approve/reject with the decision
    snapshot frozen (CLM-08). Overrides preserve the original result
    alongside the override, per INV-008 — the same "preserve, don't
    overwrite" discipline Evidence's own replacement chain (EVD-04) already
    established in v1. The product **never emits a payment instruction** —
    only settlement-readiness/export status, per FLOW-C's own acceptance
    criteria; this is a hard constraint carried into the build, not a
    scope note to revisit later.
15. **Dispute workflow and Claim export** — the closing two steps of the
    user's own named chain ("→ dispute → export"). `Dispute` is its own
    Table-12 entity (reason, parties, owner, SLA, resolution) opened
    against a Claim already in the `Disputed` state; while open, "decision
    changes [are] blocked except for the assigned dispute workflow" (FLOW-C)
    — T-015 named explicitly ("Approve claim while dispute open" must be
    an invalid transition). CLM-09 is P1 in the PRD's own priority column,
    but named explicitly in the user's requested v2 chain, so it's in
    scope here rather than deferred like most other P1 items. Claim export
    reuses the exact CSV export mechanism item 12 already built
    (`common/csv.ts`, the same "export calls the identical list query"
    guarantee) — no new export infrastructure needed, just a new list to
    point it at.
16. **Share Grant** — PRD Golden Workflow D (FLOW-D), §6.10, SHR-01/02/03/
    04/05/06/08 (all P0/R1.1; SHR-07's "inventory of active grants" is P1
    and expected to defer). This is the mechanism **every v1 Guest-role
    cell has been waiting on already** — Partnerships, Initiatives,
    Reviews, Evidence & Outcomes and Audit all currently deny Guest
    outright with the same documented reason ("needs the Share Grant
    mechanism, not built"). Building this for real is expected to unlock
    (not just newly build) Guest access across those five already-shipped
    features, not only whatever v2 adds — worth treating as its own
    reviewable milestone before the guest-facing UI in item 17, given how
    many existing RBAC decisions it retroactively activates. Grant-time
    preview must exactly match what the guest actually receives (SHR-03,
    "preview and actual guest response contain the same authorized
    fields"); traversal to an unshared related object must be
    indistinguishable from not-found (INV-005, T-016 — "safe 404; no
    metadata leakage"); revocation must take effect within 60 seconds
    (SHR-05, T-017).
17. **External Guest workspace** — PRD Golden Workflow D, S14 (External
    share), the guest-facing surface itself: what a recipient sees and can
    contribute to once a grant exists (read/comment/contribute strictly
    per-object capability, SHR-04). Calendar/Teams links, richer reporting
    and controlled templates (all explicitly R1.1) are this item's own
    scope, not item 16's — they're presentation/collaboration surface
    built *on* the grant mechanism, not part of authorizing it.

## Later (v3 and beyond — explicitly not before the above, proof-gated per PRD §18)

- CRM integration beyond the first connector — real `integrations` module
  build-out (INT-01–06), live sync jobs, connector-driven Revenue Event
  import replacing the manual entry item 14 ships with.
- Cross-company intelligence, matchmaking, the shared partnership graph,
  benchmarking, partner marketplace, network monetization — PRD's own
  "final build instruction" (Table 68) names these explicitly as not
  before "the private control loop proves retained workflow, trusted
  evidence, safe sharing and paid customer value."

## Ground rules carried from the PRD (apply to every phase above)

- Server-side authorization and tenant scoping on every mutation — no
  exceptions, no "we'll add the check later" (PRD AUTH-01/02).
- Every screen has explicit loading, empty, error, forbidden, conflict,
  success and destructive-confirmation states before it ships (PRD §15.2).
- English complete; Arabic/RTL impact assessed and critical flows tested,
  every time (PRD §15.3 Definition of Done).
- No feature ships without acceptance criteria, denial/error paths, and tests
  at the appropriate level (PRD §15.3).
