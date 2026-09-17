# Product understanding — working summary

Sources: the investor pitch deck (`Reven (8).pptx`) and
`Reven_Execution_PRD_MVP_v2.docx` (v2.0, execution baseline, 17 August 2026).
This file is what engineering carries forward — the PRD remains the binding
detail for any feature work.

## What Reven is

Reven is an internal, multi-tenant system for one enterprise to govern its
**partnerships with other companies** — not a marketplace, not a full CRM, not
a payments/wallet/invoicing system, and not an autonomous decision-maker.

**Category:** Partner Revenue Operating System.
**Belief:** partnerships aren't a relationship problem, they're a revenue
problem — every deal now arrives already split between whoever sourced it,
sold it, delivered it and supplied the technology, and nothing in a company's
existing stack (CRM, PRM, CLM, spreadsheets) governs that shared, cross-company
span end to end.

## The product spine (full future scope — not built yet)

```
Partner → Partnership → Initiative → Actions & Blockers → Review & Decision
        → Evidence → Outcome & Verification → Command Center
```

- **Partner** — the partner company.
- **Partnership** — the governed relationship with that partner.
- **Initiative** — a joint project/goal inside a partnership.
- **Action / Blocker** — a task with an owner and due date / something stopping it.
- **Review / Decision** — a recurring partnership check-in and the formal
  outcome it produces.
- **Evidence** — a file/link/document proving something happened.
- **Outcome / Verification** — a claimed result and its authorized sign-off.
- **Command Center** — the management view of at-risk partnerships, overdue
  actions and pending decisions.

## Release scope (PRD §1.3, §5, §6)

The **MVP (R1)** is: tenant/admin, partner import (CSV + one CRM connector),
partnership portfolio, partnership workspace, initiatives/milestones/actions,
reviews & decisions, evidence & outcomes with verification, agreement metadata
(not full CLM), full audit trail, a Command Center dashboard, and authorized
CSV export. An **optional Revenue-Share module** (revenue event → claim →
eligibility → human-reviewed attribution → dispute → export) exists but **never
moves money** — no wallet, payout instruction, settlement or accounting ledger,
ever (PRD §1.4, a hard non-goal).

**R1.1** adds an external partner guest workspace, calendar/Teams links and
richer reporting, if pilot evidence justifies them. **Later** (explicitly out of
scope until proof-gated per PRD §18): cross-company intelligence, matchmaking,
a shared partnership graph, benchmarking, a partner marketplace.

## Non-negotiable non-goals (PRD §1.4)

- No wallet, funds transfer, payout instruction, invoicing, tax calculation or
  accounting ledger — ever.
- No full CRM/CLM/ERP/PM/partner-portal replacement.
- No public directory, open marketplace, unpermissioned data pooling, or
  automatic counterpart discovery.
- No autonomous legal interpretation, autonomous attribution, black-box
  recommendations, or model-generated binding decisions.
- No custom workflow builder in MVP — configuration only (templates, fields,
  categories, thresholds, rules).
- No microservices split unless a repository audit proves an independently
  scaling boundary already exists (this phase: none does — see
  `docs/DECISIONS.md`).

## Users and roles (PRD §2)

Tenant Owner, Tenant Admin, Executive, Partnership Lead, Partnership Manager,
Finance Reviewer, Legal Reviewer, Verifier/Auditor, External Guest, Integration
Principal (machine identity). Permission doctrine: **deny by default** — tenant
membership + role capability + object visibility + field policy, all
server-enforced. This is the substance of the next-but-one feature
(Roles & Permissions), after Tenant/Organization.

## Domain module boundaries (PRD §10.3)

The backend is a modular monolith (PRD §10.1, DECIDED — not microservices, not
yet). Ten modules, each owning specific entities:

| Module                | Owns                                                             |
| --------------------- | ---------------------------------------------------------------- |
| Identity & Tenant     | Tenant, membership, role, auth policy, support access            |
| Portfolio             | Partner, partnership, program, taxonomy, health                  |
| Execution             | Workspace, plan, initiative, milestone, action, review, decision |
| Commercial Governance | Agreement, obligation, rule version                              |
| Evidence & Outcomes   | Contribution, evidence, outcome, verification                    |
| Revenue Share         | Revenue event, claim, eligibility, attribution, dispute          |
| Sharing               | Grant, guest, field policy, external access                      |
| Integrations          | Connection, mapping, sync job, dead letter                       |
| Intelligence          | Metrics, derived signals, reports (read models only)             |
| Audit & Operations    | Outbox, audit, exports, support tooling                          |

These are reserved as empty folders under `apps/api/src/modules/` with a
one-line README each — see `docs/ARCHITECTURE.md`.

## Data modeling rules that apply to every future table (PRD §4.1)

- Every tenant-owned record: `id` (opaque UUID), `tenant_id`, `created_at/by`,
  `updated_at/by`, `version`, lifecycle status.
- Optimistic concurrency on material records (mutations require last known
  version; conflict → 409).
- Effective-dated agreements/rules are immutable after approval — changes
  create new versions.
- Audit events are append-only; business records may be archived/soft-deleted
  per retention policy.
- Files live in object storage; the database holds metadata + pointer, never
  binary content.
- Derived intelligence always stores provenance, calculation version and
  `refreshed_at`.

No tables exist yet in this phase — see `packages/db/prisma/schema.prisma`.

## Beachhead and GTM (context, not scope)

Saudi B2B technology vendors, systems integrators and platform operators with
20–200+ active partners. Land on the alliance/partnership manager's daily
chaos (spreadsheets, untracked tasks); expand to the CRO/CFO/CEO's need for
attribution, margin protection and channel ROI. Five sectors first (banking &
fintech, technology & software, systems integrators, telecoms, government &
PPP); the same product applies to 27 more without a rebuild.

## Internationalization requirement (PRD §1.2, §7.1)

"The product works in English and preserves an Arabic/RTL-ready component
architecture; critical pilot workflows receive Arabic QA." Dates: tenant
timezone display, UTC storage; Hijri display is a later _view_, never a
storage format. This phase delivers the RTL-ready architecture itself — see
`packages/ui` and `apps/web`'s i18n setup.
