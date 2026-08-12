# Task Flow - Acts 3-5 timing polish (2026-08-02)

## Objective

- Make Act 3 media entrance, edit playback, clip placement, and subtitles share one explicit framework-owned timeline.
- Make Act 4's displayed duration derive from the authored animation budget and place it above the subtitle.
- Move Act 5 credit sequencing from item-authored delays to CineView stagger, with wider spacing, longer motion, and greater travel.
- Preserve the framework's single-owner animation invariants and defer Jest until visual sign-off.

## Diagnosis

- [x] D1 - Verify the framework stagger contract and identify why Act 5 currently bypasses it.
- [x] D2 - Identify Act 4's displayed two-second source and the authoritative scene animation duration.
- [x] D3 - Reproduce Act 3's ineffective blur, inspect the media asset, and map clip placement deadlines to source-video edit boundaries.

## Implementation

- [x] I1 - Replace Act 5 per-credit delay ownership with framework stagger; increase credit spacing, enter duration, and vertical travel while preserving reverse exit order.
- [x] I2 - Derive Act 4's display from the authoritative animation duration and move it above the subtitle in document structure.
- [x] I3 - Make Act 3's framework-owned blur entrance visibly effective, align clip drag completion before each edit boundary, and render subtitles as white text without a background.
- [x] I4 - Replace the Act 3 media with a verified 720p encode while preserving duration, cadence, crop behavior, and poster compatibility.

## Self-review

- [x] S1 - Re-read each changed owner; confirm no second progress/currentTime writer, per-frame React state, dead constants, copied duration, or site-owned animation path remains.
- [x] S2 - Run formatting, framework/site type checks, lint, production build, asset metadata checks, and `git diff --check`; do not run Jest before user visual sign-off.

## Browser verification

- [x] V1 - In real desktop and mobile Chromium, verify Act 3 blur entrance, continuous playback, edit-boundary clip readiness, subtitle treatment, and reverse/re-entry behavior.
- [x] V2 - In real desktop and mobile Chromium, verify Act 4 duration/layout and Act 5 stagger spacing/travel/timing without overlap or overflow.
- [ ] V3 - Independent acceptance agent repeats the complete `/drag` path and explicitly checks animation smoothness, reverse ordering, and console/runtime errors.

## Evidence

- Current Act 3 source metadata before remediation: H.264-compatible video stream, `324x480`, `24fps`, `6.000s`; it does not satisfy the requested 720p output.
- D1: `SceneCut` explicitly bypassed stagger with five outer travel lanes plus five nested fade lanes, each duplicating `CREDIT_START_MS + index * CREDIT_EACH_MS`. CineView's `Animate.stagger` already owns direct-child cadence, effective group duration, and item exit variants.
- D2: Act 4's displayed range was a hard-coded `50` frames at 25fps (`2.000s`). The authored scene budget is `IRIS_START_MS + IRIS_ENTER_MS = 1300 + 900 = 2200ms`; the readout wrapper nevertheless completed at 1200ms, so both its range and rate were detached from the actual act clock.
- D3: the preview blur completed in `500 / 6500 = 7.7%` of the incoming scene clock, before enough of the scene was visible to read it. The six-second source was then scrubbed over three `1100ms` strokes (`3300ms` total), making media time run about `1.82x` the edit timeline. The source edit boundaries are `0s`, `2s`, and `4s`; clip completion deadlines will be derived from those boundaries with a positive readiness lead.
- I1/V2: Act 5 now has one `Animate` owner with `stagger.each=720ms`, a `2600ms` child duration, `140px` travel, and no per-credit delay. Fresh-framework mobile reverse sampling measured exit starts in order `[5, 4, 3, 2, 1, 0]`; all six children reached opacity `0` before Act 5 parked below the viewport. Settled mobile bounds were non-overlapping with zero horizontal overflow.
- I2/V2: Act 4's authoritative duration is `1300 + 900 = 2200ms`, producing `55` frames at 25fps and the settled readout `00:00:02:05`. Desktop and mobile measurements place the time readout above `SMPTE TIME CODE`; exit uses the same lane to reset the digits before opacity falls.
- I3/V1: Act 3 preview enters through the framework lane from `blur(30px)` over `2400ms`; media remains at `0s` until the blur resolves. Real-browser samples found clips 1/2/3 assembled before media `0s`/`2s`/`4s` boundaries, with no seek jump on release. Preview subtitles compute to white text, transparent background, and no border.
- I4: `ffprobe` verifies `act3-edit.mp4` as H.264 `720x1280`, `24fps`, `144` frames, `6.000s`; the poster is `720x1280`.
- S1: `AnimateVideo` remains the sole Act 3 `currentTime` writer; `Act3Media` only projects DOM text/data/CSS variables from the enclosing MotionValue frame. Act 5 has no item-authored timing, Act 4 has one duration source, and the removed stagger `tailDurationMs` output had no production consumer.
- S2: framework/site type-check, root and focused site lint, Prettier check, `git diff --check`, site production build, and `build:verify` pass. UMD gzip is `51199` bytes, below the unchanged 50 KB gate. Jest remains intentionally deferred until visual sign-off.

## Visual Baseline Correction

- [x] D4 - Compare Act 5 against the pre-stagger implementation and identify every framework/API change that only served the rejected stagger behavior.
- [x] D5 - Trace Act 4 DOM/CSS ownership to move both timecode and subtitle outside the aperture, with the timecode above the subtitle.
- [x] D6 - Recalculate all Act 3 clip landing deadlines against the actual video cut boundaries and identify whether the 720p asset contains genuine added detail or only upscaled source pixels.
- [x] I5 - Restore Act 5's prior per-item Animate sequencing and remove the rejected stagger exit API without touching the established visual styling.
- [x] I6 - Place Act 4 timecode and subtitle above the aperture as one external caption stack.
- [x] I7 - Make every Act 3 clip land before its corresponding edit appears and replace the soft upscaled encode with the sharpest available 720p source path.
- [x] S3 - Re-read only the changed owners, remove dead timing/API remnants, and run framework/site type-check only. No browser, performance, build, lint, or Jest runs before user review.

## Visual Baseline Correction Evidence

- D4/I5: Act 5 is back to the pre-stagger per-credit lanes (`1000ms` start, `420ms` cadence, `1800ms` travel, `900ms` fade, `80px` rise). The rejected `stagger.exit` public API, runtime propagation, design rule, and size-only minifier change are removed.
- D5/I6: `s04-main-timecode` and `s04-label` now share an external `.s04-caption` before `.s04-clock`; the number is above the subtitle and neither is a child of the aperture container.
- D6/I7: the clip landing deadlines are `2400ms`, `4400ms`, and `6400ms`, each `800ms` ahead of playback/cuts at `3200ms`, `5200ms`, and `7200ms`. The video and poster were regenerated from the available `1168x1728` source, not from the previous `324x480` encode.
