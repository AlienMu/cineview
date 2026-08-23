---
title: 快速开始
eyebrow: QUICK START
---

一个完整的最小应用：一棵声明树跑双引擎，外加一段 `waitFor` 级联。

> 本页代码节选自可运行示例 `examples/minimal/src/App.tsx`（活代码真源）。
> 改动须两处同步：示例为准，本页为镜像。

## 运行示例

```bash
git clone <repo> && cd cineview
pnpm install && pnpm build   # 示例消费构建后的 dist 包
pnpm --dir examples/minimal install
pnpm --dir examples/minimal dev   # http://localhost:4100
```

## 级联

同一场景内的两个 `Animate`：`subline` 声明 `waitFor: 'headline'`，
在标题入场完成前不会开始。registry 根据每个元素自己的 `delay` 与
`duration` 解析链条，全程没有定时器和手动状态。

```tsx
<Scene
  sceneId="story"
  layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
  transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out', exitDuration: 360 }}
  scroll={{ zoneId: 'story', trigger: 'center-lock' }}
>
  <div style={stage}>
    <Animate animateId="headline" enterAnimation="fade-in" duration={{ enter: 800 }}>
      <h2>Scene 02 — cascade</h2>
    </Animate>
    <Animate
      animateId="subline"
      enterAnimation="slide-up"
      exitAnimation="fade-out"
      duration={{ enter: 600, exit: 300 }}
      timeline={{ waitFor: 'headline' }}
    >
      <p>This line waits for the headline to finish entering.</p>
    </Animate>
  </div>
</Scene>
```

## 一棵声明树，双引擎

上面场景的 `scroll` 声明被两个引擎分别解读：drag 忽略它（该场景只是
一页），scroll 则把它变成 `center-lock` zone，用真实滚动距离（1ms=1px）
驱动级联。

mode 是根级声明，不是可热切换的 prop——两个引擎持有不同的 DOM 与运行时
状态。示例用 `key={mode}` 整树重挂来切换，这是唯一诚实的切换方式：
每个场景都从 initial 状态重新入场。

```tsx
const [mode, setMode] = useState<ScrollMode>('drag');

<CineView key={mode} config={{ size: 750 }} mode={mode}>
  {/* scenes */}
</CineView>
```
