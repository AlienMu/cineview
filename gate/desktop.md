# V2 desktop validation

Run composition smoke checks, independent timing assertions, desktop input acceptance, and performance sampling against an explicit V2 fixture server. Keep development-warning probes separate from production behavior and performance. These runners do not execute 1.x fixtures.

The default desktop profile is 1280 × 800, DPR 1, mouse and keyboard, without touch emulation. Chromium uses installed Chrome; WebKit uses a Playwright build. Playwright WebKit results do not establish branded Safari acceptance.

## Check the integrated example

The [integrated desktop example](../fixtures/integrated.md) ([中文](../fixtures/integrated.zh-CN.md)) combines related content in one main Scene, with static destinations before and after it. It documents framework and page ownership, timing, the grid/track contexts, and the finite Chrome/WebKit acceptance profile. Use this profile for the single-case composition review; the historical catalogs below remain available for explicit investigations.

## Check the public R1 opening

The opt-in R1 runner checks the AI guide's first ordinary-scroll scene: a purpose statement, a complete three-step diagram, and a primary action. Two SVG connections use `draw` and `after` in successive 650ms intervals. Text, steps and the native button remain available while the connections draw.

```js
import { publicHeroCases, runPublicHero } from './gate/public-hero.mjs';

await runPublicHero({
  base: 'http://127.0.0.1:4392',
  output: 'review/my-public-hero',
  engines: ['chromium', 'webkit'],
  cases: publicHeroCases(),
});
```

The four configurations cover English and Chinese with normal and reduced motion, producing eight engine/configuration rows at 1280×800. Normal cases compare SVG stroke output and public progress with elapsed document Clock time, check pause, and leave and return through wheel and keyboard input. Reduced cases retain complete static connections. Actual button clicks and Enter activation check that the action remains usable.

Run this profile while measured workers are stopped and choose a fresh output directory. Inspect the raw results and 24 selected screenshots after execution. R1 and the R2 protocol below check separate parts of the guide's PRD page; complete R1–R2–R3 integration still needs a same-page check. This functional profile does not measure performance or establish physical-device acceptance.

## Check the public R2 storyboard

The opt-in R2 runner implements the hypothetical three-step software explanation in the AI design guide. One `on="scene"` timeline supplies 4000ms of local time, corresponding to 4000px of scroll. The page supplies the registered illustrative SVGs, incoming-first image overlaps, step emphasis, loading fallback, local form and sequential layout adaptation.

```js
import { publicStoryboardCases, runPublicStoryboard } from './gate/public-storyboard.mjs';

await runPublicStoryboard({
  base: 'http://127.0.0.1:4391',
  output: 'review/my-public-storyboard',
  engines: ['chromium', 'webkit'],
  cases: publicStoryboardCases(),
});
```

The 20 configurations produce 40 engine/configuration rows: ready English/Chinese at two widths in both zone selections; delayed B/C and failed B images at wide English in both selections; reduced-motion and default sequential presentations in both languages and widths. At 640×900 the page uses sequential content, so those rows do not establish animated-zone coverage. Reduced/default cases use no zone; the fallback selection has no animation-path meaning there.

Wide ready cases check independent image/step expectations, intermediate rendered marker pixels, stopped and reversed states, large jumps, departure/return and actual local form actions. Wide ready English cases also use actual wheel, PageDown/PageUp, Home/End and document scrollbar input. Delayed-image checks inspect the page while fixture readiness is pending and check that obsolete image completion cannot write after page disposal. Native attachment is availability metadata, separate from functional results.

Run this functional profile only while measured workers are stopped. It reuses the served production bundle through public DOM authoring; it does not change the standard fixture or default queue. Results and screenshots are evidence only after an actual execution. This is one authored example, not all public templates or a performance measurement. Loading is not crossed with every language/layout/preference. The default DOM check does not establish HTTP delivery with all JavaScript disabled, and desktop width adaptation does not establish physical-device acceptance.

## Choose a batch

Call the exported functions with ordinary arguments:

```js
import {
  canonicalCases,
  pilotCases,
  runDesktop,
  runDesktopLifecycle,
  runPageControls,
} from './gate/desktop.mjs';
import { runOrchestration, runDragOrchestration } from './gate/orchestration.mjs';

await runDesktop({
  base: 'http://127.0.0.1:4380',
  output: 'review/my-desktop-smoke',
  engines: ['chromium', 'webkit'],
  cases: [...canonicalCases(1), ...pilotCases],
  realInput: false,
});
await runOrchestration({ base: 'http://127.0.0.1:4380' });
await runDragOrchestration({ base: 'http://127.0.0.1:4380' });
await runPageControls({ base: 'http://127.0.0.1:4380' });
await runDesktopLifecycle({ base: 'http://127.0.0.1:4380', cycles: 100 });
```

Use a new output directory for each batch so prior raw measurements remain available. `canonicalCases(2)` includes singles and pairs; `canonicalCases(3)` includes singles, pairs, and triples. Review configuration counts and measured running time before starting a large batch.

`combinations.mjs` enumerates 41 singles, 820 unordered pairs, and 10,660 unordered triples. Each receives a context status before execution. A runnable entry is an obligation. It is not a passing test. The canonical fixture places sibling components in one Stage; it cannot prove every nested, shared-element, reordered, or authored choreography combination.

## Run pair batches

Build a separate production fixture before measuring, then leave its assets unchanged throughout the batch:

```js
import { prepareDesktopSite, serveDesktopSite } from './gate/desktop-site.mjs';
import { pairPlan, runPairBatch } from './gate/pair-batches.mjs';
import { runPairOracles } from './gate/pair-oracles.mjs';

const site = await prepareDesktopSite('review/my-pair-run/production');
const server = await serveDesktopSite(site, 4382);
try {
  console.log(pairPlan().status);
  await runPairOracles({
    base: 'http://127.0.0.1:4382',
    output: 'review/my-pair-run/oracles',
  });
  // Inspect functional failures before beginning measurements.
  await runPairBatch({
    batch: 1,
    base: 'http://127.0.0.1:4382',
    output: 'review/my-pair-run',
    engines: ['chromium', 'webkit'],
    rounds: 3,
  });
} finally {
  await new Promise((resolve) => server.httpServer.close(resolve));
}
```

The pair plan retains all 820 concepts and 4,100 context statuses: 3,746 runnable, 154 not applicable, and 200 unsupported. Batches contain eight concept sets, except the final batch. The first batch prioritizes view effects, split text, delayed images, SVG drawing, variable fonts, Scene layout, local controls, and scoped variables. Its 38 runnable contexts require 228 runs across two engines and three rounds. An engine launch failure leaves that engine's obligations unexecuted.

Run each selected batch serially. Reusing the same output resumes unfinished cases by engine, round, and configuration ID; completed failures remain failures. Raw rows retain the actual round number. An interrupted final JSONL record is preserved in a separate evidence file and its case stays pending. Malformed complete records stop execution for inspection. Engine versions and environment errors remain in `progress.json` after resume.

Pair performance uses the canonical sibling fixture. `runPairOracles` separately checks selected shared elements, Scene relationships, and local controls in scroll-zone native and fallback contexts. It checks actual glyph font settings, line motion, SVG stroke geometry, clipping, rendered image colors, exit opacity, input isolation, and browser exceptions. A successful refused count/split check records an unavailable composition; it does not establish positive support. Shared-host results and drag adaptations require their own evidence.

## Continue the complete catalog

`combinationPlan({ order: 1 | 2 | 3 })` groups singles, pairs, or triples into batches of eight concept sets. `runCombinationBatch({ order, batch, base, output })` uses the same raw records, round isolation, and resume rules as `runPairBatch`. The existing pair exports retain their ordering and behavior.

Run a declared queue serially:

```js
import { combinationPlan } from './gate/pair-batches.mjs';
import { runBatchQueue } from './gate/batch-queue.mjs';

const jobs = [1, 2, 3].flatMap((order) =>
  combinationPlan({ order }).batches.map((_, index) => ({
    order,
    batch: index + 1,
    output: `review/my-matrix/order-${order}`,
  }))
);
await runBatchQueue({
  jobs,
  base: 'http://127.0.0.1:4382',
  output: 'review/my-matrix/status',
  engines: ['chromium', 'webkit'],
  rounds: 3,
});
```

The queue stops for review when a batch contains functional failures, unexecuted obligations, or an execution error. Performance observations remain raw evidence; no universal timing threshold stops the queue. Restarting the same declared jobs reads the existing records, including failures, before deciding what remains. It does not erase a failure or turn a retry into its original result.

Reusing a batch with no new browser call preserves its original `finished` time. A partial batch that retains its original start can include the interruption in its wall-clock duration; report that duration separately from active measurement time. Keep per-call calibration and version metadata attached to the rows from that call.

`queue.json` records the current job and completed batches. Use the actual process or execution handle to establish whether work is still live; a status file alone does not prove that. Keep build provenance with the run and preserve prior evidence when changing builds. Queue completion applies to its declared jobs. Same-element, nested, ordering, timing, capacity, and platform-specific acceptance still need their own declared coverage.

## Check actual behavior

`runDesktop` checks a numeric beacon, selected output properties, layer presence, errors, geometry, and disposal. Its result explicitly identifies composition smoke coverage. Dedicated feature probes remain necessary for each capability. With `realInput: true`, it also exercises mouse drag cancellation and return, keyboard navigation, wheel scrolling, and large jumps. Programmatic positioning remains labelled separately from actual input.

`runOrchestration` compares authored timing windows and opacity formulas with browser output. It covers positive and negative `after`, `sequence`, `at`, shared-source multiplication, separate progress sources, nested opacity, and refused count/split composition. Autonomous clock, ordinary-scroll dependency chains, interrupted exits, loop composition, and named-range output are checked separately by `runRuntimeFixes` in `runtime-fixes.mjs`. `runDragOrchestration` uses commanded pointer displacement as its expectation and checks Scene geometry separately.

`runRuntimeFixes` also checks paused structural rebuilds with complete roots and unfinished followers, completed clock/loop state, and document height after Scene removal. Run it against a fresh production fixture, with `base` and a new `output` directory.

Pass `groups: ['loop-periods']` to select the additional `AUTH-LOOP-OWN-PERIODS` checks. They use the existing fixture with `loop="sway, spin"` and no `loop-duration`, compare computed rotation against independently authored 5000/8000ms periods in both declaration orders, then check pause/resume on a fresh real Clock. The group selects all five contexts and remains separate from the default groups. Its browser results and performance sampling must be recorded separately; adding the group is not an acceptance result.

Pass `groups: ['loop-owners']` to select `AUTH-LAST-OWNER-CLIP-VAR`. It interleaves two hue and two wipe loops, then reverses their order. Independent time points check the later hue value, a child transform that consumes it, the later clip inset, and the visible and clipped hit regions. This opt-in group covers all five contexts. It checks variable output and clipping geometry; it does not measure painted pixels or performance. Run it separately against the production fixture and record its browser results.

Pass `groups: ['after-roots']` to select `AUTH-AFTER-ROOT-VIEW-GATES` in the two ordinary-scroll contexts. It checks that a below-viewport root waits, then completes its offscreen followers after entering view. A separate mount checks a non-replay root first found above the viewport: the chain reveals immediately while the Stage is paused. This does not describe the later reset behavior of a replay root. Run it separately for browser acceptance; its waits and assertions are not performance measurements.

Pass `groups: ['source-order']` to select `AUTH-SOURCE-ORDER-MATRIX` in all five contexts. It combines `push(1.6,1.2,25% 75%)` with `drift(80px)`, then reverses the declaration. A 320 × 200px subject supplies a known scale origin. Actual browser rectangles are compared with independently composed matrices, including a competing swapped-order prediction. The expected nesting keeps view translation outside the contextual time scale.

Drag uses held pointer positions for authored progress. Zones use controlled document scroll and the whole 4800px Scene for view progress. Ordinary scroll starts paused at zero entrance progress, then repeats with a played scale held by the public pause control; that second scale is a measured composition factor, not an independent check of the entrance curve. View movement is tested in both directions. Native attachment is recorded separately in `nativeCoverage`; an auto context name alone does not establish a native path, and ordinary entrance playback can still use WAAPI in a fallback context.

This opt-in group checks one noncommuting view/time pair, its noncentral origin, source ownership, and declaration-order invariance. It does not establish every source/kind combination, declared exit order, actual wheel input, or performance. Keep its browser output and availability separate from the standard sibling catalog and run it serially against the accepted fixture.

Pass `groups: ['decl-after', 'drag-entry-cancel']` to check the documented 950ms title and 600ms explanation with `after="title -150"` in drag. Both groups author linear easing for independent output formulas. The explanation starts at 800ms and ends at 1400ms; its view-driven drift remains a separate effect. Commanded pointer positions check Scene movement, public progress, opacity, and title translation while moving forward and backward. Explicit time scales of 16 and 40 make the sampling points reachable; they are test settings, not new defaults.

`AUTH-DECL-INTRO-AFTER` releases at 50% travel with unfinished entrances and waits for the committed Scene and final readable values. `AUTH-DRAG-PARTIAL-ENTRY-CANCEL` reverses while both entrances are incomplete, releases at 21.875% travel, records the synchronous release values and sampled return, and checks the reset stays held. Both hold for 350ms before release and record actual event duration to verify the default long-gesture rule. The return samples check for overshoot; they do not establish a precise interpolation curve. These opt-in checks select only drag. They do not measure declared departure effects or performance. Record actual browser results separately after implementation and review.

Pass `groups: ['lp-drag-details']` to select `AUTH-PUB-LP-DRAG-DETAILS`. A semantic SVG diagram and its body remain present while a title and two registered label/explanation groups enter at 0–950ms, 850–1450ms, and 1300–1900ms. Independent interval formulas, actual pointer positions, and Scene geometry check forward and reverse entrance samples, continued playback after a half-page commit, and cancellation after both followers have started. The explicit time scales of 25 and 40 make these points reachable at integer pointer coordinates; they are test settings. After a committed release, timestamped public-output samples check continued element time against the release observations. They must include advancing intermediate values and a settled page whose last follower is still entering.

The profile also declares 400ms fades with an 800ms Scene transition. Forward departure plays the exit; backward departure reverses the entrance. Both directions check signed public frames, independent opacity, quarter-page cancellation and restoration, and half-page commitment to useful adjacent content. Cancellation samples are compared with geometry-derived element time or departure progress. Screenshots retain the completed composition and both departure directions. These are opt-in functional checks for one authored drag case, not performance measurements or proof of arbitrary SVG animation. Run them serially against the accepted production fixture and record actual results separately.

Pass `groups: ['fx-owners']` to select `AUTH-FX-LAST-OWNER` across all five contexts. Ordinary hue and wipe effects check same-source, same-range replacement in both declaration orders. A second mount appends raw `from`/`to` values and checks that they own the variable and clip in either order. Two rise and two push effects separately check additive translation and multiplicative scale/opacity. Actual CSS, author-content geometry and inherited variable consumption check the outputs. Hit checks account for independently expected Scene interaction eligibility: an incoming drag Scene remains inert until the switch commits. Midpoint screenshots retain selected painted states; a hit test alone does not establish that inert content is painted.

Drag uses held pointer positions, quarter-page cancellation and a committed endpoint. Zones use authored scroll distances in both directions. Ordinary scroll uses public play/pause and its recorded time frame to check output mapping; it does not independently verify visibility-clock start timing. One family adds actual forward/reverse wheel input in scroll contexts; ordinary scroll holds an unfinished paused state during those inputs. An eligible page-opacity control records native attachment separately from the composed outputs, and ordinary entrance WAAPI remains distinct from scroll-native layers. These are opt-in functional checks; source preparation does not establish browser acceptance, other source/range combinations, declared exits or performance.

Pass `groups: ['fx-range-owners']` to select `AUTH-FX-RANGE-OWNERS` across all five contexts. Each row mounts five declarations as whole elements and as two split words. Three entry/exit orders distinguish replacement within a range group from the order in which groups first appear. Two more declarations distinguish an unnamed range from explicit `cover`, including raw values appended to the unnamed group. Whole elements share variable output while retaining nested clips; each split word shares all output between its range plans.

The profile derives view progress from a fixed 320 × 200px self subject and independently commanded viewport positions. A zone-only 1200ms empty time carrier gives the Scene a declared hold; samples cover passage before and after that hold. Drag uses real incoming commitment and outgoing cancellation. Scroll contexts add a trusted wheel pair. Two static words provide independent text geometry; split copies have `pointer-events:none`, so selected screenshots support painting while hit tests apply only to whole content and its Scene interaction eligibility. Four screenshots per row retain selected paint states. Native page-control attachments are recorded separately; the shared tested outputs use direct writes. This opt-in group does not establish browser acceptance until executed and reviewed, other source/subject/range kinds, declared exits, line reflow or performance.

Pass `groups: ['range-keys']` to select `AUTH-RANGE-KEYBOARD-ISOLATION` across all five contexts. Each row first checks ArrowRight, ArrowLeft, Home, and End in a separate scrollable document with no runtime loaded. It then uses actual keys on the native image-comparison slider, checking its value, the independently expected clip, decoded image registration, focus, and unchanged Stage, document and element progress. This is keyboard acceptance, not pointer or touch acceptance. Record platform-specific native behavior and any failures separately.

Pass `groups: ['image-return']` to select `AUTH-IMAGE-COPY-RETURN` across all five contexts. Two instances each combine a page-owned two-image dissolve with a framework duotone print. Paused WAAPI seeks at 1000, 6000 and 11000ms check independent opacity pairs 1/0, .5/.5 and 0/1. Programmatic departure and return check pause/resume, registration and copy counts. Teardown checks print removal, cancelled page animations and preserved original alt text. Screenshots retain the midpoint. This is one illustrative image/lifecycle case, not actual drag cancellation, delayed loading, arbitrary Ken Burns choreography, painted-pixel verification or performance measurement.

`runPageControls` checks native nested scrolling, local inertial dragging, navigation controls, scoped rotation, and a two-image dissolve. These examples include page-owned implementations. Their success does not make them built-in framework capabilities. Local inertia in this fixture disables native scroll snap; per-step assignment of `scrollLeft` with mandatory snap prevented movement in the tested engines.

Call `runScrollbarInput` from `scrollbar.mjs` with `{ base, output }` to drag the document's actual scrollbar thumb forward and backward. The runner makes the scrollbar visible for pointer testing and removes Playwright's headless Chrome `--hide-scrollbars` default. It uses scripted navigation only to place the initial Scene; thumb movement uses mouse input.

## Measure after correctness

Use `measure: true`, `realInput: true`, and `rounds: 3` on selected, verified configurations. Run measurements serially. Keep trace collection in a separate run with `trace: true`; screenshots and style assertions occur outside light sampling windows. Whole-case diagnostic traces include mounting and checks, so their frame totals are not isolated gesture scores.

For small fixtures covering the repaired runtime paths, call `runRuntimePerformance` from `runtime-performance.mjs` with `{ base, output, rounds: 3 }`. It samples composed loops across all five contexts, autonomous clocks, offscreen dependencies, and shared split ranges through active, paused, resumed, and departure phases. These selected samples do not replace the capacity tiers or full combination matrix.

Select the accepted own-period and ordered-output loop compositions with `cases: loopPerformanceCases()` and `captureState: true`. The exported function returns 20 configurations: two families, two declaration orders, and five contexts. Three rounds in both engines produce 120 measurements with 480 phase windows. Own-period active windows request 8100ms; ordered-output active windows request 1100ms. The other windows use `duration`, which defaults to 400ms. Hue cases include an author child that consumes the variable.

Loop preparation waits for activation before sampling. These active windows exceed each item's nominal period; they do not cover the 40000ms combined repeat of sway and spin. Check the recorded Clock and state values against the actual sampled interval before drawing a result.

These windows follow scripted instant navigation. A nearby loop can already be active before navigation, and scroll `current` reporting can follow the geometry change through an observer callback. Verify that the intended Scene occupies the viewport and its loop is active; retain the pending `current` value as metadata. Initial observer, current, and theme updates can occur within this protocol. Sampling only after those values settle is a different protocol and needs separate results.

State capture records the Clock, pause flag, loop periods, active flags, and actual layer styles before and after each window. These reads occur outside sampling. The added inspection changes the setup protocol, so compare these measurements within their declared scope. `clean` checks disposal and recorded errors; the separate correctness results and captured states are needed to establish what was running. Departure uses scripted navigation and does not establish pointer-driven exit performance. Initial after-root gates, authored exits, capacity, and other profiles remain separate obligations. Selecting these cases does not execute them or establish a performance result.

A previous Scene can retain an active loop within the drag or zone activation window after `current` changes. Check captured activation and geometry separately from the Scene index. Ordinary-scroll loops use their own on-screen condition. Keep these state observations separate from declared departure effects and measured callback cadence.

JSONL files retain every round, phase, raw rAF interval, supported observer entry, actual output, and failure. A functional `pass` does not mean a performance budget passed. Unsupported observer counts are `null`. rAF cadence measures callback scheduling, not displayed frames. Trace frame information is available only when the browser actually emits it.

Record machine, power, browser version, viewport, DPR, actual native/fallback layers, and calibration before comparing measurements. The one-second idle calibration is context, not a certified refresh rate. No universal frame-time or dropped-frame threshold is assigned by this runner.

Capacity tiers and repeated mount/navigation/disposal are separate obligations. Zero fixture nodes or animations after disposal does not prove the absence of every memory leak; Chromium heap samples are diagnostic, and other engines report that measurement as unavailable.
