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

Two static `focus-ring` findings were waived individually. Tailwind's outline-removal utilities are composed with visible ring utilities on the actual controls; the static scanner evaluates utility rules separately. The browser's live `focus-visible`, `focus-hidden`, focus naming, labels, heading order, contrast, collision, overflow, and 320px checks pass. The first waiver also covers the noninteractive main skip target. The remaining `share-meta` warning is retained: this private app is marked noindex and is not a public social-sharing page.

No photographs, third-party logo stand-ins, invented customer claims, assumed prices, contact placeholders, or coined product name were introduced. The original Reven logo and brand remain in use. The visual check uses locally created records solely as test fixtures.
