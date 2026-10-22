# Electrical/mechanical physical audit — 2026-10-21

Scope: `apparatus/electrical-mechanical.mjs` only, plus its tests/notes and this QA family. Shared renderer and automatic sequences were corrected by the parent agent after this audit identified the visibility override.

## Verified

- `node --test apparatus/electrical-mechanical.test.mjs` — **10/10 pass**. Includes 61 travel positions with constant analytic rope length, tangent direction agreement, hub clearance and no-slip rotation signs. Includes 74 discrete rheostat terminal/contact cases, actual winding/brush coincidence and correct highlighted path ends. Includes charge bookkeeping across rod and earth, real tip/ball contact, attached foil tops, horizontal pan geometry and closed magnetic flux returns.
- `node qa/physics-mechanical-browser.mjs` — **15 state cases pass** in isolated headless Chrome on localhost:4198, zero page errors, plus assembled and front views. Real rendered visibility is checked after animation frames for the ground wire and cookware/eddy/field parts.
- Manually inspected images: pulley at full lift, A/B rheostat winding/contact view, electroscope contact and grounded states, induction hob active x-ray, no-pan and assembled views.

## Useful images

- `physics-mechanical-pulley-0.png` / `physics-mechanical-pulley-2.png`: travel endpoints; continuous correctly wrapped rope and centered hanging load.
- `physics-mechanical-rheostat-1.png`: B selected at quarter position; current path starts at brush and continues to B.
- `physics-mechanical-electroscope-1.png`: rod touching ball; charged leaves separated and ground absent.
- `physics-mechanical-electroscope-2.png`: rod nearby, earth connected, opposite charge near ball and leaves closed.
- `physics-mechanical-electroscope-4.png`: induction completed; earth absent and leaves reopen.
- `physics-mechanical-induction-hob-0.png`: horizontal winding/pan-bottom eddy paths, radial returning flux loops, actual rear electronics layout.
- `physics-mechanical-induction-hob-2.png`: removed cookware also removes drive field and eddy display.
- `physics-mechanical-induction-hob-assembled.png`: real open vessel and horizontal rim.

## Boundaries

Geometries are authored teaching structures, not manufacturer drawings. The fields/leaf angles are qualitative, and the 36-turn rheostat uses ideal discrete top contacts. Dropdown operations select named experiment snapshots; automatic sequencing includes an explicit discharge between contact and induction experiments. No deployment or publishing performed.

Final integration: parent must include the final source build (last correction adds the lower-sheave no-slip sign invariant); generated HTML is parent-owned. The screenshots already prove structural/visibility changes; the wheel is rotationally symmetric, so the final rotation-sign correction is verified by a displacement equation test rather than visually inferred.
