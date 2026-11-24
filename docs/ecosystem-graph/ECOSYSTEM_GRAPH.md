# Ecosystem graph: 50 ways to turn an account graph into an ecosystem-led graph

Status: **Phase 7 in progress (accounts & similarity graph shipped)**. Nothing
here changes the PRD scope. The shared partnership graph, matchmaking and
cross-company intelligence remain in `docs/ROADMAP.md` → "Later
(proof-gated)". This document sorts each idea into the stage where Reven may
build it without breaking a non-goal in `docs/brand/PRODUCT_UNDERSTANDING.md`.

Shipped on `main`: tenant-owned `Account` records (`portfolio/accounts`), the
derived `AccountSimilarityEdge` read model and `intelligence/ecosystem-graph/`
module (scoring, modularity communities, PageRank, layout, API routes, and
pilot example dataset), plus the `/ecosystem` and
`/ecosystem/accounts/[accountId]` web surfaces.

## 1. Where this starts

The starting artefact was an Apollo export of 61 technology leaders across
13 Saudi accounts. The first graph treated each account like a paper in
Connected Papers: two accounts are similar when they "cite" the same rare
things (bibliographic coupling over tools, positioning terms, NAICS codes)
or when a third party groups them together (co-citation through shared
lists). Rare features carry weight `ln(N / df)`, so Java at 13 of 13
accounts adds nothing while Taleo at 2 of 13 adds a lot.

That graph answers "who looks like whom". An **ecosystem-led** graph answers
a different question: _who already sits around this customer, and which of
my partners can open the door?_ Ecosystem-led growth (ELG) starts from
partner data, not from the partner program: you decide which prospects to
call first from the list of customers you share with a partner, and which
partner contact can introduce you.

Three shifts turn the first graph into the second:

| Shift        | Account graph (today) | Ecosystem graph (target)                                                   |
| ------------ | --------------------- | -------------------------------------------------------------------------- |
| Node         | Account, Person       | Account, Person, **Partner**, **Partnership**, **Initiative**, Offering    |
| Edge meaning | "looks similar"       | "sells to, implements for, integrates with, funds, introduced, influenced" |
| Proof        | similarity score      | verified Outcome + Evidence (Reven's spine)                                |

Reven already owns the third column's hardest part: `Partner`,
`Partnership`, `Initiative`, `Action`, `Review`, `Decision`, `Contribution`,
`Evidence`, `Outcome`, `Agreement`, `CommercialRule` all exist in
`packages/db/prisma/schema.prisma`. The ecosystem graph is a **read model
over those tables plus imported account data**, which is exactly what the
`intelligence` module is reserved for ("metrics, derived signals, reports,
read models only").

## 2. Stage gates used below

| Gate           | Meaning                                                                  | Data boundary                       |
| -------------- | ------------------------------------------------------------------------ | ----------------------------------- |
| **S0 · Now**   | Inside one tenant, from tables Reven already has plus CSV/Apollo imports | Never leaves the tenant             |
| **S1 · R1.1**  | Needs the Share Grant mechanism (ROADMAP item 16)                        | Field-level, revocable, per partner |
| **S2 · v2**    | Needs Revenue Event / Claim / Attribution (ROADMAP items 14–15)          | Tenant-owned, reviewed by humans    |
| **S3 · Later** | Cross-tenant network, proof-gated per PRD §18                            | Opt-in, double-blind, aggregate     |

Every pattern also obeys three rules from the PRD that never relax:
derived intelligence stores provenance, calculation version and
`refreshed_at`; no black-box recommendations (every score shows its
evidence); no automatic counterpart discovery or unpermissioned pooling.

## 3. The 50 patterns

### A. Re-type the nodes (who sits in the ecosystem)

| #   | Pattern                           | Graph change                                                                                                                                                                                           | Reven home                              | Gate |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ---- |
| 1   | **Partner as a first-class node** | Add `Partner` beside `Account`; the graph becomes tripartite: Tenant → Partner → Customer/Prospect                                                                                                     | `portfolio/partners`                    | S0   |
| 2   | **Partnership as a typed edge**   | Tenant–Partner edge carries `Partnership.stage` and `health`, so a path through an At-Risk partnership costs more                                                                                      | `portfolio/partnerships`                | S0   |
| 3   | **Seats around the customer**     | Each target account gets 7 role slots (SI, MSP, ISV, cloud, consultant, reseller, advisor). Jay McBain's research puts the average at seven trusted partners per customer. Empty seat = gap to recruit | `intelligence` read model               | S0   |
| 4   | **Role-typed edges**              | Replace "similar" with `SELLS_TO`, `IMPLEMENTS_FOR`, `INTEGRATES_WITH`, `ADVISES`, `FUNDS`, `OWNS`                                                                                                     | new read-model enum                     | S0   |
| 5   | **Initiative as a hyperedge**     | One `Initiative` node joins several partners and one customer, matching how AWS now runs multi-partner opportunities in ACE                                                                            | `execution/initiatives`                 | S0   |
| 6   | **Owners and funders as hubs**    | Parent and investor nodes (PIF, Aramco, Al Rajhi Bank, Delivery Hero) turn sister companies into one-hop warm paths                                                                                    | import mapping on `Partner.identifiers` | S0   |

### B. Overlap signals (co-citation for companies)

| #   | Pattern                      | Graph change                                                                                                                      | Reven home                                | Gate |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---- |
| 7   | **Account-mapping matrix**   | Own populations × partner populations, count per cell. `overlapMatrix()` in this spike                                            | `intelligence/ecosystem-graph/overlap.ts` | S1   |
| 8   | **Installed-base inference** | If an account's Apollo tech list includes a partner's product, add `RUNS_PARTNER_PRODUCT` with no data shared by the partner      | import + `Partner` product list           | S0   |
| 9   | **Co-listing**               | Accounts your team puts on one list (Apollo list, campaign) get a co-citation edge. Lists that hold every account carry no signal | CSV import                                | S0   |
| 10  | **Shared-owner coupling**    | Two accounts under the same parent or fund share an edge weighted by the owner's rarity                                           | import                                    | S0   |
| 11  | **Talent-flow edges**        | A person who moved from account A to B links A and B. Requires `Role` with `valid_from` / `valid_to`                              | person read model                         | S0   |
| 12  | **Event co-presence**        | Accounts exhibiting or speaking at the same event (LEAP, GITEX) get a dated co-citation edge                                      | Evidence link                             | S0   |
| 13  | **Program co-membership**    | Same accelerator, sandbox or government program (for example SAMA's regulatory sandbox, SAIL) links accounts                      | import                                    | S0   |

### C. Scoring and ranking

| #   | Pattern                 | Graph change                                                                                                                                                     | Reven home                           | Gate |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---- |
| 14  | **IDF coupling**        | Rare shared features count more; evidence lists them rarest first. `scorePairs()`                                                                                | `coupling.ts`                        | S0   |
| 15  | **Partner-fit score**   | `Offering SERVES Persona` + `Partner INTEGRATES_WITH Technology` + account `USES Technology` closes a triangle: this partner fits this account for this offering | read model                           | S0   |
| 16  | **Warm-path score**     | Dijkstra from the tenant to a target through partners, cost `1 − score`, raised when `Partnership.health` is At Risk. `pathToOrigin()`                           | `graph.ts`                           | S0   |
| 17  | **Seat-coverage score** | Share of the 7 seats your partners already fill at an account; low coverage = recruit, high = co-sell                                                            | read model                           | S0   |
| 18  | **Bridge accounts**     | Accounts that connect clusters (Salla in the Apollo test) carry case studies into several segments; rank by betweenness                                          | read model                           | S0   |
| 19  | **Cluster playbooks**   | Communities (`communities()` here; Leiden once a graph store exists) each get one message, one partner mix, one sequence                                         | read model                           | S0   |
| 20  | **Learned weights**     | Replace hand-set weights (0.40 / 0.35 / 0.15 / 0.10) with weights fitted to verified Outcomes                                                                    | `evidence-outcomes` → `intelligence` | S2   |

### D. Turn the graph into Reven's execution spine

| #   | Pattern                              | Graph change                                                                                                                         | Reven home               | Gate |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | ---- |
| 21  | **Overlap → draft Initiative**       | A high overlap cell proposes a draft Initiative; a Partnership Lead accepts or discards it. Never auto-created                       | `execution/initiatives`  | S1   |
| 22  | **Intro request as an Action**       | "Ask partner X to introduce us to account Y" becomes an Action with owner, due date, and a Blocker if the partner goes silent        | `execution/actions`      | S0   |
| 23  | **Review cadence from graph change** | When overlap with a partner grows past a threshold, pull `Partnership.nextReviewAt` earlier                                          | `portfolio/partnerships` | S1   |
| 24  | **Intro proof as Evidence**          | The intro email or meeting invite attaches as Evidence; the edge `INTRODUCED` exists only once evidence is verified                  | `evidence-outcomes`      | S0   |
| 25  | **Decision on the edge**             | Go / no-go on a co-sell motion is a Decision; the graph shows declined paths greyed, not deleted                                     | `execution/decisions`    | S0   |
| 26  | **Command Center tile**              | "Ecosystem pipeline": overlaps → intros → initiatives → verified outcomes, each count from its own `count()` like the existing tiles | `intelligence/dashboard` | S1   |
| 27  | **Partner review pack**              | Each partner's subgraph (shared accounts, open intros, outcomes) renders as the agenda for its Review                                | `execution/reviews`      | S1   |

### E. Attribution and revenue share

| #   | Pattern                            | Graph change                                                                                                                                           | Reven home                        | Gate |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ---- |
| 28  | **Sourced vs influenced edges**    | Sourced = the partner created the opportunity; influenced = the partner helped one that already existed. One sourced partner per deal, many influenced | `Contribution` type               | S2   |
| 29  | **Contribution edges per deal**    | Each partner's Contribution to an Outcome is an edge with role (sourced, sold, delivered, supplied technology)                                         | `evidence-outcomes/contributions` | S0   |
| 30  | **Claim graph**                    | Revenue Event → Claim → Attribution shares that reconcile to 100%, rule version pinned to the event date                                               | `revenue-share`                   | S2   |
| 31  | **Dispute hotspots**               | Edges with open Disputes render red; a partner with repeated disputes loses warm-path score                                                            | `revenue-share`                   | S2   |
| 32  | **Concentration risk**             | Herfindahl index over partner-sourced revenue flags dependence on one or two partners                                                                  | read model                        | S2   |
| 33  | **Rule provenance on every split** | Each attribution edge stores the `CommercialRuleVersion` id it used, so a later rule change never rewrites history                                     | `commercial-governance`           | S2   |

### F. Privacy, consent and trust

| #   | Pattern                       | Graph change                                                                                                                                                                   | Reven home                     | Gate |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ---- |
| 34  | **Grant-scoped subgraphs**    | A partner sees only the nodes and fields a Share Grant names; traversal to anything else returns the same 404 as a missing node (INV-005)                                      | `sharing`                      | S1   |
| 35  | **Blind match keys**          | Domains are compared as keyed HMAC tokens (`blindToken()`); production moves to platform-side matching or real private set intersection                                        | `overlap.ts`                   | S1   |
| 36  | **Small-cell suppression**    | Overlap counts below k (default 3) return `null` so a cell cannot single out one customer                                                                                      | `overlapMatrix(minCount)`      | S1   |
| 37  | **People stay home**          | Person nodes never cross tenants. Cross-company matching uses account domains only, which keeps the person-level disclosure questions under Saudi PDPL out of the overlap path | design rule                    | S1   |
| 38  | **Revocation expires edges**  | Revoking a grant sets `valid_to` on every derived overlap edge within the 60-second SHR-05 window                                                                              | `sharing`                      | S1   |
| 39  | **Consent ledger**            | A node per agreement to compare data: who, which populations, which fields, when, until when                                                                                   | `sharing` + `audit-operations` | S1   |
| 40  | **Audit every overlap query** | Each matrix computation writes an AuditEvent with inputs and calculation version                                                                                               | `audit-operations`             | S1   |

### G. Intelligence and AI layer

| #   | Pattern                       | Graph change                                                                                                                                                                         | Reven home                   | Gate |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ---- |
| 41  | **Edge extraction from text** | An LLM reads keywords, websites, press releases and proposes typed edges with evidence and confidence ("al rajhi bank subsidiary" → `OWNS`). A human confirms before the edge counts | `intelligence`               | S0   |
| 42  | **Community summaries**       | GraphRAG-style summaries per cluster answer "which partners matter in payments?" from the graph, not from memory                                                                     | `intelligence`               | S0   |
| 43  | **Intro drafter**             | Drafts the intro request from the warm path and its evidence; the user sends it, never the system                                                                                    | `intelligence` + `execution` | S0   |
| 44  | **Temporal diff alerts**      | Store graph snapshots; alert when an account adopts a partner's product or a champion changes jobs                                                                                   | `intelligence`               | S0   |
| 45  | **Lookalike partners**        | Node embeddings over the partner subgraph suggest partners that resemble your best-performing ones, for recruitment                                                                  | `intelligence`               | S0   |
| 46  | **Explanation card**          | Every recommendation shows inputs, weights, evidence and version, the same contract RULE-04 already applies to commercial rules                                                      | `web`                        | S0   |

### H. Network effects (proof-gated)

| #   | Pattern                        | Graph change                                                                                                                                                 | Reven home                 | Gate |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ---- |
| 47  | **Opt-in tenant network**      | Two Reven tenants that both opt in run a double-blind overlap; only counts and agreed fields return                                                          | new boundary               | S3   |
| 48  | **Partnership benchmarks**     | Anonymized aggregates (median time from intro to outcome by sector) across consenting tenants                                                                | `intelligence`             | S3   |
| 49  | **Underwritable partnerships** | A partnership with verified outcomes, pinned rules and clean disputes becomes a scored asset an outside financier can evaluate, the staged-vision end state  | new boundary               | S3   |
| 50  | **Orchestrator view**          | A platform operator (a bank, a sovereign platform, a hyperscaler region) sees its partners' joint pipeline as one graph, each partner's grant still enforced | `sharing` + `intelligence` | S3   |

## 4. Build order

1. **#1, #2, #29**: render Partner, Partnership and Contribution as a graph
   from tables that already exist. No new data, immediate value for a
   Partnership Lead.
2. **#8, #14, #15**: import Apollo accounts and tech stacks, score fit
   against partner products. This is the first graph built in this spike,
   re-pointed at partners.
3. **#22, #24, #25**: wire intros into Actions, Evidence and Decisions so
   every edge that matters has proof.
4. **#7, #34–#40**: account mapping, only after Share Grant ships.
5. **#20, #28–#33**: learned weights and attribution, after Revenue Share.

## 5. Read-model sketch (not in `schema.prisma`)

Derived edges live in one table so provenance and expiry stay uniform. This
sketch is for review only; adding it follows the "Adding a new feature
module" steps in `docs/ARCHITECTURE.md`.

```prisma
model EcosystemEdge {
  id                 String    @id @default(uuid()) @db.Uuid
  tenantId           String    @db.Uuid
  sourceType         String    // Account | Partner | Person | Initiative | Owner
  sourceId           String
  targetType         String
  targetId           String
  kind               String    // SIMILAR_TO | RUNS_PARTNER_PRODUCT | OWNS | INTRODUCED | ...
  score              Float?
  components         Json      // [{ family, score, evidence[] }]
  evidenceIds        String[]  @db.Uuid
  grantId            String?   @db.Uuid // set when the edge depends on a Share Grant
  calculationVersion String
  validFrom          DateTime
  validTo            DateTime?
  refreshedAt        DateTime
  createdAt          DateTime  @default(now())

  @@index([tenantId, sourceType, sourceId])
  @@index([tenantId, kind])
}
```

## 6. What the shipped code does and does not do

- **Data model & API (`apps/api`, `packages/db`)**: tenant-owned `Account`
  table in `portfolio/accounts` and derived `AccountSimilarityEdge` read model
  in `intelligence/ecosystem-graph`. Routes under
  `/tenants/:tenantId/ecosystem` serve `GET graph`, `GET accounts/:accountId`,
  `POST rebuild` (Owner/Admin), and pilot/non-production `POST seed-example`
  (Owner/Admin).
- **Scoring & graph (`apps/api/src/modules/intelligence/ecosystem-graph/`)**:
  IDF-weighted bibliographic coupling across `technologies`, `keywords`,
  `industries`, and `lists` (`coupling.ts`), top-3 union sparsification,
  deterministic greedy modularity communities, PageRank centrality, stable
  grouped layout, and provenance metadata (`graph.ts`). Every edge stores its
  per-family scores and evidence.
- **Web studio (`apps/web`)**: `/ecosystem` (Deep Navy hero, synced
  search/group filters, interactive constellation map with Focus/Full map
  lenses, 2-step warm bridge paths, node dragging, hover preview cards,
  minimap, visual match inspector, and synced company directory) and
  `/ecosystem/accounts/[accountId]` (company facts, closest matches across all
  four signal families, linked partners, and signal completeness).
- **Not yet shipped**: CSV/Apollo account import, person/contact records,
  partner-node overlay and warm-path routing through partners, Share Grant
  account-mapping overlap matrices (S1), revenue-share attribution edges (S2),
  and any cross-tenant network features (S3). No personal data, Apollo export,
  or licensed company data is committed; pilot examples and tests use
  synthetic records.

## 7. Sources

- Connected Papers, method: https://www.connectedpapers.com/about
- Crossbeam, account mapping and populations: https://crossbeam.com/how-it-works/account-mapping
- Crossbeam and Reveal merger (June 2024): https://www.crossbeam.com/crossbeam-and-reveal-merger-announcement
- ELG definition and limits: https://resources.rework.com/libraries/partnership-management/ecosystem-led-growth
- Jay McBain on seven partners per customer: https://omdia.tech.informa.com/blogs/2023/feb/have-the-industrys-channel-chiefs-really-moved-to-an-ecosystem-model
- AWS multi-partner opportunities in ACE: https://aws.amazon.com/about-aws/whats-new/2025/01/multi-partner-opportunities-partner-connections
- Sourced vs influenced revenue: https://getreditus.com/resources/glossary/partner-influenced-revenue
- Private set intersection: https://www.airbridge.io/en/glossary/privacy-set-intersection-psi
- Palantir Ontology (object, link, action types): https://palantir.com/docs/foundry/ontology/core-concepts/
- Graphiti bi-temporal edges: https://github.com/getzep/graphiti
- Saudi PDPL enforcement and transfer rules: https://www.clydeco.com/en/insights/2024/09/saudi-arabia-s-personal-data-protection-law-become
