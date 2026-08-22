---
title: Introduction
eyebrow: START HERE
---

CineView is a React scene runtime for authored drag and real-document scroll experiences.

## The mental model

CineView owns scene transitions and timeline ownership. Scene owns chapter layout. Animate consumes the active mode timeline. Ordinary React content can sit between scroll takeover scenes.

## A small scene

Start with one root, one mode, and an explicit design width. Add Scene only where chapter-level behavior is needed.

```tsx
<CineView config={{ size: 750 }} mode="drag">
  <Scene sceneId="hero">
    <Animate enterAnimation="fade-in">
      <h1>Opening frame</h1>
    </Animate>
  </Scene>
</CineView>
```
