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
		};

		var en = {
			nav: "Presentations",
			title: "Presentations",
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

		/* ── 入口：注册 locale 字典 + settings.section ──────── */

		var inject = ["slots", "locale"];

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
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
