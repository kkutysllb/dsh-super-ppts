---
name: super-ppts-html-arch-diagram
description: >
  工程级技术图：架构/工作流/时序/数据流/生命周期状态机，独立动画 HTML
  （内联 SVG + 流动动画 + 明暗主题切换 + 一键导出 PNG/JPEG/WebP/SVG/GIF/WebM）。
  接受自然语言描述或 Mermaid 代码，从零排布。触发词：架构图、时序图、状态机、
  数据流图、CI/CD 流程、API 调用链、Mermaid 转换。
metadata:
  short-description: 工程架构图（可导出多格式）
  parent: super-ppts-html
license_note: >
  基于 tt-a1i/Archify（MIT, v2.6），原始项目 Cocoon-AI/architecture-diagram-generator
  （MIT, v1.0）；LICENSE 随本目录分发。
---

# 工程架构图（arch-diagram）

生成专业级技术图：自包含 HTML + 内联 SVG + 明暗主题切换 + 导出菜单。
每个图自带：主题切换（localStorage 持久化、尊重 `prefers-color-scheme`）、
导出菜单（剪贴板 PNG；PNG/JPEG/WebP 原生最高 4× 分辨率；双主题 SVG 下载——
跟随嵌入方主题，适合 GitHub README）、CSS 变量色彩系统保证双主题一致。

> 遵守入口共享工作流与 [../../shared/design-tokens.md](../../shared/design-tokens.md)。
> **与 flowchart 的区隔**：本形态工程/文档向，精确可导出；flowchart 教育/视频向，
> 轻量好看。**与预置 archify 插件**：若用户环境已装 @tt-a1i/archify-dsh 插件，
> 优先用插件工具；本形态是同一能力的技能集成（含 renderers 离线渲染）。

## Setup（一次性，仅 renderer 模式）

四个 typed renderer 用 `ajv` 做 JSON schema 校验。在本目录执行 `npm install`。
**不装也能跑**——打印警告并跳过 schema 校验，保留自身布局检查。
**生成的 HTML 永远零依赖**；只有 renderers 依赖 ajv。

完全无 shell 时（如作为项目知识加载）：所有请求降级 architecture 模式——
按 Design System 手工把 SVG 放进 `assets/template.html`，交付前跑自查清单。

## 图类型选择

| 类型 | 用途 | 实现 |
|------|---------|------|
| `architecture` | 系统组件、云资源、服务、安全边界、基础设施 | `renderers/architecture/render-architecture.mjs` + JSON（或手工 SVG） |
| `workflow` | 技术流程、审批门、工具调用、runbook、CI/CD、应急响应 | `renderers/workflow/render-workflow.mjs` + JSON |
| `sequence` | API 调用链、请求生命周期、缓存回退、异步轨迹、返回路径 | `renderers/sequence/render-sequence.mjs` + JSON |
| `dataflow` | 管道、ETL/ELT、PII 隔离、血缘、数仓同步、消费方 | `renderers/dataflow/render-dataflow.mjs` + JSON |
| `lifecycle` | 状态机、状态迁移、等待态、重试、终止态 | `renderers/lifecycle/render-lifecycle.mjs` + JSON |

触发词路由："架构/系统/云图" → architecture（除非明显流程向）；
"流程/审批/runbook/CI-CD/事件" → workflow；"时序/调用链/谁调谁" → sequence；
"数据流/管道/ETL/血缘/PII" → dataflow；"状态/生命周期/重试/终止" → lifecycle。

JSON 输入样例见 `examples/`（`*.architecture.json` 等）；schema 见 `schemas/`。

## Design System（手工 SVG / 理解 renderer 输出时必读）

- 组件填充类：`c-frontend`（客户端/UI）、`c-backend`（服务/API）、
  `c-database`（存储/缓存）、`c-cloud`（托管设施）、`c-security`（认证/密钥）、
  `c-messagebus`（Kafka/队列）、`c-external`（第三方）；文字 `t-<同类>` +
  中性 `t-primary` / `t-muted` / `t-dim`。
- 箭头类：`a-default`、`a-emphasis`（热路径）、`a-security`（虚线）、
  `a-dashed`（异步）——始终设置 `stroke-width`，`marker-end` 配对同类箭头头。
- 边界：`c-security-group`（虚线玫瑰）、`c-region`（虚线琥珀）、`c-lane`（泳道）。
- 字体继承 SVG 根的 JetBrains Mono：组件名 11-12px、子标签 9px、注释 8px、
  微标签 7px。

## 硬性布局规则

- **双矩形模式无处不在**：先画不透明 `c-mask` 矩形，再画带样式 `c-<type>`
  矩形——半透明填充会让箭头透底。
- **箭头先于组件**出现在文档顺序（SVG 按序绘制，箭头必须垫在盒子后）。
- 垂直堆叠：组件间 ≥40px；内联连接器（消息总线，20px 高）在间隙内，
  不与盒子重叠。
- 边界内边距：boundary `y` = 内部 `y` − 30，`height` = 内部 `height` + 50，
  标签基线在边界顶下 18px。
- 图例：放在所有边界框之外，最低边界下 ≥20px；必要时扩 viewBox。
- viewBox：max(y+height) 之上留 ≥20px（x/width 同理）。
- `.toolbar`、`<script>` 块、`:root`/`[data-theme]` CSS 不动——它们就是
  主题切换与导出菜单本体。

## 流动动画

连接路径自动带流动效果（renderer 与模板内建）：

- CSS 层 `flowDash`（stroke-dashoffset）+ `flowPulse`（emphasis 透明度脉动），
  挂在 `.a-emphasis/.a-default/.a-dashed/.a-security` 上；
- SVG 层每条路径一个 `<animateMotion>` 圆点，时长按 variant 与序号变化；
- **方向铁律**：流动必须从源（无箭头端）流向目标（箭头端）。

variant：`emphasis`（最快最强辉光）/ `default` / `dashed`（异步/批处理）/
`security`（安全/策略路径）。

## 自查清单（交付前必跑）

1. SVG 内 `grep -E 'fill="(#|rgb)|stroke="(#|rgb)'` 除模板自带 defs 外零命中
   （Cardinal Rule：颜色必须走 class）。
2. 每个 `c-<type>` 矩形前有同几何 `c-mask` 矩形。
3. 所有 `<line>/<path>` 箭头在文档顺序上先于所有组件矩形。
4. viewBox 余量与图例位置合规。
5. `.toolbar`/`<script>`/主题 CSS 未被破坏。

## 导出能力（产物内建）

静态：PNG（4× 光栅）/ JPEG / WebP / 双主题 SVG / 剪贴板。
动画（含流动动画的图）：GIF（gif.js 内联，可配分辨率 1-4×、帧率 10-60fps、
时长 2-8s，实时帧数预览）与 WebM（MediaRecorder，推荐 Chrome/Firefox）。
体积参考：GIF 1-10MB，WebM 0.5-2MB（分享优先 WebM）。

## 验收交付

浏览器打开验证主题切换与导出菜单可用；跑自查清单；
`node ../video-shots/scripts/shot.js` 抽查动画中间态；交付单文件 HTML 路径 +
图类型说明 + 可用导出格式清单。

## 参考

- 模板：`assets/template.html`（主题/导出/动画底盘）
- 导出库：`assets/gif.js`、`assets/gif.worker.js`（内联用）
- JSON 样例：`examples/`；schema：`schemas/`；渲染测试：`test/`
