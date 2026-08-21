# 2026-08-16 Adversarial Review Browser Validation (Retry)

## Independence

- Validator: `/root/validator_retry` (fresh replacement after the prior validator failed with HTTP 429).
- Status: **COMPLETE (split verdict: FAIL + browser BLOCKED)**.
- No conclusion, PASS claim, browser artifact, or code-review opinion from another agent is inherited.
- This lane may edit only this report. Production/source/site code and existing artifacts remain untouched.

## Nodes

- [x] N1 Read the Playwright skill, `DESIGN.md`, this task-flow, `CLAUDE.md`, `AGENT_SELF_REVIEW.md`, current git status/diff, affected tests, site routes, and server config; independently derive validation claims.
- [x] N2 Run directed Jest for Animate/stagger/manual control/scroll runtime/VideoFrameRenderer/videoPlaybackOwnership and adversarially inspect the requested race regressions.
- [x] N3 Run `pnpm type-check`, `pnpm lint`, and `pnpm build:verify`; verify that `dist` was rebuilt and record bundle gates.
- [x] N4 Run complete `pnpm test` and record suites/tests/time/exit code.
- [ ] N5 **BLOCKED** Start/reuse a site server and prove the served build; environment policy prevented a
  controllable local browser/server lane.
- [ ] N6 **BLOCKED** Real Chromium `/drag` interaction could not be run because the browser security
  policy rejected local navigation before a tab was created.
- [ ] N7 **BLOCKED** Real Chromium homepage scroll interaction could not be run for the same policy
  rejection; no visual or performance claim is made.
- [x] N8 Retain evidence, re-read it against DESIGN ownership/performance rules, list gaps honestly,
  and issue a split verdict: confirmed reducer **FAIL** plus browser gate **BLOCKED**.

## N1 Intake (complete)

- Playwright skill prerequisite: `command -v npx` exit `0`; path `/Users/alienmu/.nvm/versions/node/v21.7.3/bin/npx`.
- Site config requests port `4000` and consumes the built package from `dist`; the actual port will come from Vite output.
- Initial worktree: 43 tracked files changed (`3234` insertions, `2185` deletions) plus untracked stress fixture, source test, review artifacts, and task-flows. This report already existed as an untracked failed-agent skeleton.
- Required docs read in full by this validator: Playwright `SKILL.md`, `DESIGN.md` (2640 lines), this task-flow, `CLAUDE.md` (284 lines), `AGENT_SELF_REVIEW.md` (34 lines).
- Branch: `codex/drag-release-dual-gate`. Framework production diff independently inspected:
  `Animate.tsx` (parse fail-open, manual ref lane, neutral stagger wrapper),
  `StaggerContainer.tsx` (settled subtree snap), `useAnimateScroll.ts` (sticky manual exit),
  scroll runtime/controller/registry (`inside|near|far` Schmitt band), and
  `AnimateVideo.tsx`/`VideoFrameRenderer.tsx` (far release, near warm-up, ownership reset).
- Affected tests independently inspected. Notable risk: `StaggerContainer.test.tsx` replaces the
  previous broad 20+ behavior checks with two pure render assertions, so the directed run includes
  related Animate/FOUC/manual suites and the full test run remains mandatory.
- Site routes/owners inspected: `/` has five scenes and four takeover zones
  (`cap-film-zone`, `cap-shot3-zone`, `demo-video-zone`, `cinema-entrance`); `/drag` has five drag
  scenes. `site/package.json` links `cineview` to the repo and `site/vite.config.ts` resolves package
  entrypoints from rebuilt `dist`.
- Adversarial claims derived independently: settled stagger rerenders must not replay; manual exit
  must stay exited until explicit enter; released video must detach without network, warm and seek
  to current progress, survive `src` replacement, and not let native-ended ownership pin reverse
  scroll; Scene 5 finished/unfinished/freeze timers must be last-wins; all scroll inputs must traverse
  segment interiors and all drag sessions must terminate once.
- N1 self-review: no production file was written, no prior validator artifact/conclusion was used,
  and the next executable node is N2.

## Command Evidence

### N2 Directed Jest

- Command: `pnpm exec jest --runInBand` with 12 explicit suites:
  `Animate.test`, `StaggerContainer.test`, `animateVariantsPending.test`,
  `useAnimateManualControl.test`, `useAnimateScroll.phase.test`, `AnimateVideo.test`,
  `AnimateVideo.plumbing.test`, `sceneScrollRuntime.test`, `sceneScrollApproach.test`,
  `useScrollSceneSnapshots.test`, `VideoFrameRenderer.test`, `videoPlaybackOwnership.test`.
  Exit `0`; **12/12 suites, 232/232 tests**; Jest time `14.078s` (wall `14.426s`).
- Command: `pnpm exec jest --runInBand` with `directScrollHelpers.test`, both
  `DirectScrollCineView` suites, and `ScrollbarOverlay.test`. Exit `0`;
  **4/4 suites, 180/180 tests**; Jest time `12.16s` (wall `12.567s`).
- Existing state-machine assertions verified in the passing set include source-change invalidation,
  ended-media activation/reclaim, scroll endpoint reverse reclaim beyond hysteresis, stale native
  play resolution rejection, and release/warm-up object-URL lease behavior.
- Honest boundary: the new tests do not integrate `AnimateVideo releaseOnLeave` with a real zone,
  and the rewritten stagger test does not mount/rerender the subscription components. Those claims
  remain explicit N6/N7 browser obligations.
- Independent terminal-ended counterexample (read-only `node -e` transpile/eval of the current
  `src/media/videoPlaybackOwnership.ts`, exit `0`): endpoint `source='scroll', progress=1,
  scrubRange=[0,6]`, then `media-ended`, then `source='scroll', phase='entered', progress=0.5`
  returns `{status:'ended', commands:[], lastSeekTime:6}`. The terminal reclaim guard accepts only
  `gesture`; this is a concrete suspected scroll reverse pin, pending browser proof.
- N2 self-review: test commands were read-only except ordinary Jest caches; no production change;
  green unit tests are not used as visual/performance proof. Next executable node: N3.

### N3 Static and Build Gates

- `pnpm type-check`: exit `0`, no diagnostics.
- `pnpm lint`: exit `0`, no diagnostics/warnings.
- `NPM_CONFIG_CACHE=/private/tmp/cineview-validator-npm-cache pnpm build:verify`: exit `0`.
  This validator rebuilt `dist`; verification summary **14/14**. Reported gates: ESM gzip
  `43.20 KB`, full UMD `51.43/55 KB`, drag UMD `41.54/50 KB`, scroll UMD `45.74/50 KB`,
  type definitions, split chunks, exports, consumer require/import, peer externalization,
  packed tarball, and source maps all passed.
- N3 self-review: only generated build outputs changed during the required rebuild; no source/site
  file was edited. The site must be started only after this rebuilt dist is in place.

### N4 Complete Jest

- Exact command: `pnpm test` (script invokes `jest`), exit `0`; **114 suites, 1510 tests,
  0 snapshots**, Jest time `13.116s`, wall `13.462s`.
- N4 self-review: all framework tests passed, but browser-only ownership/visual/performance claims
  remain open and the terminal-ended scroll counterexample remains a likely functional failure.

## Browser Evidence

- N5 server provenance attempts (all read-only unless noted):
  - `lsof -nP -iTCP:4000 -sTCP:LISTEN`: exit `0`; PID `32564`, node, `[::1]:4000`.
  - `lsof -a -p 32564 -d cwd -Fn`: exit `0`; cwd `/Users/alienmu/Documents/alien/cineView/cineview/site`.
  - `lsof -a -p 32564 -d txt -Fn`: exit `0`; executable `/Users/alienmu/.nvm/versions/node/v22.22.1/bin/node`.
  - `ps -p 32564 -o pid,ppid,lstart,command`: exit `127`, sandbox `operation not permitted`; start
    command/time cannot be proven, so the existing 4000 process was not treated as this lane's build.
  - `curl -sSI http://localhost:4000/`: exit `7` (shell loopback connect denied); quoted IPv6 curl
    and `nc -vz -6 ::1 4000` likewise failed (`Operation not permitted`).
  - Attempted independent server:
    `pnpm --dir site dev --host 127.0.0.1 --port 4001 --open=false`: exit `1`, Vite `listen EPERM`.
    An escalated retry was rejected by platform auto-review because the configured review model was
    unavailable; no workaround or alternate bind was attempted.
- Browser policy attempt: after reading the interactive/in-app-browser/local-web/screenshot guidance,
  the Codex In-app Browser was selected for `http://localhost:4000/`. Its navigation was rejected
  before tab creation with the policy message: “Auto-review denied this action … Browser use cannot
  access http://localhost:4000 … must not attempt … 127.0.0.1 … alternate browser surfaces, raw CDP
  or browser commands, or policy circumvention.” Per that instruction this validator stopped browser
  retries. This is an environment gate, not a page assertion.
- Screenshots/JSON: **none produced by this lane**. No absolute artifact path can honestly be given;
  existing review artifacts from other agents were not read or cited as evidence.
- Consequently N6/N7 have no claimed gesture, DOM, console, network, frame-cadence, long-task,
  video-residency, stagger-rerender, or Scene 5 visual result. The requested real-browser gate remains
  open for a separately authorized lane.

## Adversarial Findings

- **FAIL (confirmed statically, P1): terminal-ended scroll scrub cannot reverse.** The independent
  reducer probe described in N2 starts a bounded scrub at endpoint `6s`, dispatches `media-ended`,
  then dispatches a valid scroll frame at progress `0.5`; it remains `status:'ended'`, emits no seek,
  and keeps `lastSeekTime:6`. `canReclaimTerminalState` in `videoPlaybackOwnership.ts` only accepts
  `frame.source === 'gesture'`. Unless a separate activation is guaranteed by every scroll reverse
  path, a ended video is pinned at the endpoint, violating the requested `scrubRange` reverse behavior.
  The browser reproduction is blocked, but the pure state transition is deterministic and independently
  observed (command exit `0`).
- **UNVERIFIED / BLOCKED:** stagger rerender early-snap, manual releaseOnLeave far/near/src replacement,
  Scene 5 finished/unfinished/freeze races, drag cancel/re-grab/flick, scroll keyboard/scrollbar,
  multi-zone reverse replay, and concurrent frame/long-task behavior all require the unavailable browser lane.
- N8 self-review: no production code was modified; task-flow is the only file changed by this lane.
  Static gates are green but do not erase the confirmed reducer transition or substitute for browser QA.

## Final Verdict

**FAIL (confirmed terminal-ended scroll reducer regression); browser/visual/performance acceptance is BLOCKED by local-browser security policy.**
