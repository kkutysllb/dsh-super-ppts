---
name: super-ppts-html-scholar-notes
description: >
  手写笔记本风格的单文件 HTML 学习笔记：Style A 学霸笔记本（米黄横线纸+
  螺旋装订）/ Style B 手账皮革本（皮革封面+金属环翻页）。技术笔记、
  漏洞分析、知识总结的视觉化呈现。
metadata:
  short-description: 手写本风格学习笔记
  parent: super-ppts-html
license_note: 基于 UncleCheng/scholar-notes（MIT）；LICENSE 随本目录分发。
---

# 手写笔记（scholar-notes）

生成**手写笔记本风格**的单文件 HTML 学习笔记：把技术内容、漏洞分析、
知识总结转化为视觉精美的网页笔记，浏览器直接打开。

> 遵守入口共享工作流与 [../../shared/design-tokens.md](../../shared/design-tokens.md)。

> **⚠️ P0 硬性约束**
> 1. **禁止 emoji 作任何图标或装饰**——图标必须用平面 UI 库
>    （Style A：Lucide SVG `<i class="lucide-xxx"></i>`；Style B：Remix Icon
>    `<i class="ri-xxx-line"></i>`）。
> 2. **内容页纸高度不得超过皮革封面高度**——内容过多必须压缩精简
>    （以模板为参考）。

## 两种模板风格

| | Style A · 学霸笔记本（默认） | Style B · 手账皮革本 |
|---|---|---|
| 视觉 | 米黄横线纸 + 螺旋装订孔 + 胶带/咖啡渍/回形针 | 皮革封面 + 金属环装订 + 多页翻页 |
| 字体 | Kalam + Patrick Hand + Zeyada | Kalam + Ma Shan Zheng（毛笔）+ Zeyada |
| 图标 | Lucide SVG | Remix Icon |
| 交互 | 单页滚动，write-in 入场动画 | 翻页（键盘 ←→ / 点击），封面+内容页 |
| 模板 | `assets/template.html` | `assets/template-journal.html` |
| 适合 | 技术笔记、知识点总结、科普 | 攻击链分析、漏洞笔记、深度研究 |

## Step 1 · 需求澄清

用户未给全时才问（附推荐）：笔记主题与副标题 / 风格 A 或 B / 内容大纲 /
需高亮的关键词与术语 / 需要的组件（流程图、对比框、警告框、代码块）。
**信息充足直接生成。**

## Step 2 · 拷贝模板

```bash
mkdir -p "项目/XXX/notes"
cp <本形态根>/assets/template.html        "项目/XXX/notes/index.html"   # Style A
cp <本形态根>/assets/template-journal.html "项目/XXX/notes/index.html"   # Style B
```

立即修改 `<title>`。

## Step 3 · 填充内容

1. **预检**：读模板 `<style>` 块，确认全部可用组件类名；
2. **选布局**：Style A 参考 `references/layouts.md`；Style B 参考
   `references/layouts-journal.md`；
3. **用组件**：从 `references/components.md` 挑选；
4. **加图标**：必须用平面 UI 库图标（P0 约束），**绝对禁止 emoji**；
5. **控内容量**：内容页纸高度 ≤ 皮革封面高度（P0 约束），超了就压缩精简。

## Step 4 · 自检与交付

对照 `references/checklist.md` 逐项检查 → 浏览器打开预览 →
按反馈迭代（内容、样式、动画延迟）。交付：文件路径 + 风格说明。

## 设计原则

手写感第一（Kalam 系模拟真实手写）；纸质质感（横线纸+装订线+阴影）；
装饰克制（胶带/咖啡渍/涂鸦是点缀不喧宾夺主）；颜色编码
（红=警告/强调、蓝=信息/术语、绿=安全/正面、紫=技术/代码）；单文件输出。

## 参考

- 布局库：`references/layouts.md` / `references/layouts-journal.md`
- 组件手册：`references/components.md`；质检清单：`references/checklist.md`
