# Pilot handoff fixes

The pilot could offer the outcome creator, an Executive, or a Manager as
verifier even though those assignments could not complete independent
verification. There was no UI path to repair a submitted assignment, and
switching personas always lost the current record by returning home.

The active-member directory now includes each person's read-only role and
excludes disabled accounts. The verifier picker offers independent active
Owners, Admins, and Reviewers; the API enforces the same rule. A versioned,
audited **Change verifier** action lets submit-capable roles correct a
submitted assignment without changing the claim, status, creator, or
evidence. Reviewers and Executives cannot reassign, and terminal outcomes
remain closed. Changing the verifier cannot be combined with a verification
decision. This is a handoff correction, not a relaxation of self-verification
or assigned-reviewer authorization.

Pilot role switching retains a permitted record/page and its scroll
position. It returns to the overview for an area the new role cannot open.
Server authorization remains authoritative.

## Verification

- 307 tests pass: API 238, web 60, shared UI 9. Lint, type checks, and
  production API/web builds pass. No migration or environment change.
- A real local PostgreSQL/API smoke reproduces the legacy self-assigned
  submitted outcome and repairs it through the API. It checks disabled and
  foreign candidate rejection, active directory roles, Reviewer/Executive
  denial, 409 for a stale version, unchanged claim/status/creator, retained
  self-verification denial, successful independent verification, terminal
  reassignment rejection, and an audit event with both assignments.
- Regression tests cover Executive review handoff, Reviewer outcome handoff,
  role-incompatible/unknown/account routes, and eligible verifier options.

The existing Taste Skill application-layout gate remains **GATE: OPEN 18**;
its findings and three waivers are recorded in `PILOT_MVP.md`. This change
uses existing shared controls and dialogs and does not claim a new full
design-check pass.
