---
name: super-ppts-html
description: >
  HTML 在线演示交付线统一入口：把内容做成浏览器直接打开的单文件 HTML 演示。
  8 种形态——翻页演示(slide-deck)、流程原理图(flowchart)、网络协议可视化(protocol-viz)、
  工程架构图(arch-diagram)、3D 卡片剧场(card-theater)、手写笔记(scholar-notes)、
  电影化分镜(video-shots)、手机系统 UI(phone-ui)。用户提到任何「HTML 演示/动画网页/
  可视化页面/演示动画」类需求时，先按本入口路由形态，再进入对应形态技能。
metadata:
  short-description: 设计并交付浏览器即开的单文件 HTML 演示
  category: design
  tags: [html, presentation, animation, visualization, slides, diagram]
---

# HTML 交付线（super-ppts-html）

HTML 是在线 PPT 的一种交付形态：产物是**单文件自包含 HTML**，浏览器直接打开
即交付，无需任何服务。你负责选对形态、锁好风格、把完成度做到可直接全屏
录屏或投屏演示。

## 形态路由（先定形态，再动工）

| 形态 | 目录 | 触发信号 | 适用场景 |
|---|---|---|---|
| 翻页演示 | [forms/slide-deck](forms/slide-deck/SKILL.md) | PPT 演示 / 幻灯片 / slides / 翻页 | 视频科普、技术讲解、教学 |
| 流程原理图 | [forms/flowchart](forms/flowchart/SKILL.md) | 流程图 / 概念图 / 原理演示 / 神经网络可视化 | 教育科普，算法与模型原理 |
| 协议可视化 | [forms/protocol-viz](forms/protocol-viz/SKILL.md) | 网络协议 / TCP 握手 / 数据报 / 路由 | 协议结构与交互过程演示 |
| 工程架构图 | [forms/arch-diagram](forms/arch-diagram/SKILL.md) | 架构图 / 时序图 / 状态机 / 数据流 / Mermaid | 工程级技术图，需导出 PNG/SVG/GIF/WebM |
| 3D 卡片剧场 | [forms/card-theater](forms/card-theater/SKILL.md) | 卡片轮播 / Coverflow / 分步讲解 | 叙事式分步展示、模式对比 |
| 手写笔记 | [forms/scholar-notes](forms/scholar-notes/SKILL.md) | 学霸笔记 / 手写笔记 / 网页笔记 | 手写本风格学习笔记、漏洞分析 |
| 电影化分镜 | [forms/video-shots](forms/video-shots/SKILL.md) | 分镜 / 每镜头一个 HTML / 视频演示动画 | 视频成片级演示（角色立绘体系） |
| 手机系统 UI | [forms/phone-ui](forms/phone-ui/SKILL.md) | 手机 UI 演示 / 手机录屏 / 锁屏通知 | 产品演示做成「真手机录屏」 |

**形态选不准时**：教育讲解选 slide-deck / flowchart；工程文档选 arch-diagram；
叙事展示选 card-theater / phone-ui；直接做视频选 video-shots。
用户点名「可编辑 PPT/PPTX」时改走 PPTX 线（skills/ppts-pptx）。

## 共享工作流（四步，各形态 SKILL.md 在此骨架上细化）

### 1. 参数收集

主题内容 / 受众与场景 / 页数或时长 / 风格主题 / 语言。**信息充足直接生成，
不追问**；缺关键项才问（每次最多一轮，给出推荐默认值）。

### 2. 主题与结构锁定

- 按形态选模板/主题（各形态有内置主题表或风格卡）；
- 重形态（video-shots / phone-ui / arch-diagram）先出**结构表**（分镜表/
  图类型+JSON 纲要）给用户确认再动工；
- 相邻单元风格不重复；同一实体全片锁同一颜色。

### 3. 生成

- 模板驱动的形态：`cp` 模板起步，只读标记区域（**Token 纪律**：不通读大模板
  与成片，按行号窗口读）；
- 全新写的形态：单文件内联全部 CSS/JS；
- 共享设计约束见 [../shared/design-tokens.md](../shared/design-tokens.md)
  （字体栈/字级/对比度/动效时长/图标规范）。

### 4. 验收与交付

- 浏览器打开自查 + 无头截图质检（复用
  `forms/video-shots/scripts/shot.js`：`node shot.js 页面.html <毫秒> _t.png`）；
- 逐项过各形态交付标准清单；**无重叠遮挡、无中间态穿帮、结尾有定格**；
- 交付：文件路径 + 内容摘要（每页一句话）+ 询问调整意向。

## 全线硬性红线

1. 单文件自包含：CSS/JS 全内联；外部资源仅允许 Google Fonts CDN（离线优雅降级）。
2. 图形用 CSS/SVG 绘制；图标一律内联扁平 SVG——**禁 emoji 作图标、禁真实品牌商标**。
3. 不使用外部 CSS/JS 框架（arch-diagram 的导出库内联件除外）。
4. 动效元素有入有出（或定格）；重要信息在静帧截图里依然可理解。
5. 1920×1080 或 16:9 舞台自适应全屏。
