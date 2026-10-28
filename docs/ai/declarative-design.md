# Declaration and implementation conventions

Use this guide when designing Cineview 2.0 declarations, adding configuration, or changing animation implementation. Keep new work consistent with the existing authoring model. Read the [landing-page guide](./landing-pages.md) for content and visual design. [中文](./declarative-design.zh-CN.md)

## Version and implementation status

The package is a set of custom elements; [DESIGN.md](../../DESIGN.md) describes its architecture. Check [public types](../../src/types.ts), [JSX attributes](../../src/jsx.ts), and the corresponding parser before writing an application example.

This guide records implemented behavior and design conventions separately. The named `threshold` syntax in [Threshold design](#threshold-design) is pending implementation. Recording that direction does not make the syntax available or authorize a runtime migration. Source and public types determine what an application can use.

## Elements

2.0 has seven elements. `<cv-stage>` holds the scenes and owns the input (`scroll` or `drag`). `<cv-scene>` is one scene with its own timeline. `<cv-animate>` gives one element its effects on that timeline. `<cv-stack>` stacks its child cards. `<cv-video>` takes the `cv-animate` attributes plus `src`, `poster`, `range` (seconds of the file to map) and `preload`; its time follows the scene, and its `<video>` is styled through `::part(video)`. `<cv-fixed>` keeps its content still on screen while its scene passes. `<cv-pause>` is a toggle that pauses and resumes motion played on time (entrances and loops) for WCAG 2.2.2; the reader's scroll and drag keep working. The [design skill](../../skills/cineview-design/framework.md) lists the attributes and presets in one table.

## Declare related behavior together

Keep content in HTML and ordinary CSS. Use elements for responsibilities and attributes for configuration: `cv-stage` selects input, `cv-scene` groups content, and `cv-animate` declares an element's effect and timing. Use kebab-case attribute names.

Group settings that describe one behavior. For a new compound setting with several meanings or units, prefer comma-separated named entries such as `name:value`. Keep independent concerns separate: `threshold` decides whether a release changes pages; `transition-duration` controls the reference transition time.

The existing grammars keep their documented separators:

| Purpose               | Implemented declaration     | Meaning                                                                   |
| --------------------- | --------------------------- | ------------------------------------------------------------------------- |
| Effect list           | `fx="rise, drift(strong)"`  | Commas separate effects at the outer level.                               |
| Preset arguments      | `fx="push(in, 20% 30%)"`    | Arguments belong to the preset; the two origin coordinates stay together. |
| Effect interval       | `fx="fade 49% 50%"`         | Spaces separate the interval edges.                                       |
| Property declarations | `from="opacity:0; y:24"`    | Semicolons separate properties.                                           |
| Dependency and offset | `after="title -150"`        | Start 150ms before the named entrance completes.                          |
| Current threshold     | `threshold="0.3 0.15 1000"` | The existing speed/distance rule, described in Threshold design.          |

Split lists at their own grammar level. Commas inside a function, color, or keyframes value belong to that value. Reuse the existing parsing helpers; a plain comma split is insufficient for nested expressions. A new grouped setting does not require rewriting every existing attribute grammar.

## Separate content, progress, effects, and timing

First describe what stays visible, what changes, and how the completed scene reads. Then select a progress source. Declare visual effects and timing against that source.

| Decision               | Declaration or responsibility                                        |
| ---------------------- | -------------------------------------------------------------------- |
| Page interaction       | Stage `input="drag"` or `input="scroll"`                             |
| Progress source        | Animate `on`, or the effect's supported default source               |
| Visual change          | `fx`, `from`/`to`, or a supported custom effect                      |
| Timing relationship    | `duration`, `delay`, `name`, `after`, `at`, and supported sequencing |
| Layout and persistence | Scene structure, CSS, fixed elements, and stacking components        |

In a page that has loaded the module, these declarations let the explanation start before the title finishes:

```html
<cv-stage input="drag" transition-duration="800">
  <cv-scene id="intro">
    <cv-animate name="title" fx="rise" duration="950">
      <h1>Arrange a page as scenes</h1>
    </cv-animate>
    <cv-animate fx="fade, drift(soft)" duration="600" after="title -150">
      <p>Give each element a progress source and a timing relationship.</p>
    </cv-animate>
  </cv-scene>
</cv-stage>
```

`after` references an entrance in the same Scene. A negative offset creates overlap. It schedules animation; layout determines whether the elements appear as cards, captions, or another composition. Page transition distance and element elapsed time remain separate. Completing a drag can continue unfinished element time; a scroll zone holds its corresponding time when scrolling stops.

In the same layer, translation and rotation add; opacity and scale multiply. Clip and same-name variables have their own replacement rules. Different progress sources use separate rendering layers. Review the combined middle states and assign each output property a clear owner. The [layer implementation](../../src/render/layers.ts) defines the actual composition order.

`on="clock"` uses real time from current-Scene entry, follows Stage pause, and restarts on reentry unless `replay="false"` has already completed an entrance. Each follower uses its own replay setting while keeping its solved window. Its own solved windows, including `after` and `at`, do not add scroll-zone distance. An `after` reference cannot cross between input-driven and autonomous-clock timelines. In ordinary scroll, the root's visibility starts its entire dependency chain; offscreen followers also advance. Keep a separate root when content must wait until the reader reaches it.

Exit progress still follows the mode: drag advances the declared exit during forward departure and reverses the entrance when moving backward; a scroll zone scrubs its solved exit window; ordinary scroll plays the exit when the element leaves its visibility gate. An explicit clock animation plays its exit on Scene departure. An interrupted entrance exits from its displayed value. Returning cancels the exit and follows the relevant entrance or replay rule.

Overlapping loops use the same add/multiply rules while retaining their periods; clip and same-name variables remain ordered replacements. `loop-duration` must be greater than zero. Overlapping loop properties and shared named-range outputs use frame evaluation; independent native animations remain available for disjoint properties. A split-text axis animation preserves unanimated font axes and its visible completed value.

## Configure values without changing the interaction

A setting that adjusts a distance must keep the selected release behavior. Enabling a configuration field must not implicitly remove short-swipe handling. Document any deliberate change of strategy as a separate behavior change.

Inheritance is part of each setting's API. Define its scope, units, default, and whether an override replaces a whole group or only named fields. Do not assume every Scene attribute inherits a Stage attribute: the current `unit`/`scale` pair is overridden as a group, while effect attributes configure their own element.

For the planned named threshold, resolve each field in this order: Scene value, Stage value, default. A Scene that specifies only `long` keeps the Stage's `short` and `time`. Parsing and validation must preserve that distinction between omission and an explicit value.

## Threshold design

Implementation status: pending. The intended 2.0 declaration groups named settings with commas:

```html
<cv-stage input="drag" threshold="short:8%, long:50%, time:300ms">
  <cv-scene id="intro">Use the Stage settings.</cv-scene>
  <cv-scene id="details" threshold="long:35%"> Change only the long-drag distance. </cv-scene>
</cv-stage>
```

| Field   | Intended default | Meaning                                                                             |
| ------- | ---------------- | ----------------------------------------------------------------------------------- |
| `short` | `8%`             | Minimum net finger displacement as a fraction of viewport height for a short swipe. |
| `long`  | `50%`            | Minimum displayed page travel as a fraction of one page for a longer drag.          |
| `time`  | `300ms`          | Maximum gesture duration counted as a short swipe.                                  |

Keep one short/long decision: at or below `time`, use `short`; above it, use `long`. Setting `long:35%` leaves short-swipe handling active. Keep small-movement, cancellation, and fast-reversal protections when implementing this change. Release eligibility and animation speed remain separate.

The implementation still uses fixed 8% / 50% / 300ms defaults when `threshold` is absent. Setting the current positional `threshold="0.3 0.15 1000"` selects the older speed/distance rule: slow ratio, fast ratio, and release speed in px/s. That path replaces short/long classification. The named syntax and per-field inheritance are not parsed yet. Check [drag rules](../../src/input/drag-rules.ts) and [release handling](../../src/input/drag.ts).

A future implementation must update parsing, normalized types, JSX descriptions, examples, and migration notes together. Define valid values and diagnostics for malformed declarations. Verify that changing `long` preserves the short-swipe result and that a Scene override preserves omitted Stage fields.

## Handle invalid declarations and consecutive changes

Listen for `cv-error` before mounting the Stage to identify the declaration an AI or user needs to correct. Errors bubble from the offending element in production too; `detail` contains `code`, `message`, and `element`.

```js
document.addEventListener('cv-error', (event) => {
  const { code, message, element } = event.detail;
  console.warn(code, message, element);
});
```

A malformed `at` reports `bad-at` and ignores that whole attribute. A malformed `after`, unreadable `loop-duration`, invalid explicit `input`, or invalid positional `threshold` field reports `invalid-attribute`. A valid `after` naming a missing element reports `missing-after`. Valid siblings continue to build. Check the message for the fallback: an invalid `input` uses scroll, while an unreadable `loop-duration` uses 3000ms.

The presence of `threshold` still selects the older speed/distance rule, even when its value is empty or malformed. Invalid fields keep their fallback values; named entries remain unsupported. Remove the attribute to use the default short/long-swipe rules. Do not interpret a reported error as rejection of the whole Stage or as restoration of the absent-attribute behavior.

When a rebuild interrupts an owned drag session, it sends one `cv-dragcancel`. A keyboard or assistive activation represented by a `click` with `detail: 0` remains usable after cancellation.

Scroll zone height and drag Scene geometry restore their saved author values when their owner stops: after removing the zone or horizontal track, switching input modes, or disconnecting, as applicable. Avoid editing those same inline properties while the framework owns them.

A `count` whose text temporarily lacks a valid number shows the original text and rebuilds the count effect when valid numeric text returns. Removing the effect or disconnecting ends its observation.

## Keep implementation ownership explicit

Use the existing sequence of responsibilities:

1. Parse and normalize declarations when configuration changes. Resolve defaults, scope, and dependencies there.
2. Let the selected input controller own page movement and each Scene's element time. An input event submits intent to that owner.
3. Evaluate shared animation semantics, then use the appropriate native or direct-write output. Keep authored interval boundaries and completed states consistent across outputs.

Per-frame values use the existing mutable state and subscriptions. Avoid per-frame React updates, configuration parsing, or dependency solving. Group geometry reads before writes. Native timeline support and compositor execution are different claims; actual properties and browser measurements determine performance.

Preserve the current Scene by identity when lists change. Reindexing is not navigation and must not emit a false departure or arrival. Synchronize the current marker, links, theme, accessibility state, and announcement with the resulting scene list.

The owner that starts asynchronous work also ends it. Cancel pending frames, remove observers and listeners, and stop obsolete font, idle, and media completions. Rebuilds must permit new native animations to attach. Media cancellation preserves the applicable playback position and user pause state; old-node events cannot resume a later activation.

## Extend through existing mechanisms

Start with existing effects, CSS, and independent containers. Use `from`/`to` for supported properties and variables, `defineEffect` for reusable effects, and `keyframes(name)` for suitable multi-step browser animations. Read the current restrictions before using an extension in `exit` or `loop`. Arbitrary SVG path morphing requires an appropriate interpolator.

Custom drawing must subscribe to the source it actually needs and dispose of its work. `timeline.subscribe` supplies time-based frames; pure `view`, `page`, or signal elements do not expose those position values through that time API. Keep the author content semantic and selectable. Follow [the extension and composition notes](./landing-pages.md#implementation-notes).

Prefer an existing helper and a local change. Add an abstraction when a concrete repeated responsibility requires it. Use explicit inputs and cleanup rather than introducing another global progress owner.

## Verify and hand off changes

Check the target version and label proposed syntax before generating code. A design decision changes an application only after the corresponding parser and public interface exist. When a later requirement needs a different convention, explain the concrete conflict and update this guide with the implementation decision.

Verify changed parsing, defaults, and inheritance with focused tests. For shared animation logic, cover drag and scroll, native and fallback, narrow intervals, overlapping effects, and step values. Browser acceptance also covers reverse movement, cancellation, reentry, dynamic content, large input deltas, keyboard and scrollbar input, fixed layers, and concurrent animations. Record an unavailable input path as unverified.

Keep English and Chinese guidance aligned. Update the AI reading index when guidance moves. Store task flows and acceptance evidence outside Git tracking; keep reusable regression tests tracked. Use [agent instructions](../../AGENTS.md) and [self-review requirements](../../AGENT_SELF_REVIEW.md) for the applicable commands and review process.
