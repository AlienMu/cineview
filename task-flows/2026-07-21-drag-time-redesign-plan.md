# Task Flow: Site Drag 模式「时间」主题重设计计划书

日期: 2026-07-21
目标: 产出 `/drag` 页面的完整视觉与动画方案稿（不实现）

---

## 节点

- [x] **节点1**: 阅读框架 API 能力与 DESIGN.md 规格
- [x] **节点2**: 阅读现有 drag 页面代码与样式（DragPhoneExperience + CSS）
- [x] **节点3**: 阅读 Hero 风格参考（HeroScene + tokens.css + global.css）
- [x] **节点4**: 阅读 i18n 文案与现有设计系统
- [x] **节点5**: 撰写完整计划书（主题叙事、Scene 结构、排版、动画、辅助元素）
- [x] **节点6**: 自检——去 AI 味审查、框架能力对齐、移动端合理性

---

## 自检清单（节点6）

1. 方案是否优先使用框架内能力（Animate/Position/stagger/waitFor/custom variant）？
2. 字号/间距是否严格遵循 px2vw 单尺子 + clamp(cq) 响应式？
3. 每帧热路径是否避开 useState，优先 motionValue + useTransform？
4. 背景动画是否不抢主题、不引同步布局抖动？
5. 内容密度是否足够（每屏 ≥ 5 个视觉层级）？
