# dsh-super-ppts 能力补齐批次 P1（对标整改续）

**Goal:** 消除对标清单（[`docs/benchmarks/2026-10-04-competitive-landscape.md`](../docs/benchmarks/2026-10-04-competitive-landscape.md) §四）的 4 项 P1 差距。与 P0 批次（[`plans/2026-10-04-pptx-capability-batch-p0.md`](2026-10-04-pptx-capability-batch-p0.md)，已实机验证通过）同一发布口径 **1.5.0**。host/client 零改动、零新依赖红线不破；脚本全部落技能层。

**依据:** P0 实机回归（2026-10-04，DSH 原生桌面端 link 安装）通过后继续；对标证据见 P0 计划同款来源。

**状态:** P1 批次完成（含一个存量 bug 顺手修复：shot.js 在 `type:module` 仓库下 require 崩溃，与 export_html.js 一并转 ESM）；build + smoke 358 项全绿；待用户在 DSH 原生桌面端（link 安装，技能文件即时生效）实机验证后随 1.5.0 发布。

---

## 一、任务清单

| # | 任务 | 落点 | 对标来源 |
|---|---|---|---|
| 6 | **模板版式网格预览**：新脚本把用户模板逐页渲成带页码的小图 + 可选 Pillow 拼接网格图，VI Build 前必看（按图选版式，而非只凭首页缩略图） | `skills/ppts-pptx/scripts/template_thumbnails.py`（新）+ SKILL.md 用户模板路径 + review-and-delivery.md VI 工作流 | Claude `thumbnail.py` 带索引网格选版式；@cola1900 模板预览图 |
| 7 | **演讲备注/演讲稿**：新脚本把逐页备注写入 PPTX notes 页（python-pptx）；Brief 契约加「是否需要演讲备注」；交付包加演讲稿语义 | `skills/ppts-pptx/scripts/add_speaker_notes.py`（新）+ SKILL.md Brief/工作流 + 交付包 | 讯飞智文/WPS/百度文库「自动演讲稿」标配；Claude `addNotes()` |
| 8 | **HTML 线导出 PDF/PNG**：零依赖脚本直驱 Chrome headless（`--print-to-pdf` + `@page` 注入 16:9 页面、`--screenshot` 出 PNG），与 shot.js 同款 findBrowser | `skills/ppts-html/scripts/export_html.js`（新）+ ppts-html/SKILL.md 验收与交付 | Slidev/Marp 一键导出矩阵；dsh-ppt 的 PDF 渲染交付 |
| 9 | **CJK 排版专项**：避头尾/标点挤压/中西文混排/中文禁斜体/字重层级/数字等宽，双线共用 | `skills/shared/design-tokens.md` 新增「CJK 排版」章节 | WPS/Kimi 公认优势；Claude skill 零 CJK 指导（反向差异化） |

## 二、设计决定

1. **template_thumbnails 无 ImageMagick 依赖**：soffice→PDF→pdftoppm 逐页小图
   是主产物（agent 直接 Read 图片页）；Pillow 拼网格是可选增强（python-pptx
   依赖链自带 Pillow，缺席时逐页小图照常交付，网格标签用 ASCII 页码避免
   默认字体 CJK 缺字）。soffice 缺失 = 明确报错 + 指引，不静默降级。
2. **add_speaker_notes 的 notes 来源是技能线**：工作流第 3 步页面规划时为每页
   起草一句话备注（讲什么/强调什么/过渡），随大纲一起经面板确认的语义放
   `purpose` 字段不改 host schema——脚本只负责把 JSON 落进 notes 页。
   `--in-place` 可选，默认 `<deck>.notes.pptx`；写入后 validate 仍应 PASS。
3. **export_html.js 直驱 Chrome**（shot.js 先例，无 Playwright）：PDF 用
   `--print-to-pdf` + 临时副本注入 `@page{size:1920px 1080px;margin:0}`（钉死
   16:9 单页，不靠 CLI 缺失的纸张参数）；PNG 用 `--screenshot`。语义与
   PPTX 线一致：**导出是静态快照**，动效定格首帧（指定时刻的帧用 shot.js）。
4. **CJK 章节是双线红线**：各形态技能可加码不可突破；核心条目：中文禁
   italic、字重三档封顶、中西文间留呼吸（autospace 不可靠时手动 hair space）、
   避头尾（HTML `line-break:strict`）、数字用西文字体防基线跳动。

## 三、实施结果（2026-10-04）

- `template_thumbnails.py`：真实 demo deck 5 页出图 + `grid.jpg` 网格 + `index.txt` 全通
- `add_speaker_notes.py`：完成；写入后自动跑 validate 复核；本机缺 python-pptx → 冒烟按 SKIP 语义，实机验证在桌面端做
- `export_html.js`：真机 Chrome 出 16:9 单页 PDF（MediaBox 1440×810pt）+ 1920×1080 PNG
- 顺手修复（存量 bug）：`shot.js`（ppts-html 技能文档推荐的质检工具）在 `type:module` 仓库下 require 崩溃——技能文档一直推荐、实际一跑就挂；与 export_html.js 一并转 ESM，冒烟加模块加载回归断言

## 四、验收

- [x] `npm run build` + `npm run smoke` 全绿（358 PASS；新增「5c」P1 断言块：shot.js ESM 回归 / export 双产物+16:9 / 版式预览真跑 / 演讲备注按依赖 SKIP）
- [x] template_thumbnails：真实 .pptx（demos/pptx-demo.pptx）逐页出图 + 页码索引
- [x] export_html.js：本机 Chrome 对 fixture HTML 出 16:9 PDF + PNG
- [ ] 实机：用户模板「按模板制作」流程里 agent 先看版式网格再生成；带备注交付一份 deck
- [ ] 与 P0 合并走 1.5.0 发布链（用户节奏）
