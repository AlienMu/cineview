# 对抗验收 · 初版背景机制还原（2026-08-13）— 终验 PASS

三轮阻断链与修复记录：

1. **[已修] .bg-ribbon z0 覆盖 /docs、/demo 静态内容** → z-index 改回初版 -1。
   复验：docs h1 581 暗像素、pre 像素 (27,31,36)=声明值 #1b1f24；demo h1/lead 2416/1043 暗像素；首页角落 (250,240,223)=#faf0df 铺满不变；act5 中心 (30,25,28) 黑罩仍盖；/drag 暗场不变。
2. **[已修] 站内导航后 ribbon 死亡**（路径 A 监听器留旧节点 / 路径 B 重试耗尽）→ `useLocation().pathname` 作 effect 依赖，路由切换重挂（attachTries 随 effect 重建归零）。
   复验（真点击）：A = Docs CTA → Back to home → p=0.2374 流动值 #f7e1c3/#ce8a54 与 LUT 逐字节一致；B = 深链 /docs 停 7s（rAF 0 空转已除）→ Back to home → 同组流动值。双双 PASS。
3. **[已修] attach() 无限 rAF 空转**（/docs 60 ticks/s → 0）+ 300 次封顶。
4. **[已修] 文档**：transition 惰性/LUT 浅斜率防闪/~21 lum 已知残余已入注释；3 处 HomeBackdrop 陈旧注释清零；tokens 回退色同步新 LUT 停靠 0（#faf0df/#fbf5ea）。

终验探针：`_rv-act5-scroll-exit` ✓（黑罩 opacity=0 后解钉）；`rv-20260813-act5-black` 10/10 ✓；type-check exit 0 ✓。

已确认项（三轮累计）：LUT 六停靠 + 插值中点无粉（H∈[16.7°, 39.2°]，饱和度单调无折返、明度单谷——灰粉交替机制性消失）；:root 四变量唯一写者 = BackgroundRibbon；滚动条 thumb 与 --accent 十位置逐通道一致；滚轮 -120/-400 双档双段 max|Δlum| ≤1.67（阈值 15）；台阶色 #f9e4c2/#fcecd6/#efc9ae 不变；面板三位置恒同（无逐帧跟随）。

已知残余（非阻断，注释已记录）：
- 渐变 transition 对 Chromium 惰性（微探针实证）；瞬时大跳变（End 键/程序化）单帧 ~21 lum。
- /demo 附着首个容器（drag demo），该页 accent 恒停靠 0 —— 符合「非首页静态」预期。
