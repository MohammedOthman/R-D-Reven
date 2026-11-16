# Reven: a living partnership network

## Direction

A network of companies stays in motion around a shared operating layer. The first viewport places Reven's message over a live, dimensional architectural scene: data signals travel from company buildings to a central hub, the hub responds with expanding rings, and the camera shifts with the pointer. The same world moves into a dark cinematic section and a light capability explorer. Changing capabilities changes the emphasized route.

The scene visualizes the product's connected workflow; it contains no customer metrics or claimed live activity. Existing Sora and Manrope typography, Reven's actual logo, cream/navy surfaces, and blue accents remain. The sequence is: living-network hero, connected-work scene, three concrete benefits, interactive platform, operating rhythm, team workflows, final CTA.

## Applied skills

Applied skill source revision: `3cc9345` (14 November 2026). The user requested [MengTo/Skills](https://github.com/MengTo/Skills). This implementation follows:

- [Three.js](https://github.com/MengTo/Skills/blob/main/agent-skills/web-design/threejs/SKILL.md): a real scene, camera, mesh-based buildings, animated signals, controlled pixel ratio, resize handling, and complete disposal.
- [Build Awwwards-Quality Sites](https://github.com/MengTo/Skills/blob/main/agent-skills/web-design/build-awwwards-quality-sites/SKILL.md): a composed first viewport, original assets, GSAP choreography, one smooth-scroll engine, semantic content, static fallbacks, and browser validation. This is a design workflow, not an award claim.
- [Optimize Web Animations](https://github.com/MengTo/Skills/blob/main/agent-skills/codex/optimize-web-animations/SKILL.md): offscreen/hidden-tab suspension, direct control of render loops, reduced motion, bounded device resolution, cleanup, and verification of moving pixels rather than screenshots alone.

## Motion stack and responsibility

Three.js renders the moving network. GSAP owns heading/section choreography. Lenis is the sole smooth-scroll engine; it is lighter and simpler for this page than Locomotive Scroll. Lenis and GSAP are bypassed when motion is paused or the visitor requests reduced motion. CSS handles simple hover/focus feedback.

Generated city images from the previous revision remain as complete static posters for no JavaScript, reduced motion, or WebGL failure. A still image is never described as the animated scene. The new scene uses original procedural 3D geometry and interface/data graphics; no reference assets or scene code are copied.

## Verification

Before release, verify the initial viewport, dark scene, capability explorer, keyboard controls, Arabic RTL, mobile layouts, motion pause/resume, reduced motion, WebGL fallback, hidden-tab and offscreen suspension. Capture a short recording showing actual signals and rings moving. Check the production build and existing web tests, then verify the same behavior on CranL.

## Icon attribution

Homepage interface icons use the [Solar icon set via Iconify](https://icon-sets.iconify.design/solar/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Icon data is bundled locally; the page makes no icon API requests. The existing application icon system is unchanged.

## Browser acceptance results

Production-mode browser verification at 1440px and 390px confirmed:

- Different rendered pixels while running; identical pixels while paused.
- Zero active canvas render loops with all scenes offscreen.
- Zero active loops under reduced motion, with the complete poster visible.
- Rendering resumes after reduced motion is disabled.
- Capability selection updates the associated explanation and scene focus.
- No horizontal overflow on desktop or Arabic mobile.
- The message and poster remain visible without JavaScript.
- WebGL failure keeps the poster and semantic page usable.
- No page or console errors during the normal path.

The render budget is 30 fps, pixel ratio is capped at 1.5 (1.25 on narrow screens), and each scene defers WebGL creation until it enters view. Window blur, document visibility, explicit pause, and intersection state directly gate the render loop. Geometry, materials, renderer state, GSAP contexts/tweens, Lenis, listeners, and observers are disposed by their owning effect. The first-viewport message remains fully opaque during its short introduction.
