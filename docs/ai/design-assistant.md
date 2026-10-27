# Help users turn requirements into animation plans

[English](./design-assistant.md) · [简体中文](./design-assistant.zh-CN.md)

One of Cineview's design goals is to help AI understand content relationships, the purpose of motion, and implementation limits so it can advise the person using it. A user can describe what they want to explain or provide a PRD. The AI turns that material into a reviewable visual and interaction plan, then implements it with the capabilities currently available.

This guide targets local 2.0 work. It describes how an AI should assist with design; it does not mean the project includes a chat service or automatic generator. Read the [41 design references](./lexicon.md), [landing-page composition guide](./landing-pages.md), and [declaration conventions](./declarative-design.md) as needed. Check [v2 types](../../v2/src/types.ts), [element attributes](../../v2/src/jsx.ts), and the actual driver before generating code.

## Start with a recommendation the user can picture

The user does not need to learn effect names first. Describe the proposed screen: what is visible at the start, which image changes during input, which detail the text describes, and what remains readable at the end. Explain why the movement helps the reader and which assets it needs.

For example, a user says, "I have three software screenshots and want to explain three features." A useful recommendation is:

> Keep three feature descriptions beside one image area. Show the list screenshot while explaining collection, the annotation detail while explaining highlights, and the finished result last. Bring in each new image before fading out the previous one, with its matching description. Stopping preserves the current state, and all three descriptions remain readable at the end.

This establishes the image/text relationship and stopping behavior. Confirm the material before choosing intervals, crops, and code. Preserve a specified drag interaction, brand palette, or asset style, and explain how it affects the reading pace.

Recommend the best-fitting plan. Add a second only when it produces a meaningfully different reading experience, with a clear tradeoff. Use the 41 references for research; introduce only the few relevant to this request in the first response.

## Start from common requests

These are design entry points, not a ranking based on project usage data. Identify the task, then look up the relevant numbers.

| What the user asks                                     | Recommended content structure                                                                                      | References to inspect | Where to limit motion                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| "A bold, simple opening"                               | Establish purpose, one main visual, and a visible primary action; linework or abstract forms can supply the visual | 09, 30, 32            | Keep body text and the action usable from the start; choose one main change instead of animating every object together |
| "Explain several software features"                    | Pair each description with its screenshot or wireframe detail and use shared change intervals                      | 02, 03, 08, 10        | Keep images and explanations matched; allow stopping and preserve complete content after fast input                    |
| "Make a process understandable"                        | Show changes in order, retaining previous steps or clearly identifying the current step                            | 06, 09, 11            | Connections must represent a real sequence; emphasize the part currently being explained                               |
| "Show a before/after difference"                       | Align two images and provide a labeled, adjustable divider                                                         | 31                    | Let the reader compare rather than moving the divider automatically; preserve keyboard control and alignment           |
| "Explain a wide image in sections"                     | Travel through actual overflow and show captions as their subjects arrive                                          | 05, 08                | Measure crop and endpoint first; narrow layouts can use separate image sections rather than shrinking everything       |
| "Explain data and results"                             | Establish values, units, and evidence before using counts or diagrams to explain change                            | 09, 13                | Use supplied data only; keep a static final value and avoid repeated counting that interrupts comparison               |
| "Show a portfolio or image collection"                 | Arrange image order, focal points, and titles before choosing individual browsing, cards, or slow observation      | 06, 14, 25, 26, 27    | Provide pause for moving images; treatments must preserve details the reader needs                                     |
| "Turn a long PRD, study, or article into a page"       | Divide by argument, pair figures with their explanations, and identify the current section in a contents list      | 01, 02, 10, 23        | Let readers control the pace of dense material; preserve body text, navigation, and references                         |
| "Build a launch or event page that gets registrations" | Present the subject, date, and primary action first, then explain benefits and evidence in sections                | 11, 16, 17, 41        | Dates, prices, and registration must not wait for motion; navigation needs current and endpoint states                 |

## Look up the 41 references by intent

Choose the relevant problem: explaining relationships, arranging browsing, treating material, emphasizing text, or coordinating color. Then consult the [complete index](./lexicon.md). Each entry links to the original and describes its purpose and the local 2.0 route or limitation.

Extract relationships from the original: which word calls up which image, why cards accumulate, where a subject becomes clear, and how colors retain their roles. Apply those relationships to the user's material. Reusing a blur, translation, or fade alone does not preserve the complete design idea.

Explain the selected reference's role to the user. For example: "Use 03 for reader-controlled progress and 08 to keep the explanation and screenshot synchronized." Identify the composition the page must supply. The 41 entries include layout, interaction, browser features, and asset treatment; they cannot all be used as `fx` names.

## Extract decisions from the PRD

Read the complete PRD before mapping requirements to screens. Preserve facts, existing interactions, and constraints. Label assumptions where information is missing. Do not invent figures, testimonials, product capabilities, or assets.

| Extract from the PRD                                         | Turn it into a design decision                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Audience, reason for visiting, and primary action            | What the first screen must explain and where the action belongs                       |
| Core facts, feature order, and dependencies                  | Scene order; what must be compared together and what needs explanation in sequence    |
| Available text, images, video, SVG, and charts               | Each asset's purpose, crop, alternative text, labels, and matching explanation        |
| Content volume, devices, and existing navigation or gestures | Scroll or drag; ordinary sections, a locked zone, or an independently operated region |
| Brand, typography, languages, and motion preferences         | The readable final composition, layout for longer translations, and motion to reduce  |
| Loading, pause, return, form, and accessibility requirements | Interrupted and completed states; actual media and control behavior                   |

Ask the most consequential question when necessary information is missing. A PRD with feature names but no screenshots needs an asset decision before image synchronization can be specified. The AI can normally propose timing and easing values without asking a general user to supply them.

## Derive the storyboard

1. State the fact each scene should communicate and link it to a PRD requirement ID. Distinguish explanation, evidence, and the primary action.
2. Design the complete readable static composition first. Establish image/text pairs, hierarchy, crops, and color before designing the initial state.
3. Give the main change a purpose. Keep content together when readers need to compare it; introduce dependent content in order. Decorative movement supports that task.
4. Select progress. Position-driven scroll fits dense explanations and precise image/text matching; drag fits short chapters. Preserve an existing input requirement. Describe holding a composition and advancing animation separately.
5. Specify entrance, reading hold, change, and departure. Name when the next image appears and when the previous one disappears so neither is accidentally absent.
6. Define stopping, reversing, cancelling, returning, fast input, failed loading, and reduced motion. Check the completed composition in both languages and narrow layouts.
7. Map the storyboard to current components, attributes, CSS, or page controls. Identify missing capabilities and the smallest practical alternative before implementation.

The user-facing storyboard should include the following. These are design fields, not Cineview attributes:

```text
Requirement ID and the fact the reader should understand:
Scene and assets:
Initial and complete readable composition:
Relationships between images, words, labels, and objects:
Main change, reason, and reference numbers:
Input, progress source, and what the interval measures:
Entrance, changes, reading hold, and departure:
Stopping, reversing, cancellation, returning, and fast input:
Narrow layouts, both languages, reduced motion, and failed loading:
2.0 implementation route, limits, and required extensions:
Results to inspect in the browser:
```

## Example: turn a software PRD into a storyboard

Assume a PRD describes three steps: collect material, highlight details, and produce an explanation. Three matching SVG wireframes are available. The primary action is "Get started," and brand colors and bilingual copy are supplied. These features and intervals illustrate the design method; they are not Cineview product capabilities or default parameters.

| Requirement                                     | Scene plan                                                                                                     | Main change and reason                                                                             | 2.0 implementation direction                                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| R1: Understand the purpose and be able to start | Hero with a purpose statement, primary action, and a static wireframe of the full process                      | Draw decorative connections in process order while text and the action remain usable; reference 09 | Ordinary scroll section with a local `draw` entrance; keep layout and core text static                            |
| R2: Understand the three steps and their result | An explanation area with step text on the left and matching SVG diagrams in a consistent position on the right | Use shared progress to change the image and active-step emphasis; references 03, 08, 30            | Scene `zone` for the reading interval; time-based animations in that Scene and page CSS manage image/text changes |
| R3: Decide whether to start                     | Three-step summary and the primary action                                                                      | Retain complete content and let the reader continue from the explanation to the action             | Ordinary static section; preserve normal button interaction                                                       |

R2 progress means the explanation area's local reading progress. It is neither whole-page scroll percentage nor drag page displacement. These percentages are a storyboard draft. Adjust them for text volume and layout, then check the solved total duration. In a scroll zone, 1ms corresponds to 1px of scroll distance; do not copy clock-animation milliseconds without reviewing that distance.

| Local progress | Image and text state                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| 0% to 10%      | Image A shows the material list; step one is emphasized; the heading and all three descriptions are readable |
| 10% to 30%     | Hold A so the reader can inspect collection                                                                  |
| 30% to 40%     | Bring in B with step-two emphasis, then fade A; crop and labels still refer to the same subject              |
| 40% to 65%     | Hold B on the annotation detail; step-one text remains                                                       |
| 65% to 75%     | Bring in C with step-three emphasis, then fade B                                                             |
| 75% to 100%    | Retain output image C and all step text until the reader leaves the explanation                              |

At 0%, 25%, 50%, 75%, and 100%, the images should be A, A, B, C, and C, with matching step emphasis. One local progress source determines all three image/text states. Reverse input restores them in reverse order; stopping preserves the current composition. The page must provide a reduced-motion layout with the three image/text pairs in sequence, retaining the same facts and action.

The Hero's line drawing is a brief entrance; R2 changes serve reader-controlled explanation. They do not need one clock. If the PRD specifies drag, use short chapters and plan each entrance separately. Element time continues after a committed change, so releasing cannot be promised to hold an intermediate screenshot transition. Do not change pagination gestures to compensate for excessive content.

## Assign concrete actions to design elements

| Element                            | Decide first                                                       | Suitable change and checks                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Heading, body text, primary action | Information hierarchy and the complete readable state              | A heading can have a short reveal; avoid word-by-word delays for dense text; keep the primary action usable from the start |
| Screenshots and images             | Subject, focus, proportion, and matching text                      | Align before changing; share intervals with labels; loading placeholders preserve size and composition                     |
| SVG lines and abstract forms       | Whether the line explains a connection, order, or extent           | Drawing direction follows meaning; decoration stays subordinate to text; `draw` does not supply arbitrary path morphing    |
| Labels, arrows, legends            | Which object each explains and when it applies                     | Arrive and leave with that object; do not retain a previous object's label after changing the image                        |
| Cards and lists                    | Whether order means steps, time, or equal alternatives             | Stack cumulative steps; retain a side-by-side view when simultaneous comparison is needed                                  |
| Numbers and charts                 | Units, data source, and comparison baseline                        | Establish correct values first; retain scales and labels; show final values with reduced motion                            |
| Background and brand colors        | Background, body-text, and accent roles                            | Check the complete palette throughout transitions; scope animated variables to the container that needs them               |
| Video and autonomous loops         | What the video explains and when to pause or allow native playback | Check first frame, departure, cancellation, and return; include page-owned CSS motion in actual pause controls             |

## Map the plan to current 2.0 capabilities

Record design advice separately from implementation status. Find the route in the [41-entry index](./lexicon.md), then check the [declaration conventions](./declarative-design.md).

- `after` references an entrance in the same Scene and timing domain. In ordinary scroll, the root starts the whole dependency run, including offscreen followers. Negative offsets create time overlap; layout determines simultaneous visibility.
- Overlapping loop items follow the effect addition/multiplication rules while retaining separate periods. For clip and variables with the same name, the last declaration supplies the value. Disjoint loops remain native; overlapping outputs use direct composition.
- `on="clock"` starts at current-Scene entry, follows Stage pause, and replays on reentry without adding scroll distance. Keep dependencies within that clock domain; a structural rebuild preserves its current run.
- `timeline.subscribe` supplies time-based frames, not arbitrary view/page/signal position values. SVG or canvas must use the intended source and handle cancellation and disposal.
- Comma-separated named `threshold` remains pending. Native horizontal inertia and endless browsing also cannot be represented as equivalent to finite-scene drag pagination.

Resolve static layout, assets, and content choreography first. Discuss framework extensions when a concrete capability is missing. An available preset does not implement an entire reference design, and parsing does not prove that an input drives it.

## Make the case study and acceptance answer the same question

A case study should state the reader's task, asset relationships, selected references, and adaptations, with initial, intermediate, and completed views. Explain input and source beside the code, and identify page-owned work. Report the browsers and operations actually checked, with unverified items retained.

For R2, inspect image/text matching in each interval, the state after rapidly crossing two transitions, reverse and stopped states, useful content during loading, and readability in both languages and narrow layouts. The section after a departure must contain actual content.

Users should be able to assess the picture and tradeoffs; developers should inspect the implementation against those same states. Explain the behavior and reference numbers covered by a demo individually. One composition demo cannot establish acceptance of all 41 references.
