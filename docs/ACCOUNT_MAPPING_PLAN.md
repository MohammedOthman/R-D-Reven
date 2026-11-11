# Reven as partnerships hub and context layer: architecture read, build plan, account mapping

Written 11 November 2026 against `main` at `4e2aa4b`. Vendor facts come from
web search on the same date; section 9 lists the ones nobody verified against
a primary source.

## 1. What the code does today

### 1.1 Runtime

- One Docker container runs three processes from `start.sh`: `prisma migrate
deploy` in a retry loop, the NestJS 12 API on port 4000, and the Next.js 16
  web app on `$PORT`. The web app proxies `/api/*` to the API.
- One PostgreSQL 16 database holds all state, including evidence file bytes
  (`EvidenceFile.content Bytes`, commit `13b238a`).
- The stack has no queue, no worker process, no cache, no object storage, no
  scheduler. Every operation runs inside an HTTP request.
- Hosting sits on CranL. The last deploy commits point at a `riyadh-1` app.
- Mail goes out through an HTTP email API when `MAIL_API_URL` is set. The API
  logs the link when it is unset.

### 1.2 Code layout

- `apps/api`: 8,745 lines of TypeScript, modular monolith, 27 test files.
- `apps/web`: App Router, English and Arabic with RTL, routes for command
  center, partnerships, initiatives, reviews, evidence and outcomes,
  agreements, audit, administration.
- `packages/db`: one Prisma schema, 1,229 lines, 26 models.
- `packages/ui`: Radix and Tailwind design system.

### 1.3 Module status

| Module                | Built                                                                        | Missing                                    |
| --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| identity-tenant       | Email and password auth, JWT plus rotated refresh token, tenants, six roles  | SSO, API keys, machine principals          |
| portfolio             | Partner, Partnership state machine, CSV import wizard with dedup             | Program, taxonomy, health formula          |
| execution             | Initiative, Milestone, Action, Review, Decision with approval                | Workspace, plan                            |
| commercial-governance | Agreement versions, commercial rules with a field/operator/value rule engine | Obligations                                |
| evidence-outcomes     | Contribution, Evidence with SHA-256 checksum, Outcome verification           | Malware scan, object storage               |
| audit-operations      | Append-only `AuditEvent`, search, CSV export                                 | Outbox, support tooling                    |
| intelligence          | Command Center read aggregation                                              | Any derived metric with provenance         |
| revenue-share         | README only                                                                  | Revenue event, claim, attribution, dispute |
| sharing               | README only                                                                  | Share grant, guest access, field policy    |
| integrations          | README only                                                                  | Connection, mapping, sync job, dead letter |

### 1.4 Business logic the code enforces

The product spine is `Partner → Partnership → Initiative → Action → Review →
Decision → Evidence → Outcome`. Four rules recur across the services:

1. State machines gate each transition. A Partnership reaches `ACTIVE` only
   after someone sets owner, motion, objective, cadence, health and next
   review date.
2. Separation of duties blocks self-approval. The creator of a Decision
   cannot approve it. The creator of an Outcome cannot verify it.
3. Approved versions are immutable. A change to an Agreement or a
   CommercialRule creates a new version with its own effective dates.
4. Each material mutation appends an `AuditEvent` with before and after
   payloads and a correlation id.

### 1.5 Five structural facts that shape the plan

1. **A Partner is a private row inside one tenant.** `Partner` carries
   `tenantId`, a `legalName` unique per tenant, `domains String[]` and an
   unshaped `identifiers Json`. No table represents the same company across
   two tenants. Two Reven customers who partner with each other hold two
   unrelated rows.
2. **The schema has no Account.** Nothing stores a customer, a prospect or
   an opportunity. Account mapping compares two account lists, so this
   entity and its ingestion come first.
3. **Tenant isolation lives in application code.** `RoleGuard` reads
   `:tenantId` from the route, loads the caller's `Membership`, and each
   service adds `where: { tenantId }` by hand. PostgreSQL enforces nothing.
   One forgotten filter in a cross-tenant query leaks a customer list.
4. **The process model cannot run a sync.** A CRM pull of 50,000 accounts
   takes minutes and needs retries, cursors and rate-limit backoff. The API
   has nowhere to run that work.
5. **The PRD forbids the target.** `docs/brand/PRODUCT_UNDERSTANDING.md`
   lists "unpermissioned data pooling" and "automatic counterpart discovery"
   as non-goals and gates "cross-company intelligence" and "the shared
   partnership graph" behind proof of the private control loop.
   `docs/ROADMAP.md` places CRM integration in v3. The hub vision moves both
   to the front of the queue.

Two housekeeping items: the README opens by stating that no product feature
exists and closes by stating v1 is complete, and it references a `v2` branch
that the remote does not have.

## 2. The vision, translated

"Partnerships hub" and "context layer" name two different products that share
one data model.

**Hub** means system of record for the partner workflow. Reven has this
already: the spine in section 1.4.

**Context layer** means a queryable graph that answers, for any account a
seller opens: which partners know this company, under which agreement, with
what history, and what rule pays whom. Other tools read that graph: the CRM,
Slack, an AI agent. The graph needs four node types and Reven stores two.

| Node                  | Question it answers                         | State today               |
| --------------------- | ------------------------------------------- | ------------------------- |
| Partner relationship  | Who do we work with, at what stage          | Built                     |
| Terms                 | What did we agree, which rule applies today | Built                     |
| Account               | Which customers and prospects do we share   | Absent                    |
| Cross-company identity | Is their "ACME KSA" our "Acme Arabia LLC"  | Absent                    |

Three edges turn the nodes into context:

- `Account ↔ Account` across two tenants: the overlap. This edge is account
  mapping.
- `Overlap → Initiative`: a shared account becomes a governed co-sell motion.
- `Outcome → Claim`: a verified result becomes an attributed revenue share
  under the rule version effective on the event date.

Crossbeam stops at the first edge. Reven owns the second and third. The
defensible position is the full chain from overlap to verified, attributed
outcome, with the audit trail a CFO signs.

### 2.1 Principle that reconciles the vision with the PRD

Keep the PRD's deny-by-default doctrine and change its scope from "one
tenant" to "one bilateral connection". Data crosses a tenant boundary only
when both tenants accepted a connection and each published a sharing rule
that covers the specific record. That rule keeps "no unpermissioned pooling"
true while permitting account mapping.

## 3. Software development plan in outline

Estimates assume three engineers (two backend, one frontend) and are
estimates.

| Phase | Deliverable                                                                             | Weeks |
| ----- | --------------------------------------------------------------------------------------- | ----- |
| 0     | Platform base: worker and queue, row-level security, object storage, API keys, outbox   | 3–4   |
| 1     | Account ingestion: Account and Opportunity models, CSV import, two CRM connectors       | 5–6   |
| 2     | Account mapping: organization identity, tenant connections, sharing rules, match engine | 5–6   |
| 3     | Activation: overlap to initiative, CRM write-back, notifications, revenue-share claims  | 5–6   |
| 4     | Context layer surface: public API, webhooks, MCP server, Crossbeam import               | 4–5   |

Total: 22 to 27 weeks to a product that maps accounts and feeds the result
into the existing governed workflow.

## 4. Build or integrate

### 4.1 What the market sells

- **Crossbeam** (merged with Reveal in 2024) runs the dominant account
  mapping network. It exposes a REST API with OAuth 2.0 covering partners,
  populations, overlaps and webhooks. Access works per customer: each Reven
  tenant authorizes its own Crossbeam account. Paid tiers (Connector,
  Supernode, Enterprise) are quote-based. Crossbeam announced credit limits
  on all plans from 1 September 2026, metering its MCP server.
- **Partner.io, Kiflo, xAmplify, Introw, PartnerTap** bundle account mapping
  inside their own partner platforms. They compete with Reven. Search found
  no public OEM or white-label engine from any of them.
- No vendor sells account mapping as an embeddable engine with a public
  price list. A white-label deal means a negotiated OEM contract.

### 4.2 Three options

**A. Build the engine inside Reven.**
Reven stores both sides' accounts and computes overlaps.

- Gains: Reven owns the graph, which the context layer vision requires.
  In-Kingdom data residency. Arabic name matching. Overlaps join to
  initiatives, rules and outcomes in one database.
- Costs: phases 0 to 2, about 13 to 16 weeks. Cold start: a tenant maps
  nothing until a partner loads data too.

**B. Connect to Crossbeam.**
Each tenant that already pays for Crossbeam connects it by OAuth. Reven
imports overlaps as read-only context.

- Gains: three to four weeks of work once phase 0 exists. The tenant reaches
  partners who are on Crossbeam and will not join Reven.
- Costs: Reven holds a copy and Crossbeam holds the network. The tenant needs
  a paid Crossbeam plan with API access. Crossbeam's API terms decide what
  Reven may store and redisplay. Tenants without Crossbeam get nothing.

**C. OEM a third-party engine.**

- Gains: none that A lacks, since ingestion, consent and UI remain Reven's
  work in any case. The match computation is the cheapest part of the system
  (section 6.4).
- Costs: a contract negotiation with a competitor, per-record fees, account
  data leaving Saudi hosting.

### 4.3 Recommendation

Build A. Ship B in phase 4 as one connector among others. Skip C.

The reasoning rests on where the cost sits. Matching two lists of 50,000
accounts is one indexed join. The expensive parts are CRM ingestion, the
consent model, and convincing the second company to load data. An OEM engine
removes none of those. Owning the engine keeps every overlap joinable to
Reven's agreements and outcomes, and that join is the product.

For CRM ingestion, the "ready solution" decision does pay off:

| Choice                    | Fit                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nango, self-hosted        | OAuth, token refresh, sync scheduling for 400+ APIs. Runs in Reven's own cluster, so account data stays in region. Source-available under Elastic License 2.0.    |
| Merge or Unified.to cloud | Normalized CRM schema. Data transits the vendor's cloud. Merge prices per linked account (third-party sources cite about $650 a month for 10, $65 each beyond).   |
| Direct connectors         | Full control over custom fields and bulk APIs. Each connector costs 2 to 3 weeks plus maintenance.                                                                |

Recommendation: self-hosted Nango for auth and scheduling, with Reven-owned
mapping code per CRM. Start with Salesforce and HubSpot. Add Zoho, Dynamics
365 and Odoo by pilot demand, since those three hold real share in the Saudi
mid-market.

## 5. Phase 0: platform base

Each item removes one of the blockers in section 1.5.

1. **Worker and queue.** Add `apps/worker`, a NestJS standalone process that
   imports the same modules. Use `pg-boss`: it stores jobs in PostgreSQL, so
   the deployment gains a process and no new datastore. Move to BullMQ on
   Redis when job volume passes about 100 jobs a second.
2. **Three deployables.** Split the container into web, api, worker. Run
   `prisma migrate deploy` as a release step. `start.sh` today retries
   migrations in the background while the API serves requests against an old
   schema.
3. **Row-level security.** Enable RLS on each tenant-owned table with the
   policy `tenant_id = current_setting('app.tenant_id')::uuid`. A Prisma
   client extension opens each request in a transaction and runs `SET LOCAL
app.tenant_id`. The API connects as a role without `BYPASSRLS`. The match
   job runs as a separate role allowed to read two tenants' match keys and
   nothing else.
4. **Object storage.** Move `EvidenceFile` bytes and CSV uploads to an
   S3-compatible bucket in region. Keep the checksum and pointer in
   PostgreSQL, as PRD §4.1 specifies.
5. **Machine identity.** Add `ApiKey` (hashed, scoped, per tenant) and OAuth
   client credentials. The PRD names an "Integration Principal" role that the
   code never built.
6. **Outbox.** Add `OutboxEvent`, written in the same transaction as the
   mutation, drained by the worker. Webhooks, CRM write-back and
   notifications all read from it. `recordAuditEvent` today swallows write
   failures, which suits audit logging and fails for integrations.
7. **Secrets.** Encrypt OAuth tokens with AES-256-GCM under a key held in a
   KMS. One data key per tenant.
8. **SSO.** Add OIDC and SAML. A security team that approves a CRM
   connection asks for SSO in the same review.
9. **Pilot mode guard.** `PILOT_AUTO_LOGIN` signs each visitor in as one
   shared Owner. Refuse to boot with that flag when any `TenantConnection`
   row exists.
10. **Observability.** OpenTelemetry traces, structured logs carrying the
    existing correlation id, an error tracker, and a sync-job status page.

## 6. Phases 1 and 2: account mapping, end to end

### 6.1 Data model additions

```prisma
// Global, not tenant-owned. One row per real-world company.
model Organization {
  id          String   @id @default(uuid())
  name        String
  domains     String[]
  identifiers Json     // { cr: "1010xxxxxx", vat: "3xxxxxxxxxxxxx3", lei, duns }
  country     String?
}
// Tenant.organizationId and Partner.organizationId both point here.

model TenantConnection {            // the bilateral consent record
  id            String @id @default(uuid())
  tenantAId     String
  tenantBId     String
  partnerAId    String?            // A's Partner row that represents B
  partnerBId    String?
  status        ConnectionStatus   // PROPOSED, ACCEPTED, PAUSED, REVOKED
  @@unique([tenantAId, tenantBId])
}

model IntegrationConnection {       // one CRM login
  id, tenantId, provider, externalOrgId, status, encryptedTokens, lastSyncAt
}
model FieldMapping   { id, connectionId, objectType, sourceField, targetField }
model SyncJob        { id, connectionId, kind, cursor, status, stats Json }
model SyncDeadLetter { id, syncJobId, payload Json, error }

model Account {
  id, tenantId, source, externalId
  name, domains String[], identifiers Json, country, industry
  type          AccountType        // CUSTOMER, PROSPECT, CHURNED
  ownerName, ownerEmail
  raw           Json
  organizationId String?
  @@unique([tenantId, source, externalId])
}
model Opportunity { id, tenantId, accountId, stage, amount, currency, closeDate, isOpen }

model Population       { id, tenantId, name, filter Json }  // "Customers", "Open opps > 100k SAR"
model PopulationMember { populationId, accountId }

model SharingRule {
  id, tenantId, populationId
  connectionId  String?            // null = default for all partners
  level         SharingLevel       // HIDDEN, COUNT_ONLY, OVERLAPS
  fields        String[]           // which Account fields the partner sees
}

model AccountMatchKey { tenantId, accountId, keyType, keyValue
  @@index([keyType, keyValue, tenantId]) }

model AccountOverlap {
  id, connectionId, accountAId, accountBId
  tier          MatchTier          // IDENTIFIER, DOMAIN, NAME_COUNTRY, FUZZY
  confidence    Decimal
  status        OverlapStatus      // AUTO_CONFIRMED, NEEDS_REVIEW, CONFIRMED, REJECTED
  initiativeId  String?            // set when someone opens a co-sell motion
}
```

Each tenant-owned model also carries `version`, `createdAt/By` and
`updatedAt/By`, per PRD §4.1.

### 6.2 Ingestion

- **CSV first.** Reuse `ImportBatch` and `ImportRow` with a new target type.
  The upload, map, preview, commit pipeline in `imports.service.ts` handles
  Partner rows today and the same four steps fit Account rows. A partner
  with no CRM connection can map accounts on day one.
- **CRM connectors.** Initial load through the bulk API (Salesforce Bulk API
  2.0, HubSpot CRM export or paged search). Incremental sync every 15
  minutes on `SystemModstamp` or `hs_lastmodifieddate`, with the cursor saved
  per `SyncJob`. Handle deletes and merges. Respect per-org API limits by
  reading the remaining-calls header and backing off.
- **Scopes.** Request read access to Account, Opportunity and User. Request
  write access only when the tenant turns on write-back in phase 3.
- **Salesforce distribution.** An admin installs or approves the connected
  app before users authorize it. A listed AppExchange app requires Salesforce
  security review, which takes weeks and carries a fee. Start unlisted.
- **Populations.** A population is a saved filter over Account and
  Opportunity fields. The worker rematerializes `PopulationMember` after each
  sync. The commercial-rules engine in `rule-engine.ts` already evaluates
  field/operator/value conditions and fits population filters with small
  changes.

### 6.3 Normalization

Each account produces match keys. Key quality decides match quality.

- **Domain.** Lowercase, strip scheme, path and `www`, convert to punycode,
  reduce to the registrable domain with the Public Suffix List. The list
  treats `gov.sa` and `com.sa` as suffixes, so `moh.gov.sa` and `mof.gov.sa`
  stay distinct. Drop free-mail domains (`gmail.com`, `outlook.com`). Keep
  each domain when an account has several.
- **Registry identifier.** Saudi Commercial Registration number, VAT number,
  Unified National Number, LEI, D-U-N-S. Strip spaces and punctuation. This
  tier produces the fewest false positives.
- **Name.** Unicode NFKC, lowercase, strip legal forms in both scripts (LLC,
  Ltd, Co, شركة, مؤسسة, ذ.م.م), unify Arabic letter variants (أ إ آ → ا,
  ة → ه, ى → ي), remove diacritics and tatweel. Store an Arabic-script key
  and a transliterated Latin key.
- **Country.** ISO 3166 alpha-2, used to block name comparisons.

### 6.4 Match engine

Run four tiers in order. A pair that matches at one tier skips the rest.

| Tier | Rule                                                         | Confidence | Handling            |
| ---- | ------------------------------------------------------------ | ---------- | ------------------- |
| 1    | Same registry identifier                                     | 0.99       | Auto-confirm        |
| 2    | Same registrable domain                                      | 0.95       | Auto-confirm        |
| 3    | Same normalized name and same country                        | 0.85       | Auto-confirm        |
| 4    | Trigram similarity ≥ 0.6 on name within one country block    | 0.60–0.84  | Human review queue  |

Tiers 1 to 3 run as one query:

```sql
INSERT INTO account_overlap (connection_id, account_a_id, account_b_id, tier, confidence)
SELECT $conn, a.account_id, b.account_id, min(a.key_type), max(tier_confidence(a.key_type))
FROM account_match_key a
JOIN account_match_key b USING (key_type, key_value)
WHERE a.tenant_id = $tenantA AND b.tenant_id = $tenantB
GROUP BY a.account_id, b.account_id
ON CONFLICT DO NOTHING;
```

Two tenants with 50,000 accounts and three keys each produce a hash join
over 300,000 rows. PostgreSQL finishes that in seconds on a small instance.
Tier 4 uses `pg_trgm` with a GIN index and compares only inside the same
country block, which caps the candidate set.

Three edge cases need explicit handling:

- **Shared parent domain.** Forty subsidiaries list `aramco.com`. A domain
  key matching more than five accounts on one side drops from tier 2 to the
  review queue.
- **One-to-many.** One account in A matches three in B. Store each pair and
  group them in the UI under A's account.
- **Rejected pairs.** A reviewer rejects a pair. Keep the row with status
  `REJECTED` so the next run does not propose it again.

Incremental runs: an account upsert rewrites its keys and enqueues one
rematch job per accepted connection of that tenant, scoped to the changed
account ids. A nightly full rematch catches drift.

The tier table follows the product's existing doctrine. `imports.service.ts`
gives each dedup verdict an explainable reason, and the PRD bans black-box
recommendations. Each overlap row states its tier and the key that matched.
Add a probabilistic model such as Splink's Fellegi-Sunter implementation
only after reviewers have labeled a few thousand tier-4 pairs to train on.

### 6.5 Consent and visibility

1. Tenant A opens a Partner record and sends a connection invite to B's
   admin by email. This extends the existing `Invitation` flow.
2. B accepts. If B has no tenant, B creates a free one. Reven links both
   Partner rows through `TenantConnection` and resolves both tenants to
   `Organization` rows.
3. Each side sets a sharing rule per population: `HIDDEN`, `COUNT_ONLY` or
   `OVERLAPS` with a field list.
4. The engine matches all accounts. The read path filters: a row appears for
   A only when B's rule on the matched account's population is `OVERLAPS`,
   and A sees only B's listed fields. `COUNT_ONLY` returns one integer.
5. Accounts without a match stay invisible to the other side under each
   level.
6. Revoking a connection deletes its `AccountOverlap` rows inside 60
   seconds, the same bound PRD SHR-05 sets for share grants.
7. Each view and export of partner-supplied fields appends an `AuditEvent`.

Reven acts as the trusted intermediary and stores plaintext account data
for both sides. Hashing domains before upload adds little protection: an
attacker enumerates the few hundred million registered domains and reverses
each hash. The controls that carry weight are RLS, per-tenant encryption
keys, the audit trail and third-party attestation. Private set intersection
(for example ECDH-PSI) removes the intermediary and prevents fuzzy matching;
hold it for a customer whose legal team refuses the escrow model.

### 6.6 Screens

- **Integrations** (Administration): connect CRM, field mapping, sync status,
  dead letters.
- **Accounts**: list with source, type, owner, population tags.
- **Populations**: filter builder, member count, sharing rule per partner.
- **Partner connection** (inside the Partnership workspace): invite, status,
  what each side shares.
- **Account mapping**: a population-by-population matrix of overlap counts
  (our customers × their prospects), drill-down to the account list, filters,
  CSV export through the existing `common/csv.ts`.
- **Review queue**: tier-4 pairs with both names, the similarity score,
  confirm or reject.
- **Command Center**: new tiles for overlaps per partner and overlaps not yet
  attached to an initiative.

Each screen ships in English and Arabic with the seven states PRD §15.2
lists.

### 6.7 Roles

| Capability                   | Owner | Admin | Executive | Manager     | Reviewer | Guest |
| ---------------------------- | ----- | ----- | --------- | ----------- | -------- | ----- |
| Connect CRM, edit mapping    | Yes   | Yes   | No        | No          | No       | No    |
| Accept a tenant connection   | Yes   | Yes   | No        | No          | No       | No    |
| Edit sharing rules           | Yes   | Yes   | No        | No          | No       | No    |
| View overlaps                | Yes   | Yes   | Yes       | Own partners | No      | No    |
| Resolve review queue         | Yes   | Yes   | No        | Own partners | No      | No    |
| Export overlaps              | Yes   | Yes   | Yes       | No          | No       | No    |

## 7. Phases 3 and 4: from overlap to context layer

**Phase 3, activation.**

- "Start co-sell" on an overlap creates an `Initiative` under the
  Partnership and sets `AccountOverlap.initiativeId`. The existing spine
  takes over: actions, review, evidence, outcome.
- Build the revenue-share module the roadmap already specifies (items 13 to
  15). A CRM `Opportunity` moving to closed-won on an overlapped account
  creates a `RevenueEvent`, replacing the manual entry the roadmap planned.
- CRM write-back: a "Partner presence" field or related list on the CRM
  Account, so a seller sees the overlap without opening Reven.
- Slack and Teams notifications from the outbox: new overlap on an open
  opportunity, partner's account moved to customer.

**Phase 4, context layer surface.**

- Public REST API and signed webhooks over accounts, overlaps, partnerships,
  agreements and outcomes.
- An MCP server with tools such as `get_account_context(domain)`, returning
  partners present, agreement in force, open initiatives and applicable rule
  version. This endpoint is the "context layer" in concrete form: an agent
  or a CRM sidebar asks one question and receives the joined answer.
- Crossbeam connector (option B): import overlaps for tenants with an
  existing Crossbeam account, tagged `source = crossbeam`.
- Guest mapping: a partner without a tenant uploads one CSV through a
  tokenized link. Build it on the Share Grant mechanism (roadmap item 16).
- Three-party mapping and enrichment (firmographics per `Organization`)
  follow once two-party volume exists.

## 8. Requirements checklist

**Functional**

- Ingest accounts and opportunities by CSV and from two CRMs, with field
  mapping, incremental sync and delete handling.
- Define populations and per-partner sharing rules.
- Invite, accept, pause and revoke tenant connections.
- Match in four tiers with a stated reason per pair and a review queue.
- Show overlap matrix, list, export. Create an initiative from an overlap.
- Audit each cross-tenant read.

**Non-functional targets**

- Initial sync of 100,000 accounts inside 30 minutes.
- Rematch after an incremental sync inside 5 minutes.
- Overlap list p95 under 500 ms at 50,000 overlaps per connection.
- Revocation effective inside 60 seconds.
- Zero cross-tenant rows returned in an automated RLS test suite that runs
  each list endpoint as a non-member.

**Security and compliance**

- Saudi PDPL: owner names and emails on accounts are personal data. Keep
  storage and processing in Kingdom, record the lawful basis, sign a data
  processing agreement with each tenant, support deletion on request.
- SOC 2 Type II or ISO 27001. Enterprise buyers ask for one before
  connecting a CRM.
- Annual penetration test covering tenant isolation.
- Per-tenant encryption keys, token encryption, key rotation.
- Terms of service clause: Reven does not use one tenant's account data for
  another tenant or for aggregate products without written opt-in.

**People**

- Two backend engineers, one frontend engineer, a part-time designer, and
  one person who owns security and compliance evidence.
- A partnerships operator who runs the first ten bilateral connections by
  hand and records each match error.

## 9. Risks and open items

1. **Cold start.** Account mapping returns nothing until a second company
   loads data. Crossbeam's network is the incumbent advantage. Reven's
   counter: a free connector tier for the invited partner, CSV upload with
   no CRM requirement, a market (Saudi and GCC) with low Crossbeam
   penetration and Arabic-name matching that Latin-only tools handle badly.
   Measure one number in the pilot: the share of invited partners who load
   an account list within 14 days.
2. **PRD conflict.** Section 2.1 proposes the rule that reconciles the vision
   with the PRD. Record the override in `docs/DECISIONS.md` before code
   starts, since PRD §18 gates this scope behind pilot proof.
3. **Unverified vendor facts.** `developers.crossbeam.com` sits outside this
   session's network allowlist. The Crossbeam endpoint list, API plan
   requirement and redistribution terms come from search summaries and a
   third-party API directory. Read the API terms before committing phase 4
   to option B. Nango and Merge prices come from third-party comparison
   posts that disagree with each other; confirm on the vendors' pricing
   pages.
4. **Isolation regressions.** Cross-tenant reads become a feature, so a
   leak becomes a contract breach. RLS in phase 0 precedes every other
   item for that reason.
5. **Scope pull.** Contacts, intent data and marketplace listings each
   attract a request in the first pilot. Hold them until the overlap to
   outcome loop has run end to end for five connections.
