---
name: super-ppts-html-slide-deck
description: >
  PPT 风格翻页 HTML 演示：暗色科技、暖色报纸、简约白等多套主题，键盘/滚轮/点击
  翻页，页内元素依次缓入。适合视频科普、技术讲解、教学演示。
metadata:
  short-description: 翻页式 HTML 演示（多主题）
  parent: super-ppts-html
---

# 翻页演示（slide-deck）

生成 PPT 风格的**翻页 HTML 演示**：每页一个主题焦点，翻页驱动，页内元素
依次缓入。用于视频录制、技术科普、教学演示。

> 遵守入口共享工作流（super-ppts-html）与 [../../shared/design-tokens.md](../../shared/design-tokens.md)。

## Step 1 · 参数收集

演示主题 / 页数（建议 5-10）/ 风格主题 / 用途（视频录制/教学/展示）。
**信息充足直接生成，无需追问。**

## Step 2 · 选择主题

| 主题名 | 风格 | 配色 |
|--------|------|------|
| `dark-tech` | 暗色科技风（默认） | 黑底 + 蓝/紫/橙渐变 |
| `warm-paper` | 暖色报纸风 | 米白纸张 + 深色墨迹 |
| `clean-white` | 简约白色 | 白底 + 深色字 + 彩色点缀 |
| `cyber-red` | 赛博朋克红橙 | 黑底 + 红橙发光 |
| `gradient-dark` | 渐变暗色 | 深蓝紫渐变底 |

## Step 3 · 生成规范

**布局**：单文件 HTML（CSS/JS 全内联）；16:9 适配全屏；键盘 ←→ /
鼠标滚轮 / 点击屏幕左右区域翻页；右下角页码（可按要求隐藏）；顶部或底部
细进度条。

**每页动画**：翻页后元素**依次缓入**（不能一次性全弹出）；标题先出现，
正文/图形后出现；单页元素序列总计 1.5-2.5s；用 CSS transition/animation +
IntersectionObserver 或 JS setTimeout 序列。

**代码质量**：800-1500 行；重要图形用纯 CSS/SVG 绘制，不依赖外部图片；
不用外部 CSS/JS 框架（Google Fonts CDN 除外）。

**视觉标准**：每页至少 1 个图形化元素（图表/流程图/示意图/图标组）；
文字分层（大标题/小标题/正文/强调）；核心数据与关键词特殊样式高亮。

## Step 4 · 验收交付

浏览器打开 + 截图抽查（`node ../video-shots/scripts/shot.js 页面.html <毫秒> _t.png`
多时间点）：逐页无重叠遮挡、动画有定格、页码进度条正常。交付时输出：
保存路径 + 每页一句话摘要 + 询问调整。

## 常用调整指令（应能响应）

「删除页码和进度条，保留键盘翻页」/「第 3 页文字缩减，增加图形」/
「改成暖色风格」/「添加二次元颜文字元素」/「hover 元素默认发光」/
「整体文字加大，方便视频展示」。

## 参考

- 主题 prompt 模板：`references/prompts.md`
- 成片示例：`assets/PPT-Generate-*.html`、`assets/PPT-warm-paper-demo.html`
