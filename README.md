# The Office — public-safe interactive model

A standalone snapshot of the actual office application, local scene editor,
autosave and real Home HQ public renderer. The authored room geometry is
preserved. Every photograph-derived surface and provenance-uncertain generic
map has been replaced with an original deterministic procedural texture.
Telemetry is synthetic and the app does not contact household APIs or services.

## Run locally

Use Node >=22.12. Install the declared dependencies with
`npm install`, then `npm run build` and `npm run preview`.
The supported build typechecks and bundles the app using the supplied prebuilt
`public/room` engine, exact/coarse sculpt caches, previews and baked lighting.
It requires no private workstation path, NAS, credentials or capture images.
`npm run dev` runs the same actual application. Dependency installation is a
local setup step, not permission to publish or deploy anything.

The in-room display embeds the actual Home HQ renderer with clearly synthetic
photos, cameras and shopping data. It is not a lookalike or a live household
feed. The shared renderer, styles and font OFL notices are retained.

## Controls

Open **Scene editor**, select **First-person**, then **Look around** for mouse
look. **WASD** moves, **R/F** moves up/down, and **Esc** returns to editing.
This is free flight, without collision. **Orbit** provides drag/pinch navigation;
touch devices use orbit/eye-level viewing instead of desktop mouse lock.
Normal canvas clicks select a whole physical object. **Alt-click** or the
**Objects** tree keeps fine-part selection available. **Save** and autosave are
browser-local; local GLB imports are never uploaded. **Reset scene** restores
this public model and is undoable through the native **Edit → Undo** action.

Scene edits and local GLB imports stay in this browser's local storage. The
visible Reset action restores this public model. No imported model is uploaded.
Prayer location is an illustrative city-level example, not a home address.
External web fonts are disabled; the app uses its authored fallback font stacks.

## Included model source and provenance

`model-source` contains the geometry/runtime TS source, minimal geometry-only
measurement JSON and all 41 procedural model images. There are no capture
photos, camera poses, private reference scans, raw hallway pixels or embedded
photographic payloads. The optional private reference viewer is disabled.
The original capture-to-model reconstruction is not included or required.
With Pillow already installed in an isolated Python environment,
`python -I model-source/generate-materials.py` regenerates the analytic maps and
checks exact reviewed bytes. The normal app build does not require Python.

`model-source/PUBLIC-MODEL-PROVENANCE.json` records the four material/reference
source adaptations, canonical geometry hashes, generator identity and exact
procedural image hashes. Exact and coarse SDF binary hashes are unchanged from
the authored model, while source/preview/environment bindings are regenerated
from the sanitized source. `PUBLIC-ASSET-REVIEW.json` records the locally
reviewed runtime derivation and hash approvals. Hashes establish byte identity;
the local source/image review establishes what those bytes represent.

## Licenses and boundaries

Preserve `model-source/LICENSE`, `model-source/ASSETS-LICENSE.md`, the vendored
Three.js/JS Signals MIT notices and font OFL notices. The inherited asset terms
remain intact; they do not turn private captures or third-party artwork into
MIT assets. Such original assets are not distributed here. New procedural
surfaces contain no sampled photographs, logos or third-party texture maps.
No new blanket first-party reuse license is selected by this export; the owner
may choose one separately. Product shapes/names do not imply endorsement.

`EXPORT-MANIFEST.json` pins every exported file except itself. `npm run verify`
checks those bytes and rejects missing/unlisted source files. Local root `.git`,
`node_modules`, build `dist` and npm-generated root `package-lock.json` are outside
that source inventory, so ordinary Git clones and `npm install` work normally.
The history-free export itself still contains none of those generated items.
Re-export after source edits
rather than silently invalidating the review. This snapshot contains no Git
history, credentials, deployment configuration or unrelated family sites.
Publication and hosting remain separate owner decisions.
