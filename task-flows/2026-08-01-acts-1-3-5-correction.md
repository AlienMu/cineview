# Task Flow - Acts 1, 3, and 5 correction (2026-08-01)

## Scope

- Correct the previously misunderstood Act 1 date placement and minute-hand/tick causality.
- Correct Act 3 framing, release playback ownership, scrub cadence, and in-picture V2 subtitle.
- Recompose Act 5 toward the supplied auditorium reference: dominant screen above, genuinely enlarged perspective seats below.
- Keep changes site-owned unless the diagnosed Act 3 replay bug is proven to be framework-owned.

## Approved Behavior

- Act 1 date is inside the dial, directly below the center hour value; it is not title metadata.
- Act 1 minute hand is visibly present from the beginning of the calibration sweep and reveals the ticks as it passes them.
- Act 3 video fills the viewport with centered `cover` cropping. Simulated clip scrubs are slower than the current 560ms cadence.
- Act 3 V2 subtitle is rendered over the video picture during the V2 range, and the six-second native playback starts only at the explicit closing handoff, not on ordinary drag release/continuation updates.
- Act 5 enlarges the seat bodies themselves and uses foreground perspective, with a dominant upper screen and a dark theatrical auditorium composition inspired by the supplied image.
- All new visible copy remains English-only.

## Revised Behavior (latest user direction)

- Act 3 has no closing native-playback animation. The three simulated drags and their video scrubs share the same starts and durations, with zero gap between adjacent strokes; the third scrub lands directly on the final frame.
- Act 3's fullscreen video background exits through a framework-owned blur + fade.
- Act 5 removes the side walls, screen panel, and every seat. Only projector light, dust, and unframed curtain-call text remain.

## Draft Refinement (latest user review)

- Act 3 keeps V1 assembly ahead of the media playhead: the video scrub starts slightly after the first V1 stroke, so clip 2 is already moving into clip 1 before media time enters the second two-second range. Timeline seeks must not reset or jump backward during the forward assembly.
- Act 4 retains the approved shutter mechanics but gains the material depth of the supplied lens reference: layered barrel rings, cool blue glass/blades, specular reflections, knurled rim, and restrained lens markings.
- Act 5 enlarges the credits and spacing, lengthens the stagger between lines, and adds two rows of close overhead lights with a faint projector below them. Screen/walls/seats remain removed.
- This is a user-review draft. Do not spend a cycle on unit tests or independent acceptance until the user confirms the visual direction.

## Act 5 Rollback (latest user direction)

- Revert only the latest Act 5 draft refinement: remove the two practical-light rows and faint projector, restore the prior credit sizes/spacing/stagger, and return the beam to its bottom projection-port origin.
- Keep the light/dust/unframed-text-only structure. Do not restore the auditorium screen, side walls, or seats, and do not change the current Act 3 or Act 4 work.

## Acts 3-5 Timing And Light Refinement (latest user direction)

- Act 4's timecode must visibly return to `00:00:00:00` before it fades. The shutter still closes fully for the exposure, then reopens only to an 80% resting closure before exit opens it completely.
- Act 3's fullscreen video enters from blur to clear before the existing authored scrub/playback movement begins. Keep the current V1/media timing and monotonic seek ownership.
- Act 5 credit opacity reaches full over the first 50% of each line's rise, all curtain-call typography increases by two CSS pixels, and a static upper-left key highlight echoes Act 1 without adding projector rays.
- This remains a visual draft. Run source/format/type checks only; keep Jest and independent browser acceptance deferred until user sign-off.

## Nodes

- [x] B1 - Read `DESIGN.md` and the applicable diagnose/frontend/ponytail workflows; establish the corrected requirements above.
- [x] B2 - Inspect the supplied reference, current Act 1/3/5 owners, prior tests, and existing browser harnesses.
- [x] B3 - Reproduce Act 3 playback restart after drag release with a deterministic real-browser signal.
- [x] D1 - Rank and test falsifiable replay hypotheses; identify the sole restart trigger and correct test seam.
- [x] T1 - Add failing behavior contracts for Act 1 hand visibility/date nesting, Act 3 idempotent playback/V2 overlay/fullscreen framing/slower cadence, and Act 5 seat-body scale/perspective composition.
- [x] I1 - Correct Act 1 hand lane composition and move the English date under the hour inside the dial.
- [x] I2 - Correct Act 3 media ownership, fullscreen centered crop, slower scrub cadence, and in-picture V2 subtitle.
- [x] I3 - Recompose Act 5 screen and seats to match the approved auditorium hierarchy on desktop and mobile.
- [x] V1 - Re-read each changed owner; check unique media/drag writers, no per-frame React state, no stale selectors, and no unnecessary dependencies or abstractions.
- [x] V2 - Run focused contracts, site type-check, formatting/lint checks, and production build.
- [ ] V3 - Have an independent agent validate the complete `/drag` path in real Chromium on desktop and mobile, including repeated release/re-grab, V2 subtitle, Act 1 causal timing, Act 5 reference composition, and frame/console health.
- [x] R1 - Add failing contracts for continuous Act 3 scrub timing, removal of native playback, blur/fade video exit, and light/dust/text-only Act 5 structure.
- [x] R2 - Remove Act 3 native playback ownership and land the continuous three-scrub transport with blur/fade exit.
- [x] R3 - Remove Act 5 auditorium panel, walls, and seats; retain only projector light, dust, and unframed text.
- [ ] R4 - Re-run static checks/build and complete fresh independent desktop/mobile browser acceptance against the revised behavior.
- [x] S1 - Inspect the new Act 3 timing report, Act 4 reference/material owners, and Act 5 light/type owners; record the draft direction above.
- [x] S2 - Delay Act 3 media scrub behind V1 assembly and prevent forward-entry seek rewinds/resets.
- [x] S3 - Increase Act 5 typography/stagger and add two close-light rows plus a faint projector.
- [x] S4 - Repaint Act 4 as a layered photographic lens while preserving the existing shutter curve.
- [x] S5 - Perform source/format/type sanity only and hand the draft to the user at `/drag`; defer tests and independent acceptance until sign-off.
- [x] S6 - Revert the latest Act 5 practical/projector/type enlargement while preserving the light/dust/unframed-text-only composition.
- [x] S7 - Trace the Act 4 timecode/shutter, Act 3 preview/media clock, and Act 1/5 light owners; record the approved sequencing above.
- [x] S8 - Implement Act 4 zero-before-fade and 80% closure, Act 3 blur-first entrance, and Act 5 fade/type/highlight refinements.
- [x] S9 - Re-read all changed owners, remove stale 60%/10% comments, and run formatting, site type-check, and diff checks only.

## Evidence Log

- Prior Act 1 focused browser probe: at 2950ms, 59 ticks were visible while the minute hand's effective opacity remained 0; the delayed nested advance lane starts revealing it only after 3000ms.
- Act 1 source cause: `s01-hand-minute-advance` declares rotation only, so the drag driver's default property values add an unintended 0 -> 1 opacity gate across its delayed lane.
- Act 3 browser reproduction: while native playback was at 0.85s, an ordinary release bounce entered `exiting`, paused and sought the same video node to 6s, then the terminal-progress update called `play()` again from 0. The replay trigger is site-owned `Act3Media.writePhase`, not a second drag writer.
- Act 5 reference comparison: the reference reads through large, solid seat backs that grow and crop into the foreground; the current five rows use 15-19 thin outline seats, so widening row spacing cannot correct the missing body scale.
- Corrected Act 1 browser probe at 1440x900: date is a dial descendant directly below the hour; minute advance and rendered minute hand both have effective opacity 1 during the sweep; no console errors.
- Corrected Act 3 browser probes: video rect equals the viewport at 1440x900 and 390x844 with centered `cover`; V2 `DIRECT` is visible over the picture; a playback bounce preserves 1.020s -> 1.141s and leaves the same video node at exactly one `play()` call.
- Corrected Act 5 browser probes: desktop screen is 1040x542; seat bodies grow 40x31 -> 230x180 and crop into the foreground. Mobile rows grow 22x17 -> 150x117 with no document overflow and no visible Chinese copy.
- Revised-contract red evidence: focused Jest run fails on the authored 80ms scrub gaps, 11.86s media clock/native playback owner, missing preview blur exit, and retained auditorium screen/walls/seats and their CSS.
- Revised focused green evidence: 14/14 Act 3/5 contracts pass after making the three 1100ms strokes contiguous, reducing the sole media clock to 5400ms, removing native playback code, adding preview blur/fade exit, and deleting all auditorium DOM/CSS.
- Draft Act 3 timing: V1 strokes stay at 2100/3200/4300ms; media scrub starts at 3200ms, so the second and third media ranges begin exactly when their corresponding V1 blocks finish assembling at 4300/5400ms. Selection and media subtitle datasets are separate, and media time is monotonic until committed `exited` resets it.
- Draft Act 5 paint: credit stagger 420 -> 720ms, entry 1800 -> 2100ms, larger role/name/THE END type and spacing, two overhead practical rows, a low-opacity framework-gated projector, and the existing beam/dust moved to its lens origin.
- Draft Act 4 paint: blade barrel radius 45.5% -> 36% to expose layered knurl/compression rings; blue optical metal, cached canvas sheen, glass reflections, and restrained barrel markings added without changing `shutterCycle` or exit mechanics.
- Draft sanity only, per user direction: site TypeScript check and Prettier check pass; `/drag` responds on localhost:3000. Jest and independent browser acceptance intentionally deferred until visual sign-off.
- Act 5 rollback: removed the two practical rows and faint projector, restored the 420ms credit stagger and prior type/spacing values, and returned the beam to the bottom projection-port origin. The screen, side walls, and seats remain removed; Act 3 and Act 4 are unchanged.
- Act 4 refinement: the timecode's existing MotionValue now maps exit progress into a 65% reset-to-zero segment followed by a 35% fade segment; parent and character holders remain visually neutral during exit. `RESTING_CLOSURE` is 0.8 and the same value seeds the dedicated exit-open curve.
- Act 3 refinement: the preview lane now enters from `blur(18px)` to clear over its existing 500ms budget; the media scrub still begins at 3200ms and keeps its current V1-aligned, monotonic transport.
- Act 5 refinement: credit fade duration is 50% of the rise, role/name/THE END clamps are each two pixels larger at both limits, and a static upper-left radial key highlight was added to the scene background without any ray or loop.
- Latest draft sanity: Prettier check, `pnpm type-check:site`, and `git diff --check` pass. Jest and independent browser acceptance remain intentionally deferred for user visual sign-off.
