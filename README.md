# Reven

The operating system for revenue shared between companies. Internal, private,
multi-tenant — governs a company's partnerships with other companies from
first agreement through verified outcome.

The current MVP includes partnerships, initiatives and actions, reviews and
decisions, agreements, outcomes, evidence, and audit history in English and
Arabic. The client pilot opens without a login or account setup:
**https://reven-pilot-uinswy.cranl.net**.

See [docs/PILOT.md](docs/PILOT.md) for the pilot workflow, shared roles, and
scope. [docs/ROADMAP.md](docs/ROADMAP.md) records the implementation phases;
the pilot does not represent completion of the full product roadmap.

Read first if you're new here:

- [docs/brand/BRAND_SYSTEM.md](docs/brand/BRAND_SYSTEM.md) — the visual identity this UI is built from
- [docs/brand/PRODUCT_UNDERSTANDING.md](docs/brand/PRODUCT_UNDERSTANDING.md) — what Reven is and isn't
- [docs/DECISIONS.md](docs/DECISIONS.md) — why this stack, and every conservative call made where the brand file or PRD had a gap
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the repository is organized and how to add a feature
- [docs/PILOT.md](docs/PILOT.md) — try the MVP without accounts or passwords

## Tech stack

| Layer         | Choice                                                               |
| ------------- | -------------------------------------------------------------------- |
| Monorepo      | pnpm workspaces + Turborepo                                          |
| Frontend      | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4       |
| i18n          | next-intl — English + Arabic, RTL from the `dir` attribute           |
| Backend       | NestJS 12 (Fastify adapter), modular monolith                        |
| Database      | PostgreSQL 16 + Prisma ORM                                           |
| Design system | Radix UI primitives + Tailwind, hand-built to the Reven brand tokens |
| Testing       | Vitest (web, ui, api) + Testing Library                              |
| Tooling       | ESLint 9 (flat config) + Prettier, Husky + lint-staged               |

Full rationale for every choice — including two deliberate version pins
(TypeScript on 5.9, Prisma on 7.10, both explained) — is in
[docs/DECISIONS.md](docs/DECISIONS.md).

## Project structure

```
revn/
├── apps/
│   ├── web/              Next.js app — the product UI
│   │   ├── app/[locale]/ Routes (en/ar), including /design-system
│   │   ├── src/i18n/     Locale config, routing, message loading
│   │   ├── src/components/AppShell.tsx   Sidebar + TopNav shell
│   │   └── messages/     en.json / ar.json translation catalogs
│   └── api/               NestJS app — the HTTP API
│       ├── src/health/    Liveness/readiness endpoints
│       ├── src/common/    Env validation, error shape, correlation ids
│       └── src/modules/   Reserved folders for the 10 domain modules (PRD §10.3)
├── packages/
│   ├── ui/                Design system — tokens, components, one barrel export
│   ├── db/                Prisma schema, migrations, generated client
│   └── config/            Shared TypeScript / ESLint / Tailwind configuration
└── docs/                   Brand + product understanding, decisions, architecture, roadmap
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for what each module boundary
owns and depends on, and a worked example of adding a new feature.

## Running locally

### Prerequisites

- Node.js ≥ 20.9 (see `.nvmrc`)
- pnpm ≥ 9 (`corepack enable` will pick up the pinned version automatically)
- PostgreSQL 16, reachable at the URL in your `.env`

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start Postgres

Two options — pick whichever you have:

**Docker:**

```bash
docker compose up -d
```

**Homebrew (macOS), what this environment uses:**

```bash
brew install postgresql@16
brew services start postgresql@16
psql -d postgres -c "CREATE ROLE revn LOGIN PASSWORD 'revn';"
psql -d postgres -c "ALTER ROLE revn CREATEDB;"   # Prisma Migrate needs this for its shadow database
createdb -O revn revn_dev
```

### 3. Configure environment

`.env.example` at the repo root documents every variable used across the
monorepo. Each tool reads `.env` relative to its **own** working directory
(Prisma next to `schema.prisma`, Nest in `apps/api`, Next.js in `apps/web`),
so copy it to each location that needs it:

```bash
cp .env.example .env                       # for docker-compose / reference
cp .env.example packages/db/.env           # Prisma CLI
cp .env.example apps/api/.env              # NestJS
printf 'NEXT_PUBLIC_API_URL="http://localhost:4000"\n' > apps/web/.env.local
```

The default `DATABASE_URL` matches both Postgres options above
(`postgresql://revn:revn@localhost:5432/revn_dev`) — for the Homebrew path,
the `revn` role above was created with password `revn`, matching the default.

### 4. Generate the Prisma client and run migrations

```bash
pnpm db:generate
pnpm db:migrate
```

This creates the product tables and applies the migration history.

### 5. Run everything

```bash
pnpm dev
```

This starts both apps (via Turborepo):

- Web: http://localhost:3000 — redirects to `/en`, then to `/en/sign-in`
  since every app page is authenticated now. Create an account at
  http://localhost:3000/en/sign-up (any email/password ≥ 12 characters — no
  email actually gets sent; a password-reset or invitation just logs the
  link to the API's console, see `docs/DECISIONS.md`). A brand-new account
  gets routed to "create your organization" once, right after sign-up,
  becoming its owner. `/en` (every role but guest) is the Command Center —
  a KPI strip (active/at-risk partnerships, open initiatives, pending
  decisions, reviews due, outcomes awaiting verification), an exceptions
  feed pulling together everything currently at risk, blocked or rejected
  across the portfolio, and reviews-due/decisions/initiatives lists, each
  linking back to its own full page. As owner (or admin), `/en/administration` lets you
  invite teammates by email and role, and manage existing members'
  roles/suspension — an invited email with no account gets a link straight
  to a join-and-set-password page, no separate onboarding step.
  `/en/partnerships` lists partner companies — add one, edit it, or
  archive/reactivate it (owner/admin/manager; other roles see the same list
  read-only). Each partner also has a governed relationship: use its
  "Relationship" action to start one and move it through its lifecycle
  (Prospect → Qualified → Planning → Active → At Risk → Paused → Terminated
  → Archived) — activating requires an owner, motion, objective, cadence,
  health and next review date to all be set first. "Import CSV"
  (owner/admin only) opens a wizard at `/en/partnerships/import` — upload a
  CSV, map its columns to Partner/Partnership fields, review the
  create/update/skip/reject preview (with an explainable reason per row),
  then commit; each imported partner starts a Prospect-stage relationship,
  ready for someone to activate through the flow above.
  `/en/initiatives` (owner/admin/executive/manager — not reviewer) lists
  initiatives across every partnership; "New initiative" starts one under a
  chosen partnership, and each row opens its workspace at
  `/en/initiatives/[id]` — objective/stage/health, a success measure, ordered
  milestones, and actions (assigned to a member or an external counterpart)
  that can be moved to Blocked (with a reason), Done, or Cancelled.
  Completing an initiative requires a disposition and a decision on any
  still-open actions, and is blocked by a still-Blocked action unless an
  override reason is documented.
  `/en/reviews` (same roles as Initiatives) lists partnership reviews;
  scheduling one and moving it to "In preparation" captures a snapshot of
  the partnership and its initiatives. Each review's workspace lets you
  record decisions (optionally requiring approval — only an owner or
  executive can approve, and never the decision's own creator) and
  follow-up actions (the same Action entity Initiatives use). Completing a
  review needs a next-review date and is blocked outright — no override —
  by any decision still pending approval or any follow-up action still
  open; completing propagates the next-review date back onto the
  partnership.
  `/en/evidence-outcomes` (every role except guest — reviewers get a real
  but assignment-gated "verify" capability) lists claimed outcomes across
  every partnership; "New outcome" starts one under a chosen partnership
  (optionally scoped to an initiative). Each outcome's workspace lets you
  log contributions and evidence (upload a file or just reference a URL —
  either way a server-computed checksum, classification and observed date
  are recorded), then submit to an assigned verifier. Verifying requires at
  least one linked evidence record and is never allowed for the outcome's
  own creator, whatever their role — a verifier can accept it, reject it
  with a reason, or send it back requesting more evidence (which can be
  resubmitted once addressed).
  `/en/audit` (every role except guest — managers and reviewers see only
  events they were the actor for) lists the material audit trail: every
  create and lifecycle/status change across partners, partnerships,
  initiatives, actions, reviews, decisions, evidence, outcomes and
  organization membership. Filter by object type/id, action, actor, date
  range or correlation id; open a row to see the full before/after
  payload. The Partnerships, Initiatives and Audit lists each have an
  "Export CSV" link — the export is always the same rows the list itself
  is currently showing that user, and every export is itself logged as an
  audit event. The Design System Showcase is at
  http://localhost:3000/en/design-system (or `/ar/design-system` for the
  Arabic/RTL layout).
  `/en/agreements` (owner/admin/executive/manager/reviewer — guest denied,
  pending Share Grant) lists agreements by partnership; "New agreement"
  starts one, and its workspace at `/en/agreements/[id]` shows status,
  available transitions, and a version history you can add drafts to.
  Approving a draft version (owner/admin/reviewer) is what actually moves
  the agreement to Effective — you can't set that status directly. A
  version already approved is immutable — edit only reaches a still-draft
  one. "Commercial rules" in the page header opens `/en/agreements/rules`,
  a separate tenant-wide list (not scoped to any partnership) for
  eligibility/attribution rules — each rule version is a small
  field/operator/value condition builder plus a "Test" action that runs
  sample cases through the rule and shows pass/fail inline before you
  approve it.
- API: http://localhost:4000 — `/health`, `/health/ready` (both public), and
  OpenAPI docs at `/docs`.

Run one app at a time with `pnpm dev:web` or `pnpm dev:api`.

## Running tests

```bash
pnpm test              # every app/package, via Turborepo
pnpm --filter @revn/ui test        # just the design system
pnpm --filter @revn/web test       # just the web app
pnpm --filter @revn/api test       # just the API
```

Linting and type-checking follow the same pattern: `pnpm lint`,
`pnpm typecheck`.

## Adding a new feature

Short version — full walkthrough in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#adding-a-new-feature-module-worked-example):

1. Add tables to `packages/db/prisma/schema.prisma`, run `pnpm db:migrate`.
2. Turn the relevant `apps/api/src/modules/<name>/README.md` into a real
   NestJS module and register it in `app.module.ts`.
3. Add the route under `apps/web/app/[locale]/`, reuse `@revn/ui` components,
   flip the nav item in `AppShell.tsx` from `comingLater` to a real `href`.
4. Add tests next to the code. Update translations in both `messages/en.json`
   and `messages/ar.json` — never ship an English-only string.
5. Update `docs/ARCHITECTURE.md`'s module table and `docs/ROADMAP.md`.

## What's next

**v1 is complete** — every item in Phases 1 through 5 of
[docs/ROADMAP.md](docs/ROADMAP.md): Authentication/Tenant/RBAC; Partner/
Partnership/CSV Import; Initiative/Milestone/Action, then Review/Decision;
Evidence/Outcome/Verification, then Audit Timeline and Audit Search; and
Command Center, then Authorized CSV Export.

**v2 work happens on the `v2` branch** — Phase 6. Agreements and
Commercial Rules is **done** (a load-bearing prerequisite for Claims, not
previously scheduled — see the walkthrough above). Next: the
Revenue-Share Pack (Golden Workflow C — revenue event → claim →
eligibility → attribution → dispute → export, never moves money), then
Share Grant and the External Guest workspace (Golden Workflow D). CRM
integration beyond the first connector is **v3**, not v2 — see
`docs/ROADMAP.md` for the full breakdown and every grounding decision
behind it.
