# ask1 对抗复审终报（独立验收 agent · 2026-08-13）

**最终结论：PASS**（探针 6/6 + 对抗交叉验证全通过；无修复缺陷。1 处注释失实 + 若干残余风险，均不阻断。）

---

# 第二轮复验（code-review 6 条修正后）— **PASS**

## 逐条结论

- **发现 5 三段式物理位置 CONFIRMED**：offsetParent 链实测（wrapper.offsetParent = 滚动容器自身，offsetTop 真文档偏移；shellH=900、contentTransform 恒等、sticky top:0）——与公式假设一致。钉住段 101 档偏差 0.00px；边界 10px 精扫 0.0px；zone 末 ±400px 20px 档 Δlum 最大 1.8（修正前 34.2 跳变已消）。
- **发现 8 纱合成 CONFIRMED**：方向正确（纱在带之上，正常 alpha 合成）；独立解析器 + 实际 rect 物理真值验证：静息态全 5 consumer 偏差 0-3/通道。
- **发现 7 lift CONFIRMED（C9 保持）**：C9 真机屏均积分直接测量（a3 锁定区 63 档）：R−B 范围 38.4..47.3、振幅 8.9 vs 历史 T1 记录 8.6——无回归，且绝对色温从历史 25-34 抬到 38-47 暖区。浮起增益 lum ≈4.5（plate）/5.7（bar）vs 旧 1.8/2.4。
- **发现 9/10/12/13 CONFIRMED**：scrollHeight 实测全 session 恒定 34600 缓存安全；解析整体置空 + 单调校验；burst 首帧重收集；注释改写正确。

## 真机独立抽查

7/7 探针（D 212/212、E max=10.2）；三段式 vs 实际 rect 钉住段 0.00px；独立解析器静息 0-3/通道；zone 末连续性 Δlum≤1.8；C9 屏均振荡 8.9（历史 8.6）。

## 遗留风险（均不阻断）

1. dolly 放大期 cached y0 过期 × 顶部陡纱：缩放面板最坏 28/通道（仅 B 通道、顶缘离屏时刻）。消除方案：缩放期改用固定中屏参考 y（零成本）或 scale 变化重测（引入布局读，与零布局读设计冲突）。
2. 布局收敛期瞬态（首 session 14px 边界偏差 ≤2 单位，自愈）。
3. maxScroll 缓存对「无 RO 触发的内容增高」静默过期（当前无此路径）。
4. CSS 注释「plate R−B ≈ 47-51」缺纱口径（纱合成后实际 28-47）——已补注释。
5. 探针 D/C 仅覆盖首个 bar；a3 缩放面板路径由本报告独立验证覆盖。
6. 探针与实现共用三段式公式与 regex 家族（自洽性局限）——已用独立解析器补强。

## A. 对抗复审逐条结论

1. **LUT 解析 CONFIRMED**：Chromium computed backgroundImage 序列化 `linear-gradient(rgb(...) 0%, …)`，实现 regex（HomeBackdrop.tsx:132）覆盖 rgb/rgba/可选 alpha/可选空白；探针 F 独立解析 40% 锚 (230,198,175) 与 CSS `#e6c6af` 逐通道一致。解析失败 fail-open 回落 CSS 台阶色。
2. **y0 公式 CONFIRMED**：rect 差滚动不变、含视觉 transform；center-lock 锁定期间（sticky 壳 top:0、overflowInset=0）元素视口 y = y0 → 带坐标 = y0+shift **精确成立**（真机锁定档 dImp=dPhys ≤ 4）。区外（进/出场过渡）省略 sceneRect.top：在屏最坏 ≤ 11/通道、离屏 ≤ 43（不可见）；扫掠连续单调（相邻 Δlum ≤ 9.2）无频闪。dolly 放大期 cached y0 过期：在屏 ≤ 6（plate）/11（code 出场中），同色温族内偏移，不破 C9。
3. **每帧代价 CONFIRMED**：write() 零布局读；5 consumer × ≤8 锚线性扫描。实测写频率 ≈ **每 385px 一次**（比注释 100–260px 更稀，注释偏保守，已修正）。
4. **单一写者 CONFIRMED**：site 内 scrollTop 唯一读者 = HomeBackdrop；全仓 `.style.backgroundColor` 唯一写者 = HomeBackdrop；五处 consumer 均在 Animate 包装层**后代**，backgroundColor 零冲突；无 background transition → inline 即时生效（真机 100% inline===computed）。
5. **硬约束 CONFIRMED**：Act3 C9 同色温（实测锁定档 plate R−B=51 ≥35）；跟随色与背景同源（同一 computed backgroundImage 的 LUT，CSS 锚色单一真源）；规则 6 零新增 animation/infinite；规则 2 零 setState。
6. **边界 CONFIRMED**（残留口全 fail-open 方向）：5 consumer 首帧全在；动态挂载残留（未来懒挂载需补 collect 触发）；reduced-motion 无冲突。

## B. 真机探针 + 对抗抽查

- **探针 6/6 通过**：F 抬谷（40% 锚 R−B=55、lum=205）/ A inline 100% / B 88 个不同值 / C 212 档 R−B≥18 / D 212/212 ≤2 每通道 / E 相邻 Δlum max=1.0。
- **对抗抽查**（独立解析器、不共用实现 regex；3 随机位置 + 90 档密扫、全部 5 consumer）：实现公式独立复核在屏 dImp ≤ 11（锁定 ≤ 4）；物理坐标交叉验证锁定档 dPhys ≤ 6、过渡期在屏 ≤ 11、离屏最大 43 不可见；全 consumer R−B 22..52（谷段 ≈48-51 满足 C9）；相邻 Δlum ≤ 9.2；锚色算术复核全锚 R−B ≤55、lum 步进 ≤12、全页摆幅 38.0。
- 探针 D 自洽性局限已由对抗抽查补强（探针与实现共用 y0 公式/regex，抽查用独立 token 切分解析器）。

## C. 遗留风险清单（不阻断）

1. 锁定区外物理错位（sceneRect.top 省略）：在屏 ≤ 11/通道，过渡期可见但连续平滑。
2. dolly 放大期 y0 缓存过期：在屏 ≤ 6/通道（plate）。
3. 动态挂载消费者不触发 collectConsumers（当前 5 consumer 首帧全在）。
4. dev HMR 改 HomeBackdrop.css 后 LUT 过期至下次 resize（dev-only）。
5. ~~写频率注释失实~~ 已修正（实测 ~385px/次）。
6. 跟随采样带而非带+明度纱合成（顶屏纱重区 consumer 比感知背景深 ~20-30 单位）——明度纱设计下的既定行为。
