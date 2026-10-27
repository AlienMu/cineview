---
title: 状态与事件
eyebrow: CONCEPTS / STATES AND EVENTS
---

页面的状态写在元素的属性上，CSS 可以直接按它改样式；变化的时刻派发事件，脚本可以监听。

## 状态属性

| 属性 | 写在 | 含义 |
| --- | --- | --- |
| `data-cv-theme` | `cv-stage` | 当前场景的 `theme` 值，用来切换整页配色 |
| `data-cv-direction` | `cv-stage` | 读者前进的方向：`forward` 或 `backward` |
| `data-cv-current` | `cv-scene` | 当前场景 |
| `data-cv-stuck` | `cv-scene` | 正处在停住的状态：锁定区停住时，或叠盖的场景正被下一场盖住时 |
| `data-cv-covered` | `cv-scene` | 叠盖的场景已被完全盖住，这时不再绘制 |
| `data-cv-active` | `cv-scene` | 拖动模式下，场景在当前渲染的范围内 |
| `data-cv-phase` | `cv-animate` | 元素的阶段：`idle`、`waiting`、`entering`、`entered`、`exiting`、`exited` |
| `data-cv-dealt` | `cv-stack` | 卡片按时间线依次叠上（锁定区和拖动模式里） |
| `aria-current`、`data-cv-before`、`data-cv-after` | 指向场景的链接 | 当前场景的链接、它之前和之后的场景的链接 |

```css
/* 进入暗色场景时换整页配色 */
cv-stage[data-cv-theme="night"] { --ground: #0b0e1a; --ink: #eef1ff; }
/* 往回滚动时显示顶栏 */
cv-stage[data-cv-direction="backward"] ~ .bar { translate: 0 0; }
```

## 事件

所有事件都会冒泡，可以在 `document` 上统一监听。

| 事件 | 派发在 | `detail` |
| --- | --- | --- |
| `cv-ready` | 舞台 | 无；第一次构建完成并画出后派发 |
| `cv-enter`、`cv-leave` | 进入或离开的场景 | `{ from, to, direction }` |
| `cv-progress` | 舞台或场景 | `{ kind: 'load', progress, loaded, total }`、`{ kind: 'zone', index, progress }`、`{ kind: 'page', index, progress, direction }` |
| `cv-activate`、`cv-deactivate` | 场景 | 无；场景进入或离开渲染范围（滚动时大约是视口上下各一屏） |
| `cv-dragstart` | 舞台 | `{ index, direction }` |
| `cv-dragend` | 舞台 | `{ index, from, to, direction, progress, elapsed, total }` |
| `cv-dragcancel` | 舞台 | `{ index, direction, progress }` |
| `cv-dragblocked` | 舞台 | `{ index, target, direction }`；拖向写了 `drag="off"` 的场景时派发 |
| `cv-timeout` | 舞台 | `{ loaded, total }`；首屏等待超时，可取消 |
| `cv-pause`、`cv-play` | 舞台 | 无 |
| `cv-error` | 出错的元素 | `{ code, message, element }`，可取消 |

`stage.ready` 是一个 Promise，在 `cv-ready` 之后兑现；事件已经派发过之后再等待它，也会立即兑现。

## 错误代码

| `code` | 原因 |
| --- | --- |
| `invalid-attribute` | 属性值读不懂（效果项、`from`、`to`、`ease`、`on`、`loop`、`range`、单位） |
| `unknown-effect` | 效果或循环的名字不存在 |
| `unknown-keyframes` | `keyframes(name)` 找不到这条 `@keyframes` |
| `duplicate-name` | 同一场景里两个元素同名 |
| `missing-after` | `after` 写的名字在这一场里不存在 |
| `cycle` | `after` 形成了循环 |
| `unbounded-at` | `at` 留下的空间放不下后面的元素 |
| `bad-at` | `at` 的值读不懂（每个值都要带 `%`），或这一场的时间无法求解 |
| `invalid-drag-config` | 舞台或场景的 `unit`、`scale` 写错 |
| `asset-failed` | 预加载的图片或视频、`cv-video` 的文件、按需模块加载失败 |
| `empty-stage` | 文档解析完后，舞台里没有场景 |

出错时页面会继续运行：读不懂的部分被忽略，其余照常工作。开发版会在控制台打印同样的信息；在 `cv-error` 上调用 `preventDefault()` 可以不打印。

## 舞台的脚本接口

| 成员 | 作用 |
| --- | --- |
| `stage.ready` | 第一次构建完成时兑现的 Promise |
| `stage.current` | 当前场景的序号，构建前是 -1 |
| `stage.goTo(target, { animated })` | 按序号或 id 跳到某个场景 |
| `stage.pause()`、`stage.play()` | 暂停和继续按时间播放的动效（入场和循环） |
| `stage.refresh()` | 页面布局有了舞台察觉不到的变化后，重新测量 |
