# Foundation decisions

This is the decision log for the project setup phase — every place the brand
file or PRD left a gap, and every technology choice, with the reasoning. Later
decisions belong in the PRD's own decision register (§17.1); this file is
specifically about the foundation.

## Tech stack

| Layer         | Choice                                          | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo      | pnpm workspaces + Turborepo                     | PRD calls for one modular-monolith deployable, not microservices — but the frontend, backend, database schema and design system are still separate concerns with different release cadences and reuse needs (design system will feed a future external guest workspace, PRD §6.10/R1.1). A monorepo keeps them in one reviewable history with shared tooling, without forcing a network boundary. Turborepo gives task caching and correct build ordering across the workspace for free. |
| Frontend      | Next.js 16 (App Router) + React 19 + TypeScript | PRD §10.5 names "React/Next.js" as the frontend candidate (the alternative — preserving an existing React/Vite prototype — doesn't apply; this is a fresh repository, so there's nothing to harden/hybridize/rebuild per the §10.5 repository-audit gate). App Router gives server components, layouts and middleware needed for locale routing.                                                                                                                                         |
| Backend       | NestJS 12 (Fastify adapter) modular monolith    | PRD §10.1/§10.5 explicitly decides a modular monolith and names "NestJS/Fastify or equivalent." NestJS's module system maps directly onto the ten domain modules in PRD §10.3, and its DI/guard/interceptor model is a natural fit for the deny-by-default permission doctrine (PRD §2.2) the next features will implement. Fastify over Express for the throughput NestJS itself recommends for new projects.                                                                           |
| Database      | PostgreSQL 16 + Prisma ORM                      | PRD §10.5 specifies "Managed PostgreSQL with migrations and row-level defense in depth." Prisma gives typed migrations and a typed client; row-level tenant isolation (PRD SEC-02) will be enforced in the application layer first (every query scoped by `tenant_id` from authenticated context, per AUTH-01) with Postgres RLS evaluated as defense-in-depth once the Tenant table exists.                                                                                             |
| Styling       | Tailwind CSS v4                                 | CSS-first `@theme` configuration maps cleanly onto the brand doc's tokens (color, type, radius, shadow) as real CSS custom properties, which is what makes runtime locale/theme switching (RTL font swap) simple — see `packages/config/tailwind/theme.css`.                                                                                                                                                                                                                             |
| UI primitives | Radix UI (via the unified `radix-ui` package)   | Accessible-by-default primitives (Dialog, Select, Toast) so the design system doesn't reinvent focus trapping, keyboard nav or ARIA wiring — required by PRD §7.1's accessibility bar.                                                                                                                                                                                                                                                                                                   |
| Testing       | Vitest everywhere (web, ui, api)                | One test runner and one mental model across the monorepo instead of Jest for the API and Vitest for the frontend. NestJS's DI needs decorator metadata that Vitest's default esbuild transform doesn't emit, so `apps/api` uses `unplugin-swc` to transform with SWC instead — see `apps/api/vitest.config.ts`.                                                                                                                                                                          |
| i18n          | next-intl                                       | App Router-native locale routing (`/en/...`, `/ar/...`), server + client translation hooks, and `dir` resolution per locale — directly serves the Arabic/RTL requirement in PRD §1.2.                                                                                                                                                                                                                                                                                                    |

### Versions and why they're pinned where they are

Dependency versions were checked against their npm registry `dist-tags` at
setup time rather than assumed. Two deliberate deviations from "latest":

- **TypeScript is pinned to `^5.9.3`, not the `latest`-tagged `7.0.2`.**
  TypeScript 7 (the native Go port) is genuinely GA on npm's `latest` tag, but
  `typescript-eslint@8.70.0` — required for linting — declares a peer range of
  `>=4.8.4 <6.1.0`. Linting the codebase matters more than being on the newest
  compiler right now. Revisit once typescript-eslint ships TS7 support.
- **ESLint is pinned to `^9.39.5` (npm's `maintenance` tag), not the
  `latest`-tagged `10.10.0`.** This one isn't just a peer-range warning: with
  ESLint 10, `eslint-plugin-react@7.37.5` (pulled in transitively by
  `eslint-config-next`) throws at lint time —
  `TypeError: contextOrFilename.getFilename is not a function` — because it
  still calls a rule-context method ESLint 10 removed. `eslint-config-next`'s
  own peer range (`eslint: ">=9.0.0"`) was written before ESLint 10 shipped.
  Revisit once `eslint-plugin-react` publishes a release that supports it.
- **Prisma is pinned to `7.10.0`, not the `latest`-tagged `8.0.0-rc.13`.**
  Prisma 8 is still a release candidate (npm's `prev` tag points at `7.10.0`
  stable). A production-oriented foundation shouldn't start on an RC ORM.
  Prisma 7 itself already changed how connections work — the schema's
  `datasource` block no longer accepts a `url`; `packages/db/prisma.config.ts`
  supplies the connection for Migrate/Studio, and the runtime client is
  constructed with an explicit driver adapter (`@prisma/adapter-pg`) in
  `packages/db/src/index.ts`. The exported `prisma` client is also
  intentionally lazy (a `Proxy` that only constructs the real client on first
  property access) rather than built at import time — `@revn/db` can be
  imported before the consuming app has loaded its own `.env`, and NestJS's
  `ConfigModule` only loads environment variables during app bootstrap, which
  happens _after_ every module's static imports have already resolved.
- **`fastify` is pinned to the exact version `5.12.1` in `apps/api`
  (Authentication feature), matching what `@nestjs/platform-fastify@12.0.1`
  pins internally.** `@fastify/cookie` (needed for the auth cookies) types
  its plugin registration against the caller's own `fastify` package; if
  pnpm resolves a different `fastify` version for our direct dependency than
  the one Nest bundles, TypeScript sees two structurally-similar but
  nominally distinct `FastifyInstance` types and `app.register(fastifyCookie)`
  fails to typecheck. Pinning the exact version forces pnpm to dedupe to one
  copy. Bump this in lockstep with whatever `@nestjs/platform-fastify` pins,
  not independently.
- **`@typescript-eslint/consistent-type-imports` is disabled entirely in
  `apps/api`** (Authentication feature), not just re-tuned. NestJS's DI
  container and `ValidationPipe` both read constructor-parameter types from
  `design:paramtypes` reflection metadata at runtime — `emitDecoratorMetadata`
  emits that metadata only for real (value) imports. Running `eslint --fix`
  with this rule on converted every constructor-injected service and every
  `@Body()` DTO in `identity-tenant/auth/*` to `import type`, which still
  typechecks and builds cleanly but crashes at boot with
  `Nest can't resolve dependencies` — confirmed by deliberately booting the
  "fixed" build before reverting it. The rule has no way to distinguish a
  reflected class from an ordinary type reference, so it isn't safe to run
  (with or without `--fix`) anywhere NestJS decorators rely on that metadata.
  `packages/ui`, `packages/db` and `apps/web` keep the rule — it's fine where
  nothing reads constructor types at runtime.
- **`app.enableCors()` in `main.ts` explicitly lists `methods`** (RBAC
  feature) — `@fastify/cors`'s own default is `'GET,HEAD,POST'` _only_.
  Every `PATCH`/`DELETE` route added so far (tenant settings, member/role
  updates, revoking an invitation) worked perfectly through every `curl`
  test and every unit test, then failed outright from the browser with a
  CORS preflight error — `curl` never enforces CORS at all, so nothing
  short of clicking the actual button in a real browser could have caught
  this. Found by live QA on the Administration page, not by any automated
  check. If a route ever 404s or silently no-ops from the browser but works
  from `curl`, check this list before anything else.
- **`apiFetch` (`src/lib/api/client.ts`) decides "does this response have a
  body" by reading it as text, not by checking `res.status === 204`** (RBAC
  feature). Inviting a member returns `201 Created` with an empty body (the
  caller just re-fetches the list), and the old 204-only check called
  `.json()` on that empty body, which throws — and that throw wasn't an
  `ApiError`, so it read as a generic failure on the API's own happy path.
  The invitation was created; the UI just claimed it wasn't. Caught by
  actually sending an invite through the running UI, not by any of the unit
  tests written for this exact function — they all used bodies that were
  either fully present or a real `204`, never a non-204 empty one. If you
  add an endpoint that can return 2xx with no body, this is why it's safe
  to do regardless of which status code you pick.

### What was deliberately _not_ added in this phase

- **No Docker requirement for local dev.** A `docker-compose.yml` is provided
  for anyone who prefers it, but this environment had no Docker installed, so
  local Postgres runs via Homebrew's `postgresql@16` — see the README's local
  setup section. Either path produces the same `DATABASE_URL`.
- **No dark mode.** The brand doc defines exactly three background surfaces
  (Flat Canvas, Radial Wash, Deep Navy) and no dark-theme toggle concept. Deep
  Navy is used as the sidebar's fixed surface, not as an app-wide alternate
  theme. Introducing a real dark mode would be inventing an identity variant
  the brand file doesn't define — out of scope for "don't invent beyond the
  brand file."
- **No Storybook.** The user asked for a Design System Showcase _route_
  specifically (`/design-system`), not a separate tool — building both would
  duplicate the same catalog in two places for no reader who needs both.
- **No shared `packages/types` package yet.** Cross-cutting contracts (like
  the PRD §8.3 error shape) live next to the code that defines them
  (`apps/api/src/common/filters/http-exception.filter.ts`) until there's a
  second consumer that actually needs to import the same type — adding an
  empty shared-types package now would be scaffolding for a future that
  doesn't exist yet.
- **Zero domain tables.** `packages/db/prisma/schema.prisma` has a datasource
  and generator and nothing else. The first migration is the Identity & Tenant
  module, which is the next feature, not this one.

## Brand-file gaps — conservative choices made and why

The Reven Brand System Guidelines (pptx) is thorough but is a **deck/marketing
system**, not an application design system. Three gaps had to be resolved
conservatively rather than left to invention:

1. **No Arabic/RTL typography is specified.** The brand doc's three typefaces
   (Sora, Manrope, IBM Plex Mono) have no Arabic character sets. Chosen
   pairing, conservatively matched to the existing type roles rather than
   picked freestyle:
   - Display (Sora 700/800) → **Cairo** 700/800 — a geometric sans with a
     similar structural weight and personality to Sora, and good Arabic
     hinting at heavy weights.
   - Body (Manrope) → **IBM Plex Sans Arabic** — deliberately in the same type
     superfamily as the brand's own IBM Plex Mono, so the Arabic body face
     shares a visual family with an element the brand doc already committed
     to, rather than introducing an unrelated family.
   - Label (IBM Plex Mono) → **IBM Plex Sans Arabic** (medium/semibold) — Plex
     has no Arabic monospace; Arabic script has no meaningful monospace
     tradition for UI labels either, so the same Plex Sans Arabic face
     (letter-spaced, not uppercased — Arabic has no case) stands in.

   Revisit this the first time an actual Arabic-speaking design reviewer
   evaluates the product — this is an engineering-conservative choice, not a
   tested one.

   One correctness fix on top of the pairing itself: the brand doc's letter-
   spacing values (§07 — `-0.02em`/`-0.035em` on display, positive tracking
   on labels) are tuned for Sora and IBM Plex Mono, both Latin faces. Arabic
   is a connected, cursive script, so any non-zero `letter-spacing` — the
   negative display value especially — breaks letterforms apart instead of
   just spacing them out. `app/globals.css`'s `html[lang="ar"]` block resets
   all four tracking tokens to `normal` rather than inheriting the Latin
   values, the same way it swaps the font stacks.

2. **The deck layout anatomy (§08) doesn't map 1:1 onto an application shell.**
   The brand doc's 104px side margins, 78–84px top margin and mandatory
   "mono eyebrow + rule before every headline" are calibrated for full-bleed
   16:9 slides meant to be read one at a time. An application has persistent
   chrome (sidebar, topbar) and dense, scrollable content. Adaptations made:
   - Margins scaled down to app-appropriate density
     (`--shell-content-padding-desktop: 32px`, `16px` on mobile) rather than
     kept at deck scale.
   - `PageHeader` keeps the eyebrow → bold-headline rhythm but drops the
     literal "rule" (thin horizontal line) under the eyebrow — that's deck
     chrome, and an underline/accent-rule motif under a title is exactly the
     "AI-generated slide" cliché to avoid in real product UI.
   - The "footer — wordmark + 2-digit index on every slide" convention isn't
     used at all in the app shell; it's a pagination device for a deck, and an
     application doesn't paginate its screens that way.

3. **No dark-mode/theme-toggle concept, no explicit spacing/radius scale, no
   shadow scale.** The brand doc defines exactly three background surfaces
   (see above) and describes shadows/radii only through the rounded-terminal
   logo and a general "institutional, not playful" belief statement — it
   never states pixel values for either. A conservative, moderate scale was
   picked and documented as tokens (`--radius-sm/md/lg/pill`,
   `--shadow-xs/sm/md/lg` in `packages/config/tailwind/theme.css`) rather than
   guessed ad hoc per component, so there's exactly one place to correct them
   if brand review disagrees.

## Repository-audit gate (PRD §10.5, Table 43)

The PRD's audit gate assumes a pre-existing React/Vite + Base44 prototype to
assess ("harden, hybridize or rebuild"). This repository started from nothing
— there was no prototype to audit — so that decision doesn't apply here. If a
prior prototype surfaces later (the brand asset zip contained screenshots of
one), it should still go through that same audit before any of its code is
reused; nothing from it was carried into this foundation.

## PRD capability-matrix gaps — conservative choices made and why

PRD §2.3's MVP RBAC capability matrix (see `docs/ARCHITECTURE.md`'s RBAC
section) is coarse by design — it has columns for five role tiers and rows
for entire domain areas ("Portfolio read," "Partnership edit"), not one row
per entity. Building real routes on it means resolving gaps the table itself
leaves open. Each one gets decided and written down here, not left implicit
in a `RequireRole(...)` call some later reader has to reverse-engineer.

- **The "Tenant/configuration" × "Executive" cell literally reads
  "Executive"** — the column's own name, not a capability word like the
  "Yes"/"No"/"Read"/"Approve" every other cell in that row uses. Treated as
  a copy-paste artifact and implemented as "No": every other role in that
  row is "No" except Owner/Admin, and PRD §2.1 explicitly describes
  Executive's job as excluding "routine data administration." (First
  surfaced building RBAC's `TenantsService`/`MembersService` guards.)
- **No matrix row is named "Partner"** — only "Portfolio read" (Yes for
  Admin/Executive/Manager, "Scoped" for Reviewer, "Shared only" for Guest)
  and "Partnership edit" (Yes/Approve/Yes/No/Shared fields) exist. Partner
  read follows "Portfolio read," but with Guest getting **no access at
  all** rather than a literal "shared only" — the Share Grant mechanism
  that "shared only" depends on is R1.1, not built, so there's no partial
  shape to actually implement; hiding it entirely (both the nav item and
  the route's `RoleGuard`) is honest about that rather than showing an item
  that could only ever render empty. Partner write follows "Partnership
  edit"'s shape (Owner/Admin/Manager write; Executive's "Approve" isn't a
  workflow this phase builds, so Executive is read-only for now, same as
  Reviewer). Every later `portfolio` module addition (Partnership itself,
  Program) should re-examine this against its own matrix row rather than
  assuming Partner's answer — "Partnership edit" is a real row once
  Partnership exists, not just Partner's borrowed analogy.
- **Partnership's "Partnership edit" row re-examined, as promised above —
  same conclusion.** Now that Partnership is a real entity, "Partnership
  edit" (Yes/Approve/Yes/No/Shared fields for Admin/Executive/Manager/
  Reviewer/Guest) is its own row rather than a borrowed analogy, and it was
  checked independently rather than copied forward. It lands on the same
  shape Partner already used: Owner/Admin/Manager write, Executive read-only
  (no approval workflow exists to give "Approve" a real action), Reviewer
  read-only, Guest no access (Share Grant mechanism, R1.1, still not built).
  See `apps/api/src/modules/portfolio/partnerships/partnerships.controller.ts`.

## Partnership — state machine, field gating and scope cuts

PRD grounding: §4.3 Table 13 (state machine + activation invariant), Table 67
(per-field `Required` column), Table 12 (minimum fields), §5.1's Golden
Workflow A (FLOW-A) and its required analytics events, and PORT-01–08 (S05,
the Partnership portfolio screen).

- **The state machine allows recovery moves Table 13 never draws.** Table
  13 gives every object's "valid path" as a single arrow chain — Partnership:
  Prospect → Qualified → Planning → Active → At Risk → Paused → Terminated →
  Archived — with no reverse arrows anywhere in the table, not even for
  objects where recovery is obviously required (Initiative's Blocked, Action's
  Blocked both have no drawn way back to normal either). Read completely
  literally, a relationship that becomes At Risk could never become Active
  again, which would make tracking health pointless. `PartnershipsService`'s
  `VALID_TRANSITIONS` therefore implements: strict forward order Prospect →
  Qualified → Planning → Active (no stage-skipping — Table 67 says `stage`'s
  own validation is "valid state transition only"); Active ⇄ At Risk ⇄ Paused
  as a freely recoverable trio; Terminated reachable from any pre-Archived
  stage (ending a relationship shouldn't require walking every intermediate
  stage first, including from Prospect if a prospective deal simply falls
  through); Archived only from Terminated, and terminal. This is a documented
  interpretation, not literal PRD text — if a future PRD revision spells out
  the full transition table explicitly, reconcile against that instead.
- **Field gating follows Table 67's per-field `Required` column exactly,
  applied to whichever stage the request's net result lands on** (the
  merge of the update's new fields with the record's existing ones, not just
  the fields present in that one request): `owner_id` — "Yes at Qualified" —
  is required from Qualified onward (Qualified, Planning, Active, At Risk,
  Paused); `health` and `next_review_at` — both "Yes at Active" — plus
  Table 13's own invariant ("cannot activate without owner, motion, objective
  and cadence") are required for Active, At Risk and Paused (At Risk/Paused
  are Active with a different health flag, not a fresh unconfigured state, so
  they carry the same requirement). Terminated and Archived are deliberately
  exempt from all field gating — nothing in the PRD gates an exit, and
  requiring a fully-populated relationship before you're allowed to end it
  would make abandoning a bad prospect harder than it should be.
- **`motion` and `cadence` are free text**, for the same reason `segment` is
  free text on Partner (see above) — ADM-05's taxonomy is P1 and not built.
  Structuring either now would mean inventing a scheme the PRD doesn't name.
- **`health` is a plain three-value enum (`HEALTHY`/`NEEDS_ATTENTION`/
  `CRITICAL`)**, not the "Enum + derived, approved values, override reason"
  formula Table 67 actually describes. That derivation is PORT-05
  ("Calculate relationship health from explicit components plus permitted
  manual assessment," P1) — explicitly deferred; a manually-set enum is what
  ships now. Naming picked `NEEDS_ATTENTION`/`CRITICAL` rather than reusing
  "At Risk" for a health value, since "At Risk" is already a _stage_ — reusing
  it as a health label too would make the two concepts look like the same
  thing in the UI when they're independent (a relationship can be Active and
  merely "needs attention," or At Risk and still rated healthy pending a
  save).
- **`sponsor` is modeled but ungated.** PORT-03 ("Create relationship under
  partner/program with owner, sponsor, objective, motion and cadence") names
  a sponsor alongside owner as a creation-time field, but no table (13 or 67)
  gates any stage transition on it the way `owner_id` is gated — so it's a
  real optional field on the model with no enforcement attached.
- **`program` is not modeled at all.** Table 12 lists "partner, program,
  owner, motion, stage, health, review cadence" as Partnership's minimum
  fields, and PORT-01/03/06 all mention "program" — but Program is a whole
  separate unbuilt entity (Table 12 lists it in its own row: "Reusable
  portfolio grouping — name, strategy, sponsor, targets, taxonomy"), and
  Roadmap item 5's own scope line ("the governed relationship, owner, health,
  cadence") doesn't mention it. Building a bare `programId` column with
  nothing on the other end would be a foreign key to nothing. Deferred to
  whenever Program itself is scheduled.
- **One Partnership per Partner, enforced with a plain `@unique` on
  `partnerId`** rather than a compound `(tenantId, partnerId)` key — a
  Partner already belongs to exactly one tenant, so the simpler unique
  column is equally tenant-safe. This encodes INV-001 ("a relationship
  belongs to exactly one tenant and one partner; duplicate active
  relationships require explicit program distinction"): Program doesn't
  exist yet, so there's no distinguishing mechanism either, meaning no
  duplicates at all for now — attempting to create a second Partnership for
  an already-governed Partner is a 409, not a second row.
- **PORT-04's "transition reasons ... enforced" applies only to the
  exception/exit transitions** — moving into At Risk, Paused or Terminated
  requires a non-empty `transitionReason`; ordinary forward progress
  (Qualified, Planning, Active) does not. Only the most recent transition's
  reason is stored (`lastTransitionReason`) — a full history of every past
  transition and its reason is Audit Timeline's job (Roadmap Phase 4), not
  this table's.
- **The two analytics events the PRD names for this flow —
  `partnership_created` (relationship_id, source, owner, motion) and
  `partnership_activated` (relationship_id, readiness_fields,
  activation_time) — are emitted via `Logger`, structured exactly as the PRD
  specifies**, the same mechanism RoleGuard already uses for AUTH-05's denial
  telemetry. A real analytics/event pipeline (aggregation, storage, querying)
  is Audit Timeline territory (Roadmap Phase 4, item 10) and isn't built —
  but nothing about these two named events is silently dropped in the
  meantime, and Phase 4 has a real source to consume from when it exists.
  `source` is always `"manual"` for now since no import pipeline exists yet
  (Roadmap Phase 2, item 6 — CSV Import — is what will eventually pass a
  real source value here).
- **Scope cut against PORT-01–08**: only PORT-01 (list/filter — filtering
  itself is a small local dataset today, not the server-side filter UI the
  requirement eventually wants), PORT-02 (already Partner's job, unchanged),
  PORT-03 (create) and PORT-04 (controlled transitions) are built. PORT-05
  (health formula, P1), PORT-06 (bulk assign, P1), PORT-07 (saved views,
  P2/R1.1) and PORT-08 (merge duplicates, P1) are all explicitly P1/P2 in the
  PRD's own release column and reference mechanisms (a real taxonomy, a
  formula engine, saved-view sharing, a merge/dedup workflow) that don't
  exist yet — deferred rather than half-built.

## CSV Import — scope cuts and interpretation calls

PRD grounding: §5.1 Golden Workflow A (FLOW-A) — "Portfolio import to active
partnership"; Table 21 (IMP-01–10); S03's screen row (Table 11); the API
endpoint catalog's `/imports` entries; T-003/T-004 (test scenarios);
UAT-01.

- **CSV only, not XLSX.** IMP-01 says "CSV/XLSX," but Roadmap item 6's own
  scope line says "CSV Import" specifically, and XLSX needs a binary
  spreadsheet parser for zero benefit this phase adds any evidence of
  needing. Deferred.
- **File upload only, not a CRM connector.** FLOW-A's primary flow names
  "file or connector dataset" as the two entry points; the `integrations`
  module (connections, mappings, sync jobs) is still fully reserved
  (`docs/ARCHITECTURE.md`'s module table). Only the file path is built.
- **Ad-hoc mapping, not IMP-03's "save reusable tenant mapping."** FLOW-A's
  primary flow itself only says "user maps source columns, chooses
  defaults" — no mention of saving or reusing a mapping. IMP-03 is P1.
  Every import re-maps from scratch.
- **`ImportBatch`/`ImportRow` are a direct implementation of IMP-02's literal
  requirement text** ("create staging batch; do not write domain objects
  during upload or mapping"), not entities named anywhere in Table 12 — see
  `packages/db/prisma/schema.prisma`'s migration note for why `Sync Job`
  (the one entity shaped like observable batch state) doesn't fit: its own
  `connection` field makes it connector-specific.
- **Target fields**: `legalName` (the only required one), `displayName`,
  `segment`, `domains` (Partner's fields) plus `motion`, `objective`,
  `cadence`, `ownerEmail`, `sponsorEmail` (Partnership's fields, resolved
  against active tenant members by exact email match at commit time — an
  unmatched email silently leaves the field unset rather than rejecting the
  row, since owner/sponsor aren't required until Qualified anyway).
  `program` isn't a target field for the same reason it isn't a Partnership
  field yet (see the Partnership section above) — Program doesn't exist.
- **A committed import creates a Partnership at Prospect alongside the
  Partner, but never activates it.** FLOW-A's own primary flow treats
  import and activation as two separate, sequential steps — "system commits
  valid partner and relationship records" happens before "manager opens a
  relationship... activates." Activation stays exactly the existing,
  already-built manual per-relationship flow (Roadmap Phase 2 item 5); CSV
  import's job is populating the portfolio in bulk, not bulk-activating it
  (bulk operations generally — PORT-06 — are P1 and deferred anyway).
- **Duplicate detection (IMP-05) is exact-name-or-domain-overlap, not fuzzy
  matching.** Exact = normalized legal name matches an existing partner
  _or_ an earlier row already in the same file (a within-batch duplicate is
  just as real as a cross-batch one) → disposition `UPDATE` (existing
  partner refreshed) or `SKIP` (in-batch dupe). Probable = no name match
  but a mapped domain overlaps an existing partner's domains → `SKIP` with
  an explainable reason. A Levenshtein/fuzzy-matching engine is out of
  scope — domain overlap is a real, explainable signal without one.
- **The only per-row user action is forcing a `SKIP` row to import anyway**
  (`ImportRow.forceCreate`). FLOW-A's exception behavior names three
  options for an ambiguous duplicate — "merge, link as separate program
  relationship, or reject" — merge (PORT-08) and program-linking both need
  mechanisms that don't exist yet; "force create anyway" is the one option
  buildable today, and leaving a row un-forced is equivalent to "reject."
- **Commit is idempotent via batch/row state, not a generic Idempotency-Key
  cache.** §8.1 lists `Idempotency-Key` as required for imports; T-003
  requires "second commit returns existing result; no duplicates." Since
  `ImportBatch.status` flips to `COMMITTED` and every committed row records
  its `committedPartnerId`, re-invoking commit on an already-committed
  batch is a no-op that returns the same result by construction — see
  `ImportsService.commit`. A generic header-keyed response-replay cache
  would add real infrastructure to re-solve a problem the batch's own state
  already solves for this specific endpoint's actual risk (double
  processing on a client retry).
- **Provenance (IMP-10, and FLOW-A's own acceptance criterion) is row-level,
  not per-field.** `ImportRow.rawData` (the full source row) plus its
  `batchId` answers "what did this come from" for every value on the
  resulting Partner/Partnership; a separate per-field provenance table
  (IMP-10's fuller "record exposes source batch and timestamp" ask, P1) is
  deferred.
- **Rejected rows stay downloadable** (`GET .../rejected.csv`) — a plain CSV
  of `REJECT`-disposition rows with their reason and raw source columns,
  satisfying FLOW-A's stated acceptance criterion. IMP-08's richer
  "field, value, code, correction" structure is its own P1 item and is not
  what's built.
- **Rollback (IMP-09) is deferred** — P1, and not part of FLOW-A's primary
  flow or acceptance criteria.
- **RBAC: import (upload/map/force-row/commit) is Owner/Admin only** —
  narrower than Partnership's Owner/Admin/Manager write set. §2.3's
  capability matrix has no row named "Import"; S03's own screen-actor field
  (Table 11) names "Admin" specifically, while FLOW-A's broader actor line
  ("Tenant Admin and Partnership Manager") covers the _whole_ golden
  workflow, including the later manual-activation step Managers already do
  through the existing Partnership UI. The narrower, more specific reading
  governs the import action itself. Batch read (viewing past imports,
  downloading rejected rows) follows "Portfolio read," same as
  Partner/Partnership.
- **Row/file limits are placeholders**: 1,000 rows, 2 MB. IMP-01 says
  "configured row/file limits" without a number — real per-tenant
  configuration is ADM-07 territory, not built. Chosen well under §9.4's
  eventual 10k-row/10-minute performance benchmark.
- **Status codes match §8.2's endpoint catalog literally**: `202` for both
  upload and commit (even though this implementation processes
  synchronously rather than queuing a background job — 202 is still the
  PRD's specified code for these two routes), `413` file too large, `415`
  wrong file type, `422` parse/validation failure, `409` committing before
  a mapping exists.

## Initiative, Milestone, Action and Blocker — scope cuts and interpretation calls

PRD grounding: §5.2 Golden Workflow B (FLOW-B, its first two primary-flow
steps — the rest is Review/Decision, Roadmap item 8, and Outcome
verification, Roadmap item 9, Phase 4); Table 12 (core entities); Table 13
(state machines); Table 67 (per-field `Required` column); INIT-01–10; T-007;
Table 10 (nav surfaces); §2.3's capability matrix.

- **`Milestone` is Initiative's child object, not a Table-12 top-level
  entity** — INIT-02's own text ("create ordered milestones") describes it
  as something an initiative has, and Table 12 lists only `Initiative` and
  `Action`. **`Blocker` (the roadmap item's own fourth noun) is Action's own
  `BLOCKED` status plus a reason field**, not a fifth/separate entity —
  INIT-04 lists "blocker" alongside "status, due date, completion note" as
  one of several fields to update on an Action, and Table 13's Action state
  machine already has `Blocked` as one of Action's own stages. Modeling
  either as a standalone table would be inventing structure the PRD doesn't
  describe. See `packages/db/prisma/schema.prisma`'s migration note.
- **Both state machines allow a recovery move Table 13 never draws** —
  Initiative's Active⇄Blocked and Action's In Progress⇄Blocked — for the
  same reason documented for Partnership: a strictly forward-only reading
  would make an unblocked initiative or action unable to resume, which
  defeats the point of tracking a blocker in the first place. Terminal exits
  (Cancelled for both) are reachable from any non-terminal state, not only
  the "last" one before it, matching the same "ending shouldn't require
  walking every intermediate stage" reasoning used for Partnership and CSV
  Import.
- **INIT-07's "outcome disposition" is stood in for by
  `completionDisposition`** (`ACHIEVED`/`PARTIALLY_ACHIEVED`/
  `NOT_ACHIEVED`) rather than a real link to an `Outcome` record — the
  `Outcome` entity, with its own verification workflow (draft → submitted →
  verified/rejected, a separate verifier role, evidence requirements), is
  Phase 4 (Roadmap item 9), not built yet. This mirrors how Partnership's
  own activation invariant already had to exclude INIT's own forward
  reference ("first initiative") back when Initiative itself didn't exist —
  each feature is grounded against what actually exists at the time it's
  built, not against later phases' entities.
- **INIT-07's "remaining-work treatment" is a real, required completion-time
  decision** (`remainingActionsTreatment`: `CANCEL_REMAINING` cancels every
  Action still `OPEN`/`IN_PROGRESS`; `LEAVE_OPEN` leaves them as-is) —
  distinct from the blocking-action gate below. Only `OPEN`/`IN_PROGRESS`
  actions are affected; a still-`BLOCKED` action is a different concern
  (the gate immediately below) and is never silently auto-cancelled by this
  choice.
- **T-007 / FLOW-B's stated acceptance criterion is implemented literally**:
  "Initiative cannot complete with unresolved blocking actions unless an
  authorized override is documented." Completing (`stage: COMPLETED`) checks
  specifically for Actions in `BLOCKED` status (not any incomplete status —
  `OPEN`/`IN_PROGRESS` actions are governed by `remainingActionsTreatment`
  instead, not by this gate) and requires a non-empty
  `completionOverrideReason` if any exist. Only the latest override reason
  is kept, same simplification as `Partnership.lastTransitionReason` and
  `ImportRow.rejectReason` — a full audit trail is Audit Timeline's job
  (Roadmap Phase 4), not this table's.
- **`successMeasure` is unshaped JSON**, same reason as `Partner.identifiers`
  — Table 67 says "Structured/text" without naming a schema. The web UI
  collects `{type, target, unit}` (a `date` field was named by Table 67 too
  but the create/edit forms don't expose one yet — deferred, not load-
  bearing for any gate) through three plain inputs and assembles the object
  client-side; the server stores and gates on presence only, never
  interprets its shape.
- **`Action.assigneeUserId`/`assigneeExternalName` are both optional, but
  the service requires at least one** — INIT-03 explicitly allows assigning
  to "members or referenced counterpart owners," and Table 67 confirms
  ("Authorized user or external reference"). No external-contact entity
  exists to link an external assignee to instead, so it's a plain free-text
  name, validated only for non-emptiness. An internal `assigneeUserId` is
  validated against the tenant's ACTIVE memberships (not just any UUID).
- **RBAC is a real, different matrix row from Partnership's, not a borrowed
  shape**: §2.3's "Initiatives/actions" row is Admin=Yes, Executive=Read,
  Manager=Yes, **Reviewer=No**, Guest="Shared items". Reviewer having zero
  access (unlike "Portfolio read," which gives Reviewer a scoped view) is a
  meaningful difference from every other module built so far — checked
  against the actual row rather than assumed, and applied consistently:
  hidden from Reviewer in `AppShell`'s nav (not just Guest, as elsewhere)
  and denied server-side by the same `READ_ROLES` array.
- **"Initiatives" is a real, dedicated top-level nav surface** — Table 10
  names it directly ("Cross-partnership initiative list, milestones,
  actions, blockers and review schedule"), unlike Partner/Partnership which
  reused the existing "Partnerships" surface per §3.1's own IA. The
  `comingLater` placeholder from Phase 0 is flipped to a real route,
  `/initiatives`, gated to the roles above.
- **Scope cut against INIT-01–10**: only the P0 items are built — INIT-01
  (create), INIT-02 (milestones), INIT-03 (assign actions), INIT-04 (update
  action fields), INIT-06 (controlled transitions) and INIT-07 (completion
  gate). INIT-05 (overdue/blocker detection, P1 — no notification
  infrastructure exists anywhere in this codebase yet, consistent with
  Authentication's own "no real email provider" decision), INIT-08
  (activity/timeline view, P1), INIT-09 (bulk update, P2/R1.1) and INIT-10
  (clone initiative, P2/R1.1) are all explicitly P1/P2 in the PRD's own
  release column and deferred. Table 13's "evidence can be mandatory by
  action type" (part of Action's `Done` enforcement) is not implemented —
  the `Evidence` entity doesn't exist yet (Phase 4).
- **`initiative_created`'s PRD-named `objective_type` field isn't modeled**
  — no PRD text anywhere defines a taxonomy for it (the same ADM-05-not-
  built reason `Partner.segment`/`Partnership.motion` stay free text), so
  it's logged as a fixed placeholder rather than invented. `initiative_created`
  and `initiative_status_changed` (§5.2's required analytics events) are
  both logged via `Logger`, the same mechanism used for every prior
  feature's analytics requirements — see the Partnership/CSV Import
  sections above for why this is proportionate ahead of a real events
  pipeline (Phase 4).

## Review, Decision, and Follow-up Actions — scope cuts and interpretation calls

PRD grounding: §5.2 Golden Workflow B's middle steps (review preparation
through decision recording — the first two steps, Initiative/Action, were
grounded for Roadmap item 7; outcome verification is item 9, Phase 4); S08
(Review workspace)/S09 (Decision record); Table 12 (core entities); Table 13
(Review's state machine); Table 67 (per-field `Required` column); REV-01–06;
DEC-01–03; T-008; §2.3's capability matrix.

- **"Follow-up Actions" (the roadmap item's own third noun) reuses the
  existing `Action` entity wholesale** — `Action.initiativeId` is now
  optional and `Action.reviewId` was added (both optional; the service
  requires at least one). FLOW-B's own text — "review owner records
  decisions and follow-ups; each item has owner and effective/due date" —
  describes a follow-up as a peer of a decision inside a review, not
  something tied to a specific initiative. Inventing a second "Follow-up
  Action" entity next to the already-built `Action` (identical shape: a
  title, an assignee, a status/blocker state, a due date) would duplicate
  it for no PRD-grounded reason. This required a small refactor: Action
  creation now happens through two nested routes (`.../initiatives/:id/actions`,
  `.../reviews/:id/actions`) that both call the same `ActionsService.create`,
  and Action _updates_ moved from the initiative-nested route to a flat
  `PATCH /tenants/:tenantId/actions/:actionId` — a single action may now
  belong to a review instead of an initiative, so one update route serves
  both contexts rather than duplicating the handler.
- **Review's state machine is taken completely literally — no PRD-
  undocumented recovery move this time.** Every other state machine built so
  far (Partnership, Initiative, Action) added a documented deviation
  (Active⇄At Risk, Active⇄Blocked, In Progress⇄Blocked) because a strictly
  forward-only reading would make an exception state permanent. Nothing in
  the PRD suggests Review has an equivalent "stuck" state to recover from —
  Scheduled → In Preparation → In Progress → Completed is a genuinely linear
  process (you don't un-prepare a review), so `ReviewsService` implements
  Table 13's path exactly as drawn. `Reopened` is kept as a real enum value
  (Table 13 lists it) but no transition reaches it — REV-06 ("reopen a
  completed review as a revision without mutating the original snapshot")
  is P1 and deferred; building the enum value without the mechanism means a
  future REV-06 implementation isn't a breaking schema change.
- **The snapshot gets its own generated id, distinct from the review's
  id.** Table 67 describes it as "an immutable source-version set" with its
  own `snapshot_id` (`Unique`) — `Review.snapshotId` is a fresh
  `crypto.randomUUID()` generated at the moment of capture (the Scheduled →
  In Preparation transition), not a reuse of `Review.id`. The captured
  `snapshot` JSON itself holds the partnership's stage/health/next-review
  plus every linked initiative's id/objective/stage/health at that moment —
  a real, literal implementation of REV-02 ("prepare review snapshot of
  health, progress... "), not a placeholder.
- **T-008's completion gate is implemented literally, and differently from
  Initiative's own completion gate.** T-008 ("complete review without next
  actions/decision handling") and REV-05/Table 13 ("completed requires
  snapshot, decisions/follow-ups and next cadence handling") together read
  as: completing a review requires a `nextReviewAt` date, and is flatly
  **blocked** (422, no override) if any linked Decision is still
  `PENDING_APPROVAL` or any linked follow-up Action is still `OPEN`/
  `IN_PROGRESS`/`BLOCKED`. Unlike Initiative's T-007 gate, no PRD text
  anywhere describes an authorized-override path for completing a review
  with open items — so none was built; the caller must resolve every
  pending decision and follow-up first. On success, `nextReviewAt` is
  propagated onto the parent Partnership's own `nextReviewAt` field
  (already built in the Partnership feature) — the concrete mechanism
  behind "next cadence handling."
- **DEC-02's approval workflow is Decision's own real, literal
  implementation of separation of duties (INV-004)** —
  `requiresApproval`/`status`/`approvedById`/`approvalNote`. A decision that
  doesn't require approval goes straight to `RECORDED`; one that does starts
  `PENDING_APPROVAL` and can only move to `APPROVED`/`REJECTED` by a caller
  who is (a) in `APPROVE_ROLES` and (b) not the decision's own creator — a
  self-approval attempt is rejected regardless of role. Verified live: an
  Admin who both created and then tried to approve their own restricted
  decision got the self-approval rejection before the role check even ran.
- **§2.3's "Decisions" row makes Executive's "Approve" cell _real_
  capability for the first time** — unlike Partnership's and CSV Import's
  own "Approve"/"Executive" cells, both deliberately deferred because no
  approval workflow existed yet to give them a real action. Decision _is_
  that workflow, so the row is honored literally: `APPROVE_ROLES =
[OWNER, EXECUTIVE]` — Admin's own cell is "Configure" (a policy-setup
  capability this phase doesn't build a surface for), not "Approve," so
  Admin is deliberately excluded from approval rights despite being
  bundled with Owner in every other module's write-role set so far. The
  single `PATCH /tenants/:tenantId/decisions/:decisionId` route is reachable
  by the union of "draft/record" and "approve" roles (`OWNER`, `ADMIN`,
  `MANAGER`, `EXECUTIVE`), since a route-level guard can't express two
  different role sets for one endpoint — `DecisionsService.update` itself
  then rejects an Executive's attempt to edit plain fields (not their own
  capability) and a non-Owner/Executive's attempt to approve, keeping the
  matrix's actual shape intact despite the shared route.
- **Review borrows "Initiatives/actions" RBAC** (Admin=Yes, Executive=Read,
  Manager=Yes, **Reviewer=No**, Guest=Shared items) — no PRD matrix row is
  named "Reviews," and S08 sits alongside S07 in the screen inventory as
  part of the same execution-workflow capability area, not "Portfolio read"
  or "Decisions" (which, notably, _does_ give Reviewer read access — a real
  difference between the two borrowed/native rows, not an oversight).
- **Scope cut against REV-01–06/DEC-01–03**: built are REV-01 (schedule),
  REV-02 (snapshot), REV-04 (notes with classification — the classification
  is recorded but not yet enforced against any export/share mechanism,
  since none exists), REV-05 (completion gate), DEC-01 (record) and DEC-02
  (approval/separation of duties) — all P0. REV-03 (agenda items linking to
  initiatives/actions/obligations/claims/outcomes — most of those entities
  don't exist yet, and it's P1 anyway), REV-06 (reopen as revision, P1) and
  DEC-03 (supersede a decision while preserving prior history, P1) are
  deferred. `Decision.type` is free text (no ADM-05 taxonomy exists, same
  as `Partnership.motion`); the "required fields vary by decision type"
  nuance in DEC-01/Table 67 has nothing to vary against without a
  taxonomy, so validation is flat regardless of type.

## Evidence, Outcome, and Verification — scope cuts and interpretation calls

- **Two distinct entities, not one.** Table 12 lists Contribution
  ("Observed partner input"; fields `type, actor, date, linked objects,
narrative`) and Evidence ("Provenance-linked support"; fields `source,
checksum, classification, observed_at, verifier`) as separate rows, and
  S11's own stated goal — "Evidence record | Prove contribution" — reads as
  Evidence being the proof attached to a Contribution's claim, not a
  synonym for it. `Contribution` and `Evidence` are modeled as separate
  Prisma models rather than folded into one, unlike the earlier
  entity-reuse calls (Milestone/Blocker into Initiative/Action) where the
  PRD's own Table 12 entity list didn't name them as top-level entities at
  all — here it does, for both.
- **"Partner" in EVD-01 is read as Partnership.** EVD-01 says "linked to
  partner, initiative, action or outcome," but every other feature so far
  (Review, Decision) has treated "the partner relationship" as the governed
  `Partnership`, not the bare `Partner` company record — `Contribution`
  keeps that same reading (`partnershipId`, not `partnerId`) for
  consistency rather than introducing a new link shape this late.
- **Contribution's and Evidence's links are both "at least one of several
  optional foreign keys," the by-now-standard shape** (Action:
  initiativeId/reviewId; Decision: partnershipId required +
  reviewId/initiativeId optional). Contribution needs one of
  partnershipId/initiativeId/actionId/outcomeId (EVD-01's own four link
  targets); Evidence needs one of contributionId/outcomeId — the second
  because INV-003 ("an outcome cannot be Verified without at least one
  accessible evidence record") is checked by querying
  `Evidence` directly by `outcomeId`, not by walking through a
  Contribution — evidence proving an outcome's result doesn't always trace
  back through a specific contribution claim.
- **Classification is the same two-tier `INTERNAL`/`SHAREABLE` enum
  REV-04 already established for Review notes**, reused verbatim for both
  Contribution.classification and Evidence.classification (a new
  `EvidenceClassification` enum, same two values). Table 12 names "Private/
  shareable" for Contribution and "Classified" for Evidence, and EVD-03
  talks about evidence "above grant classification," which reads as a
  graded scheme — but no richer taxonomy is spelled out anywhere in the
  PRD (ADM-05, taxonomy configuration, is P1/deferred, the same gap behind
  Partner.segment and Decision.type staying free text), and REV-04's own
  literal text ("internal/shareable classification") is the only concrete
  precedent this document has. Inventing an unnamed third tier would be a
  bigger leap than reusing the one the PRD already spells out.
- **Outcome's state machine reads Table 13's chain as a reachability list,
  not a strict sequence.** The literal chain (Draft → Submitted →
  Verification Required → Verified → Rejected → Superseded) is drawn as one
  arrow-chain the same way every other object's row is, but OUT-03 itself
  requires three different verifier actions from Submitted (verify, reject,
  or request more evidence) — that can't be a strict linear sequence.
  `VALID_TRANSITIONS` in `outcomes.service.ts` implements: `DRAFT →
[SUBMITTED]`, `SUBMITTED → [VERIFIED, REJECTED, VERIFICATION_REQUIRED]`,
  and — the one genuinely _added_ move, the same "documented deviation"
  judgment call made for Partnership/Initiative/Action/Action-again —
  `VERIFICATION_REQUIRED → [SUBMITTED]`, since a verifier bouncing an
  outcome back for more evidence is meaningless unless the manager can
  resubmit it. `VERIFIED`, `REJECTED` and `SUPERSEDED` are terminal;
  `SUPERSEDED` specifically is reachable per Table 13's state list but has
  no transition path reaching it, the same treatment `ReviewStage.REOPENED`
  already gets, since OUT-04 ("supersede a verified outcome through new
  version and re-verification") is P1 and deferred.
- **Verification carries a separation-of-duties gate structurally identical
  to Decision's DEC-02/INV-004 pattern, applied here for INV-003 and
  T-010** ("Creator self-verifies under separation policy | 403; assignment
  remains open | Block"): the outcome's own creator can never verify,
  reject, or request more evidence on it — checked before the
  role/assignment check, exactly like Decision's self-approval block — and
  this was verified live end-to-end with two real accounts (not just unit
  tests), including confirming the client UI hides the verification
  actions for the creator _and_ that a direct API call from that same
  session still gets a 403.
- **§2.3's "Evidence/outcomes" row is a genuinely different RBAC shape from
  every prior module**, not borrowed from a neighbor: `Admin=Admin (full),
Executive=Read, Manager=Create, Reviewer=Verify if assigned,
Guest=Contribute if granted`. Two things stand out against precedent:
  Reviewer gets a _real_ capability here (unlike Initiatives/Reviews, which
  deny Reviewer outright) — but it's assignment-gated, not a blanket read;
  `OutcomesController`/`ContributionsController`/`EvidenceController` all
  admit Reviewer for GET routes (simplified to full read rather than
  filtered to "only what they're assigned to," the same simplification
  already applied to Portfolio read's "Scoped" cell for Reviewer), while
  the actual verify action is gated in the service against
  `Outcome.verifierId === actingUserId` for Reviewer specifically — Admin/
  Owner's "Admin" cell has no such assignment restriction, matching the
  "Admin beats a narrower role's gate" pattern used everywhere else. Guest's
  "Contribute if granted" needs the Share Grant mechanism (R1.1, not
  built), so Guest is denied entirely — the same treatment every other
  module's "if granted"/"if shared" cell gets — and the
  `evidence-outcomes` nav item is hidden for Guest only (not Reviewer,
  unlike Initiatives/Reviews) in `AppShell.tsx`.
- **`verifierId` submission requires the assignee to already hold an
  authorized-verifier role** (`OWNER`, `ADMIN`, or `REVIEWER`) — checked at
  submit time (OUT-02), not deferred to the verification action itself, so
  a manager gets an immediate, actionable error ("must be an owner, admin
  or reviewer") instead of successfully submitting to someone who could
  never legally verify it.
- **File storage is local disk, not real object storage.** The PRD's own
  architectural principle ("Files live in object storage. Database records
  hold metadata, classification, checksum and storage pointer—not binary
  content") is honored at the _shape_ level — `Evidence` stores only
  `storageKey`/`fileName`/`mimeType`/`sizeBytes`/`checksum`, never binary
  content, in the database — but the storage backend itself is
  `apps/api/var/evidence-storage/<tenantId>/<storageKey>` on local disk
  (gitignored), the same proportionate MVP substitution local Postgres
  already is for a managed database elsewhere in this codebase. No object
  storage integration (S3 or equivalent) exists anywhere in this codebase
  yet — adding one is out of scope for an application-layer feature and
  would be its own infrastructure decision. EVD-02's "malware, type and
  access checks pass" gate is scoped to type (an allowlist of common
  document/image MIME types) and size (25 MB, `request.file()`'s
  per-call `limits` override, mirroring how CSV Import sets its own
  file-size cap); real malware/AV scanning is deferred with the same
  reasoning "no transactional email provider" got for password-reset
  delivery — no such service is integrated anywhere in this codebase.
- **Evidence upload is a separate request from evidence creation**
  (`POST .../evidence` creates the metadata record; a follow-up
  `POST .../evidence/:id/file` attaches the material file), rather than one
  multipart request mixing JSON fields and a file. `@fastify/multipart`'s
  `request.file()` only reliably captures companion form fields that
  arrive _before_ the file part in the multipart stream, which makes a
  single mixed-field-plus-file request brittle to depend on; two plain
  requests (the first identical in shape to every other JSON `POST` in this
  codebase, the second identical in shape to CSV Import's own upload route)
  avoids that fragility entirely.
- **EVD-04's version/replacement chain never overwrites a stored file.**
  `Evidence.replacesEvidenceId` is a self-relation (`@unique`, so the chain
  stays a simple linked list); `EvidenceService.replace()` creates a _new_
  row carrying the prior evidence's links forward, rather than mutating the
  original row or its file on disk — the original stays on disk and in the
  database, byte-for-byte, exactly as `INV-00`-adjacent invariants around
  "checksum/history reconstructable" require. The web UI's `client.ts`
  exposes `replaceEvidence`, but no dialog wires it up yet in this phase —
  no PRD screen mock exists for a "replace" flow beyond the requirement
  text itself, so it's deferred rather than designed from scratch without
  a reference.
- **OUT-01's "type-specific validation applied" gate is scoped to one
  generic rule**, not a per-type rule table: a claimed `value` requires its
  `unit` and vice versa. No PRD-named type taxonomy exists to define
  richer per-type validation (the same ADM-05-not-built gap as
  `Decision.type` and `Contribution.type`/`Outcome.type` staying free
  text) — this generic pair-check is the one rule that's true regardless
  of type.
- **OUT-05 ("use only verified outcomes in executive value metrics by
  default") has no consumer to apply it to yet.** The Command Center
  dashboard (Roadmap item 11, Phase 5) is what would actually query and
  filter outcomes for portfolio metrics — it doesn't exist yet, so there's
  nothing to gate. `Outcome.status` is queryable and indexed today
  (`@@index([tenantId])` plus the model's own filters); Command Center's
  own build must default every metric query to `status: 'VERIFIED'` when
  it lands.
- **FLOW-B's closing clause — "executive records invest/remediate/
  renegotiate/exit decision" after outcome verification — is not wired
  as an automatic or even suggested next step.** `Decision` already models
  exactly this (a governed choice against a Partnership/Initiative,
  Executive-approvable), but creating a `Decision` today only has a
  dedicated route nested under a `Review`
  (`POST .../reviews/:reviewId/decisions`) — FLOW-B's text doesn't say this
  follow-up decision must happen inside a review, and no requirement ID
  (OUT-xx or DEC-xx) makes a flat, review-independent decision-creation
  route a stated P0 acceptance gate. Rather than inventing a new creation
  path this phase's requirement list never asks for, the connection is
  left as an operational fact for the next review cycle to pick up
  naturally, not a system-enforced one.
- **Scope cut against EVD-01–05/OUT-01–05**: built are EVD-01 (contribution
  creation), EVD-02 (evidence upload/reference), EVD-04 (version chain),
  OUT-01 (create), OUT-02 (submit), OUT-03 (verify/reject/request more
  evidence) and OUT-05 (as a queryable filter, per the note above) — all
  P0. EVD-03 (external-share classification enforcement, R1.1 — no
  external sharing exists yet to enforce anything against) and EVD-05
  (mark evidence stale/inaccessible/disputed, P1) are deferred; OUT-04
  (supersede a verified outcome, P1) is deferred, with `SUPERSEDED` kept
  reachable-but-unreached in the enum for the same reason
  `ReviewStage.REOPENED` is. As with every prior feature, S11/S12's own
  screen-row requirement-ID ranges (`EVD-01–09`, `OUT-01–09`) overstate
  what Table 26 actually contains — it stops at `EVD-05`/`OUT-05`, the same
  aspirational-range pattern found in every previous feature's requirement
  table.

## Audit Timeline and Audit Search — scope cuts and interpretation calls

- **`recordAuditEvent` is a plain function, not a NestJS-injected service.**
  AUD-01 requires appending a material event for essentially every mutation
  across every already-built module (14 services in the end: Tenant,
  Membership, Invitation, Auth's invitation-acceptance path, Partner,
  Partnership, ImportBatch, Initiative, Milestone, Action, Review, Decision,
  Contribution, Evidence, Outcome). Constructor-injecting an `AuditService`
  into all 14 would have meant either making every one of them a
  request-scoped provider (since a provider that depends on a
  request-scoped one becomes request-scoped itself — a real, codebase-wide
  performance/behavior change disproportionate to this feature) or adding a
  new constructor to services that currently have none at all, which would
  break every existing `new XService()` call across ~10 existing unit test
  files. Exporting `recordAuditEvent` as a plain async function — imported
  and called directly, the exact "singleton import, not DI" pattern
  `prisma` itself already uses everywhere in this codebase — sidesteps
  both problems: no constructor signature changes anywhere, and (see next
  point) no existing test needed to change either.
- **A failed audit write never fails the business mutation it describes.**
  `recordAuditEvent` catches and logs internally rather than throwing —
  the mutation this call follows has already committed by the time it
  runs, so a transient audit-write failure (or, during the retrofit, a
  test's `@revn/db` mock simply not defining `auditEvent`) degrades to a
  logged warning, never a thrown exception. This is also what let all ~14
  services gain a `recordAuditEvent` call without touching a single one of
  their existing unit tests' `@revn/db` mocks — every pre-existing test
  still passes unchanged, the audit call just silently no-ops against an
  undefined `prisma.auditEvent` in that test's mock. New, dedicated tests
  (`audit.service.test.ts`) cover `recordAuditEvent`/`listAuditEvents`
  directly instead.
- **"Material" is scoped to entity creation and lifecycle/state
  transitions, not every field edit.** AUD-01 says "material events," not
  "every mutation" — the retrofit follows the boundary this codebase had
  already drawn for itself: every existing `this.logger.log('..._created'
| '..._completed' | ...)` analytics-event call (Partnership, Initiative,
  Review, Decision, Outcome) marks exactly this boundary already, so
  `recordAuditEvent` calls were added alongside every one of those, plus
  the same create/transition boundary for entities that had no analytics
  log yet (Tenant, Membership, Invitation, Partner, ImportBatch, Milestone,
  Action, Contribution, Evidence). A plain field-only edit (e.g. changing
  a Partnership's `objective` text with no stage change) does not get its
  own audit event.
- **`AuditEvent.correlationId` self-correlates (defaults to a fresh id per
  event) rather than threading the HTTP request's own `x-correlation-id`
  header through every call site.** That header-based infrastructure
  already exists (`common/correlation-id.ts`, echoed on every response),
  but reaching it from inside a plain-function `recordAuditEvent` call
  buried deep in a domain service would require passing the request's
  correlation id down through every one of ~20 mutating controller→service
  call chains — a much larger, more invasive retrofit than adding one
  function call per mutation. Table 67 asks for "a correlation id," which
  the self-generated column satisfies for the single-event granularity
  AUD-02's search already supports; grouping multiple audit events (and
  the existing console analytics-log line) from one logical operation
  under one shared id is a documented, deferred refinement, not built here.
- **`before`/`after` are stored as plain Prisma `Json`, not the "Encrypted
  JSON" Table 67 asks for.** No field-level encryption-at-rest layer
  exists anywhere in this codebase — the same category of infra gap as
  Evidence's "no object storage integration" (EVD-02) and Authentication's
  "no transactional email provider." Documented as deferred hardening, not
  silently dropped.
- **§2.3's "Audit/export" row is scoped in the service layer, not just
  gated at the route.** Unlike every prior feature's RBAC (a role either
  can or cannot reach a route), this row's cells are genuinely different
  _scopes_ for the same route: Admin=Admin (full), Executive=Portfolio
  (full read), Manager=Own scope, Reviewer=Assigned scope, Guest=No.
  `listAuditEvents`/`getAuditEvent` force `actorId` to the caller's own id
  for Manager/Reviewer regardless of what filter value they pass — a
  caller-supplied `actorId` is honored only for the two full-read roles.
  A new `CurrentMembership` param decorator
  (`modules/identity-tenant/tenants/decorators/current-membership.decorator.ts`)
  exposes `RoleGuard`'s already-resolved `request.membership` to the
  controller — the first feature that actually needs the caller's real
  role inside a handler rather than just an allow/deny at the guard.
- **"Assigned scope" (Reviewer) is read as the same actor-filtered scope
  "Own scope" (Manager) gets**, not a bespoke per-object-type assignment
  join. No generic way exists to compute "every object this Reviewer is
  assigned to" across heterogeneous object types (`Outcome.verifierId`,
  `Review.participantUserIds`, and whatever future modules add) without a
  hand-written join per object type — disproportionate for this phase, and
  Table 67/S16 name no more specific definition of "assigned" than the
  screen's own "Auditor" persona (Table 7's "Verifier/Auditor" — the same
  real-world role already mapped onto this app's Reviewer role for
  Evidence/Outcomes verification) already implies: an auditor generally
  reviews what passed through their own hands.
- **Table 10 names "Audit" as page _content_ inside "Administration," but
  it became a real, independent top-level nav item (`/audit`) instead of a
  sub-page.** Every role but Guest gets _some_ real Audit access per
  §2.3 — Executive/Manager/Reviewer included — but Administration itself
  really is owner/admin only (member/role management). Folding Audit into
  the Administration page the way Partner was folded into Partnerships or
  Decision into Review workspaces only works when the destination
  surface's own RBAC already matches — here it doesn't, so a real,
  independently-gated nav item was added instead, the opposite call from
  those two precedents.
- **No export.** AUD-03 ("export audit evidence... without mutating log")
  is P1 and deferred, same treatment as every other P1 item across this
  codebase — S16's own screen flow ends with an export step this phase
  doesn't build.
- **T-021 (reconstruct an approved claim after adjustment) isn't literally
  testable yet** — it names `Claim`, revenue-share rule versions and
  adjustment corrections, none of which exist (Revenue-Share Pack is
  explicitly "Later," gated behind proof per PRD §18, per `docs/ROADMAP.md`).
  The underlying capability T-021 is really testing — reconstruct a
  decision's full history via correlation/before-after across linked
  events — is exercised today by the Outcome verification flow instead
  (`outcome_created` → `outcome_submitted` → `outcome_verified`, each with
  its own before/after), the closest built analog.

## Command Center — scope cuts and interpretation calls

- **DASH-01–06 doesn't exist anywhere in the requirements backlog** — the
  most extreme case yet of the "screen-row requirement range is
  aspirational" pattern every prior feature's grounding turned up (Section
  6 of the backlog runs 6.1 through 6.11 by name — Tenant/identity,
  import, portfolio lifecycle, partnership workspace, initiatives, reviews,
  evidence/outcomes, agreements, revenue-share, external sharing,
  integrations/reporting/audit — and none of them is "Command Center" or
  "Dashboard"). This feature is grounded entirely in Table 10's one-line
  surface description, Table 31's S04 screen spec ("KPI strip → exceptions
  → reviews due → decisions → initiatives → integration health"; states
  "No data; stale sync; partial metrics; restricted finance data"), and
  US-006 ("Lead | view portfolio attention queue | PORT/RPT | P0") — which
  traces Command Center to Portfolio-read/Reporting, not a domain of its
  own, confirming it aggregates already-built data rather than owning any.
- **No new entities, no new module-owned tables.** `DashboardService.get()`
  is pure read-aggregation across Partnership, Initiative, Action,
  Decision and Outcome — every count and list is a query against data
  another feature already owns and writes. This is the first
  `intelligence`-module feature, matching Table `746`'s own description of
  that module ("Metrics, derived signals, reports | Read models/events; no
  source ownership") — a narrow, operational slice of it, not the
  "cross-company intelligence" (matchmaking, shared graph, benchmarking)
  PRD §18 explicitly defers to "Later"; those two are different scopes
  under the same module boundary, not the same deferral.
- **"Integration health" and "restricted finance data" render their own
  literal empty/N-A states rather than being faked.** No `integrations`
  connection has ever been created (that module is still entirely
  reserved) and no finance-bearing object exists yet (Revenue Share is
  "Later," gated behind proof per §18) — so the dashboard's own required
  "No data" state (Table 31) is satisfied by the real absence of that
  data, using the same `EmptyState` component and "no blank dashboards,
  explain why it matters" doctrine (PRD §3.2) already established
  elsewhere, not a placeholder metric invented to fill the section.
- **"Reviews due" reads `Partnership.nextReviewAt` directly, not
  `Review.stage`.** Every prior feature already treats `nextReviewAt` as
  the authoritative "when's the next review" signal — set when a
  Partnership activates, propagated forward every time a Review completes
  — so querying it directly is more accurate than inferring due-ness from
  a Review record's own stage (a Partnership can be due for review before
  anyone has scheduled the next `Review` row at all). "Due soon" is a
  7-day window; no PRD-named cutoff exists for "soon," so this is a
  documented, reasonable default rather than a literal requirement.
- **"Initiatives" (the dashboard's own section, distinct from
  "Exceptions") means blocked-or-overdue, not just blocked.** S04's flow
  lists "exceptions" and "initiatives" as two separate steps — reading
  them as two different filters (exceptions = every kind of exception
  state across every entity; initiatives = specifically initiatives
  needing attention, a slightly broader set than "blocked" alone) keeps
  the two sections from being redundant. An initiative that's both
  blocked and overdue is de-duplicated by id, since it would otherwise
  appear to double-count.
- **KPI counts are computed with dedicated `count()` queries, never
  derived from a capped display list's length.** Every list section is
  capped at 10 rows for the dashboard's own "at a glance" purpose (Table
  31's "large query" required state — S04 is a summary, not the true list;
  each KPI card links to the real, uncapped list page for that data), but
  the KPI number itself always reflects the true total, queried
  separately — verified with a dedicated test asserting the two diverge
  correctly when more than 10 rows exist.
- **RBAC borrows "Portfolio read"'s shape** — no PRD matrix row is named
  "Command Center" and US-006 traces it to PORT/RPT, the same trace
  Partner borrowed when grounding its own RBAC. Reviewer is included (the
  same "Scoped" cell, already simplified to full read everywhere else this
  shape was borrowed); Guest is excluded (needs the Share Grant mechanism,
  not built). Since `/` is every authenticated user's default landing
  page — not a link a Guest chose to follow — a Guest session sees a
  lighter "nothing shared with you yet" message here rather than the hard
  `ForbiddenState` every other Guest-denied route uses; that distinction
  is deliberate; the API route itself still returns a real 403.
- **This is the first feature to overwrite `apps/web/app/[locale]/(app)/page.tsx`
  wholesale** rather than adding a new route — the Phase-0 "Foundation"
  placeholder and its `home` translation namespace are both removed
  entirely, since Command Center's nav item has pointed at `/` since the
  app shell was first built (Table 10 names it the landing surface) and a
  real feature now owns that route.

## Authorized CSV Export — scope cuts and interpretation calls

- **Scoped to the general export mechanism named by the roadmap item's own
  text** ("same row/field policy as the initiating user... logged as a
  material event," quoting PRD §2.2 verbatim) rather than the richer,
  separately-numbered "Reports" surface (Table 10's own "Reports" nav item,
  RPT-01's "governed portfolio review" generation) — that surface stays
  `comingLater` in `AppShell.tsx`, unchanged. This item wires the §2.2
  cross-cutting export rule into three existing list surfaces:
  Partnerships (the portfolio itself, T-022's literal "exports filtered
  portfolio"), Initiatives, and Audit — the last one closing AUD-03
  (P1, flagged deferred when Audit itself was built) now that the general
  mechanism exists right next to it, rather than leaving a known,
  numbered PRD gap unaddressed once the tool to close it was already being
  built anyway. Reviews/Decisions and Evidence/Outcomes exports are the
  same mechanism, not yet wired — a mechanical follow-up, not a design gap.
- **Every export endpoint calls the exact same query its sibling JSON list
  route already calls** (`PartnershipsService.exportCsv` calls
  `listForTenant`; `InitiativesService.exportCsv` calls `list`;
  `exportAuditEventsCsv` and `listAuditEvents` share one `buildWhere`
  helper) — not a parallel implementation that could quietly drift. This
  is the strongest possible reading of T-022's acceptance gate ("rows/
  fields equal authorized UI query") and RPT-02's ("export matches UI
  scope"): row-level authorization can never diverge between the two,
  because there's only one query.
- **CSV writing is hand-rolled, not a new dependency** — `csv-parse`
  (already a dependency) exists because CSV Import has to tolerate
  arbitrary external files; every export here starts from data this
  app already fully controls, so the two-rule escaper CSV Import's own
  `rejected.csv` download already used was extracted into a shared
  `apps/api/src/common/csv.ts` (`csvEscape`/`toCsv`) instead of
  duplicating it a fourth time. `imports.service.ts` now imports the
  shared helper too, removing its own local copy.
- **Downloads are plain `<a href>` elements pointing straight at the API
  origin, not a fetch+blob dance** — the exact pattern CSV Import's own
  "download rejected rows" link already uses and that this app's httpOnly,
  `SameSite=Lax` auth cookie already supports (a top-level GET navigation
  sends the cookie even cross-origin, since `SameSite=Lax` only restricts
  cross-_site_ requests, and `:3000`/`:4000` on `localhost` are the same
  site). No new client-side download infrastructure was needed.
- **`export_completed` is logged twice, deliberately** — once via the
  existing `Logger`-based analytics-event convention every prior feature
  uses (the literal PRD-named event: `export_id, type, record_count,
filter_hash, duration`), and once as a real `recordAuditEvent` call
  (§2.2's own "logged as material events" line). The export is treated as
  its own auditable object — a fresh `objectId` (a UUID) stands in for
  "the export," the same way an Outcome or Contribution gets its own id —
  rather than attaching the log to an arbitrary row in the exported set.
- **CSV field sets are a reasonable, readable business-field selection,
  not a literal PRD enumeration** — no PRD text names an exact export
  column list for Partnerships/Initiatives/Audit (unlike, say, Table 67's
  named required fields for a record's _creation_). Foreign keys are
  joined to display names server-side (partner/owner/sponsor via one
  batched `findMany` per export, not N+1 queries) rather than exporting
  bare UUIDs, since a CSV export's whole purpose is being useful to a
  human outside the app.
- **Audit export has no pagination loop** — it takes a single page up to
  `EXPORT_LIMIT` (5000 rows) rather than looping cursors indefinitely.
  A tenant with more in-scope audit events than that needs real
  streaming/background export, the same class of future work RPT-03's
  "record report/export history" tracking already is — both deferred
  together, not built here.
- **The Audit export applies the caller's live filter-form state**, not a
  separately-tracked "last applied search" — `AuditContent.tsx`'s export
  link is computed from the same `filters` state the Search button reads,
  so exporting after editing filters (with or without clicking Search
  first) always reflects what's currently configured. No PRD text
  specifies this exact interaction nuance.

## Agreements and Commercial Rules — scope cuts and interpretation calls

- **Agreements and Commercial Rules are a load-bearing prerequisite for
  v2, not explicitly named in the user's own v2 request.** The user's v2
  scope named the Golden Workflow C chain ("revenue event → claim →
  eligibility → attribution → dispute → export") and Golden Workflow D
  (external guest workspace); CLM-02 requires every Claim to link "one
  partner, revenue event and **applicable agreement/rule**," so this had
  to exist before Claim could be built, not after. Built first in the
  Phase 6 sequence for that reason.
- **A genuine two-tier `Agreement`/`AgreementVersion` and
  `CommercialRule`/`CommercialRuleVersion` model** — the first entities in
  this codebase to need real parent/child versioning rather than a single
  row's own flat optimistic-concurrency `version` field. Grounded in Table
  67's explicit separate row for "Agreement Version" (with its own
  `effective_from/to`) and INV-002's parallel phrasing "agreement/rule
  version." **Both the parent and the child row need their own `version`
  field** — an early build mistake gave only the parent one, which
  compiled and migrated cleanly but made every version-level `PATCH`
  (edit, approve) fail with a `version` validation error, since the
  version DTO's `@Min(1)` saw `undefined`/`0`. Caught by live browser QA
  approving a version, not by any unit test (the mocked Prisma layer in
  `agreements.service.test.ts` never exercises real column presence) —
  fixed with a follow-up migration adding `version Int @default(1)` to
  both child models before the frontend was built against them.
- **`CommercialRule` gets no parent-level state machine** — Table 13's
  7-state chain has a row for Agreement, not Commercial Rule, so inventing
  one would have been unstated scope. Only `CommercialRuleVersion.
approvalStatus` (`DRAFT | APPROVED`) exists; the parent carries no
  `status` field at all.
- **`CommercialRule` is tenant-wide, not partnership-scoped** — Table 12's
  field list for it (`type, conditions, precedence, effective dates,
  version`) names no relationship/partnership field, unlike every other
  domain entity built so far in this codebase. Its list/create routes take
  no `partnershipId`.
- **`EFFECTIVE`/`AMENDED` are excluded from `Agreement`'s own settable
  status enum** — Table 13's chain includes them, but AGR-02's own text
  ("approving a version makes the agreement effective") makes them a
  side effect of version approval, not a direct transition. Settable
  manually: `CAPTURED, IN_REVIEW, SUSPENDED, EXPIRED, TERMINATED`. The
  version-approval transaction computes `EFFECTIVE` (from `IN_REVIEW`) vs.
  `AMENDED` (from any other approvable status) and applies it atomically
  alongside the version's own `approvalStatus` update.
- **Overlap prevention runs at approval time, not draft-creation time** —
  AGR-02/RULE-03's acceptance gate says "overlapping **effective**
  versions blocked," so two still-draft versions may freely share dates
  (a normal editing-in-progress state); the check only runs against
  already-`APPROVED` siblings, at the moment a new version is itself being
  approved. A `null` `effectiveTo` is treated as open-ended (compared
  against the max representable JS date), so an open-ended approved
  version blocks approval of anything starting after it.
- **RBAC gives approval authority to Reviewer, not Owner/Executive** —
  §2.3's own "Agreements/rules" matrix row (`Admin=Admin, Executive=Read,
  Manager=Metadata, Reviewer=Review/approve`) is genuinely different from
  every other approval workflow already built (Decision: Owner/Executive;
  Outcome: Owner/Admin/Reviewer-if-assigned) — re-checked independently
  rather than assumed, per this file's own standing discipline of not
  letting one module's RBAC answer silently transfer to the next.
- **RULE-01's rule definition is a small fixed DSL, not arbitrary
  code/expression evaluation** — `{ combinator: 'AND'|'OR', conditions:
  [{ field, operator, value }] }` with an approved operator catalog
  (`eq, ne, gt, gte, lt, lte, in, contains`), chosen specifically so RULE-04
  ("explain rule evaluation as inputs, conditions, result and version")
  stays reproducible and safe to run server-side against caller-supplied
  definitions — a `vm`/`eval`-based expression language was never
  considered, given the security cost of evaluating tenant-authored logic.
- **RULE-02's "test against historical/sample events" is scoped to
  user-supplied sample cases, not real historical Revenue Events** —
  Revenue Event doesn't exist yet (the next v2 item); building a rule
  tester against data that doesn't exist wasn't possible, so the test
  endpoint accepts caller-supplied `{ label?, input, expectedResult }[]`
  cases instead and persists the run's pass/fail trace on the version.
  Once Revenue Event ships, wiring "test against the last N real events"
  in addition is a natural, additive follow-up — not a redesign.
- **Approving is a distinct action from editing, enforced by role _and_ by
  state** — `updateVersion` takes the same `PATCH` route for both edits and
  approval (the same "one route, service narrows by what's being asked"
  shape `DecisionsController`'s approve path already uses), gated by
  `APPROVE_ROLES` when `approvalStatus: 'APPROVED'` is present in the body
  and `WRITE_ROLES` otherwise — and INV-002 blocks editing content
  (`terms`/`definition`/dates) once a version is already `APPROVED`,
  regardless of role, since an approved version is meant to be an
  immutable record from that point on.
- **Web: Commercial Rules shares the "Agreements" nav item rather than
  getting one of its own** — Table 10/§3.1 name a single "Agreements"
  surface, and Commercial Rule's tenant-wide, non-partnership-nested shape
  doesn't fit naturally as a row inside the Agreements list anyway; it
  gets its own `/agreements/rules` list and workspace reached by a header
  button from the Agreements page, not a second sidebar entry.
- **The rule-version dialog builds conditions as a structured field/
  operator/value form, not a raw JSON textarea** — matching RULE-01's own
  "approved condition/operator catalog" framing (a free-text JSON editor
  would let an author type any operator string, deferring the catalog
  check entirely to server-side rejection after submission). The RULE-02
  sample-case tester, by contrast, **is** a raw JSON textarea — sample
  cases are ad hoc test data with no fixed shape worth a bespoke form, and
  RULE-02 itself is already a documented scope simplification.
- **A component instance that stays mounted across separate dialog opens
  must reset its own state on each open, not rely on `useState`'s initial
  value** — the "Add version" dialog for Commercial Rules was mounted
  once per page (`{canWrite && (<VersionDialog ... open={versionOpen}
.../>)}`), so a second "Add version" after a first submission silently
  carried over the first version's condition rows. Caught by live browser
  QA creating a second rule version, not by typecheck/lint/unit tests
  (none of which render the component tree). Fixed by mounting it only
  while `versionOpen` is true, the same conditional-mount pattern the
  adjacent "Edit version" dialog (`{canWrite && editingVersion && (...)}`)
  already used correctly — rather than adding a manual reset-on-open
  handler, keeping one consistent pattern for "one-shot" dialogs across
  this codebase.
- **ICU curly braces in a translated hint string broke that one
  translation silently** — `"An array of { label, input, expectedResult }
  objects."` has `next-intl`/ICU parse `{ label, ... }` as a message
  placeholder needing an argument, so `t('sampleCasesHint')` returned the
  raw `commercialRules.sampleCasesHint` key instead of throwing where it
  would have been caught immediately. Caught by live browser QA reading
  the rendered dialog text, not by typecheck (a missing/malformed message
  key is a runtime-only failure in this setup). Fixed by rewording the
  hint to avoid literal braces, and confirmed no other new string in this
  feature has the same issue. Worth remembering for every future
  translated string: literal `{}` needs ICU escaping (single-quoting) or,
  more simply, rewording to avoid it.
