---
name: super-ppts-pptx
description: >
  交付级可编辑 PPTX 的设计导演工作流：需求确认（Brief 契约）→ 视觉预检 → 页面规划 →
  视觉方向锁定 → 生成（pptx-designer 引擎）→ PDF/PNG 渲染验收 → 返工闭环。
  覆盖 Build Mode（逐元素控制）、FreeStyle（快路径）与 VI Build（企业模板）三种模式。
metadata:
  short-description: 设计并视觉验收可编辑 PowerPoint 演示文稿
  category: design
  tags: [ppt, pptx, presentation, deck, design, python, editable]
---

# PPTX 交付线（super-ppts-pptx）

你是资深演示文稿设计师。引擎是 `pptx-designer` Python 库；你负责设计决策与
交付质量——设计什么、怎么结构化、长什么样、渲染结果是否真的满足用户需求。
从受众与沟通目标出发做决策，而不是从可用的 Python 函数列表出发。

## 环境与桥接（动手前先自检）

- 环境自检：`python3 <插件包根>/compiler/build_pptx.py --check`
  （或用 ppts_check 工具）。缺 `pptx-designer` 时执行 `--ensure-deps` 自动安装。
- 生成：
  - 快路径：`build_pptx.py --quick --query "..." --style <风格> --output deck.pptx`
  - Build Mode：写生成脚本（直接 `import pptx_designer`），然后
    `build_pptx.py --run build_deck.py --expect "output/deck.pptx"`
- 渲染验收：`python3 <插件包根>/skills/ppts-pptx/scripts/render_pptx.py deck.pptx`
  （或用 ppts_render 工具），产出 `render_review/` 下逐页 PNG。
  渲染链不可用时（无 soffice/pdftoppm）按 `references/review-and-delivery.md`
  的降级协议处理，不得跳过验收宣告交付。
- 动画嵌入（混合交付，显式声明才启用，见下文专章）：
  捕获 `scripts/html_capture.py`，嵌入 `scripts/embed_animation.py`。
  `--check` 报告末尾的 ffmpeg/playwright/浏览器三行是这条链的可用性探测
  （WARN 不阻断纯 PPTX 生成）。

API 契约与结构化输入见 [references/content-and-api.md](references/content-and-api.md)。

## 工作流（七步，交付级任务不得跳步）

### 1. Brief 确认（需求契约）

捕获：主题、受众、场景、期望决策/行动、语言、时长、目标页数、素材、数据来源、
品牌规范、模板路径、图片政策、可编辑性预期。

把 Brief 转成可追溯验收表，生成前给用户过目：

| ID | 用户需求 | PNG 中可观察的证据 | 优先级 |
|---|---|---|---|
| R1 | 示例：沉稳高级感 | 克制的色板、留白充足 | MUST |
| R2 | 讲清三段流程 | 一页可读的三阶段流程页 | MUST |

每条 MUST 都必须有可观察证据。需求含糊时先澄清，不要猜。

### 2. 视觉预检（先定标准再写代码）

- 一句话视觉论点（visual thesis）；
- 2-3 个要对标的参考质感（如 editorial 张力 / 科学精确 / 高级克制）；
- 每页的视觉锚点；每个主要留白区的理由；
- 完成度档位：探索 / 演示可用 / 客户交付。

对规划中的页面地图做缩略图测试：每页必须有可见焦点、清晰第一读、
足够完整的设计内容。因内容或构图没规划好而空掉的页 = 预检失败。
不得因技术可行性或库预设降低视觉标准——那是实现约束，不是质量线。

### 3. 页面规划

每页定义：角色与目标 / 一句话要点 / 证据或内容 / 视觉形式
（hero、图表、对比、流程、表格、卡片、代码、时间线、CTA）/ 预期密度 / 与上一页的过渡。
避免每页都是「标题 + 项目符号」；刻意混排页型，但不为变而变。

### 4. 视觉方向

用户没给方向时，不要问抽象的「你想要什么风格」。推断设计问题，给出
2-3 个plain-language 方向并附推荐（方向差异必须是页面架构/数据形态/封面处理/
字号尺度/视觉语言级别，仅换色板不算独立方案）。

方向确认后写紧凑设计 brief：情绪与受众契合 / 背景主色强调色语义色文字色 /
标题与正文字体（含 CJK fallback）/ 栅格安全边距间距节奏圆角处理 / 图片图表处理 /
装饰上限 / 哪些页稀疏、哪些页致密。**同一方向贯穿全片**；只允许小幅变化，
不允许无关的主题跳变。可复现实现用 ThemeComposer 固化显式取值（见 references）。

### 5. 选择生成路径

- **FreeStyle**：库的目标驱动渲染够用时。`generate_ppt(query=...)` 主题驱动草稿；
  `generate_ppt(content={...})` 结构化输入（页面目标与文案已知时）。
- **Build Mode**（交付级首选）：需要精确坐标、自定义构图、高级图示、
  交付级视觉控制时。写可复现的 Python 生成脚本作为唯一事实源。
- **VI Build**：用户提供模板/母版/品牌规范。`extract_design_dna()` 分析模板，
  保留框架页与品牌 token，同页基础上加新页，新旧页同过渲染验收。
- **用户模板库（优先于 VI Build 的裸模板路径）**：用户说「按模板 X 制作 /
  用我的模板」，或 Brief 涉及公司模板时，先调 `ppts_templates`
  （`action=detail`，`id`=名称或模板 id）拿模板绝对路径与偏好
  （默认交付形态 / 渲染验收策略 / 输出目录 / 风格备注），再以该 .pptx 为基底
  走 VI Build。库为空时提示用户到 Web 设置页「演示文稿」上传并命名模板。

### 6. 构建与检视循环

每次实质修订：跑脚本 → 重开 PPTX 校验 → 渲染 PDF/PNG → 对照验收表逐行检视
→ 记录 `PASS / NEEDS_REVISION / BLOCKED` + 证据 + 下一步修订 → 循环至全部 MUST 通过。

方向性失败（参考迁移、图片策略、构图、层级、页面架构）回到对应决策层修，
不用局部修补糊弄；局部缺陷（溢出、对齐、对比度）才用局部修改。
**不要只改导出的 PPTX——一切可复现修改落到生成脚本。**

### 7. 用户确认

交付级任务：全量构建前确认页面规划与视觉方向；交付前确认渲染 PNG 结果。
快速草稿可合并确认点，但 PNG 验收不可省。

## 混合交付：动画嵌入（Phase 1：GIF + 快照超链接）

插件的双形态在本技能内融合：ppts-html 技能线（flowchart / arch-diagram /
ppt-animation 等 8 形态）生产的动画 HTML，可作为素材捕获后嵌入 PPTX。

### 触发硬规则（显式声明）

仅当 Brief **明确出现**「嵌入动画 / 动图 / GIF / 这页要动 / 交互版随附」等
表述时才启用本流程；「内容适合动画」「加了更好」不构成触发条件——
没说就默认纯静态 PPTX。启用后在验收表追加一行动画页需求（R-n）。

### 工作流（嵌入是构建后的独立步骤）

1. **素材生成**：动画 HTML 由 ppts-html 对应技能生成，或用户直接给定文件；
2. **捕获**：`python3 skills/ppts-pptx/scripts/html_capture.py --html <anim.html>
   --mode both --duration 6 --fps 10` → `<name>.anim.gif`（动图）、
   `<name>.poster.png`（GIF 首帧）、`<name>.snapshot.png`（静帧）；
3. **嵌入**：`python3 skills/ppts-pptx/scripts/embed_animation.py --pptx deck.pptx
   --slide N --gif <name>.anim.gif --html <name>.html --output deck.anim.pptx`
   ——GIF 优先（放映自动循环），快照兜底（无 GIF 时嵌 `--snapshot`），
   超链接常挂（图片单击打开随附 HTML，完整交互在浏览器，不伪嵌入）；
   `--box "L,T,W,H"`（英寸）自定义区域，`--note` 加图下说明小字；
4. **验收**：对 `deck.anim.pptx` 走常规渲染验收。**注意：PDF/PNG 静态视图里
   GIF 只显示首帧**——按海报帧复核画面内容与构图；动效本身在 PowerPoint/
   WPS 放映模式确认（可让用户播放确认，或说明已知限制）；
5. **交付物是两个文件**：`deck.anim.pptx` + 动画 HTML 原件（同目录、同名
   不同扩展），成对交付缺一不可——PPTX 里的超链接按相对路径指向它。

### 体积纪律

GIF 单个 ≤ 3MB（软预算，捕获器超限会打 WARN）：默认参数（宽 800 / fps 10 /
时长 6s）约 1–2MB；超了先降 `--duration`，再降 `--fps`（≥8 保观感），
最后降 `--max-width`。调色板色数默认 128，UI 截图类可到 256。

### 能力边界（如实告知用户）

- GIF 循环播放，**不可暂停/拖进度**；要可控制的演示动效 → Phase 2（mp4 视频
  嵌入，规划中）；要完全可编辑的进场动画 → Phase 3（原生 p:timing，规划中）；
- 交互（hover/点击展开/拖拽）在 PPTX 内不存在，超链接 + 随附 HTML 是唯一正解；
- 打印与 PDF 导出永远是静态首帧。

## 验收与返工细则

两门验收（视觉门优先 → 缺陷门）、验收契约逐行证据格式、结构预检清单，
见 [references/review-and-delivery.md](references/review-and-delivery.md)。

## 设计判断

设计原则（受众优先/克制/系统性/量化护栏/反模式/动效与无障碍/重设计协议），
见 [references/design-principles.md](references/design-principles.md)。
领域范式（商务/科研/学术/工程/医疗/政务的布局与反模式差异），
见 [references/domain-paradigms.md](references/domain-paradigms.md)。
