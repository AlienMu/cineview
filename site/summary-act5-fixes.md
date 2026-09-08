# Act 5 修复总结 - 绝对时间轴定位

## 问题诊断

通过调试探针发现第五幕（Runtime Control）所有元素的 `data-timeline-phase` 为 `"hold"`，表明元素已经完成了进入动画并处于持有阶段。这解释了为什么滚动驱动不生效——元素在滚动到达之前就已经完成了动画。

## 根本原因

使用 `timeline: { after: 'previous-element' }` 的链式依赖导致时间轴计算错误。在滚动驱动模式下，链式依赖会导致元素过早进入 "hold" 阶段。

## 修复方案

将所有元素改为使用**绝对时间轴定位**，从统一的锚点 `shot5-anchor` 开始计算：

### 修复前（链式依赖）
```tsx
timeline={{ after: 'runtime-title' }}  // 依赖上一个元素
timeline={{ after: 'code-line-0', delay: 120 }}  // 链式传递
```

### 修复后（绝对定位）
```tsx
timeline={{ after: 'shot5-anchor', delay: 0 }}     // 0-2000px
timeline={{ after: 'shot5-anchor', delay: 0 }}     // 0-4000px (代码行)
timeline={{ after: 'shot5-anchor', delay: 2000 }}  // 2000-3000px (光环)
timeline={{ after: 'shot5-anchor', delay: 3200 }}  // 3200-4200px (脉冲)
timeline={{ after: 'shot5-anchor', delay: 4400 }}  // 4400-5400px (粒子)
timeline={{ after: 'shot5-anchor', delay: 6000 }}  // 6000-7000px (速度指示)
timeline={{ after: 'shot5-anchor', delay: 7000 }}  // 7000-8000px (底部功能栏)
```

## 时间轴布局（8000px滚动区间）

| 元素 | 起点(px) | 时长(px) | 终点(px) | delay from anchor |
|------|---------|---------|---------|-------------------|
| 标题 | 0 | 2000 | 2000 | 0 |
| 代码行0-11 | 0 | 600 | 4000 | 0, 120, 240... |
| 光环 | 2000 | 1000 | 3000 | 2000 |
| 脉冲 | 3200 | 1000 | 4200 | 3200 |
| 粒子组 | 4400 | 1000 | 5400 | 4400 |
| 速度指示 | 6000 | 1000 | 7000 | 6000 |
| 功能栏 | 7000 | 1000 | 8000 | 7000 |

## 修改的文件

- `/Users/alienmu/Documents/alien/cineView/cineview/site/src/components/RuntimeControlScene.tsx`
  - 删除所有 `timeline: { delay: 0 }` 配置（让enterAnimation完全由滚动驱动）
  - 将所有元素改为从 `shot5-anchor` 计算绝对延迟
  - 保持循环动画不变（loopAnimation 不受影响）

## 预期效果

1. **滚动到 0-2000px**：标题逐渐显示
2. **滚动到 0-4000px**：代码行依次淡入（12行错开120px）
3. **滚动到 2000-3000px**：光环淡入并开始旋转
4. **滚动到 3200-4200px**：脉冲淡入并开始呼吸
5. **滚动到 4400-5400px**：粒子淡入并开始公转
6. **滚动到 6000-7000px**：速度指示器显示
7. **滚动到 7000-8000px**：底部功能栏显示

所有元素的 opacity 应该从 0 平滑过渡到 1，跟随滚动进度，而非立即跳到 "hold" 状态。

## 验证方法

手动验证：
1. 启动预览服务器：`npm run preview`
2. 在浏览器打开：`http://localhost:4173/#/scroll`
3. 滚动到第五幕（Runtime Control）
4. 观察元素是否随滚动进度逐渐显示
5. 确认循环动画（旋转、呼吸、公转）正常运行

## 状态

✅ 代码修复完成
✅ 构建成功
⏳ 等待人工浏览器验证
