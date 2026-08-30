---
name: super-ppts-html-card-theater
description: >
  侧边栏叙事 + 3D 卡片轮播演示动画：Coverflow 3D、Apple 极光、滚动倾斜等
  5 种模板，支持模式切换（动态插拔卡片）、荧光笔高亮、水印图标。适合协议
  流程分步讲解、产品特性展示。
metadata:
  short-description: 3D 卡片轮播叙事演示
  parent: super-ppts-html
---

# 3D 卡片剧场（card-theater）

生成**侧边栏叙事 + 3D 卡片轮播**演示：左侧解说栏 + 右侧玻璃拟态卡片舞台，
逐步展示流程、概念或协议。核心视觉特征：模式切换（动态插拔卡片，
如「传输模式 ↔ 隧道模式」）、荧光笔高亮、键盘/滚轮/点击多路导航。

> 遵守入口共享工作流与 [../../shared/design-tokens.md](../../shared/design-tokens.md)。

**与其它形态的区隔**：slide-deck 全屏翻页无卡片；flowchart 节点连线无叙事栏；
本形态侧边栏 + 3D 卡片轮播，重叙事感，适合「分步讲解 + 模式对比」。

## 5 种内置模板

| 模板 | 文件 | 交互 | 视觉特点 | 适用 |
|------|------|------|---------|------|
| `scroll-3d-tilt` | `assets/scroll-3d-tilt.html` | 垂直滚动 + 鼠标 3D 倾斜 | 动态网格背景 + 单卡片居中 + 鼠标跟随透视 | 单页滚动沉浸演示 |
| `apple-aurora-track` | `assets/apple-aurora-track.html` | 键盘 ←→ + 点击 | Apple 极光背景 + 液态玻璃轨道 + 非选中模糊后退 | 产品特性，高级感 |
| `coverflow-classic` | `assets/coverflow-classic.html` | Coverflow + 键盘 + 滚轮 | 经典 3D 旋转 + 侧边栏解说 + 荧光笔 | 协议分步讲解（最通用） |
| `coverflow-watermark` | `assets/coverflow-watermark.html` | 同上 | 巨型水印图标 + 大段文字 + 极简侧边栏 | 高密度技术讲解 |
| `coverflow-focus` | `assets/coverflow-focus.html` | 同上 | 选中卡展开详情 + 未选中仅标题 + 总结卡 | 由浅入深渐进讲解 |

## Step 1 · 确认主题与模板

主题 + 模板选择（最通用 → classic；高级感 → aurora-track；高密度 →
watermark；渐进讲解 → focus）。**信息充足直接生成。**

## Step 2 · 规划卡片内容

每张卡片定义：

```yaml
卡片:
  序号: "01"
  标题: "应用数据"
  副标题: "Payload"            # mono 字体，带色
  图标: 内联 SVG（禁 emoji）
  图标颜色: "#FFD60A"
  解说: "侧边栏叙述文字…"
  要点: "侧边栏底部提示"
  高亮文本: "CLEAR TEXT / HTTP"  # 荧光笔划过内容
  高亮颜色: "#FFD60A"
```

**模式切换卡片**（可选）：定义「模式A ↔ 模式B」，切换时动态插入/移除卡片
（如 IPsec 传输模式 4 卡 ↔ 隧道模式 5 卡，多一张新 IP 头卡）。

## Step 3 · 生成标准

- 暗色科技风：纯黑 `#000` 或极深 `#030508` 底；卡片玻璃拟态
  （`backdrop-filter: blur(30px) saturate(150%)`）；卡宽 280-400px、高 380-580px；
  侧边栏 280-350px 半透明模糊；
- 字体：Inter（正文）+ JetBrains Mono（代码/高亮）+ Noto Sans SC（中文）；
- 配色：Apple 系（`#0A84FF` 蓝 / `#30D158` 绿 / `#FFD60A` 黄 / `#BF5AF2` 紫）；
- 动画：卡片切换 3D 透视 + `cubic-bezier(0.25, 0.8, 0.25, 1)`；选中放大提亮
  清晰、非选中缩小变暗模糊；荧光笔划线（`background-size: 0% → 100%`）；
  侧边栏切换 淡出→更新→淡入（300ms）。

## Step 4 · 验收交付

浏览器打开 + 截图抽查（`node ../video-shots/scripts/shot.js`）：卡片 3D 变换
中间态不穿帮、荧光笔动画完整、模式切换插拔正确、侧边栏与卡片同步。
交付：文件路径 + 卡片清单摘要 + 询问调整。

## 参考

- Prompt 模板：`references/prompts.md`
- 成片示例：`assets/`（含 ai-vulnerability-showcase 等实战页）
