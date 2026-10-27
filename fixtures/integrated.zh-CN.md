# PC 单屏综合案例

[English](./integrated.md)

打开 `integrated.html`，可以对照原始资料、组合标注并保存案例。主 Scene 的六个相关模块放在同一个 1280 × 800 视口内。前后两个 Scene 提供可阅读的内容，用于导航、反向移动和返回。

## 运行案例

构建并启动 V2 生产预览，在打印出的地址后加上 `/integrated.html`：

```js
import { prepareDesktopSite, serveDesktopSite } from '../gate/desktop-site.mjs';

const directory = await prepareDesktopSite('review/my-integrated/site', 'integrated');
const server = await serveDesktopSite(directory, 4394);
// 预览结束后关闭服务：
// await new Promise((resolve) => server.httpServer.close(resolve));
```

导入路径相对于本文所在目录。使用新的构建目录和空闲端口。模式、布局、语言、重播和统一暂停控件位于 Stage 外，比较滑块和图库控件位于内容内。

页面还提供 `window.integrated.mount({ context, layout, language })`、`read()` 和 `dispose()`，用于本地检查。`language` 可取 `en` 或 `zh-CN`。这些辅助函数属于案例，不是 Cineview 的公开 API。

## 阅读组合设计

| 模块     | 画面变化                                           | 负责方                                                                                 |
| -------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 原始资料 | 对照两张对齐的示意图，绘制并显示连接线             | 原生 range 与页面裁切；框架 `draw`、`wipe` 和 view entry                               |
| 标注卡片 | 标题之后依次堆叠三张卡片                           | 框架 `cv-stack` 与 `after`                                                             |
| 说明文字 | 分行、分词出现，改变字重，显示示例计数             | 框架 split/stagger、可变字体轴和 count；页面文字遮罩与竖排                             |
| 图库     | 吸附切换案例，或拖动独立的惯性列表                 | 原生滚动与页面控件、惯性；框架子项 stagger                                             |
| 媒体     | 加载时显示占位图，使用双色印图，并定位视频         | 框架 develop/duotone/push、view focus 与 `cv-video`；页面平移叠化、模糊和 Bayer canvas |
| 时序     | 展示独立 clock 步骤、重叠 loop、局部颜色与绘制进度 | 框架 clock/loop/变量和自定义效果；页面 SVG 订阅                                        |

装饰内容变化时，标题、控件和主要操作仍可使用。将 `cv-fixed` 放为 Scene 的直接子元素：横向内容移动时，状态层仍保持在所属 Scene 的固定框内。跑马灯、图库惯性、图片平移叠化、事件监听和 SVG 订阅由页面管理。统一暂停、减少动态效果、离场和卸载也会处理这些页面工作。

## 理解时序

输入时间线总长为 2400 毫秒。在锁定区（locked zone）中，每毫秒对应一像素真实文档滚动。A 在 100 开始、500 结束；`sequence="60"` 将 B 排在 560–860；C 明确声明 `after="B 60"`，位于 920–1120。D 位于 650–950，E 位于 660–960，二者重叠。声明的退场紧随各自入场。

视频将 500–1500 映射到真实文件的第一秒。局部 `at="25% 75%"` 区间位于 600–1800。两个独立 clock 元素从 Scene 进入后分别播放 0–500 和 400–800，不增加滚动距离。重叠的 sway/spin loop 分别保留 5000 毫秒与 8000 毫秒周期。

普通 scroll 在依赖组的首元素进入视口时启动整组时序，后继即使离屏也会继续计时。drag 将进入过程的拖动映射为元素时间，确认切换后补完剩余入场。因此，取消拖动和反向切换需要与锁定区定点检查分别验收。

## 选择 PC 场景

| 布局    | context                              | 行为                                           |
| ------- | ------------------------------------ | ---------------------------------------------- |
| `grid`  | `drag`                               | 全屏手势分页                                   |
| `grid`  | `zone-auto`、`zone-fallback`         | 自动选择原生能力或明确使用回退实现的锁定滚动区 |
| `grid`  | `enter-auto`、`enter-fallback`       | 普通文档滚动与定时入场                         |
| `track` | `drag`、`zone-auto`、`zone-fallback` | 相同模块按实际溢出距离横向移动                 |

track 布局在 scroll 模式下使用锁定区。前部控件在进入过程中可见，但在 drag 终点会移出视口；需要静止总览时使用 grid。自动选择与实际原生绑定分开记录。平台缺少对应时间线支持时，自动场景可以使用回退实现。

[integrated.mjs](../gate/integrated.mjs) 的 `integratedInventory()` 将 41 条参考逐项对应到位置、负责方或排除项。本案例为有限分页，排除无限 Stage 循环（#21）。横向移动（#5）采用布局变体。部分参考通过页面 CSS、原生控件或明确的适配体现。参考目录描述设计思路，不等于 41 个可互换的预设。

## 执行与解读验收

```js
import { runIntegrated } from '../gate/integrated.mjs';

await runIntegrated({
  base: 'http://127.0.0.1:4394',
  output: 'review/my-integrated/acceptance',
  engines: ['chromium', 'webkit'],
});
```

使用不变的生产构建串行执行，并停止其他测量任务。默认在每个引擎选择八个场景，共 16 条主记录。选定的 grid 回退场景还会切换减少动态效果偏好，并重新挂载中文内容，这些属于同案例的附加检查。Chromium 使用已安装的 Chrome；Playwright WebKit 提供 PC 引擎检查，不能代表品牌 Safari 或实体 iPhone 验收。

结合失败断言、实际输出、可信输入日志和截图判断结果。检查包括声明时序、实际裁切与文字/图片/视频输出、局部控件、正反向移动、取消、大幅滚轮输入、键盘导航、滚动条、固定层几何、暂停、返回和清理。drag-track 前部控件在 grid 和 scroll-track 中检查，其在 drag 终点不可见的情况单独记录。

性能窗口记录活动、暂停、恢复和离场时的原始回调间隔及受支持的观察数据。不受支持的观察指标记为 `null`。选定的 Chrome 回退窗口持续 8100 毫秒，以观察两个 loop 周期。这些样本仅描述本案例与当前机器，不提供通用帧率保证、容量结论或任意组合可用的证明。保留失败记录；更换候选构建后使用新的证据目录。
