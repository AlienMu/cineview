# 手势支持文档

## 概述

CineView 现在支持多种手势输入方式，提供更好的用户体验。

## 支持的手势

### 1. 触摸滑动（移动端）
- **单指滑动**：在场景上滑动可以切换到下一个/上一个场景
- **方向**：
  - 向上滑动 → 下一个场景
  - 向下滑动 → 上一个场景
  - 向左滑动 → 下一个场景（横向模式）
  - 向右滑动 → 上一个场景（横向模式）

### 2. 鼠标拖拽（桌面端）
- **点击拖拽**：按住鼠标左键并拖动
- **方向**：与触摸滑动相同

### 3. 滚轮/触摸板（新增）
- **鼠标滚轮**：向上/向下滚动切换场景
- **触摸板双指滑动**：苹果触摸板双指上下滑动
- **特性**：
  - 自动节流（800ms），防止过快触发
  - 滚动阈值（30px），过滤小幅度滚动
  - 阻止默认滚动行为，避免页面滚动
  - 支持横向和纵向滚动

## 用户体验优化

### 防止文字选中
在手势操作时，自动禁用文字选中功能，避免拖拽时意外选中文字：

```css
user-select: none;
-webkit-user-select: none;
```

这个样式会自动应用到所有 Scene 组件上。

## 配置示例

```tsx
<CineView
  config={{
    designSize: 750,
    unit: 'px',
  }}
>
  <Scene
    slideDirection="y"  // 'y' 表示垂直滑动，'x' 表示横向滑动
    slideMode="snap"    // 'snap' 表示快速切换，'drag' 表示拖拽模式
    slideDuration={800} // 切换动画时长（毫秒）
  >
    {/* 场景内容 */}
  </Scene>
</CineView>
```

## 技术实现

### Wheel 事件处理
```typescript
const handleWheel = (e: WheelEvent): void => {
  if (isAnimating) return;

  const now = Date.now();
  if (now - lastWheelTime < WHEEL_THROTTLE_MS) return;

  // 阻止默认滚动行为
  e.preventDefault();

  const delta = slideDirection === 'y' ? e.deltaY : e.deltaX;
  const threshold = 30; // 滚动阈值

  if (Math.abs(delta) < threshold) return;

  lastWheelTime = now;

  if (delta > 0) {
    onSceneChange?.('forward');
  } else {
    onSceneChange?.('backward');
  }
};
```

### 节流机制
- **节流时间**：800ms
- **目的**：防止用户快速滚动导致场景切换过快
- **实现**：记录上次触发时间，在节流期内忽略新的滚动事件

### 滚动阈值
- **阈值**：30px
- **目的**：过滤小幅度的滚动，避免误触发
- **实现**：只有当滚动距离超过阈值时才触发场景切换

## 浏览器兼容性

| 功能 | Chrome | Safari | Firefox | Edge |
|------|--------|--------|---------|------|
| 触摸滑动 | ✅ | ✅ | ✅ | ✅ |
| 鼠标拖拽 | ✅ | ✅ | ✅ | ✅ |
| 滚轮事件 | ✅ | ✅ | ✅ | ✅ |
| 触摸板双指 | ✅ | ✅ | ✅ | ✅ |
| 防止文字选中 | ✅ | ✅ | ✅ | ✅ |

## 测试

运行手势处理测试：

```bash
npm test -- gestureHandlers.test.ts
```

测试覆盖：
- ✅ 向下滚动触发前进
- ✅ 向上滚动触发后退
- ✅ 快速滚动节流
- ✅ 小幅度滚动忽略
- ✅ 动画期间禁用
- ✅ 横向滚动支持

## 注意事项

1. **节流时间**：如果觉得切换太慢，可以调整 `WHEEL_THROTTLE_MS` 常量
2. **滚动阈值**：如果觉得太敏感或不够敏感，可以调整 `threshold` 常量
3. **文字选中**：如果场景内需要选中文字，可以在特定元素上覆盖 `user-select` 样式
4. **默认滚动**：wheel 事件会调用 `preventDefault()`，阻止页面默认滚动行为

## 未来改进

- [ ] 支持自定义节流时间和滚动阈值
- [ ] 支持手势方向配置（反转滚动方向）
- [ ] 支持手势禁用选项
- [ ] 支持触摸板捏合缩放
