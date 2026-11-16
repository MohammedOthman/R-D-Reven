# Reven MVP pilot

Open **https://reven-pilot-uinswy.cranl.net**. The workspace opens directly;
there is no login, registration, invitation, or organization setup step.
English and Arabic use the same saved workspace.

Everyone using this link shares the pilot data and the three pilot personas.
Use sample data. These personas let testers exercise the workflow; they do
not identify individual people or establish real independent approvals.

## Try a workflow

1. Start as **Owner**. Use **Add a partner**, then the partner's
   **Relationship** action to set an owner, objective, and cadence.
2. Add an initiative and its actions. Schedule a review and record decisions
   and follow-up work. For a decision requiring approval, select **Executive**
   under **Try as**, open the review, and approve it.
3. Switch back to **Owner** to record an outcome. Add supporting evidence,
   submit the outcome, and assign **Pilot Reviewer** as verifier.
4. Select **Reviewer**, open **Evidence & Outcomes**, and verify the assigned
   outcome. The product still rejects self-approval and self-verification.

Switching roles keeps the current record open when the new role can view it;
otherwise it returns to the overview. Roles control the available
navigation and actions. Account administration and sign-out controls are
hidden in the pilot. Returning to an account-management URL opens the pilot
instead. A lost or expired session reopens the last selected persona; an API
outage offers a retry page instead of asking for a password.

An outcome's verifier must be another active Owner, Admin, or Reviewer.
The picker shows eligible people and their roles. An Owner, Admin, or
Manager can use **Change verifier** on a submitted outcome to correct the
assignment. This preserves the submitted result and evidence and records
the change in the audit history. Completed verification decisions are not
reopened by this action.

## Deployment

The existing `reven-pilot` CranL app builds `MohammedOthman/R-D-Reven` on
`main`, using the repository Dockerfile and its existing port and domain.
It has a separate PostgreSQL database. Set `PILOT_AUTO_LOGIN=true` in that
app's environment, for both Next.js and the API. No new migration or secret
is needed for the pilot experience.

Keep `PILOT_AUTO_LOGIN` false or unset on the authenticated `reven-ry` app.
Its `/auth/pilot-session` endpoint must return 404. Normal accounts and role
checks continue to apply there. Enabling pilot mode deliberately makes its
shared workspace available to anyone with the link.

For a local pilot, point `DATABASE_URL` at a disposable review database, set
`PILOT_AUTO_LOGIN=true`, configure the usual API/web URLs, migrate, and run
the apps. The first visit prepares the pilot organization and Owner,
Executive, and Reviewer identities idempotently. Existing pilot records are
preserved; deployment does not reset or seed business data.

## MVP boundary

The pilot evaluates the implemented partnership workflow and its usability.
It does not validate personal account onboarding, multi-organization
switching, production email delivery, backup restoration, or individual
user attribution. Agreement amendments and the remaining roadmap features
remain separate work. The shared pilot roles do not relax the domain's
authorization, evidence, version, or separation-of-duties checks.

## Validation

All 329 automated tests, lint, type checks, and production API/web builds
pass. A real local PostgreSQL/API smoke covers password-free entry into
three distinct identities in one workspace; partner → partnership →
initiative → review → Executive decision approval; outcome → evidence →
submission → Reviewer verification; self-approval/self-verification denial;
invalid-role rejection; and recovery of the saved Reviewer persona.

A follow-up database smoke covers creator/disabled/foreign verifier
rejection, repair of a legacy assignment, role-based reassignment denial,
stale-version conflict, independent verification, terminal-state rejection,
and the audit event's before/after assignment.

Proxy and client tests cover first-render cookies, account-route redirects,
expired sessions, retry-page loop prevention, role preservation, invalid
role cookies, normal authentication with pilot mode off, and recovery during
JSON requests, evidence uploads, and downloads.

## Visual overview and motion

The portfolio overview includes relationship health, a selectable stage chart,
and visual workflow guidance. Charts use saved workspace data; unassessed
health is shown explicitly. The top-bar motion control pauses transitions and
the workflow connector, and remembers the choice. Device reduced-motion
settings take priority. See `quality/VISUAL_WORKSPACE.md` for design, data
scope and verification details.
