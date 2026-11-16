# Visual workspace refresh

Reven's overview now shows actual relationship health and stage distribution,
with clearer task queues and role-specific next actions. A shared visual system
updates the navigation, headers, cards, tables, dialogs and empty states across
the application. The existing no-login pilot and saved data are preserved.

## Design and data

The interface retains Reven's navy, cobalt and cream palette and existing
self-hosted English and Arabic fonts. A dark overview header, health ring,
selectable eight-stage chart and connected workflow replace the previous
uniform white-card layout. Desktop uses a split portfolio view; tablet and
phone stack the same content in reading order. Arabic uses the same hierarchy
with logical direction properties and full stage labels.

Health includes open relationships and excludes Terminated and Archived.
Unassessed relationships remain explicit rather than being counted as healthy.
Stage totals include every relationship, including closed stages. Selecting a
stage filters a preview of the three most recently updated matching records;
**Open partnerships** opens the complete portfolio. No conversion rates,
trends, simulated activity, new sample records or invented proof were added.
Failed portfolio sources show the dashboard's error state instead of false
zero totals. Attention, due-review, decision and initiative queues are limited
previews, with the limits explained; KPI totals cover all matching records.

Owners/Admins/Managers can add a partner, Executives open reviews, and Reviewers
open outcomes. Reviewers receive no initiative/review links from metrics,
attention records or the workflow guide. API authorization remains unchanged.
The compact pilot notice still explains that everyone shares saved changes.
The sidebar now highlights the actual workspace on both list and record routes;
previously the original route helper fell back to Command Center everywhere.

## Motion

The overview settles once, routes enter briefly, dialogs open in 200ms, and
buttons and linked records respond to interaction. A 3.2-second connector in
the workflow shows how its steps connect; it does not represent live activity.
There are no scroll reveals, hidden-until-visible content, animated counts,
automatically changing tabs, canvas effects or new animation dependencies.

The top-bar motion control and the workflow's pause control share one setting.
The `reven_motion` cookie persists it across navigation and refresh. Device
reduced-motion preference takes priority, including changes during a session.
Phone workflow connectors remain still. Portal dialogs follow the same setting.

## Validation

- 329 tests pass: API 238, web 82, shared UI 9. New coverage includes real
  health/stage populations, empty data, stage filtering, allowed role actions,
  source failures, persisted pause, changing device motion preferences, and
  navigation on seven workspaces and their nested routes.
- Lint, type checks and the production web build pass. No dependency,
  database migration or deployment environment change is required.
- Local HTTP/API smoke verifies first-visit no-login entry, actual open
  relationship totals, motion-off server rendering, Arabic RTL, all three
  pilot roles and allowed actions, no restricted Reviewer links, six core
  workspace routes, and database readiness. This is separate from UI tests.
- Production captures were inspected at 1440x900, 1024x768, 820x1180,
  768x1024 and 390x844. Arabic was inspected at phone width, including a
  reduced-motion full-content capture. Taller captures expose the inner
  scrolling content; they are not presented as standard phone viewports.
  A desktop partner table and phone outcome detail were also inspected.
- Taste's unmodified standalone five-size layout check reports no horizontal
  overflow, with only its missing marketing `.wrap` rule at each size.
  Unlike the earlier application review, this run completes successfully.
- Browser controls are unavailable in this environment. Screenshots and
  automated browser checks use the skill's unmodified headless scripts;
  interaction behavior is covered by React tests and HTTP checks.

## Taste Skill gate

**GATE: OPEN 17**, after the three permitted rounds (25 → 19 → 17).
Taste Skill 2.5.1, revision `f6b76575f949707b4e3c37cd86cb44b0b98643e8`,
was applied to an existing operational Next.js application. Reven keeps its
own components, brand tokens and actual data instead of importing a separate
marketing-site system or decorative stock assets. No skill scripts or kit
files were modified.

The remaining findings are explicitly open, not a claimed design-check pass:

| Rule                                   | Count | Application-specific reason                                                                                                |
| -------------------------------------- | ----: | -------------------------------------------------------------------------------------------------------------------------- |
| hero-fill, hero-screen, section-height |     3 | The app has a fixed shell and naturally sized content inside its main scroll region, not full-screen marketing sections.   |
| flush                                  |     1 | The checker measures the route wrapper as a ground boundary; the actual overview has 40px desktop and 24px phone padding.  |
| no-visual                              |     1 | It treats the complete operational dashboard as a feature section; actual data charts and controls are the product itself. |
| cta                                    |     1 | The shared-pilot notice is misidentified as the hero. The overview contains the role-specific next action.                 |
| moment-none                            |     1 | Motion uses task transitions and a pausable workflow connector, without an unrelated full-screen scroll moment.            |
| one-section                            |     2 | The application shell uses layout wrappers and inset dashboard panels.                                                     |
| one-heading                            |     1 | Relationship health is a real, navigable h2 within the overview.                                                           |
| container-edges                        |     5 | A desktop sidebar and padded multi-column cards use their own content edges, rather than equal outer viewport margins.     |
| split-pair                             |     1 | The data-driven overview split uses application proportions, rather than the marketing kit's twelve-column split lines.    |
| container                              |     1 | The app uses its existing responsive Tailwind container instead of a marketing `.wrap` class.                              |

Five exact waivers are retained: two static Tailwind `outline-none` utility
false positives (composed controls retain visible focus rings), the necessary
shared-pilot sample-data warning, and two row-clipping false positives where
the portfolio and attention panels continue below the inner scroll viewport.
Full-content screenshots confirm those cards are readable in full.
The checker also reports 15 non-blocking warnings, including compact controls,
repeated contextual actions, generic workflow labels, and marketing copy
heuristics. These remain inspectable rather than hidden from the checker.

## Performance

The final production overview check at 1440 and 390 reports **0 FAIL, 3 WARN**.
There are no broken requests, unused mounted modules, WebGL contexts or layout
shifts (CLS 0.000). The remaining warnings concern parsed framework/application
JavaScript and the desktop font count. On phone, two self-hosted font files
use 57.3 KiB. No animation package or external visual asset service was added.
These are local CPU/browser measurements, not a promise about client network
latency or production field performance.

Deployment uses the existing `reven-pilot` CranL app and URL, the same main
branch and Dockerfile, with its existing database and pilot environment.
