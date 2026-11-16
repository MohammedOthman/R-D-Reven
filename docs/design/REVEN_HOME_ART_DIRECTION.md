# Reven homepage: art direction and production prompts

Reference: https://ahoy.technology/ — inspected 16 November 2026 at a 1440 × 1000 desktop viewport. This specification describes the observed page and the implemented Reven adaptation. The reference changes over time and includes scroll-dependent animation; a prompt alone cannot guarantee an identical rendered page.

## Visual reading of the reference

The page is an editorial technology presentation. Its opening is typography, space, and restraint; its visual complexity arrives after the first CTA. Its sequence is a light typographic introduction, a wide cinematic panel, a dark explanation, a pale-blue spatial demonstration, another dark capability section, light partner cards, and a concluding invitation.

| Element          | Observed reference                                                    | Reven implementation                                                           |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Desktop content  | Approximately 1200px, 120px margins at 1440px                         | 1200px maximum, responsive gutters                                             |
| Navigation       | 88px sticky, pale translucent surface, compact links                  | Same height and treatment; platform, rationale, teams, locale, workspace       |
| Hero             | 96px/96px Lexend Deca, regular weight; three lines, last clause muted | Responsive Sora, regular weight and tight tracking; three Reven-specific lines |
| Reading copy     | Manrope, about 20px in hero; smaller section copy                     | Existing Manrope; 19px hero, 14–15px sections                                  |
| Technical labels | IBM Plex Mono, 10–11px, uppercase with wide tracking                  | Existing IBM Plex Mono; numbered section indexes                               |
| Color            | Near-white/pale lavender, slate navy, blue CTAs                       | Reven canvas `#FBFAF7`, navy, `#2C5BFF`, pale blue                             |
| Buttons          | Blue pill, roughly 48px tall, small arrow                             | Same geometry and interaction hierarchy                                        |
| Media frame      | Broad, rounded, cinematic panel below the first fold                  | Original rendered navy city with gentle cinematic motion                       |
| Dark sections    | Low-contrast black/navy cards, thin blue-gray borders                 | Navy surfaces, thin borders, clear ownership/execution/evidence narrative      |
| Spatial scene    | Fine blue wireframe city, elevated camera, pale ground plane          | Original wireframe city artwork with live capability markers                   |
| Section rhythm   | Generous vertical space, indexed labels, mixed composition            | Six distinct sections, alternating light/navy, mixed column proportions        |
| Motion           | Ambient media, scroll-driven scene changes, small hover transitions   | Gentle scene drift, selected markers, capability tabs; global pause            |

Reven keeps its actual wordmark, existing typefaces, bilingual architecture, and product scope. It does not present Ahoy's AI capabilities, latency statistics, customer counts, or industry deployments as Reven claims. The wordmark is never distorted, glowed, or reconstructed as generated text.

## Master implementation prompt

> Act as a senior digital art director and frontend designer. Build Reven's public homepage using the visual grammar of the supplied Ahoy reference. At 1440px, use a 1200px content rail and an 88px sticky, translucent, pale navigation bar. Open with a small blue status dot and widely tracked technical category label. Follow with a regular-weight, tightly tracked, approximately 96px headline arranged in exactly three intentional lines, with the third line in muted slate. Use the words “See what your / partnerships / deliver.” Keep the hero left aligned, spacious, and free of a decorative dashboard beside the headline. Below it, use the exact positioning line “The operating system for revenue shared between companies.” Add a short supporting explanation, three small proof points, one blue pill CTA with an arrow, and a quiet scroll cue across the same row. Separate the hero with a hairline rule. Continue into a numbered section and a broad, 30px-radius cinematic frame. Alternate deep-navy explanation sections with a pale-blue architectural scene and light team cards. Use fine wireframe geometry, isometric perspective, transparent blue planes, and small technical annotations to express connected companies working toward one governed outcome. Use `#2C5BFF` as the only decorative saturated hue. Use Reven's real SVG logo, Sora display, Manrope body, IBM Plex Mono labels, and the existing Arabic font pairings. Keep content about partnerships, joint execution, agreements, reviews, evidence, and independent outcome verification. Preserve the authenticated product at `/workspace`. Build real anchor navigation, keyboard-accessible capability tabs, a mobile menu, localized CTAs, and a motion pause. Honor reduced-motion preferences. Every section must contribute a distinct part of the story. Supply complete English and Arabic content, logical CSS properties, visible focus, and readable mobile layouts.

## Artwork prompt: pale architectural ecosystem

Direction for the applied light architectural artwork:

> An original architectural visualization for an enterprise partnership operating system. Orthographic isometric camera, approximately 30 degrees above a precise square ground grid, looking diagonally across a connected city of abstract company buildings. Fine electric-blue wireframe outlines, extremely pale blue transparent glass faces, soft cool off-white ground, generous negative space. Vary building heights and footprints with coherent architectural proportions. Leave two broad clear routes crossing through a central shared hub. The central hub is a small luminous blue architectural volume surrounded by thin concentric elliptical rings. Small blue signals connect distinct buildings toward the hub. Analytical, calm, precise, institutional, sophisticated technology editorial art direction. No people, no logos, no letters, no numbers, no charts, no dashboards, no floating UI, no neon purple, no orange, no cyberpunk. Broad 16:9 composition. Reserve the right third for live HTML capability controls. Crisp vector-like edges at 2400px wide; no depth-of-field blur, no fisheye, no wide-angle lens distortion. Use only off-white, desaturated slate, and `#2C5BFF` with translucent tints.

Place captions and controls in HTML rather than asking an image model to render them. At mobile widths, reframe the artwork above the controls instead of shrinking desktop text into the image.

## Artwork prompt: dark cinematic panel

> A cinematic original version of the same isometric company ecosystem, preserving exactly the same buildings, elevated orthographic camera, hub location, and routing geometry. Deep navy `#0F1629` atmosphere and matte surfaces. Very fine desaturated blue building edges and a few luminous electric-blue signals following the routes into a shared hub. A single focused bright node, restrained bloom, no lens flares. Keep the left third and lower-left region dark and visually quiet for a live HTML headline and paragraph. Detail accumulates toward the upper-right. No text, logos, people, charts, dashboards, stars, planets, purple, or magenta. Broad landscape crop, calm enterprise technology aesthetic, controlled contrast and clean geometry.

## Motion direction

For rendered video production, use a locked camera and a seamless 8–12 second loop. Animate signals along fixed paths at a measured pace and pulse the central ring gently. Keep the scene architecture stationary; no camera shake, dolly zoom, or abrupt cuts. Render a still poster from the same camera and lighting. Offer a visible pause and serve the poster to reduced-motion visitors. Do not use a moving image as the only source of product information.

The implementation now embeds two finished, original architectural images: a dark cinematic city and a light wireframe companion, delivered as local WebP assets. A gentle transform animation gives the dark scene motion; capability tabs update both the product explanation and highlighted labels over the light scene. The pause control and reduced-motion preference stop decorative animation. No video download, WebGL dependency, external media host, or live portfolio data is required. Team illustrations show labelled example workflows rather than performance statistics.

## Fidelity and acceptance

Compare at the same viewport, scroll position, font-loaded state, and motion phase. Evaluate the content rail, header height, line breaks, type scale, media-frame aspect, spacing, surface transitions, and line density independently. Generated assets alone will not reproduce layout, typography, or scroll behavior. A literal pixel-identical version would also require the exact reference fonts, media, 3D scenes, content, animation timelines, and responsive breakpoints; those are deliberately adapted here for Reven.

Check 1440px, 1024px, 768px, 390px, and 320px in English and Arabic. Confirm no clipped headings, unintended horizontal scrolling, hidden controls, or missing translations. Confirm the homepage loads without the API, workspace links still require the normal session or pilot flow, and changing a capability tab works by keyboard. Check reduced motion and the explicit pause control separately.

## Routes and scope

- `/en` and `/ar`: public landing/home page, independent of tenant/API availability.
- `/en/workspace` and `/ar/workspace`: existing authenticated Command Center, with existing tenant and role checks.
- Existing partnership, agreement, review, initiative, evidence, and audit routes keep their URLs.
- Sign-in, sign-up, invitation, onboarding, recovery, and pilot-role fallback now return to `/workspace`.
- Pilot visitors enter through “Try the pilot”; normal visitors can create an account or open their workspace.

The portfolio charts and working application remain data-backed. This change introduces no synthetic customer metrics, testimonials, or production claims.

## Applied artwork and copy

The public page uses `apps/web/public/brand/home/partnership-city-dark.webp` (1672 × 941, about 260 KiB) and `partnership-city-light.webp` (1672 × 941, about 340 KiB). Both are original generated artwork, optimized to WebP and committed with the page. The dark city supplies a cinematic metaphor for connected companies; the light companion makes the four capability labels visible in an architectural scene. Neither image implies an actual deployment or customer relationship.

The hero now states a concrete visitor benefit: “See what your partnerships deliver.” Its explanation names the tasks: manage partners, assign joint work, and verify results. Subsequent sections answer: what gets easier, how the workflow connects, who uses it, and how to start. The existing category, positioning line, and tagline remain verbatim. English and Arabic carry the same claims and next steps.

CTAs describe their destination: “Create your workspace” opens account creation, “Try the pilot” opens the shared pilot workspace, and “See how it works” jumps to the capability explorer. Pilot copy explicitly identifies the shared demo and that no account is needed. Team workflow illustrations are marked as examples.
