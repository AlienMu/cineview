# Homepage continuation — scenes 3, 4, and 5

## Current user direction

The user rejected the photographic redesign and instructed us to preserve the original first scene and its visual identity. They initially asked for small changes to scenes 2 and 3, then explicitly expanded the scope to redesign scenes 3, 4, and 5 because those scenes were not useful enough. The latest instruction supersedes the restriction on scene 3 only.

On September 6, the user clarified that scroll mode does not need mobile support. Desktop is the design and acceptance target for the remainder of this work. Completed responsive styles remain, but no further mobile adaptation or mobile acceptance is required.

First scene is restored byte-for-byte to the version before the photographic proposal, including its original CSS and HomeSceneCanvas wrapper. Second scene retains its original desktop composition; only readable preset pacing and the mobile overlap correction remain. Generated photographic assets and the proposed local background removal are withdrawn. Their originals and evidence remain outside the public site.

## Scope and intended behavior

- Scene 3: a working animation sequence. Switch between sequential and simultaneous entry, replay it, and show the corresponding native Animate timing configuration.
- Scene 4: a positioning and loop playground. Adjust real Position coordinates, turn the real Animate loop on/off, and reset the scene.
- Scene 5: a working stagger demonstration. Change the start order and interval, replay the existing six frames, and show the selected native stagger configuration.
- Keep the original display/body/mono fonts, warm colors, restrained line icons, and typography emphasis. No generated photographic or new illustration direction.
- Preserve completed Canvas behavior, real Performance measurements, existing Video, and Cinema handoff.

## Nodes

- [x] Restore the original Hero source, CSS, and mounting without discarding earlier user changes
- [x] Withdraw photographic public assets and cancel the unneeded background-removal proposal
- [x] Restore the second scene's desktop composition; retain pacing/mobile fixes
- [x] Recover the original third-scene files as the verified baseline before the newly authorized redesign
- [x] Implement the scene 3 sequence/replay demonstration using native Animate timing
- [x] Implement the scene 4 coordinate/loop/reset demonstration using Position and Animate
- [x] Implement the scene 5 order/interval/replay demonstration using native stagger
- [x] Integrate natural-height scenes and check desktop style consistency with the original Hero
- [x] Verify real interactions, keyboard access, reduced motion, offscreen behavior, desktop layout, and scene transitions
- [x] Run site type checks, contract tests, and build; save final evidence

## Ownership

- Root: scope, integration, unchanged Hero verification, second-scene limited fixes, shared visual review, final checks and evidence.
- Sequence subtask: Act3DollyScene component/CSS, replacing the just-restored original under the user's latest explicit authorization.
- Position subtask: PositionLoopScene component/CSS.
- Stagger subtask: EmanationScene component/CSS.

## Constraints

No new public API or framework changes. Do not use per-frame React state, layout reads followed by writes, custom animation RAF loops, hidden clock budgets, or invented Scene.scroll triggers. User-triggered control changes may use React state. Use native Animate/MotionValues for animated values. Controls must be usable with a keyboard and have visible focus. Reduced motion shows stable states. Keep prior evidence, marking withdrawn designs as historical rather than current acceptance.

## Verified implementation

- Scene 3: native sequential entry begins at approximately 73 / 873 / 1656 ms; simultaneous entry begins together at 62 ms. Replay, rapid switching, keyboard access, retained focus, offscreen reentry, and static reduced motion passed. See `sequence-demo-acceptance.md` and `.json` in `output/playwright/home-nine-scenes`.
- Scene 4: keyboard input changes actual Position coordinates, loop follows visibility, reset restores the center and disables the loop, and copied configuration matches the selected values. See `position-playground-report.json`.
- Scene 5: actual first/center/last onset order and 80/320 ms spacing match the selected native stagger configuration. Zero spacing describes simultaneous entry. Live reduced motion uses static frames; 34 sampled frames including ancestor opacities remained fully visible. See `stagger-control-acceptance.md` and `stagger-control-report.json`.
- Root desktop review: both Chinese and English layouts fit horizontally; controls remain visible and usable. Scene 4 uses natural height so its configuration continues below the stage. See `interactive-scenes-layout.json` and desktop screenshots.
- Original Hero source SHA-256 remains `d8b7225f410cdc857088ee943cbe231de5cb5f0c3306d29f45f90b12a4481a09`.
- Final site type-check, scoped formatting check, 12 site contract suites / 66 tests, and production build passed. Vite retains the existing large-chunk warning; no additional dependency was introduced for these scenes.
- Final desktop integration passed on the actual Vite route `http://127.0.0.1:4010/`: nine scenes/four native zones, all nine film frames, reverse movement, keyboard, large wheel deltas, video scrubbing to a real nonzero time, and Cinema's `/drag?deferred=true` handoff. See `film-integration.json`.
- The film probe previously read the old active index after a fixed 80 ms pause. Read-only observations showed that setting scrollTop precedes the native scroll/timeline commit and that the zone start stayed at 900 px. The probe now waits for the expected visible active frame with a bounded 1500 ms timeout, then asserts it; final additional wait was 1–8 ms. Product code was not changed for this probe correction. See `film-seek-diagnosis.json`.
- Final desktop Canvas integration passed after the natural-height scene changes, including exact forward/reverse pixel hashes and live reduced motion. See `canvas-report.json`.
- Production preview `http://127.0.0.1:4020/` was rebuilt and the original Hero/quickstart navigation passed there. Main assets: `index-C1eN3eOe.js` and `index-CKundtmb.css`.
