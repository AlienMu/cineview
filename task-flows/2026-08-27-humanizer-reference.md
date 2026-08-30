# humanizer 技能参考（N4 文案轮唯一依据，2026-08-27）

来源 `github.com/blader/humanizer` SKILL.md，**v2.11.2, MIT, 456 行 / 29.7KB**，据 Wikipedia「Signs of AI writing」(WikiProject AI Cleanup)。

**为何重抓**：上一轮（2026-08-24 N5b）缓存在 `/tmp/humanizer-SKILL.md` 的是**57 行浓缩摘要**（当时 raw 域被网络策略拦截，只能抓 GitHub 页面）。原技能 456 行，摘要丢了误报防护细则、输出模式、以及若干与本项目直接相关的模式条目（尤其 §30）。本文件是重抓后的完整结构化版本，N4 以**本文件**为准，不用 `/tmp` 那份。

**安全审核**：纯写作规范，无可执行命令 / 无网络副作用 / 无文件操作指令。与上轮结论一致，可用。

---

## 铁律（违反即错误，不是风格问题）

1. 找出模式、**保留每一条主张**——重组结构可以，增删事实不行。
2. **绝不编造**任何 fact / name / number / date / quote / citation。虚构写作豁免此条（本项目不适用）。
3. 匹配目标文风。**若用户提供文风样本，样本覆盖技能自身的风格规则**（包括破折号禁令）。
4. 个性属于博客 / 随笔 / 个人写作；**reference、technical、legal、factual 文本保持中性**。← 文档站正是这一类

---

## 35 模式清单

**内容（1-6）**
1. 夸大重要性 / 传承腔（pivotal moment、evolving landscape）
2. 堆媒体名 / 粉丝数当重要性证据
3. 浅层尾随 `-ing` 从句（highlighting… / ensuring… / symbolizing…）
4. 宣传册腔（nestled、vibrant、breathtaking、boasts a）
5. 模糊来源（experts argue、industry reports）——指名真实来源或删掉，**绝不编一个**
6. 套路化「挑战 / 未来展望」段落

**语言与语法（7-13）**
7. AI 高频词：delve、tapestry、testament、pivotal、underscore、showcase、intricate、landscape 等，**成簇出现时尤甚**
8. 用 serves as / features / boasts 回避 is / are / has
9. 「不仅 X 而且 Y」/「不只是 X，而是 Y」，以及截断式否定尾巴（no guessing）
10. 强凑三件套
11. 同一主体反复换同义词；多句同主语开头。**修的是模式，不是禁用某个词**
12. 假「从 X 到 Y」区间（两端并非真谱系）
13. 被动语态与省略主语，掩盖施动者

**风格（14-19）**
14. **终稿禁用 em / en 破折号**（除非作者样本用了）；也抓空格破折号与 `--`。改用句号、逗号、冒号或括号，**返回前 grep 字符**
15. 无理由加粗
16. 每项都以「加粗标签 + 冒号」开头的竖排列表
17. Title Case 标题 → 句首大写
18. 标题与列表项里的装饰性 emoji
19. 弯引号（当作者 / 格式用直引号时）

**Chatbot 残留（20-22）**
20. 助手腔（I hope this helps / Want me to…? / Certainly!）
21. 知识截止免责声明与推测填空（likely grew up / maintains a low profile）——说明来源缺什么，或删掉
22. 谄媚与「先赞同再回答」

**填充与模糊（23-35）**
23. 填充短语换紧凑写法：in order to→to、due to the fact that→because、at this point in time→now、has the ability to→can
24. 叠加限定词（could potentially possibly be argued）——只留来源支持的
25. 泛泛的正能量收尾——**结束在最后一个具体事实上**
26. 过度连字符：名词前连（a high-quality report），名词后不连（the report is high quality）
27. 假深度揭示（at its core / what really matters / the deeper issue）
28. 预告下一点（let's dive in），**含口语变体**（one thing that bit me）
29. 标题被紧随其后的一行段落原样复述
30. **文档描述的是上一个版本而非当前行为——那属于 changelog 与迁移指南** ← 与用户「框架修复史不上文档」的要求完全同源，本轮的核心约束
31. 强行金句与连串戏剧化断句
32. 套话公式（X 是 Y 界的 Z / the currency of / the architecture of）
33. 假坦白开场（Honestly? / Look / Here's the thing）
34. 反驳没人提出的反对（I'm not saying / Don't get me wrong）——指名来源或给出完整回答的反对可留
35. 稻草人替代方案：提出后一句话打倒。**单个可能合法，多个短促无关的否决才是信号**

---

## 误报防护（单独出现都不算证据，须成簇）

工整语法、casual/formal 混杂、平实枯燥文风、正式词汇本身、书信式称呼与落款、孤立的 however/moreover、仅弯引号、仅破折号、单个短句强调、刻意首语重复、句中的 honestly/look、真实范围说明、法律与安全声明、更正、指名的反对、FAQ 答案、真实设计取舍、缺引用、干净的复杂排版，以及**出现在引文 / 标题 / 专名 / 示例内部的被监控短语**。

**值得保留的人味**：过分具体的细节、未解决的矛盾感受、时代性俚语与内部梗、刻意的第一人称、长短句变化、真实的插话与自我更正，以及 2022-11-30 之前写成的任何文字。

---

## 输出模式

- **粘贴文本（默认）**：给草稿 + 剩余 AI 模式清单 + 终稿。
- **File mode**（本轮采用）：跑完整流程，但**只把终稿写回文件**。**仅动散文**——代码块、YAML frontmatter、数据、链接目标一字不动。之后给简短总结。
- **Embedded mode**（PR / commit / 文档）：只返回终稿。

## 改写流程

标记全部模式 → 写草稿 → 朗读检查节奏 / 简单动词 / 语域 → 自问两问（「哪里还像 AI 写的？」「有没有增删任何 fact/name/number/date/quote/citation/ranking？」，**增删皆算错误**）→ 写终稿：**逐点自然重述，而非对被标记短语逐个打补丁**；某句始终别扭就重写整段；**§14 破折号检查放在最后**。

---

## 本项目的适配裁决

1. **§14 破折号禁令与本仓既有纪律一致**，继续执行（散文区 `—`/`–`/`——` 零命中，代码块豁免）。
2. **铁律 3「样本覆盖风格规则」适用**：用户已要求「保持目前的风格」，故 `concepts/02-timeline.md` + `advanced/08-pitfalls.md` 两页是**权威文风样本**，其风格优先于技能的通用风格条目。技能只用来清 AI 腔，不用来改造既定文风。
3. **铁律 4 判定本站为 technical/reference**：不注入个性，保持中性。
4. **§30 是本轮最相关的一条**：与用户「框架层修复了什么、解决了什么 bug 这种历史都不需要放上去」同一要求。N5 的「历史词零命中」grep 断言正是它的机械化验收。
5. **§11「修模式不禁词」要落实**：不做全局词表替换（上一轮的教训是词库 grep 只能清尾，不能代替改写）。
6. **铁律 1/2 与 N2 事实源核对单叠加**：humanizer 禁止增删事实，N2 规定只有 ✅ 条目可进正文。两者同向——文案轮**不得引入 N2 未记载的任何 API 事实**。
