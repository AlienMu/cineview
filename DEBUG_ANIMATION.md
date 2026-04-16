# 动画触发调试指南

## 问题描述

Scene 和 Animate 组件的入场动画未触发或无效。

## 调试步骤

### 1. 启动性能测试示例

```bash
cd cineview/examples/performance-test
pnpm dev
```

### 2. 打开浏览器控制台

访问 http://localhost:5173 并打开浏览器开发者工具的控制台。

### 3. 查看日志输出

你应该看到以下日志：

#### Scene 组件日志：
```
[Scene 0] Parsing animations...
[Scene 0] Parsed enter: { initial: {...}, animate: {...}, ... }
[Scene 0] Parsed exit: { initial: {...}, exit: {...}, ... }
[Scene 0] Enter animation effect triggered: { isActive: true, hasEnterVariant: true, slideMode: 'snap', ... }
[Scene 0] Playing enter animation...
[Scene 0] Set initial state: {...}
[Scene 0] Starting animation: {...}
[Scene 0] Animation completed
```

#### Animate 组件日志：
```
[Animate scene-0-title] Parsing animations...
[Animate scene-0-title] Parsed enter: { initial: {...}, animate: {...}, ... }
[Animate scene-0-title] Enter animation effect triggered: { hasSceneContext: true, isActive: true, slideMode: 'snap', hasEnterVariant: true, ... }
[Animate scene-0-title] Playing enter animation...
[Animate scene-0-title] Set initial state: {...}
[Animate scene-0-title] Waiting for delay: 200
[Animate scene-0-title] Starting animation: {...}
[Animate scene-0-title] Animation completed
```

## 可能的问题

### 问题 1: 动画未解析

**症状**：看到 "Parsed enter: null" 或没有看到解析日志

**原因**：
- 动画名称拼写错误
- 动画配置格式不正确
- 动画解析器出错

**解决方案**：
1. 检查动画名称是否正确（如 'fade-in', 'slide-up'）
2. 检查自定义动画的 keyframes 和 options 格式
3. 查看控制台是否有解析错误

### 问题 2: 动画效果未触发

**症状**：看到 "Enter animation effect triggered" 但 hasEnterVariant 为 false

**原因**：
- 动画解析是异步的，可能还未完成
- enterAnimation prop 未传递或为 undefined

**解决方案**：
1. 确保传递了 enterAnimation prop
2. 等待动画解析完成（通常很快）

### 问题 3: isActive 为 false

**症状**：看到 "Enter animation effect triggered" 但 isActive 为 false

**原因**：
- Scene 未被 CineView 标记为激活状态
- 首屏场景索引不是 0

**解决方案**：
1. 检查 CineView 的 currentScene 状态
2. 确保首屏场景是第一个 Scene 组件

### 问题 4: sceneContext 为 null

**症状**：Animate 组件日志显示 hasSceneContext 为 false

**原因**：
- Animate 组件未在 Scene 组件内部使用
- SceneContext.Provider 未正确设置

**解决方案**：
1. 确保 Animate 组件在 Scene 组件内部
2. 检查 Scene 组件是否正确提供了 SceneContext

### 问题 5: 动画播放但看不到效果

**症状**：看到 "Animation completed" 但页面无变化

**原因**：
- 动画的 initial 和 animate 状态相同
- CSS 样式覆盖了动画效果
- Framer Motion 配置问题

**解决方案**：
1. 检查动画的 initial 和 animate 值是否不同
2. 检查元素的 CSS 样式
3. 确保 Framer Motion 正确安装

## 预期行为

### 首屏加载时：

1. **CineView 渲染**
   - 设置 currentScene = 0
   - 渲染第一个 Scene，传递 isActive=true

2. **Scene 0 渲染**
   - 解析 enterAnimation 和 exitAnimation
   - 因为 isActive=true，触发入场动画
   - 提供 SceneContext 给子组件

3. **Animate 组件渲染**
   - 解析 enterAnimation
   - 注册到 Scene 的 animateRegistry
   - 因为 sceneContext.isActive=true，触发入场动画
   - 根据 delay 和 waitFor 计算延迟时间
   - 按顺序播放动画

### 场景切换时：

1. **用户触发切换**（滑动或点击）
   - Scene 检测手势
   - 调用 onSceneChange('forward')

2. **CineView 更新状态**
   - currentScene 从 0 变为 1
   - Scene 0 的 isActive 变为 false
   - Scene 1 的 isActive 变为 true

3. **Scene 0 退出**
   - 触发 exitAnimation
   - Animate 组件触发 exitAnimation

4. **Scene 1 进入**
   - 触发 enterAnimation
   - Animate 组件触发 enterAnimation

## 下一步

如果看到了所有预期的日志但动画仍然无效，请：

1. 检查 Framer Motion 的版本
2. 检查浏览器控制台是否有其他错误
3. 尝试使用简单的预设动画（如 'fade-in'）
4. 检查元素是否被正确渲染（使用浏览器开发者工具检查 DOM）

## 移除调试日志

调试完成后，移除所有 console.log 语句以保持代码整洁。
