---
name: Feature request
about: Propose a capability the framework does not have
labels: enhancement
---

## The problem

<!-- What are you trying to build that the current API makes hard or impossible?
     Describe the goal, not a proposed API — the goal is what gets evaluated. -->

## What you tried

<!-- Which existing props/patterns you attempted, and where they fell short. -->

## Bundle cost

New runtime code competes for a fixed budget: the full UMD artifact sits at
about 54.5 KB gzip against a 55 KB ceiling. Proposals that can live in userland
(a render-prop, a `useAnimateTimeline()` consumer, a CSS variable) are far more
likely to land than ones that add framework code.

- [ ] This has to be in the framework, because: <!-- say why -->
- [ ] This could be userland, but the framework could make it easier by: <!-- … -->
