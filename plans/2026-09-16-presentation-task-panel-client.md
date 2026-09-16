# 演示任务面板 · Plan 2a（client 面板骨架 + 新建任务 + 会话桥 v3）实现计划

**Goal:** 把侧边栏「演示文稿」面板从「Brief 填充器」改造成 DSH 原生单面板的任务工作区：用户能在一个面板内快速创建演示任务、追加本地素材、挑选内置/用户模板，点击「开始制作」后**任务自动启动**（无需回聊天窗口按回车），并在「最近任务」里看到它的状态。

**Architecture:** 沿用插件既有的 client 形态——`lib/client.js` 是**手写自注册 bundle**（`window.__ModuleLoader__.load({id, factory})` + `exports.apply` + `exports.inject`，React 经 `require("react")` 取得），由 `ctx.slots` 注册 `sidebar.panellist` 图标行与 `main` keyed 主面板。本计划把主面板重构为「面板壳 + 视图状态机 + 视图组件」三层，并新增**会话桥 v3**（`setDraft` + `submit()`）与 **任务 HTTP 数据面消费**（Plan 1 已实现的 `/super-ppts/api/tasks.*`）。

**Tech Stack:** 纯 JS（无构建步骤，手写 bundle）、React（经宿主 module loader 提供）、DSH client slots/locale/sessions/uiWorkspace 服务、`fetch` 到插件自有路由。测试走 `scripts/smoke-plugin.mjs` 的 stub-React + stub-ctx harness（**无 DOM**，靠遍历返回的 React 元素树做断言）。

**依据规格：** `docs/specs/2026-09-16-presentation-task-panel-design.md`
**上游计划：** `plans/2026-09-16-presentation-task-panel-host.md`（Plan 1，已交付：任务存储层、7 个 `tasks.*` API、素材上传路由、`ppts_task` 工具、内置模板元数据）

**范围说明：** 本计划（2a）交付「创建并启动任务 + 最近任务列表」。大纲确认视图、生成进度视图、结果视图与轮询细化归 **Plan 2b**。本计划**不 bump 版本号**（版本与 release note 归 2b）。

---

## 已冻结的 host 契约（Plan 1 产出，直接消费）

```text
POST /super-ppts/api/tasks.list      { status?, workspaceId? }        → { tasks: TaskIndexEntry[] }
POST /super-ppts/api/tasks.get       { id }                            → TaskRecord（artifacts 已做存在性投影）
POST /super-ppts/api/tasks.create    { title, brief, workspace }        → TaskRecord
POST /super-ppts/api/tasks.update    { id, patch }                      → TaskRecord
POST /super-ppts/api/tasks.delete    { id }                             → { deleted: true }
POST /super-ppts/api/tasks.outline   { id, pages }                      → TaskRecord（版本自增，转 waiting-outline）
POST /super-ppts/api/tasks.confirmOutline { id, version }               → TaskRecord（版本不符 400）
POST /super-ppts/api/tasks.materialDelete { id, materialId }            → TaskRecord
POST /super-ppts/api/tasks.materialStatus { id, materialId, status, error? } → TaskRecord
POST /super-ppts/api/templates.list  {}                                 → { templates[], defaultTemplate, prefs, builtinTemplates[] }
POST /super-ppts/tasks/upload?taskId=&name=   原始流式素材上传          → { name, size, path }
```

`TaskStatus` 值域：`creating` / `waiting-launch` / `analyzing` / `waiting-outline` / `needs-input` /
`building` / `reviewing` / `completed` / `failed` / `cancelled`（`draft` **不入库**，只是面板内存态）。

`templateId` 语义：`null` = 明确不使用模板；`undefined`（键缺失）= 跟随设置页默认模板。

---

## 文件结构

| 文件 | 责任 | 状态 |
|---|---|---|
| `lib/client.js` | 手写自注册 bundle：面板壳 + 视图状态机 + 各视图组件 + 会话桥 v3 + 任务 API 客户端 | 修改 |
| `src/client/index.ts` | 类型参考文件，**必须与 `lib/client.js` 手工保持同构**（冒烟哨兵会对账） | 修改 |
| `scripts/smoke-plugin.mjs` | client 侧断言（stub React + stub ctx，遍历元素树）+ 双源同构哨兵 pairs | 修改 |

**绿色提交约定（硬规则）**

每一个提交都必须是**冒烟全绿**的，仓库保持可 bisect。因此：

- 双源同构哨兵的 `pairs` 条目由**实现该符号的那个任务**自行追加，**不得提前预留**；
- 每个任务的 TDD 红测来自它自己新写的功能断言，而不是来自悬空的哨兵条目；
- 若某任务的实现被拆成多步，允许中间步骤红，但**提交前必须全绿**。

**结构约定（本计划新增，后续 Plan 2b 沿用）**

```text
lib/client.js 内的新分层
├── SP_* 常量            API 路径、视图名、状态分组表
├── api(method, body)    既有，复用（tasks.* / templates.list）
├── uploadMaterial(...)  新增：原始流式 POST /super-ppts/tasks/upload
├── sendToChatV3(...)    新增：会话桥 v3（定位会话 → setDraft → submit）
├── makePanelsView(t)    新增：面板壳（顶部 [新建任务][最近任务] 切换 + 视图分发）
├── makeNewTaskView(...) 新增：新建任务视图
├── makeRecentView(...)  新增：最近任务视图
├── makeTemplatePicker() 新增：模板选择器（内置 + 用户）
└── makeStatefulComponent(t)  既有：设置页「演示文稿」表单，**本计划不动它**
```

---

### Task 1: client 冒烟基建（React stub 扩展 + 元素树遍历助手）

**Files:**
- Modify: `scripts/smoke-plugin.mjs`

**背景**：client 侧断言靠 stub React 与遍历返回的元素树。本计划后续任务会用到 `React.useMemo`、`React.useState` 的函数式更新、以及 `React.createElement` 的 `key`/嵌套子元素，现有 stub 需先补齐，否则后续任务的红→绿链路跑不起来。

- [ ] **Step 1: 扩展 React stub**

在 `scripts/smoke-plugin.mjs` 中，把现有的 `stubReact` 定义（约 213 行，含 `createElement` / `useState` / `useEffect` / `useCallback` / `useRef`）替换为：

```js
// stub React：覆盖 client.js 用到的 createElement + hooks。
// useState 支持函数式更新（client 的列表改写会用到）；useEffect 记录 fn 以便断言副作用注册。
const hookLog = { effects: [], memos: [] }
const stubReact = {
  createElement(type, props, ...children) {
    const flat = []
    // React 语义：嵌套数组要摊平，null/false 子节点要丢弃——断言遍历依赖这一点
    const push = (value) => {
      if (Array.isArray(value)) { for (const item of value) push(item); return }
      if (value === null || value === undefined || value === false || value === true) return
      flat.push(value)
    }
    for (const child of children) push(child)
    return { $$el: true, type, props: props ?? {}, children: flat }
  },
  useState(initial) {
    const state = { value: typeof initial === 'function' ? initial() : initial }
    return [state.value, (next) => {
      state.value = typeof next === 'function' ? next(state.value) : next
    }]
  },
  useEffect(fn) { hookLog.effects.push(fn) },
  useMemo(fn) { hookLog.memos.push(fn); return fn() },
  useCallback(fn) { return fn },
  useRef(initial) { return { current: initial } },
}
```

- [ ] **Step 2: 新增元素树遍历助手**

在该文件的 client 侧区段（`const clientSource = await readFile(...)` 之后）插入：

```js
/* ── client 元素树助手（无 DOM：断言遍历 stub React 产出的树） ── */

/** 深度优先收集全部元素节点（含根）。 */
function collectElements(node, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (const item of node) collectElements(item, out); return out }
  if (node.$$el !== true) return out
  out.push(node)
  for (const child of node.children ?? []) collectElements(child, out)
  return out
}

/** 取元素的 className（client 用 className 标注可断言的结构）。 */
function classOf(element) {
  return String(element?.props?.className ?? '')
}

/** 按 className 子串筛选元素。 */
function byClass(tree, fragment) {
  return collectElements(tree).filter(element => classOf(element).includes(fragment))
}

/** 取渲染树中的全部文本内容（用于断言文案在场）。 */
function textOf(node, out = []) {
  if (node === null || node === undefined) return out
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out }
  if (Array.isArray(node)) { for (const item of node) textOf(item, out); return out }
  if (node.$$el === true) { for (const child of node.children ?? []) textOf(child, out) }
  return out
}

function treeText(tree) { return textOf(tree).join('') }

/** 按标签名筛选元素（type 可能是字符串标签或函数组件）。 */
function byTag(tree, tag) {
  return collectElements(tree).filter(element => element.type === tag)
}

/** 找到第一个满足断言的元素。 */
function findElement(tree, predicate) {
  return collectElements(tree).find(predicate)
}
```

- [ ] **Step 3: 运行确认 stub 扩展不破坏既有断言**

Run: `npm run build && npm run smoke`
Expected: **PASS 全绿、exit 0**，PASS 计数与改动前一致（本任务只加基建，不加断言——stub 的
`createElement` 现在会摊平数组并丢弃 `null`/`false` 子节点，必须确认既有 client 断言不受影响）。

> 本任务**不追加哨兵 pairs、也不新增功能断言**：按上面的「绿色提交约定」，哨兵条目由实现该符号的
> 任务自行追加。因此本任务结束时应与开始时一样全绿。

- [ ] **Step 4: 提交**

```bash
git add scripts/smoke-plugin.mjs
git commit -m "test(client): smoke scaffolding for task panel (react stub + tree helpers)"
```

---

### Task 2: 面板壳与视图状态机

**Files:**
- Modify: `lib/client.js`
- Modify: `src/client/index.ts`
- Test: `scripts/smoke-plugin.mjs`

- [ ] **Step 1: 写失败测试**

在 `scripts/smoke-plugin.mjs` 的 client 侧区段（`client 左侧栏接入对账` 块之后、清理区之前）插入：

```js
/* ═══ client 面板壳：视图状态机 ═══ */
{
  const registrations = []
  const ctxStub = {
    slots: {
      inject(slotType, loader) { loader() },
      register(options, component) { registrations.push({ options, component }); return () => {} },
    },
    locale: {
      register() { return () => {} },
      bind() { return (key) => key },
    },
    sessions: {
      list: { getSnapshot: () => ({ current: 'sess-1' }) },
      scope: () => ({ conversation: { input: { for: () => ({ setDraft() {}, submit() {} }) } } }),
      create: async () => 'sess-new',
      open() {},
    },
    workspaces: { list: { getSnapshot: () => ({ items: [], phase: 'ready' }) } },
    layout: { selectPanel() {} },
    effect(fn) { return fn() },
  }
  loadedModule.apply(ctxStub)
  const panel = registrations.find(r => r.options.name === 'main')
  check('client 注册 main keyed 面板', !!panel && panel.options.key === 'super-ppts-panel')
  const tree = panel.component({ useWorkspaces: (selector) => selector({ items: [], phase: 'ready' }) })
  check('面板壳渲染出视图切换（新建任务 / 最近任务）',
    byClass(tree, 'sp-tabs').length === 1
      && treeText(byClass(tree, 'sp-tabs')[0]).includes('newTask')
      && treeText(byClass(tree, 'sp-tabs')[0]).includes('recent'))
  check('默认落在新建任务视图', byClass(tree, 'sp-view-new-task').length === 1)
  check('面板壳不存在嵌套自建侧边栏/全屏容器',
    byClass(tree, 'sp-sidebar').length === 0 && byClass(tree, 'sp-fullscreen').length === 0)
}
```

> 说明：stub 的 `locale.bind` 返回 `(key) => key`，因此断言里比较的是**文案键**（如 `newTask`）而非中文文案——
> 这样断言语义稳定、不受翻译改动影响。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && npm run smoke`
Expected: FAIL —— `面板壳渲染出视图切换` 不成立（`lib/client.js` 仍注册旧的工作台组件）

- [ ] **Step 3: 在 `lib/client.js` 内实现面板壳**

在 `lib/client.js` 的文案字典 `zh` / `en` 中补充以下键（`zh` 给中文，`en` 给英文；键名两侧必须完全一致）：

```js
			// ── 面板壳 ──
			newTask: "新建任务",
			recent: "最近任务",
			panelTitle: "演示文稿",
			newTaskTitle: "新建演示任务",
			newTaskIntro: "从一个想法、文本或本地文件开始，Agent 会直接帮你制作。",
```

在该文件「工具」区段（`function Btn(...)` 附近）之后，新增常量与面板壳：

```js
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

				var body;
				if (view === SP_VIEW_RECENT) {
					body = React.createElement(makeRecentView(t, { tasks: tasks, loadErr: loadErr, refresh: refreshTasks }), {
						useWorkspaces: props && props.useWorkspaces,
					});
				} else {
					body = React.createElement(makeNewTaskView(t, {
						onCreated: function () { refreshTasks(); setView(SP_VIEW_RECENT); },
						tasks: tasks,
					}), { useWorkspaces: props && props.useWorkspaces });
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
```

在 `apply(ctx)` 里，把 `main` keyed 面板注册的组件从 `makeWorkbenchComponent(t, sendToChat)` 改为：

```js
					var disposePanel = ctx.slots.register({
						name: "main",
						key: PANEL_ID,
					}, makePanelsView(t, { sendToChatV3: sendToChatV3, api: api, uploadMaterial: uploadMaterial }));
```

> 本任务先只实现面板壳，`makeNewTaskView` / `makeRecentView` 在下两个任务里实现并注册到文件作用域。
> 为了让本任务的冒烟可跑，**本任务需要同时给出这两个视图的最小占位实现**（返回带
> `className: "sp-view-new-task"` / `"sp-view-recent"` 的空容器），后续任务替换其内部实现。

- [ ] **Step 4: 同步 `src/client/index.ts`**

在类型参考文件中补充同构说明与符号（保持与 `lib/client.js` 一致，冒烟哨兵会对账）。至少包含：`SP_VIEW_NEW`、`viewForStatus`、`statusGroupOf`、`makePanelsView`、`makeNewTaskView`、`makeRecentView`、`makeTemplatePicker`、`sendToChatV3`、`uploadMaterial` 的声明或 JSDoc 引用，以及文件头 BUILD NOTE 里对新分层的说明。

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run build && npm run smoke`
Expected: `面板壳` 三条断言 PASS；同时把本任务实现的符号追加进双源同构哨兵的 `pairs`
（`makePanelsView`、`SP_VIEW_NEW`、`viewForStatus`、`statusGroupOf` 两侧同时在场），**全绿提交**。

- [ ] **Step 6: 提交**

```bash
git add lib/client.js src/client/index.ts scripts/smoke-plugin.mjs
git commit -m "feat(client): task panel shell with view state machine"
```

---

### Task 3: 新建任务视图（Brief + 交付形态 + 快速开始 + 配置摘要）

**Files:**
- Modify: `lib/client.js`
- Modify: `src/client/index.ts`
- Test: `scripts/smoke-plugin.mjs`

- [ ] **Step 1: 写失败测试**

在 Task 2 的断言块之后插入：

```js
/* ═══ client 新建任务视图：默认极简 + 可展开完整配置 ═══ */
{
  const registrations = []
  const ctxStub = { /* 与 Task 2 相同的 stub（此处复制一份，保持断言块自足） */ }
  // …（用与 Task 2 相同的 ctxStub 内容）
  loadedModule.apply(ctxStub)
  const panel = registrations.find(r => r.options.name === 'main')
  const tree = panel.component({ useWorkspaces: (selector) => selector({ items: [{ workspaceId: 'ws1', path: '/tmp/ws1', title: '季度汇报', sessionIds: [] }], phase: 'ready' }) })

  check('新建任务：主题输入是主入口（textarea 在场）',
    byClass(tree, 'sp-topic-input').length === 1 && byClass(tree, 'sp-topic-input')[0].type === 'textarea')
  check('新建任务：交付形态是两张卡片而非下拉框',
    byClass(tree, 'sp-format-card').length === 2
      && byClass(tree, 'sp-format-card').every(el => el.type === 'button'))
  check('新建任务：默认只显示极简路径（更多选项默认折叠）',
    byClass(tree, 'sp-advanced-body').length === 0
      && byClass(tree, 'sp-advanced-toggle').length === 1)
  check('新建任务：主按钮是「开始制作」而非「放入输入框」',
    byClass(tree, 'sp-start').length === 1
      && !treeText(tree).includes('sendToChat'))
  check('新建任务：无嵌套侧边栏/全屏容器', byClass(tree, 'sp-sidebar').length === 0)
  check('新建任务：未填主题时主按钮禁用',
    byClass(tree, 'sp-start')[0].props.disabled === true)
}
```

> 注意：主题为空 → 主按钮 disabled 是本任务的核心交互契约之一。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && npm run smoke`
Expected: FAIL —— `sp-topic-input` 等 className 不存在

- [ ] **Step 3: 实现 `makeNewTaskView`**

替换 Task 2 留下的占位实现。要求（className 是**断言契约**，不可改名）：

| 元素 | 必需 className | 行为 |
|---|---|---|
| 视图根 | `sp-view-new-task` | — |
| 主题输入 | `sp-topic-input`（`<textarea>`） | 受控；`rows: 3`；占位文案取 `topicPlaceholder` |
| 快速开始容器 | `sp-quick-row` | 8 个 chip，点击把对应 `qNText` 填入主题（保留可编辑） |
| 快速开始 chip | `sp-quick-chip` | `<button type="button">` |
| 交付形态卡片 | `sp-format-card`（两张，`<button type="button">`） | 选中态附加 `sp-format-card-active`；默认取 `prefs.defaultFormat`，为 `ask` 时默认 PPTX |
| 更多选项开关 | `sp-advanced-toggle`（`<button type="button">`） | 切换折叠；展开态容器为 `sp-advanced-body` |
| 配置摘要 | `sp-config-summary` | 一行文本：主题/形态/模板/素材数/预计页数；`sp-config-summary-extra` 为展开明细 |
| 主按钮 | `sp-start`（`<button type="button">`） | 文案 `startTask`；主题 trim 为空时 `disabled: true` |
| 素材入口 | `sp-material-add` | 点击触发隐藏 `<input type="file" multiple>` |
| 素材列表 | `sp-material-list` / `sp-material-item` | 每项显示名称/大小/状态 + 删除按钮 `sp-material-remove` |

**「开始制作」的编排（本任务只接创建与启动，不接后续视图）**：

```js
				var onStart = function () {
					var topic = String(topicDraft || "").trim();
					if (topic === "") return;
					setBusy(true); setMsg("");
					bridges.createTask({
						title: topic.slice(0, 40),
						brief: buildBrief(),
						workspace: selectedWorkspace(),
						materials: materials,
					}).then(function (result) {
						// result: { task, phase: 'started' | 'waiting-launch', message }
						if (result.phase === "started") {
							setMsg(t("taskStarted"));
							if (onCreated) onCreated(result.task);
						} else {
							setMsg(t("taskWaitingLaunch"));
						}
					}).catch(function (error) {
						setMsg(t("taskCreateFailed") + "：" + String((error && error.message) || error));
					}).then(function () { setBusy(false); });
				};
```

`buildBrief()` 必须按 host 契约产出：

```js
		/** 组装 host 接受的 brief；templateId 的三态语义必须保真。 */
		function buildBriefFrom(state) {
			var brief = {
				topic: String(state.topic || "").trim(),
				format: state.format === "html" ? "html" : "pptx",
			};
			if (state.audience) brief.audience = state.audience;
			if (state.scenario) brief.scenario = state.scenario;
			if (state.pageCount) brief.pageCount = state.pageCount;
			if (state.style) brief.style = state.style;
			if (state.styleNotes) brief.styleNotes = state.styleNotes;
			// 三态："" = 跟随默认（不写键）；"none" = 不使用模板（null）；其它 = 具体模板 id
			if (state.templateChoice === "none") brief.templateId = null;
			else if (state.templateChoice) {
				brief.templateId = state.templateChoice.id;
				brief.templateName = state.templateChoice.name;
				brief.templateSource = state.templateChoice.source;
			}
			return brief;
		}
```

- [ ] **Step 4: 补充文案键**

`zh` / `en` 各补：`startTask`、`topicPlaceholder`、`advancedOptions`、`configSummary`、`formatPptxCard`、
`formatHtmlCard`、`formatPptxHint`、`formatHtmlHint`、`taskStarted`、`taskWaitingLaunch`、`taskCreateFailed`、
`materialAdd`、`materialList`、`materialRemove`、`topicRequired`。

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run build && npm run smoke`
Expected: 新建任务视图六条断言 PASS

- [ ] **Step 6: 提交**

```bash
git add lib/client.js src/client/index.ts scripts/smoke-plugin.mjs
git commit -m "feat(client): new-task view (brief + format cards + advanced options + summary)"
```

---

### Task 4: 模板选择器（插件内置 + 用户上传）

**Files:**
- Modify: `lib/client.js`
- Modify: `src/client/index.ts`
- Test: `scripts/smoke-plugin.mjs`

- [ ] **Step 1: 写失败测试**

```js
/* ═══ client 模板选择器：内置与用户模板必须分组且来源可辨 ═══ */
{
  const registrations = []
  const ctxStub = { /* 同上 */ }
  loadedModule.apply(ctxStub)
  const panel = registrations.find(r => r.options.name === 'main')
  const tree = panel.component({})
  // 模板选择器在展开「更多制作选项」后才出现（快速路径保持极简）
  const advancedToggle = byClass(tree, 'sp-advanced-toggle')[0]
  // 直接构造选择器组件的渲染结果做结构断言（不依赖交互模拟）
  const picker = loadedModule.__testHooks.makeTemplatePicker(
    (key) => key,
    {
      builtin: [
        { id: 'builtin-exec-review', source: 'builtin', name: '高管经营汇报', scenario: '季度汇报', tags: ['商务'], ratio: '16:9', accent: '#2F6FEB' },
      ],
      user: [
        { id: 't1', name: '公司品牌模板', description: '季度汇报用', isDefault: true },
      ],
      onPick: function () {},
      onClose: function () {},
    },
  )
  const rendered = picker({})
  check('模板选择器：内置与用户模板分组渲染',
    byClass(rendered, 'sp-tpl-group-builtin').length === 1
      && byClass(rendered, 'sp-tpl-group-user').length === 1)
  check('模板选择器：来源标签可辨（不依赖颜色）',
    byClass(rendered, 'sp-tpl-source').length >= 2
      && treeText(rendered).includes('tplBuiltin') && treeText(rendered).includes('tplUser'))
  check('模板选择器：每张卡片有占位预览与名称',
    byClass(rendered, 'sp-tpl-card').length === 2
      && byClass(rendered, 'sp-tpl-thumb').length === 2
      && treeText(rendered).includes('高管经营汇报')
      && treeText(rendered).includes('公司品牌模板'))
  check('模板选择器：默认模板有默认标记', byClass(rendered, 'sp-tpl-default').length === 1)
  check('模板选择器：「不使用模板」与「跟随默认」是两个不同选项',
    byClass(rendered, 'sp-tpl-none').length === 1
      && byClass(rendered, 'sp-tpl-follow').length === 1)
}
```

> 断言依赖一个**测试钩子**：在 bundle 的 `module.exports` 上挂 `__testHooks`（见 Step 3）。
> 这是为了让组件能被单独渲染断言，而不必模拟完整交互。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && npm run smoke`
Expected: FAIL —— `makeTemplatePicker` 未实现 / `__testHooks` 不存在

- [ ] **Step 3: 实现 `makeTemplatePicker` 与测试钩子**

`makeTemplatePicker(t, options)` 返回一个组件的**工厂**（`options` 为 `{ builtin, user, onPick, onClose }`）。
className 契约：`sp-tpl-picker`（根）、`sp-tpl-filter`（`[全部][插件内置][我的模板]` 三个按钮）、
`sp-tpl-search`（搜索输入）、`sp-tpl-group-builtin` / `sp-tpl-group-user`（分组容器）、
`sp-tpl-card`（卡片）、`sp-tpl-thumb`（占位预览，`style.background` 用 `accent`；用户模板用中性色）、
`sp-tpl-source`（来源标签文本：内置 → `t("tplBuiltin")`，用户 → `t("tplUser")`）、
`sp-tpl-default`（默认标记，文案 `t("defaultBadge")`）、`sp-tpl-use`（使用按钮）、
`sp-tpl-none`（不使用模板）、`sp-tpl-follow`（跟随默认模板）、`sp-tpl-manage`（去设置页管理模板的辅助入口）。

按来源筛选与搜索可按名称/描述过滤（纯内存过滤，不发请求）。

在 bundle 末尾 `exports.apply = apply;` 之前插入测试钩子：

```js
		// 测试钩子：冒烟脚本无 DOM，靠直接渲染子组件做结构断言（仅测试使用，无运行时副作用）
		exports.__testHooks = {
			makeTemplatePicker: makeTemplatePicker,
			MakePanelsView: makePanelsView,
			viewForStatus: viewForStatus,
			statusGroupOf: statusGroupOf,
			buildBriefFrom: buildBriefFrom,
			SP_VIEW_NEW: SP_VIEW_NEW,
		};
```

- [ ] **Step 4: 补充文案键**

`zh` / `en` 各补：`tplPickerTitle`、`tplFilterAll`、`tplFilterBuiltin`、`tplFilterUser`、`tplSearch`、
`tplBuiltin`、`tplUser`、`tplNone`、`tplNoneHint`、`tplFollow`、`tplFollowHint`、`tplManage`、`tplUse`。

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run build && npm run smoke`
Expected: 模板选择器五条断言 PASS

- [ ] **Step 6: 提交**

```bash
git add lib/client.js src/client/index.ts scripts/smoke-plugin.mjs
git commit -m "feat(client): template picker with builtin + user sources"
```

---

### Task 5: 素材上传与状态

**Files:**
- Modify: `lib/client.js`
- Modify: `src/client/index.ts`
- Test: `scripts/smoke-plugin.mjs`

- [ ] **Step 1: 写失败测试**

```js
/* ═══ client 素材上传 ═══ */
{
  const uploaded = []
  const fakeFetch = (url, init) => {
    uploaded.push({ url: url, method: init && init.method })
    return Promise.resolve({
      text: () => Promise.resolve(JSON.stringify({ ok: true, value: { name: 'Q3.xlsx', size: 2048, path: '/tmp/m/Q3.xlsx' } })),
    })
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = fakeFetch
  try {
    const result = await loadedModule.__testHooks.uploadMaterial('k123', new BlobContent('Q3.xlsx', 2048))
    check('素材上传：走任务素材路由且带 taskId 与文件名',
      uploaded.length === 1
        && uploaded[0].url.indexOf('/super-ppts/tasks/upload') === 0
        && uploaded[0].url.indexOf('taskId=k123') !== -1
        && decodeURIComponent(uploaded[0].url).indexOf('name=Q3.xlsx') !== -1
        && uploaded[0].method === 'POST')
    check('素材上传：返回宿主登记的素材信息', result && result.name === 'Q3.xlsx' && result.size === 2048)
  } finally {
    globalThis.fetch = originalFetch
  }

  let failed = false
  globalThis.fetch = () => Promise.resolve({ text: () => Promise.resolve(JSON.stringify({ ok: false, error: { code: 'bad-request', message: '素材超过大小上限' } })) })
  try {
    await loadedModule.__testHooks.uploadMaterial('k123', new BlobContent('big.bin', 10))
  } catch (error) { failed = /大小上限/.test(String(error && error.message)) }
  finally { globalThis.fetch = originalFetch }
  check('素材上传：宿主拒绝时抛出可读错误（不静默吞掉）', failed)
}

/** 伪 File：client 只用到 name 与流式 body，测试里给最小替身。 */
function BlobContent(name, size) { this.name = name; this.size = size }
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && npm run smoke`
Expected: FAIL —— `uploadMaterial` 未实现

- [ ] **Step 3: 实现 `uploadMaterial`**

```js
		/**
		 * 素材上传：原始流式 POST 到插件自有路由（与 host 的 /super-ppts/tasks/upload 一致）。
		 * 返回宿主登记的素材信息 { name, size, path }；失败抛出带宿主 message 的错误。
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
```

同时把 `__testHooks` 里加上 `uploadMaterial: uploadMaterial`。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run build && npm run smoke`
Expected: 素材上传两条断言 PASS

- [ ] **Step 5: 提交**

```bash
git add lib/client.js src/client/index.ts scripts/smoke-plugin.mjs
git commit -m "feat(client): material upload to task route"
```

---

### Task 6: 会话桥 v3（直接开始制作）

**Files:**
- Modify: `lib/client.js`
- Modify: `src/client/index.ts`
- Test: `scripts/smoke-plugin.mjs`

**这是本计划的核心技术点。** Plan 1 已核实宿主契约同时提供 `setDraft(text)` 与 `submit()`，
因此「点击开始制作后自动提交、用户无需回车」走原生路径：**先 `setDraft(brief)` 再 `submit()`**。

- [ ] **Step 1: 写失败测试**

```js
/* ═══ client 会话桥 v3：直接开始制作（setDraft + submit） ═══ */
{
  const calls = []
  const ctxStub = {
    slots: { inject(slotType, loader) { loader() }, register() { return () => {} } },
    locale: { register() { return () => {} }, bind() { return (key) => key } },
    sessions: {
      list: { getSnapshot: () => ({ current: 'sess-1' }) },
      scope(id) {
        calls.push({ scope: id });
        return { conversation: { input: { for: () => ({
          setDraft(text) { calls.push({ setDraft: text }) },
          submit() { calls.push({ submit: true }) },
        }) } } };
      },
      create: async () => 'sess-new',
      open(id) { calls.push({ open: id }) },
    },
    workspaces: { list: { getSnapshot: () => ({ items: [{ workspaceId: 'ws1', sessionIds: ['sess-1'] }], phase: 'ready' }) } },
    layout: { selectPanel() {} },
    effect(fn) { return fn() },
  }
  loadedModule.apply(ctxStub)
  const result = await loadedModule.__testHooks.sendToChatV3(ctxStub, '任务 ID：k123\n主题：Q3 复盘', 'ws1')
  check('会话桥 v3：把 Brief 写入会话输入框（setDraft）',
    calls.some(call => typeof call.setDraft === 'string' && call.setDraft.indexOf('任务 ID：k123') !== -1))
  check('会话桥 v3：随后自动提交（submit），用户无需回车',
    calls.some(call => call.submit === true) && result === 'submitted')
  check('会话桥 v3：setDraft 先于 submit',
    calls.findIndex(call => call.setDraft) < calls.findIndex(call => call.submit))

  // 降级：输入面不可达时必须回退剪贴板，而不是静默失败
  const noInputCtx = JSON.parse(JSON.stringify({ sessions: null }))
  noInputCtx.sessions = { list: { getSnapshot: () => ({ current: 'sess-1' }) }, scope: () => undefined, create: async () => 's', open() {} }
  const fallbackResult = await loadedModule.__testHooks.sendToChatV3(noInputCtx, 'brief text', '')
  check('会话桥 v3：输入面不可达时降级剪贴板（返回 copied 或 none，不抛错）',
    fallbackResult === 'copied' || fallbackResult === 'none')
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && npm run smoke`
Expected: FAIL —— `sendToChatV3` 未实现

- [ ] **Step 3: 实现 `sendToChatV3` 与任务创建编排**

`sendToChatV3(ctx, text, workspaceId)` 的返回语义：`'submitted'`（已写入并提交）/ `'copied'`（降级剪贴板）/
`'none'`（全失败）。实现要求：

1. **定位会话**（沿用既有 v2 逻辑）：同工作区 → 当前会话；否则 `uiWorkspace.openWorkspace(ws)` 后取
   `sessions.list.getSnapshot().current`；工作区列表空 → `sessions.create()` + `open()`；定位失败 → 降级。
2. **写草稿**：`ctx.sessions.scope(sessionId)` → `conversation.input.for(actx)` → `setDraft(text)`。
3. **提交**：同一 `shell` 上调用 `submit()`（**若 `submit` 不存在则不得假装提交**，应降级剪贴板并返回 `'copied'`）。
4. 任一步抛错 → 既有剪贴板降级路径。

**任务创建编排 `createTask(bridges, input)`**（供新建任务视图调用）：

```js
		/**
		 * 创建并启动一个演示任务：
		 * 1) 先在 host 落盘任务记录（失败即中止，绝不产生「启动了但没有记录」的孤儿任务）
		 * 2) 逐个上传素材（失败的素材只标记错误，不阻塞启动）
		 * 3) 组装 Brief（内嵌「任务 ID：<id>」让 Agent 知道该用 ppts_task 上报）
		 * 4) 经 sendToChatV3 写入并提交（自动启动，无需用户回车）
		 * 5) 提交失败 → 把任务置为 waiting-launch（可恢复），并把会话 id 记回任务
		 */
		function createTaskAndStart(ctx, input) {
			var created = null;
			return api("tasks.create", {
				title: input.title,
				brief: input.brief,
				workspace: input.workspace,
			}).then(function (task) {
				created = task;
				var chain = Promise.resolve();
				(input.materials || []).forEach(function (file) {
					chain = chain.then(function () {
						return uploadMaterial(task.id, file).catch(function () { /* 单素材失败不阻塞启动 */ });
					});
				});
				return chain.then(function () { return task; });
			}).then(function (task) {
				var prompt = buildTaskPrompt(task);
				return sendToChatV3(ctx, prompt, input.workspace && input.workspace.id).then(function (phase) {
					if (phase === "submitted") {
						return api("tasks.update", { id: task.id, patch: { status: "analyzing" } }).then(function (updated) {
							return { task: updated, phase: "started" };
						});
					}
					// 提交不可达：任务已落盘但未启动，用户可重试
					return api("tasks.update", { id: task.id, patch: { status: "waiting-launch" } }).then(function (updated) {
						return { task: updated, phase: "waiting-launch" };
					});
				});
			});
		}

		/** 组装投递给 Agent 的 Brief 文本（含任务 id，Agent 据此调用 ppts_task）。 */
		function buildTaskPrompt(task) {
			var lines = ["请制作一份演示文稿。", "任务 ID：" + task.id];
			if (task.brief && task.brief.topic) lines.push("主题：" + task.brief.topic);
			if (task.brief && task.brief.audience) lines.push("目标受众：" + task.brief.audience);
			if (task.brief && task.brief.scenario) lines.push("使用场景：" + task.brief.scenario);
			if (task.brief && task.brief.pageCount) lines.push("预计页数：" + task.brief.pageCount);
			lines.push("交付形态：" + (task.brief && task.brief.format === "html" ? "HTML 在线演示" : "可编辑 PPTX"));
			if (task.brief && task.brief.templateId === null) lines.push("模板：不使用模板，按内容自由设计");
			else if (task.brief && task.brief.templateId) lines.push("模板：" + task.brief.templateName + "（" + task.brief.templateSource + "）");
			if (task.brief && task.brief.styleNotes) lines.push("风格要求：" + task.brief.styleNotes);
			var materials = (task.materials || []);
			if (materials.length > 0) {
				lines.push("素材文件（请先读取）：");
				for (var i = 0; i < materials.length; i += 1) lines.push("- " + materials[i].path);
			}
			lines.push("");
			lines.push("请先用 ppts_task 汇报「分析内容」阶段，完成内容分析与页面规划后，用 ppts_task 的 outline 动作提交页面大纲，然后**停下等待用户在工作台确认**，不要先生成 PPTX/HTML。");
			return lines.join("\n");
		}
```

> 注意「先落盘再启动」的顺序不可颠倒：Plan 1 的失败模式表要求「任务记录写入失败 → 明确报错，
	不得假装已创建」，而启动链路可能失败并被降级为剪贴板，所以落盘必须先行。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run build && npm run smoke`
Expected: 会话桥四条断言 PASS；并把 `sendToChatV3`、`uploadMaterial`、`createTaskAndStart`、
`buildTaskPrompt`、`tasks.create`、`/super-ppts/tasks/upload`、`submit` 追加进哨兵 pairs，**全绿提交**。

- [ ] **Step 5: 提交**

```bash
git add lib/client.js src/client/index.ts scripts/smoke-plugin.mjs
git commit -m "feat(client): session bridge v3 (setDraft + submit) + task start orchestration"
```

---

### Task 7: 最近任务视图

**Files:**
- Modify: `lib/client.js`
- Modify: `src/client/index.ts`
- Test: `scripts/smoke-plugin.mjs`

- [ ] **Step 1: 写失败测试**

```js
/* ═══ client 最近任务视图：待处理优先 + 状态可扫 ═══ */
{
  const t = (key) => key
  const view = loadedModule.__testHooks.makeRecentView(t, {
    tasks: [
      { id: 'k1', title: 'Q3 经营复盘', status: 'waiting-outline', format: 'pptx', workspaceName: '季度汇报', updatedAt: '2026-09-16T04:00:00.000Z' },
      { id: 'k2', title: '产品发布演示', status: 'building', format: 'html', workspaceName: '产品', updatedAt: '2026-09-16T05:00:00.000Z' },
      { id: 'k3', title: '技术分享', status: 'completed', format: 'pptx', workspaceName: '技术', updatedAt: '2026-09-15T05:00:00.000Z' },
      { id: 'k4', title: '失败的任务', status: 'failed', format: 'pptx', workspaceName: '技术', updatedAt: '2026-09-15T06:00:00.000Z' },
    ],
    loadErr: '', refresh: function () { return Promise.resolve(); },
  })
  const tree = view({})
  check('最近任务：按状态分组渲染（待处理 / 进行中 / 失败 / 已完成）',
    byClass(tree, 'sp-group-attention').length === 1
      && byClass(tree, 'sp-group-active').length === 1
      && byClass(tree, 'sp-group-failed').length === 1
      && byClass(tree, 'sp-group-done').length === 1)
  check('最近任务：待处理分组排在最前',
    collectElements(tree).filter(el => classOf(el).indexOf('sp-group-') === 0)[0] !== undefined
      && classOf(collectElements(tree).filter(el => classOf(el).indexOf('sp-group-') === 0)[0]) === 'sp-group-attention')
  check('最近任务：每条显示标题/状态/工作区且可点击恢复',
    byClass(tree, 'sp-task-item').length === 4
      && byClass(tree, 'sp-task-open').length === 4
      && treeText(tree).includes('Q3 经营复盘')
      && treeText(tree).includes('季度汇报'))
  check('最近任务：空列表给出可执行引导（而不是空白）',
    treeText(loadedModule.__testHooks.makeRecentView(t, { tasks: [], loadErr: '', refresh: function () { return Promise.resolve(); } })({}))
      .includes('recentEmpty'))
  check('最近任务：错误态可重试',
    byClass(loadedModule.__testHooks.makeRecentView(t, { tasks: [], loadErr: 'boom', refresh: function () { return Promise.resolve(); } })({}), 'sp-recent-retry').length === 1)
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && npm run smoke`
Expected: FAIL —— `makeRecentView` 只有占位实现

- [ ] **Step 3: 实现 `makeRecentView`**

要求：根 `sp-view-recent`；按 `statusGroupOf` 分四组渲染，容器 className 依次为
`sp-group-attention` / `sp-group-active` / `sp-group-failed` / `sp-group-done`，**空分组不渲染**；
每组标题文案键 `groupAttention` / `groupActive` / `groupFailed` / `groupDone`；条目 `sp-task-item`，
内含标题、状态徽标 `sp-task-status`、工作区名 `sp-work-name`、更新时间，以及按钮 `sp-task-open`
（点击进入该任务——Plan 2b 接落点，本任务先只切到对应视图：`viewForStatus`）。
空态容器 `sp-recent-empty`（文案 `recentEmpty`）；错误态容器 `sp-recent-error` + 重试按钮 `sp-recent-retry`（文案 `retry`）。

- [ ] **Step 4: 补充文案键**

`zh` / `en` 各补：`recentEmpty`、`recentError`、`retry`、`groupAttention`、`groupActive`、`groupFailed`、`groupDone`、`openTask`、`taskStatusWaitingOutline`、`taskStatusNeedsInput`、`taskStatusAnalyzing`、`taskStatusBuilding`、`taskStatusReviewing`、`taskStatusCompleted`、`taskStatusFailed`、`taskStatusCreating`、`taskStatusWaitingLaunch`、`taskStatusCancelled`。

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run build && npm run smoke`
Expected: 最近任务五条断言 PASS；把 `makeRecentView` 追加进哨兵 pairs，
此时哨兵应已覆盖本计划全部新符号（其余符号由各自任务在实现时追加）。

- [ ] **Step 6: 全量回归**

Run: `npm run build && npm run smoke`
Expected: **PASS 全绿、exit 0**，且 PASS 计数显著高于 Plan 1 结束时的 128+（client 侧新增约 22 条）

- [ ] **Step 7: 提交**

```bash
git add lib/client.js src/client/index.ts scripts/smoke-plugin.mjs
git commit -m "feat(client): recent tasks view with status grouping"
```

---

### Task 8: CSS 与宿主 token 对齐

**Files:**
- Modify: `lib/client.js`（`CSS` 常量数组）
- Test: `scripts/smoke-plugin.mjs`

- [ ] **Step 1: 写失败测试**

```js
/* ═══ client 样式：宿主 token + 无嵌套布局 ═══ */
{
  const css = readFileSync(join(packageRoot, 'lib', 'client.js'), 'utf8')
  check('样式引用宿主 alias token（--dsw-alias-*）', css.includes('--dsw-alias-border-l'))
  check('样式未引入自有全屏/固定定位容器',
    !/\.sp-(panels|view-[a-z-]+)\s*\{[^}]*position:\s*fixed/.test(css)
      && !/\.sp-(panels|view-[a-z-]+)\s*\{[^}]*100vh/.test(css))
  check('样式未使用 100vw（宽度交还宿主）', !/\.sp-(panels|view-[a-z-]+)[^{]*\{[^}]*100vw/.test(css))
  check('新增视图类名均有样式定义',
    ['sp-panels', 'sp-tabs', 'sp-view-new-task', 'sp-view-recent', 'sp-tpl-picker', 'sp-task-item']
      .every(name => css.includes('.' + name)))
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build && npm run smoke`
Expected: FAIL —— 新增类名尚无样式

- [ ] **Step 3: 在 `CSS` 数组中补齐样式**

要求（硬约束，对应规格「宿主边界与布局约束」）：

- 只做**单列纵向**布局；根容器 `.sp-panels` 不设宽度、不设高度、不设 `overflow`
- 不使用 `100vw` / `100vh` / `position: fixed`
- 颜色/边框优先用 `var(--dsw-alias-*, 回退值)` 形式，与文件既有 `.sp-panel` 等写法一致
- 新增类名（至少）：`.sp-panels`、`.sp-panels-head`、`.sp-panels-title`、`.sp-tabs`、`.sp-tab`、`.sp-tab-active`、
  `.sp-view-new-task`、`.sp-view-recent`、`.sp-topic-input`、`.sp-quick-row`、`.sp-quick-chip`、
  `.sp-format-card`、`.sp-format-card-active`、`.sp-advanced-toggle`、`.sp-advanced-body`、
  `.sp-config-summary`、`.sp-config-summary-extra`、`.sp-start`、`.sp-material-add`、`.sp-material-list`、
  `.sp-material-item`、`.sp-material-remove`、`.sp-tpl-picker`、`.sp-tpl-filter`、`.sp-tpl-search`、
  `.sp-tpl-group-builtin`、`.sp-tpl-group-user`、`.sp-tpl-card`、`.sp-tpl-thumb`、`.sp-tpl-source`、
  `.sp-tpl-default`、`.sp-tpl-use`、`.sp-tpl-none`、`.sp-tpl-follow`、`.sp-tpl-manage`、
  `.sp-task-item`、`.sp-task-status`、`.sp-work-name`、`.sp-task-open`、`.sp-group-attention`、
  `.sp-group-active`、`.sp-group-failed`、`.sp-group-done`、`.sp-recent-empty`、`.sp-recent-error`、
  `.sp-recent-retry`
- 窄窗口（`@media (max-width: 640px)`）下保持单列可读：模板卡片与交付形态卡片改单列

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run build && npm run smoke`
Expected: 样式四条断言 PASS

- [ ] **Step 5: 提交**

```bash
git add lib/client.js scripts/smoke-plugin.mjs
git commit -m "style(client): task panel layout with host design tokens"
```

---

## 验收（Plan 2a 完成判据）

1. `npm run build && npm run smoke` 全绿、exit 0；Plan 1 的 128+ 条断言零回归。
2. 点击侧边栏「演示文稿」→ 主面板顶部出现 `[新建任务] [最近任务]`，默认落在「新建任务」。
3. 面板**不出现**插件自建的侧边栏、右侧固定栏、全屏容器、`100vw`/`100vh`（冒烟有断言）。
4. 只填一句话即可点「开始制作」；未填时主按钮为 disabled。
5. 点击「开始制作」→ 任务在 host 落盘 → 自动写入会话输入框**并自动提交**（`setDraft` + `submit`），用户无需回到聊天窗口按回车。
6. 会话不可达时**降级**为剪贴板并把任务置 `waiting-launch`（可恢复），不静默失败。
7. 模板选择器同时展示「插件内置」与「我的模板」两组，来源以文本标签标明；「不使用模板」与「跟随默认模板」是两个不同选项。
8. 素材可多选上传、显示状态、可删除；单个素材失败不阻塞任务启动。
9. 「最近任务」按状态分组、待处理优先，空态与错误态（可重试）齐备。
10. `src/client/index.ts` 与 `lib/client.js` 双源同构哨兵全绿（本计划新增的符号两侧同时在场，由各任务在实现时自行追加）。

## 交给 Plan 2b 的接口

Plan 2a 落地后，Plan 2b 直接复用：

```text
makePanelsView(t, bridges)        面板壳：新增视图只需扩展 view 枚举与分发分支
viewForStatus(status)             状态 → 落点视图（2b 补 outline / progress / result 三个真实视图）
statusGroupOf(status)             状态 → 分组（最近任务视图已用）
__testHooks                       测试钩子（新增组件记得挂上去）
buildTaskPrompt(task)             Brief 文本组装（2b 的「继续生成」需要同款组装）
api(method, body)                 任务 API 客户端
```

Plan 2b 范围：大纲确认视图（直接编辑 + 自然语言让 Agent 修改 + 确认后提交继续指令）、
生成进度视图（阶段时间线 + 错误恢复）、结果视图（产物下载 + 继续修改）、
活跃任务轮询（3 秒，终态停止）、版本 1.4.0 + release note。
