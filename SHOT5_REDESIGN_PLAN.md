# Shot 5 重新设计方案

## 核心问题诊断

当前RuntimeControlScene的致命缺陷：

1. **元素突然出现**（timeline delay激活），不是滚动驱动
2. **布局无章法**：光环+脉冲+粒子堆在一起，没有叙事秩序
3. **违背电影语言**：Act2是逐帧定格，Act3是倒放推镜，Act5应该有自己的运动模型

---

## 新设计：代码编辑器的"实时预览"分屏

### 概念

展示loopAnimation + 运行时控制的最佳方式：**左侧代码、右侧实时效果**，滚动推进时：

- 代码逐行高亮进入
- 右侧效果同步出现
- 代码改变 = 效果改变（展示playbackRate控制）

类似产品demo视频的"代码→结果"对照，但用滚动驱动。

---

## 布局结构

```
┌────────────────────────────────────────────────────────┐
│  [REC 00:00:08]              SHOT 05 · RUNTIME CONTROL │
│                                                        │
│  ┌──────────────────┐    ┌─────────────────────────┐ │
│  │  // Code         │    │  // Live Preview       │ │
│  │                  │    │                         │ │
│  │  <Animate        │    │   ◯  ← 光环在转        │ │
│  │   loopAnimation  │ ←──┼───────────────────────→│ │
│  │   ={{            │    │                         │ │
│  │    animate: {    │    │    ◉  ← 脉冲在跳       │ │
│  │     rotate:[0,   │    │                         │ │
│  │      360]        │    │   • • •  ← 粒子在飞   │ │
│  │    },            │    │                         │ │
│  │    repeat:Infinity│   │                         │ │
│  │   }}             │    │  playbackRate: 1.0x    │ │
│  │  />              │    │                         │ │
│  └──────────────────┘    └─────────────────────────┘ │
│                                                        │
│  progress 0.0 ────────────────────────────► 1.0       │
└────────────────────────────────────────────────────────┘
```

### 滚动编排（8000ms, center-lock）

```
0ms ───► 2000ms ───► 4000ms ───► 6000ms ───► 8000ms
  │         │           │           │           │
标题入场  代码逐行   效果同步     加速演示    hold驻留
          淡入高亮   出现运行     1.0→2.5x
```

**分段详解：**

#### 0-2000ms：标题入场

```tsx
<Animate
  enterAnimation={{
    animate: {
      opacity: [0, 1],
      y: ['20px', '0px'],
    },
    transition: { duration: 1600, ease: [0.16, 1, 0.3, 1] },
  }}
  duration={{ enter: 2000 }}
  timeline={{ delay: 0 }}
>
  <h2>Infinite loops, finite control</h2>
</Animate>
```

#### 0-4000ms：代码区逐行淡入

左侧代码块的每一行，opacity从0到1，用滚动进度映射：

```tsx
// 不用timeline delay，而是用enterAnimation的keyframes
{
  animate: {
    opacity: [0, 0, 0, 1, 1], // 0-60%静默，60-80%淡入，80-100%驻留
  },
  transition: {
    duration: 4000,
    times: [0, 0.6, 0.8, 1]
  }
}
```

#### 2000-6000ms：右侧效果逐层出现

- 2000ms：光环淡入并开始旋转（loopAnimation启动）
- 3200ms：脉冲淡入并开始呼吸
- 4400ms：粒子淡入并开始公转

**关键：用enterAnimation的opacity控制出现，loopAnimation只负责循环运动**

#### 6000-8000ms：加速演示

代码区最后一行高亮：`playbackRate: 2.5`
右侧三层动画同步加速到2.5x

---

## 运动模型：滚动驱动 vs. timeline delay

### ❌ 错误做法（当前版本）

```tsx
<Animate
  timeline={{ delay: 800 }} // ← 突然激活
  loopAnimation={{ ... }}
/>
```

问题：用户滚动到任意位置，元素都是"到时间就突然出现"

### ✅ 正确做法

```tsx
<Animate
  enterAnimation={{
    animate: {
      opacity: [0, 0, 1, 1], // 前50%不可见，后50%可见
      scale: [0.8, 0.8, 1, 1]
    },
    transition: {
      duration: 8000,
      times: [0, 0.25, 0.35, 1] // 在25-35%区间淡入
    }
  }}
  loopAnimation={{ ... }} // 循环动画独立运行
  duration={{ enter: 8000 }}
/>
```

元素的"出现"由滚动进度控制，"循环"由loopAnimation控制，两者解耦。

---

## 视觉质感：电影感元素

### 1. 代码块设计

```css
.code-editor {
  background: rgba(250, 248, 244, 0.72);
  backdrop-filter: saturate(160%) blur(10px);
  border: 1px solid var(--frame-line);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  padding: 24px;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 1.6;
}
```

### 2. 代码高亮动画

每行代码用`<span>`包裹，逐行淡入：

```tsx
{
  codeLines.map((line, i) => (
    <Animate
      key={i}
      enterAnimation={{
        animate: {
          opacity: [0, 0, 1],
          x: ['-10px', '-10px', '0px'],
        },
        transition: {
          duration: 4000,
          times: [0, i * 0.12, i * 0.12 + 0.1, 1], // 每行错峰120ms
        },
      }}
      duration={{ enter: 4000 }}
    >
      <span className="code-line">{line}</span>
    </Animate>
  ));
}
```

### 3. 预览区边框

```css
.preview-stage {
  border: 2px dashed var(--accent);
  border-radius: 12px;
  background: transparent;
  position: relative;
}

/* 四角装饰（取景框感）*/
.preview-stage::before,
.preview-stage::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border: 2px solid var(--accent);
}

.preview-stage::before {
  top: -2px;
  left: -2px;
  border-right: none;
  border-bottom: none;
}

.preview-stage::after {
  bottom: -2px;
  right: -2px;
  border-left: none;
  border-top: none;
}
```

### 4. 连接线动画

代码块到预览区之间，有一条虚线连接，随滚动进度生长：

```tsx
<svg className="connection-line">
  <Animate
    enterAnimation={{
      animate: {
        strokeDashoffset: ['100%', '100%', '0%'],
      },
      transition: {
        duration: 8000,
        times: [0, 0.3, 0.7],
      },
    }}
    duration={{ enter: 8000 }}
  >
    <path d="M 300,200 L 600,200" stroke="var(--accent)" strokeDasharray="8 4" fill="none" />
  </Animate>
</svg>
```

---

## 底部特性卡片：简化为一行

当前三个卡片堆叠，占空间且分散注意力。改为：

```
┌──────────────────────────────────────────────────┐
│ 🔌 Plugin Hooks  ·  🔷 100% TypeScript  ·  ⚡ 55KB │
└──────────────────────────────────────────────────┘
```

一行，用middle dot连接，7000ms淡入。

---

## 对比：Act2/Act3/Act5的运动模型

| 幕   | 运动模型      | 编排机制                                         |
| ---- | ------------- | ------------------------------------------------ |
| Act2 | 逐帧定格      | 9个预设，每个独立时间窗，切换时淡入淡出          |
| Act3 | 倒放推镜      | 6个panel从中心峰值退回散落位，接力密度62%        |
| Act5 | 代码→效果同步 | 左侧代码逐行淡入，右侧效果同步出现，最后加速演示 |

三幕各有不同的运动语言，但都遵循：**滚动进度 = 叙事进度**。

---

## 实现清单

1. 删除当前RuntimeControlScene的"激活式"layout
2. 重写为左右分屏：代码编辑器 + 实时预览
3. 所有元素的出现都用enterAnimation的keyframes映射滚动进度
4. loopAnimation只负责循环运动，不负责出现
5. 添加连接线、取景框装饰
6. 简化底部特性卡片为一行
7. 保持8000ms总时长

---

**核心原则：滚动是时间轴，每一帧都是有意编排的，不是"到时间就触发"。**
