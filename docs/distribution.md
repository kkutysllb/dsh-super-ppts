# 分发面清单与提交文案（P2-14）

**状态**：插件本体已上 npm（`dsh-super-ppts`）+ GitHub（`kkutysllb/dsh-super-ppts`）；
本文件只收「让用户找得到」的分发动作。**提交需要用户账号，按下面文案执行即可。**

## 渠道清单

| 渠道 | 形态 | 动作 | 状态 |
|---|---|---|---|
| npm registry | `dsh plugin --profile web add dsh-super-ppts` | 已发布；版本号驱动更新检测 | ✅ 常态 |
| GitHub 直装 | `dsh plugin --profile web add github:kkutysllb/dsh-super-ppts` | 已可用 | ✅ |
| awesome-dsh-plugins | GitHub 收录目录（353 条/14 类） | 按下方向文案提 PR | ⬜ 待提交 |
| dsh.pub | 9,416 个插件的目录站；**提交 = GitHub PR + 自动化 bundle 契约检查**，通过即合并；安装命令 `npx dshpub` | 2026-10-04 核查：**未收录**；对目标仓提 PR（仓库会过自动契约检查——保持 bundle patch 契约干净是前提） | ⬜ 待提交 |
| dsh.deepseek404.com | 第三方插件商店（11 分类） | 站内核查 + 提交入口 | ⬜ 待核查 |
| dshmarket | DSH 内可视化插件市场（`npm i -g dshmarket`） | 装上后搜本包名确认可见 | ⬜ 待核查 |
| GitHub Topics | 仓库 topics 已含 `dsh` `ppt` 等 | 已配置；确认含 `dsh-plugin`（生态惯例 tag） | ✅/⬜ |

## awesome-dsh-plugins PR 文案（可直接粘贴）

**分类**：文档 / 演示生成类（按目标仓现有分类挑最接近的；无对应分类时放「其他工具」）

**条目**：

```markdown
- [dsh-super-ppts](https://github.com/kkutysllb/dsh-super-ppts) — 演示文稿超级插件：
  可编辑 PPTX（pptx-designer 引擎 + 结构机检/渲染验收闭环）与单文件 HTML 在线演示
  （8 种形态）双交付，另有参考图重建线；侧边栏任务面板（大纲确认闸门 + 素材通道），
  用户模板库与生成偏好持久化，`ppts_check/ppts_render/ppts_templates/ppts_task` 四原生工具。
```

**PR 注意**：先读目标仓 CONTRIBUTING/条目格式（字段顺序、是否要求中文/双语），
保持一行一条、字母序；改一个分类一个 PR。

## 目录站核查话术

- dsh.pub / dsh.deepseek404.com：站内搜 `dsh-super-ppts`；若无，找「提交插件」
  入口填 npm 包名（两站疑似自动抓 `keywords` 含 `dsh` 的包——发包后等一个
  抓取周期再查一次）；
- dshmarket（`npm i -g dshmarket`）：内置搜索本包名，确认可见即可见。

## README 已显性化的定位卖点（对外话术口径）

1. **本地生成、数据不出本机**（对比 SaaS 的合规/隐私优势）；
2. **零依赖零端口**（host 侧只有插件自有路由，信任围栏）；
3. **任务面板人在环**（大纲确认闸门——同生态唯一，对标 Gamma/Kimi 的大纲流）；
4. **HTML 8 形态一等交付**（竞品普遍把 HTML 降格为查看器）。
