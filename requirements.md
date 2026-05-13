# 需求文档：CineView React UI 框架

## 简介

CineView 是一款面向 React 的叙事型 UI 框架，用于构建分页场景体验与滚动驱动内容体验。框架支持 `snap`、`drag`、`scroll` 三套模式引擎，并以 root-first 的方式统一管理模式、布局、动画、滚动条、性能策略和公共事件。

本需求文档以最新设计稿为准，不再保留旧的 scene-level `slideMode`、旧版 `Viewport` 公共 API、以及 scroll 模式下默认 `100vh` 的历史口径。

## 术语表

- **CineView**: 顶级容器组件，唯一模式入口
- **Scene**: 文档 section / 场景容器，负责布局和 scene-owned layer
- **Animate**: 动画组件，负责元素级时间语义消费
- **Position**: 定位组件，负责 scene 内定位与 fixed layer 定位
- **ScrollZone**: scroll 模式下的局部滚动接管区
- **Snap Mode**: 离散分页切换模式
- **Drag Mode**: 拖拽驱动分页与元素时间轴模式
- **Scroll Mode**: 文档流优先、局部时间轴接管的滚动模式
- **Scene-Scoped Fixed Layer**: 只归属于当前 scene 的 fixed layer
- **Design Width / Design Height**: 设计稿宽高双轴基准
- **Preloader**: 图片预加载器

## 需求

最终推荐写法统一为：`CineView mode + modes.*`、`ScrollZone`、`Animate.timeline`、`Position.at/layer`。兼容字段可以过渡运行，但不再作为文档主路径，也不再进入主入口导出的公共 TypeScript authoring 声明。

### 需求 1: Root-First 模式架构

**用户故事**: 作为开发者，我希望所有交互模式都由根节点统一声明，以便获得清晰、稳定且易理解的 API。

#### 验收标准

1. THE CineView SHALL 作为 `snap`、`drag`、`scroll` 的唯一模式入口
2. THE 模式 SHALL 通过 `CineView.mode` 声明，而不是通过 `Scene` 声明
3. THE mode-specific 配置 SHALL 通过 `CineView.modes.snap`、`CineView.modes.drag`、`CineView.modes.scroll` 分组传入
4. THE Scene SHALL NOT 承担根模式配置职责
5. THE public API SHALL 比内部 runtime 少一层复杂度，不要求业务作者理解内部时间轴容器实现

### 需求 2: 响应式尺寸换算系统

**用户故事**: 作为开发者，我希望能够使用设计稿宽高作为基准，系统自动换算为当前视口尺寸，以便可靠地构建双轴响应式布局。

#### 验收标准

1. THE CineView SHALL 接收 `config.width` 与 `config.height` 作为设计稿双轴基准
2. THE CineView SHALL 支持 `px`、`rem`、`vw` 三种单位模式
3. THE CineView SHALL 提供 `scaleX` 与 `scaleY` 两个独立换算比例
4. THE Position SHALL 基于双轴换算而不是单一 `designSize` 进行定位
5. WHEN 视口尺寸变化时，THE CineView SHALL 重新计算双轴换算结果并更新子组件

### 需求 3: Scene 布局模型

**用户故事**: 作为开发者，我希望 Scene 只负责布局和内容边界，而不是背负模式和滚动引擎职责。

#### 验收标准

1. THE Scene SHALL 作为文档 section / 场景容器存在
2. THE Scene SHALL 支持通过 `layout` 对象传入宽度、高度、锚点和 overflow
3. THE Scene SHALL 支持通过 `stack` 对象传入 `mode` 与 `zIndex`
4. THE Scene SHALL 支持通过 `transition` 对象声明 scene 自身 enter / exit 动画
5. THE Scene SHALL 支持通过 `assets.preloadImages` 提供预加载图片
6. THE Scene SHALL 支持通过 `callbacks.onVisibilityChange` 暴露可视状态
7. THE Scene SHALL NOT 接收 `slideMode`、`slideDirection`、`scrollSpeed`、`scrollEnterLength`、`scrollHoldLength`、`scrollExitLength` 这类 mode-specific 字段
8. THE exported Scene authoring declaration SHALL 只暴露 `layout`、`stack`、`transition`、`assets`、`callbacks` 等 grouped props；legacy scene-level props 仅可保留在内部 runtime bridge

### 需求 4: Snap Mode

**用户故事**: 作为开发者，我希望实现离散分页切换体验，用户触发后能够平滑切到下一屏或上一屏。

#### 验收标准

1. WHERE `CineView.mode = 'snap'`，THE root engine SHALL 负责分页切换
2. THE snap 参数 SHALL 通过 `modes.snap` 传入
3. THE `modes.snap.direction` SHALL 支持 `x` 与 `y`
4. THE `modes.snap.duration` SHALL 控制分页切换时长
5. WHEN snap 切换开始时，THE 当前场景 exit 与目标场景 enter SHALL 可并行开始
6. WHILE snap 动画执行中，THE engine SHALL 阻止新的分页切换
7. WHERE `modes.snap.replayOnReenter = false`，THE 返回上一场景时 SHALL 恢复完成态而不是默认重播

### 需求 5: Drag Mode

**用户故事**: 作为开发者，我希望拖拽位移和元素时间轴实时关联，以便获得精确、可控的交互体验。

#### 验收标准

1. WHERE `CineView.mode = 'drag'`，THE root engine SHALL 统一管理 drag 手势和场景切换
2. THE drag 参数 SHALL 通过 `modes.drag` 传入
3. THE `modes.drag.transitionDuration` SHALL 作为 drag 时间轴的默认基准时长
4. THE `modes.drag.threshold` SHALL 作为拖拽阈值对象统一传入
5. THE Scene SHALL 在 drag 模式下负责位移承载，但 SHALL NOT 决定 drag 配置来源
6. THE Animate SHALL 根据 drag 时间轴、delay 与 waitFor 计算 local progress
7. WHEN 用户松手且达到切换条件，THE 目标场景 SHALL 基于当前进度继续 settle，而不是重新触发一套新的 enter 动画
8. WHEN 用户松手且未达到切换条件，THE 当前场景与相邻场景元素 SHALL 按 local progress 对称回退

### 需求 6: Scroll Mode 总体模型

**用户故事**: 作为开发者，我希望 scroll 模式以真实文档流为基础，只在局部需要时由动画时间轴优先接管滚动输入。

#### 验收标准

1. WHERE `CineView.mode = 'scroll'`，THE page SHALL 以正常文档流为基础
2. THE scroll 参数 SHALL 通过 `modes.scroll` 传入
3. THE scroll 模式下 Scene SHALL 允许小于、等于或大于 `100vh`
4. THE scroll 模式 SHALL NOT 默认把 Scene 高度钳制为最小 `100vh`
5. THE 滚动优先级 SHALL 固定为 `动画时间轴 -> 文档滚动`
6. THE animation timeline 与 document scroll SHALL NOT 并行消费同一段输入
7. THE scroll 模式 SHALL 允许 scene 真实内容先布局，再按需声明局部滚动接管区

### 需求 7: ScrollZone 局部滚动接管

**用户故事**: 作为开发者，我希望只声明“哪一段内容接管滚动”，而不是直接理解底层时间轴容器。

#### 验收标准

1. THE framework SHALL 提供 `ScrollZone` 作为 scroll 模式下的主推荐公共语义
2. THE `ScrollZone` SHALL 支持 `zoneId`、`trigger`、`replayOnReenter`、`budget`
3. THE `trigger` 当前 SHALL 支持 `center-lock`
4. WHEN `ScrollZone` 命中触发条件时，THE zone SHALL 获得滚动输入接管权
5. WHEN zone 在当前方向仍有预算可消费时，THE 文档滚动 SHALL 暂停推进
6. WHEN zone 在当前方向预算耗尽时，THE 文档滚动 SHALL 恢复推进
7. THE framework MAY 保留内部 `Viewport` runtime，但 SHALL NOT 继续把它作为主推荐公共 API

### 需求 8: Scroll Driven 与 Visibility Driven 动画

**用户故事**: 作为开发者，我希望 scroll 模式下元素动画有明确分工：一种由滚动强绑定驱动，另一种仅基于可视状态自动执行。

#### 验收标准

1. THE Animate SHALL 支持 `timeline.driver = 'scroll' | 'visibility' | 'scene' | 'auto'`
2. WHERE `timeline.driver = 'scroll'`，THE Animate SHALL 依附所属 `ScrollZone` 的统一预算时间轴
3. WHERE `timeline.driver = 'scroll'`，THE Animate SHALL NOT 再按自身 `getBoundingClientRect()` 独立计算进退场
4. WHERE `timeline.driver = 'visibility'`，THE Animate SHALL 基于可视规则自动执行
5. WHERE `timeline.driver = 'visibility'`，THE enter 触发条件 SHALL 为“元素底部完整进入 viewport”
6. WHERE `timeline.driver = 'visibility'`，THE exit 触发条件 SHALL 为“元素顶部将要离开 viewport”
7. WHERE `timeline.driver = 'visibility'`，THE Animate SHALL 在离开后销毁，并在重新进入时默认重播
8. WHERE scroll 元素未处于 `ScrollZone` 内，THE framework SHALL 在开发环境报警告
9. THE exported Animate authoring declaration SHALL 优先暴露 `duration`、`timeline`、`visibility`，而不是 `enterDuration`、`delay`、`waitFor`、`scrollDriven` 这类扁平 legacy props

### 需求 9: Scroll 预算与长动画

**用户故事**: 作为开发者，我希望多个动画的滚动预算能够按时长、延迟和依赖关系统一换算，避免手调进度窗口。

#### 验收标准

1. THE ScrollZone 总预算 SHALL 基于内部所有 scroll-driven 动画的 `delay + waitFor + enter/exitDuration` 自动结算
2. FOR EACH scroll-driven Animate:
   - `enterTotal = delayChain + enterDuration`
   - `exitTotal = exitDuration`
   - `animationTotal = enterTotal + exitTotal`
3. WHERE 同时存在 enter / exit，THE zone SHALL 按两段时长比例分配滚动预算
4. WHERE 只有 enter，THE enter SHALL 占 100% 滚动预算，完成后保持终态
5. WHERE 只有 exit，THE framework SHALL 在开发环境报警告，而不是把它当作独立 scroll-driven 动画主路径
6. WHERE `waitFor` 存在，THE 后置动画起点 SHALL 基于前置动画完整总时长推导
7. THE 动画总时长越长，单位滚动输入对应的时间推进 SHALL 越慢

### 需求 10: Scene-Scoped Fixed Layer

**用户故事**: 作为开发者，我希望 fixed layer 严格属于自己的 scene，不跨 scene 漂浮，也不和下一个 scene 的 layer 进入同一 overlay 域。

#### 验收标准

1. THE Position SHALL 支持 `layer.fixed`
2. WHERE `layer.fixed = true` 且当前模式为 scroll，THE 节点 SHALL 渲染到所属 scene 的 fixed host
3. THE fixed host SHALL 只在所属 scene 的可见片段内显示
4. THE fixed host SHALL 在 scene 底部边界处释放，而不是继续跟随到下一 scene
5. DIFFERENT scenes 的 fixed layer SHALL NOT 进入同一可见 overlay 域
6. THE fixed layer 的设计坐标参考系 SHALL 保持为设计 viewport，而不是随 host 裁剪高度重解释

### 需求 11: Position 定位系统

**用户故事**: 作为开发者，我希望定位 API 更整洁，并以双轴设计稿为基础可靠换算。

#### 验收标准

1. THE Position SHALL 支持 `at.x`、`at.y`、`at.offsetX`、`at.offsetY`
2. THE Position SHALL 支持 `layer.fixed`
3. WHERE 同时存在绝对定位与相对定位，THE Position SHALL 优先使用绝对定位
4. THE Position SHALL 从 CineView 上下文获取双轴换算结果
5. WHEN 视口尺寸变化时，THE Position SHALL 重新计算定位值
6. THE exported Position authoring declaration SHALL 优先暴露 `at` 与 `layer`，而不是 `x/y/offsetX/offsetY/fixed` 这类扁平 legacy props

### 需求 12: 图片预加载系统

**用户故事**: 作为开发者，我希望系统智能预加载图片，以便优化首屏体验和后续切换流畅度。

#### 验收标准

1. THE CineView SHALL 收集所有 Scene 的 `assets.preloadImages`
2. THE Preloader SHALL 优先加载首屏关键图片
3. WHEN 首屏关键图片加载完成后，THE CineView SHALL 允许首屏进入可运行态
4. THE Preloader SHALL 在后台静默加载后续场景图片
5. WHEN 加载进度更新时，THE framework SHALL 触发 `callbacks.common.onLoadProgress`
6. IF 图片加载失败，THEN THE Preloader SHALL 记录失败 URL 并继续其他任务

### 需求 13: 回调系统

**用户故事**: 作为开发者，我希望回调按模式和职责分组，而不是全部平铺到 root。

#### 验收标准

1. THE framework SHALL 提供 `callbacks.common`
2. THE framework SHALL 提供 `callbacks.snap`、`callbacks.drag`、`callbacks.scroll`
3. `callbacks.common` 至少 SHALL 包含：
   - `onReady`
   - `onLoadProgress`
   - `onSceneWillChange`
   - `onSceneDidChange`
   - `onInteractionStateChange`
   - `onLayoutMeasured`
   - `onError`
4. `callbacks.drag` 至少 SHALL 包含：
   - `onDragStart`
   - `onDragProgress`
   - `onDragCommit`
   - `onDragCancel`
5. `callbacks.scroll` 至少 SHALL 包含：
   - `onZoneEnter`
   - `onZoneLeave`
   - `onZoneProgress`
   - `onSceneVisibilityChange`

### 需求 14: Ref API

**用户故事**: 作为开发者，我希望 ref API 专注于导航、刷新和观测，而不是暴露不稳定的“强制触发动画”语义。

#### 验收标准

1. THE CineView SHALL 通过 ref 暴露 `getState`
2. THE CineView SHALL 通过 ref 暴露 `goToScene`
3. WHERE 当前模式为 scroll，THE CineView MAY 通过 ref 暴露 `goToZone`
4. THE CineView SHALL 通过 ref 暴露 `refreshLayout`
5. THE CineView SHALL 通过 ref 暴露 `preload`
6. THE framework SHALL NOT 继续把 `triggerAnimation` 作为主推荐公共 API
7. THE framework SHALL NOT 继续把 `reload` 作为主推荐公共 API

### 需求 15: Scrollbar 根级配置

**用户故事**: 作为开发者，我希望在 root 层统一配置滚动条策略和样式，以便保持全局体验一致。

#### 验收标准

1. THE CineView SHALL 支持 `scrollbar` 配置对象
2. WHERE `scrollbar = false` 或 `scrollbar.enabled = false`，THE framework SHALL 不启用自定义滚动条
3. WHERE `scrollbar.enabled = true`，THE framework SHALL 在 root 注册滚动条样式
4. THE `scrollbar` 配置 SHALL 支持：
   - `strategy`
   - `width`
   - `radius`
   - `inset`
   - `trackColor`
   - `thumbColor`
   - `thumbHoverColor`
   - `autoHide`
5. THE 默认滚动条样式 SHALL 为细条、圆角、低对比度、自动隐藏

### 需求 16: 性能配置

**用户故事**: 作为开发者，我希望性能策略可配置，但默认值服务于大多数真实项目，而不是为了极端 case 把 API 搞复杂。

#### 验收标准

1. THE CineView SHALL 通过 `performance` 对象接收性能配置
2. THE `performance` 对象 SHALL 支持：
   - `preset`
   - `virtualization`
   - `measurement`
   - `monitor`
3. THE `preset` 默认值 SHALL 为 `balanced`
4. THE framework SHALL 支持 `balanced`、`smooth`、`strict` 三种预设
5. THE framework SHALL 将旧的 `performanceMode` 迁移为 `performance.preset` 体系

### 需求 17: 性能实现要求

**用户故事**: 作为开发者，我希望框架在复杂场景下仍保持流畅，并避免明显的布局测量和运行时开销陷阱。

#### 验收标准

1. THE framework SHALL 避免在 scroll 模式下对 scene 全量后代进行高频重复测量
2. THE framework SHALL 避免通过频繁 DOM 查询查找 Animate 宿主节点
3. THE framework SHALL 尽量减少 React state 与 runtime state 的重复存储
4. THE framework SHALL 将 public props 与 internal runtime props 分层，避免 Scene internal props 持续膨胀
5. THE framework SHALL 优先使用 transform 与 opacity 做动画，以启用 GPU 加速
6. THE 动画和交互帧率目标 SHALL 为 60fps

### 需求 18: 虚拟化与渲染策略

**用户故事**: 作为开发者，我希望大场景数量下仍保持合理的渲染成本。

#### 验收标准

1. WHERE 当前模式为 `snap` 或 `drag`，THE framework SHALL 支持虚拟化渲染当前场景及其相邻场景
2. WHERE 当前模式为 `scroll`，THE framework SHALL 根据内容连续性决定是否关闭或调整分页式虚拟化策略
3. THE 未渲染场景 SHALL 不占用不必要的 DOM 节点
4. THE framework SHALL 使用合适的可见性优化策略减少非活跃内容开销

### 需求 19: 事件与错误处理

**用户故事**: 作为开发者，我希望框架在错误场景下给出清晰提示，并在生产环境保持稳健降级。

#### 验收标准

1. IF Scene 不在 CineView 下使用，THEN THE framework SHALL 在开发环境输出清晰错误
2. IF Animate 或 Position 不在 Scene 下使用，THEN THE framework SHALL 在开发环境输出清晰错误
3. IF scroll-driven Animate 不在 ScrollZone 中使用，THEN THE framework SHALL 在开发环境输出警告
4. IF 检测到动画循环依赖，THEN THE framework SHALL 阻止执行并输出依赖错误
5. IF `goToScene` 传入无效目标，THEN THE framework SHALL 输出警告并忽略请求
6. WHERE 环境为生产环境，THE framework SHALL 以稳健降级为主，而不是直接崩溃

### 需求 20: TypeScript 类型支持

**用户故事**: 作为开发者，我希望框架提供完整且与最新设计一致的 TypeScript 类型定义。

#### 验收标准

1. THE framework SHALL 导出所有公共接口的 TypeScript 类型定义
2. THE 类型定义 SHALL 包含 `CineViewProps`、`SceneProps`、`ScrollZoneProps`、`AnimateProps`、`PositionProps`
3. THE 类型定义 SHALL 包含所有公共回调和 ref 方法签名
4. THE 类型定义 SHALL 与 root-first 模式设计保持一致
5. THE 类型定义文件 SHALL 随 npm 包一起发布

### 需求 21: 代码质量与可维护性

**用户故事**: 作为框架维护者，我希望代码结构清晰、职责单一，以便长期演进。

#### 验收标准

1. THE 代码 SHALL 遵循单一职责原则
2. THE 模式引擎 SHALL 与 Scene 布局职责分离
3. THE public API 层 SHALL 与 runtime 层分离
4. THE 同一业务逻辑字段 SHALL 聚合到同一个对象中，而不是在多个组件顶层平铺
5. THE 代码 SHALL 通过 ESLint、Prettier 和 TypeScript 严格模式检查

### 需求 22: 测试覆盖率

**用户故事**: 作为框架维护者，我希望关键路径具有高测试覆盖率，以便确保重构安全。

#### 验收标准

1. THE 单元测试覆盖率 SHALL 达到 90% 以上
2. THE 语句覆盖率 SHALL 达到 90% 以上
3. THE 分支覆盖率 SHALL 达到 90% 以上
4. THE 函数覆盖率 SHALL 达到 90% 以上
5. THE 行覆盖率 SHALL 达到 90% 以上
6. WHERE 覆盖率低于 90%，THE CI/CD 构建 SHALL 失败
7. THE 测试 SHALL 覆盖 root mode、ScrollZone、scene-scoped fixed layer、scroll budget、callbacks、scrollbar 配置

### 需求 23: 跨平台兼容性

**用户故事**: 作为开发者，我希望框架在移动端和桌面端都保持稳定交互。

#### 验收标准

1. THE framework SHALL 支持触摸事件检测
2. THE framework SHALL 支持鼠标事件检测
3. THE framework SHALL 支持鼠标滚轮输入
4. THE framework SHALL 在不同屏幕尺寸下正确执行双轴换算
5. THE framework SHALL 在 iOS Safari、Android Chrome、Desktop Chrome、Desktop Firefox、Desktop Safari 中正常工作

### 需求 24: 构建与发布

**用户故事**: 作为框架维护者，我希望构建、类型、测试和发布流程稳定自动化。

#### 验收标准

1. THE 构建系统 SHALL 使用 Vite
2. THE 构建输出 SHALL 包含 ES 模块与 UMD 模块
3. THE 构建输出 SHALL 包含 TypeScript 类型定义文件
4. THE 构建 SHALL 在发布前自动运行类型检查、代码检查和测试
5. THE 主包大小目标 SHALL 控制在合理范围，并持续监控

### 需求 25: 安全性

**用户故事**: 作为开发者，我希望框架避免引入常见安全风险。

#### 验收标准

1. THE Preloader SHALL 验证图片 URL 协议为 `http` 或 `https`
2. THE framework SHALL 避免直接渲染不可信 HTML
3. THE 框架维护者 SHALL 定期更新依赖并检查漏洞
4. THE 文档 SHALL 建议开发者配置 CSP 约束资源来源

### 需求 26: 接口迁移与兼容发布

**用户故事**: 作为框架维护者，我希望在迁移到新接口体系时保留可控的兼容路径，以便用户能够逐步升级，而不是一次性断裂。

#### 验收标准

1. THE framework SHALL 采用分阶段接口迁移，而不是一次性硬切
2. THE migration SHALL 优先顺序为：
   - 契约统一
   - 类型兼容桥
   - root runtime 接管
   - Scene 降载
   - ScrollZone 落地
   - Animate 语义迁移
   - Position 双轴迁移
   - 删除旧口径
3. THE framework SHALL 为以下旧字段提供过渡期兼容或明确 deprecated 提示：
   - `Scene.slideMode`
   - `slideDirection`
   - `slideDuration`
   - `scrollSpeed`
   - `scrollControlled`
   - `scrollEnterLength`
   - `scrollHoldLength`
   - `scrollExitLength`
   - `scrollDriven`
4. THE framework SHALL 将 `<Viewport>` 降级为 legacy / compatibility API，而将 `ScrollZone` 作为主推荐公共语义
5. THE framework SHALL 将 `triggerAnimation` 与 `reload` 视为待淘汰接口，而不是新体系的主推荐方法
6. EACH migration phase SHALL 具备对应的类型、构建、测试或浏览器验收检查
7. THE framework SHALL NOT 删除旧主接口，直到兼容桥、迁移提示和阶段验收已完成
