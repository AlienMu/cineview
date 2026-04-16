# 无限循环动画生命周期说明

## 概述

无限循环动画（`infiniteAnimation`）是 Animate 组件的一个特性，用于在元素进入场景后持续播放动画效果，直到场景离开。

## 生命周期

### Snap 模式

#### 1. 进入阶段
```
场景激活 → 等待延迟 → 播放进入动画 → [进入动画完成] → 开始无限循环动画
```

**关键点**：
- 无限循环动画必须等待进入动画完全完成后才开始
- 这确保用户能够清楚地看到元素的进入效果
- 无限循环动画作为持续的视觉反馈，在进入动画之后自然衔接

#### 2. 循环阶段
```
无限循环动画持续播放 → 直到场景离开或离开动画触发
```

**关键点**：
- 无限循环动画会一直重复播放
- 不会干扰其他动画或交互

#### 3. 离开阶段
```
离开动画触发 → [立即停止无限循环动画] → 播放离开动画 → 场景离开
```

**关键点**：
- 当离开动画触发时，无限循环动画会立即停止
- 这确保离开动画能够干净地播放，不受无限循环动画的干扰
- 离开动画完成后，元素状态重置

### Drag 模式

#### 1. 进入阶段
```
场景激活 → 等待延迟 → 播放进入动画 → [进入动画完成] → 开始无限循环动画
```

**关键点**：
- 与 snap 模式相同，无限循环动画在进入动画完成后开始

#### 2. 循环阶段
```
无限循环动画持续播放 → 直到拖拽开始
```

**关键点**：
- 无限循环动画会一直重复播放
- 当用户开始拖拽时，无限循环动画立即停止

#### 3. 拖拽阶段
```
拖拽开始 → [立即停止无限循环动画] → 离开动画进度与拖拽进度同步
```

**关键点**：
- 拖拽开始时，无限循环动画立即停止
- 这是因为离开动画的进度需要与拖拽进度实时同步
- 无限循环动画会干扰这种精确的进度控制

#### 4. 释放阶段
```
松手 → 场景切换 → 下一场景进入动画 → [完成] → 开始无限循环动画
```

**关键点**：
- 松手后如果切换到新场景，新场景的进入动画会播放
- 新场景的无限循环动画在进入动画完成后开始

## 代码示例

### Snap 模式基础用法
```tsx
<Scene slideMode="snap">
  <Animate
    enterAnimation="fade-in"
    exitAnimation="fade-out"
    infiniteAnimation="pulse"
    enterDuration={600}
    exitDuration={400}
  >
    <div>持续脉冲的内容</div>
  </Animate>
</Scene>
```

**时间轴**：
```
0ms -------- 600ms -------- ∞ -------- 离开触发 -------- 400ms
|            |              |          |                |
场景激活     进入完成       脉冲循环   停止脉冲         离开完成
             ↓              ↓          ↓                ↓
             开始脉冲       持续脉冲   播放离开         场景离开
```

### Drag 模式基础用法
```tsx
<Scene slideMode="drag">
  <Animate
    enterAnimation="fade-in"
    exitAnimation="fade-out"
    infiniteAnimation="pulse"
    enterDuration={600}
  >
    <div>持续脉冲的内容（拖拽时停止）</div>
  </Animate>
</Scene>
```

**时间轴**：
```
0ms -------- 600ms -------- ∞ -------- 拖拽开始 -------- 拖拽中 -------- 松手
|            |              |          |                |              |
场景激活     进入完成       脉冲循环   停止脉冲         进度同步       切换场景
             ↓              ↓          ↓                ↓              ↓
             开始脉冲       持续脉冲   离开动画进度     实时更新       下一场景
```

### 带延迟的用法
```tsx
<Animate
  enterAnimation="slide-up"
  exitAnimation="slide-down"
  infiniteAnimation="heartbeat"
  delay={1000}
  enterDuration={800}
>
  <div>延迟后心跳的内容</div>
</Animate>
```

**时间轴**：
```
0ms -------- 1000ms -------- 1800ms -------- ∞
|            |                |               |
场景激活     开始进入         进入完成        心跳循环
             (等待延迟)       ↓               ↓
                              开始心跳        持续心跳
```

### 关联延迟用法
```tsx
<Animate animateId="comp1" enterAnimation="fade-in" enterDuration={500}>
  <div>先进入的内容</div>
</Animate>

<Animate
  waitFor="comp1"
  enterAnimation="zoom-in"
  infiniteAnimation="wobble"
  enterDuration={600}
>
  <div>等待 comp1 完成后进入，然后摇摆</div>
</Animate>
```

**时间轴**：
```
0ms -------- 500ms -------- 1100ms -------- ∞
|            |              |               |
场景激活     comp1完成      comp2完成       摇摆循环
↓            ↓              ↓               ↓
comp1开始    comp2开始      开始摇摆        持续摇摆
```

## 在不同模式下的行为

### Snap 模式（整屏滚动）
- **进入动画**：完整播放
- **无限循环**：在进入动画完成后开始
- **离开动画**：触发时立即停止无限循环，然后播放离开动画
- **特点**：离开动画和无限循环动画不会同时播放

### Drag 模式（拖拽滚动）
- **进入动画**：完整播放
- **无限循环**：在进入动画完成后开始
- **拖拽开始**：立即停止无限循环，离开动画进度与拖拽进度同步
- **松手后**：如果切换到新场景，触发进入动画，然后开始无限循环
- **特点**：拖拽时需要精确控制离开动画进度，因此无限循环必须停止

## 最佳实践

1. **选择合适的无限动画**：
   - 使用微妙的动画（如 pulse、heartbeat）而不是剧烈的动画（如 shake、bounce）
   - 避免使用会导致布局偏移的动画

2. **性能考虑**：
   - 无限循环动画使用 CSS transform 和 opacity，性能优秀
   - 避免在同一场景中使用过多的无限循环动画

3. **用户体验**：
   - 无限循环动画应该增强而不是干扰内容
   - 确保动画不会分散用户对主要内容的注意力

## 技术实现细节

### 关键代码逻辑

#### Snap 模式 - 进入动画完成后开始无限循环
```typescript
// 进入动画完成后开始无限循环
await controls.start(enterVariant.animate);
setHasEntered(true);

// IMPORTANT: 只在进入动画完成后才开始无限循环
if (infiniteVariant && sceneContext.isActive) {
  infiniteControls.start({
    ...infiniteVariant.animate,
    transition: {
      repeat: Infinity,
    },
  });
}
```

#### Snap 模式 - 离开动画触发时立即停止无限循环
```typescript
// 离开动画触发时立即停止无限循环
const playExitAnimation = async (): Promise<void> => {
  // IMPORTANT: 立即停止无限循环
  infiniteControls.stop();
  
  // 然后播放离开动画
  await controls.start(exitVariant.exit);
  setHasEntered(false);
};
```

#### Drag 模式 - 拖拽开始时立即停止无限循环
```typescript
// 拖拽开始时立即停止无限循环
useEffect(() => {
  if (!sceneContext || !exitVariant) return;
  if (sceneContext.slideMode !== 'drag') return;
  if (!sceneContext.isDragging) return;

  // IMPORTANT: 拖拽开始时立即停止无限循环
  // 这确保离开动画进度可以被拖拽进度精确控制
  infiniteControls.stop();

  // 同步离开动画进度与拖拽进度
  const progress = sceneContext.dragProgress;
  // ... 进度同步逻辑
}, [sceneContext, exitVariant, enterVariant, controls, infiniteControls]);
```

## 测试覆盖

- ✓ 无限循环动画在进入动画完成后才开始
- ✓ Snap 模式：离开动画触发时立即停止无限循环
- ✓ Drag 模式：拖拽开始时立即停止无限循环
- ✓ 场景离开时停止无限循环
- ✓ 场景重新激活时重新开始无限循环
- ✓ Snap 模式完整生命周期：进入 → 无限循环 → 离开
- ✓ Drag 模式完整生命周期：进入 → 无限循环 → 拖拽 → 释放

## 相关需求

- 需求 9.1: 支持 infiniteAnimation 参数
- 需求 9.2: 支持所有预设动画类型
- 需求 9.3: 支持自定义动画
- 需求 9.4: Snap 模式下场景离开或离开动画触发时立即停止
- 需求 9.5: Drag 模式下拖拽开始时立即停止
- 需求 9.6: 场景进入时在进入动画完成后开始
