# Task Flow - Act 4 nine blades and Act 5 exit (2026-08-02)

## Objective

- Render a genuine nine-blade Act 4 iris with all geometry derived from one blade count.
- Make Act 5 exit as one cinematic beat: projector light extinguishes, then all typography fades out together.
- Keep all motion inside CineView `Animate`; do not add CSS animation, direct Framer Motion imports, or a second progress owner.

## Diagnosis

- [x] D1 - Confirm whether the Act 4 implementation authors eight or nine blades and trace every derived polygon value.
- [x] D2 - Trace Act 5 beam and typography exit ownership and explain why only `THE END` remains visibly animated.

## Implementation

- [x] I1 - Render nine visually distinct blades so no adjacent leaf merges into an apparent eight-blade aperture.
- [x] I2 - Give all Act 5 typography one exit owner, remove per-credit/The End exit competition, and make the beam extinguish without retracting.
- [x] I3 - Keep Act 3 clip 1 parked at the far-left assembled position, start playback only after V1 entrance, and land clips 2/3 exactly at the 2s/4s cuts.

## Self-review

- [x] S1 - Re-read changed owners and grep for stale eight-blade language, duplicate typography exit owners, and non-framework animation paths.
- [x] S2 - Run only `pnpm type-check` and `pnpm --dir site type-check`; defer browser, Jest, performance, build, lint, and formatting checks to user-directed review.

## Confirmed Timing And Layout Correction

- [x] D4 - Confirm the missing Act 3 beat: each two-second source segment needs a 220ms selected hold before its edit stroke.
- [x] D5 - Confirm Act 4 caption must be structurally outside the lens section, not merely ordered before the clock inside one shared center container.
- [x] I4 - Schedule clip 2/3 selection at source 0s/2s, delay drag by 220ms, and land exactly at source 2s/4s while playback continues.
- [x] I5 - Move the Act 4 timecode and subtitle to an independent stage-level caption layer above the lens section.
- [x] S3 - Re-read both owners and run framework/site type-check only.

## Screenshot Placement Correction

- [x] D6 - Confirm the requested Act 4 caption position is the open band immediately above the lens, not the page header.
- [x] I6 - Anchor the independent caption layer to the lens top edge with a responsive gap.
- [x] D7 - Confirm clip 3 takes over when clip 2 completes at video 2s and completes its own two-second segment at video 4s; the proposed 4s-to-6s shift was incorrect.
- [x] S4 - Re-read the Act 4 layout owner and run framework/site type-check only.

## Framework-Native Clip Sequencing

- [x] D8 - Confirm `waitFor` correctly serializes the non-staggered clip demo lanes and the existing no-waitFor rationale does not apply.
- [x] I7 - Make each clip demo a framework-owned 2000ms lane with a 220ms keyframed selection hold and chain clip 3 with `waitFor`.
- [x] I8 - Move V1 selection highlighting into framework `Animate` lanes and remove the `Act3Media` dataset writer/CSS selector path.
- [x] I9 - Make each seam wait for its clip demo instead of duplicating the calculated landing time.
- [x] S5 - Re-read the Act 3 owners, remove stale absolute-sequencing comments/references, and run framework/site type-check only.

## Evidence

- D1: `BLADE_COUNT` is currently `8`; `BLADE_HALF_SPAN`, `OPEN_INRADIUS`, vertex radius, blade axes, and the canvas loop all derive from that value, so the implementation cannot produce nine leaves.
- D2: each credit exits in `360ms`, while `THE END` exits in `700ms`; the credits therefore finish near the start of the `720ms` scene transition and only `THE END` remains visibly fading. The beam already owns an exit but combines extinction with a `scale: 0.5` retraction.
- D3: Act 3 currently creates a drag lane for clip 1 and uses an arbitrary `800ms` readiness lead. The source is `24fps`, so the exact pre-cut seam is one frame (`1000/24ms`) before the `2s` and `4s` boundaries; clip 1 needs no drag lane at all.
- I1: nine blade paths remain derived from `BLADE_COUNT`; a nine-entry facet tone table prevents similarly lit adjacent leaves from visually merging.
- I2: `s05-copy-exit` is the sole typography exit owner (`700ms`); `s05-beam` extinguishes in `560ms` at constant scale.
- I3 (superseded): the earlier one-frame lead at `5158.333ms` / `7158.333ms` was rejected.
- I4: playback starts at scene `3200ms`. Clip 2 is selected at `3200ms`, drags from `3420ms`, and lands at `5200ms` / video `2s`; clip 3 is selected at `5200ms`, drags from `5420ms`, and lands at `7200ms` / video `4s`. Playback remains continuous through both strokes.
- D7 (superseded implementation): the absolute-delay version still resolved to `clip 2: video 0s→2s`, then `clip 3: video 2s→4s`, but it duplicated framework sequencing and was replaced by I7-I9.
- I7: clip 2 is the sole absolute anchor at scene `3200ms`; its 2000ms demo lane holds `x=0` for the first 220ms, then drags for 1780ms. Clip 3 uses `waitFor='s03-v1-clip-2-demo'`, so the registry resolves it to scene `5200ms→7200ms` / video `2s→4s`.
- I8: `s03-v1-clip-2-selection` and `s03-v1-clip-3-selection` are framework keyframe lanes using the same dependency chain. `Act3Media` no longer writes `data-active-selection`, and the CSS dataset selectors were removed.
- I9: each `s03-clip-seam-*` lane waits for its corresponding `*-demo` lane; no production clip drag start/end arithmetic remains in `act3MediaTimeline.ts`.
