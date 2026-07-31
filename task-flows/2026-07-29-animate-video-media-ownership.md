# AnimateVideo drag 驱动与媒体所有权协议

## 目标

在保持 `Animate` 为唯一时间轴 owner 的前提下，为 `AnimateVideo` 增加原子 timeline frame、scrub/native playback 单写者交接、原生视频能力和完整 drag 生命周期验证。

## 固定契约

1. `AnimateTimeline` 保留 `progress/signedProgress/phase`，新增只读 `frame: MotionValue<AnimateTimelineFrame>`。
2. frame 原子包含 `progress`、`signedProgress`、`phase` 与 `source`：`idle | gesture | continuation | programmatic | scroll | visibility`。
3. drag source 以 CineView 正式 transaction 为准：`driving → gesture`、`settling/bouncing → continuation`、`programmatic → programmatic`。candidate/re-grab suspension 未获 transaction 时不得冒充 gesture。
4. `AnimateVideo` 不读 `SceneContext`，只消费公开 timeline frame。
5. `scrubRange` 支持正向、中段与反向区间；outgoing 的 exit 局部进度不得映射视频时间。
6. 视频时钟只能有一个 writer：框架 scrub、play pending、native playback/paused、play rejected、ended。
7. 最新 `task-flows/2026-07-29-drag-five-act-redesign.md §6.1` 与本任务覆盖 `DESIGN.md §3.5` 的旧最小参数面限制；文档与类型夹具同步更新。

## 节点与硬门禁

- [x] 节点 1：原子 timeline frame/source；RED→GREEN；全新子 Agent 对抗评审 PASS。
- [x] 节点 2：纯媒体所有权状态机；mutation/边界对抗评审 PASS。
- [x] 节点 3：renderer/facade/API（ref、poster、事件、playbackRate、duration.exit、enter/exitAnimation、scrubRange）；对抗评审 PASS。
- [x] 节点 4：two-lane drag 集成与隐藏 Chromium 验收页；独立浏览器 Agent PASS。
- [x] 节点 5：DESIGN/API 文档、全量 verify、build/failure injection；最终 mutation Agent PASS。

任何节点 FAIL 均先修复，再换全新 Agent 复审；未获明确 PASS 不推进。

## 验收矩阵

- timeline：gesture、settle、bounce、programmatic、candidate-idle、scroll、visibility；frame 单次发布无旧 source/phase。
- ownership：range 映射、pause+seek、native owner 后 settle 不抢权、play rejection、终点 hysteresis、反向重获、outgoing hold、re-enter/ended、stale promise/source swap。
- drag：forward/reverse、settle、bounce、rush re-grab、commit/return continuity。
- browser：trusted CDP touch；逐帧采样 `currentTime/paused/ended/sceneIndex`，记录 frame gap、Long Task、seek 次数。
