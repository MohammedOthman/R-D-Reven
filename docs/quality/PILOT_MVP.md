GATE: OPEN 18 (rounds used up)

# Pilot MVP validation

The user requested a pilot-friendly MVP with no login. This change builds on
the existing separate `reven-pilot` deployment and database. It adds shared
Owner, Executive, and Reviewer personas so approval and verification can be
tested while preserving the existing domain rules. It does not redesign the
personal-account invitation flow or enable anonymous access on `reven-ry`.

## Functional checks

- 286 automated tests pass: API 224, web 53, shared UI 9. Lint, type checks,
  and production API/web builds pass.
- A real local PostgreSQL/API smoke opens all three personas without
  passwords, checks one workspace and distinct identities, creates a partner,
  partnership, initiative, review, restricted decision, outcome and evidence,
  approves as Executive, and verifies as the assigned Reviewer. Self-approval
  and self-verification still return 403; an unsupported role returns 400.
- Expiring the Reviewer session preserves the selected persona on re-entry.
  Browser-facing HTTP checks cover all three roles in English and Arabic,
  account-route redirects, hidden account controls, and a real unavailable-API
  retry page with no login form. The recovery page renders at request time,
  so an image built before pilot mode is configured can still show it.
- Proxy/client regressions cover first-render cookies, invalid role cookies,
  expired refresh tokens, retry-page loop prevention, production-mode
  authentication, and renewal during JSON calls and evidence upload/download.
  Guide tests ensure Reviewer and Executive actions lead to permitted pages.

## Taste Skill adaptation

Source: https://github.com/leonxlnx/taste-skill, revision
`f6b76575f949707b4e3c37cd86cb44b0b98643e8`. Its scripts are unmodified.
This is an existing authenticated business application with pilot entry,
using Reven's Sora/Manrope/Cairo faces, navy/cream/blue tokens, original
logos, shared controls, and existing navigation. No stock artwork, invented
customer proof, new brand name, contact details, or assumed commercial
facts were introduced. Voice: factual workflow instructions and explicit
shared-workspace behavior. New explanatory body text uses the ink color.

Three gate rounds reduced 23 findings to 18. Remaining findings request a
marketing-page composition rather than the current application structure:

| Finding                       | Open target / reason                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| hero-fill                     | The overview shares the first viewport with the workflow and metrics.                                               |
| no-visual                     | The live overview is not wrapped in a promotional product mockup.                                                   |
| card-visual                   | Metric cards contain existing SVG icons and counts; the checker still requests inset visuals.                       |
| cta                           | The shared-workspace notice is interpreted as a hero without a button; the action is in the guide.                  |
| copy-headings                 | Existing “Needs attention”, “Decisions”, and “Initiatives” headings do not match the checker's category vocabulary. |
| moment-none                   | No decorative scroll moment is added to the workspace.                                                              |
| hero-screen                   | The scrollable application content is taller than one viewport.                                                     |
| section-height                | Application sections are not aligned to full-screen page increments.                                                |
| one-section                   | The shared app content wrapper is a div inside main.                                                                |
| one-heading                   | The dashboard has multiple meaningful section headings.                                                             |
| container-edges (header)      | The navigation has sidebar and top-bar offsets.                                                                     |
| container-edges (main)        | Main content accounts for the sidebar and content padding.                                                          |
| container-edges (outer shell) | The app shell is an outer div rather than a marketing-page band.                                                    |
| container-edges (locale link) | Top-bar padding differs from the dashboard card padding.                                                            |
| container-edges (guide)       | Guide text uses the shared card's internal padding.                                                                 |
| container-edges (notice)      | The pilot notice has its own internal padding.                                                                      |
| row-lines                     | The workflow list uses the shared card's internal padding.                                                          |
| container                     | The app uses its existing responsive wrapper rather than the skill's `.wrap` class.                                 |

Three individual waivers are recorded locally: two static Tailwind
outline-none findings compose with visible ring utilities on actual controls
(the noninteractive main target also suppresses its outline); the shared
pilot's “sample data” instruction is necessary product guidance. Live focus
checks pass. No findings are hidden and no checker or kit asset was edited.

The retained warning groups are copy-actions, heading-scale,
stranded-action, copy-length, and share-meta. The dashboard deliberately has
multiple working navigation/actions, established section sizes, wrapped
instructions, and private-workspace metadata. These are not reported as a
marketing-design gate pass. The earlier client-experience gate and its
scope are documented separately in `CLIENT_EXPERIENCE.md`.
