/**
 * DSH Web GUI Client Extension for dsh-super-ppts.
 *
 * BUILD NOTE: dsh 的 client 模块加载器要求特定 bundle 形态。本文件是
 * HAND-MAINTAINED（不由 tsc 生成）：必须经
 * `window.__ModuleLoader__.load({ id, factory })` 自注册、经 `exports.apply`
 * 暴露扩展并 `return module.exports`；裸 ESM `export` 不会注册，触发：
 *   "bundle .../client.js loaded without registering \"dsh-super-ppts\" via __ModuleLoader__.load"
 * 类型参考（与产出物手工保持同构）见 src/client/index.ts。
 *
 * 设置页「演示文稿」菜单项：
 * - 经 ctx.slots 注册 `settings.section`（导航 id: super-ppts）；
 * - 模板库管理：上传 .pptx（原始流式 → /super-ppts/upload）、命名/重命名、
 *   描述、设为默认、删除；
 * - 生成偏好：默认交付形态 / 渲染验收策略 / 输出目录 / 风格偏好备注；
 * - 数据面走 /super-ppts/api/<method>（POST JSON，{ok,value}/{ok,error} 信封），
 *   与 host 侧 routes.ts 一一对应；
 * - 双语文案走 ctx.locale（命名空间 superPpts）。
 *
 * inject 声明（exports.inject）是 cordis 服务名；package.json →
 * dsh.client.inject 声明对应 runtime 包，两处缺一即抛
 * "cannot get property ... without inject"。
 */
window.__ModuleLoader__.load({
	id: "dsh-super-ppts",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		const React = require("react");

		var NS = "superPpts";
		var API = "/super-ppts/api";
		var UPLOAD = "/super-ppts/upload";

		/* ── 双语文案（zh / en）──────────────────────────────── */

		var zh = {
			nav: "演示文稿",
			title: "演示文稿",
			workTitle: "演示文稿工坊",
			promptBase: "做一个演示文稿：{topic}",
			promptTpl: "按模板 {tpl} 制作：{topic}",
			promptPptx: "做一个 PPTX 演示：{topic}",
			promptHtml: "做一个 HTML 演示：{topic}",
			workIntro: "选好工作区、交付形态与模板，写一句话主题；「放入输入框」后回到对话确认，回车即发。模板上传与管理在 设置 → 演示文稿。",
			sendToChat: "放入对话输入框",
			quickTitle: "快速开始",
			quickHint: "点一条填入主题，内容可自由修改",
			q1Label: "季度汇报",
			q1Text: "把这份季度经营数据做成一页纸高管汇报，突出关键指标与结论",
			q2Label: "项目复盘",
			q2Text: "做一份项目复盘演示：目标回顾、结果对比、问题与改进计划",
			q3Label: "产品发布",
			q3Text: "为新产品发布做一页演示：一句话卖点、三个核心特性、行动号召",
			q4Label: "教学课件",
			q4Text: "把这份知识点整理成教学课件：由浅入深，配图示与练习",
			q5Label: "技术分享",
			q5Text: "做一份技术分享演示：问题背景、方案架构、效果数据",
			q6Label: "读书笔记",
			q6Text: "把这份读书笔记做成视觉化演示：核心观点、金句与行动启发",
			q7Label: "周报总结",
			q7Text: "把本周工作总结成一页汇报：完成事项、数据结果、下周计划",
			q8Label: "数据看板",
			q8Text: "把这组数据做成可视化演示：趋势、对比与异常标注",
			topicLabel: "主题",
			topicPlaceholder: "例如：把这份季度经营数据做成一页纸高管汇报",
			formatLabel: "交付形态",
			formatFollow: "跟随生成偏好",
			templateLabel: "模板",
			templateNone: "不使用模板",
			sentCopied: "提示词已复制并回到会话——粘贴(⌘V / Ctrl+V)后回车发送",
			sentClipboard: "已复制创作提示词，请粘贴到对话发送",
			sendNone: "无法自动填入，请手动把提示词粘贴到对话",
			topicRequired: "先写一句主题",
			tplGalleryTitle: "模板速览",
			tplGalleryHint: "「使用」即选入上方表单；上传/重命名/删除在设置页",
			useTpl: "使用",
			defaultTemplateLabel2: "默认",
			intro: "管理 PPT 模板库与生成偏好。上传并命名模板后，对话里直接说「按模板 <名称> 制作」即可让 Agent 使用。",
			templates: "模板库",
			empty: "还没有模板。上传一个 .pptx 模板并命名，之后即可在对话中按名称使用。",
			upload: "上传模板",
			uploadHint: "选择 .pptx 文件（默认上限 100 MB，可经 cordis.yml patch 调整），命名后上传。",
			chooseFile: "选择 .pptx 文件",
			nameLabel: "模板名称",
			namePlaceholder: "例如：公司品牌模板",
			descLabel: "描述（可选）",
			descPlaceholder: "用途 / 风格备注，Agent 会参考",
			uploadBtn: "上传",
			uploading: "上传中…",
			defaultBadge: "默认",
			setDefault: "设为默认",
			unsetDefault: "取消默认",
			rename: "重命名",
			delete: "删除",
			deleteConfirm: "确定删除模板「{name}」？此操作不可撤销。",
			save: "保存",
			cancel: "取消",
			renameName: "名称",
			renameDesc: "描述",
			defaultTemplateLabel: "当前默认模板",
			none: "（未设置）",
			prefs: "生成偏好",
			prefsHint: "以下偏好会随模板库一起打包提供给 Agent（ppts_templates 工具），影响每次 PPT 制作。",
			defaultFormat: "默认交付形态",
			defaultFormatAsk: "每次询问",
			defaultFormatPptx: "可编辑 PPTX",
			defaultFormatHtml: "HTML 演示",
			renderReview: "渲染验收策略",
			reviewDeliverable: "仅交付级验收（推荐）",
			reviewAlways: "每轮都验收",
			reviewOff: "关闭",
			outputDir: "输出目录",
			outputDirPlaceholder: "留空 = 会话工作目录，支持 ~ 前缀",
			styleNotes: "风格偏好备注",
			styleNotesPlaceholder: "全局审美基线，例如：多用图表、克制用色、标题不超过两行…",
			refresh: "刷新",
			saved: "已保存",
			uploaded: "模板已上传：{name}",
			deleted: "模板已删除",
			defaultSet: "已设为默认模板",
			defaultCleared: "已取消默认模板",
			errPickFile: "请先选择 .pptx 文件",
			errPickName: "请填写模板名称",
			loading: "加载中…",
			wsLabel: "工作区",
			wsFollow: "跟随当前工作区",
			wsLoading: "工作区加载中…",
			wsEmpty: "尚无工作区——发起后会自动建立会话",
			sentDraft: "提示词已填入当前会话输入框——检查或修改后回车发送",
			loadFailed: "加载失败",
			retry: "重试",
			// ── 面板壳 ──
			newTask: "新建任务",
			recent: "最近任务",
			panelTitle: "演示文稿",
			newTaskTitle: "新建演示任务",
			newTaskIntro: "从一个想法、文本或本地文件开始，Agent 会直接帮你制作。",
			// ── 新建任务视图 ──
			startTask: "开始制作",
			advancedOptions: "更多选项",
			configSummary: "配置摘要",
			formatPptxCard: "可编辑 PPTX",
			formatHtmlCard: "HTML 演示",
			formatPptxHint: "交付 .pptx，可继续二次编辑与套用模板",
			formatHtmlHint: "单文件 HTML 演示，浏览器直接打开",
			taskStarted: "任务已启动，Agent 正在制作…",
			taskWaitingLaunch: "任务已创建（已落盘，等待启动）",
			taskCreateFailed: "创建任务失败",
			materialAdd: "添加素材",
			materialList: "素材",
			materialRemove: "移除",
			materialEmpty: "尚未添加素材——图片与文档能让 Agent 更懂你的意图",
			tplChoose: "选择模板",
			tplFollow: "跟随默认模板",
			// ── 模板选择器（Task 4）：内置/用户分组、来源标签、不使用/跟随默认 ──
			tplPickerTitle: "选择模板",
			tplFilterAll: "全部",
			tplFilterBuiltin: "插件内置",
			tplFilterUser: "我的模板",
			tplSearch: "搜索模板名称或描述",
			tplBuiltin: "插件内置",
			tplUser: "我的模板",
			tplNone: "不使用模板",
			tplNoneHint: "让 Agent 按内容自由定版式（提交 templateId: null）",
			tplFollowHint: "跟随 设置 → 演示文稿 里的默认模板（当前默认行为）",
			tplManage: "管理我的模板",
			tplUse: "使用",
			tplGroupEmpty: "这一组还没有模板",
			audienceLabel: "受众",
			audiencePlaceholder: "例如：高管 / 客户 / 学员",
			scenarioLabel: "场景",
			scenarioPlaceholder: "例如：季度经营会 15 分钟",
			pageCountLabel: "预计页数",
			pageCountPlaceholder: "例如：12",
			styleLabel: "风格",
			stylePlaceholder: "例如：暗色科技风 / 简约商务",
			// ── 最近任务视图（Task 7）：分组标题 + 状态徽标 + 空/错态 ──
			groupAttention: "需要你的操作",
			groupActive: "进行中",
			groupFailed: "失败",
			groupDone: "最近完成",
			recentEmpty: "还没有任务——从「新建任务」开始制作第一份演示文稿",
			recentError: "任务列表加载失败",
			openTask: "打开任务",
			stylesBlockedWarning: "插件样式表被宿主拦截，面板以降级形态显示（功能不受影响）。请打开开发者工具把 Console 里的红色报错反馈给插件作者。",
			taskStatusCreating: "创建中",
			taskStatusWaitingLaunch: "等待启动",
			taskStatusAnalyzing: "正在分析内容",
			taskStatusWaitingOutline: "等待确认大纲",
			taskStatusNeedsInput: "需要补充信息",
			taskStatusBuilding: "正在生成",
			taskStatusReviewing: "验收中",
			taskStatusCompleted: "已完成",
			taskStatusFailed: "失败",
			taskStatusCancelled: "已取消",
			// ── 大纲确认视图（Plan 2b Task 3）：确认门 + 直接编辑 + 自然语言修改 ──
			outlineConfirm: "确认大纲并继续生成",
			outlineSaving: "保存中…",
			outlineSave: "保存修改",
			outlineRevise: "让 Agent 修改",
			outlineReviseEmpty: "请先写下修改指令",
			outlineAdd: "＋ 添加页面",
			pageNew: "新页面",
			outlineCopiedHint: "修改/继续指令已复制，请到 Agent 会话粘贴发送",
			outlineSendFailed: "无法把指令送达会话，请重试或重新启动生成",
			outlineResync: "大纲已有新版本，已重新载入，请再次确认",
			outlineEmpty: "暂无大纲，等待 Agent 生成",
			backToRecent: "返回",
			outlineHint: "Agent 已生成 {n} 页结构。确认后才继续生成；可直接编辑页面卡片，或用自然语言让 Agent 修改。",
			outlineDirty: "有未保存的修改",
			outlineBackDirty: "有未保存的修改——返回会丢失这些改动。",
			outlineReviseDirty: "有未保存的修改：先保存再让 Agent 修改，或丢弃本地改动后继续。",
			outlineSaveAndRevise: "保存并修改",
			outlineDiscard: "丢弃修改",
			outlineStillBack: "仍要返回",
			outlineStayEditing: "留下编辑",
			outlinePageNo: "第",
			pageTypeTitle: "标题页",
			pageTypeSummary: "结论页",
			pageTypeKpi: "KPI 数据页",
			pageTypeTrend: "趋势图页",
			pageTypeCompare: "对比页",
			pageTypeTimeline: "时间线",
			pageTypeFlow: "流程图",
			pageTypeCase: "案例页",
			pageTypePlan: "行动计划页",
			pageTypeEnd: "结束页",
			// ── 生成进度视图（Plan 2b Task 4）：六阶段时间线 + 恢复变体 + 只读终态 ──
			stageReceive: "接收需求",
			stageAnalyze: "分析内容",
			stageOutline: "生成大纲",
			stageBuild: "构建页面内容",
			stagePackage: "组装渲染",
			stageReview: "验收审查",
			progressStageLine: "第 {i}/{n} 阶段 · {label}",
			waitingStage: "等待 Agent 汇报阶段进度…",
			openSession: "打开 Agent 会话",
			cancelTask: "取消任务",
			launchRecovery: "任务已落盘，但 Agent 会话未能启动（提交可能不可达）。可以重试启动，或取消任务。",
			launchRetry: "重试启动",
			needsInput: "Agent 需要你补充信息",
			inputAnswer: "写下补充信息，Agent 会基于它继续…",
			inputSend: "发送补充信息",
			errorRecovery: "生成失败，任务停在最后阶段",
			failRetry: "重试当前阶段",
			failBackOutline: "返回修改大纲",
			terminalNote: "任务已取消（只读）。回到最近任务可重新发起。",
			continueSent: "已把继续指令送回会话，等待 Agent 推进。",
			// ── 结果视图（Plan 2b Task 5）：产物条目 + 复制路径 + 继续修改 ──
			// （实现后审查修正：摘要措辞按交付形态分两键，不再填 {format} 原值）
			resultSummaryPptx: "已完成 · {pages} 页 · 可编辑 PPTX",
			resultSummaryHtml: "已完成 · {pages} 页 · HTML 在线演示",
			artifactReady: "可用",
			artifactMissing: "文件已丢失（可重新生成）",
			artifactRegen: "重新生成",
			copyPath: "复制路径",
			artifactsEmpty: "任务尚未登记产物，或产物登记为空。",
			continueEdit: "用自然语言补充修改要求，发回原会话继续编辑…",
			continueSubmit: "提交修改",
			quickRedoPage: "重做第 3 页",
			quickRestyle: "换一套配色与版式风格",
			quickShrink: "压缩到 7 页",
			quickRerender: "重新渲染并做验收",
			pathCopied: "产物路径已复制到剪贴板。",
			resultRegenSent: "已把重新生成指令送回会话，等待 Agent 补产物。",
			// ── 壳层接线（Plan 2b Task 6）：待办提示行 + 打开任务失败横幅 ──
			attentionHint: "有 {count} 个任务等你处理，点击打开最近更新的",
			taskOpenFailed: "打开任务失败：任务不存在或已被删除",
		};

		var en = {
			nav: "Presentations",
			title: "Presentations",
			workTitle: "Presentation Studio",
			promptBase: "Make a presentation: {topic}",
			promptTpl: "Make it with template {tpl}: {topic}",
			promptPptx: "Make an editable PPTX deck: {topic}",
			promptHtml: "Make an HTML presentation: {topic}",
			workIntro: "Pick a workspace, format and template, write a one-line topic; place it into the composer, review in chat, then press Enter. Upload & manage templates in Settings → Presentations.",
			sendToChat: "Place in chat composer",
			quickTitle: "Quick start",
			quickHint: "Click one to fill the topic — stays fully editable",
			q1Label: "Quarterly",
			q1Text: "Turn this quarterly business data into a one-page executive deck: key metrics and takeaways",
			q2Label: "Project retro",
			q2Text: "A project retrospective deck: goals, outcomes vs. targets, issues, next steps",
			q3Label: "Launch",
			q3Text: "One page for the product launch: one-line pitch, three core features, call to action",
			q4Label: "Teaching deck",
			q4Text: "Turn these topics into a teaching deck: progressive depth with diagrams and exercises",
			q5Label: "Tech talk",
			q5Text: "A tech-sharing deck: background, solution architecture, measured results",
			q6Label: "Book notes",
			q6Text: "Turn these reading notes into a visual deck: core ideas, quotes, takeaways",
			q7Label: "Weekly",
			q7Text: "Summarize this week into a one-page report: done items, numbers, next week's plan",
			q8Label: "Data story",
			q8Text: "Turn this dataset into a visual story: trends, comparisons, anomalies",
			topicLabel: "Topic",
			topicPlaceholder: "e.g. turn this quarterly report into a one-page executive deck",
			formatLabel: "Format",
			formatFollow: "Follow preferences",
			templateLabel: "Template",
			templateNone: "No template",
			sentCopied: "Prompt copied and back in the chat — paste (⌘V / Ctrl+V) and press Enter to send",
			sentClipboard: "Prompt copied — paste it into the chat to send",
			sendNone: "Could not fill automatically; paste the prompt into the chat manually",
			topicRequired: "Write a one-line topic first",
			tplGalleryTitle: "Template gallery",
			tplGalleryHint: '"Use" selects it in the form above; upload/rename/delete live in Settings',
			useTpl: "Use",
			defaultTemplateLabel2: "default",
			intro: "Manage your PPT template library and generation preferences. After uploading and naming a template, just say \"Use template <name>\" in chat.",
			templates: "Templates",
			empty: "No templates yet. Upload a .pptx template and name it, then refer to it by name in chat.",
			upload: "Upload template",
			uploadHint: "Pick a .pptx file (100 MB limit by default, adjustable via cordis.yml patch), name it, then upload.",
			chooseFile: "Choose a .pptx file",
			nameLabel: "Template name",
			namePlaceholder: "e.g. Corporate brand template",
			descLabel: "Description (optional)",
			descPlaceholder: "Usage / style notes for the Agent",
			uploadBtn: "Upload",
			uploading: "Uploading…",
			defaultBadge: "default",
			setDefault: "Set default",
			unsetDefault: "Unset default",
			rename: "Rename",
			delete: "Delete",
			deleteConfirm: "Delete template \"{name}\"? This cannot be undone.",
			save: "Save",
			cancel: "Cancel",
			renameName: "Name",
			renameDesc: "Description",
			defaultTemplateLabel: "Current default template",
			none: "(not set)",
			prefs: "Generation preferences",
			prefsHint: "These preferences ship to the Agent together with the template library (ppts_templates tool) and shape every PPT run.",
			defaultFormat: "Default delivery format",
			defaultFormatAsk: "Ask every time",
			defaultFormatPptx: "Editable PPTX",
			defaultFormatHtml: "HTML presentation",
			renderReview: "Render review policy",
			reviewDeliverable: "Deliverable only (recommended)",
			reviewAlways: "Every round",
			reviewOff: "Off",
			outputDir: "Output directory",
			outputDirPlaceholder: "Empty = session working directory; ~ prefix allowed",
			styleNotes: "Style notes",
			styleNotesPlaceholder: "Global aesthetic baseline, e.g. prefer charts, restrained palette, titles within two lines…",
			refresh: "Refresh",
			saved: "Saved",
			uploaded: "Template uploaded: {name}",
			deleted: "Template deleted",
			defaultSet: "Default template set",
			defaultCleared: "Default template cleared",
			errPickFile: "Pick a .pptx file first",
			errPickName: "Template name is required",
			loading: "Loading…",
			wsLabel: "Workspace",
			wsFollow: "Follow current workspace",
			wsLoading: "Loading workspaces…",
			wsEmpty: "No workspaces yet — a session will be created on send",
			sentDraft: "Prompt placed in the chat composer — review and press Enter to send",
			loadFailed: "Load failed",
			retry: "Retry",
			// ── 面板壳 ──
			newTask: "New task",
			recent: "Recent tasks",
			panelTitle: "Presentations",
			newTaskTitle: "New presentation task",
			newTaskIntro: "Start from an idea, some text or local files — the Agent builds it for you.",
			// ── New task view ──
			startTask: "Start building",
			advancedOptions: "More options",
			configSummary: "Setup summary",
			formatPptxCard: "Editable PPTX",
			formatHtmlCard: "HTML presentation",
			formatPptxHint: "Delivers a .pptx you can keep editing and brand with templates",
			formatHtmlHint: "Single-file HTML deck that opens in any browser",
			taskStarted: "Task started — the Agent is building it now…",
			taskWaitingLaunch: "Task created (saved, waiting to launch)",
			taskCreateFailed: "Failed to create the task",
			materialAdd: "Add material",
			materialList: "Materials",
			materialRemove: "Remove",
			materialEmpty: "No material yet — images and docs help the Agent read your intent",
			tplChoose: "Choose template",
			tplFollow: "Follow default template",
			// ── Template picker (Task 4): builtin/user groups, source labels, none/follow ──
			tplPickerTitle: "Choose a template",
			tplFilterAll: "All",
			tplFilterBuiltin: "Built-in",
			tplFilterUser: "My templates",
			tplSearch: "Search name or description",
			tplBuiltin: "Built-in",
			tplUser: "My templates",
			tplNone: "No template",
			tplNoneHint: "Let the Agent design freely from your content (sends templateId: null)",
			tplFollowHint: "Follow the default template from Settings → Presentations (current default)",
			tplManage: "Manage my templates",
			tplUse: "Use",
			tplGroupEmpty: "No template in this group yet",
			audienceLabel: "Audience",
			audiencePlaceholder: "e.g. executives / customers / students",
			scenarioLabel: "Scenario",
			scenarioPlaceholder: "e.g. 15-min quarterly review",
			pageCountLabel: "Page count",
			pageCountPlaceholder: "e.g. 12",
			styleLabel: "Style",
			stylePlaceholder: "e.g. dark tech / minimal business",
			// ── Recent tasks view (Task 7): group titles + status badges + empty/error ──
			groupAttention: "Needs your action",
			groupActive: "In progress",
			groupFailed: "Failed",
			groupDone: "Recently completed",
			recentEmpty: "No tasks yet — start your first deck from New task",
			recentError: "Failed to load tasks",
			openTask: "Open task",
			stylesBlockedWarning: "The plugin stylesheet was blocked by the host; the panel is shown in a degraded but functional form. Please open DevTools and report the red console error to the plugin author.",
			taskStatusCreating: "Creating",
			taskStatusWaitingLaunch: "Waiting to start",
			taskStatusAnalyzing: "Analyzing content",
			taskStatusWaitingOutline: "Waiting for outline",
			taskStatusNeedsInput: "Needs your input",
			taskStatusBuilding: "Generating",
			taskStatusReviewing: "Reviewing",
			taskStatusCompleted: "Completed",
			taskStatusFailed: "Failed",
			taskStatusCancelled: "Cancelled",
			// ── Outline review view (Plan 2b Task 3): confirm gate + inline edit + agent revision ──
			outlineConfirm: "Confirm outline and continue",
			outlineSaving: "Saving…",
			outlineSave: "Save changes",
			outlineRevise: "Ask Agent to revise",
			outlineReviseEmpty: "Write a revision instruction first",
			outlineAdd: "+ Add page",
			pageNew: "New page",
			outlineCopiedHint: "Instruction copied — paste it into the Agent session and send",
			outlineSendFailed: "Could not deliver the instruction to the session; retry or restart the task",
			outlineResync: "The outline has a newer version — reloaded, please confirm again",
			outlineEmpty: "No outline yet, waiting for the Agent",
			backToRecent: "Back",
			outlineHint: "The Agent drafted {n} pages. Generation continues only after you confirm; edit the cards directly or ask the Agent to revise.",
			outlineDirty: "You have unsaved changes",
			outlineBackDirty: "Unsaved changes — going back will discard them.",
			outlineReviseDirty: "Unsaved changes: save first and let the Agent revise, or discard your edits.",
			outlineSaveAndRevise: "Save & revise",
			outlineDiscard: "Discard edits",
			outlineStillBack: "Still go back",
			outlineStayEditing: "Keep editing",
			outlinePageNo: "Page",
			pageTypeTitle: "Title page",
			pageTypeSummary: "Summary / conclusion",
			pageTypeKpi: "KPI data",
			pageTypeTrend: "Trend chart",
			pageTypeCompare: "Comparison",
			pageTypeTimeline: "Timeline",
			pageTypeFlow: "Flowchart",
			pageTypeCase: "Case study",
			pageTypePlan: "Action plan",
			pageTypeEnd: "Closing page",
			// ── 生成进度视图（Plan 2b Task 4）：与 zh 对齐的 18+2 键 ──
			stageReceive: "Brief received",
			stageAnalyze: "Analyzing content",
			stageOutline: "Generating outline",
			stageBuild: "Building pages",
			stagePackage: "Packaging & render",
			stageReview: "Final review",
			progressStageLine: "Stage {i}/{n} · {label}",
			waitingStage: "Waiting for the Agent to report progress…",
			openSession: "Open agent session",
			cancelTask: "Cancel task",
			launchRecovery: "The task is saved but the Agent session never launched (delivery may have failed). Retry launch or cancel.",
			launchRetry: "Retry launch",
			needsInput: "The Agent needs more information",
			inputAnswer: "Write your answer — the Agent continues from it…",
			inputSend: "Send the answer",
			errorRecovery: "Generation failed at the last stage",
			failRetry: "Retry current stage",
			failBackOutline: "Back to outline",
			terminalNote: "Task cancelled (read-only). Go back to recent tasks to start over.",
			continueSent: "Continue instruction re-sent to the session; waiting for the Agent.",
			// ── 结果视图（Plan 2b Task 5）：与 zh 对齐的 15 键（摘要按形态分两键）──
			resultSummaryPptx: "Completed · {pages} pages · editable PPTX",
			resultSummaryHtml: "Completed · {pages} pages · HTML presentation",
			artifactReady: "Ready",
			artifactMissing: "File missing (can regenerate)",
			artifactRegen: "Regenerate",
			copyPath: "Copy path",
			artifactsEmpty: "No artifacts registered for this task yet.",
			continueEdit: "Describe more edits in plain language — sent back to the agent session…",
			continueSubmit: "Submit edit",
			quickRedoPage: "Redo page 3",
			quickRestyle: "Restyle colors & layout",
			quickShrink: "Shrink to 7 pages",
			quickRerender: "Re-render & review",
			pathCopied: "Artifact path copied to clipboard.",
			resultRegenSent: "Regenerate instruction re-sent to the session; waiting for the Agent.",
			// Shell wiring (Plan 2b Task 6): attention hint line + open-task failure banner
			attentionHint: "{count} task(s) need your attention — click to open the most recently updated",
			taskOpenFailed: "Failed to open the task: it no longer exists or was deleted",
		};

		/** 极简插值："删除模板「{name}」" → fill(tpl, { name: x }) */
		function fill(template, params) {
			return String(template).replace(/\{(\w+)\}/g, function (m, key) {
				return params && Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : m;
			});
		}

		/* ── host API（POST JSON，{ok,value}/{ok,error} 信封）── */

		function api(method, body) {
			return fetch(API + "/" + method, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body || {}),
			}).then(function (response) {
				return response.text().then(function (text) {
					var data;
					try { data = text ? JSON.parse(text) : {}; }
					catch (e) { throw new Error("bad JSON (" + response.status + ")"); }
					if (data && data.ok) return data.value;
					throw new Error(String((data && data.error && data.error.message) || ("HTTP " + response.status)));
				});
			});
		}

		/**
		 * 素材上传（Task 5）：原始流式 POST 到插件自有路由（与 host 的
		 * /super-ppts/tasks/upload 一致），body 直接是 File/Blob（不套 JSON 信封）。
		 * 返回宿主登记的素材信息 { name, size, path }；失败抛出带宿主 message 的错误
		 * （不静默吞掉——上传失败必须让调用方看见原因）。
		 * 注意：本函数只登记到**已有任务**；任务尚未创建时素材先留在视图的本地
		 * 待上传队列（见 makeNewTaskView），任务落盘后由 Task 6 的编排逐项调用。
		 */
		function uploadMaterial(taskId, file) {
			var query = "?taskId=" + encodeURIComponent(taskId) + "&name=" + encodeURIComponent(file && file.name ? file.name : "material");
			return fetch("/super-ppts/tasks/upload" + query, {
				method: "POST",
				headers: { "content-type": "application/octet-stream" },
				body: file,
			}).then(function (response) {
				return response.text().then(function (text) {
					var payload;
					try { payload = text ? JSON.parse(text) : {}; }
					catch (error) { throw new Error("bad JSON (" + response.status + ")"); }
					if (payload && payload.ok) return payload.value;
					throw new Error(String((payload && payload.error && payload.error.message) || ("HTTP " + response.status)));
				});
			});
		}

		/* ── 会话桥 v3（Task 6：直接开始制作）────────────────── */

		/** 切回会话视图：面板激活时输入框在对话页，先离开面板再写草稿。 */
		function backToChat(ctx) {
			try {
				if (ctx && ctx.layout && typeof ctx.layout.selectPanel === "function") ctx.layout.selectPanel(null);
			} catch (layoutError) { /* 服务不可达:留在当前面板 */ }
		}

		/**
		 * v1 剪贴板降级桥（模块级形态）：复制到剪贴板 + 切回会话视图，用户
		 * 粘贴(⌘V/Ctrl+V)后回车即发。sendToChatV3 以本函数为降级路径——
		 * v3 是模块级函数，拿不到 apply 的闭包 ctx，因此 ctx 作为显式入参。
		 * 返回 'copied' | 'none'（剪贴板不可用即 'none'，绝不假装成功）。
		 */
		function clipboardFallback(ctx, text) {
			var write = Promise.resolve("none");
			try {
				if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
					write = navigator.clipboard.writeText(text)
						.then(function () { return "copied"; })
						.catch(function () { return "none"; });
				}
			} catch (error) { /* 剪贴板不可用 */ }
			return Promise.resolve(write).then(function (result) {
				if (result !== "copied") return "none";
				try {
					var sessions = ctx && ctx.sessions;
					var current = sessions && sessions.list && typeof sessions.list.getSnapshot === "function"
						? sessions.list.getSnapshot().current : undefined;
					if (!current && sessions && typeof sessions.create === "function") {
						sessions.create().then(function (id) {
							try { if (typeof sessions.open === "function") sessions.open(id); } catch (openError) { /* 已选中 */ }
						}).catch(function () { /* 无落点：用户手动粘贴 */ });
					}
					backToChat(ctx);
				} catch (bridgeError) {
					console.warn("dsh-super-ppts clipboardFallback 会话桥异常:", bridgeError && bridgeError.message);
				}
				return "copied";
			});
		}

		/**
		 * 会话桥 v3（Task 6 核心技术点）：定位会话 → 写草稿 → **自动提交**，
		 * 用户点「开始制作」后任务立即启动，无需回聊天窗口按回车。与历史草稿桥
		 * v2（只 setDraft → 'draft'，随旧工作台一并移除）的差别就是最后这一步
		 * `submit()`；v3 是模块级函数（ctx 显式传入），供 createTaskAndStart 与
		 * 冒烟 __testHooks 直接调用。
		 *
		 * 1) 会话落点（沿用 v2 逻辑）：同工作区 → 当前会话；跨工作区/无会话 →
		 *    uiWorkspace.openWorkspace(ws) 后取当前会话；工作区列表空 →
		 *    sessions.create() + open；定位失败 → 降级。
		 * 2) sessions.scope(id).conversation.input.for(actx).setDraft(text)
		 * 3) 同一 shell 上 submit()。**submit 不存在或任一步抛错 → 不得假装提交
		 *    成功**：一律降级剪贴板桥，绝不返回 'submitted'。
		 * 返回 'submitted'（已写入并提交）/ 'copied'（降级剪贴板）/ 'none'（全失败）。
		 */
		function sendToChatV3(ctx, text, workspaceId) {
			var fallback = function () { return clipboardFallback(ctx, text); };
			var sessions = ctx && ctx.sessions;
			var plan;
			try {
				if (!sessions || !sessions.list || typeof sessions.list.getSnapshot !== "function") {
					return Promise.resolve(fallback());
				}
				var current = sessions.list.getSnapshot().current;
				var wsList = (ctx.workspaces && ctx.workspaces.list && typeof ctx.workspaces.list.getSnapshot === "function")
					? ctx.workspaces.list.getSnapshot() : null;
				var wsOfCurrent = null;
				if (current && wsList && wsList.items) {
					for (var i = 0; i < wsList.items.length; i += 1) {
						var ids = wsList.items[i].sessionIds || [];
						if (ids.indexOf(current) !== -1) { wsOfCurrent = wsList.items[i].workspaceId; break; }
					}
				}
				var wantsSwitch = workspaceId && wsOfCurrent !== workspaceId;
				if (current && !wantsSwitch) plan = Promise.resolve(current);
				else if (ctx.uiWorkspace && typeof ctx.uiWorkspace.openWorkspace === "function"
					&& wsList && wsList.items && wsList.items.length > 0) {
					var target = workspaceId || wsOfCurrent || wsList.items[0].workspaceId;
					plan = Promise.resolve(ctx.uiWorkspace.openWorkspace(target)).then(function () {
						return sessions.list.getSnapshot().current || null;
					});
				} else if (typeof sessions.create === "function") {
					plan = sessions.create().then(function (id) {
						try { if (typeof sessions.open === "function") sessions.open(id); } catch (openError) { /* 已选中 */ }
						backToChat(ctx);
						return id;
					});
				} else plan = Promise.resolve(null);
			} catch (bridgeError) {
				console.warn("dsh-super-ppts sendToChatV3 定位会话异常:", bridgeError && bridgeError.message);
				return Promise.resolve(fallback());
			}
			return Promise.resolve(plan).then(function (sessionId) {
				if (sessionId === null || sessionId === undefined) return fallback();
				try {
					backToChat(ctx);
					var actx = sessions.scope(sessionId);
					var conversation = actx && actx.conversation;
					var input = conversation && conversation.input;
					var shell = input && typeof input.for === "function" ? input.for(actx) : null;
					// 顺序不可颠倒：先写草稿，再提交同一 shell。
					if (shell && typeof shell.setDraft === "function") {
						shell.setDraft(text);
						// v3 的关键一步：Write 之后必须 Submit（否则退化成 v2，用户还得回车）。
						if (typeof shell.submit === "function") {
							shell.submit();
							return "submitted";
						}
						// 宿主输入面没有 submit（≤旧宿主）→ 不假装提交成功，降级剪贴板。
						console.warn("dsh-super-ppts sendToChatV3：宿主输入面无 submit，降级剪贴板");
					}
				} catch (fillError) { /* 服务不可达：降级剪贴板 */ }
				return fallback();
			}, function () { return fallback(); });
		}

		/* ── 样式（一次性注入，sp- 前缀避免冲突）──────────────── */

		// 设置页导航字形：Lucide「presentation」（幕布 + 支架），经 currentColor
		// mask 跟随导航 hover/active 配色，维持壳层 16px 图标节奏。
		var NAV_MARKER = "data-dsh-super-ppts-settings-nav";
		var NAV_ICON_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 3h20'/%3E%3Cpath d='M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3'/%3E%3Cpath d='m7 21 5-5 5 5'/%3E%3C/svg%3E";

		var CSS = [
			".sp-root{display:flex;flex-direction:column;gap:20px;max-width:760px;color:inherit;font-size:13px;line-height:1.5;}",
			".sp-intro{opacity:.72;margin:0;}",
			".sp-card{border:1px solid var(--sl-color-neutral-300,#333);border-radius:10px;padding:14px 16px;}",
			".sp-card h3{margin:0 0 4px;font-size:14px;}",
			".sp-hint{opacity:.6;margin:0 0 10px;font-size:12px;}",
			".sp-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}",
			".sp-tpl{padding:10px 0;border-top:1px solid var(--sl-color-neutral-300,#2a2a2a);}",
			".sp-tpl:first-of-type{border-top:none;}",
			".sp-tpl-name{font-weight:600;}",
			".sp-tpl-desc{opacity:.7;font-size:12px;margin-top:2px;}",
			".sp-tpl-meta{opacity:.5;font-size:11px;display:flex;gap:12px;flex-wrap:wrap;}",
			".sp-badge{background:#2f6f4f;color:#fff;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:600;}",
			".sp-actions{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;}",
			".sp-btn{border:1px solid var(--sl-color-neutral-400,#555);background:transparent;color:inherit;border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;}",
			".sp-btn:hover{border-color:var(--sl-color-primary-500,#7aa2f7);color:var(--sl-color-primary-500,#7aa2f7);}",
			".sp-btn[disabled]{opacity:.45;cursor:not-allowed;}",
			".sp-btn-primary{background:var(--sl-color-primary-600,#3b5fd9);border-color:var(--sl-color-primary-600,#3b5fd9);color:#fff;}",
			".sp-btn-primary:hover{background:var(--sl-color-primary-500,#4468e8);border-color:var(--sl-color-primary-500,#4468e8);color:#fff;}",
			".sp-btn-danger:hover{border-color:#e5484d;color:#e5484d;}",
			".sp-field{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;}",
			".sp-field label{font-size:12px;opacity:.75;}",
			".sp-input,.sp-select,.sp-textarea{border:1px solid var(--sl-color-neutral-400,#555);border-radius:6px;background:transparent;color:inherit;padding:5px 8px;font-size:13px;}",
			".sp-textarea{resize:vertical;min-height:56px;font-family:inherit;}",
			".sp-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px;}",
			".sp-msg{border-radius:6px;padding:6px 10px;font-size:12px;}",
			".sp-msg-ok{background:rgba(63,167,106,.15);color:#3fa76a;}",
			".sp-msg-err{background:rgba(229,72,77,.15);color:#e5484d;}",
			".sp-edit{border:1px dashed var(--sl-color-neutral-400,#555);border-radius:8px;padding:10px;margin-top:8px;}",
			".sp-panel{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:12px;background:var(--dsw-alias-button-elevated-fill,transparent);}",
			".sp-panel-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}",
			".sp-panel-head h3{margin:0;font-size:13px;font-weight:600;}",
			".sp-grid3{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:12px;}",
			".sp-chip-row{display:flex;flex-wrap:wrap;gap:8px;}",
			".sp-chip{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:999px;background:transparent;color:inherit;padding:5px 14px;font-size:12px;cursor:pointer;transition:background .15s,border-color .15s;}",
			".sp-chip:hover{background:var(--dsw-alias-interactive-bg-hover,var(--sl-color-neutral-300,#333));}",
			".sp-chip:active{background:var(--dsw-alias-interactive-bg-active,var(--sl-color-neutral-400,#555));}",
			".sp-state{display:inline-flex;align-items:center;gap:6px;font-size:12px;opacity:.75;}",
			".sp-tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;}",
			".sp-tpl-card{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:4px;transition:border-color .15s;}",
			".sp-tpl-card:hover{border-color:var(--dsw-alias-interactive-bg-hover,var(--sl-color-primary-500,#3b5fd9));}",
			".sp-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:22px 8px;opacity:.68;text-align:center;font-size:12px;}",
			".sp-empty-icon{width:28px;height:28px;opacity:.55;background:currentColor;"
				+ "-webkit-mask:url(\"" + NAV_ICON_SVG + "\") center / contain no-repeat;"
				+ "mask:url(\"" + NAV_ICON_SVG + "\") center / contain no-repeat;}",
			// ── 任务面板（Task 3–8）：宿主 main 区里的**单列**工作区 ──────────
			// 宿主边界（规格「宿主边界与布局约束」）：根容器 .sp-panels 是普通块，
			// 不设 width / height / overflow——宽度、高度与滚动全部归宿主；全文件
			// 不使用视口单位（vw / vh），也不使用固定定位（冒烟有断言）；颜色与
			// 边框统一走宿主 token（var(--dsw-alias-*, 回退值)），与既有 .sp-panel 一致。
			".sp-panels{display:flex;flex-direction:column;gap:16px;font-size:13px;line-height:1.5;color:inherit;box-sizing:border-box;max-width:960px;width:100%;margin:0 auto;}",
			".sp-styles-warning{border:1px solid #e5484d;background:rgba(229,72,77,.08);color:#e5484d;border-radius:8px;padding:8px 12px;font-size:12px;line-height:1.5;}",
			".sp-panels-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));}",
			".sp-panels-title{margin:0;font-size:16px;font-weight:600;padding-left:10px;border-left:3px solid var(--sl-color-primary-500,#3b5fd9);}",
			".sp-tabs{display:flex;gap:6px;margin-left:auto;}",
			".sp-tab{border:1px solid transparent;border-radius:999px;background:transparent;color:inherit;padding:4px 14px;font-size:12px;cursor:pointer;transition:background .15s,border-color .15s,color .15s;}",
			".sp-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(59,95,217,.08));color:inherit;}",
			".sp-tab-active,.sp-tab-active:hover{border-color:var(--sl-color-primary-600,#3b5fd9);background:var(--sl-color-primary-600,#3b5fd9);color:#fff;font-weight:600;}",
			// 视图根：两个视图都是单列纵向流（视图自持类名，壳层不下发 className）
			".sp-view-new-task,.sp-view-recent{display:flex;flex-direction:column;gap:14px;}",
			// 新建任务视图：主题 → 快速开始 → 交付形态 → 更多选项 → 摘要 → 素材
			".sp-new-title{margin:0;font-size:15px;font-weight:600;}",
			".sp-topic-input{min-height:76px;}",
			".sp-quick-row{display:flex;flex-wrap:wrap;gap:8px;}",
			".sp-quick-chip{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:999px;background:transparent;color:inherit;padding:4px 12px;font-size:12px;cursor:pointer;transition:background .15s,border-color .15s;}",
			".sp-quick-chip:hover{border-color:var(--sl-color-primary-500,#3b5fd9);color:var(--sl-color-primary-600,#3b5fd9);background:rgba(59,95,217,.06);}",
			".sp-formats{display:grid;grid-template-columns:1fr 1fr;gap:10px;}",
			".sp-format-card{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:10px;padding:12px 14px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:4px;transition:border-color .15s,background .15s;}",
			".sp-format-card:hover{border-color:var(--dsw-alias-interactive-bg-hover,var(--sl-color-primary-500,#3b5fd9));}",
			".sp-format-card-active{border-color:var(--sl-color-primary-500,#3b5fd9);background:rgba(59,95,217,.08);box-shadow:inset 0 0 0 1px var(--sl-color-primary-500,#3b5fd9);}",
			".sp-fmt-title{font-size:13px;font-weight:600;}",
			".sp-fmt-hint{font-size:12px;opacity:.68;line-height:1.45;}",
			".sp-advanced-toggle{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:8px;background:transparent;color:inherit;padding:6px 12px;font-size:12px;cursor:pointer;text-align:left;}",
			".sp-advanced-body{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:10px;}",
			".sp-config-summary{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:10px;background:var(--dsw-alias-button-elevated-fill,transparent);}",
			".sp-summary-title{font-size:12px;font-weight:600;opacity:.75;}",
			".sp-config-summary-line{display:flex;flex-wrap:wrap;gap:10px;}",
			".sp-summary-item{font-size:12px;opacity:.85;}",
			".sp-config-summary-extra{font-size:12px;opacity:.75;line-height:1.5;}",
			".sp-start{margin-left:auto;}",
			".sp-material-add{align-self:flex-start;}",
			".sp-material-input{display:none;}",
			".sp-material-list{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none;}",
			".sp-material-item{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 10px;border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:8px;}",
			".sp-material-name{font-size:12px;font-weight:600;}",
			".sp-material-meta{font-size:11px;opacity:.6;}",
			".sp-material-remove{margin-left:auto;}",
			// 模板选择器：来源分组靠文本标签（sp-tpl-source）区分，左侧描边只做辅助
			".sp-tpl-open{align-self:flex-start;}",
			".sp-tpl-picker{display:flex;flex-direction:column;gap:12px;padding:12px;border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:10px;}",
			".sp-tpl-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}",
			".sp-tpl-title{font-size:13px;font-weight:600;}",
			".sp-tpl-close{margin-left:auto;}",
			".sp-tpl-filter{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:999px;background:transparent;color:inherit;padding:3px 12px;font-size:12px;cursor:pointer;}",
			".sp-tpl-search{flex:1 1 160px;min-width:120px;}",
			".sp-tpl-count{font-size:11px;opacity:.6;}",
			".sp-tpl-group{display:flex;flex-direction:column;gap:8px;}",
			".sp-tpl-group-head{font-size:12px;font-weight:600;opacity:.75;}",
			".sp-tpl-group-builtin{border-left:2px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));padding-left:10px;}",
			".sp-tpl-group-user{border-left:2px solid var(--dsw-alias-interactive-bg-active,var(--sl-color-neutral-400,#555));padding-left:10px;}",
			".sp-tpl-body{display:flex;flex-direction:column;gap:4px;}",
			".sp-tpl-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}",
			".sp-tpl-thumb{width:100%;height:44px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover,var(--sl-color-neutral-300,#333));}",
			".sp-tpl-scenario{font-size:11px;opacity:.6;}",
			".sp-tpl-tags{display:flex;flex-wrap:wrap;gap:4px;}",
			".sp-tpl-tag{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:999px;padding:0 8px;font-size:11px;opacity:.75;}",
			".sp-tpl-source{font-size:11px;font-weight:600;opacity:.8;}",
			".sp-tpl-default{align-self:flex-start;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:600;background:var(--dsw-alias-interactive-bg-active,var(--sl-color-primary-600,#3b5fd9));color:var(--dsw-alias-label-primary-inverted,#fff);}",
			".sp-tpl-use{align-self:flex-start;}",
			".sp-tpl-none,.sp-tpl-follow,.sp-tpl-manage{align-self:flex-start;}",
			".sp-tpl-foot{display:flex;gap:8px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));}",
			// 最近任务：四组容器同形（空分组不渲染，故无需“空壳”样式）
			".sp-group-attention,.sp-group-active,.sp-group-failed,.sp-group-done{display:flex;flex-direction:column;gap:8px;}",
			".sp-task-group-title{margin:0;font-size:12px;font-weight:600;opacity:.75;}",
			".sp-group-attention .sp-task-group-title{color:var(--dsw-alias-interactive-bg-hover,var(--sl-color-primary-500,#3b5fd9));opacity:1;}",
			".sp-task-list{display:flex;flex-direction:column;gap:6px;}",
			".sp-task-item{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:10px;transition:border-color .15s;}",
			".sp-task-item:hover{border-color:var(--dsw-alias-interactive-bg-hover,var(--sl-color-primary-500,#3b5fd9));}",
			".sp-task-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;flex:1 1 200px;min-width:0;}",
			".sp-task-title{font-size:13px;font-weight:600;}",
			".sp-task-status{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:999px;padding:0 8px;font-size:11px;opacity:.85;white-space:nowrap;}",
			".sp-task-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;opacity:.6;}",
			".sp-work-name{font-weight:600;}",
			".sp-task-time{white-space:nowrap;}",
			".sp-task-open{margin-left:auto;}",
			".sp-recent-empty{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:22px 8px;opacity:.72;font-size:12px;}",
			// 任务详情打开失败横幅（Plan 2b Task 6）与列表错误态同形（复用 sp-recent-error 规则）
			".sp-recent-error,.sp-task-error{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:16px 12px;border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:10px;}",
			".sp-recent-retry{align-self:flex-start;}",
			// 壳层待办提示行（Plan 2b Task 6）：attention 组条数胶囊按钮，点击打开最近更新的一条
			".sp-attention-hint{align-self:flex-start;border:1px solid var(--dsw-alias-interactive-bg-active,var(--sl-color-primary-500,#3b5fd9));border-radius:999px;background:transparent;color:inherit;padding:4px 14px;font-size:12px;cursor:pointer;}",
			".sp-attention-hint:hover{background:var(--dsw-alias-interactive-bg-hover,var(--sl-color-primary-600,#3b5fd9));color:var(--dsw-alias-label-primary-inverted,#fff);}",
			// 大纲确认视图（Plan 2b Task 3）：页卡片 + 未保存横幅 + 自然语言修改区。
			// 契约类名需**单独成立**（冒烟按全等匹配），不与 sp-btn 等复合拼接；
			// 文案键类（confirm/add/空态等）以浏览器默认 + 本段规则渲染，Step 7 清单为准。
			".sp-view-outline{display:flex;flex-direction:column;gap:12px;}",
			".sp-back{align-self:flex-start;border:none;background:transparent;color:inherit;opacity:.7;cursor:pointer;font-size:12px;padding:2px 0;}",
			".sp-back:hover{opacity:1;}",
			".sp-outline-pages{display:flex;flex-direction:column;gap:10px;}",
			".sp-outline-page{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;}",
			".sp-page-index{font-size:11px;font-weight:600;opacity:.55;}",
			".sp-page-ops{display:flex;gap:6px;flex-wrap:wrap;}",
			".sp-outline-dirty-banner,.sp-revise-dirty-confirm,.sp-discard-confirm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px dashed var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:8px;padding:8px 10px;font-size:12px;}",
			".sp-outline-revise{display:flex;flex-direction:column;gap:8px;border:1px dashed var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:8px;padding:10px;}",
			".sp-outline-resync{color:#3fa76a;font-size:12px;}",
			// 生成进度视图（Plan 2b Task 4）：六阶段时间线 + 恢复变体 + 只读终态。
			// 契约类名单独成立（冒烟 token 匹配），操作按钮不与 sp-btn 拼接；
			// 无视口单位 / 无 fixed，色与边框走宿主 token。
			".sp-view-progress{display:flex;flex-direction:column;gap:12px;}",
			".sp-progress-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}",
			".sp-progress-line{font-size:13px;font-weight:600;}",
			".sp-progress-detail{font-size:12px;opacity:.75;}",
			".sp-steps{display:flex;flex-wrap:wrap;gap:8px;}",
			".sp-step{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:999px;padding:4px 12px;font-size:12px;opacity:.6;}",
			".sp-step-idx{width:16px;height:16px;border-radius:999px;border:1px solid currentColor;display:inline-flex;align-items:center;justify-content:center;font-size:10px;opacity:.8;}",
			".sp-step-done{opacity:1;border-color:var(--sl-color-primary-500,#3b5fd9);color:var(--sl-color-primary-600,#3b5fd9);}",
			".sp-step-done .sp-step-idx{background:var(--sl-color-primary-500,#3b5fd9);border-color:var(--sl-color-primary-500,#3b5fd9);color:#fff;}",
			".sp-step-active{border-color:var(--sl-color-primary-600,#3b5fd9);background:var(--sl-color-primary-600,#3b5fd9);color:#fff;font-weight:600;opacity:1;}",
			".sp-step-pending{opacity:.55;}",
			".sp-progress-events{display:flex;flex-direction:column;gap:4px;font-size:12px;opacity:.8;}",
			".sp-event{border-left:2px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));padding-left:8px;}",
			".sp-launch-recovery,.sp-needs-input,.sp-error-recovery{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:10px;padding:12px 14px;font-size:12px;}",
			".sp-launch-recovery{border-style:dashed;}",
			".sp-needs-input{border-style:dashed;}",
			".sp-error-recovery{border-color:#e5484d;}",
			".sp-input-answer{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:8px;background:transparent;color:inherit;padding:6px 8px;font-size:12px;resize:vertical;min-height:52px;font-family:inherit;}",
			".sp-launch-retry,.sp-launch-cancel,.sp-needs-input-send,.sp-fail-retry,.sp-fail-back-outline,.sp-cancel,.sp-open-session{align-self:flex-start;border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));background:transparent;color:inherit;border-radius:8px;padding:5px 14px;font-size:12px;cursor:pointer;}",
			".sp-launch-retry:hover,.sp-open-session:hover{border-color:var(--dsw-alias-interactive-bg-active,var(--sl-color-primary-500,#3b5fd9));color:var(--dsw-alias-interactive-bg-active,var(--sl-color-primary-500,#3b5fd9));}",
			".sp-cancel:hover,.sp-launch-cancel:hover{border-color:#e5484d;color:#e5484d;}",
			".sp-launch-retry[disabled],.sp-launch-cancel[disabled],.sp-needs-input-send[disabled],.sp-fail-retry[disabled],.sp-fail-back-outline[disabled],.sp-cancel[disabled],.sp-input-answer[disabled]{opacity:.45;cursor:not-allowed;}",
			".sp-terminal-note{font-size:12px;opacity:.7;border:1px dashed var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:10px;padding:10px 12px;}",
			// 结果视图（Plan 2b Task 5）：产物条目（D3：无下载路由，操作是复制
			// 路径/重新生成）+ 继续修改区。契约类名各自独立成立（冒烟按 token
			// 全等筛条目、正则边界验样式），无视口单位 / 无 fixed，色与边框走宿主 token。
			".sp-view-result{display:flex;flex-direction:column;gap:12px;}",
			".sp-result-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}",
			".sp-result-summary{font-size:13px;font-weight:600;}",
			".sp-artifacts{display:flex;flex-direction:column;gap:8px;}",
			".sp-artifact{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:10px;padding:8px 12px;font-size:12px;}",
			".sp-artifact-type{font-weight:700;font-size:11px;letter-spacing:.04em;color:var(--sl-color-primary-600,#3b5fd9);border:1px solid var(--sl-color-primary-500,#3b5fd9);border-radius:6px;padding:1px 6px;}",
			".sp-artifact-status{opacity:.75;}",
			".sp-artifact-path{flex:1;min-width:160px;overflow-wrap:anywhere;opacity:.85;}",
			".sp-artifact-copy,.sp-artifact-regen{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));background:transparent;color:inherit;border-radius:8px;padding:3px 10px;font-size:12px;cursor:pointer;}",
			".sp-artifact-copy:hover,.sp-artifact-regen:hover{border-color:var(--dsw-alias-interactive-bg-active,var(--sl-color-primary-500,#3b5fd9));color:var(--dsw-alias-interactive-bg-active,var(--sl-color-primary-500,#3b5fd9));}",
			".sp-artifact-copy[disabled],.sp-artifact-regen[disabled]{opacity:.45;cursor:not-allowed;}",
			".sp-artifacts-empty{font-size:12px;opacity:.7;border:1px dashed var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:10px;padding:10px 12px;}",
			".sp-result-continue{display:flex;flex-direction:column;gap:8px;border:1px dashed var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:10px;padding:10px;}",
			".sp-result-continue-text{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:8px;background:transparent;color:inherit;padding:6px 8px;font-size:12px;resize:vertical;min-height:52px;font-family:inherit;}",
			".sp-result-submit{align-self:flex-start;border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));background:transparent;color:inherit;border-radius:8px;padding:5px 14px;font-size:12px;cursor:pointer;}",
			".sp-result-submit:hover{border-color:#3fa76a;color:#3fa76a;}",
			".sp-result-quick{display:flex;flex-wrap:wrap;gap:6px;}",
			".sp-result-quick-chip{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));background:transparent;color:inherit;border-radius:999px;padding:3px 12px;font-size:11px;cursor:pointer;}",
			".sp-result-quick-chip:hover,.sp-result-quick-chip[disabled]{border-color:var(--dsw-alias-interactive-bg-active,var(--sl-color-primary-500,#3b5fd9));}",
			".sp-result-continue-text[disabled],.sp-result-submit[disabled],.sp-result-quick-chip[disabled]{opacity:.45;cursor:not-allowed;}",
			// 窄窗口：交付形态卡片与模板卡片改单列，条目按钮回到行首（保持单列可读）
			"@media (max-width:640px){.sp-formats{grid-template-columns:1fr;}.sp-tpl-picker .sp-tpl-grid{grid-template-columns:1fr;}"
				+ ".sp-task-item{align-items:flex-start;}.sp-task-open{margin-left:0;}.sp-tabs{margin-left:0;}}",
			"@media (max-width:640px){.sp-tpl-grid{grid-template-columns:1fr;}}",
			"@media (max-width:640px){.sp-grid{grid-template-columns:1fr;}}",
			// 设置页导航图标替换：DSH 0.1.x 的 settings.section 契约只投影
			// id/order/label，壳层对外部分区一律渲染通用齿轮。这里只对本插件
			// 被标记的行生效：隐藏齿轮 SVG，用 ::before mask 画幕布字形。
			"[" + NAV_MARKER + "] > svg:first-child{display:none;}",
			"[" + NAV_MARKER + "]::before{content:'';flex:none;width:16px;height:16px;background:currentColor;"
				+ "-webkit-mask:url(\"" + NAV_ICON_SVG + "\") center / contain no-repeat;"
				+ "mask:url(\"" + NAV_ICON_SVG + "\") center / contain no-repeat;}",
		].join("\n");

		/* ── 样式注入（1.4.1 加固）──────────────────────────────────────
		 * 真实宿主里发现单通道 <style> 注入可能被静默吞掉（面板渲染出无样式
		 * 裸控件）。三条独立通道 + 注入自检，任一生效即可、全失败必须可见：
		 *  A) adoptedStyleSheets（构造样式表）：Chromium 下不受 style-src
		 *     限制，是 CSP 严格宿主里唯一可靠的程序化注入方式；
		 *  B) <style id nonce>：复制宿主 csp-nonce meta 的 nonce（若存在）；
		 *  C) <style id>（无 nonce）：无 CSP / 允许 unsafe-inline 的宿主兜底。
		 * 自检：B/C 通道注入的标签若被 CSP 拦截，其 cssRules 为 0（Chromium
		 * 行为）；A 通道以 replaceSync 成功为准。全部失效 → STYLES_BLOCKED=true，
		 * 面板顶部渲染红条 + console.error——把静默故障变成可反馈的显性信息。 */
		var STYLES_MARKER = "dsh-super-ppts-styles";
		var STYLES_BLOCKED = false;

		function stylesBlocked() { return STYLES_BLOCKED; }

		function ensureStyles() {
			if (typeof document === "undefined" || !document) return;
			var adoptedOk = false;
			try {
				if (typeof CSSStyleSheet === "function"
					&& typeof CSSStyleSheet.prototype.replaceSync === "function"
					&& Array.isArray(document.adoptedStyleSheets)) {
					var hadAdopted = document.adoptedStyleSheets.some(function (sheet) {
						return sheet && sheet.__dshSuperPpts === true;
					});
					if (!hadAdopted) {
						var sheet = new CSSStyleSheet();
						sheet.replaceSync(CSS);
						sheet.__dshSuperPpts = true;
						document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
						adoptedOk = true;
					} else adoptedOk = true;
				}
			} catch (adoptError) { /* 老宿主无构造式 API：走 B/C 标签通道 */ }
			var tag = typeof document.getElementById === "function" ? document.getElementById(STYLES_MARKER) : null;
			if (!tag && typeof document.createElement === "function" && document.head) {
				tag = document.createElement("style");
				tag.id = STYLES_MARKER;
				try {
					var nonceMeta = typeof document.querySelector === "function"
						? document.querySelector("meta[property=csp-nonce]") : null;
					var nonce = nonceMeta && (nonceMeta.nonce || nonceMeta.getAttribute("nonce"));
					if (nonce) tag.setAttribute("nonce", nonce);
				} catch (nonceError) { /* 读不到 nonce：交给 C 通道语义 */ }
				tag.textContent = CSS;
				document.head.appendChild(tag);
			}
			// 自检：adopted 未成功时，检查标签通道的规则是否真的进了 CSSOM；
			// adopted 成功（或本次评估通过）即视为当前可用——flag 表达「现状」而非「曾经」。
			if (adoptedOk) {
				STYLES_BLOCKED = false;
			} else {
				try {
					var sheets = document.styleSheets || [];
					var ours = null;
					for (var i = 0; i < sheets.length; i += 1) {
						if (sheets[i] && (sheets[i].ownerNode === tag
							|| (tag && sheets[i] === tag.sheet)
							|| (sheets[i].ownerNode && sheets[i].ownerNode.id === STYLES_MARKER))) { ours = sheets[i]; }
					}
					if (ours && Array.prototype.slice.call(ours.cssRules || []).length === 0) {
						STYLES_BLOCKED = true;
						console.error("[dsh-super-ppts] 插件样式表被宿主拦截（cssRules=0，疑似 CSP style-src）——面板将以降级形态显示。");
					}
				} catch (readError) { /* cssRules 不可读按未拦截处理，避免误报 */ }
			}
		}

		/* ── 设置页导航图标：给本插件的导航行打标记 ────────────
		 * 宿主 0.1.x 不支持分区级 icon，挂载后按本地化文案「演示文稿」
		 * 找到自己的导航按钮并打 NAV_MARKER，配合 CSS 把齿轮换成幕布字形。
		 * MutationObserver 跟随语言切换/弹窗重开；disposer 清除全部标记，
		 * HMR 与插件停用时无残留。环境缺 DOM/Observer 时返回空 disposer。 */
		function registerSettingsNavIcon(label) {
			if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
				return function () {};
			}
			var disposed = false;
			function sync() {
				if (disposed) return;
				var current = "";
				try { current = String(label() || "").trim(); } catch (e) { current = ""; }
				var buttons = document.querySelectorAll('[role="dialog"] nav button');
				for (var i = 0; i < buttons.length; i++) {
					var button = buttons[i];
					var text = (button.textContent || "").trim();
					if (current.length > 0 && text === current) button.setAttribute(NAV_MARKER, "");
					else button.removeAttribute(NAV_MARKER);
				}
			}
			sync();
			var observer = new MutationObserver(sync);
			observer.observe(document.body, { childList: true, subtree: true, characterData: true });
			return function () {
				disposed = true;
				observer.disconnect();
				var marked = document.querySelectorAll("[" + NAV_MARKER + "]");
				for (var i = 0; i < marked.length; i++) marked[i].removeAttribute(NAV_MARKER);
			};
		}

		/* ── 工具 ───────────────────────────────────────────── */

		function formatSize(bytes) {
			if (!Number.isFinite(bytes) || bytes <= 0) return "—";
			var mb = bytes / 1024 / 1024;
			if (mb >= 1) return mb.toFixed(2) + " MB";
			return Math.max(1, Math.round(bytes / 1024)) + " KB";
		}

		function formatDate(iso) {
			try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso || ""); }
		}

		function Btn(props, text) {
			var className = "sp-btn" + (props.primary ? " sp-btn-primary" : "") + (props.danger ? " sp-btn-danger" : "");
			return React.createElement("button", {
				className: className,
				disabled: !!props.disabled,
				onClick: props.onClick,
			}, text);
		}

		/* ── 任务面板：视图常量与状态分组 ─────────────────── */

		var SP_VIEW_NEW = "new-task";
		var SP_VIEW_RECENT = "recent";
		var SP_VIEW_TASK = "task";

		/**
		 * 任务状态 → 恢复落点视图（规格「状态 → 恢复落点」表，Plan 2b D1 修正）：
		 * - waiting-outline → 大纲确认视图；
		 * - creating / waiting-launch / analyzing / building / reviewing /
		 *   needs-input / failed / cancelled → 生成进度视图（启动恢复区 /
		 *   补充信息区 / 错误恢复区 / 只读详情是同一视图内的状态变体）；
		 * - completed → 结果视图；其余（未知）→ 新建任务。
		 */
		function viewForStatus(status) {
			switch (status) {
				case "waiting-outline":
					return "outline";
				case "creating":
				case "waiting-launch":
				case "analyzing":
				case "building":
				case "reviewing":
				case "needs-input":
				case "failed":
				case "cancelled":
					return "progress";
				case "completed":
					return "result";
				default:
					return SP_VIEW_NEW;
			}
		}

		/** 状态分组：待处理优先（与 host 的恢复优先级口径一致）。 */
		function statusGroupOf(status) {
			if (status === "waiting-outline" || status === "needs-input") return "attention";
			if (status === "creating" || status === "waiting-launch" || status === "analyzing"
				|| status === "building" || status === "reviewing") return "active";
			if (status === "failed") return "failed";
			if (status === "completed") return "done";
			return "other";
		}

		/* ── 活跃任务轮询（规格「面板侧刷新策略」：活跃态 3s 固定间隔，终态停止；
		 * 不新增事件流服务、不监听新端口；schedule 可注入供冒烟断言）── */

		/** 轮询白名单：仅这四个活跃态轮询；终态与等待用户输入（needs-input）不轮询。 */
		var SP_POLL_STATUSES = ["analyzing", "building", "reviewing", "waiting-outline"];
		var SP_POLL_MS = 3000;

		function isPollingStatus(status) {
			return SP_POLL_STATUSES.indexOf(String(status || "")) !== -1;
		}

		/**
		 * 单任务轮询循环：到点 → tasks.get → onTick(record) → 记录仍是活跃态则
		 * 按固定间隔续期，终态（或 cancel）即停。网络抖动（请求失败）按「继续
		 * 轮询」处理——一次失败不该杀死恢复观察；但 **not-found 类错误**
		 * （任务被删除：message 含 not-found / 不存在 / HTTP 404）即停——对
		 * 已不存在的记录空转没有意义（实现后审查修正）。onTick 拿不到记录时
		 * 收到 null，由调用方决定是否提示。返回 cancel（幂等，可重复调用）。
		 * schedule 语义 = 到点单发一次（循环自身续期）：默认实现用 setTimeout，
		 * 不用 setInterval——setInterval 的重复触发与循环续期叠加会倍增计时器，
		 * 且终态后 interval 仍会继续触发；loop 返回 promise 供注入方 await
		 * 完整一轮（取数 + 续期判定）。
		 */
		function startTaskPolling(taskId, onTick, options) {
			var opts = options || {};
			var apiFn = typeof opts.api === "function" ? opts.api : api;
			var schedule = typeof opts.schedule === "function"
				? opts.schedule
				: function defaultSchedule(fn, ms) {
					var timer = setTimeout(fn, ms);
					return function () { clearTimeout(timer); };
				};
			var stopped = false;
			var cancelTimer = function () {};
			function tick() {
				if (stopped) return Promise.resolve(false);
				return Promise.resolve()
					.then(function () { return apiFn("tasks.get", { id: taskId }); })
					.then(function (record) {
						if (stopped) return false;
						if (typeof onTick === "function") onTick(record || null);
						return isPollingStatus(record && record.status);
					})
					.catch(function (error) {
						// 被删任务不空转：not-found 类错误停轮询；其余（网络抖动）
						// 维持「一次失败不杀死轮询」。
						var message = String((error && error.message) || error);
						if (/not-found|不存在|HTTP 404/.test(message)) return false;
						return true;
					});
			}
			function loop() {
				if (stopped) return Promise.resolve(false);
				return tick().then(function (again) {
					if (again && !stopped) cancelTimer = schedule(loop, SP_POLL_MS);
					return again;
				});
			}
			cancelTimer = schedule(loop, SP_POLL_MS);
			return function cancel() {
				stopped = true;
				cancelTimer();
				cancelTimer = function () {};
			};
		}

		/* ── 壳层联动纯函数（Plan 2b Task 6：路由判定 / 待办抽取 / 打开任务）──
		 * stub React 不执行 effect、useState 不触发重渲染，壳层的联动逻辑一律
		 * 下沉到这里，冒烟直接断言（行为规格 1）。 */

		/**
		 * 组内排序：最近更新在前（缺失/非法时间按 0 处理，不抛）。
		 * Plan 2b Task 6 起为模块级共用（makeRecentView 分组排序 + attentionEntries）。
		 */
		function byUpdatedDesc(a, b) {
			var ta = Date.parse(String((a && a.updatedAt) || "")) || 0;
			var tb = Date.parse(String((b && b.updatedAt) || "")) || 0;
			return tb - ta;
		}

		/** 详情路由判定（壳层分发与冒烟共用）：TaskRecord → 子视图落点，= viewForStatus(status)。 */
		function routeSubView(record) {
			return viewForStatus(record && record.status);
		}

		/** forcedSub（「返回修改大纲」）是否该被一次刷新清除：仅当恢复落点真的变了。 */
		function shouldClearForced(prev, next) {
			return routeSubView(prev) !== routeSubView(next);
		}

		/** attention 组任务（waiting-outline / needs-input）按 updatedAt 倒序；非数组 → 空。 */
		function attentionEntries(tasks) {
			if (!Array.isArray(tasks)) return [];
			return tasks.filter(function (task) {
				return statusGroupOf(task && task.status) === "attention";
			}).sort(byUpdatedDesc);
		}

		/** 任务详情刷新后同步列表条目的索引字段（条目缺的字段不强造，见 patchTasks）。 */
		var SP_TASK_INDEX_KEYS = ["title", "status", "format", "workspaceName", "createdAt", "updatedAt"];

		/**
		 * 打开一条任务（Plan 2b Task 6，behavior 规格 1/3）：取完整记录
		 * （tasks.get）→ 成功且记录存在 → onReady(record)；请求失败 / 记录缺失
		 * → onMissing()。**绝不抛**——404 是正常业务态（任务被删除），不该冒到
		 * 渲染层。返回 promise 供壳层与冒烟 await 判定。
		 * deps = { api?, onReady?, onMissing? }（api 缺省用模块级 api）。
		 */
		function openTaskRecord(entry, deps) {
			var d = deps || {};
			var apiFn = typeof d.api === "function" ? d.api : api;
			var onReady = typeof d.onReady === "function" ? d.onReady : function () {};
			var onMissing = typeof d.onMissing === "function" ? d.onMissing : function () {};
			return Promise.resolve()
				.then(function () { return apiFn("tasks.get", { id: entry && entry.id }); })
				.then(function (record) {
					if (record) onReady(record); else onMissing();
				})
				.catch(function () { onMissing(); });
		}

		/** 详情视图组件缓存：key=(sub|taskId) 稳定则复用同一组件类型（防轮询
		 *  re-render 重建工厂产物导致真 React remount 丢视图内状态）。cacheRef 为
		 *  useRef 形态 {current}；make 是 (sub) => Component 惰性工厂。 */
		function ensureDetailView(cacheRef, sub, taskId, make) {
			var c = cacheRef.current;
			var key = sub + "|" + taskId;
			if (c && c.key === key) return c.Comp;
			var Comp = make(sub);
			cacheRef.current = { key: key, Comp: Comp };
			return Comp;
		}

		/**
		 * 面板壳：DSH 原生主面板内的**单列**任务工作区。
		 * 顶部只有两个轻量视图切换（不是第二套应用导航），其余全部是同一列内容。
		 * 严禁自建侧边栏 / 右侧栏 / 全屏容器——壳层宽度与滚动归宿主。
		 *
		 * 视图分发（Plan 2b Task 6 接线；实现后审查修正：组件类型经缓存）：
		 * - SP_VIEW_NEW → makeNewTaskView（不变）；
		 * - SP_VIEW_RECENT → makeRecentView（onOpen=openTask / onNewTask 回新建）；
		 * - SP_VIEW_TASK → 详情三落点：forcedSub（进度视图「返回修改大纲」）优先，
		 *   否则 routeSubView(active)（= viewForStatus(status)）分发
		 *   makeOutlineReviewView / makeProgressView / makeResultView——组件类型
		 *   按 (sub|taskId) 经 ensureDetailView 缓存（内联调工厂=每次新类型，
		 *   轮询 re-render 会 remount 丢视图内编辑）；live task 与回调经 props
		 *   流入（视图 props 优先 opts 兜底）。
		 *   activeErr 且无 active → 错误横幅 + 返回最近按钮（留在任务视图内）。
		 * 轮询：active 处于 isPollingStatus 白名单时注册 startTaskPolling（3s），
		 * tick 刷新 active、同步列表条目、落点变化时清 forcedSub；终态或卸载即停。
		 * attention 提示行：head 下方，列表存在 attention 组任务时渲染条数胶囊，
		 * 点击 openTask 打开最近更新的一条（AC 2）。
		 *
		 * 视图容器类名（sp-view-new-task / sp-view-recent / sp-view-outline /
		 * sp-view-progress / sp-view-result）由各视图根**自持**：
		 * 壳层只传 props（含 useWorkspaces），不下发 className，避免壳层与视图
		 * 争夺根节点；单独渲染视图工厂时类名同样成立。
		 */
		function makePanelsView(t, bridges) {
			var b = bridges || {};
			// 数据面优先用 apply 注入的 bridges.api（与模块级 api 同实现；冒烟注 stub）
			var apiFn = typeof b.api === "function" ? b.api : api;

			function Panels(props) {
				var viewState = React.useState(SP_VIEW_NEW);
				var view = viewState[0], setView = viewState[1];
				// 任务列表状态由「最近任务」视图与创建流程共用（创建成功后要立刻出现在列表里）
				var tasksState = React.useState(null);
				var tasks = tasksState[0], setTasks = tasksState[1];
				var loadErrState = React.useState("");
				var loadErr = loadErrState[0], setLoadErr = loadErrState[1];
				// 任务详情态（Plan 2b Task 6）：活跃记录 / 打开失败文案 / 强制子视图 / 防重入
				var activeState = React.useState(null);
				var active = activeState[0], setActive = activeState[1];
				var activeErrState = React.useState("");
				var activeErr = activeErrState[0], setActiveErr = activeErrState[1];
				var forcedState = React.useState(null);
				var forcedSub = forcedState[0], setForcedSub = forcedState[1];
				var busyOpenState = React.useState(false);
				var busyOpen = busyOpenState[0], setBusyOpen = busyOpenState[1];
				// 详情视图组件类型缓存槽（实现后审查修正）：{key: "sub|id", Comp}
				var detailRef = React.useRef(null);

				var refreshTasks = React.useCallback(function () {
					return apiFn("tasks.list", {}).then(function (value) {
						setTasks((value && value.tasks) || []);
						setLoadErr("");
						return value;
					}).catch(function (error) {
						setLoadErr(String((error && error.message) || error));
						setTasks([]);
					});
				}, []);

				React.useEffect(function () { refreshTasks(); }, [refreshTasks]);

				/**
				 * 详情记录刷新后同步 tasks 列表条目：按 id 命中后只替换**条目已有**
				 * 的索引字段（status/title/updatedAt…，SP_TASK_INDEX_KEYS），条目缺的
				 * 字段不强造——保持列表行形状稳定。
				 */
				function patchTasks(next) {
					if (!next || !next.id) return;
					setTasks(function (list) {
						if (!Array.isArray(list)) return list;
						return list.map(function (entry) {
							if (!entry || entry.id !== next.id) return entry;
							var copy = {};
							Object.keys(entry).forEach(function (key) { copy[key] = entry[key]; });
							SP_TASK_INDEX_KEYS.forEach(function (key) {
								if (key in copy && next[key] !== undefined) copy[key] = next[key];
							});
							return copy;
						});
					});
				}

				/**
				 * 打开任务（最近条目 / attention 提示行共用）：busyOpen 防重入；
				 * 成功 → setActive + 清 forcedSub/activeErr + 进任务视图；
				 * 失败 → 留在任务视图渲染错误横幅（spec 3+6 组合语义：onMissing 同步
				 * 清掉可能残留的旧 active，否则「activeErr 且无 active」的横幅条件在
				 * 二次打开失败时永远不成立）。
				 */
				function openTask(entry) {
					if (busyOpen) return;
					setBusyOpen(true);
					openTaskRecord(entry, {
						api: apiFn,
						onReady: function (record) {
							setBusyOpen(false);
							setActive(record);
							setForcedSub(null);
							setActiveErr("");
							setView(SP_VIEW_TASK);
						},
						onMissing: function () {
							setBusyOpen(false);
							setActive(null);
							setActiveErr(t("taskOpenFailed"));
							setView(SP_VIEW_TASK);
						},
					});
				}

				/** 详情视图回调（确认/保存/重试/取消等**用户动作**的返回值）：换 active、清 forcedSub、同步列表。 */
				function onTaskUpdated(next) {
					if (!next) return;
					setActive(next);
					setForcedSub(null);
					patchTasks(next);
				}

				/** 离开任务详情视图：清活跃态（轮询随 active 卸载）。防「带着活跃
				 *  任务切到 new/recent 标签」时轮询 tick 每 3s re-render 壳层——
				 *  new/recent 仍是内联工厂（视图零/低频 state），re-render 会重建
				 *  组件类型 remount，丢新建任务视图的用户输入。 */
				function leaveTaskView() {
					setActive(null);
					setForcedSub(null);
					setActiveErr("");
				}

				/** 离开详情回最近列表：清活跃态 + 刷新列表，保证轮询中变终态的任务回到列表时是最新状态。 */
				function backToRecent() {
					leaveTaskView();
					setView(SP_VIEW_RECENT);
					refreshTasks();
				}

				/** 轮询 tick（**被动刷新**）：只换 active/同步列表；落点视图真的变了才清 forcedSub（同视图刷新保留「返回修改大纲」覆盖）。 */
				function onPollTick(next) {
					if (!next) return;
					setActive(next);
					patchTasks(next);
					if (shouldClearForced(active, next)) setForcedSub(null);
				}

				// 活跃任务轮询：仅在详情视图在场时注册（view 参与 deps——离开即
				// cancel）；deps 认 id+status——status 未变不重启循环（循环自身已按
				// 终态停），换任务/落点变化即重挂；effect 卸载（cancel）自动停。
				React.useEffect(function () {
					if (view !== SP_VIEW_TASK) return undefined;
					if (!active || !isPollingStatus(active.status)) return undefined;
					return startTaskPolling(active.id, onPollTick, { api: apiFn });
				}, [view, active && active.id, active && active.status]);

				var tabs = React.createElement("div", { className: "sp-tabs", role: "tablist" },
					React.createElement("button", {
						type: "button",
						className: "sp-tab" + (view === SP_VIEW_NEW ? " sp-tab-active" : ""),
						onClick: function () { leaveTaskView(); setView(SP_VIEW_NEW); },
					}, t("newTask")),
					React.createElement("button", {
						type: "button",
						className: "sp-tab" + (view === SP_VIEW_RECENT ? " sp-tab-active" : ""),
						onClick: function () { leaveTaskView(); setView(SP_VIEW_RECENT); },
					}, t("recent")),
				);
				// 任务详情态（SP_VIEW_TASK）两个 tab 都不带 sp-tab-active——既有条款，勿破坏。

				var viewProps = { useWorkspaces: props && props.useWorkspaces };
				var body;
				if (view === SP_VIEW_RECENT) {
					body = React.createElement(makeRecentView(t, {
						tasks: tasks, loadErr: loadErr, refresh: refreshTasks,
						onOpen: openTask,
						onNewTask: function () { setView(SP_VIEW_NEW); },
					}), viewProps);
				} else if (view === SP_VIEW_TASK) {
					if (activeErr && !active) {
						// 打开失败：错误横幅 + 返回最近（不静默弹回列表，用户要看清失败原因）
						body = React.createElement("div", { className: "sp-task-error" },
							React.createElement("p", { className: "sp-state" }, activeErr),
							React.createElement("button", {
								type: "button", className: "sp-btn",
								onClick: backToRecent,
							}, t("backToRecent")),
						);
					} else if (active) {
						var sub = forcedSub || routeSubView(active);
						if (sub === "outline" || sub === "progress" || sub === "result") {
							// 组件类型按 (sub|active.id) 缓存：轮询 setActive 触发的
							// re-render 复用同一类型（不缓存则每次新工厂产物=新类型，
							// 真 React unmount/remount，用户编辑每 3s 被静默重置）。
							// live task/回调走 props 流入（缓存组件内 props 优先）。
							var Comp = ensureDetailView(detailRef, sub, active.id, function (which) {
								var statics = { api: apiFn, sendToSession: b.sendToSession };
								if (which === "outline") return makeOutlineReviewView(t, statics);
								if (which === "progress") return makeProgressView(t, statics);
								return makeResultView(t, statics);
							});
							body = React.createElement(Comp, {
								task: active,
								useWorkspaces: viewProps.useWorkspaces,
								onUpdated: onTaskUpdated,
								onBack: backToRecent,
								// 仅 progress 传这两个回调；outline/result 传 undefined
								// （视图 props 优先 opts 兜底判定视为未传 → 默认 noop）。
								onBackToOutline: sub === "progress" ? function () { setForcedSub("outline"); } : undefined,
								// 视图契约是无参 openSession()；壳层桥接任务工作区 id
								//（apply 的 openSession(workspaceId) 先跳工作区再回会话）。
								// 每渲染新建闭包读当前 active——无陈旧闭包。
								openSession: sub === "progress" ? function () {
									if (typeof b.openSession === "function") {
										b.openSession(active.workspace && active.workspace.id);
									}
								} : undefined,
							});
						} else {
							body = null; // 状态路由不到三落点（active 数据异常）：留空列，回列表可恢复
						}
					} else {
						body = null; // view=task 但既无 active 也无错误（openTask 在途的瞬时态）
					}
				} else {
					body = React.createElement(makeNewTaskView(t, {
						onCreated: function () { refreshTasks(); setView(SP_VIEW_RECENT); },
						tasks: tasks,
						bridges: b,
					}), viewProps);
				}

				// attention 提示行：只依赖列表数据（tasks=null → 不渲染），不恒在场。
				var attention = attentionEntries(tasks);
				var hint = attention.length > 0 ? React.createElement("button", {
					type: "button", className: "sp-attention-hint",
					onClick: function () { openTask(attention[0]); },
				}, t("attentionHint", { count: attention.length })) : null;

				// 样式注入自检失败的显性警告（详见 ensureStyles：静默降级不可接受）
				var warn = stylesBlocked() ? React.createElement("div", { className: "sp-styles-warning" }, t("stylesBlockedWarning")) : null;

				return React.createElement("div", { className: "sp-panels" },
					warn,
					React.createElement("div", { className: "sp-panels-head" },
						React.createElement("h2", { className: "sp-panels-title" }, t("panelTitle")),
						tabs,
					),
					hint,
					body,
				);
			}
			return Panels;
		}

		/* ── 新建任务视图（Brief + 交付形态 + 快速开始 + 配置摘要）──
		 * 默认极简：一句话主题 + 两张形态卡 + 「开始制作」；「更多选项」
		 * 展开后才是受众 / 场景 / 页数 / 风格 / 备注。
		 * 后续任务的接入点（视图接口不变）：
		 * - Task 4：`sp-tpl-open` 占位入口换成真实模板选择器 makeTemplatePicker；
		 * - Task 5：素材只做本地登记，真实上传（uploadMaterial + materialStatus）由它接管；
		 * - Task 6（已接入）：apply 注入的桥是绑定 ctx 的完整编排 createTaskAndStart
		 *   （落盘 → 素材上传 → 会话桥 v3 提交 → 状态推进），调用形状
		 *   bridges.createTask(input) 与 { task, phase } 语义不变，本视图无需改动。 */

		// 快速开始 chip 的键位（文案在 zh/en 字典 q1..q8：Label 为 chip 文案，Text 为填入的主题）
		var SP_QUICK_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"];

		/** prefs.defaultFormat → 视图形态值：仅 html 取 html，其余（ask / pptx / 缺失）默认 PPTX。 */
		function normalizeFormat(value) {
			return value === "html" ? "html" : "pptx";
		}

		/**
		 * 组装 host 接受的 brief；templateId 的三态语义必须保真：
		 * - templateChoice 为空 → **不写 templateId 键**（跟随设置页默认模板）；
		 * - templateChoice === "none" → brief.templateId = null（明确不使用模板）；
		 * - templateChoice 为模板对象 → 写 id / name / source。
		 */
		function buildBriefFrom(state) {
			var src = state || {};
			var brief = {
				topic: String(src.topic || "").trim(),
				format: src.format === "html" ? "html" : "pptx",
			};
			if (src.audience) brief.audience = src.audience;
			if (src.scenario) brief.scenario = src.scenario;
			if (src.pageCount) brief.pageCount = src.pageCount;
			if (src.style) brief.style = src.style;
			if (src.styleNotes) brief.styleNotes = src.styleNotes;
			if (src.templateChoice === "none") brief.templateId = null;
			else if (src.templateChoice) {
				brief.templateId = src.templateChoice.id;
				brief.templateName = src.templateChoice.name;
				brief.templateSource = src.templateChoice.source;
			}
			return brief;
		}

		/**
		 * 任务落盘（Task 3 引入的桥；Task 6 起成为 createTaskAndStart 的**第 1 步**，
		 * 不再单独注入给视图）：
		 * api("tasks.create", {title, brief, workspace})，成功后返回
		 * { task, phase: "waiting-launch" } —— 如实反映「已落盘但尚未启动」，
		 * 不假装已经启动（自动启动是 createTaskAndStart 的后续步骤）。
		 *   input  = { title, brief, workspace: {id,name,path}, materials }
		 *   output = Promise<{ task, phase: "started" | "waiting-launch", message? }>
		 */
		function createTask(input) {
			var payload = input || {};
			var brief = payload.brief && typeof payload.brief === "object" ? payload.brief : {};
			var workspace = payload.workspace && typeof payload.workspace === "object"
				? payload.workspace : { id: "", name: "", path: "" };
			var title = String(payload.title || brief.topic || "").slice(0, 40);
			return api("tasks.create", {
				title: title,
				brief: brief,
				workspace: workspace,
			}).then(function (task) {
				return { task: task, phase: "waiting-launch", message: "" };
			});
		}

		/**
		 * 创建并启动一个演示任务（Task 6）：apply 把本函数按 ctx 绑定后作为
		 * `bridges.createTask(input)` 注入面板壳，**视图层的调用形状与返回语义
		 * （{ task, phase }）保持不变**，phase 现在可能是 "started"。
		 *
		 * 1) 先在 host 落盘任务记录（失败即中止，绝不产生「启动了但没有记录」的
		 *    孤儿任务——所以落盘必须在会话提交之前）；
		 * 2) 逐个上传素材（失败的素材只记错误，不阻塞启动）；
		 * 3) 组装 Brief（内嵌「任务 ID：<id>」让 Agent 知道该用 ppts_task 上报）；
		 * 4) 经 sendToChatV3 写入并提交（自动启动，无需用户回车）；
		 * 5) 提交失败 → 把任务置为 waiting-launch（可恢复），而不是 failed；
		 *    提交成功 → 置 analyzing，phase 返回 "started"。
		 */
		function createTaskAndStart(ctx, input) {
			// createTask 的返回是 { task, phase, message } 包装（Task 3 契约），落盘
			// 记录在 .task 上——编排只复用它的**请求**，下面按裸记录继续。
			return createTask(input).then(function (created) {
				var task = created.task;
				var uploaded = [];
				// 素材条目来自视图本地队列：{ name, size, status, file, upload }
				// ——真实字节在 file，上传通道在 upload（apply 注入的
				// bridges.uploadMaterial，缺省回落到模块级同实现）。
				var chain = Promise.resolve();
				(input && input.materials ? input.materials : []).forEach(function (entry) {
					chain = chain.then(function () {
						var raw = entry && entry.file ? entry.file : entry;
						var uploader = entry && typeof entry.upload === "function" ? entry.upload : uploadMaterial;
						return Promise.resolve(uploader(task.id, raw)).then(function (info) {
							if (info) uploaded.push(info);
						}).catch(function () { /* 单素材失败不阻塞启动 */ });
					});
				});
				return chain.then(function () {
					// 上传回执（{name,size,path}）才是**已登记进任务记录**的素材
					// （host 的 writeMaterial 已把它们追加进记录）；tasks.create 的
					// 返回是上传前的旧快照，直接用它组 Brief 会漏掉素材路径。
					var withMaterials = uploaded.length > 0
						? Object.assign({}, task, { materials: uploaded })
						: task;
					var prompt = buildTaskPrompt(withMaterials);
					return sendToChatV3(ctx, prompt, input && input.workspace && input.workspace.id)
						.then(function (phase) {
							if (phase === "submitted") {
								return api("tasks.update", { id: task.id, patch: { status: "analyzing" } })
									.then(function (updated) {
										return { task: updated, phase: "started" };
									});
							}
							// 提交不可达：任务已落盘但未启动，用户可重试
							return api("tasks.update", { id: task.id, patch: { status: "waiting-launch" } })
								.then(function (updated) {
									return { task: updated, phase: "waiting-launch" };
								});
						});
				});
			});
		}

		/** 组装投递给 Agent 的 Brief 文本（含任务 id，Agent 据此调用 ppts_task）。 */
		function buildTaskPrompt(task) {
			var brief = (task && task.brief) || {};
			var lines = ["请制作一份演示文稿。", "任务 ID：" + (task && task.id)];
			if (brief.topic) lines.push("主题：" + brief.topic);
			if (brief.audience) lines.push("目标受众：" + brief.audience);
			if (brief.scenario) lines.push("使用场景：" + brief.scenario);
			if (brief.pageCount) lines.push("预计页数：" + brief.pageCount);
			lines.push("交付形态：" + (brief.format === "html" ? "HTML 在线演示" : "可编辑 PPTX"));
			if (brief.templateId === null) lines.push("模板：不使用模板，按内容自由设计");
			else if (brief.templateId) lines.push("模板：" + brief.templateName + "（" + brief.templateSource + "）");
			if (brief.styleNotes) lines.push("风格要求：" + brief.styleNotes);
			var materials = (task && task.materials) || [];
			if (materials.length > 0) {
				lines.push("素材文件（请先读取）：");
				for (var i = 0; i < materials.length; i += 1) lines.push("- " + materials[i].path);
			}
			lines.push("");
			lines.push("请先用 ppts_task 汇报「分析内容」阶段，完成内容分析与页面规划后，用 ppts_task 的 outline 动作提交页面大纲，然后**停下等待用户在工作台确认**，不要先生成 PPTX/HTML。");
			return lines.join("\n");
		}

		/* ── 任务消息构建器（Plan 2b）：大纲确认后的会话续指令族 ──
		 * 全部是纯字符串组装（不触 ctx / React）；视图经壳层 sendToSession 桥
		 * 投递。Agent 侧的对应动作：修改指令 → ppts_task outline（新版本后停）；
		 * 继续生成 / 继续修改 / 重新生成 → 按已确认大纲推进并登记产物。 */

		/** 确认大纲后的继续生成指令（确认流程第 3 步投递）。 */
		function buildContinuePrompt(task) {
			var outline = (task && task.outline) || {};
			var pages = Array.isArray(outline.pages) ? outline.pages : [];
			var version = (task && task.confirmedOutlineVersion) || outline.version || 0;
			return [
				"大纲已确认，请继续制作演示文稿。",
				"任务 ID：" + (task && task.id),
				"已确认大纲版本：v" + version + "（" + pages.length + " 页）",
				"请按已确认大纲逐页生成内容与视觉；完成后用 ppts_task 的 artifact 动作登记产物文件，并用 done 动作将任务标记为 completed。",
			].join("\n");
		}

		/** 自然语言修改大纲指令：Agent 提交新版本大纲后必须停下等再次确认。 */
		function buildOutlineRevisePrompt(task, instruction) {
			var text = String(instruction || "").trim();
			if (text === "") throw new Error("缺少修改指令");
			var outline = (task && task.outline) || {};
			var pages = Array.isArray(outline.pages) ? outline.pages : [];
			return [
				"请根据用户指令修改演示大纲。",
				"任务 ID：" + (task && task.id),
				"当前大纲版本：v" + ((task && task.outlineVersion) || 0) + "（" + pages.length + " 页）",
				"用户指令：" + text,
				"请调用 ppts_task 的 outline 动作提交修改后的完整大纲（生成新版本），然后停下等待用户在工作台再次确认，不要直接生成 PPTX/HTML。",
			].join("\n");
		}

		/** needs-input 的补充信息投递（问题文本来自面板展示的同一条事件）。 */
		function buildNeedsInputPrompt(task, question, answer) {
			var q = String(question || "").trim();
			var a = String(answer || "").trim();
			if (a === "") throw new Error("缺少补充内容");
			return [
				"补充信息（演示任务）。",
				"任务 ID：" + (task && task.id),
				q ? "待补充问题：" + q : "",
				"用户补充：" + a,
				"请基于以上信息继续任务。",
			].filter(function (line) { return line !== ""; }).join("\n");
		}

		/** 已完成任务的自然语言继续修改（默认只重做相关部分）。 */
		function buildContinueEditPrompt(task, instruction) {
			var text = String(instruction || "").trim();
			if (text === "") throw new Error("缺少修改指令");
			var artifacts = (task && task.artifacts) || [];
			var lines = [
				"继续修改已完成的演示文稿。",
				"任务 ID：" + (task && task.id),
			];
			if (artifacts.length > 0) {
				var paths = [];
				for (var i = 0; i < artifacts.length; i++) paths.push("- " + artifacts[i].path);
				lines.push("现有产物：");
				lines = lines.concat(paths);
			}
			lines.push("修改要求：" + text);
			lines.push("只重做与要求相关的部分，不要整份重新生成；完成后重新登记产物并推进任务状态。");
			return lines.join("\n");
		}

		/** 产物丢失后的重新生成指令（结果页「重新生成」按钮）。 */
		function buildRegeneratePrompt(task, artifact) {
			return [
				"演示任务的产物文件已丢失，请重新生成。",
				"任务 ID：" + (task && task.id),
				"丢失产物：" + (artifact && artifact.type) + "（原路径：" + (artifact && artifact.path) + "）",
				"请基于已确认大纲重新生成该产物，并用 ppts_task 的 artifact 动作重新登记新路径。",
			].join("\n");
		}

		/** useWorkspaces 条目 → host 的 TaskWorkspace{id,name,path}（缺失一律空串，不用 null）。 */
		function workspaceRef(item) {
			if (!item) return { id: "", name: "", path: "" };
			return {
				id: String(item.workspaceId || ""),
				name: String(item.title || ""),
				path: String(item.path || ""),
			};
		}

		/** 字节数 → 可读体积（素材行的次要信息）。 */
		function formatSize(size) {
			var bytes = typeof size === "number" && size > 0 ? size : 0;
			if (bytes >= 1024 * 1024) return (Math.round(bytes / (1024 * 1024) * 10) / 10) + " MB";
			if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
			return bytes + " B";
		}

		/**
		 * 视图工厂：返回新建任务视图组件（视图根自持 `sp-view-new-task`）。
		 * options.bridges 是 apply 注入的桥：api（数据面）+ createTask（Task 6 起是
		 * 绑定 ctx 的 createTaskAndStart，单参调用形状与 { task, phase } 返回语义不变）
		 * + uploadMaterial（素材原始流式上传）。
		 */
		function makeNewTaskView(t, options) {
			var opts = options || {};
			var bridges = opts.bridges || {};

			function NewTaskView(props) {
				// ── 主题 / 交付形态 ──
				var topicState = React.useState("");
				var topicDraft = topicState[0], setTopicDraft = topicState[1];
				var formatState = React.useState(normalizeFormat(null));
				var formatDraft = formatState[0], setFormatDraft = formatState[1];
				// 用户一旦手动点过形态卡，就不再被 prefs.defaultFormat 回改
				var formatTouched = React.useRef(false);
				// ── 更多选项（默认折叠） ──
				var advancedState = React.useState(false);
				var advanced = advancedState[0], setAdvanced = advancedState[1];
				var audienceState = React.useState("");
				var audience = audienceState[0], setAudience = audienceState[1];
				var scenarioState = React.useState("");
				var scenario = scenarioState[0], setScenario = scenarioState[1];
				var pagesState = React.useState("");
				var pageCountDraft = pagesState[0], setPageCountDraft = pagesState[1];
				var styleState = React.useState("");
				var styleDraft = styleState[0], setStyleDraft = styleState[1];
				var notesState = React.useState("");
				var styleNotesDraft = notesState[0], setStyleNotesDraft = notesState[1];
				// ── 模板（"" 跟随默认 / "none" 不使用 / 模板对象；Task 4 已接真实选择器）──
				var tplState = React.useState("");
				var templateChoice = tplState[0], setTemplateChoice = tplState[1];
				var tplOpenState = React.useState(false);
				var tplOpen = tplOpenState[0], setTplOpen = tplOpenState[1];
				var tplDataState = React.useState(null);
				var tplData = tplDataState[0], setTplData = tplDataState[1];
				// ── 素材（Task 5：本地登记 + 待上传队列；真实上传在任务落盘后由 Task 6 编排） ──
				var matState = React.useState([]);
				var materials = matState[0], setMaterials = matState[1];
				var fileRef = React.useRef(null);
				// 素材区的上传通道：优先用 apply 注入的 bridges.uploadMaterial（Task 6 的
				// 编排会用到），未注入时回落到模块级同实现 uploadMaterial —— 素材区到
				// 上传函数的调用路径恒可达。**不在本任务发起上传**：素材上传只登记到
				// 已有任务，任务尚未创建时原始 File 先留在本地待上传队列（materials
				// 条目里的 file 字段），随 createTask 的 materials 一并交给 Task 6 的编排。
				var uploader = (bridges && typeof bridges.uploadMaterial === "function")
					? bridges.uploadMaterial : uploadMaterial;
				// ── 工作区 ──
				var wsState = React.useState("");
				var ws = wsState[0], setWs = wsState[1];
				var useWorkspaces = props && props.useWorkspaces;
				var wsItems = typeof useWorkspaces === "function"
					? useWorkspaces(function (s) { return s.items; }) : null;
				var wsPhase = typeof useWorkspaces === "function"
					? useWorkspaces(function (s) { return s.phase; }) : null;
				// ── 提交态 ──
				var busyState = React.useState(false);
				var busy = busyState[0], setBusy = busyState[1];
				var msgState = React.useState("");
				var msg = msgState[0], setMsg = msgState[1];

				// 模板库 + 生成偏好：形态默认值取 prefs.defaultFormat（ask → PPTX）。
				// 库不可达不阻塞创建（降级为「跟随默认模板」，形态保持 PPTX）。
				var loadTemplates = React.useCallback(function () {
					return api("templates.list").then(function (value) {
						setTplData(value);
						return value;
					}).catch(function () { setTplData(null); });
				}, []);
				React.useEffect(function () { loadTemplates(); }, [loadTemplates]);
				React.useEffect(function () {
					if (formatTouched.current) return;
					var prefs = tplData && tplData.prefs;
					var next = normalizeFormat(prefs && prefs.defaultFormat);
					if (next !== formatDraft) setFormatDraft(next);
				}, [tplData, formatDraft]);

				var topicText = String(topicDraft || "");
				var topicReady = topicText.trim() !== "";

				// 模板选择器的两组数据源（Task 4）：内置来自 host 的 builtinTemplates，
				// 用户模板来自 templates；库不可达时两组皆空（选择器仍可用「不使用/跟随默认」）。
				var tplBuiltinTemplates = (tplData && tplData.builtinTemplates) || [];
				var tplUserTemplates = (tplData && tplData.templates) || [];

				/** 选中工作区 → TaskWorkspace；跟随当前（""）留空对象，由 Task 6 按会话落点补齐。 */
				var selectedWorkspace = function () {
					if (ws === "") return { id: "", name: "", path: "" };
					var items = wsItems || [];
					for (var i = 0; i < items.length; i += 1) {
						if (items[i].workspaceId === ws) return workspaceRef(items[i]);
					}
					return { id: "", name: "", path: "" };
				};

				var currentBrief = function () {
					return buildBriefFrom({
						topic: topicText,
						format: formatDraft,
						audience: String(audience || "").trim(),
						scenario: String(scenario || "").trim(),
						pageCount: String(pageCountDraft || "").trim(),
						style: String(styleDraft || "").trim(),
						styleNotes: String(styleNotesDraft || "").trim(),
						templateChoice: templateChoice,
					});
				};

				// 「开始制作」：落盘 → 自动启动（Task 6：会话桥 v3 的 setDraft + submit，
				// 用户无需回聊天窗口回车）。
				// phase === "started" 才算真的启动；"waiting-launch" 只落盘，如实告知。
				var onStart = function () {
					var topic = topicText.trim();
					if (topic === "") return;
					var start = bridges && typeof bridges.createTask === "function" ? bridges.createTask : null;
					if (start === null) { setMsg(t("taskCreateFailed")); return; }
					setBusy(true); setMsg("");
					Promise.resolve(start({
						title: topic.slice(0, 40),
						brief: currentBrief(),
						workspace: selectedWorkspace(),
						materials: materials,
					})).then(function (result) {
						// result: { task, phase: "started" | "waiting-launch", message }
						if (result && result.phase === "started") {
							setMsg(t("taskStarted"));
							if (opts.onCreated) opts.onCreated(result.task);
						} else {
							setMsg(t("taskWaitingLaunch"));
						}
					}).catch(function (error) {
						setMsg(t("taskCreateFailed") + "：" + String((error && error.message) || error));
					}).then(function () { setBusy(false); });
				};

				var onPickFiles = function () {
					try {
						var input = fileRef.current;
						if (input && typeof input.click === "function") input.click();
					} catch (error) { /* 无 DOM（测试）/ 宿主限制：忽略 */ }
				};
				var onFilesChosen = function (event) {
					var files = (event && event.target && event.target.files) || [];
					var added = [];
					for (var i = 0; i < files.length; i += 1) {
						added.push({
							name: String(files[i].name || "material"),
							size: typeof files[i].size === "number" ? files[i].size : 0,
							status: "pending",
							// 本地待上传队列：任务尚未创建，原始 File 随素材条目留存，
							// 由 Task 6 的编排用 uploader（bridges.uploadMaterial / 模块级
							// uploadMaterial）按 taskId 逐个上传，并把 status 推进到
							// ready / failed（materialStatus）。
							file: files[i],
							upload: uploader,
						});
					}
					if (added.length === 0) return;
					setMaterials(function (prev) { return (prev || []).concat(added); });
				};
				var onRemoveMaterial = function (index) {
					setMaterials(function (prev) {
						return (prev || []).filter(function (item, i) { return i !== index; });
					});
				};

				// ── 快速开始：点一条填入主题（保留可编辑） ──
				var quickChips = SP_QUICK_KEYS.map(function (key) {
					return React.createElement("button", {
						key: key,
						type: "button",
						className: "sp-quick-chip",
						title: t(key + "Text"),
						onClick: function () { setTopicDraft(t(key + "Text")); },
					}, t(key + "Label"));
				});

				// ── 交付形态：两张卡片（不是下拉框） ──
				var formatCards = [
					{ value: "pptx", label: t("formatPptxCard"), hint: t("formatPptxHint") },
					{ value: "html", label: t("formatHtmlCard"), hint: t("formatHtmlHint") },
				].map(function (item) {
					var active = formatDraft === item.value;
					return React.createElement("button", {
						key: item.value,
						type: "button",
						className: "sp-format-card" + (active ? " sp-format-card-active" : ""),
						"aria-pressed": active,
						onClick: function () {
							formatTouched.current = true;
							setFormatDraft(item.value);
						},
					},
						React.createElement("span", { className: "sp-fmt-title" }, item.label),
						React.createElement("span", { className: "sp-fmt-hint" }, item.hint),
					);
				});

				// ── 模板：Task 4 起是真实选择器（入口按钮 + 打开态渲染；Task 3 的占位已移除） ──
				var tplLabel = templateChoice === "none"
					? t("templateNone")
					: (templateChoice && templateChoice.name ? templateChoice.name : t("tplFollow"));
				// 用户模板的默认标记按库的 defaultTemplate 现算（宿主 templates.list 的 defaultTemplate 是 id）
				var tplDefaultId = (tplData && tplData.defaultTemplate) || null;
				var tplUserItems = tplUserTemplates.map(function (item) {
					return Object.assign({}, item, { isDefault: tplDefaultId !== null && item.id === tplDefaultId });
				});
				var onPickTemplate = function (choice) {
					setTemplateChoice(choice);
					setTplOpen(false);
				};
				var tplRow = React.createElement("div", { className: "sp-field" },
					React.createElement("label", null, t("templateLabel")),
					React.createElement("button", {
						type: "button",
						className: "sp-tpl-open",
						title: t("tplChoose"),
						"aria-expanded": tplOpen,
						onClick: function () { setTplOpen(!tplOpen); },
					}, tplLabel),
				);
				var tplPicker = tplOpen
					? React.createElement(makeTemplatePicker(t, {
						builtin: tplBuiltinTemplates,
						user: tplUserItems,
						onPick: onPickTemplate,
						onClose: function () { setTplOpen(false); },
					}), null)
					: null;

				// ── 更多选项：默认折叠，展开才出现字段与明细 ──
				var textField = function (label, value, onChange, placeholder) {
					return React.createElement("div", { className: "sp-field" },
						React.createElement("label", null, label),
						React.createElement("input", {
							className: "sp-input", type: "text", value: value, placeholder: placeholder,
							onChange: function (event) { onChange(event.target.value); },
						}),
					);
				};
				var extraLine = function (key, value) {
					return React.createElement("div", { className: "sp-config-summary-line", key: key },
						key + "：" + (String(value || "").trim() || t("none")));
				};
				var advancedBody = null;
				if (advanced) {
					var wsRef = selectedWorkspace();
					advancedBody = React.createElement("div", { className: "sp-advanced-body" },
						React.createElement("div", { className: "sp-grid" },
							textField(t("audienceLabel"), audience, setAudience, t("audiencePlaceholder")),
							textField(t("scenarioLabel"), scenario, setScenario, t("scenarioPlaceholder")),
							textField(t("pageCountLabel"), pageCountDraft, setPageCountDraft, t("pageCountPlaceholder")),
							textField(t("styleLabel"), styleDraft, setStyleDraft, t("stylePlaceholder")),
						),
						React.createElement("div", { className: "sp-field" },
							React.createElement("label", null, t("styleNotes")),
							React.createElement("textarea", {
								className: "sp-textarea", rows: 2, placeholder: t("styleNotesPlaceholder"),
								value: styleNotesDraft,
								onChange: function (event) { setStyleNotesDraft(event.target.value); },
							}),
						),
						// 展开明细：逐项回显将要提交的内容（只读）
						React.createElement("div", { className: "sp-config-summary-extra" },
							extraLine(t("audienceLabel"), audience),
							extraLine(t("scenarioLabel"), scenario),
							extraLine(t("pageCountLabel"), pageCountDraft),
							extraLine(t("styleLabel"), styleDraft),
							extraLine(t("styleNotes"), styleNotesDraft),
							extraLine(t("wsLabel"), ws === "" ? t("wsFollow") : (wsRef.name || wsRef.path)),
							extraLine(t("materialList"), String(materials.length)),
						),
					);
				}
				var advancedToggle = React.createElement("button", {
					type: "button",
					className: "sp-advanced-toggle",
					"aria-expanded": advanced,
					onClick: function () { setAdvanced(!advanced); },
				}, t("advancedOptions") + (advanced ? " ▾" : " ▸"));

				// ── 配置摘要：主题 / 形态 / 模板 / 素材数 / 预计页数（一行五项） ──
				var summaryItems = [
					t("topicLabel") + "：" + (topicReady ? topicText.trim().slice(0, 24) : t("topicRequired")),
					t("formatLabel") + "：" + (formatDraft === "html" ? t("formatHtmlCard") : t("formatPptxCard")),
					t("templateLabel") + "：" + tplLabel,
					t("materialList") + "：" + String(materials.length),
					t("pageCountLabel") + "：" + (String(pageCountDraft || "").trim() || t("none")),
				];
				var summary = React.createElement("div", { className: "sp-config-summary" },
					React.createElement("span", { className: "sp-summary-title" }, t("configSummary")),
					summaryItems.map(function (text, index) {
						return React.createElement("span", {
							key: "summary-" + index, className: "sp-summary-item",
						}, text);
					}),
				);

				// ── 工作区（宿主未注入 useWorkspaces 时整块不渲染，软探测） ──
				var wsField = null;
				if (wsItems !== null) {
					wsField = React.createElement("div", { className: "sp-field" },
						React.createElement("label", null, t("wsLabel")),
						wsPhase !== "ready"
							? React.createElement("span", { className: "sp-state" }, t("wsLoading"))
							: (wsItems.length === 0
								? React.createElement("span", { className: "sp-state" }, t("wsEmpty"))
								: React.createElement("select", {
									className: "sp-select", value: ws,
									onChange: function (event) { setWs(event.target.value); },
								},
									React.createElement("option", { value: "" }, t("wsFollow")),
									wsItems.map(function (item) {
										return React.createElement("option", {
											key: item.workspaceId, value: item.workspaceId,
										}, item.title + " — " + item.path);
									}))),
					);
				}

				// ── 素材：入口 + 隐藏多选文件输入 + 列表（Task 5 接真实上传） ──
				var materialItems = materials.map(function (item, index) {
					return React.createElement("li", {
						key: item.name + "-" + index, className: "sp-material-item",
					},
						React.createElement("span", { className: "sp-material-name" }, item.name),
						React.createElement("span", { className: "sp-material-meta" },
							formatSize(item.size) + " · " + item.status),
						React.createElement("button", {
							type: "button", className: "sp-btn sp-material-remove",
							onClick: function () { onRemoveMaterial(index); },
						}, t("materialRemove")),
					);
				});
				var materialsBlock = React.createElement("div", { className: "sp-field" },
					React.createElement("div", { className: "sp-row" },
						React.createElement("label", null, t("materialList")),
						React.createElement("button", {
							type: "button", className: "sp-btn sp-material-add",
							onClick: onPickFiles,
						}, t("materialAdd")),
					),
					React.createElement("input", {
						ref: fileRef, className: "sp-material-input", type: "file", multiple: true,
						style: { display: "none" }, onChange: onFilesChosen,
					}),
					React.createElement("ul", { className: "sp-material-list" }, materialItems),
					materials.length === 0
						? React.createElement("p", { className: "sp-hint" }, t("materialEmpty"))
						: null,
				);

				var startButton = React.createElement("button", {
					type: "button",
					className: "sp-btn sp-btn-primary sp-start",
					disabled: !topicReady || busy,
					onClick: onStart,
				}, t("startTask"));

				return React.createElement("div", { className: "sp-view-new-task" },
					React.createElement("h3", { className: "sp-new-title" }, t("newTaskTitle")),
					React.createElement("p", { className: "sp-hint" }, t("newTaskIntro")),
					React.createElement("div", { className: "sp-field" },
						React.createElement("label", null, t("topicLabel")),
						React.createElement("textarea", {
							className: "sp-textarea sp-topic-input", rows: 3,
							placeholder: t("topicPlaceholder"), value: topicDraft,
							onChange: function (event) { setTopicDraft(event.target.value); },
						}),
					),
					React.createElement("div", { className: "sp-quick-row" }, quickChips),
					React.createElement("div", { className: "sp-formats" }, formatCards),
					wsField,
					tplRow,
					tplPicker,
					advancedToggle,
					advancedBody,
					summary,
					materialsBlock,
					React.createElement("div", { className: "sp-actions" }, startButton),
					msg ? React.createElement("p", { className: "sp-state" }, msg) : null,
				);
			}
			return NewTaskView;
		}

		/* ── 最近任务视图（Task 7）：按状态分组、待处理优先 ─────────────
		 * 视图根类名由视图**自持**（不读壳层下发的 props.className）：壳层只按
		 * view 分发，单独渲染该工厂时类名同样成立。
		 *
		 * 分组取 statusGroupOf 的四档，容器类名固定为 sp-group-attention /
		 * sp-group-active / sp-group-failed / sp-group-done，**空分组不渲染**
		 * （没有任务时只剩空态引导，不出现空壳分组）。未归类状态
		 * （cancelled / 未知）并入 active 容器：条目不丢，且状态徽标
		 * sp-task-status 仍显示真实状态，用户不会被分组误判。
		 * 组内按 updatedAt 倒序（最近更新在前）；条目「打开任务」
		 * （sp-task-open）调 onOpen(task)——默认实现返回 viewForStatus(status)
		 * 作为恢复落点判定，Plan 2b 把它接到视图状态机的 outline / progress /
		 * result 三个落点（本任务不新增这三个视图）。
		 */

		/** 最近任务分组表：数组顺序即渲染顺序（待处理优先）。 */
		var SP_RECENT_GROUPS = [
			{ key: "attention", className: "sp-group-attention", label: "groupAttention" },
			{ key: "active", className: "sp-group-active", label: "groupActive" },
			{ key: "failed", className: "sp-group-failed", label: "groupFailed" },
			{ key: "done", className: "sp-group-done", label: "groupDone" },
		];

		/** 任务状态 → 徽标文案键（未知状态回落成状态原文，不渲染空白徽标）。 */
		var SP_TASK_STATUS_KEYS = {
			"creating": "taskStatusCreating",
			"waiting-launch": "taskStatusWaitingLaunch",
			"analyzing": "taskStatusAnalyzing",
			"waiting-outline": "taskStatusWaitingOutline",
			"needs-input": "taskStatusNeedsInput",
			"building": "taskStatusBuilding",
			"reviewing": "taskStatusReviewing",
			"completed": "taskStatusCompleted",
			"failed": "taskStatusFailed",
			"cancelled": "taskStatusCancelled",
		};

		/* ── 大纲页操作纯函数（Plan 2b Task 3a；冒烟直接断言，视图只做 setState 接线）── */

		function clonePages(pages) {
			var source = Array.isArray(pages) ? pages : [];
			return source.map(function (page) {
				return {
					id: String((page && page.id) || ""),
					title: String((page && page.title) || ""),
					purpose: page && page.purpose !== undefined ? String(page.purpose) : "",
					bullets: Array.isArray(page && page.bullets) ? page.bullets.map(function (item) { return String(item); }) : [],
					pageType: page && page.pageType !== undefined ? String(page.pageType) : "",
				};
			});
		}

		function uniquePageId(pages) {
			var used = {};
			for (var i = 0; i < pages.length; i++) used[pages[i].id] = true;
			var n = pages.length + 1;
			while (used["p" + n]) n += 1;
			return "p" + n;
		}

		function movePage(pages, index, delta) {
			var target = index + delta;
			if (index < 0 || index >= pages.length || target < 0 || target >= pages.length) return pages;
			var next = pages.slice();
			var tmp = next[index];
			next[index] = next[target];
			next[target] = tmp;
			return next;
		}

		function copyPage(pages, index) {
			var source = pages[index];
			if (!source) return pages;
			var next = pages.slice();
			next.splice(index + 1, 0, Object.assign({}, clonePages([source])[0], { id: uniquePageId(pages) }));
			return next;
		}

		function addPage(pages, title) {
			return pages.concat([{ id: uniquePageId(pages), title: String(title || ""), purpose: "", bullets: [], pageType: "" }]);
		}

		function removePage(pages, index) {
			if (index < 0 || index >= pages.length) return pages;
			return pages.slice(0, index).concat(pages.slice(index + 1));
		}

		/** 要点文本 → 数组：丢弃空行（空行不是合法要点），内容不 trim 尾随空格原样保留。 */
		function parseBullets(text) {
			return String(text || "").split("\n").filter(function (line) { return line.trim() !== ""; });
		}

		/** 归一化单页（undefined purpose/pageType 与空串等价），供 dirty 比较。 */
		function normalizePage(page) {
			return {
				id: String((page && page.id) || ""),
				title: String((page && page.title) || "").replace(/^\s+|\s+$/g, ""),
				purpose: page && page.purpose !== undefined ? String(page.purpose).replace(/^\s+|\s+$/g, "") : "",
				bullets: (Array.isArray(page && page.bullets) ? page.bullets : []).map(function (item) { return String(item); })
					.filter(function (line) { return line.replace(/^\s+|\s+$/g, "") !== ""; }).join("\n"),
				pageType: page && page.pageType !== undefined ? String(page.pageType).replace(/^\s+|\s+$/g, "") : "",
			};
		}

		/** 本地页数组 vs 已保存页数组是否发生了有效修改（dirty 判定）。 */
		function outlineDiffers(localPages, savedPages) {
			var norm = function (list) { return clonePages(list).map(normalizePage); };
			return JSON.stringify(norm(localPages)) !== JSON.stringify(norm(savedPages));
		}

		/**
		 * 大纲确认视图（Plan 2b Task 3）：任务面板的核心控制点——大纲必须经用户
		 * 确认才会继续生成。直接编辑与自然语言修改都只改「未确认」的本地副本，
		 * 真正落盘经 tasks.outline（新版本），确认经 tasks.confirmOutline（版本
		 * 匹配校验），确认成功后投递继续指令（会话桥）；版本不匹配（Agent 抢先
		 * 提交了新版本）则重取记录、载入新版本并提示再次确认，**不自动确认**。
		 * 类名契约（冒烟断言按此遍历）：
		 * sp-view-outline > sp-outline-head(sp-back/sp-task-title/sp-task-status)
		 * + sp-outline-hint + sp-outline-pages > sp-outline-page(sp-page-index /
		 * sp-page-title / sp-page-purpose / sp-page-bullets / sp-page-type +
		 * sp-page-ops: sp-page-up|sp-page-down|sp-page-copy|sp-page-delete)
		 * + sp-outline-add + sp-outline-dirty-banner(sp-outline-save)
		 * + sp-outline-revise-text + sp-outline-revise + sp-revise-dirty-confirm
		 * > sp-discard-confirm(sp-revise-save / sp-revise-discard)
		 * + sp-outline-confirm + sp-msg-ok / sp-msg-err + sp-outline-resync
		 * + sp-outline-empty（无大纲兜底）。
		 * stub-React 约束：dirty 在渲染期由 outlineDiffers 直算（不落 state）；
		 * 点击后才出现的错误/提示/确认行一律**常驻渲染、按状态切换 display**
		 * ——否则冒烟在首渲染树里观察不到（真实 React 行为不变）。修改区因
		 * sp-outline-revise 的容器与按钮同名，不建同名容器包裹（否则精确类名
		 * 断言会先命中容器拿不到 onClick），textarea 与按钮并列挂在视图根下。
		 * 优先级契约（实现后审查修正）：task/onUpdated/onBack 支持经组件 **props**
		 * 传入且优先于工厂 options（宿主轮询 re-render 传 live props；冒烟与独立
		 * 渲染以工厂 options 传参——props 未传即 `undefined` 时回落 opts）。
		 * api/sendToSession 保持工厂级（壳层传稳定引用）。组件类型由壳层
		 * ensureDetailView 按 (sub|taskId) 缓存，保证 re-render 不 remount。
		 * options/props: { task, api, sendToSession, onUpdated, onBack,
		 *   initialPages?(仅测试), reviseText?(仅测试) }
		 */
		function makeOutlineReviewView(t, options) {
			var opts = options || {};
			var apiFn = typeof opts.api === "function" ? opts.api : api;
			var send = typeof opts.sendToSession === "function" ? opts.sendToSession : null;
			var PAGE_TYPE_KEYS = ["pageTypeTitle", "pageTypeSummary", "pageTypeKpi", "pageTypeTrend",
				"pageTypeCompare", "pageTypeTimeline", "pageTypeFlow", "pageTypeCase", "pageTypePlan", "pageTypeEnd"];

			function OutlineReview(props) {
				// props 优先、opts 兜底：live task 与回调每渲染从 props 读（宿主
				// 轮询只换 props 不换组件类型）；savedPages 是 task 的派生值——
				// dirty 基线随宿主记录前移，不再 useRef 手管。
				var p = props || {};
				var task = (p.task !== undefined) ? p.task : opts.task || null;
				var updatedCb = (p.onUpdated !== undefined) ? p.onUpdated : opts.onUpdated;
				var backCb = (p.onBack !== undefined) ? p.onBack : opts.onBack;
				var onUpdated = typeof updatedCb === "function" ? updatedCb : function () {};
				var onBack = typeof backCb === "function" ? backCb : function () {};
				var savedPages = task && task.outline && Array.isArray(task.outline.pages) ? task.outline.pages : [];
				var pagesState = React.useState(typeof opts.initialPages === "function" ? opts.initialPages() : (opts.initialPages ? clonePages(opts.initialPages) : clonePages(savedPages)));
				var pages = pagesState[0], setPages = pagesState[1];
				var busyState = React.useState("");
				var busy = busyState[0], setBusy = busyState[1];
				var errorState = React.useState("");
				var error = errorState[0], setError = errorState[1];
				var reviseState = React.useState(typeof opts.reviseText === "string" ? opts.reviseText : "");
				var reviseText = reviseState[0], setReviseText = reviseState[1];
				var discardState = React.useState(""); // "" | "back" | "revise"：未保存确认行的模式
				var discard = discardState[0], setDiscard = discardState[1];
				var resyncState = React.useState(false); // 「已有新版本，已重新载入」独立态
				var resync = resyncState[0], setResync = resyncState[1];
				var noticeState = React.useState(""); // 保存成功等非错误提示
				var notice = noticeState[0], setNotice = noticeState[1];
				// dirty 的真实来源：渲染期直接对比 pages 与「已保存基线」savedPages。
				// 基线即当前渲染 task 的 outline.pages（props 优先）——保存/重取成功
				// 经 onUpdated(record) 让宿主换 active，下一渲染 savedPages 即新版本。

				function dirtyNow() { return outlineDiffers(pages, savedPages); }
				function applyPages(next) { setPages(next); /* dirty 由下一渲染重算 */ }
				function editPage(index, patch) {
					setPages(pages.map(function (page, i) { return i === index ? Object.assign({}, page, patch) : page; }));
				}
				function wsId() { return task && task.workspace && task.workspace.id; }
				function statusText(status) {
					var raw = String(status || "");
					return SP_TASK_STATUS_KEYS[raw] ? t(SP_TASK_STATUS_KEYS[raw]) : raw;
				}

				function saveOutlineEdits() {
					return apiFn("tasks.outline", { id: task.id, pages: pages });
				}
				function saveOnly() {
					setBusy("save"); setError(""); setNotice("");
					return saveOutlineEdits().then(function (saved) {
						setBusy(""); setNotice(t("saved"));
						// dirty 基线前移交给宿主：saved（tasks.outline 返回记录，含新
						// outlineVersion/归一化 outline）→ setActive → props 更新。
						onUpdated(saved);
					}).catch(function (error) {
						setBusy(""); setError(String((error && error.message) || error));
					});
				}

				function confirmOutlineEdits() {
					setBusy("confirm"); setError(""); setNotice(""); setResync(false); setDiscard("");
					var prepare = dirtyNow() ? saveOutlineEdits() : Promise.resolve(task);
					return prepare.then(function (current) {
						return apiFn("tasks.confirmOutline", { id: task.id, version: (current && current.outlineVersion) || 0 });
					}).then(function (confirmed) {
						var delivery = send ? Promise.resolve(send(buildContinuePrompt(confirmed), wsId())) : Promise.resolve("none");
						return Promise.resolve(delivery).then(function (phase) {
							if (phase === "submitted") { onUpdated(confirmed); return; }
							setBusy("");
							setError(t(phase === "copied" ? "outlineCopiedHint" : "outlineSendFailed"));
						});
					}).catch(function (error) {
						setBusy("");
						var message = String((error && error.message) || error);
						if (message.indexOf("版本不匹配") !== -1) {
							// Agent 可能已提交新版本：重取记录、载入新版本、回确认态（不自动确认）
							apiFn("tasks.get", { id: task.id }).then(function (next) {
								if (next && next.outline && Array.isArray(next.outline.pages)) {
									setPages(clonePages(next.outline.pages));
									setResync(true);
									// 基线前移经宿主：onUpdated(next) 换 active → props
									// task 更新，savedPages 即新版本（本地编辑副本已被
									// setPages 载入 Agent 版本，dirty 归零）。
									onUpdated(next);
								}
							}).catch(function () {});
							return;
						}
						setError(message);
					});
				}

				function reviseOutline() {
					if (String(reviseText).replace(/^\s+|\s+$/g, "") === "") { setError(t("outlineReviseEmpty")); return; }
					if (dirtyNow()) { setDiscard("revise"); return; }
					return deliverRevise(false);
				}
				/** saveFirst=true：保存并修改；false：先丢弃本地改动再让 Agent 修改。 */
				function deliverRevise(saveFirst) {
					setBusy("revise"); setError(""); setNotice(""); setDiscard(""); setResync(false);
					var prepared = saveFirst ? saveOutlineEdits() : Promise.resolve(null);
					return Promise.resolve(prepared).then(function () {
						if (!saveFirst) { setPages(clonePages(savedPages)); }
						var delivery = send ? Promise.resolve(send(buildOutlineRevisePrompt(task, reviseText), wsId())) : Promise.resolve("none");
						return Promise.resolve(delivery).then(function (phase) {
							if (phase !== "submitted") { setBusy(""); setError(t(phase === "copied" ? "outlineCopiedHint" : "outlineSendFailed")); return; }
							return apiFn("tasks.update", { id: task.id, patch: { status: "analyzing" } }).then(function (next) {
								onUpdated(next);
							});
						});
					}).catch(function (error) { setBusy(""); setError(String((error && error.message) || error)); });
				}
				function discardAndRevise() {
					setPages(clonePages(savedPages)); // 「丢弃修改」：回到已保存基线
					return deliverRevise(false);
				}
				function requestBack() {
					if (dirtyNow()) { setDiscard("back"); return; }
					onBack();
				}

				function pageCard(page, index) {
					var num = ("0" + (index + 1)).slice(-2);
					function textInput(cls, field) {
						return React.createElement("input", {
							className: cls, type: "text", value: page[field], disabled: busy !== "",
							onChange: function (e) {
								var patch = {};
								patch[field] = String((e && e.target && e.target.value) || "");
								editPage(index, patch);
							},
						});
					}
					return React.createElement("div", { className: "sp-outline-page", key: String(page.id || "page-" + index) },
						React.createElement("span", { className: "sp-page-index" }, t("outlinePageNo") + " " + num),
						textInput("sp-page-title", "title"),
						textInput("sp-page-purpose", "purpose"),
						React.createElement("textarea", {
							className: "sp-page-bullets", rows: 3, disabled: busy !== "",
							value: (page.bullets || []).join("\n"),
							onChange: function (e) { editPage(index, { bullets: parseBullets((e && e.target && e.target.value) || "") }); },
						}),
						React.createElement("select", {
							className: "sp-page-type", value: page.pageType, disabled: busy !== "",
							onChange: function (e) { editPage(index, { pageType: String((e && e.target && e.target.value) || "") }); },
						}, PAGE_TYPE_KEYS.map(function (key) {
							return React.createElement("option", { key: key, value: t(key) }, t(key));
						})),
						React.createElement("div", { className: "sp-page-ops" },
							React.createElement("button", { type: "button", className: "sp-page-up", disabled: index === 0 || busy !== "", onClick: function () { applyPages(movePage(pages, index, -1)); } }, "↑"),
							React.createElement("button", { type: "button", className: "sp-page-down", disabled: index >= pages.length - 1 || busy !== "", onClick: function () { applyPages(movePage(pages, index, 1)); } }, "↓"),
							React.createElement("button", { type: "button", className: "sp-page-copy", disabled: busy !== "", onClick: function () { applyPages(copyPage(pages, index)); } }, "⧉"),
							React.createElement("button", { type: "button", className: "sp-page-delete", disabled: busy !== "" || pages.length === 1, onClick: function () { applyPages(removePage(pages, index)); } }, t("delete")),
						),
					);
				}

				var head = React.createElement("div", { className: "sp-outline-head" },
					React.createElement("button", { type: "button", className: "sp-back", onClick: function () { requestBack(); } }, t("backToRecent")),
					React.createElement("span", { className: "sp-task-title" }, String((task && task.title) || "")),
					React.createElement("span", { className: "sp-task-status" }, statusText(task && task.status)),
				);
				// 兜底空态：无大纲记录（Agent 还没提交）——不渲染编辑面与确认按钮
				if (savedPages.length === 0) {
					return React.createElement("div", { className: "sp-view-outline" }, head,
						React.createElement("div", { className: "sp-outline-empty" }, t("outlineEmpty")));
				}
				var dirty = dirtyNow();
				return React.createElement("div", { className: "sp-view-outline" },
					head,
					React.createElement("div", { className: "sp-outline-hint" }, String(t("outlineHint")).replace("{n}", String(pages.length))),
					React.createElement("div", { className: "sp-outline-pages" }, pages.map(pageCard)),
					React.createElement("button", { type: "button", className: "sp-outline-add", disabled: busy !== "", onClick: function () { applyPages(addPage(pages, t("pageNew"))); } }, t("outlineAdd")),
					dirty ? React.createElement("div", { className: "sp-outline-dirty-banner" },
						React.createElement("span", null, t("outlineDirty")),
						React.createElement("button", {
							type: "button", className: "sp-outline-save", disabled: busy !== "",
							onClick: function () { return saveOnly(); },
						}, busy === "save" ? t("outlineSaving") : t("outlineSave")),
					) : null,
					React.createElement("textarea", {
						className: "sp-outline-revise-text", rows: 2, disabled: busy !== "",
						placeholder: t("outlineRevise"), value: reviseText,
						onChange: function (e) { setReviseText(String((e && e.target && e.target.value) || "")); },
					}),
					React.createElement("button", {
						type: "button", className: "sp-outline-revise", disabled: busy !== "",
						onClick: function () { return reviseOutline(); },
					}, busy === "revise" ? t("outlineSaving") : t("outlineRevise")),
					React.createElement("div", { className: "sp-revise-dirty-confirm", style: { display: discard === "" ? "none" : "flex" } },
						React.createElement("div", { className: "sp-discard-confirm" },
							discard === "back"
								? [
									React.createElement("span", { key: "hint" }, t("outlineBackDirty")),
									React.createElement("button", { key: "go", type: "button", className: "sp-btn", disabled: busy !== "", onClick: function () { onBack(); } }, t("outlineStillBack")),
									React.createElement("button", { key: "stay", type: "button", className: "sp-btn", disabled: busy !== "", onClick: function () { setDiscard(""); } }, t("outlineStayEditing")),
								]
								: [
									React.createElement("span", { key: "hint" }, t("outlineReviseDirty")),
									React.createElement("button", { key: "save", type: "button", className: "sp-revise-save", disabled: busy !== "", onClick: function () { return deliverRevise(true); } }, t("outlineSaveAndRevise")),
									React.createElement("button", { key: "discard", type: "button", className: "sp-revise-discard", disabled: busy !== "", onClick: function () { return discardAndRevise(); } }, t("outlineDiscard")),
								],
						),
					),
					React.createElement("button", {
						type: "button", className: "sp-outline-confirm", disabled: busy !== "" || pages.length === 0,
						onClick: function () { return confirmOutlineEdits(); },
					}, busy === "confirm" ? t("outlineSaving") : t("outlineConfirm")),
					React.createElement("div", { className: "sp-msg-ok", style: { display: notice ? "block" : "none" } }, notice),
					React.createElement("div", { className: "sp-outline-resync", style: { display: resync ? "block" : "none" } }, t("outlineResync")),
					React.createElement("div", { className: "sp-msg-err", style: { display: error ? "block" : "none" } }, error),
				);
			}
			return OutlineReview;
		}

		/* ── 生成进度视图纯函数（Plan 2b Task 4；冒烟直接断言）── */

		/** 最近一条指定 kind 的事件（无 → null）。fail 原因 / needs-input 问题都用它。
		 *  events 按 host 追加序（旧→新）排列，从尾向前扫。 */
		function lastEventOfKind(task, kind) {
			var events = (task && task.events) || [];
			for (var i = events.length - 1; i >= 0; i--) {
				if (events[i] && events[i].kind === kind) return events[i];
			}
			return null;
		}

		/** 固定六阶段 → 步进列表（agent 汇报的 index/total 线性映射到六步）。 */
		var SP_STAGES = ["stageReceive", "stageAnalyze", "stageOutline", "stageBuild", "stagePackage", "stageReview"];

		function progressSteps(stage) {
			// 计划骨架此处写 active = SP_STAGES.length——与断言判定式（全 pending）及
			// 骨架注释「无汇报：全部 pending（尾步不算进行中）」矛盾，按语义取 0。
			var active = 0; // 无汇报：全部 pending
			var index = stage && Number(stage.index), total = stage && Number(stage.total);
			if (index > 0 && total > 0) {
				active = Math.min(SP_STAGES.length, Math.max(1, Math.ceil((index / total) * SP_STAGES.length)));
			}
			return SP_STAGES.map(function (key, i) {
				return { key: key, state: i + 1 < active ? "done" : i + 1 === active ? "active" : "pending" };
			});
		}

		/** agent 上报的阶段键（analyzing/planning/building/reviewing）→ 六阶段标签键。 */
		var SP_STAGE_KEY_LABELS = {
			analyzing: "stageAnalyze", planning: "stageAnalyze",
			building: "stageBuild", reviewing: "stageReview",
		};

		/**
		 * 生成进度视图（Plan 2b Task 4）：六阶段时间线 + 阶段详情 + 事件流，
		 * 四个状态变体按 task.status 条件渲染——启动恢复区（waiting-launch）/
		 * 补充信息区（needs-input）/ 错误恢复区（failed）/ 只读终态（cancelled）；
		 * D1 把 creating/waiting-launch/analyzing/building/reviewing/needs-input/
		 * failed/cancelled 全部落在这里。D2 硬约束：取消 = tasks.update
		 * status:'cancelled'（仅活跃态渲染按钮），**不做 paused**。
		 * 重试启动 = 重投完整 Brief（buildTaskPrompt），submitted 后推 analyzing；
		 * 发送补充 = buildNeedsInputPrompt（问题取最后一条 needs-input 事件），
		 * submitted 后回 building；重试当前阶段 = buildContinuePrompt，**不自动
		 * 改状态**（Agent 自己经 ppts_task 推进）。打开会话走壳层注入的
		 * openSession（Task 6 接桥；本任务冒烟传 stub）。
		 * 类名契约（冒烟按 token 精确匹配，不与 sp-btn 复合拼接；sp-event 行内
		 * 时间/文本不再设类名，避免子串误计）：
		 * sp-view-progress > sp-progress-head(sp-back/sp-task-title/sp-task-status)
		 * + sp-progress-line + sp-steps > sp-step(sp-step-done|sp-step-active|
		 * sp-step-pending)×6 + sp-progress-detail + sp-progress-events > sp-event
		 * + sp-launch-recovery(sp-launch-retry/sp-launch-cancel) + sp-needs-input
		 * (sp-input-answer/sp-needs-input-send) + sp-error-recovery(sp-fail-retry/
		 * sp-fail-back-outline) + sp-cancel + sp-open-session + sp-terminal-note
		 * + sp-msg-ok / sp-msg-err。
		 * stub-React 约束：点击后出现的提示/错误行常驻渲染、display 切换；
		 * answerText 仅测试注入初值（真实 React 受控输入）。
		 * 优先级契约（实现后审查修正）：task 与 onUpdated/onBack/onBackToOutline/
		 * openSession 支持经组件 **props** 传入且优先于工厂 options（宿主每渲染传
		 * live props；props 值为 `undefined` 视为未传 → 回落 opts/默认 noop）；
		 * api/sendToSession 保持工厂级（壳层传稳定引用）。组件类型由壳层
		 * ensureDetailView 缓存，轮询 re-render 不 remount。
		 * options/props: { task, api, sendToSession, onUpdated, onBack,
		 *   onBackToOutline, openSession, answerText?(仅测试) }
		 */
		function makeProgressView(t, options) {
			var opts = options || {};
			var apiFn = typeof opts.api === "function" ? opts.api : api;
			var send = typeof opts.sendToSession === "function" ? opts.sendToSession : null;
			var savedAnswer = typeof opts.answerText === "string" ? opts.answerText : "";

			function Progress(props) {
				// props 优先、opts 兜底（同大纲视图）：状态变体按**本次渲染的 task**
				// 判定——轮询把 building→reviewing→…推到哪里，视图就渲染哪里。
				var p = props || {};
				var task = (p.task !== undefined) ? p.task : opts.task || null;
				var updatedCb = (p.onUpdated !== undefined) ? p.onUpdated : opts.onUpdated;
				var backCb = (p.onBack !== undefined) ? p.onBack : opts.onBack;
				var backOutlineCb = (p.onBackToOutline !== undefined) ? p.onBackToOutline : opts.onBackToOutline;
				var openSessionCb = (p.openSession !== undefined) ? p.openSession : opts.openSession;
				var onUpdated = typeof updatedCb === "function" ? updatedCb : function () {};
				var onBack = typeof backCb === "function" ? backCb : function () {};
				var onBackToOutline = typeof backOutlineCb === "function" ? backOutlineCb : function () {};
				var openSession = typeof openSessionCb === "function" ? openSessionCb : function () {};
				var status = String((task && task.status) || "");
				// D2：取消按钮仅活跃态在场（creating/waiting-launch 也在进度视图落点内）
				var cancelable = status === "creating" || status === "waiting-launch" || status === "analyzing"
					|| status === "building" || status === "reviewing";
				var failEvent = status === "failed" ? lastEventOfKind(task, "fail") : null;
				var questionEvent = status === "needs-input" ? lastEventOfKind(task, "needs-input") : null;
				var answerState = React.useState(savedAnswer);
				var answer = answerState[0], setAnswer = answerState[1];
				var busyState = React.useState("");
				var busy = busyState[0], setBusy = busyState[1];
				var errorState = React.useState("");
				var error = errorState[0], setError = errorState[1];
				var noticeState = React.useState("");
				var notice = noticeState[0], setNotice = noticeState[1];

				function wsId() { return task && task.workspace && task.workspace.id; }
				function statusText(s) {
					var raw = String(s || "");
					return SP_TASK_STATUS_KEYS[raw] ? t(SP_TASK_STATUS_KEYS[raw]) : raw;
				}
				function deliveryText(text) {
					return Promise.resolve(send ? send(text, wsId()) : "none");
				}
				function deliveryError(phase) {
					return t(phase === "copied" ? "outlineCopiedHint" : "outlineSendFailed");
				}
				function failLike(errorValue) {
					setBusy("");
					setError(String((errorValue && errorValue.message) || errorValue));
				}

				/** 重试启动：重投完整 Brief → submitted 才推 analyzing（copied/none 停留待重试）。 */
				function retryLaunch() {
					if (!task) return Promise.resolve();
					setBusy("launch"); setError(""); setNotice("");
					return deliveryText(buildTaskPrompt(task)).then(function (phase) {
						if (phase !== "submitted") { setBusy(""); setError(deliveryError(phase)); return; }
						return apiFn("tasks.update", { id: task.id, patch: { status: "analyzing" } }).then(function (next) {
							setBusy(""); onUpdated(next);
						});
					}).catch(failLike);
				}
				/** 发送补充信息：问题取面板展示的同一条事件 → submitted 后回 building。 */
				function sendAnswer() {
					if (!task) return Promise.resolve();
					setBusy("answer"); setError(""); setNotice("");
					var text;
					try {
						text = buildNeedsInputPrompt(task, questionEvent ? questionEvent.text : "", answer);
					} catch (inputError) { setBusy(""); setError(String((inputError && inputError.message) || inputError)); return Promise.resolve(); }
					return deliveryText(text).then(function (phase) {
						if (phase !== "submitted") { setBusy(""); setError(deliveryError(phase)); return; }
						return apiFn("tasks.update", { id: task.id, patch: { status: "building" } }).then(function (next) {
							setBusy(""); onUpdated(next);
						});
					}).catch(failLike);
				}
				/** 重试当前阶段：只重投继续指令，**不自动改状态**（Agent 经 ppts_task 推进）。 */
				function retryStage() {
					if (!task) return Promise.resolve();
					setBusy("retry"); setError(""); setNotice("");
					return deliveryText(buildContinuePrompt(task)).then(function (phase) {
						setBusy("");
						if (phase === "submitted") { setNotice(t("continueSent")); return; }
						setError(deliveryError(phase));
					}).catch(failLike);
				}
				/** 取消任务（D2）：标 cancelled，仅停面板轮询与推进，不碰 Agent 会话。 */
				function requestCancel() {
					if (!task) return Promise.resolve();
					setBusy("cancel"); setError(""); setNotice("");
					return apiFn("tasks.update", { id: task.id, patch: { status: "cancelled" } }).then(function (next) {
						setBusy(""); onUpdated(next);
					}).catch(failLike);
				}

				var stage = task && task.stage;
				var steps = progressSteps(stage);
				var events = ((task && task.events) || []).slice(-5).reverse();
				var stageLabel = stage && stage.key
					? (SP_STAGE_KEY_LABELS[stage.key] ? t(SP_STAGE_KEY_LABELS[stage.key]) : String(stage.key))
					: "";
				var line = stage && Number(stage.index) > 0 && stageLabel
					? String(t("progressStageLine")).replace("{i}", String(Number(stage.index))).replace("{n}", String(Number(stage.total) || 0)).replace("{label}", stageLabel)
					: t("waitingStage");

				var head = React.createElement("div", { className: "sp-progress-head" },
					React.createElement("button", { type: "button", className: "sp-back", onClick: function () { onBack(); } }, t("backToRecent")),
					React.createElement("span", { className: "sp-task-title" }, String((task && task.title) || "")),
					React.createElement("span", { className: "sp-task-status" }, statusText(status)),
				);
				var children = [
					head,
					React.createElement("div", { className: "sp-progress-line" }, line),
					React.createElement("div", { className: "sp-steps" }, steps.map(function (step, i) {
						return React.createElement("div", { className: "sp-step sp-step-" + step.state, key: step.key },
							React.createElement("span", { className: "sp-step-idx" }, String(i + 1)),
							React.createElement("span", null, t(step.key)));
					})),
					stage && stage.detail ? React.createElement("div", { className: "sp-progress-detail" }, String(stage.detail)) : null,
					React.createElement("div", { className: "sp-progress-events" }, events.map(function (event, i) {
						return React.createElement("div", { className: "sp-event", key: String(i) }, formatDate(event && event.at) + " · " + String((event && event.text) || ""));
					})),
				];
				if (status === "waiting-launch") {
					children.push(React.createElement("div", { className: "sp-launch-recovery" },
						React.createElement("span", null, t("launchRecovery")),
						React.createElement("button", { type: "button", className: "sp-launch-retry", disabled: busy !== "", onClick: function () { return retryLaunch(); } }, t("launchRetry")),
						React.createElement("button", { type: "button", className: "sp-launch-cancel", disabled: busy !== "", onClick: function () { return requestCancel(); } }, t("cancelTask")),
					));
				}
				if (status === "needs-input") {
					children.push(React.createElement("div", { className: "sp-needs-input" },
						React.createElement("span", null, t("needsInput")),
						React.createElement("span", null, questionEvent ? String(questionEvent.text || "") : ""),
						React.createElement("textarea", {
							className: "sp-input-answer", rows: 3, disabled: busy !== "",
							placeholder: t("inputAnswer"), value: answer,
							onChange: function (e) { setAnswer(String((e && e.target && e.target.value) || "")); },
						}),
						React.createElement("button", { type: "button", className: "sp-needs-input-send", disabled: busy !== "", onClick: function () { return sendAnswer(); } }, t("inputSend")),
					));
				}
				if (status === "failed") {
					children.push(React.createElement("div", { className: "sp-error-recovery" },
						React.createElement("span", null, t("errorRecovery")),
						React.createElement("span", null, failEvent ? String(failEvent.text || "") : ""),
						React.createElement("button", { type: "button", className: "sp-fail-retry", disabled: busy !== "", onClick: function () { return retryStage(); } }, t("failRetry")),
						React.createElement("button", { type: "button", className: "sp-fail-back-outline", disabled: busy !== "", onClick: function () { onBackToOutline(); } }, t("failBackOutline")),
					));
				}
				if (cancelable) {
					children.push(React.createElement("button", { type: "button", className: "sp-cancel", disabled: busy !== "", onClick: function () { return requestCancel(); } }, t("cancelTask")));
				}
				if (status === "cancelled") {
					children.push(React.createElement("div", { className: "sp-terminal-note" }, t("terminalNote")));
				}
				children.push(React.createElement("button", { type: "button", className: "sp-open-session", onClick: function () { openSession(); } }, t("openSession")));
				children.push(React.createElement("div", { className: "sp-msg-ok", style: { display: notice ? "block" : "none" } }, notice));
				children.push(React.createElement("div", { className: "sp-msg-err", style: { display: error ? "block" : "none" } }, error));
				return React.createElement("div", { className: "sp-view-progress" }, children);
			}
			return Progress;
		}

		/**
		 * 复制一段路径/文案到剪贴板（结果视图产物条目的「复制路径」）。
		 * navigator.clipboard 优先（真实浏览器），其次显式 impl 注入
		 * （{ writeText } 形状，供冒烟替换）；两者皆缺静默 resolve——
		 * 复制失败绝不抛错打断任务流。返回 Promise。
		 */
		function copyText(text, impl) {
			var value = String(text == null ? "" : text);
			try {
				if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
					return Promise.resolve(navigator.clipboard.writeText(value)).catch(function () {});
				}
				if (impl && typeof impl.writeText === "function") {
					return Promise.resolve(impl.writeText(value)).catch(function () {});
				}
			} catch (error) { /* 剪贴板拒绝：静默降级 */ }
			return Promise.resolve();
		}

		/**
		 * 结果视图（Plan 2b Task 5）：已完成任务的产物清单 + 自然语言继续修改。
		 * D3 硬约束：产物**无下载路由**——条目操作是「复制路径」（copyText，
		 * 路径是工作区绝对路径，用户拿去文件管理器/终端）与丢失时的「重新生成」
		 * （buildRegeneratePrompt 经会话桥重投，不改状态——Agent 经 ppts_task
		 * 推进）。继续修改 = buildContinueEditPrompt 投递会话桥，submitted 后
		 * tasks.update status:'building' → onUpdated（壳层路由自动进进度视图）；
		 * copied/none → sp-msg-err，不发 tasks.update。
		 * 摘要行：页数取 task.outline.pages.length、交付形态取 task.brief.format；
		 * 措辞按形态选键（实现后审查修正）——html → resultSummaryHtml，其余 →
		 * resultSummaryPptx（均为 {pages} 占位模板，locale 未命中（t 原样回
		 * key）时回退内置 zh 同名模板——与 bundle 兜底 t 的 zh 优先语义一致）。
		 * 快捷 chip 四个：onClick 只把模板文案填进文本框（setContinueText），
		 * **不直接发送**。missing 条目渲染 sp-artifact-regen。
		 * stub-React 约束：continueText 仅测试注入初值（真实 React 受控输入，
		 * Task 3/4 reviseText/answerText 同法）；sp-msg-ok / sp-msg-err 常驻
		 * 渲染、display 切换。
		 * 类名契约（冒烟 token 全等筛选条目，子元素类名含 sp-artifact 前缀
		 * 不参与计数；不与 sp-btn 复合拼接）：
		 * sp-view-result > sp-result-head(sp-back/sp-task-title/sp-task-status)
		 * + sp-result-summary + sp-artifacts > sp-artifact(sp-artifact-type/
		 * sp-artifact-status/sp-artifact-path/sp-artifact-copy/sp-artifact-regen)
		 * | sp-artifacts-empty + sp-result-continue(sp-result-continue-text/
		 * sp-result-submit/sp-result-quick > sp-result-quick-chip×4)
		 * + sp-msg-ok / sp-msg-err。
		 * 优先级契约（实现后审查修正）：task 与 onUpdated/onBack 支持经组件
		 * **props** 传入且优先于工厂 options（props 值为 `undefined` 视为未传 →
		 * 回落 opts/默认 noop）；api/sendToSession 保持工厂级（壳层传稳定引用）。
		 * 组件类型由壳层 ensureDetailView 缓存，轮询 re-render 不 remount。
		 * options/props: { task, api, sendToSession, onUpdated, onBack, continueText?(仅测试) }
		 */
		function makeResultView(t, options) {
			var opts = options || {};
			var apiFn = typeof opts.api === "function" ? opts.api : api;
			var send = typeof opts.sendToSession === "function" ? opts.sendToSession : null;
			var savedContinue = typeof opts.continueText === "string" ? opts.continueText : "";
			// 快捷 chip：label 即填入文案（双语走字典；填入不发送）
			var QUICK_KEYS = ["quickRedoPage", "quickRestyle", "quickShrink", "quickRerender"];

			function Result(props) {
				// props 优先、opts 兜底（同大纲/进度视图）：产物清单与摘要按
				// **本次渲染的 task** 计算——继续修改回 building 后轮询推到这里，
				// 渲染的是最新 artifacts 投影。
				var p = props || {};
				var task = (p.task !== undefined) ? p.task : opts.task || null;
				var updatedCb = (p.onUpdated !== undefined) ? p.onUpdated : opts.onUpdated;
				var backCb = (p.onBack !== undefined) ? p.onBack : opts.onBack;
				var onUpdated = typeof updatedCb === "function" ? updatedCb : function () {};
				var onBack = typeof backCb === "function" ? backCb : function () {};
				var artifacts = task && Array.isArray(task.artifacts) ? task.artifacts : [];
				var busyState = React.useState("");
				var busy = busyState[0], setBusy = busyState[1];
				var errorState = React.useState("");
				var error = errorState[0], setError = errorState[1];
				var noticeState = React.useState("");
				var notice = noticeState[0], setNotice = noticeState[1];
				var continueState = React.useState(savedContinue);
				var continueDraft = continueState[0], setContinueText = continueState[1];

				function wsId() { return task && task.workspace && task.workspace.id; }
				function statusText(s) {
					var raw = String(s || "");
					return SP_TASK_STATUS_KEYS[raw] ? t(SP_TASK_STATUS_KEYS[raw]) : raw;
				}
				function deliveryText(text) {
					return Promise.resolve(send ? send(text, wsId()) : "none");
				}
				function deliveryError(phase) {
					return t(phase === "copied" ? "outlineCopiedHint" : "outlineSendFailed");
				}
				function failLike(errorValue) {
					setBusy("");
					setError(String((errorValue && errorValue.message) || errorValue));
				}

				/** 复制路径：copyText 内部已静默降级，这里只给成功反馈。 */
				function copyArtifactPath(artifact) {
					setBusy("copy"); setError(""); setNotice("");
					return copyText(artifact && artifact.path).then(function () {
						setBusy(""); setNotice(t("pathCopied"));
					}).catch(failLike);
				}
				/** 重新生成丢失产物：只投递指令，不改状态（Agent 经 ppts_task 推进）。 */
				function regenerateArtifact(artifact) {
					if (!task) return Promise.resolve();
					setBusy("regen"); setError(""); setNotice("");
					return deliveryText(buildRegeneratePrompt(task, artifact)).then(function (phase) {
						setBusy("");
						if (phase !== "submitted") { setError(deliveryError(phase)); return; }
						setNotice(t("resultRegenSent"));
					}).catch(failLike);
				}
				/** 提交修改：buildContinueEditPrompt → submitted 才推 building。 */
				function submitContinueEdit() {
					if (!task) return Promise.resolve();
					var text;
					try {
						text = buildContinueEditPrompt(task, continueDraft);
					} catch (inputError) {
						setError(String((inputError && inputError.message) || inputError));
						return Promise.resolve();
					}
					setBusy("continue"); setError(""); setNotice("");
					return deliveryText(text).then(function (phase) {
						if (phase !== "submitted") { setBusy(""); setError(deliveryError(phase)); return; }
						return apiFn("tasks.update", { id: task.id, patch: { status: "building" } }).then(function (next) {
							setBusy(""); onUpdated(next);
						});
					}).catch(failLike);
				}

				var pageCount = task && task.outline && Array.isArray(task.outline.pages) ? task.outline.pages.length : 0;
				var deliverableFormat = task && task.brief && task.brief.format ? String(task.brief.format) : "";
				// 摘要措辞按交付形态分流（实现后审查修正）：html → resultSummaryHtml
				// （在线演示），其余 → resultSummaryPptx（可编辑 PPTX）；不再填
				// {format} 原值。locale 未命中（t 原样回 key）时回退内置 zh 同名模板。
				var summaryKey = deliverableFormat === "html" ? "resultSummaryHtml" : "resultSummaryPptx";
				var summaryTpl = String(t(summaryKey));
				var summaryText = fill(summaryTpl.indexOf("{pages}") !== -1 ? summaryTpl : String(zh[summaryKey]), {
					pages: pageCount,
				});

				var head = React.createElement("div", { className: "sp-result-head" },
					React.createElement("button", { type: "button", className: "sp-back", onClick: function () { onBack(); } }, t("backToRecent")),
					React.createElement("span", { className: "sp-task-title" }, String((task && task.title) || "")),
					React.createElement("span", { className: "sp-task-status" }, statusText(task && task.status)),
				);
				var children = [
					head,
					React.createElement("div", { className: "sp-result-summary" }, summaryText),
				];
				if (artifacts.length > 0) {
					children.push(React.createElement("div", { className: "sp-artifacts" }, artifacts.map(function (artifact, i) {
						// 状态徽标：ready→可用 / missing→丢失提示 / 其它（error）→原文
						var st = String((artifact && artifact.status) || "ready");
						var statusLabel = st === "ready" ? t("artifactReady") : st === "missing" ? t("artifactMissing") : st;
						return React.createElement("div", { className: "sp-artifact", key: "artifact-" + String(i) },
							React.createElement("span", { className: "sp-artifact-type" }, String((artifact && artifact.type) || "").toUpperCase()),
							React.createElement("span", { className: "sp-artifact-status" }, statusLabel),
							React.createElement("span", { className: "sp-artifact-path" }, String((artifact && artifact.path) || "")),
							React.createElement("button", {
								type: "button", className: "sp-artifact-copy", disabled: busy !== "",
								onClick: function () { return copyArtifactPath(artifact); },
							}, t("copyPath")),
							st === "missing" ? React.createElement("button", {
								type: "button", className: "sp-artifact-regen", disabled: busy !== "",
								onClick: function () { return regenerateArtifact(artifact); },
							}, t("artifactRegen")) : null,
						);
					})));
				} else {
					children.push(React.createElement("div", { className: "sp-artifacts-empty" }, t("artifactsEmpty")));
				}
				children.push(React.createElement("div", { className: "sp-result-continue" },
					React.createElement("span", null, t("continueEdit")),
					React.createElement("textarea", {
						className: "sp-result-continue-text", rows: 3, disabled: busy !== "",
						placeholder: t("continueEdit"), value: continueDraft,
						onChange: function (e) { setContinueText(String((e && e.target && e.target.value) || "")); },
					}),
					React.createElement("button", {
						type: "button", className: "sp-result-submit", disabled: busy !== "",
						onClick: function () { return submitContinueEdit(); },
					}, t("continueSubmit")),
					React.createElement("div", { className: "sp-result-quick" }, QUICK_KEYS.map(function (key) {
						return React.createElement("button", {
							type: "button", className: "sp-result-quick-chip", key: key, disabled: busy !== "",
							onClick: function () { setContinueText(String(t(key))); },
						}, t(key));
					})),
				));
				children.push(React.createElement("div", { className: "sp-msg-ok", style: { display: notice ? "block" : "none" } }, notice));
				children.push(React.createElement("div", { className: "sp-msg-err", style: { display: error ? "block" : "none" } }, error));
				return React.createElement("div", { className: "sp-view-result" }, children);
			}
			return Result;
		}

		function makeRecentView(t, options) {
			var opts = options || {};
			var tasks = Array.isArray(opts.tasks) ? opts.tasks : [];
			var loadErr = opts.loadErr ? String(opts.loadErr) : "";
			var refresh = typeof opts.refresh === "function" ? opts.refresh : function () {};
			// 打开任务的落点：默认只做「状态 → 视图」判定（Plan 2b 接视图状态机）
			var onOpen = typeof opts.onOpen === "function" ? opts.onOpen : function (task) {
				return viewForStatus(task && task.status);
			};
			// 空态引导的去向：默认回「新建任务」（同 viewForStatus 的兜底落点）
			var onNewTask = typeof opts.onNewTask === "function" ? opts.onNewTask : function () {
				return SP_VIEW_NEW;
			};

			/** 状态徽标文案：有键取本地化文案，未知状态回落状态原文。 */
			function statusText(status) {
				var raw = String(status || "");
				return SP_TASK_STATUS_KEYS[raw] ? t(SP_TASK_STATUS_KEYS[raw]) : raw;
			}

			// 组内排序（byUpdatedDesc）Plan 2b Task 6 起提升为模块级共用（attention 提示行同用）。

			/** 一条任务：标题 + 状态徽标 + 工作区名 + 更新时间 + 打开按钮。 */
			function itemOf(task) {
				var title = String((task && task.title) || (task && task.id) || "");
				var workName = String((task && task.workspaceName) || "");
				var updatedAt = task && task.updatedAt ? formatDate(task.updatedAt) : "";
				return React.createElement("div", { className: "sp-task-item", key: "task-" + String(task && task.id) },
					React.createElement("div", { className: "sp-task-head" },
						React.createElement("span", { className: "sp-task-title" }, title),
						React.createElement("span", { className: "sp-task-status" }, statusText(task && task.status)),
					),
					React.createElement("div", { className: "sp-task-meta" },
						workName ? React.createElement("span", { className: "sp-work-name" }, workName) : null,
						updatedAt ? React.createElement("span", { className: "sp-task-time" }, updatedAt) : null,
					),
					React.createElement("button", {
						type: "button",
						className: "sp-task-open",
						onClick: function () { onOpen(task); },
					}, t("openTask")),
				);
			}

			/** 一个非空分组：标题 + 条目列表。 */
			function blockOf(group, items) {
				return React.createElement("section", { className: group.className, key: group.key },
					React.createElement("h3", { className: "sp-task-group-title" }, t(group.label)),
					React.createElement("div", { className: "sp-task-list" }, items.map(itemOf)),
				);
			}

			/** 分桶后按 SP_RECENT_GROUPS 顺序输出，空分组直接跳过。 */
			function groupBlocks(list) {
				var buckets = { attention: [], active: [], failed: [], done: [] };
				for (var i = 0; i < list.length; i++) {
					var key = statusGroupOf(list[i] && list[i].status);
					if (!buckets[key]) key = "active"; // 未归类（cancelled / 未知）并入进行中
					buckets[key].push(list[i]);
				}
				var blocks = [];
				for (var g = 0; g < SP_RECENT_GROUPS.length; g++) {
					var group = SP_RECENT_GROUPS[g];
					var items = buckets[group.key].slice().sort(byUpdatedDesc);
					if (items.length > 0) blocks.push(blockOf(group, items));
				}
				return blocks;
			}

			function RecentView() {
				var body;
				if (loadErr) {
					// 错误态：说明失败 + 原始原因 + 重试（不静默显示空列表）
					body = React.createElement("div", { className: "sp-recent-error" },
						React.createElement("p", { className: "sp-state" }, t("recentError")),
						React.createElement("p", { className: "sp-hint" }, loadErr),
						React.createElement("button", {
							type: "button",
							className: "sp-btn sp-recent-retry",
							onClick: function () { refresh(); },
						}, t("retry")),
					);
				} else if (tasks.length === 0) {
					// 空态：给可执行引导（回「新建任务」的路由由 Plan 2b 的视图状态机接管）
					body = React.createElement("div", { className: "sp-recent-empty" },
						React.createElement("p", { className: "sp-state" }, t("recentEmpty")),
						React.createElement("div", { className: "sp-actions" },
							React.createElement("button", {
								type: "button",
								className: "sp-btn sp-btn-primary",
								onClick: function () { onNewTask(); },
							}, t("startTask")),
						),
					);
				} else {
					body = groupBlocks(tasks);
				}
				return React.createElement("div", { className: "sp-view-recent" }, body);
			}
			return RecentView;
		}

		/* ── 模板选择器（Task 4）：插件内置 + 用户上传，分组展示且来源可辨 ──
		 * 数据全部由调用方注入（builtin = host templates.list 的 builtinTemplates，
		 * user = templates；用户侧的 isDefault 由视图按 defaultTemplate 标注），
		 * 纯内存筛选（来源三档 + 名称/描述/场景搜索），不发请求。
		 * 四态语义靠**文本标签**区分（不依赖颜色，灰度截图/色觉障碍下同样可辨）：
		 * - 内置卡片：来源标签 t("tplBuiltin")，缩略占位取 item.accent；
		 * - 用户卡片：来源标签 t("tplUser")，缩略占位中性灰，默认项带 t("defaultBadge")；
		 * - t("tplNone")（不使用模板 → onPick("none")）与 t("tplFollow")（跟随默认模板
		 *   → onPick("")）是**两个并列选项**，各带一行 hint 说明与另一者的差异。
		 * onPick 的载荷与 buildBriefFrom 的三态同构：模板对象 / "none" / ""。
		 */

		/** 用户模板缩略占位：中性灰渐变（内置模板用 accent，两类视觉上也不混淆）。 */
		var SP_TPL_USER_THUMB = "linear-gradient(135deg, #EEF1F5 0%, #D8DEE7 100%)";

		function makeTemplatePicker(t, options) {
			var opts = options || {};
			var builtin = Array.isArray(opts.builtin) ? opts.builtin : [];
			var user = Array.isArray(opts.user) ? opts.user : [];
			var onPick = typeof opts.onPick === "function" ? opts.onPick : function () {};
			var onClose = typeof opts.onClose === "function" ? opts.onClose : function () {};

			/** 搜索匹配：名称 / 描述 / 场景（大小写不敏感）。 */
			var matches = function (item, needle) {
				if (needle === "") return true;
				var haystack = [item.name, item.description, item.scenario].join(" ").toLowerCase();
				return haystack.indexOf(needle) !== -1;
			};

			/** 一张模板卡片（className 是断言契约：sp-tpl-card / sp-tpl-thumb / sp-tpl-source / sp-tpl-use）。 */
			var cardOf = function (item, source) {
				var isBuiltin = source === "builtin";
				var tags = isBuiltin && Array.isArray(item.tags) ? item.tags : [];
				return React.createElement("div", { className: "sp-tpl-card", key: source + "-" + String(item.id) },
					React.createElement("div", {
						className: "sp-tpl-thumb", "aria-hidden": "true",
						style: { background: isBuiltin && item.accent ? String(item.accent) : SP_TPL_USER_THUMB },
					}),
					React.createElement("div", { className: "sp-tpl-body" },
						React.createElement("div", { className: "sp-tpl-head" },
							React.createElement("span", { className: "sp-tpl-name" }, String(item.name || item.id || "")),
							!isBuiltin && item.isDefault
								? React.createElement("span", { className: "sp-tpl-default" }, t("defaultBadge"))
								: null,
						),
						// 来源标签：文本可辨（内置 / 我的模板），不依赖颜色
						React.createElement("span", { className: "sp-tpl-source" }, isBuiltin ? t("tplBuiltin") : t("tplUser")),
						item.description ? React.createElement("p", { className: "sp-tpl-desc" }, String(item.description)) : null,
						isBuiltin && item.scenario ? React.createElement("p", { className: "sp-tpl-scenario" }, String(item.scenario)) : null,
						tags.length > 0
							? React.createElement("div", { className: "sp-tpl-tags" },
								tags.map(function (tag) {
									return React.createElement("span", { className: "sp-tpl-tag", key: String(tag) }, String(tag));
								}))
							: null,
					),
					React.createElement("div", { className: "sp-actions" },
						React.createElement("button", {
							type: "button", className: "sp-btn sp-tpl-use",
							onClick: function () { onPick({ id: item.id, name: item.name, source: source }); },
						}, t("tplUse")),
					),
				);
			};

			/** 一个来源分组：组头带来源标签与数量；空组给提示（筛选后语义仍完整）。 */
			var groupOf = function (source, items) {
				return React.createElement("div", { className: "sp-tpl-group sp-tpl-group-" + source, key: source },
					React.createElement("div", { className: "sp-tpl-group-head" },
						React.createElement("span", { className: "sp-tpl-source" }, source === "builtin" ? t("tplBuiltin") : t("tplUser")),
						React.createElement("span", { className: "sp-tpl-count" }, String(items.length)),
					),
					items.length === 0
						? React.createElement("p", { className: "sp-hint" }, t("tplGroupEmpty"))
						: React.createElement("div", { className: "sp-tpl-grid" }, items.map(function (item) { return cardOf(item, source); })),
				);
			};

			function TemplatePicker(props) {
				// "" 全部 / "builtin" 插件内置 / "user" 我的模板
				var filterState = React.useState("");
				var filter = filterState[0], setFilter = filterState[1];
				var queryState = React.useState("");
				var query = queryState[0], setQuery = queryState[1];

				var needle = String(query || "").trim().toLowerCase();
				var builtinItems = (filter === "user" ? [] : builtin).filter(function (item) { return matches(item, needle); });
				var userItems = (filter === "builtin" ? [] : user).filter(function (item) { return matches(item, needle); });

				var filterButton = function (value, label) {
					return React.createElement("button", {
						key: value === "" ? "all" : value,
						type: "button",
						className: "sp-btn" + (filter === value ? " sp-btn-primary" : ""),
						"aria-pressed": filter === value,
						onClick: function () { setFilter(value); },
					}, label);
				};

				return React.createElement("div", { className: "sp-tpl-picker" },
					React.createElement("div", { className: "sp-tpl-head" },
						React.createElement("span", { className: "sp-tpl-title" }, t("tplPickerTitle")),
						React.createElement("button", {
							type: "button", className: "sp-btn sp-tpl-close",
							onClick: function () { onClose(); },
						}, t("cancel")),
					),
					React.createElement("div", { className: "sp-tpl-toolbar" },
						React.createElement("div", { className: "sp-tpl-filter" },
							filterButton("", t("tplFilterAll")),
							filterButton("builtin", t("tplFilterBuiltin")),
							filterButton("user", t("tplFilterUser")),
						),
						React.createElement("input", {
							className: "sp-input sp-tpl-search", type: "text",
							placeholder: t("tplSearch"), value: query,
							onChange: function (event) { setQuery(event.target.value); },
						}),
					),
					groupOf("builtin", builtinItems),
					groupOf("user", userItems),
					// 四态之三/之四：明确「不使用模板」与「跟随默认模板」是**两个**选项
					React.createElement("div", { className: "sp-tpl-foot" },
						React.createElement("button", {
							type: "button", className: "sp-btn sp-tpl-none",
							onClick: function () { onPick("none"); },
						}, t("tplNone")),
						React.createElement("span", { className: "sp-hint" }, t("tplNoneHint")),
						React.createElement("button", {
							type: "button", className: "sp-btn sp-tpl-follow",
							onClick: function () { onPick(""); },
						}, t("tplFollow")),
						React.createElement("span", { className: "sp-hint" }, t("tplFollowHint")),
						React.createElement("button", {
							type: "button", className: "sp-btn sp-tpl-manage", title: t("tplManage"),
							onClick: function () { onClose(); },
						}, t("tplManage")),
					),
				);
			}
			return TemplatePicker;
		}

		/* ── 模板列表（含行内重命名）────────────────────────── */

		function TemplateList(props) {
			var t = props.t;
			var templates = props.data.templates || [];
			var defaultId = props.data.defaultTemplate;

			if (templates.length === 0) {
				return React.createElement("div", { className: "sp-hint", style: { marginTop: 8 } }, t("empty"));
			}

			var rows = templates.map(function (item) {
				var isDefault = item.id === defaultId;
				var isEditing = props.editingId === item.id;
				var children = [
					React.createElement("div", { key: "head", className: "sp-row" },
						React.createElement("span", { className: "sp-tpl-name" }, item.name),
						isDefault ? React.createElement("span", { className: "sp-badge" }, t("defaultBadge")) : null,
					),
					item.description ? React.createElement("div", { key: "desc", className: "sp-tpl-desc" }, item.description) : null,
					React.createElement("div", { key: "meta", className: "sp-tpl-meta" },
						React.createElement("span", null, formatSize(item.size)),
						React.createElement("span", null, formatDate(item.uploadedAt)),
					),
				];
				if (isEditing) {
					children.push(React.createElement("div", { key: "edit", className: "sp-edit" },
						React.createElement("div", { className: "sp-field" },
							React.createElement("label", null, t("renameName")),
							React.createElement("input", {
								className: "sp-input",
								value: props.editDraft.name,
								onChange: function (e) { props.setEditDraft({ name: e.target.value, description: props.editDraft.description }); },
							}),
						),
						React.createElement("div", { className: "sp-field" },
							React.createElement("label", null, t("renameDesc")),
							React.createElement("input", {
								className: "sp-input",
								value: props.editDraft.description,
								onChange: function (e) { props.setEditDraft({ name: props.editDraft.name, description: e.target.value }); },
							}),
						),
						React.createElement("div", { className: "sp-actions" },
							Btn({ primary: true, disabled: props.busy, onClick: props.onEditSave }, t("save")),
							Btn({ disabled: props.busy, onClick: props.onEditCancel }, t("cancel")),
						),
					));
				} else {
					children.push(React.createElement("div", { key: "acts", className: "sp-actions" },
						Btn({
							disabled: props.busy,
							onClick: function () { props.onSetDefault(isDefault ? null : item.id); },
						}, isDefault ? t("unsetDefault") : t("setDefault")),
						Btn({ disabled: props.busy, onClick: function () { props.onEditStart(item); } }, t("rename")),
						Btn({ danger: true, disabled: props.busy, onClick: function () { props.onDelete(item); } }, t("delete")),
					));
				}
				return React.createElement("div", { key: item.id, className: "sp-tpl" }, children);
			});

			return React.createElement("div", null, rows);
		}

		/* ── 上传表单 ───────────────────────────────────────── */

		function UploadForm(props) {
			var t = props.t;
			return React.createElement("form", {
				className: "sp-card",
				onSubmit: function (e) { e.preventDefault(); props.onSubmit(); },
			},
				React.createElement("h3", null, t("upload")),
				React.createElement("p", { className: "sp-hint" }, t("uploadHint")),
				React.createElement("div", { className: "sp-field" },
					React.createElement("label", null, t("chooseFile")),
					React.createElement("input", { type: "file", accept: ".pptx", className: "sp-input", ref: props.fileRef }),
				),
				React.createElement("div", { className: "sp-grid" },
					React.createElement("div", { className: "sp-field" },
						React.createElement("label", null, t("nameLabel")),
						React.createElement("input", {
							className: "sp-input", placeholder: t("namePlaceholder"),
							value: props.form.name,
							onChange: function (e) { props.setForm({ name: e.target.value, description: props.form.description }); },
						}),
					),
					React.createElement("div", { className: "sp-field" },
						React.createElement("label", null, t("descLabel")),
						React.createElement("input", {
							className: "sp-input", placeholder: t("descPlaceholder"),
							value: props.form.description,
							onChange: function (e) { props.setForm({ name: props.form.name, description: e.target.value }); },
						}),
					),
				),
				React.createElement("div", { className: "sp-actions" },
					Btn({ primary: true, disabled: props.busy, onClick: props.onSubmit },
						props.busy && props.uploading ? t("uploading") : t("uploadBtn")),
				),
			);
		}

		/* ── 偏好表单 ───────────────────────────────────────── */

		function PrefsForm(props) {
			var t = props.t;
			var p = props.draft;
			return React.createElement("form", {
				className: "sp-card",
				onSubmit: function (e) { e.preventDefault(); props.onSave(); },
			},
				React.createElement("h3", null, t("prefs")),
				React.createElement("p", { className: "sp-hint" }, t("prefsHint")),
				React.createElement("div", { className: "sp-grid" },
					React.createElement("div", { className: "sp-field" },
						React.createElement("label", null, t("defaultFormat")),
						React.createElement("select", {
							className: "sp-select", value: p.defaultFormat,
							onChange: function (e) { props.setDraft(Object.assign({}, p, { defaultFormat: e.target.value })); },
						},
							React.createElement("option", { value: "ask" }, t("defaultFormatAsk")),
							React.createElement("option", { value: "pptx" }, t("defaultFormatPptx")),
							React.createElement("option", { value: "html" }, t("defaultFormatHtml")),
						),
					),
					React.createElement("div", { className: "sp-field" },
						React.createElement("label", null, t("renderReview")),
						React.createElement("select", {
							className: "sp-select", value: p.renderReview,
							onChange: function (e) { props.setDraft(Object.assign({}, p, { renderReview: e.target.value })); },
						},
							React.createElement("option", { value: "deliverable-only" }, t("reviewDeliverable")),
							React.createElement("option", { value: "always" }, t("reviewAlways")),
							React.createElement("option", { value: "off" }, t("reviewOff")),
						),
					),
				),
				React.createElement("div", { className: "sp-field" },
					React.createElement("label", null, t("outputDir")),
					React.createElement("input", {
						className: "sp-input", placeholder: t("outputDirPlaceholder"),
						value: p.outputDir,
						onChange: function (e) { props.setDraft(Object.assign({}, p, { outputDir: e.target.value })); },
					}),
				),
				React.createElement("div", { className: "sp-field" },
					React.createElement("label", null, t("styleNotes")),
					React.createElement("textarea", {
						className: "sp-textarea", placeholder: t("styleNotesPlaceholder"),
						value: p.styleNotes,
						onChange: function (e) { props.setDraft(Object.assign({}, p, { styleNotes: e.target.value })); },
					}),
				),
				React.createElement("div", { className: "sp-actions" },
					Btn({ primary: true, disabled: props.busy, onClick: props.onSave }, t("save")),
				),
			);
		}

		/* ── 设置页主组件（无状态渲染 + 有状态容器）────────── */

		function PptsSectionView(props) {
			var t = props.t;
			var data = props.data || { templates: [], defaultTemplate: null };
			return React.createElement("div", { className: "sp-root" },
				React.createElement("div", { className: "sp-row" },
					React.createElement("h2", { style: { margin: 0, fontSize: 16 } }, t("title")),
					React.createElement("div", { style: { flex: 1 } }),
					Btn({ disabled: props.busy, onClick: props.onRefresh }, t("refresh")),
				),
				React.createElement("p", { className: "sp-intro" }, t("intro")),
				props.message ? React.createElement("div", { className: "sp-msg sp-msg-ok" }, props.message) : null,
				props.error ? React.createElement("div", { className: "sp-msg sp-msg-err" }, props.error) : null,
				React.createElement("div", { className: "sp-card" },
					React.createElement("div", { className: "sp-row", style: { marginBottom: 6 } },
						React.createElement("h3", { style: { margin: 0 } }, t("templates")),
						React.createElement("div", { style: { flex: 1 } }),
						React.createElement("span", { className: "sp-tpl-meta" },
							t("defaultTemplateLabel") + ": " + (props.defaultName || t("none"))),
					),
					React.createElement(TemplateList, {
						t: t, data: data, busy: props.busy,
						editingId: props.editingId, editDraft: props.editDraft, setEditDraft: props.setEditDraft,
						onEditStart: props.onEditStart, onEditSave: props.onEditSave, onEditCancel: props.onEditCancel,
						onSetDefault: props.onSetDefault, onDelete: props.onDelete,
					}),
				),
				React.createElement(UploadForm, {
					t: t, busy: props.busy, uploading: props.uploading,
					form: props.uploadForm, setForm: props.setUploadForm,
					fileRef: props.fileRef, onSubmit: props.onUpload,
				}),
				React.createElement(PrefsForm, {
					t: t, busy: props.busy,
					draft: props.prefsDraft, setDraft: props.setPrefsDraft, onSave: props.onSavePrefs,
				}),
			);
		}

		/**
		 * 有状态容器：数据获取、操作编排、本地表单草稿。
		 * 所有 host 交互走 api()；操作成功后统一 refresh()，失败落 error 横幅。
		 */
		function makeStatefulComponent(t) {
			var defaults = { defaultFormat: "ask", renderReview: "deliverable-only", outputDir: "", styleNotes: "" };

			function Stateful(renderProps) {
				var dataState = React.useState(null);
				var data = dataState[0], setData = dataState[1];
				var msgState = React.useState({ ok: "", err: "" });
				var msg = msgState[0], setMsg = msgState[1];
				var busyState = React.useState(false);
				var busy = busyState[0], setBusy = busyState[1];
				var uploadingState = React.useState(false);
				var uploading = uploadingState[0], setUploading = uploadingState[1];
				var editState = React.useState({ id: null, name: "", description: "" });
				var editing = editState[0], setEditing = editState[1];
				var uploadState = React.useState({ name: "", description: "" });
				var uploadForm = uploadState[0], setUploadForm = uploadState[1];
				var prefsState = React.useState(defaults);
				var prefsDraft = prefsState[0], setPrefsDraft = prefsState[1];
				var fileRef = React.useRef(null);

				var flash = function (ok, err) { setMsg({ ok: ok || "", err: err || "" }); };

				var refresh = React.useCallback(function () {
					return api("templates.list").then(function (value) {
						setData(value);
						setPrefsDraft(Object.assign({}, defaults, value.prefs));
					});
				}, []);

				React.useEffect(function () {
					var alive = true;
					refresh().catch(function (e) { if (alive) flash("", String(e.message || e)); });
					return function () { alive = false; };
				}, [refresh]);

				var run = function (promise, okText) {
					setBusy(true);
					return promise.then(function () { flash(okText || t("saved")); })
						.catch(function (e) { flash("", String(e.message || e)); })
						.then(function () { return refresh(); })
						.then(function () { setBusy(false); })
						.catch(function () { setBusy(false); });
				};

				var onUpload = function () {
					var input = fileRef.current;
					var file = input && input.files && input.files[0];
					if (!file) { flash("", t("errPickFile")); return; }
					var name = uploadForm.name.trim();
					if (!name) { flash("", t("errPickName")); return; }
					var query = "?name=" + encodeURIComponent(name) + "&description=" + encodeURIComponent(uploadForm.description.trim());
					setBusy(true); setUploading(true);
					fetch(UPLOAD + query, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: file })
						.then(function (response) { return response.text().then(function (text) {
							var payload;
							try { payload = text ? JSON.parse(text) : {}; } catch (e) { throw new Error("bad JSON (" + response.status + ")"); }
							if (payload && payload.ok) return payload.value;
							throw new Error(String((payload && payload.error && payload.error.message) || ("HTTP " + response.status)));
						}); })
						.then(function (record) {
							flash(t("uploaded", { name: record.name }));
							setUploadForm({ name: "", description: "" });
							if (input) input.value = "";
						})
						.catch(function (e) { flash("", String(e.message || e)); })
						.then(function () { return refresh(); })
						.then(function () { setBusy(false); setUploading(false); })
						.catch(function () { setBusy(false); setUploading(false); });
				};

				var onEditSave = function () {
					if (!editing.id) return;
					run(api("templates.rename", {
						id: editing.id,
						name: editing.name,
						description: editing.description,
					})).then(function () { setEditing({ id: null, name: "", description: "" }); });
				};

				var onDelete = function (item) {
					var text = t("deleteConfirm").replace("{name}", item.name);
					if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(text)) return;
					run(api("templates.delete", { id: item.id }), t("deleted"));
				};

				var onSetDefault = function (id) {
					run(api("templates.setDefault", { id: id }), id ? t("defaultSet") : t("defaultCleared"));
				};

				var onSavePrefs = function () {
					run(api("prefs.update", { patch: {
						defaultFormat: prefsDraft.defaultFormat,
						renderReview: prefsDraft.renderReview,
						outputDir: prefsDraft.outputDir.trim(),
						styleNotes: prefsDraft.styleNotes,
					} }));
				};

				var defaultName = "";
				if (data && data.defaultTemplate && data.templates) {
					for (var i = 0; i < data.templates.length; i += 1) {
						if (data.templates[i].id === data.defaultTemplate) { defaultName = data.templates[i].name; break; }
					}
				}

				return React.createElement(PptsSectionView, {
					t: t,
					data: data,
					busy: busy, uploading: uploading,
					message: msg.ok, error: msg.err,
					defaultName: defaultName,
					editingId: editing.id,
					editDraft: { name: editing.name, description: editing.description },
					setEditDraft: function (draft) { setEditing({ id: editing.id, name: draft.name, description: draft.description }); },
					onEditStart: function (item) { setEditing({ id: item.id, name: item.name, description: item.description }); },
					onEditSave: onEditSave,
					onEditCancel: function () { setEditing({ id: null, name: "", description: "" }); },
					onSetDefault: onSetDefault,
					onDelete: onDelete,
					onRefresh: function () { run(refresh()); },
					uploadForm: uploadForm, setUploadForm: setUploadForm,
					fileRef: fileRef, onUpload: onUpload,
					prefsDraft: prefsDraft, setPrefsDraft: setPrefsDraft, onSavePrefs: onSavePrefs,
				});
			}
			return Stateful;
		}

		/* ── 入口：注册 locale 字典 + settings.section + 任务面板 ──
		 * 历史沿革：0.1.5 前的独立工作台组件已拆为任务面板壳 + 视图（Plan 2b），
		 * 其专属样式与仅服务于它的草稿桥 v2 一并移除，会话投递统一走 sendToChatV3。 */

		var inject = ["slots", "locale", "sessions", "uiConversation", "uiWorkspace", "workspaces", "layout"];

		function apply(ctx) {
			ensureStyles();
			if (ctx.locale && typeof ctx.locale.register === "function") {
				ctx.effect(function () {
					return ctx.locale.register(NS, { zh: zh, en: en });
				}, "dsh-super-ppts: section dictionaries");
			}

			var t = ctx.locale && typeof ctx.locale.bind === "function"
				? ctx.locale.bind(NS)
				: function (key, params) { return fill(zh[key] || en[key] || key, params); };

			// 设置页导航图标：宿主壳层对外部分区只给通用齿轮，标记本插件行
			// 后由 CSS 换成幕布字形。防御式：无 effect 服务时跳过，不影响其余功能。
			if (typeof ctx.effect === "function") {
				ctx.effect(function () {
					return registerSettingsNavIcon(function () { return t("nav"); });
				}, "dsh-super-ppts: settings navigation icon");
			}

			if (!ctx.slots || typeof ctx.slots.inject !== "function") return;
			var Stateful = makeStatefulComponent(t);
			
			// 防御：设置页注册失败只降级（console 诊断），绝不炸掉插件加载/boot。
			try {
				ctx.slots.inject("settings.section", function () {
					return ctx.slots.register({
						name: "settings.section",
						id: "super-ppts",
						order: 20,
						label: function () { return t("nav"); },
						locale: NS,
					}, Stateful);
				});
			} catch (error) {
				console.error("[dsh-super-ppts] settings.section 注册失败（设置页菜单项不可用，其余功能不受影响）:", error);
			}

			// ── 0.1.5 左侧栏原生接入（sidebar.panellist + main keyed）──
			// 图标行渲染于「新任务」与工作区列表之间：壳层拥有按钮/Tooltip/
			// active 态，注册方只出图标字形；点击即 layout.selectPanel 切到
			// main keyed 槽位里的主面板。两段注册必须同 id（'super-ppts-panel'），
			// 面板体是任务面板壳 makePanelsView（顶部视图切换 + 视图分发；
			// 壳层宽度与滚动归宿主，插件不自建侧边栏/全屏容器）。
			// 软探测：宿主无这些 slot（≤0.1.4）时 inject/register 抛错即静默
			// 跳过，设置页入口仍在，功能零损失。
			try {
				var PANEL_ID = "super-ppts-panel";
				var PanelIcon = function (props) {
					return React.createElement("svg", {
						width: (props && props.size) || 18,
						height: (props && props.size) || 18,
						viewBox: "0 0 24 24", fill: "none",
						stroke: "currentColor", strokeWidth: 2,
						strokeLinecap: "round", strokeLinejoin: "round",
						"aria-hidden": true,
					},
						React.createElement("path", { d: "M2 3h20" }),
						React.createElement("path", { d: "M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" }),
						React.createElement("path", { d: "m7 21 5-5 5 5" }),
					);
				};
				ctx.slots.inject("sidebar.panellist", function () {
					var disposeIcon = ctx.slots.register({
						name: "sidebar.panellist",
						id: PANEL_ID,
						order: 100,
						label: function () { return t("nav"); },
						locale: NS,
					}, PanelIcon);
					var disposePanel = ctx.slots.register({
						name: "main",
						key: PANEL_ID,
					}, makePanelsView(t, {
						api: api,
						// Task 6：视图层调用形状仍是 bridges.createTask(input)（单参），
						// 注入的是绑定 apply ctx 的完整编排 createTaskAndStart——
						// 落盘 → 素材上传 → 会话桥 v3 提交 → 状态推进，phase 可为 "started"。
						createTask: function (input) { return createTaskAndStart(ctx, input); },
						uploadMaterial: uploadMaterial,
						// Plan 2b Task 6：会话消息桥——三个详情视图（大纲修改/继续生成/
						// 补充信息/继续修改/重新生成）的指令统一经 sendToChatV3(ctx, …) 投递。
						sendToSession: function (text, workspaceId) { return sendToChatV3(ctx, text, workspaceId); },
						// Plan 2b Task 6：打开 Agent 会话（进度视图 sp-open-session）——
						// 先跳任务工作区的会话落点（可达性防御），再切回对话视图。
						openSession: function (workspaceId) {
							try {
								if (ctx.uiWorkspace && typeof ctx.uiWorkspace.openWorkspace === "function" && workspaceId) {
									ctx.uiWorkspace.openWorkspace(workspaceId);
								}
							} catch (navError) { /* 宿主服务不可达：只切回对话视图 */ }
							backToChat(ctx);
						},
					}));
					return function () { disposePanel(); disposeIcon(); };
				});
			} catch (error) {
				console.warn("[dsh-super-ppts] 宿主无左侧栏 slot（≤0.1.4?），跳过 panellist 接入，设置页入口不受影响:", error && error.message);
			}
		}

		// 测试钩子：冒烟脚本无 DOM，靠直接渲染子组件做结构断言（仅测试使用，无运行时副作用）
		exports.__testHooks = {
			MakePanelsView: makePanelsView,
			viewForStatus: viewForStatus,
			statusGroupOf: statusGroupOf,
			SP_VIEW_NEW: SP_VIEW_NEW,
			SP_VIEW_TASK: SP_VIEW_TASK,
			isPollingStatus: isPollingStatus,
			startTaskPolling: startTaskPolling,
			SP_POLL_MS: SP_POLL_MS,
			makeNewTaskView: makeNewTaskView,
			makeRecentView: makeRecentView,
			makeTemplatePicker: makeTemplatePicker,
			buildBriefFrom: buildBriefFrom,
			// createTask 现为编排的**第 1 步**（落盘，恒 waiting-launch）——注入给视图的
			// 是绑定 ctx 的 createTaskAndStart（见 apply），这里保留它供冒烟断言落盘步骤。
			createTask: createTask,
			createTaskAndStart: createTaskAndStart,
			buildTaskPrompt: buildTaskPrompt,
			// Plan 2b Task 2：任务消息构建器族（纯字符串组装，冒烟直接断言）
			buildContinuePrompt: buildContinuePrompt,
			buildOutlineRevisePrompt: buildOutlineRevisePrompt,
			buildNeedsInputPrompt: buildNeedsInputPrompt,
			buildContinueEditPrompt: buildContinueEditPrompt,
			buildRegeneratePrompt: buildRegeneratePrompt,
			// Plan 2b Task 3a：大纲页操作纯函数（视图只做 setState 接线，逻辑全在这里）
			outlineOps: {
				clonePages: clonePages,
				uniquePageId: uniquePageId,
				movePage: movePage,
				copyPage: copyPage,
				addPage: addPage,
				removePage: removePage,
				parseBullets: parseBullets,
				normalizePage: normalizePage,
				outlineDiffers: outlineDiffers,
			},
			// Plan 2b Task 3b：大纲确认视图工厂（确认门 + 内联编辑 + 自然语言修改）
			makeOutlineReviewView: makeOutlineReviewView,
			// Plan 2b Task 4：生成进度视图工厂 + 时间线/事件纯函数原语
			makeProgressView: makeProgressView,
			progressSteps: progressSteps,
			lastEventOfKind: lastEventOfKind,
			// Plan 2b Task 5：结果视图工厂 + 剪贴板复制原语（不可用静默降级）
			makeResultView: makeResultView,
			copyText: copyText,
			// Plan 2b Task 6：壳层接线四纯函数（路由判定 / 待办抽取 / forcedSub
			// 清除判定 / 打开任务）+ 列表条目排序原语（attentionEntries 共用）
			routeSubView: routeSubView,
			attentionEntries: attentionEntries,
			shouldClearForced: shouldClearForced,
			openTaskRecord: openTaskRecord,
			// Plan 2b 实现后审查修正：详情视图组件类型缓存（防轮询 re-render remount）
			ensureDetailView: ensureDetailView,
			byUpdatedDesc: byUpdatedDesc,
			ensureStyles: ensureStyles,
			stylesBlocked: stylesBlocked,
			sendToChatV3: sendToChatV3,
			clipboardFallback: clipboardFallback,
			uploadMaterial: uploadMaterial,
		};

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
