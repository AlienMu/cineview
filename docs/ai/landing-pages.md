# Design a Cineview landing page

[English](./landing-pages.md) · [简体中文](./landing-pages.zh-CN.md)

Read this guide before selecting effects for a landing page. Define what the reader needs to understand, connect the content, and then select the interaction and timing. Each Scene needs useful content and a complete readable state.

One of Cineview's design goals is to help AI understand those decisions and give users grounded recommendations. For local 2.0 recommendations and PRD work, start with the [AI design workflow](./design-assistant.md), then consult the [41 design references and implementation routes](./lexicon.md) as needed. Users can describe a goal while the AI recommends screens, explains tradeoffs, and checks available capabilities.

The design method applies across versions. The existing [quick start](./quickstart.md), [modes](./modes.md), [timeline](./timeline.md), and [recipes](./recipes.md) describe the released `cineview@1.0.1` React API. The [experimental v2 notes](#experimental-v2-notes) apply only to the local `v2/` implementation. Confirm the target version before generating code.

## Start with a scene brief

Start with the person's page goal and available content. They do not need to know effect names or fill in animation settings. If the request is incomplete, ask for the missing content or the main point visitors should remember.

Use the 41 Lexicon examples as design references. Recommend one approach that fits the content, and explain the first image, what changes during input, and the complete readable state. Offer a second approach only when it gives a meaningfully different reading experience. The reference count does not mean Cineview provides 41 interchangeable presets or that every example is supported by the target version.

| Page goal                               | Starting approach                                           | What the proposal should show                                                    |
| --------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Introduce a product or software feature | Pair each explanation with the detail it describes          | The image changes with the relevant phrase; both remain available for inspection |
| Explain a before/after change           | Compare aligned images with a divider                       | The same subject stays registered while the reader adjusts the comparison        |
| Display a broad composition             | Move across the material with matching captions             | The beginning, each labelled detail, and the real end of the image               |
| Present related entries                 | Introduce cards in sequence while retaining earlier entries | The order, readable titles, and complete collection                              |

Use the [original content relationships](#preserve-the-original-content-relationships) to refine these proposals. Select the target version's supported APIs after the visual plan is understood.

Before implementation, record:

1. The reader's task and the fact they need to remember.
2. The actual text, images, and video, with explicit word-to-image and label-to-object relationships.
3. A static layout, including image focal points, crop, and text hierarchy.
4. The progress source, entrance, overlap, readable hold, and departure.
5. What happens when input stops, reverses, cancels, or returns to the Scene.
6. Narrow-screen layout, reduced motion, controls, and browser acceptance.

Select one main motion purpose per section. Supporting effects need a content reason, such as a label appearing with the detail it explains. Keep completed content available for reading. A test Scene used to inspect departure still needs content when used in a landing page.

## Select progress from the reading task

| Reader's task                                     | Design choice                          | Expected behavior                                                          |
| ------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| Read a long passage at their own pace             | Scroll with a position-driven interval | Stopping holds the frame; reversing restores the corresponding content     |
| Notice an object as it crosses a reading position | Object-relative viewport progress      | State follows that object's passage through the viewport                   |
| Read short sections separated by gestures         | Drag with a Scene entrance sequence    | A committed release continues unfinished element animations                |
| See a title reveal once                           | Visibility-triggered timed entrance    | Define whether returning replays it                                        |
| Observe a slow moving photograph or running text  | An autonomous time source              | Provide a control that pauses the actual movement                          |
| Compare two registered images                     | A native range control                 | The divider responds to pointer and keyboard input without changing Scenes |

Pinning keeps a surface in place; following scroll separately defines how progress advances. Specify both when a design needs them. Scene navigation duration, element timing, and media playback duration have separate purposes.

The original [Kinetic Drag](https://mocubix.renocrypt.com/lexicon/kinetic-drag/) demonstrates inertia inside a horizontally scrolling image strip. Its decay setting is not a Cineview pagination setting. Check the target implementation's release rules independently.

## Preserve the original content relationships

These examples from [Mocubix Lexicon](https://mocubix.renocrypt.com/lexicon/) explain the design decisions behind the effects. The Cineview applications are adaptations; components supply only part of the original choreography.

| Original example                                                                              | Detail to preserve                                                                   | Landing-page application                                                                       |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| [Word Scrub](https://mocubix.renocrypt.com/lexicon/word-scrub/)                               | Adjacent word intervals overlap; selected words bring matching plates into view      | Define semantic word/image pairs and shared intervals, including sentence holds and departures |
| [Horizontal Scroll Section](https://mocubix.renocrypt.com/lexicon/horizontal-scroll-section/) | Travel comes from actual overflow; captions align with the material                  | Measure the final layout and align each caption with its subject                               |
| [Sticky Stacking Cards](https://mocubix.renocrypt.com/lexicon/sticky-stacking-cards/)         | Card arrival, its name, and surface detail are coordinated                           | Keep labels attached to the correct card while earlier cards accumulate                        |
| [Depth of Field](https://mocubix.renocrypt.com/lexicon/depth-of-field/)                       | Only a central progress band stays clear                                             | Define a reading position rather than a one-way blur-to-clear entrance                         |
| [Ken Burns](https://mocubix.renocrypt.com/lexicon/ken-burns/)                                 | Focus and crop follow the photograph's subject; slow moves overlap through dissolves | Author focal points and observation time for each image; coordinate captions and pause         |
| [Threshold Flip](https://mocubix.renocrypt.com/lexicon/threshold-flip/)                       | Each painting provides its own complete palette                                      | Define background, text, and accent together, with a short theme transition                    |

Continuous [palette interpolation](https://mocubix.renocrypt.com/lexicon/token-interpolation/) preserves relationships between color roles. Separately authored scene palettes can use a discrete switch. Check contrast throughout any transition and limit animated inherited variables to the smallest container that needs them.

## Compose around actual material

Choose crop and focus using the final images. Place [progressive blur](https://mocubix.renocrypt.com/lexicon/progressive-blur/) in a quiet area that leaves the subject visible. Reserve image dimensions and use a composition-preserving placeholder while loading. Align before/after images before adding a comparison divider.

Assign each animated property to an object and progress source. Inspect the composed middle states: two opacity effects can produce a different reading rhythm from either effect alone. Use separate containers when movements or clipping need independent control. Prefer existing layout, effects, CSS, and native controls; extend the framework for a concrete missing capability.

Keep semantic, selectable text. Moving text copies must not duplicate screen-reader content or keyboard stops. Pause controls must stop page-owned CSS movement as well as framework-managed animation where both are present. With reduced motion, provide the complete passage, useful images, and usable controls.

## Write a concrete timing plan

For a short drag section explaining two details in a picture, keep the image and body text readable from the start. This example proposes the following local entrance timing:

| Object                            | Interval    | Relationship               | Completed state     |
| --------------------------------- | ----------- | -------------------------- | ------------------- |
| Short title                       | 0–950ms     | Introduces the observation | Remains readable    |
| Label A and its short explanation | 850–1450ms  | Both identify detail A     | Both remain visible |
| Label B and its short explanation | 1300–1900ms | Both identify detail B     | Both remain visible |

A overlaps the title by 100ms; B overlaps A by 150ms. After 1900ms the reader can inspect the complete composition until leaving. Map these intervals using the target version's supported scheduling API.

At 0% of this local time, the image and body are readable. At 25%, the title is entering; at 50%, it has completed and A has started; at 75%, A is nearly complete and B is entering; at 100%, everything is complete. These percentages describe element time, not pagination distance. Define departure and cancellation separately.

## Experimental v2 notes

Use [v2 public types](../../v2/src/types.ts), [element attributes](../../v2/src/jsx.ts), and the current implementation for local v2 work. Root `package.json` still describes the published 1.x package. These attributes and effects are not a claim about its exports.

- Drag Scene time continues after a committed release. Use scroll `zone` or an appropriate position timeline when stopping must hold a reading sequence. `view` effects track geometry, including movement during page settling.
- `focus(band)` expresses a central clear band; ordinary `focus` expresses blur-to-clear arrival. `push` supplies scaling around one origin, so a complete Ken Burns sequence still needs focal-point movement, long observation timing, dissolves, and shared pause.
- `track="x"` measures overflow. `cv-stack` and Scene `stack` provide stacking geometry. Labels, image registration, and matching intervals remain page design work.
- `after` references an entrance in the same Scene and timing domain. Negative offsets create time overlap and include the follower's delay. In ordinary scroll, the root's visibility starts the whole dependency run; offscreen followers also advance and may finish before the reader reaches them. Layout determines which elements appear together. Check [timing semantics](../../v2/src/core/time.ts).
- Shared effect outputs and overlapping loop items add translation and rotation, and multiply scale and opacity. For clip and variables with the same name, the last declaration supplies the value. Loops retain their individual periods. Disjoint loops remain native; overlapping loops and shared named ranges use direct composition. Different progress sources have a fixed nesting order.
- Use supported properties and variables with `from`/`to` or `defineEffect`. Use `keyframes(name)` for multi-step or other browser-interpolable CSS; it is unavailable in `exit` and `loop`. Register custom effects before mounting. Arbitrary SVG path morphing needs a suitable interpolator.
- `timeline.subscribe` reports time-based frames, not position values from pure `view`, `page`, or signal sources. Custom drawing must use the intended source and handle entrance, departure, and cancellation.
- `on="clock"` starts when its Scene becomes current, holds with Stage pause, and replays on reentry. Its timing and dependencies are solved separately and do not add scroll-zone distance. Structural rebuilds retain the current clock entrance's start time. Ordinary-scroll enter/eye roots still start from visibility.

These details are defined in [effects](../../v2/src/core/fx.ts), [rendering layers](../../v2/src/render/layers.ts), and [time subscriptions](../../v2/src/core/timeline.ts). Recheck them when that implementation changes.

## Give AI a reusable brief

For a first request, a short description is enough:

```text
I want a page explaining my software. I have three screenshots and two paragraphs.
Visitors should understand its purpose first, then inspect the features.
Recommend a suitable presentation and show the opening, changes, and complete state.
Use the Cineview design guide and check the target version before implementation.
```

AI should turn that request into the detailed brief below. Explain the recommended design in ordinary language before discussing effect names. A website entry can help assemble a brief and link the guide for the person's own AI; this proposal does not require an integrated AI service.

Supply real content and this brief. Its fields describe design requirements, not Cineview properties.

```text
Design this Cineview landing page from its reading task and real content.
Reader goal and essential fact:
Scene content, word/image pairs, and label/object pairs:
Static layout, image focus, crop, and color roles:
Progress source and its reason:
Entrance, overlap, readable hold, and departure:
Initial, 25%, 50%, 75%, and completed states:
Stop, reverse, cancel, and reentry behavior:
Phone layout, reduced motion, controls, and pause:
Target Cineview version and authoritative types:

Return a scene plan and property/source ownership before implementation.
Map the plan to existing supported APIs, CSS, and native controls.
Identify deliberate adaptations of the reference and needed extensions.
Use actual browser evidence for acceptance claims.
```

## Accept the reading experience

Check content relationships and complete states in the actual application route:

- Hold and reverse at a key word or label; inspect its matching image.
- Commit and cancel departures, then return; inspect text, fixed content, and video continuity.
- Exercise rapid input, keyboard navigation, the scrollbar where applicable, and controls with their own gestures.
- Check narrow screens, orientation changes, image readiness, and final travel distances.
- Pause autonomous movement and inspect the reduced-motion presentation.
- Measure performance in the target browser. Native CSS and script-driven implementations have different costs.

Correct interpolation, a quiet console, and a combination gallery establish only part of this behavior. Report the scenarios actually observed. A representative composition does not establish acceptance of all 41 original examples.
