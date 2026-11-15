# Reven client experience

Kind: software application; authenticated partnership workspace.
System: Reven's existing navy, warm canvas, and blue accent; Sora/Manrope and Cairo/IBM Plex Sans Arabic. The existing brand replaces a random palette and font deal. Natural-height workspaces replace marketing-screen layouts.

## Taste Skill application

Source: https://github.com/Leonxlnx/taste-skill/tree/f6b76575f949707b4e3c37cd86cb44b0b98643e8/skills/taste-skill

Voice: facts only; use the existing domain nouns consistently. Errors explain recovery. Buttons name the action. Counts come from the API. No customer claims, photographs, or invented social proof.

The user requested improvements to the existing application, rather than a company website. Keep the existing dynamic Next.js/NestJS architecture, authenticated routes, domain controls, and Reven brand. Do not convert the app to a static export. Marketing heroes, full-screen sections, promotional footers, shaders, and staged product mockups do not fit client workspaces. No marketing asset kit is loaded into business forms; the existing component system owns spacing and controls. Keep browser checks for overflow, contrast, naming, focus, reduced motion, and touch targets. Report marketing-only checker findings explicitly.

## Journey plan

- Account access: a single sign-in form beside a factual description of the implemented workflow; the same account shell supports registration, recovery, invitations, and organization creation. Inline input errors and visible focus.
- Navigation: delivered features only, current location, skip link, and a mobile dialog with keyboard focus containment and dismissal.
- First workspace visit: show the next allowed action and the actual sequence from partner to relationship to initiative. Open partner creation from that action.
- Lists: shared hierarchy, contrast, spacing, accessible row controls, correct sorting announcements, and contained table scrolling.
- Workspaces: shared headers, readable status labels, localized dates in the organization's timezone, and dialogs that scroll within a phone viewport.
- Evidence review: download the uploaded bytes through the authenticated API, renew expired sessions, expose download errors, and offer safe HTTP(S) source links. Every download is tenant-scoped, read-role gated, private/no-store, and logged.
- Motion: pointer feedback on controls; honor reduced motion. No animated records, scroll effects, or decorative loops in client work.

## Scope boundary

This change improves the existing client journey and completes evidence retrieval. It does not implement account mapping, revenue claims, external grants, an invitation/account model redesign, durable background email, transactional audit writes, or infrastructure recovery. Those remain separate readiness work.

## Verification

Results and any remaining Taste Skill findings are recorded after the browser and integration checks. Test records are local fixtures, not customer claims. No production records or settings are changed.

### Automated checks

- 260 tests pass (220 API, 31 web, 9 UI), including new download isolation/session renewal, keyboard-accessible row actions, field descriptions, password visibility, and timezone-boundary checks.
- TypeScript and ESLint checks pass.
- Local PostgreSQL HTTP smoke: create organization, partner, partnership, initiative, review, agreement, outcome, and evidence; upload a UTF-8-named file and retrieve identical bytes. Verify private/no-store and nosniff headers, unauthenticated 401, other-organization 403, unrelated evidence 404, and the download audit event.
- The smoke uses a real local database and API. It is not a claim that the full client workflow has been exercised through browser interactions.

### Taste Skill finish gate

`GATE: OPEN 11 (rounds used up)`

The skill's marketing-site checks were run without changing its scripts. Its three-round limit was retained. The following findings remain because this is an authenticated application with a natural-height account form, not a promotional landing page:

1. `copy-headline`: the primary heading is “Sign in,” rather than a product-category sales headline.
2. `moment-none`: no decorative animation is mounted on sign-in.
3. `hero-screen`: the account form does not fill a promotional hero screen.
4. `section-height`: the form is positioned by its content, rather than whole-screen sections.
5. `one-section`: the form's main wrapper is not a marketing section.
6. `container-edges`: the language switcher sits in the account column, rather than a full-page marketing nav.
7. `container-edges`: the application has a split account wrapper, rather than the marketing header/main/footer skeleton.
8. `container-edges`: the account column does not use the kit's `.wrap` class.
9. `container-edges`: the sign-in heading aligns with the form column, rather than the left edge of the full viewport.
10. `text-only`: a phone sign-in form is not accompanied by a promotional visual.
11. `container`: the existing component system supplies the container rather than `.wrap`.

Two static `focus-ring` findings were waived individually. Tailwind's outline-removal utilities are composed with visible ring utilities on the actual controls; the static scanner evaluates utility rules separately. On the account page, the browser's live `focus-visible`, `focus-hidden`, focus naming, labels, heading order, contrast, collision, overflow, and 320px checks pass. The first waiver also covers the noninteractive main skip target. The remaining `share-meta` warning is retained: this private app is marked noindex and is not a public social-sharing page.

No photographs, third-party logo stand-ins, invented customer claims, assumed prices, contact placeholders, or coined product name were introduced. The original Reven logo and brand remain in use. The visual check uses locally created records solely as test fixtures.

### Rendered review

The production build was captured in 25 sequential headless Chromium runs using the skill's unmodified `shoot.mjs` (one browser at a time). The mobile review covers the overview, a new organization's first-use state, partnerships, partner creation, initiatives and their workspace, reviews and their workspace, agreements and their workspace, commercial rules, outcomes and their workspace, audit, administration, and the Arabic overview. Account access was also captured at 1440, 1024, 820, 768, and 390 pixels, with an Arabic phone capture. Additional overview and partnership captures cover desktop and tablet widths.

Authenticated captures use a localhost-only test proxy supplying a genuine API session for seeded local organizations. That helper is not included in the application or this PR. Table content intentionally scrolls inside its own container on a phone. These screenshots confirm rendering; they are not an automated browser-interaction suite.

### Font loading

Performance verification found that the original shared font setup preloaded 15 files (337.6 KiB) on English sign-in. Keep the existing type families while selecting the locale's font variables, using variable Sora/Manrope/Cairo, and fetching faces on demand. Arabic body controls use regular and semibold weights. English sign-in now requests three font files (67.4 KiB); total transfer fell from 587.9 to 309.6 KiB at 1440px. Account links no longer speculatively prefetch other authentication routes. Sidebar and overview links also load private workspace routes on navigation rather than fetching every destination in advance.

The skill's English sign-in performance check has zero FAILs at 1440px and 390px, with zero measured layout shift and no broken requests. Parsed JavaScript and the three English font families remain WARNs. These are local CPU-browser measurements, not production latency commitments.

Arabic sign-in also has zero performance FAILs at both widths: six font files, 160.7 KiB of fonts, zero measured layout shift, and no broken requests. Its font count/bytes and JavaScript remain WARNs within the checker’s hard limits. The Arabic phone capture was repeated after the font change.

The authenticated overview performance check finishes with zero FAILs at 1440px and 390px, zero measured layout shift, and zero broken requests after private-route prefetch was removed. JavaScript/font budget WARNs remain. The final page was confirmed to contain the authenticated local workspace rather than an expired-session sign-in redirect.
