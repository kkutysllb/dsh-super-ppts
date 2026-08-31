# 版本发布说明 / Release Notes

本目录是 dsh-super-ppts 的版本发布事实源：每个发布版本一份 `v<semver>.md`，
与 git tag 一一对应。`package.json` 的 `version` 是 KCoder 插件管理检测
新版本的信号——**每次发布必须 bump 版本号**；检测到新版本后由用户手动更新。

## 版本索引

| 版本 | 日期 | 说明 |
|---|---|---|
| [v1.1.0](v1.1.0.md) | 2026-08-31 | 设置页「演示文稿」：用户模板库（上传/命名/默认）+ 生成偏好 + `ppts_templates` 工具 |
| [v1.0.1](v1.0.1.md) | 2026-08-30 | `--check` 专属 venv 口径修复；npm registry 首发渠道 |
| [v1.0.0](v1.0.0.md) | 2026-08-30 | 首个公开发布：双交付形态（可编辑 PPTX / HTML 8 形态） |

## 发版约定

每个版本说明固定以下章节（缺项写「无」）：

1. **版本信息**：版本号 / 日期 / tag / 功能提交 / 发布渠道
2. **新增**：新功能、新文件、新渠道
3. **变更**：行为、默认值、文档、元数据的改动
4. **修复**：缺陷修复（写清症状 → 根因 → 修后行为）
5. **删除**：移除的功能、文件、渠道
6. **兼容性与升级说明**：接口契约、退出码、配置语义的变化；升级方式
7. **验证**：本版本实际跑过的验证与结果

## 发版 checklist

1. `package.json` bump `version`（semver：修复 → patch，功能 → minor，破坏性 → major）
2. 写 `release/vX.Y.Z.md`（对照上述章节）
3. 提交并打 tag：`git tag -a vX.Y.Z -m "..."`
4. 推送（含 tag）；npm 渠道：`npm publish --registry https://registry.npmjs.org`
5. GitHub Release 页面：`node scripts/create-github-releases.mjs`
   （把 `release/vX.Y.Z.md` 发布为对应 tag 的 Release 页面；幂等可重跑）
6. `node scripts/sync-to-dsh-plugins.mjs` 同步镜像仓并提交推送
7. 双入口对账：`node scripts/sync-to-dsh-plugins.mjs --check` 零差异
