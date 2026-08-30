# 验收、返工与交付（PPTX 交付线）

交付级 deck 的质量门与闭环协议。核心纪律：**视觉门优先于缺陷门；
不要在还有实质问题时宣告 PASS；一切可复现修改落到生成脚本。**

## 两门验收（先视觉门，后缺陷门）

**视觉门**（对照锁定方向，在渲染 PNG 上）：

- 锁定的视觉论点在最终结果里是否依然可见（色彩/字体/栅格/装饰语言）；
- 每页有清晰的视觉锚点与完整的 takeaway；
- 留白高标准：先识别空白区的**意图角色**（焦点、节奏、层级、图片呼吸），
  识别不出角色的空区域 = 设计缺陷，标 `NEEDS_REVISION`；
- 极简 = 减少非必要元素，不是交付一页没规划完的页面。

**缺陷门**（结构可读性）：

- 无溢出、无重叠、无破图、无占位文本；
- 图表有明确结论、标签可读；
- 对比度、CJK 字体回退、阅读顺序（静态导出可理解）。

## 验收契约与 issue 记录格式

Brief 确认阶段生成的验收表（R1/R2… 每条 MUST 配可观察证据）是返工闭环的
对照基准。每轮检视逐行记录：

```text
Visual review: NEEDS_REVISION
Requirement: R2 [MUST]
Slide 4, right chart: labels are too small and the chart has six low-value categories.
Cause: chart region is too narrow for the selected data.
Action: keep the four material categories, enlarge labels, and rerender.
```

- 状态只允许 `PASS / NEEDS_REVISION / BLOCKED`。
- **存在实质问题时不得 PASS**；每次实质修订后重跑构建 → 渲染 → PNG 复核。
- 方向性失败（参考迁移、图片策略、构图、层级、页面架构）回到对应决策层修；
  局部缺陷（溢出、对齐、对比度）才局部修改。

## 渲染链降级协议

渲染验收工具：`python3 <包根>/skills/ppts-pptx/scripts/render_pptx.py deck.pptx`
（或 ppts_render 工具）。链路 = soffice 转 PDF + pdftoppm 转 PNG。

1. **soffice 或 pdftoppm 缺失**：先引导安装后重试——
   macOS `brew install --cask libreoffice` + `brew install poppler`；
   Linux `apt install libreoffice poppler-utils`；Windows 从 LibreOffice 官网
   安装并将 `soffice.exe` 加入 PATH。
2. **用户无法/拒绝安装**：降级为「重开校验」——用 Python 重开 PPTX 检查
   形状数量、文本完整性与页数，并把**视觉门未执行**明确写入交付说明
   （`BLOCKED: 视觉验收不可用`），请求用户自行在 PowerPoint/WPS 打开复核。
3. 任何情况下**不得**静默跳过验收就宣告交付。

## VI Build（企业模板 / 品牌合规）

**模式决策**：无模板且需精确构图 → Build Mode；无模板且接受目标驱动 →
FreeStyle；用户提供模板或必须遵守企业母版 → VI Build。

工作流：

1. 重开模板，检查页面尺寸、页数、文本区、字体、颜色、logo、循环装饰与母版假设；
2. `extract_design_dna(template_path)` 分析模板；
3. 记录 VI token（背景、主色/强调色、标题/正文字体、安全边距、logo 位、
   页脚规则、允许组件）：
   ```python
   VI = {
       "primary": "#1E3A5F", "accent": "#C9A96E", "background": "#F8FAFC",
       "text_dark": "#1A2B3C", "text_body": "#37474F",
       "font_heading": "Aptos Display", "font_body": "Aptos",
       "safe_margin": 0.65,
   }
   ```
4. 框架页（封面、目录、章节页、结尾页）保持原样，除非用户明确要求重设计；
5. 以模板为起始演示文稿加新页（公共 API + 组件）；
6. 全量渲染验收——**保留页与新增页同过 PNG 复核**。

token 约束新页，**不是**把模板替换为空白演示的许可。母版行为无法经公共
API 保留时，报告局限并询问近似方案是否可接受。

VI 验收标准：框架页完整；logo 与品牌元素不重复不错位；新页沿用同边距/
字体/色彩角色/页脚语言；无页引入无关色板或组件族；全部页过 PNG 复核；
可编辑内容保持可编辑。

## 交付包

交付级任务最终提供：

- 最终 `.pptx`；
- 可复现的 Python 生成脚本与结构化内容（Build Mode 时）；
- 导出的 `.pdf`；
- PNG 预览目录（`render_review/`）；
- 简明的结构与视觉复核结论（验收表逐行状态）。

**用户是主观视觉方向的最终批准人。**
