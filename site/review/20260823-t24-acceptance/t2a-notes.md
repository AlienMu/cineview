# T2.1 docs agent notes (animation 3 pages + animate-video, zh/en x8)

## Verified facts

### presets (43, not 44 — brief said 44, code says 43)
animationCategoryMap counts (presets/index.ts == types PresetAnimation == per-file exports):
- fade 3: fade, fade-in, fade-out
- slide 4: slide-up, slide-down, slide-left, slide-right
- zoom 4: zoom-in, zoom-out, scale-up, scale-down
- rotate 4: rotate, rotate-in, rotate-out, spin
- flip 3: flip, flip-x, flip-y
- bounce 3: bounce, bounce-in, bounce-out
- blink 3: blink, flash, pulse
- shake 5: shake, shake-x, shake-y, vibrate, jello
- blur 3: blur-in, blur-out, focus-in
- elastic 4: elastic, rubber-band, wobble, swing
- special 7: heartbeat, tada, wave, roll-in, roll-out, hinge, jack-in-the-box
TOTAL 43.
Mechanism: dynamic import per category (11 lazy chunks); cache shared across all CineView
instances; in-flight coalesced; PRESET_LOAD_TIMEOUT_MS=3000 → transient
ANIMATION_ASSET_LOAD_FAILED (retryable); unknown name/category/export missing → permanent
INVALID_ANIMATION. Error codes surface via callbacks.onError (types/index.ts CineViewErrorCode).
Nothing from presets/ exported by barrel — mechanism is internal, public surface = string names.

### custom
- CustomAnimation { initial?, animate?, exit? } records; validateCustomAnimation: only keys
  initial/animate/exit, at least one non-empty object. parseAnimation: string→preset, object→custom.
- transformOrigin strings normalized to % pairs (parser).
- Scrub-lane interpolation (animateInterpolation.ts): scalar = from→to lerp; array = keyframes,
  times from transition.<prop>.times ?? transition.times, fallback even spacing
  index/(n-1); lerp handles numbers, unit strings, single-arg transform fns translateY(100%).
- 10-property whitelist: opacity x y scale rotate rotateX rotateY skewX skewY filter.
- Site real examples: DemoVideoScene.tsx VIDEO variant (keyframes + times, opacity/filter/scale);
  CapabilityScene.tsx solidVariant()/riseVariant() (neutral lane / whitelist-only, transition
  duration 0 under scroll) — brief said temporal-drag, actually CapabilityScene.
- ComposedAnimation { animations[], mode: sequential|parallel, delays? (ms) }: sequential —
  step delay = sum(prev duration + customDelay/1000) + own; undeclared duration assumed 1s;
  initial from first, exit from last; merged per-value transition (framer per-value form).
  parallel — all start at 0 + own customDelay; initial/exit merged (last-wins per key).

### waitfor / stagger
- registry.ts resolveDelay: calculatedDelay = own delay + leader.calculatedDelay + leader.duration.
  Issues: missing-dependency (INVALID_ANIMATION public), circular-dependency
  (CIRCULAR_DEPENDENCY; cycle members fall back to own delay only), duplicate-id
  (INVALID_COMPONENT_HIERARCHY), incompatible-driver (visibility follower→scroll leader OK as
  runtime-completion-only — no delay accumulation, waits for runtime completion; other cross
  driver pairs rejected). timelineDuration = max(base, calculatedDelay+duration).
- StaggerContainer.tsx internal; public = Animate stagger prop (AnimateStaggerConfig each=40,
  from='first'|'last'|'center'); children must be single ReactElement (type-enforced);
  framer native variant propagation, bypasses 10-property whitelist; time-driven, no scrub;
  effectiveDurationMs = max(authored, tail + itemDuration) drives completion clock.
- T1.8 constraint (task-flows/2026-08-23-stage3-demo-hub-docs.md lines 71-76):
  leader WITH authored timeline.phase + waitFor follower → sceneScrollBudget dual clock split:
  phase correction only applied to px clock (totalEndPx=phaseEndPx), ms clock (resolveTiming
  totalEndMs) unchanged, follower startPx derives from ms clock → follower starts early
  (demo: subline started at title 14%). Fix on demo side: pure 3-level chain, no phase.
  Framework gap recorded P2 (fix budget or declare constraint in types/docs) → doc declares it.

### animate-video
- Scrub: progress 0..1 → currentTime. No scrubRange: [0,duration]. scrubRange [from,to] clamped
  to [0,duration], reverse intervals (from>to) OK. mapVideoScrubProgress.
- Ownership reducer: single writer. Endpoint handoff: scrubRange with to < duration-eps AND
  progress ≥ 1-0.001 → seek to `to` + native play() (endpointLatched), tail plays natively;
  back below 1-0.02 (TAKEOVER_HYSTERESIS) reclaims scrub (pause+seek). exiting/exited →
  outgoing latch pauses native playback.
- duration.enter = scrub span; scroll takeover 1ms=1px. AnimateVideo.timeline narrow type:
  only delay/waitFor. Default enterAnimation = neutral opacity 1→1 (wrapper layer shares
  duration.enter axis; scrub driven by internal enterProgress).
- releaseOnLeave (default false): scroll takeover zones ONLY, ignored in drag. far >1.5vh →
  release (pause + removeAttribute src + load(); blob lease kept); near <1vh → warmUp
  (re-attach, zero network, catch-up seek after loadedmetadata). Schmitt ordering 1.5/1.0
  prevents flapping. Only releases after actually scrubbed once (|progress|>1e-4).
- muted + playsInline always, no controls. preload default true (shared video preload cache;
  blob objectURL preferred for guaranteed seek). width/height/style px2vw converted.
  playbackRate default 1.
- Native callbacks: onPlay/onPause/onEnded gated by ownership acceptance (generation/activation);
  onTimeUpdate/onError pass through. ref → HTMLVideoElement.
- All-keyframe hard constraint + ffmpeg: `ffmpeg -i in.mp4 -g 1 -keyint_min 1 -c:v libx264
  out.mp4`; dev build samples seeked latency (min 6 samples), median > 50ms → console.warn once
  per src. README.md Video Scrubbing same source.

## Paradigm (from introduction.md / animate.md pairs)
frontmatter title+eyebrow; zh/en isomorphic; code fences byte-identical (English comments);
manifest.ts auto-globs new files (no manifest edit needed). Eyebrows per brief:
presets=CATALOG custom=AUTHORED waitfor-stagger=SEQUENCING animate-video=FRAME SCRUB.

## Files to write
- site/src/content/docs/{zh,en}/animation/presets.md
- site/src/content/docs/{zh,en}/animation/custom.md
- site/src/content/docs/{zh,en}/animation/waitfor-stagger.md
- site/src/content/docs/{zh,en}/components/animate-video.md

## Status
- [x] fact gathering done
- [x] presets.md zh/en (154 lines each)
- [x] custom.md zh/en (161 lines each)
- [x] waitfor-stagger.md zh/en (155 lines each)
- [x] animate-video.md zh/en (153 lines each)
- [x] fences byte-identical verified (script), headings isomorphic
- [x] contract test 3/3, site type-check clean, site build pass (built in 1.14s)
Corrections made during self-review: 'roll' is not a bare preset (only roll-in/out);
formula fence made language-neutral for byte parity. NOTE: git shows concurrent
advanced/ doc changes from another agent (direction-x, scrollbar-theming) — not mine.
Total presets = 43 (brief said 44; code wins).
