# Task Flow - Five-act polish and Act 3 media sync (2026-08-01)

## Scope

- Preserve the current `/drag` composition and existing accepted motion unless a requirement below explicitly changes it.
- Prefer site-only changes under `site/`; do not change framework ownership or drag hot paths unless current site APIs cannot express an approved behavior.
- Validate drag interaction and visual behavior in a real browser through an independent acceptance agent.

## Verified Baseline

- [x] Read `DESIGN.md`, `AGENT_SELF_REVIEW.md`, the five-act redesign flow, and the Act 3 handoff.
- [x] Inspect the current Act 1 and Act 3 source paths and the Act 3 active-selection implementation.
- [x] Inspect the supplied Act 5 reference image.
- [x] Identify `/Users/alienmu/Downloads/generated_video_1080_hd.mp4` as the intended six-second black-and-gold source (6.041667 s, 1168x1728, 24 fps).
- [x] Confirm the current installed `grill-me` workflow: one unresolved design question at a time, with a recommended answer.

## Decision Nodes

- [x] Q1 - Minute hand starts at 60, completes one full lap, then advances to the current minute (under two laps at minute 59). Ticks reveal on the first lap; calibration does not falsely advance the hour, while a real hour rollover uses an animated digit transition.
- [x] Q2 - Center hour uses zero-padded 24-hour time (`00`-`23`). The date is always English month + day with the correct ordinal suffix (for example `May 6th`), independent of the site's language; no Chinese date variant is rendered.
- [x] Q3 - Three clips map to contiguous `0-2s`, `2-4s`, and `4-6s` video ranges. Clip selection is exclusive; the matching subtitle/preview follow the active range. The closing beat clears selection, resets media/timecode/playhead to zero, and plays the full six seconds from the native video clock.
- [x] Q4 - Aperture enters from fully open, snaps fully shut for the exposure, then reopens to and holds at 60% closure with a hollow center. Exit reverses from 60% closure to fully open before fading; it does not close again on exit.
- [x] Q5 - The "board" is the auditorium screen. All five credits and `THE END` stay inside the screen; the enlarged screen/text own the upper half, enlarged seats own the lower half, and credits rise at roughly 1800ms each with a 420ms stagger.

## Implementation Nodes

- [ ] N1 - Act 1: live hour/date copy, larger dial, looser vertical rhythm, minute-led tick reveal, and animated hour rollover. **Reopened:** the delayed minute-advance lane keeps the actual minute hand at opacity 0 throughout the 3000ms tick sweep.
- [x] N2 - Act 2: bring the board in when the lighting entrance reaches its approved halfway point.
- [x] N3 - Media: transcode the six-second source to a 480p scrub-ready asset, verify dimensions/duration/keyframes, and place it in the site media path.
- [x] N4 - Act 3: mount the preview video, make clip selection exclusive, synchronize clip manipulation/video/subtitle/playhead/timecode, play the full six-second ending, and count from zero.
- [x] N5 - Act 4: fire fully shut, settle at 60% closure with a hollow center, then reopen fully on exit.
- [x] N6 - Act 5: enlarge the auditorium lower half, enlarge the upper text, keep text inside the approved board/screen, and slow the upward curtain-call motion.

## Verification Nodes

- [x] V1 - Re-read every changed owner and confirm no TODOs, duplicate helpers, stale selectors, or zero-consumer fields remain.
- [x] V2 - Confirm no per-frame React state or second media/drag clock writer was introduced; canvas work remains phase-gated.
- [x] V3 - Run focused tests, site type-check, lint/format checks, and production build.
- [ ] V4 - Independent browser acceptance on desktop and mobile `/drag`: Act 1-5 forward/reverse, re-grab, clip/video/subtitle continuity, six-second ending, aperture exit, Act 5 framing, console errors, long tasks, and dropped-frame symptoms. **Reopened:** the Act 1 acceptance did not assert hand visibility during the tick sweep and therefore cannot support a full pass.

## Evidence Log

- Source media probe: `duration=6.041667`, `1168x1728`, `24fps`, H.264 + AAC.
- Initial Act 3 active bug was structural: each `ClipSelection` was an enter lane that faded in and stayed active, so all three highlights accumulated.
- Initial Act 3 preview was a placeholder; the CSS mount box for a site-owned `<video>` already existed.
- Initial Act 1 center read hard-coded `01`; its hand sweep started from the sampled wall-clock angle, which conflicted with the new fixed-60 requirement.
- Q1 approved by the user: fixed-60 calibration, one full lap plus current-minute travel, first-lap tick reveal, and animated real hour rollover.
- Q2 corrected by the user: keep the zero-padded 24-hour center value, but render every new date label in English only (for example `May 6th` = May 6), with no Chinese variant.
- Q3 approved by the user: three exclusive two-second clip ranges, synchronized subtitle/preview behavior, then a zero-based full six-second native playback with synchronized playhead and timecode.
- Q4 approved by the user: full-close exposure, settle at 60% closure, and reopen to fully open during exit.
- Q5 approved by the user: all curtain-call text stays inside the enlarged auditorium screen, seats fill the lower half, and the upward cadence is slower and more elegant.
- N3 evidence: `site/public/act3-edit.mp4` is H.264/yuv420p, 324x480, 24fps, exactly 6.000s, 144 frames/144 keyframes, audio-free, fast-start, 1,139,042 bytes.
- N1/N2 focused evidence: `temporalDragW1.contract.test.ts` + `temporalDragW2.contract.test.ts` pass 14/14; site type-check passes. Act 1 clock state updates only at minute boundaries; Act 2 board delay derives as `260 + 1100 * 0.5 = 810ms`.
- N5 focused evidence: `apertureShutter.contract.test.ts` passes 3/3. Enter terminal and exit initial geometry both resolve to closure `0.600`; exit reaches fully open at 72% before the canvas fade begins.
- N6 focused evidence: `act5CurtainCall.contract.test.tsx` passes 2/2. The five credit nodes and `THE END` are descendants of `.s05-house__screen`; rise lanes are 1800ms with 420ms starts; five fixed-aspect seat rows occupy the lower-half grid.
- N4 focused evidence: `sceneSync.motion-contract.test.tsx` passes 8/8 and site type-check passes. `s03-media-clock` is the sole 10200ms authored transport; three static selection overlays consume its exclusive active index, clip ranges resolve to 0-2s / 2-4s / 4-6s, and the 4200ms handoff clears selection and resets media to zero before native six-second playback. `Act3Media` writes DOM/CSS directly from MotionValues/native video frames, phase-gates exit, and cleans every subscription, listener, and scheduled frame.
- V1/V2 self-review: no stale W6/4500ms/selection-lane references remain in the Act 3 owner. `--s03-play`, `data-active-clip`, and preview `currentTime` each have one writer. No per-frame React state was introduced; waveform/canvas loops remain phase-gated. `SceneSync.tsx` remains an oversized 767-line composition owner from the prior redesign and should be split in a dedicated structural pass rather than during this behavior fix.
- V3 evidence: all site contracts pass 31/31; site type-check, framework lint, site Prettier check, and the site production build pass. The build retains the existing warning for a minified application chunk over 500 kB.
- V4 independent browser evidence (partially retracted): the recorded Act 1 assertion only checked that the fixed-top lap completed before current-minute travel; it did not check that the hand was visible while ticks appeared. A 2026-08-01 focused browser probe disproved that missing claim: at 2950ms, 59 ticks were visible while the minute hand's effective opacity remained 0; the hand first became visible after 3000ms. The previously recorded Act 2-5, reverse, re-grab, performance, and console observations are unchanged, but the aggregate V4 PASS is invalid until Act 1 is fixed and independently retested. Trace: `.playwright-cli/traces/trace-1785532197559.trace`.
- Route note: the site currently uses BrowserRouter, so the working acceptance route is `/drag`; the AGENTS.md example `/#/drag` resolves to the homepage.
