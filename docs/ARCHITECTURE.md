# Architecture

## Repository layout

```
revn/
├── apps/
│   ├── web/     Next.js 16 App Router — the product UI (English/Arabic RTL)
│   └── api/     NestJS 12 modular monolith — the HTTP API
├── packages/
│   ├── ui/      Design system — tokens are consumed, components are shared
│   ├── db/      Prisma schema, migrations, generated client
│   └── config/  Shared TypeScript/ESLint/Tailwind configuration
└── docs/        This file, brand + product understanding, decision log
```

Nothing in `packages/` is published anywhere — these are internal workspace
packages (`workspace:*`), resolved directly from source by pnpm/Turborepo.

## Why a monorepo, why these apps

The PRD (§10.1) decides a **backend modular monolith** — one deployable
application, not microservices — because the MVP's real risks are workflow
correctness, tenant isolation, evidence traceability and integration
reliability, not independent service scaling. That decision is about the
_backend's internal boundaries_, not about repository layout: the frontend and
backend are still two separate deployables (a Next.js app and a Fastify
process) because they scale, deploy and release on different cadences, and
because `packages/ui` needs to be usable by both `apps/web` today and the
external guest workspace planned for R1.1 (PRD §6.10) without duplicating
components.

## `apps/api` — modular monolith internals

`apps/api/src/modules/` holds one folder per domain module from PRD §10.3.
Most are still reserved (a `README.md` describing what they'll own and depend
on, nothing else); `identity-tenant` is fully built — Authentication,
Tenant/Organization and Roles/Permissions (RBAC) — and is where every other
module's own capability checks build on `RoleGuard`. `portfolio` has Partner,
Partnership and CSV Import built; program/taxonomy/health-formula are next.
`execution` has Initiative/Milestone/Action and Review/Decision built;
workspace/plan are next; `evidence-outcomes` has Contribution/Evidence/
Outcome built; `audit-operations` has Audit built; `intelligence` has the
Command Center dashboard built (see `docs/ROADMAP.md`):

```
identity-tenant   → Tenant, membership, role, auth policy, support access — built (Authentication, Tenant/Organization, RBAC)
portfolio         → Partner, partnership, import, program, taxonomy, health — Partner, Partnership and CSV Import built; program/taxonomy/health-formula not yet
execution         → Workspace, plan, initiative, milestone, action, review, decision — Initiative/Milestone/Action and Review/Decision built; workspace/plan not yet
commercial-governance → Agreement, obligation, rule version — reserved
evidence-outcomes → Contribution, evidence, outcome, verification — built (Evidence, Outcome, and Verification)
revenue-share     → Revenue event, claim, eligibility, attribution, dispute — reserved
sharing           → Grant, guest, field policy, external access — reserved
integrations      → Connection, mapping, sync job, dead letter — reserved
intelligence      → Metrics, derived signals, reports (read models only) — dashboard built (Command Center); ecosystem-graph scoring spike (unwired, see docs/ecosystem-graph/); other read models not yet
audit-operations  → Outbox, audit, exports, support tooling — audit built (Audit Timeline and Audit Search); outbox/exports/support tooling not yet
```

The dependency rule from the PRD table: a module may depend on the modules
listed in its README, and only through their public (exported) providers —
never by reaching into another module's internal files. `identity-tenant` has
no dependents restriction (everything may depend on it); `audit-operations`
is depended on by everything (every module writes audit events through it).

When a module goes from reserved to real, it becomes a proper Nest `@Module`
registered in `apps/api/src/app.module.ts`, with its own controllers,
services, DTOs and a `*.module.ts` — following the shape already established
by `src/health/`.

### Cross-cutting infrastructure that already exists

- **Environment validation** (`src/common/config/env.validation.ts`) — a Zod
  schema fails startup immediately if `DATABASE_URL` or `API_PORT` are missing
  or malformed, rather than failing confusingly later.
- **Correlation IDs** (`src/common/correlation-id.ts`, wired as a Fastify
  `onRequest` hook in `main.ts`) — every request gets a correlation id
  (reusing the caller's `x-correlation-id` header if present), echoed back on
  the response and available to the exception filter. This is what PRD
  §8.4/§10.4 requires every error payload and audit event to carry.
- **Error shape** (`src/common/filters/http-exception.filter.ts`) — every
  thrown error is normalized to `{ code, message, field_errors?,
correlation_id, retryable }`, matching PRD §8.3/§8.4's illustrative payload.
  `field_errors` comes from the global `ValidationPipe`'s custom
  `exceptionFactory` (`src/common/validation-exception-factory.ts`), which
  maps class-validator's per-property errors to `{ field, code }` pairs.
- **Health checks** (`src/health/`) — `/health` (liveness, no dependencies)
  and `/health/ready` (readiness, checks Postgres via a raw `SELECT 1`). Both
  are `@Public()` — see Authentication below.
- **OpenAPI docs** — auto-generated at `/docs` from `@nestjs/swagger`
  decorators.

### Authentication (`modules/identity-tenant/auth/`)

Custom-built (not a third-party auth provider or Auth.js) — see
`docs/DECISIONS.md` for why. Email/password only for now; the architecture
doesn't preclude adding an OIDC/SAML provider later, but nothing here assumes
one.

- **Access is a short-lived JWT** (15 min, `JwtService`, secret from
  `JWT_ACCESS_SECRET`), **refresh is an opaque random token** (30 days,
  SHA-256-hashed before it touches the database — `RefreshToken` in
  `packages/db/prisma/schema.prisma`), **rotated on every use** (the presented
  refresh token is revoked whether or not rotation succeeds). Both live in
  `httpOnly`, `SameSite=Lax` cookies (`auth.cookies.ts`) — never in
  `localStorage`, never returned in a JSON body.
- **`JwtAuthGuard` is registered as `APP_GUARD`** in `identity-tenant.module.ts`
  — every route requires a valid `access_token` cookie by default (PRD §2.2's
  deny-by-default doctrine), unless the handler or controller carries
  `@Public()` (`auth/decorators/public.decorator.ts`). `@CurrentUser()`
  reads the verified claims the guard attached to the request.
  `HealthController` is `@Public()` for exactly this reason.
- **Server-side route gating in `apps/web`** doesn't verify the JWT locally —
  `src/lib/auth/session.ts`'s `getCurrentUser()` forwards the incoming
  request's cookies to the API's `/auth/me` instead, so token verification has
  exactly one implementation. `app/[locale]/(app)/layout.tsx` calls it and
  redirects to `/sign-in` when it returns `null`; the `(auth)` pages call
  it the other way around (redirect home if already signed in).
- **Password reset has no real email provider yet** — `mail/mailer.service.ts`
  logs the reset link instead of sending it (a documented placeholder, see
  `docs/DECISIONS.md`). Resetting a password revokes every refresh token for
  that user, so a stolen session doesn't survive the owner regaining control.
- **`fastify` is pinned to an exact version** to keep `@fastify/cookie`
  type-compatible with `@nestjs/platform-fastify`, and
  **`@typescript-eslint/consistent-type-imports` is off** in this app —
  both explained in `docs/DECISIONS.md`, both load-bearing (the second one
  guards against a real "Nest can't resolve dependencies" boot crash, not a
  style preference).

#### Silent session renewal — read this before touching auth

A 15-minute access token with nothing to renew it is a real bug, not a detail:
without renewal, every session stops working 15 minutes after sign-in — live
testing while building Tenant/Organization reproduced exactly this (a form
submit 401'd mid-session). There are **two independent renewal paths**,
because a client-side call never goes through the Next.js proxy and a full
page load never goes through the browser's `fetch`:

- **Page loads** — `apps/web/proxy.ts`. Before next-intl's own middleware
  runs, it checks the incoming request for `access_token`; if that cookie is
  missing (the browser stops sending an expired one) but `refresh_token` is
  present, it calls the API's `/auth/refresh` server-to-server, rewrites the
  _current_ request's `Cookie` header so this same render sees a valid
  session (`NextRequest(request, { headers })`, not just the outgoing
  response — Server Components read the incoming request, not what
  middleware writes back), and appends the new `Set-Cookie` headers to the
  response for the browser to store.
- **Client-side calls** — `src/lib/api/client.ts`'s `apiFetch`. On a 401 from
  anything outside `/auth/*`, it calls `/auth/refresh` once (the browser's own
  cookie jar picks up the new cookies automatically via `credentials:
'include'`) and retries the original request exactly once.
  `/auth/*` responses are excluded on purpose — a 401 from `/auth/sign-in` is
  a business outcome (wrong password), not an expired session, and retrying
  it would be wrong.
- The actual cookie/header logic behind both (`refreshSession`,
  `cookieValueFrom`, `withReplacedCookie`) lives in
  `src/lib/auth/silent-refresh.ts` so it has one implementation and one set of
  tests (`apps/web/tests/silent-refresh.test.ts`,
  `apps/web/tests/api-client.test.ts`) instead of being duplicated between
  the two call sites.
- If you shorten `ACCESS_TOKEN_TTL_SECONDS` to verify this by hand, revert it
  before committing — see the git history for how this was tested live.

### Tenant / Organization (`modules/identity-tenant/tenants/`)

`Tenant` and `Membership` (PRD §4.2), in the same module as Authentication —
they're one PRD §10.3 boundary, not two. `role` grew from a placeholder
`OWNER`/`MEMBER` into the real PRD §2.3 tiers once RBAC landed (see below).

- **One active membership per user, for now.** The schema doesn't forbid a
  user holding memberships in more than one tenant (`Membership` is a proper
  join table), but this phase's UI only handles the single-tenant path —
  there's no tenant switcher. `TenantsService.findForUser` returns the
  earliest-created active membership; `create()` rejects a second tenant for
  a user who already has one (`ConflictException`). Invitations (RBAC,
  below) are the one way a legitimate second membership _could_ exist, but
  they only cover a brand-new email — a user who already has an account
  still can't be added to a second tenant this way.
- **Slugs are generated, not chosen** (`tenants/slugify.ts` + a
  find-or-suffix loop in `uniqueSlug`) — ASCII-only, so a non-Latin org name
  falls back to `organization`, `organization-2`, etc. Fine for now: nothing
  reads the slug for routing yet (no subdomain-per-tenant), it only needs to
  be a stable unique identifier.
- **Onboarding is a third route group**, `app/[locale]/(onboarding)/`,
  sibling to `(auth)` and `(app)`. Its `layout.tsx` gates the other direction
  from `(app)`'s: no user → `/sign-in`; user **with** a tenant → `/` (skip
  onboarding, don't let a settled user land back on "create your
  organization"). `(app)/layout.tsx` gates the missing piece — user but no
  tenant → `/create-organization` — so between the two, every combination of
  (signed in?, has a tenant?) has exactly one home.
- **`TenantsService.update` no longer checks the caller's role itself** —
  the controller route carries `@RequireRole('OWNER', 'ADMIN')` and
  `RoleGuard` (RBAC, below) enforces it before the handler runs. Authorization
  lives in exactly one place now, not duplicated between guard and service.
- **`(auth)` and `(onboarding)` share one presentational layout**,
  `src/components/CenteredCardLayout.tsx` (wordmark + card + locale
  switcher) — each route group supplies its own gate logic on top; the
  layout itself has no opinion about who's allowed to be there.
- **`AppShell` now takes real `tenant`/`role` props** (from `(app)/layout.tsx`,
  which fetches both user and tenant before rendering it) — the tenant name
  renders in `TopNav`'s `tenantSlot` (a static badge, not a dropdown; there's
  nothing to switch between yet) and the role renders next to the user's
  email in the sidebar footer.

### Roles and Permissions / RBAC (`modules/identity-tenant/{tenants/guards,members,invitations}/`)

PRD §2.3's MVP capability matrix, §2.2's deny-by-default doctrine, and
ADM-02/03. `Membership.role` is now the full six-tier enum: `OWNER`,
`ADMIN`, `EXECUTIVE`, `MANAGER`, `REVIEWER`, `GUEST` — Owner split out of the
matrix's "Admin" column because ADM-03's "prevent removal of the final
active Tenant Owner" invariant needs Owner to be a real, distinct value.
**One deliberate reading of the source PRD table**: the "Tenant/configuration"
row lists "Executive" under the Executive column, which every other role in
that row reads as a plain "No" — treated as a copy-paste artifact and
implemented as "No" (§2.1 explicitly says Executive's job excludes "routine
data administration"), not as a real capability grant. See `docs/DECISIONS.md`.

- **`RoleGuard` + `@RequireRole(...roles)`** (`tenants/guards/role.guard.ts`,
  `tenants/decorators/require-role.decorator.ts`) is the mechanism every
  future domain module (Portfolio, Execution, ...) will build its own
  capability checks on. It's an **explicit allow-list per route, not a
  "minimum rank"** — the matrix's roles aren't a total order (Executive and
  Manager have different capability _shapes_ for the same row, not one
  strictly above the other), so a ranked hierarchy would misrepresent it.
  Applied via `@UseGuards(RoleGuard)` per-controller (unlike `JwtAuthGuard`,
  it's not global — most routes don't carry a role restriction yet). It
  reads the caller's membership in the **`:tenantId` route param specifically**
  (not just "the caller's own tenant"), so it doubles as tenant-isolation
  enforcement (AUTH-01): a user with no membership in that tenant is denied
  the same way as one with the wrong role. Every denial logs a structured
  warning (AUTH-05) before throwing `ForbiddenException`.
- **Members** (`members/`) — list, and change a member's role/status
  (`ACTIVE`/`SUSPENDED`/`REMOVED`), owner/admin only. `MembersService.update`
  enforces ADM-03's invariant: demoting, suspending or removing the tenant's
  _last_ active Owner is rejected (`ConflictException`) regardless of who's
  asking — checked by counting other active Owners, not by comparing to the
  caller.
- **Invitations** (`invitations/`) implement ADM-02 for exactly one path: a
  brand-new email with no existing `User`. Inviting an email that already
  has an account is rejected — merging an invitation into an existing
  account is out of scope for this phase. The accept flow
  (`AuthService.acceptInvitation`) creates the `User`, the `Membership`
  (with the invited role) and marks the invitation accepted in one
  transaction, then signs the new user in directly — no separate
  onboarding step, since they're joining an _existing_ tenant. A
  `GET /auth/invitations/:token` preview endpoint (public) lets the
  accept-invite page show "join {tenant} as {role}" before asking for a
  password.
- **Token hashing is shared, not reimplemented a third time** —
  `src/common/opaque-token.ts` (`generateOpaqueToken`/`hashToken`) factors
  out what `RefreshToken` and `PasswordResetToken` already did inline in
  `auth.service.ts`; `Invitation` reuses it rather than adding a fourth
  copy of the same SHA-256-hash-only-storage logic.
- **Web**: `AppShell` hides the "Administration" nav item entirely for
  non-owner/admin roles (rather than showing it and then a Forbidden page)
  — the route itself still enforces this server-side for anyone linking in
  directly, via the same role check the page uses to decide whether to
  render `<ForbiddenState>` instead of the real content
  (`app/[locale]/(app)/administration/page.tsx`). The Administration page's
  mutations (`AdministrationContent.tsx`) call the API then `router.refresh()`
  on success rather than maintaining separate client-side mirrored state —
  the Server Component re-fetches fresh data from the API on every refresh,
  so there's exactly one source of truth for what's rendered.
- **Two real bugs live only in `docs/DECISIONS.md`, not fixed by any
  automated test** — both found by actually clicking through the
  Administration page, not by `curl` or unit tests: `@fastify/cors`'s
  method allowlist defaulting to `GET,HEAD,POST` (silently blocking every
  `PATCH`/`DELETE` route in a browser while `curl` never noticed), and
  `apiFetch` throwing on a `201`-with-empty-body response because it only
  special-cased `204`. Read that section before assuming "it works from
  curl" means "it works from the browser," or before adding another
  empty-body response.

### Partner (`modules/portfolio/partners/`)

The first genuinely new PRD §10.3 module boundary (`portfolio`) — everything
before this landed inside `identity-tenant`. Also **the first table where
every PRD §4.1 data-modeling rule actually applies** — `User`, `Tenant`,
`Membership` and `Invitation` each had a specific reason to skip one or more
of them (see their own sections above); `Partner` skips none: `tenant_id`,
`created_at/by`, `updated_at/by`, `version`, and a lifecycle status.

- **Optimistic concurrency is enforced in the `WHERE` clause, not by a
  separate read-then-compare** (`PartnersService.update`) —
  `prisma.partner.update({ where: { id, tenantId, version }, data: {
version: { increment: 1 }, ... } })`. If the submitted `version` doesn't
  match, zero rows match the `where` and Prisma reports "record not found"
  (`P2025`) atomically; there's no window between checking the version and
  writing where a second request could interleave. `get()` (a plain
  `findFirst`) runs _before_ the versioned update specifically so a
  nonexistent `partnerId` reports 404 — without that ordering, a missing
  row and a version mismatch are both "zero rows matched" and
  indistinguishable, which would misreport a bad id as a 409 conflict
  instead of a 404. This is the shape every later module with a mutable,
  concurrently-edited object (Partnership, Initiative, Agreement, ...)
  should copy.
- **`identifiers` is a free-form JSON map and `segment` is plain text, not
  an enum** — PRD §4.2 names "identifiers" (plural) without specifying a
  scheme (VAT number? DUNS? a platform-specific id?), and a controlled
  segment taxonomy is ADM-05 (P1, not built). Inventing either now would be
  guessing at a decision the PRD explicitly leaves open; CSV Import
  (Roadmap Phase 2, item 6) is what will actually populate `identifiers`
  from a real source system. **The current web form doesn't expose
  `identifiers` at all** for the same reason — the field exists in the
  schema because the PRD requires it to exist, not because there's a UI
  decision to make about it yet.
- **No PRD matrix row is named "Partner"** — only "Portfolio read" (Yes for
  Admin/Executive/Manager, "Scoped" for Reviewer, "Shared only" for Guest)
  and "Partnership edit" (Yes/Approve/Yes/No/Shared fields). This module's
  `RoleGuard` usage is a documented interpretation, not a literal table
  lookup: read is open to everyone except Guest (whose "shared only" needs
  the Share Grant mechanism, R1.1, not built — hidden from Guest entirely,
  both in `AppShell`'s nav and the page's own guard, rather than showing an
  item that could only ever list empty); write follows "Partnership
  edit"'s shape (Owner/Admin/Manager; Executive's "Approve" isn't a
  workflow this phase builds, so Executive is read-only for now, same as
  Reviewer). See `docs/DECISIONS.md`.
- **Duplicate legal names within a tenant are blocked by a DB unique
  constraint** (`@@unique([tenantId, legalName])`), not application logic —
  a light guard ahead of real dedup (CSV Import's actual job, Roadmap
  Phase 2 item 6, PRD FLOW-A).
- **`Prisma` is now re-exported as a value from `@revn/db`**
  (`packages/db/src/index.ts`), not just via `export type *` — needed for
  `instanceof Prisma.PrismaClientKnownRequestError` to tell a real
  constraint violation (unique, or the "record not found" a version
  mismatch produces) apart from any other thrown error. Every later
  module doing its own optimistic-concurrency or unique-constraint
  handling reuses this same import, not a private copy.
- **Web**: no new top-level nav entry — PRD §3.1's own primary-navigation
  table places "partner profiles" _inside_ the existing "Partnerships"
  surface ("Searchable portfolio, saved views, **partner profiles**,
  programs and lifecycle state"), so this reuses the `partnerships` nav
  item (previously `comingLater`) rather than inventing IA the PRD didn't
  specify. `PartnershipsContent.tsx` follows the same call-the-API-then-
  `router.refresh()` pattern as Administration — no separate client-side
  mirrored state.

### Partnership (`modules/portfolio/partnerships/`)

The governed relationship itself — PRD §4.3's state machine, its activation
invariant, and PORT-01/03/04 (list, create, controlled transitions). One
Partnership per Partner for this phase (see `docs/DECISIONS.md`'s INV-001
note) — nested under it at `tenants/:tenantId/partners/:partnerId/partnership`
(`partnerships.controller.ts`), plus a tenant-wide list route at
`tenants/:tenantId/partnerships` (`partnerships-list.controller.ts`, a
separate controller class only because a Nest controller carries one fixed
path prefix and PORT-01's list isn't nested under a single partner).

- **The state machine is an enforced transition graph
  (`PartnershipsService`'s `VALID_TRANSITIONS`), not just a status field** —
  every `PATCH` that changes `stage` is checked against it before anything
  is written, and an illegal move (skipping a stage, moving out of a
  terminal stage) is a 422, not a silent acceptance. The graph itself
  includes recovery moves (Active ⇄ At Risk ⇄ Paused) that PRD Table 13's
  own arrow-chain never draws — see `docs/DECISIONS.md` for why that's a
  deliberate, documented reading rather than a literal one.
- **Field requirements are gated by target stage, not by a `NOT NULL`
  column** — `owner_id` from Qualified onward, and
  `motion`/`objective`/`cadence`/`health`/`next_review_at` for Active (and
  its At Risk/Paused siblings), exactly matching PRD Table 67's per-field
  `Required` column. The check runs against the _merged_ result of the
  request's new fields and the record's existing ones, so a client can
  either fill in readiness fields ahead of time or supply them in the same
  request as the transition that needs them (this is what lets the "Move to
  Active" button double as "finish the activation checklist and activate").
  A stage-changing request that would land on an under-filled stage is a
  422 naming exactly which fields are missing — same pattern as the
  transition-graph check, checked in `PartnershipsService.update` before
  any write is attempted.
- **`PartnershipsService.create` is a separate endpoint from `update`**
  (`POST` vs `PATCH` on the same nested route) rather than "creation is just
  an update with no prior row" — a Partnership doesn't exist until this
  call succeeds, so there's no `version` to check yet, and PORT-03's create
  fields (owner, sponsor, motion, objective, cadence) are all optional
  since a brand-new relationship starts at Prospect, where nothing is
  gated yet.
- **PORT-04's "transition reasons ... enforced"** is implemented as: a
  non-empty `transitionReason` is required only when moving into At Risk,
  Paused or Terminated (the exception/exit transitions), not for ordinary
  forward progress. Only the latest transition's reason is kept
  (`lastTransitionReason`) — a full audit trail of every transition is
  Audit Timeline's job (Roadmap Phase 4), not this table's.
- **The RBAC row was independently re-checked, not assumed from Partner** —
  "Partnership edit" is now a real matrix row (Partner had to borrow it).
  It lands on the same Owner/Admin/Manager-write, Executive/Reviewer-read,
  Guest-none shape Partner already used, but that was verified against the
  actual row this time; see `docs/DECISIONS.md`.
- **A members "directory" endpoint** (`GET
/tenants/:tenantId/members/directory`, added to the existing
  `MembersController` with a method-level `@RequireRole` override of the
  controller's own owner/admin-only default) returns just `{id, name,
email}` for every ACTIVE member, open to the same read roles as the
  portfolio itself — needed so the owner/sponsor picker on a Partnership
  doesn't require Administration-only access just to populate a dropdown.
- **The two PRD-named analytics events** (`partnership_created`,
  `partnership_activated`) are logged via `Logger`, structured exactly as
  the PRD's event schema specifies — see `docs/DECISIONS.md` for why that's
  the right amount of infrastructure for now (a real events pipeline is
  Phase 4 territory) rather than either building a pipeline or dropping the
  requirement silently.
- **Web**: the existing `/partnerships` page (still the Partner list) grew a
  Stage and Health column (joined client-side against a tenant-wide
  Partnership list) and a "Relationship" action per row, opening a dialog
  that doubles as both the create form (no Partnership yet) and the manage
  form (owner/sponsor/motion/objective/cadence/health/next-review, plus
  buttons for every currently-valid transition, with an inline reason field
  that appears only for the transitions that need one). `VALID_PARTNERSHIP_TRANSITIONS`
  is duplicated (by hand) in `apps/web/src/lib/partnerships/types.ts` purely
  to decide which transition buttons to render — the server re-validates
  every transition regardless, so a drift between the two only ever shows a
  button that then 422s, never a bypass.

### CSV Import (`modules/portfolio/imports/`)

PRD Golden Workflow A (FLOW-A) and S03, the import wizard — Roadmap Phase 2
item 6. `ImportBatch`/`ImportRow` implement IMP-02's "staging batch"
requirement literally (no entity for this exists in PRD Table 12 — see the
migration note in `schema.prisma`); a batch never writes a Partner/
Partnership until it's explicitly committed.

- **The pipeline is upload → map → commit, each its own endpoint** — `POST
.../imports` (multipart, parses and stages rows only), `PATCH
.../imports/:id/mapping` (sets the source-column-to-field mapping and
  recomputes every row's disposition), `POST .../imports/:id/commit`
  (writes the actual Partner/Partnership records). Nothing is written to
  `Partner`/`Partnership` before commit — IMP-02's "do not write domain
  objects during upload or mapping" is enforced by the pipeline shape
  itself, not a flag.
- **Dedup runs at mapping time, not commit time**, so the preview the user
  reviews is the actual disposition that will be committed:
  `ImportsService`'s `evaluateRows` checks each row's normalized legal name
  against existing partners and every earlier row in the same file (exact
  match → `UPDATE`; in-batch repeat → `SKIP`), then a mapped domain against
  existing partners' domains (`SKIP`, "probable duplicate"); no match →
  `CREATE`. See `docs/DECISIONS.md` for why this is the right amount of
  "explainable match reasons" (IMP-05) without a fuzzy-matching engine.
- **Commit is per-row, not one all-or-nothing transaction** — FLOW-A
  explicitly allows partial commit. Each `CREATE` row's Partner+Partnership
  pair is written in its own `prisma.$transaction` (atomic for that one
  row); a row that fails at commit (e.g. a same-batch race) is recorded as
  `REJECT` with a reason rather than failing the whole batch. `UPDATE` rows
  patch the matched existing Partner directly, no Partnership involved.
- **Idempotency (T-003) comes from the batch's own state**: `commit` checks
  `status === 'COMMITTED'` first and, if so, returns the existing result
  immediately — no reprocessing, no `Idempotency-Key` cache infrastructure.
  See `docs/DECISIONS.md`.
- **A committed row starts its Partnership at Prospect — never Active.**
  Activation is the separate, already-built manual flow (the "Relationship"
  dialog on `/partnerships`); import populates the portfolio, a human
  activates each relationship per FLOW-A's own later steps.
- **File upload uses `@fastify/multipart` + `@Req()` raw injection**, not
  Nest's `@UploadedFile()`/`FileInterceptor` decorators — those are
  Express/multer-shaped and don't fit Fastify's multipart model the same
  way. `main.ts` registers the plugin with a `fileSize` limit; the
  controller calls `request.file()` directly and checks `data.file.truncated`
  for a `413`. CSV parsing is `csv-parse` (handles quoting/embedded commas
  a hand-rolled `split(',')` would break on), not hand-written.
  RBAC/tenant-scoping still flow through the same `RoleGuard` + route
  params as every other route — multipart bypasses the JSON `ValidationPipe`
  for the file itself, not authorization.
- **Web**: a dedicated route (`/partnerships/import`), not a modal — a
  table-heavy multi-step wizard needs more room than a `Dialog`, and PRD
  §3.1's surface table doesn't name Import as its own top-level nav item, so
  it's reached only via a button on the existing Partnerships page (visible
  to Owner/Admin only, matching the narrower import RBAC). `StepChips`
  (already in `packages/ui`, previously unused) drives the four-step
  progress indicator. The rejected-rows CSV is a plain `<a href>` to the
  API route rather than a fetch-and-blob download — a top-level GET
  navigation still carries the session's `httpOnly` cookies cross-origin
  (cookie attachment isn't subject to CORS the way `fetch`/XHR reads are),
  so this works for a file download without extra client code.

### Initiative, Milestone, Action (`modules/execution/`)

The first `execution`-module feature — PRD §5.2 Golden Workflow B's first two
primary-flow steps and S07, the Initiative workspace. Three route folders
(`initiatives/`, `milestones/`, `actions/`) share one `execution.module.ts`;
Milestone and Action are always nested under `.../initiatives/:initiativeId/`
since neither has an independent top-level list.

- **`Milestone` and `Blocker` aren't separate PRD-Table-12 entities** —
  Milestone is Initiative's own child object (INIT-02), and "Blocker" (the
  roadmap item's fourth noun) is just Action's `BLOCKED` status plus a
  reason field (INIT-04, Table 13). See `docs/DECISIONS.md` and the
  `schema.prisma` migration note before assuming either needs its own CRUD
  surface.
- **Both state machines (`InitiativesService`, `ActionsService`) allow a
  recovery move Table 13 never draws** — Active⇄Blocked for Initiative,
  In Progress⇄Blocked for Action — the same documented deviation as
  Partnership's Active⇄At Risk. Cancelled/terminal exits are reachable from
  any non-terminal state, not only the state right before them.
- **The completion gate is T-007 and FLOW-B's acceptance criterion,
  implemented literally**: `InitiativesService.update` requires
  `completionDisposition` (standing in for INIT-07's "outcome disposition" —
  the real `Outcome` entity is Phase 4, not built) and
  `remainingActionsTreatment` to move `stage` to `COMPLETED`; a still-
  `BLOCKED` child Action additionally requires a non-empty
  `completionOverrideReason`, or the transition is rejected with a 422
  naming exactly that. `remainingActionsTreatment: CANCEL_REMAINING` bulk-
  cancels `OPEN`/`IN_PROGRESS` actions inside the same `$transaction` as the
  completion write; `BLOCKED` actions are never touched by this choice —
  only by the override.
- **Action assignment accepts a tenant member OR a free-text external
  counterpart name** (`assigneeUserId` xor `assigneeExternalName`,
  service-validated — at least one required, an internal id checked against
  ACTIVE memberships) — INIT-03/Table 67's "members or referenced
  counterpart owners," with no external-contact entity to link to instead.
- **RBAC is genuinely different from every module built so far**: §2.3's
  "Initiatives/actions" row denies Reviewer entirely (`Yes`/`Read`/`Yes`/
  **`No`**/`Shared items` for Admin/Executive/Manager/Reviewer/Guest) —
  unlike "Portfolio read," which gives Reviewer a scoped view. Both the
  `AppShell` nav item and every route's `READ_ROLES` exclude Reviewer, not
  just Guest.
- **Web**: `/initiatives` is a real, dedicated top-level nav surface (Table
  10 names it directly), not a reused one — the Phase 0 `comingLater`
  placeholder is now a real route. `/initiatives/[initiativeId]` is the S07
  workspace: header (objective/stage/health/success measure) with inline
  stage-transition buttons (mirroring Partnership's dialog pattern, but as a
  full page rather than a modal, since milestones/actions need real room),
  a Milestones card (create + a simple complete/reopen toggle — no field-
  editing UI yet, a deliberate scope cut), and an Actions card (create + a
  per-row "Update" dialog handling status transitions, the blocker-reason
  prompt, and completion notes).

### Review and Decision (`modules/execution/reviews/`, `modules/execution/decisions/`)

The second `execution`-module feature — PRD §5.2 Golden Workflow B's middle
steps and S08/S09. `Action` is shared with Initiative rather than duplicated
— see the Initiative section above and `docs/DECISIONS.md` for the refactor
this required (`Action.initiativeId` now optional, `Action.reviewId` added,
Action updates moved to a flat `PATCH /tenants/:tenantId/actions/:actionId`
usable from either parent).

- **Review's state machine has no documented deviation from Table 13** —
  the only one of the four state machines built so far (Partnership,
  Initiative, Action, Review) that doesn't add a PRD-undocumented recovery
  move, because nothing in the PRD suggests Review has an equivalent
  "stuck" state. `Scheduled → In Preparation → In Progress → Completed` is
  taken exactly as literal as Table 13 draws it; `Reopened` is a real enum
  value with no transition reaching it yet (REV-06, P1, deferred).
- **The Scheduled → In Preparation transition captures a real snapshot
  server-side** (`ReviewsService.captureSnapshot`) — the partnership's
  current stage/health/next-review plus every linked initiative's id/
  objective/stage/health, stored under a freshly generated `snapshotId`
  (Table 67: the snapshot needs its own unique identifier, not a reuse of
  the review's own id).
- **The completion gate (T-008) is a flat block, not an overridable one** —
  unlike Initiative's T-007 gate, completing a review with a still-
  `PENDING_APPROVAL` decision or a still-open follow-up action linked to it
  returns a 422 naming exactly how many of each, with no override path (no
  PRD text describes one for Review the way it does for Initiative).
  Completing successfully requires `nextReviewAt` and propagates it onto
  the parent Partnership's own `nextReviewAt` field in the same
  `$transaction` — the concrete mechanism behind "next cadence handling."
- **Decision's approval workflow is DEC-02/INV-004 implemented literally**:
  `requiresApproval` gates whether a decision starts `RECORDED` (terminal)
  or `PENDING_APPROVAL`; only `APPROVE_ROLES` (`OWNER`, `EXECUTIVE` — Admin
  is deliberately excluded, since its own matrix cell is "Configure," not
  "Approve," unlike every other module where Admin is bundled with Owner)
  can move a pending decision to `APPROVED`/`REJECTED`, and never its own
  creator, checked before the role check even runs. The single flat
  `PATCH /tenants/:tenantId/decisions/:decisionId` route is reachable by the
  union of "draft/record" and "approve" roles; `DecisionsService.update`
  itself enforces the finer-grained split a route-level guard can't express
  (an Executive may approve/reject but not edit plain fields; the reverse
  for Owner/Admin/Manager).
- **Web**: no new top-level surface for Decisions — S09 is reached only from
  within a Review's workspace (`/reviews/[reviewId]`), matching how the
  screen inventory describes it as a record-creation flow, not a portfolio
  list. `/reviews` (Table 10 names it as its own nav surface, borrowing
  Initiative's RBAC) lists reviews across every partnership; the workspace
  page adds Decisions and Follow-up Actions cards alongside the same
  header/stage-transition pattern Initiative established, reusing the
  shared `AddActionDialog`/`UpdateActionDialog` components
  (`src/components/actions/ActionDialogs.tsx`) parameterized by `reviewId`
  instead of `initiativeId`. Approve/Reject buttons on a pending decision
  are only rendered for `OWNER`/`EXECUTIVE` sessions — verified live that an
  Admin session correctly sees neither button, and that a direct API call
  from that session is still rejected server-side regardless.

### Evidence, Outcome, and Verification (`modules/evidence-outcomes/`)

The first (and only) feature in the `evidence-outcomes` module boundary —
PRD §5.2 Golden Workflow B's closing steps and S11/S12. Three models:
`Contribution` (the claim of observed work, linked to a partnership,
initiative, action or outcome), `Evidence` (the provenance-linked file or
reference proving a contribution or, directly, an outcome's verification),
and `Outcome` (the claimed-and-verified result itself). Three services —
`ContributionsService`, `EvidenceService`, `OutcomesService` — each with
its own flat controller at `/tenants/:tenantId/{contributions,evidence,
outcomes}`.

- **Contribution and Evidence both use the "at least one of several
  optional links" shape** already established by Action
  (`initiativeId`/`reviewId`) and Decision (`partnershipId` required plus
  optional `reviewId`/`initiativeId`): Contribution needs one of
  `partnershipId`/`initiativeId`/`actionId`/`outcomeId`; Evidence needs one
  of `contributionId`/`outcomeId` — the direct outcome link exists
  specifically so INV-003 ("an outcome cannot be Verified without at least
  one accessible evidence record") can be checked with a plain
  `Evidence.count({ outcomeId })` query, without requiring evidence to
  always route through a Contribution first.
- **Outcome's state machine reads Table 13's chain as a reachability list,
  not a strict sequence.** `OutcomesService`'s `VALID_TRANSITIONS`:
  `DRAFT → [SUBMITTED]`, `SUBMITTED → [VERIFIED, REJECTED,
VERIFICATION_REQUIRED]`, and the one added recovery move —
  `VERIFICATION_REQUIRED → [SUBMITTED]` — the same "stuck state" pattern
  Partnership/Initiative/Action already established, needed because OUT-03
  requires a verifier to be able to bounce an outcome back for more
  evidence and have the manager resubmit it. `VERIFIED`/`REJECTED` are
  terminal; `SUPERSEDED` is a real enum value with no transition reaching
  it yet (OUT-04, P1, deferred — same treatment as `ReviewStage.REOPENED`).
- **Verification's separation-of-duties gate mirrors Decision's DEC-02
  pattern exactly**: `OutcomesService.update` checks `current.createdById
!== actingUserId` before the role/assignment check, for all three
  verifier decisions (Verify/Reject/Request more evidence) — never the
  outcome's own creator, satisfying T-010. For a `REVIEWER` specifically,
  it further checks `current.verifierId === actingUserId` (the "Verify if
  assigned" capability from §2.3's own matrix cell); `OWNER`/`ADMIN` bypass
  that assignment check, matching "Admin" beating a narrower role's gate
  everywhere else in this codebase. Verified live end-to-end with two real
  accounts — the outcome's creator (an Owner) correctly has no
  verify/reject/request-more-evidence buttons rendered once a _different_
  member is assigned as verifier, and a direct API call from the creator's
  own session still gets a 403 regardless of role.
- **File evidence uses local disk, not real object storage.**
  `EVIDENCE_STORAGE_ROOT` (`apps/api/src/modules/evidence-outcomes/
evidence-outcomes.constants.ts`) resolves to `apps/api/var/
evidence-storage/<tenantId>/<storageKey>` (gitignored) — `Evidence` never
  stores binary content in the database, only the storage pointer plus a
  server-computed SHA-256 checksum, honoring the PRD's "files live in
  object storage" principle at the schema level while substituting local
  disk for a real object-storage service, the same proportionate stand-in
  local Postgres already is elsewhere. Evidence creation
  (`POST .../evidence`) and file upload (`POST .../evidence/:id/file`) are
  two separate requests rather than one mixed multipart-plus-JSON request —
  `@fastify/multipart`'s `request.file()` doesn't reliably capture
  companion fields, so the second request mirrors CSV Import's own
  file-only upload shape instead. EVD-04's version/replacement chain
  (`Evidence.replacesEvidenceId`, a `@unique` self-relation) is a
  `POST .../evidence/:id/replace` that creates a new row rather than
  mutating the original — the prior file and record stay untouched on disk
  and in the database.
- **Web**: `Evidence & Outcomes` is a real top-level nav surface (Table 10)
  at `/evidence-outcomes`, listing every Outcome across the tenant; each
  row opens `/evidence-outcomes/[outcomeId]`, a workspace with the claimed
  result, a status/action card (Submit/Verify/Reject/Request more
  evidence, each gated client-side the same way the service gates them
  server-side), and Contributions/Evidence cards reusing the
  `AddContributionDialog`/`AddEvidenceDialog` pattern established by every
  prior workspace page. Unlike Initiatives/Reviews, the nav item and
  `READ_ROLES` include `REVIEWER` (their "Verify if assigned" cell is real
  access, not a flat denial) — Guest is still excluded, the Share Grant
  mechanism their "Contribute if granted" cell needs isn't built.

### Audit Timeline and Audit Search (`modules/audit-operations/`)

The first feature in the `audit-operations` module boundary — PRD §6.11,
S16, AUD-01/02. Its own README already said "every module writes audit
events through it," and this is that: a single `AuditEvent` model plus a
`recordAuditEvent()` function every other domain service calls directly
after a material mutation.

- **`recordAuditEvent` is a plain exported function, not a NestJS
  provider** — the same "singleton import, not constructor-injected"
  pattern `prisma` itself already uses everywhere in this codebase. It's
  called from 14 existing services (Tenant, Membership, Invitation, Auth's
  invitation-acceptance path, Partner, Partnership, ImportBatch,
  Initiative, Milestone, Action, Review, Decision, Contribution, Evidence,
  Outcome) without any of their constructors changing, and it never
  throws — a failed audit write is logged and swallowed, since the
  business mutation it's describing has already committed by the time
  it's called. See docs/DECISIONS.md for why (constructor-injecting it
  everywhere would have cascaded into request-scoping ~14 singleton
  services, a codebase-wide change this feature doesn't justify).
- **"Material" means entity creation and lifecycle/state transitions** —
  the same boundary this codebase's existing `this.logger.log('..._created'
| ..._completed' | ...)` analytics-event calls already mark. A plain
  field-only edit gets no audit event.
- **`listAuditEvents`/`getAuditEvent` (`AuditEventsController`, `GET
/tenants/:tenantId/audit-events`) enforce §2.3's "Audit/export" row's row-
  level _scoping_, not just a route-level allow/deny** — Admin/Owner get
  full "Admin" access, Executive gets full "Portfolio" read, and
  Manager/Reviewer are forced to their own `actorId` regardless of what
  filter value they request ("Own scope"/"Assigned scope" — the two are
  read identically, see docs/DECISIONS.md for why no generic
  cross-entity "assignment" resolver was built for Reviewer's narrower
  cell). A new `CurrentMembership` param decorator
  (`modules/identity-tenant/tenants/decorators/current-membership.decorator.ts`)
  exposes `RoleGuard`'s already-resolved membership to the controller —
  the first feature that needs the caller's actual role inside a handler,
  not just at the guard.
- **Correlation is self-generated per event**, not threaded from the HTTP
  request's own `x-correlation-id` header — Table 67 asks for "a
  correlation id," satisfied at the single-event granularity AUD-02's
  search supports; cross-event correlation grouping is a documented,
  deferred refinement (see docs/DECISIONS.md).
- **Web**: a real, independently-gated top-level nav item at `/audit` (not
  folded into `/administration`, despite Table 10 listing Audit as
  Administration page content — Administration itself really is
  owner/admin only, while Audit's own RBAC row gives Executive/Manager/
  Reviewer real access too). The page is S16's own primary flow: a
  `FilterBar` (object type/id, action, actor, date range, correlation id)
  over a `DataTable`, each row opening a detail `Dialog` with the full
  before/after JSON and correlation id.

### Command Center (`modules/intelligence/dashboard/`)

The first `intelligence`-module feature — PRD S04. Pure read-aggregation,
no new tables: `DashboardService.get()` runs parallel `count()`/`findMany()`
queries against Partnership, Initiative, Action, Decision and Outcome —
every module those already belong to keeps owning them.

- **No requirement table exists for this screen at all** — DASH-01–06 is
  claimed by S04's own screen row but never appears in the requirements
  backlog (§6.1–6.11 name every other section; Command Center isn't one of
  them). Grounded instead in Table 10's surface description, Table 31's
  S04 screen spec, and US-006 (which traces it to PORT/RPT — portfolio
  read/reporting, not its own domain). See docs/DECISIONS.md.
- **KPI counts are always separately queried from the capped display
  lists** — every section's list is capped at 10 rows (each KPI card links
  to the real, uncapped list page for that data), but the number on the
  card itself comes from a dedicated `count()` call, never
  `list.length`, so it stays correct past 10.
- **"Reviews due" queries `Partnership.nextReviewAt` directly** — the
  field every prior feature already treats as the authoritative "next
  review" signal — rather than inferring due-ness from `Review` records.
  Due-soon window is 7 days (no PRD-named cutoff exists).
- **Integration health and finance-restricted data render their real
  absence**, not a faked value — no `integrations` connection has ever
  been created and no finance object exists yet (Revenue Share is
  "Later"), so those sections use the same `EmptyState` "no blank
  dashboards" pattern (PRD §3.2) every other feature's genuinely-empty
  states already use.
- **Web**: this is the first feature to replace
  `apps/web/app/[locale]/(app)/page.tsx` wholesale rather than adding a new
  route — Command Center's nav item has pointed at `/` since the app shell
  was built, and the Phase-0 "Foundation" placeholder (and its `home`
  translation namespace) are both fully removed. RBAC borrows "Portfolio
  read"'s shape (Reviewer included, Guest excluded); a Guest session
  landing at `/` sees a lighter message rather than the hard
  `ForbiddenState` every other Guest-denied route uses, since `/` is every
  role's default post-sign-in destination, not a link they chose to
  follow.

### Authorized CSV Export (`common/csv.ts`, plus one route per exportable list)

A cross-cutting mechanism, not its own module — PRD §2.2's "exports apply
the same row and field policies as the initiating user... logged as
material events," wired into three existing list surfaces rather than
built as a standalone screen. `common/csv.ts` exports `csvEscape`/`toCsv`,
shared with CSV Import's own `rejected.csv` download (which used to carry
its own local copy of the same escaper).

- **`GET .../partnerships/export.csv`**
  (`PartnershipsService.exportCsv`), **`GET .../initiatives/export.csv`**
  (`InitiativesService.exportCsv`, optionally `?partnershipId=`), and
  **`GET .../audit-events/export.csv`** (`exportAuditEventsCsv`, same
  query params as the search route) — each one calls the _exact same_
  query its sibling JSON list route already calls (Audit's export and
  search share one `buildWhere` helper), so exported rows can never drift
  from what the caller already sees in the UI. Same `RequireRole` set as
  each list route (Reviewer included for Partnerships/Audit, excluded for
  Initiatives — the real, different RBAC rows those already had).
- **Downloads are plain `<a href>` elements**, not a fetch+blob helper —
  the same pattern CSV Import's "download rejected rows" link already
  established, which the app's httpOnly `SameSite=Lax` cookie supports
  for a top-level cross-origin GET navigation.
- **`export_completed` is logged both ways**: the established
  `Logger`-based analytics-event convention (PRD's own event schema:
  `export_id, type, record_count, filter_hash, duration`) and a real
  `recordAuditEvent` call — the export itself gets a fresh `objectId`,
  the same "the operation is its own auditable object" pattern already
  used elsewhere.
- **Audit's own export closes AUD-03** (flagged P1/deferred when Audit was
  first built) — capped at a single 5000-row page, no pagination loop; a
  tenant exceeding that needs real streaming/background export, deferred
  alongside RPT-03's report-history tracking. See docs/DECISIONS.md for
  the full scope reasoning.

### Agreements and Commercial Rules (`modules/commercial-governance/`)

Phase 6/v2's first item — PRD §6.8, S10, AGR-01/02/04/05, RULE-01–04. The
first module to use a genuine two-tier **parent + versioned child** shape:
`Agreement`/`AgreementVersion` and `CommercialRule`/`CommercialRuleVersion`,
each pair sharing the same `versions AgreementVersion[]` /
`versions CommercialRuleVersion[]` relation and the same optimistic-
concurrency `version` field on **both** the parent and the child (every
prior entity in this codebase only needed it once, on a single flat row —
missing it on the child row here was the one bug live QA caught, fixed
before this section was written; see docs/DECISIONS.md).

- **`Agreement` carries Table 13's own 7-state chain**
  (`CAPTURED → IN_REVIEW → EFFECTIVE → AMENDED → SUSPENDED → EXPIRED →
  TERMINATED`), enforced the same documented-deviation way every prior
  state machine in this codebase is (`VALID_TRANSITIONS` in
  `agreements.service.ts`, `SUSPENDED → EFFECTIVE` the one added recovery
  move). **`EFFECTIVE` and `AMENDED` are not settable through the
  `Agreement`'s own `PATCH`** — `UpdateAgreementDto`'s `SETTABLE_STATUSES`
  excludes them on purpose. They are exclusively the automatic side effect
  of approving an `AgreementVersion`, applied via
  `prisma.$transaction([...])` combining the version update and the
  parent's status update atomically — a new pattern (one entity's
  action-side-effect drives a *different* entity's own state machine),
  though it rhymes with Review's own snapshot-capture and Partnership's
  `nextReviewAt` propagation.
- **`CommercialRule` has no parent-level state machine of its own** — Table
  13 has no row for it, so unlike `Agreement` it carries no `status` field;
  only its versions have `approvalStatus: DRAFT | APPROVED`. It's also
  **tenant-wide, not partnership-scoped** (Table 12's field list names no
  relationship field), the first domain entity in this codebase without one.
- **RBAC is "Agreements/rules"'s own §2.3 matrix row** — genuinely
  different from every approval workflow built so far: `Manager` gets
  metadata/drafting only, never approval, and it's `Reviewer` (not
  `Owner`/`Executive`, as Decisions/Outcomes have it) who holds approval
  authority alongside `Owner`/`Admin`. Both `AgreementsController` and
  `CommercialRulesController` use `WRITE_ROLES` for the parent and a
  `WRITE_OR_APPROVE_ROLES` union on the nested version routes (the same
  union-then-narrow-in-service shape `DecisionsController` established),
  with the service itself checking `approvalStatus === 'APPROVED'` against
  `APPROVE_ROLES` vs. everything else against `WRITE_ROLES`.
- **INV-002 immutability**: editing an `AgreementVersion`/
  `CommercialRuleVersion`'s content is blocked once `approvalStatus ===
  'APPROVED'` — "create a new version instead," the same preserve-don't-
  overwrite discipline as Evidence's EVD-04 replacement chain.
- **AGR-02/RULE-03's overlap-prevention invariant** ("overlapping effective
  versions blocked") is enforced at **approval time, not creation time** —
  a new shared helper, `rangesOverlap()` in
  `modules/commercial-governance/date-range.ts`, compares the candidate
  `[effectiveFrom, effectiveTo]` range against every other **approved**
  sibling of the same parent (a still-draft sibling can freely overlap; two
  approved ones never can). A `null` `effectiveTo` is open-ended.
- **RULE-01/04's safe, explainable rule DSL** —
  `modules/commercial-governance/commercial-rules/rule-engine.ts` is a
  small, fixed, non-Turing-complete evaluator, deliberately not arbitrary
  code: `RULE_OPERATORS = ['eq','ne','gt','gte','lt','lte','in','contains']`,
  a `{ combinator: 'AND'|'OR', conditions: [...] }` definition shape,
  `assertValidDefinition()` validated once at creation/edit time (RULE-01's
  "invalid/ambiguous conditions rejected"), and `evaluateRule()` returning
  `{ result, trace }` where `trace` itself **is** RULE-04's required
  "explain rule evaluation as inputs, conditions, result and version."
- **RULE-02's "test against historical/sample events" is scoped to
  user-supplied sample cases**, not real historical Revenue Events — that
  entity doesn't exist yet (Revenue Event is v2's next item). A dedicated
  `POST .../versions/:versionId/test` route runs `evaluateRule()` against
  caller-supplied `{ label?, input, expectedResult }[]` cases and persists
  the pass/fail results (with each case's trace) onto the version's
  `testResults` — a documented, PRD-precedented scope simplification (same
  category as Command Center's "integration health" deferral), not a
  silent gap.
- **AGR-04 linking**: `AgreementVersion` gets an optional `initiativeId`
  (the version-specific Initiative scoping AGR-04 names) — the
  relationship/partnership link is already the parent `Agreement`'s own
  `partnershipId`, and the Claim link will be added from Claim's own side
  once that entity exists.
- **Web**: `/agreements` (list + create) and `/agreements/[id]` (S10's
  "status/version → parties/dates → history" workspace: status badge,
  available transitions, and a version list with inline edit/approve
  actions) — the nav item's real `href`, replacing the Phase-0
  `comingLater` placeholder. Commercial Rules gets its own `/agreements/
  rules` list and `/agreements/rules/[id]` workspace (a header-button link
  from Agreements, not a second nav item, since Table 10/§3.1 name only one
  "Agreements" surface and Commercial Rule is tenant-wide, not
  partnership-nested) — its version dialog is a small condition-row builder
  (field/operator/value, `RULE_OPERATORS` in a `Select`) rather than a raw
  JSON textarea, plus a "Test" dialog for RULE-02 that renders each sample
  case's pass/fail inline.

## `apps/web` — routing and i18n

Every route lives under `app/[locale]/...` (`en` or `ar`), resolved by
`next-intl`'s proxy (`proxy.ts` — Next.js 16 renamed the `middleware` file
convention to `proxy`) from the URL — there is no root
`app/layout.tsx`; `app/[locale]/layout.tsx` is the true root layout because it
needs the resolved locale to set `<html lang dir>`.

`src/i18n/` holds the locale list (`config.ts`), the routing definition
(`routing.ts`), a localized `Link`/`usePathname`/`useRouter` (`navigation.ts`),
and the per-request message loader (`request.ts`). Translated strings live in
`messages/en.json` and `messages/ar.json`, namespaced by feature
(`nav`, `commandCenter`, `designSystem`, `common`).

### Route groups: `(auth)`, `(onboarding)`, `(app)`

`app/[locale]/` splits into three route groups that share the same root
layout (fonts, providers) but nothing else. Together their gates cover every
combination of (signed in?, has a tenant?) exactly once — each page lives in
exactly one group, and that group is what decides who's allowed to see it:

- **`(auth)`** — `sign-in`, `sign-up`, `forgot-password`, `reset-password`,
  `accept-invite`. No `AppShell`. Each page redirects to `/` if
  `getCurrentUser()` already resolves a user — a signed-in visitor never
  sees these forms.
- **`(onboarding)`** — `create-organization`. Its `layout.tsx` gates both
  directions: no user → `/sign-in`; user **with** a tenant already →
  `/` (a settled user never lands back on "create your organization").
- **`(app)`** — everything else (home, `design-system`, and every future
  feature page). Its `layout.tsx` checks `getCurrentUser()` then
  `getCurrentTenant()` in sequence — no user → `/sign-in`; user but no
  tenant → `/create-organization`; both present → render `AppShell`. A new
  protected page needs nothing extra — landing it under `(app)/` is what
  makes it protected (and tenant-required).
- **`(auth)` and `(onboarding)` share one presentational layout**,
  `src/components/CenteredCardLayout.tsx` (wordmark + card + locale
  switcher) — it has no opinion about who's allowed to be there; each route
  group's own `layout.tsx` supplies that.

### `AppShell` (`src/components/AppShell.tsx`)

Composes `@revn/ui`'s `Sidebar` + `TopNav` around every `(app)` page, taking
the real signed-in `user`, `tenant` and `role` (all fetched in
`(app)/layout.tsx` before it renders) — no placeholder identity or
organization name is ever invented. The sidebar footer shows the user's
name, email and role (`Owner`/`Member`); `TopNav`'s `tenantSlot` shows the
tenant name as a static badge (not a dropdown — there's nothing to switch
between yet, see the Tenant/Organization section above). Every nav item
beyond the Design System is `comingLater: true` — it renders, disabled, with
a "coming later" badge, per the "no fake screens, no fake data" instruction.
When a feature module ships, flip that item's `comingLater` and point its
`href` at the real route; nothing else about the shell needs to change.

The sidebar collapse toggle lives **inside the sidebar itself** (next to the
logo), not in `TopNav` — collapsing to an icon-only rail is the sidebar's own
concern. On `lg`+ screens it's always mounted and toggles between full width
and a `72px` icon rail (labels, section headers and the "coming later" badges
hide; icons get a `title` tooltip instead) in place, in the flex layout.
Below `lg`, `TopNav`'s hamburger opens/closes a _separate_, always-full-width
`Sidebar` instance rendered as a fixed overlay with a backdrop — collapsing
a drawer that's already covering the content doesn't make sense, so mobile
and desktop are genuinely two different `<Sidebar>` mounts sharing the same
`sections`/`footerSlot`, not one component doing both jobs. The logo hides
entirely while collapsed rather than shrinking into a mark the brand system
doesn't define — see brand doc §03, "no icon-only mark," in `docs/DECISIONS.md`.

## `packages/ui` — design system

One barrel export (`src/index.ts`) re-exporting every component. Each
component owns a folder with its implementation and an `index.ts`. Shared
plumbing:

- `src/lib/cn.ts` — `clsx` + `tailwind-merge`, used by every component that
  accepts a `className` override.
- `src/lib/inputStyles.ts` — the one `cva` variant set shared by `Input`,
  `Textarea`, `Select`'s trigger and `DateInput`, so form controls stay
  visually identical without four copies of the same class list.

RTL is not a per-component prop — it's structural. Every component uses CSS
logical properties (`ms-*`/`me-*`, `ps-*`/`pe-*`, `text-start`/`text-end`,
`rounded-s-*`/`rounded-e-*`) instead of `left`/`right`, so flipping the
document's `dir` attribute (done once, in `app/[locale]/layout.tsx`) re-flows
every component automatically. The one custom Tailwind variant
(`rtl:`/`ltr:` in `packages/config/tailwind/theme.css`) exists only for the
rare case logical properties can't express, like mirroring a directional
chevron icon.

## `packages/db` — database

Prisma, PostgreSQL, zero models (see `docs/DECISIONS.md` for why). The
generated client is exported as a lazy singleton from `src/index.ts`
(`import { prisma } from '@revn/db'`), reused across hot reloads in
development so local dev doesn't exhaust Postgres connections on every file
save.

## `packages/config` — shared tooling

- `typescript/` — `base.json` (repo-wide compiler options), plus
  `nextjs.json`, `nestjs.json` and `react-library.json` for the three runtime
  shapes in this repo.
- `eslint/base.mjs` — the flat-config ruleset every app/package extends;
  app-specific configs (like `apps/web`'s Next.js plugin rules) layer on top.
- `tailwind/theme.css` — the brand tokens as a Tailwind v4 `@theme`, imported
  by `apps/web/app/globals.css`. This is the **one file to change** if the
  brand system itself changes.

## Adding a new feature module (worked example)

Using **Partnership** (Phase 2 — built; see `docs/ROADMAP.md` and this file's
own Partnership section above) as the example — the same `portfolio` module
Partner established, and the more common case going forward (extending an
existing module) rather than Partner's own worked example (starting one from
scratch, still below for reference when the _next_ new module boundary comes
up, e.g. `execution`):

1. **Database:** add the new model to `packages/db/prisma/schema.prisma`,
   following PRD §4.1 (uuid id, `tenant_id`, `created_at/by`, `updated_at/by`,
   `version`, lifecycle status) and its own §4.3 state machine if it has one
   — `Partnership`'s (`Prospect → Qualified → Planning → Active → At Risk →
Paused → Terminated → Archived`, "cannot activate without owner, motion,
   objective and cadence") is enforced as a real transition graph in the
   service layer, not just documented — see this file's Partnership section
   for why the graph includes moves the PRD's own table never draws.
   `Partner`'s optimistic-concurrency pattern
   (`prisma.<model>.update({ where: { id, tenantId, version }, ... })`,
   `get()` before the versioned update so a missing id reports 404 not 409)
   is the template — copy it rather than re-deriving it. Purely additive
   changes can run `pnpm db:migrate` directly; a migration that also
   transforms existing data needs a hand-written `migration.sql` applied via
   `prisma migrate deploy` instead (non-interactive `migrate dev
--create-only` isn't supported in this environment).
2. **API module:** add to `portfolio.module.ts` alongside `partners/` and
   `partnerships/` — a new folder with its own controller, service, DTOs.
   Every mutating route needs `@UseGuards(RoleGuard)` + `@RequireRole(...)`
   (`identity-tenant/tenants/guards/role.guard.ts`, exported for exactly
   this) resolved against the actual PRD §2.3 matrix row for that entity —
   re-check the row yourself rather than assuming a sibling module's answer
   transfers (Partnership's "Partnership edit" turned out to match Partner's
   borrowed interpretation, but only after being checked independently —
   see `docs/DECISIONS.md`). `JwtAuthGuard` (global) and the global
   `ValidationPipe` + `field_errors` shape need nothing extra. If the new
   entity's list should be visible without nesting under some other record's
   id, a small dedicated controller class is fine
   (`partnerships-list.controller.ts` is the template) — a Nest controller
   carries exactly one fixed path prefix.
3. **Web:** extend the existing page/content rather than always adding a new
   route — Partnership grew inside the existing `/partnerships` page
   (a Stage/Health column plus a per-row action opening a management dialog)
   rather than getting a page of its own, since PRD §3.1 already places it on
   that surface. Add a new route only when the PRD's own IA calls for one.
   Reuse `packages/ui` components — add a new one only if the design system
   truly has nothing that fits.
4. **Tests:** unit tests next to the code they test
   (`apps/api/tests/*.test.ts`, `apps/web/tests/*.test.ts`); a Vitest project
   per app/package, run together via `pnpm test` (Turborepo) or individually
   via `pnpm --filter @revn/api test`. A state machine or field-gating rule
   is exactly the kind of logic worth a dedicated table of small tests (see
   `apps/api/tests/partnerships.service.test.ts`) rather than only exercising
   it through the one happy path a manual QA pass would find.
5. **Docs:** update this file's module table entry and `docs/ROADMAP.md`, and
   note anything a later module needs to know.

### Starting a brand-new module boundary (reference)

Partner's own worked example, kept for when a feature needs a module folder
that doesn't exist yet (the next one will be `execution`, for Initiative):

1. Same PRD §4.1 database rules as above, in the new module's first table.
2. Turn `apps/api/src/modules/<name>/README.md` into a real module —
   `<name>.module.ts`, controllers, services, DTOs — and register it in
   `app.module.ts`. Import `IdentityTenantModule` to get `RoleGuard`.
3. Add the real route under `app/[locale]/(app)/...`, wire it into
   `AppShell`'s nav items (flip `comingLater` off, set the real `href`, and
   hide it entirely for roles the matrix denies read access to — see how
   `administration` and `partnerships` do this) — unless the PRD's own
   §3.1 navigation table already places this content inside an _existing_
   nav item (as it does for Partner inside "Partnerships"), in which case
   don't invent a new one.
4. Tests and docs, same as above.
