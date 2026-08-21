# 2026-08-15 act5 收尾层 v2：scrub 退场 + CTA 重做 + footer 入栏

用户反馈六项中的四项（本 flow 范围）。父指令：`frontend-design` 技能加载失败
（本会话 Unknown skill，memory 有记录），按其方法自行执行。

## 节点

- [x] N1 zh.ts：`demoVideo.title` 去逗号 → `或许|也能驱动视频？`（en 不动）
- [x] N2 Scene5Cinema.tsx：删 SPLIT_ENTER / SPLIT_EXIT / 四个 variant / 8 个
      enterRef/exitRef / runSplitEnter / runSplitTextExit；新增 closing latch +
      progressRef + 0.90 收拢；消息 handler 改 latch 驱动；freeze 保留
      （仅去文字编排）；文字/CTA/footer 挂载门控 latch + scrub 窗 0.85–1
      + 一次性 CSS 入场（delay 0/.25/.6/.9）
- [x] N3 Scene5Cinema.css：footer 从视口底 absolute 挪进右栏（cta.body 下）；
      新 scoped `.scene5-cinema__btn`（黑场影院语境，零阴影）；入场 keyframes
      + prefers-reduced-motion 关闭
- [x] N4 探针：`_rv-20260815-closing-v2.mjs`（A/B/C 全 PASS，scrub 数值与
      理论曲线逐位吻合）+ `_rv-20260815-closing-i18n-shots.mjs`（zh/en ×
      1440/1280/390 六组合全 PASS，含对比度 17.46、零阴影、无裁切）
- [x] N5 tsc + prettier 绿
- [x] N6 报告 `site/review/20260815-adv/impl-act5-closing-v2.md`

## 关键裁决（用户拍板）

- 透明度 = progress 纯函数，窗 0.85–1.0；列重开只由 finished 消息触发
  （progress 回升不自动重开，防抖动）；<0.90 收列。
- unfinished 只清 latch（不再编排退场）；freeze 两级串行保留但去掉文字
  exitRef 调用（scrub 已覆盖）。
- 不改全局 `.btn`（他页在用），scoped 新类。

## 自检（CLAUDE.md 四条）

1. 整改完成：旧手动轨/定时器编排全删（grep 零残留）；scrub + CSS 入场两层
   职责不重叠，探针全绿。
2. 无冗余：progressRef 起初写而无读 → 已给 finished 开列守卫作真实消费者；
   删 8 ref + 8 常量 + 4 variant，净减负。
3. 可控：handleProgress 仍纯数字比较，setState 仅阈值穿越；文件行数略增
   全为注释。
4. 性能：零每帧 setState；scrub 走框架 MotionValue 单输入映射；CSS 入场
   一次性；唯一所有者不变量未破坏（latch/split 各自单写者）。

## 遗留移交

- /drag 并行 lane 中间态致真实手势 commit 不可用（详见报告「遗留与移交」）；
  收尾层仅依赖消息协议，已由稳态时段的 closing-v2 探针验证。
