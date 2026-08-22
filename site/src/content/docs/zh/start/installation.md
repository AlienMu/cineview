---
title: 安装
eyebrow: INSTALL
---

在 React 与 Framer Motion 之外安装 CineView。

## 包安装

CineView 把 React 与 Framer Motion 声明为 peer dependencies。请保持应用 bundle 中每个运行时只有一份拷贝。

```bash
pnpm add cineview framer-motion
# React 18 or React 19
```

## 导入公共出口

根包导出组件、公共 ref 类型，以及零渲染的时间轴 hook。

```tsx
import {
  Animate,
  CineView,
  Container,
  Image,
  Position,
  Scene,
  useAnimateTimeline,
} from 'cineview';
```
