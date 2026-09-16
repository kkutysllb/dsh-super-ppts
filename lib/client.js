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
		 * 粘贴(⌘V/Ctrl+V)后回车即发。apply 内的 copyToClipboardBridge（v2）
		 * 与 sendToChatV3 共用本函数——v3 是模块级函数，拿不到 apply 的闭包 ctx，
		 * 因此 ctx 作为显式入参。返回 'copied' | 'none'（剪贴板不可用即 'none'，
		 * 绝不假装成功）。
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
		 * 用户点「开始制作」后任务立即启动，无需回聊天窗口按回车。与 v2
		 * （apply 内的 sendToChat，只 setDraft → 'draft'）的差别就是最后这一步
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
			".sp-btn-primary:hover{color:#fff;}",
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
			// 工作台：独立视觉体系（不与设置页共用 .sp-root，避免弹窗宽度约束）
			".sp-work{width:100%;max-width:860px;margin:0 auto;padding:28px 32px;box-sizing:border-box;display:flex;flex-direction:column;gap:16px;font-size:13px;}",
			".sp-work-head{display:flex;align-items:center;gap:12px;}",
			".sp-work-head h2{margin:0;font-size:18px;font-weight:600;}",
			".sp-work-intro{margin:4px 0 0;opacity:.68;font-size:12px;line-height:1.5;}",
			".sp-work-icon{flex:none;width:38px;height:38px;border-radius:10px;background:var(--dsw-alias-interactive-bg-active,var(--sl-color-primary-500,#3b5fd9));}",
			".sp-work-icon::before{content:'';display:block;width:100%;height:100%;background:var(--dsw-alias-label-primary-inverted,#fff);"
				+ "-webkit-mask:url(\"" + NAV_ICON_SVG + "\") center / 20px no-repeat;"
				+ "mask:url(\"" + NAV_ICON_SVG + "\") center / 20px no-repeat;}",
			".sp-panel{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:12px;background:var(--dsw-alias-button-elevated-fill,transparent);}",
			".sp-panel-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}",
			".sp-panel-head h3{margin:0;font-size:13px;font-weight:600;}",
			".sp-grid3{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:12px;}",
			".sp-chip-row{display:flex;flex-wrap:wrap;gap:8px;}",
			".sp-chip{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:999px;background:transparent;color:inherit;padding:5px 14px;font-size:12px;cursor:pointer;transition:background .15s,border-color .15s;}",
			".sp-chip:hover{background:var(--dsw-alias-interactive-bg-hover,var(--sl-color-neutral-300,#333));}",
			".sp-chip:active{background:var(--dsw-alias-interactive-bg-active,var(--sl-color-neutral-400,#555));}",
			".sp-work .sp-select,.sp-work .sp-textarea{width:100%;}",
			".sp-work .sp-btn{border-radius:8px;}",
			".sp-work .sp-btn-primary{padding:6px 18px;font-size:13px;}",
			".sp-work-cta{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:2px;}",
			".sp-work-sent{font-size:12px;color:var(--dsw-alias-interactive-bg-hover,var(--sl-color-primary-500,#3b5fd9));}",
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
			".sp-panels{display:flex;flex-direction:column;gap:16px;font-size:13px;line-height:1.5;color:inherit;box-sizing:border-box;}",
			".sp-panels-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));}",
			".sp-panels-title{margin:0;font-size:16px;font-weight:600;}",
			".sp-tabs{display:flex;gap:6px;margin-left:auto;}",
			".sp-tab{border:1px solid transparent;border-radius:999px;background:transparent;color:inherit;padding:4px 14px;font-size:12px;cursor:pointer;transition:background .15s,border-color .15s;}",
			".sp-tab:hover{background:var(--dsw-alias-interactive-bg-hover,var(--sl-color-neutral-300,#333));}",
			".sp-tab-active{border-color:var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));background:var(--dsw-alias-interactive-bg-active,var(--sl-color-neutral-400,#555));font-weight:600;}",
			// 视图根：两个视图都是单列纵向流（视图自持类名，壳层不下发 className）
			".sp-view-new-task,.sp-view-recent{display:flex;flex-direction:column;gap:14px;}",
			// 新建任务视图：主题 → 快速开始 → 交付形态 → 更多选项 → 摘要 → 素材
			".sp-new-title{margin:0;font-size:15px;font-weight:600;}",
			".sp-topic-input{min-height:76px;}",
			".sp-quick-row{display:flex;flex-wrap:wrap;gap:8px;}",
			".sp-quick-chip{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:999px;background:transparent;color:inherit;padding:4px 12px;font-size:12px;cursor:pointer;transition:background .15s,border-color .15s;}",
			".sp-quick-chip:hover{background:var(--dsw-alias-interactive-bg-hover,var(--sl-color-neutral-300,#333));}",
			".sp-formats{display:grid;grid-template-columns:1fr 1fr;gap:10px;}",
			".sp-format-card{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:10px;padding:12px 14px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:4px;transition:border-color .15s,background .15s;}",
			".sp-format-card:hover{border-color:var(--dsw-alias-interactive-bg-hover,var(--sl-color-primary-500,#3b5fd9));}",
			".sp-format-card-active{border-color:var(--dsw-alias-interactive-bg-active,var(--sl-color-primary-500,#3b5fd9));background:var(--dsw-alias-button-elevated-fill,transparent);}",
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
			".sp-recent-error{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:16px 12px;border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:10px;}",
			".sp-recent-retry{align-self:flex-start;}",
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

		function ensureStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById("dsh-super-ppts-styles")) return;
			var style = document.createElement("style");
			style.id = "dsh-super-ppts-styles";
			style.textContent = CSS;
			document.head.appendChild(style);
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
		 * 轮询」处理——一次失败不该杀死恢复观察；onTick 拿不到记录时收到 null，
		 * 由调用方决定是否提示。返回 cancel（幂等，可重复调用）。
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
					.catch(function () { return true; /* 一次失败不杀死轮询 */ });
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

		/**
		 * 面板壳：DSH 原生主面板内的**单列**任务工作区。
		 * 顶部只有两个轻量视图切换（不是第二套应用导航），其余全部是同一列内容。
		 * 严禁自建侧边栏 / 右侧栏 / 全屏容器——壳层宽度与滚动归宿主。
		 *
		 * 视图容器类名（sp-view-new-task / sp-view-recent）由各视图根**自持**：
		 * 壳层只传 props（含 useWorkspaces），不下发 className，避免壳层与视图
		 * 争夺根节点；单独渲染视图工厂时类名同样成立。
		 */
		function makePanelsView(t, bridges) {
			function Panels(props) {
				var viewState = React.useState(SP_VIEW_NEW);
				var view = viewState[0], setView = viewState[1];
				// 任务列表状态由「最近任务」视图与创建流程共用（创建成功后要立刻出现在列表里）
				var tasksState = React.useState(null);
				var tasks = tasksState[0], setTasks = tasksState[1];
				var loadErrState = React.useState("");
				var loadErr = loadErrState[0], setLoadErr = loadErrState[1];

				var refreshTasks = React.useCallback(function () {
					return api("tasks.list", {}).then(function (value) {
						setTasks((value && value.tasks) || []);
						setLoadErr("");
						return value;
					}).catch(function (error) {
						setLoadErr(String((error && error.message) || error));
						setTasks([]);
					});
				}, []);

				React.useEffect(function () { refreshTasks(); }, [refreshTasks]);

				var tabs = React.createElement("div", { className: "sp-tabs", role: "tablist" },
					React.createElement("button", {
						type: "button",
						className: "sp-tab" + (view === SP_VIEW_NEW ? " sp-tab-active" : ""),
						onClick: function () { setView(SP_VIEW_NEW); },
					}, t("newTask")),
					React.createElement("button", {
						type: "button",
						className: "sp-tab" + (view === SP_VIEW_RECENT ? " sp-tab-active" : ""),
						onClick: function () { setView(SP_VIEW_RECENT); },
					}, t("recent")),
				);

				var viewProps = { useWorkspaces: props && props.useWorkspaces };
				var body;
				if (view === SP_VIEW_RECENT) {
					body = React.createElement(makeRecentView(t, {
						tasks: tasks, loadErr: loadErr, refresh: refreshTasks,
					}), viewProps);
				} else {
					body = React.createElement(makeNewTaskView(t, {
						onCreated: function () { refreshTasks(); setView(SP_VIEW_RECENT); },
						tasks: tasks,
						bridges: bridges,
					}), viewProps);
				}

				return React.createElement("div", { className: "sp-panels" },
					React.createElement("div", { className: "sp-panels-head" },
						React.createElement("h2", { className: "sp-panels-title" }, t("panelTitle")),
						tabs,
					),
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

			/** 组内排序：最近更新在前（缺失/非法时间按 0 处理，不抛）。 */
			function byUpdatedDesc(a, b) {
				var ta = Date.parse(String((a && a.updatedAt) || "")) || 0;
				var tb = Date.parse(String((b && b.updatedAt) || "")) || 0;
				return tb - ta;
			}

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

		/* ── 工作台主面板：工作区选择 + 快速开始 + Brief + 模板速览 ── */

		/**
		 * 工作台主面板（与设置页职责分离，独立 .sp-work 视觉体系）。
		 *
		 * 结构：头部（图标徽章 + 标题 + 说明）→ 快速开始（插件内置提示词
		 * 模板 chips，点击填入主题、自由编辑保留）→ Brief 面板（主题 +
		 * 工作区/交付形态/模板 三联 + 放入输入框）→ 模板速览（只读卡片）。
		 * 发送走草稿桥 v2（会话落点 → 输入框 setDraft；失败降级剪贴板）。
		 * 工作区行读宿主全局标准 hook useWorkspaces（root 面板自动注入；
		 * 旧宿主缺失时整块隐藏——与 panellist 同款软探测）。
		 */
		function makeWorkbenchComponent(t, sendToChat) {
			// 内置提示词模板键位（文案在 zh/en 字典 q1..q8）
			var QUICK_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"];

			function Workbench(props) {
				var topicState = React.useState("");
				var topic = topicState[0], setTopic = topicState[1];
				var formatState = React.useState("");
				var format = formatState[0], setFormat = formatState[1];
				var tplState = React.useState("");
				var tpl = tplState[0], setTpl = tplState[1];
				var wsState = React.useState("");
				var ws = wsState[0], setWs = wsState[1];
				var dataState = React.useState(null);
				var data = dataState[0], setData = dataState[1];
				var loadErrState = React.useState("");
				var loadErr = loadErrState[0], setLoadErr = loadErrState[1];
				var sentState = React.useState("");
				var sent = sentState[0], setSent = sentState[1];
				var busyState = React.useState(false);
				var busy = busyState[0], setBusy = busyState[1];

				// 工作区列表:root 面板的全局标准 hook(选择器用法与宿主
				// WorkspaceBrowser 同款);宿主未注入时 wsItems === null。
				var useWorkspaces = props && props.useWorkspaces;
				var wsItems = typeof useWorkspaces === "function"
					? useWorkspaces(function (s) { return s.items; }) : null;
				var wsPhase = typeof useWorkspaces === "function"
					? useWorkspaces(function (s) { return s.phase; }) : null;

				var refresh = React.useCallback(function () {
					return api("templates.list")
						.then(function (v) { setData(v); setLoadErr(""); })
						.catch(function (e) { setLoadErr(String(e.message || e)); });
				}, []);
				React.useEffect(function () { refresh(); }, [refresh]);

				var templates = (data && data.templates) || [];
				var defaultId = data && data.defaultTemplate;

				var onSend = function () {
					var text = String(topic || "").trim();
					if (text === "") { setSent("required"); return; }
					var tplName = null;
					if (tpl !== "") {
						for (var i = 0; i < templates.length; i += 1) {
							if (templates[i].id === tpl) { tplName = templates[i].name; break; }
						}
					}
					// 组提示词:模板走「按模板 X 制作」路由(与宿主能力通告一致);
					// 形态仅在明确选择时附加,follow 偏好则交给 Agent。
					// 工作区选择跟随表单(ws === "" 即跟随当前);落点与填框逻辑在桥内。
					var phrase = t("promptBase").replace("{topic}", text);
					if (tplName !== null) phrase = t("promptTpl").replace("{tpl}", tplName).replace("{topic}", text);
					else if (format === "pptx") phrase = t("promptPptx").replace("{topic}", text);
					else if (format === "html") phrase = t("promptHtml").replace("{topic}", text);
					setBusy(true); setSent("");
					Promise.resolve(sendToChat(phrase, ws || ""))
						.then(function (result) { setSent(result || "none"); })
						.catch(function () { setSent("none"); })
						.then(function () { setBusy(false); });
				};

				// 工作区字段:宿主未注入 hook 时整块不渲染（软探测）
				var wsField = null;
				if (wsItems !== null) {
					wsField = React.createElement("div", { className: "sp-field", key: "ws" },
						React.createElement("label", null, t("wsLabel")),
						wsPhase !== "ready"
							? React.createElement("span", { className: "sp-state" }, t("wsLoading"))
							: (wsItems.length === 0
								? React.createElement("span", { className: "sp-state" }, t("wsEmpty"))
								: React.createElement("select", {
									className: "sp-select", value: ws,
									onChange: function (e) { setWs(e.target.value); setSent(""); },
								},
									React.createElement("option", { value: "" }, t("wsFollow")),
									wsItems.map(function (w) {
										return React.createElement("option", {
											key: w.workspaceId, value: w.workspaceId,
										}, w.title + " — " + w.path);
									}))),
					);
				}
				var formatField = React.createElement("div", { className: "sp-field", key: "format" },
					React.createElement("label", null, t("formatLabel")),
					React.createElement("select", {
						className: "sp-select", value: format,
						onChange: function (e) { setFormat(e.target.value); },
					},
						React.createElement("option", { value: "" }, t("formatFollow")),
						React.createElement("option", { value: "pptx" }, "PPTX"),
						React.createElement("option", { value: "html" }, "HTML"),
					),
				);
				var templateField = React.createElement("div", { className: "sp-field", key: "template" },
					React.createElement("label", null, t("templateLabel")),
					React.createElement("select", {
						className: "sp-select", value: tpl,
						onChange: function (e) { setTpl(e.target.value); },
					},
						React.createElement("option", { value: "" }, t("templateNone")),
						templates.map(function (item) {
							return React.createElement("option", {
								key: item.id, value: item.id,
							}, item.name + (item.id === defaultId ? " · " + t("defaultTemplateLabel2") : ""));
						}),
					),
				);

				return React.createElement("div", { className: "sp-work" },
					// 头部：图标徽章 + 标题 + 说明
					React.createElement("div", { className: "sp-work-head" },
						React.createElement("span", { className: "sp-work-icon", "aria-hidden": "true" }),
						React.createElement("div", null,
							React.createElement("h2", null, t("workTitle")),
							React.createElement("p", { className: "sp-work-intro" }, t("workIntro")),
						),
					),
					// 快速开始：插件内置提示词模板（点击填入主题，自由编辑保留）
					React.createElement("section", { className: "sp-panel" },
						React.createElement("div", { className: "sp-panel-head" },
							React.createElement("h3", null, t("quickTitle")),
							React.createElement("span", { className: "sp-hint" }, t("quickHint")),
						),
						React.createElement("div", { className: "sp-chip-row" },
							QUICK_KEYS.map(function (k) {
								return React.createElement("button", {
									key: k, type: "button", className: "sp-chip",
									onClick: function () { setTopic(t(k + "Text")); setSent(""); },
								}, t(k + "Label"));
							}),
						),
					),
					// Brief：主题（自由输入）+ 落点三联 + 动作
					React.createElement("section", { className: "sp-panel" },
						React.createElement("div", { className: "sp-field" },
							React.createElement("label", null, t("topicLabel")),
							React.createElement("textarea", {
								className: "sp-textarea", rows: 2,
								placeholder: t("topicPlaceholder"),
								value: topic,
								onChange: function (e) { setTopic(e.target.value); setSent(""); },
							}),
						),
						React.createElement("div", { className: wsField !== null ? "sp-grid3" : "sp-grid" },
							wsField, formatField, templateField,
						),
						React.createElement("div", { className: "sp-work-cta" },
							Btn({ primary: true, disabled: busy, onClick: onSend }, t("sendToChat")),
							sent === "draft" ? React.createElement("span", { className: "sp-work-sent" }, t("sentDraft")) : null,
							sent === "copied" ? React.createElement("span", { className: "sp-work-sent" }, t("sentCopied")) : null,
							sent === "clipboard" ? React.createElement("span", { className: "sp-hint" }, t("sentClipboard")) : null,
							sent === "none" ? React.createElement("span", { className: "sp-hint" }, t("sendNone")) : null,
							sent === "required" ? React.createElement("span", { className: "sp-hint" }, t("topicRequired")) : null,
						),
					),
					// 模板速览（只读；管理在设置页）
					React.createElement("section", { className: "sp-panel" },
						React.createElement("div", { className: "sp-panel-head" },
							React.createElement("h3", null, t("tplGalleryTitle")),
							React.createElement("span", { className: "sp-hint" }, t("tplGalleryHint")),
						),
						loadErr !== ""
							? React.createElement("div", { className: "sp-row" },
								React.createElement("span", { className: "sp-msg sp-msg-err" }, t("loadFailed") + ":" + loadErr),
								Btn({ onClick: function () { refresh(); } }, t("retry")),
							)
							: (data === null
								? React.createElement("p", { className: "sp-hint" }, t("loading"))
								: (templates.length === 0
									? React.createElement("div", { className: "sp-empty" },
										React.createElement("span", { className: "sp-empty-icon", "aria-hidden": "true" }),
										React.createElement("span", null, t("empty")),
									)
									: React.createElement("div", { className: "sp-tpl-grid" },
										templates.map(function (item) {
											return React.createElement("div", { className: "sp-tpl-card", key: item.id },
												React.createElement("div", { className: "sp-row" },
													React.createElement("span", { className: "sp-tpl-name" }, item.name),
													item.id === defaultId ? React.createElement("span", { className: "sp-badge" }, t("defaultTemplateLabel2")) : null,
												),
												item.description ? React.createElement("span", { className: "sp-tpl-desc" }, item.description) : null,
												React.createElement("div", { className: "sp-actions" },
													Btn({ onClick: function () { setTpl(item.id); setSent(""); } }, t("useTpl")),
												),
											);
										}),
									))),
					),
				);
			}
			return Workbench;
		}

		/* ── 入口：注册 locale 字典 + settings.section + 工作台 ── */

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
			
			// ── v1 剪贴板桥（fallback）：复制到剪贴板 + 切回会话视图，用户
			// 粘贴(⌘V/Ctrl+V)回车即发。v2/v3 正式链路任一步失败时降级到这里。
			// 实现已提到模块级 clipboardFallback(ctx, text)——会话桥 v3 是模块级
			// 函数（拿不到本闭包），两条链路共用同一份降级逻辑，行为不变。
			var copyToClipboardBridge = function (text) { return clipboardFallback(ctx, text); };

			// ── 创作提示词发送桥 v2（0.1.16 正式链路）──
			// 1) 会话落点（含工作区选择）：同工作区 → 当前会话；跨工作区/无会话 →
			//    uiWorkspace.openWorkspace(ws)（connectWorkspace 复用空白会话或新建，
			//    并自动切回对话视图）；工作区列表空 → sessions.create() + open。
			// 2) 填草稿：sessions.scope(id).conversation.input.for(actx).setDraft(text)
			//    —— SessionInputShell 按 session binding 构建，面板激活时也能写
			//    输入框（旧版被迫用剪贴板的时代原因已消除）。
			// 3) 任一步不可达 → 降级 v1 剪贴板。返回 'draft' | 'copied' | 'none'。
			var sendToChat = function (text, workspaceId) {
				var fallback = function () { return copyToClipboardBridge(text); };
				var plan;
				try {
					var sessions = ctx.sessions;
					if (!sessions || !sessions.list || typeof sessions.list.getSnapshot !== "function") {
						return Promise.resolve(fallback());
					}
					var current = sessions.list.getSnapshot().current;
					var wsList = (ctx.workspaces && ctx.workspaces.list && typeof ctx.workspaces.list.getSnapshot === "function")
						? ctx.workspaces.list.getSnapshot() : null;
					var wsOfCurrent = null;
					if (current && wsList) {
						for (var i = 0; i < wsList.items.length; i += 1) {
							if (wsList.items[i].sessionIds.indexOf(current) !== -1) { wsOfCurrent = wsList.items[i].workspaceId; break; }
						}
					}
					var wantsSwitch = workspaceId && wsOfCurrent !== workspaceId;
					if (current && !wantsSwitch) plan = Promise.resolve(current);
					else if (ctx.uiWorkspace && typeof ctx.uiWorkspace.openWorkspace === "function" && wsList && wsList.items.length > 0) {
						var target = workspaceId || wsOfCurrent || wsList.items[0].workspaceId;
						plan = Promise.resolve(ctx.uiWorkspace.openWorkspace(target)).then(function () {
							return sessions.list.getSnapshot().current || null;
						});
					} else if (typeof sessions.create === "function") {
						plan = sessions.create().then(function (id) {
							try { if (typeof sessions.open === "function") sessions.open(id); } catch (openError) { /* 已选中 */ }
							try {
								if (ctx.layout && typeof ctx.layout.selectPanel === "function") ctx.layout.selectPanel(null);
							} catch (layoutError) { /* 留在当前面板 */ }
							return id;
						});
					} else plan = Promise.resolve(null);
				} catch (bridgeError) {
					console.warn("dsh-super-ppts sendToChat 定位会话异常:", bridgeError && bridgeError.message);
					return Promise.resolve(fallback());
				}
				return Promise.resolve(plan).then(function (sessionId) {
					if (sessionId === null || sessionId === undefined) return fallback();
					try {
						try {
							if (ctx.layout && typeof ctx.layout.selectPanel === "function") ctx.layout.selectPanel(null);
						} catch (layoutError) { /* 留在当前面板 */ }
						var actx = ctx.sessions.scope(sessionId);
						var conversation = actx && actx.conversation;
						var input = conversation && conversation.input;
						var shell = input && typeof input.for === "function" ? input.for(actx) : null;
						if (shell && typeof shell.setDraft === "function") {
							shell.setDraft(text);
							return "draft";
						}
					} catch (fillError) { /* 服务不可达：降级剪贴板 */ }
					return fallback();
				}, function () { return fallback(); });
			};

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
			sendToChatV3: sendToChatV3,
			clipboardFallback: clipboardFallback,
			uploadMaterial: uploadMaterial,
		};

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
