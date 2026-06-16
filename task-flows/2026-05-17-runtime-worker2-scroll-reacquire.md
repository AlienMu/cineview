# Task: Runtime Worker 2 Scroll Reacquire

## Goal

- 修复 custom rail 开启时仍与原生滚动条重复显示、并且 rail 出现在文档尾部才生效的问题。
- 在不扩散改动面的前提下，改善 scroll takeover 预算耗尽后交还给文档流时的衔接卡顿。
- 只修改 runtime/core 相关文件，优先限定在 `src/components/CineView/DirectScrollCineView.tsx` 与必要的 scroll runtime 文件。

## Nodes

- [x] Read `design.md`
- [x] Read `requirements.md`
- [x] Read `AGENTS.md`
- [x] Read `AGENT_SELF_REVIEW.md`
- [x] Inspect relevant runtime code and tests
- [x] Confirm reverse-lock runtime path is already green and not the focus of this lane
- [ ] Implement custom rail runtime so it hides duplicate native scrollbars
- [ ] Fix custom rail placement/state so it stays available through the full document, not only near the tail
- [ ] Apply any safe handoff smoothing inside `DirectScrollCineView.tsx`
- [ ] Run targeted tests for touched runtime modules
- [ ] Summarize behavior changes and remaining risks for verification lane

## Verification

- [ ] `pnpm test -- src/components/CineView/DirectScrollCineView.test.tsx --runInBand`
- [ ] Re-check whether broader scroll runtime tests are needed
- [ ] Note what still requires independent browser acceptance

## Risks / Blockers

- The runtime may currently clear `activeZoneId` too early after handing remainder back to native scroll, which can make the handoff feel jumpy even when logical replay paths are correct.
- The custom scrollbar overlay currently appears to be mounted in a way that delays its sticky behavior until the content tail enters the scrollport.

## Current Status

- In progress
- Active node: Implement custom rail runtime so it hides duplicate native scrollbars
