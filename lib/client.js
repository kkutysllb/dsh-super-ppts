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

		/** 任务状态 → 恢复落点视图（Plan 2b 会补 outline/progress/result 三个落点）。 */
		function viewForStatus(status) {
			switch (status) {
				case "waiting-outline":
				case "needs-input":
					return "outline";
				case "analyzing":
				case "building":
				case "reviewing":
					return "progress";
				case "completed":
					return "result";
				case "failed":
					return "progress";
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

		/* ── 视图占位（Task 3 / Task 7 替换内部实现）─────────
		 * 根容器类名由视图**自持**（不再读壳层下发的 props.className）：
		 * 壳层只负责按 view 分发，视图根自己决定 className。 */

		function makeNewTaskView(t, options) {
			function NewTaskView(props) {
				return React.createElement("div", { className: "sp-view-new-task" });
			}
			return NewTaskView;
		}

		function makeRecentView(t, options) {
			function RecentView(props) {
				return React.createElement("div", { className: "sp-view-recent" });
			}
			return RecentView;
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
			// 粘贴(⌘V/Ctrl+V)回车即发。v2 正式链路任一步失败时降级到这里。
			var copyToClipboardBridge = function (text) {
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
						var sessions = ctx.sessions;
						var current = sessions && sessions.list && typeof sessions.list.getSnapshot === "function"
							? sessions.list.getSnapshot().current : undefined;
						if (!current && sessions && typeof sessions.create === "function") {
							sessions.create().then(function (id) {
								try { if (typeof sessions.open === "function") sessions.open(id); } catch (openError) { /* 已选中 */ }
							}).catch(function () { /* 无落点：用户手动粘贴 */ });
						}
						try {
							if (ctx.layout && typeof ctx.layout.selectPanel === "function") ctx.layout.selectPanel(null);
						} catch (layoutError) { /* 服务不可达:留在当前面板 */ }
					} catch (bridgeError) {
						console.warn("dsh-super-ppts copyToClipboardBridge 会话桥异常:", bridgeError && bridgeError.message);
					}
					return "copied";
				});
			};

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
					}, makePanelsView(t, { api: api }));
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
			makeNewTaskView: makeNewTaskView,
			makeRecentView: makeRecentView,
		};

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
