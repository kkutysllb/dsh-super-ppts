# 演示任务面板 Plan 2b：大纲确认 / 生成进度 / 结果 / 轮询 / 发布 实施计划

**Goal:** 在 `lib/client.js` 任务面板壳上补齐 Plan 2a 留下的三个详情视图（大纲确认 / 生成进度 / 结果）与活跃任务轮询，让任务生命周期真正走到出片，并完成 1.4.0 版本收尾。

**Architecture:** 全部工作在既有单文件手写 bundle `lib/client.js`（`window.__ModuleLoader__.load` 自注册，宿主 main keyed 面板）内完成：模块级纯函数（提示词构建器 / 大纲页列表操作 / 轮询基元）→ 三个视图工厂（`makeOutlineReviewView` / `makeProgressView` / `makeResultView`）→ 壳层 `makePanelsView` 扩展任务详情路由与 3s 轮询。host 侧（`src/*.ts` → `lib/*.js`）**零改动**——Plan 1 已交付全部所需路由（`tasks.get` / `tasks.outline` / `tasks.confirmOutline` / `tasks.update`）。

**Tech Stack:** 无新依赖。手写 JS bundle（stub React 可渲染的函数组件）、`scripts/smoke-plugin.mjs` 零依赖断言、`tsc` 仅覆盖 host 源（`src/client/index.ts` 为保持同构的类型参考文件，需手工同步）。

---

## ⚠️ 硬规则（执行前必读，违反即返工）

1. **绿色提交约定**：每个 Task 结束时 `npm run build && npm run smoke` 必须 **exit 0 全绿**，一次提交保持可 bisect。哨兵 `pairs`（smoke 的「client 双源同构哨兵」块）**由实现该符号的任务添加**，绝不预留不存在的符号。
2. **stub-React 约束（决定断言写法）**：`useState` 返回快照 setter **不触发重渲染**；`useEffect` 只记录不执行；组件**不会被重复渲染**。因此：
   - 多字段交互逻辑一律下沉为**模块级纯函数**（`movePage` / `outlineDiffers` / `progressSteps`…），冒烟直接断言纯函数；
   - handler 接线（点击 → 调 api / 桥）可以断言，但**状态链式变化不可断言**（点击 A 后再点击 B 时 B 的 handler 读到的仍是首渲染快照）；
   - 需要非默认初始态的输入框（修改指令 / 补充回答 / 继续修改文案）一律 `useState(<options 注入>)`，真实 React 走受控输入、冒烟经 options 注入初始文案。
3. **文件边界**：本计划只改 `lib/client.js`、`src/client/index.ts`（类型参考）、`scripts/smoke-plugin.mjs`、`README.md`、`package.json`、`release/v1.4.0.md`、本计划文档。**严禁改** `src/tasks.ts`、`src/routes.ts`、`src/tools.ts`、`src/index.ts`、`lib/routes.js` 等 host 源（它们的 `lib/` 编译产物仅因 `npm run build` 重编译而可能时间戳变化，内容不变时无需提交）。
4. **宿主边界不变**：所有新视图仍是宿主 main keyed 面板内的**单列内容流**：无插件自有侧边栏 / 右侧栏 / 全屏容器 / `100vw` / `100vh` / `position:fixed`（冒烟有断言）；颜色边框走宿主 token（`var(--dsw-alias-*, 回退值)`）。
5. **反向验证**：每个任务实现完成后，实现者必须临时破坏一处新断言对应的行为（如删掉 confirm 的 `tasks.confirmOutline` 调用），确认**对应断言 FAIL**，还原后确认全绿，并在提交说明里记录破坏点。
6. **提交信息**：沿用 `feat(client): …` / `refactor(client): …` / `chore: …` 前缀；`lib/` 其余 host 产物若内容无变化不提交（避免空提交）。
7. **任务提示词自包含**：本文件各 Task 的代码块就是实现者的完整依据；实现者同时按 `grep -n "### Task N" plans/2026-09-16-presentation-task-panel-client-2b.md` 定位再 `read` 对应区间，不要凭记忆转述。

## 既有契约（Plan 1 / 2a 已交付，本计划消费）

- host 数据面（`api(method, body)` 已解 `{ok,value}` 信封，value 即载荷）：
  - `tasks.get {id}` → 完整 TaskRecord（含 `outline{version,pages[]}`、`events[]`、`artifacts[]`（`status:'missing'` 为存在性投影）、`stage?`、`brief`、`workspace`、`outlineVersion`、`confirmedOutlineVersion?`）；
  - `tasks.outline {id, pages[]}` → 保存为新版本（`outlineVersion+1`、状态转 `waiting-outline`、删除 `confirmedOutlineVersion`；**页 id 必须唯一、数组非空**，否则 400）；
  - `tasks.confirmOutline {id, version}` → 校验 `version === outlineVersion`，不符 400「大纲版本不匹配（当前 vN）」；成功置 `building` + 事件；
  - `tasks.update {id, patch:{status}}` → 状态推进（白名单见 host）。
- 状态全集：`creating / waiting-launch / analyzing / waiting-outline / needs-input / building / reviewing / completed / failed / cancelled`（`draft` 仅面板内存态）。
- 会话桥：模块级 `sendToChatV3(ctx, text, workspaceId)` → `Promise<'submitted'|'copied'|'none'>`；视图经壳层注入的 `bridges.sendToSession(text, workspaceId)` 调用（Task 6 接线，Task 3–5 的冒烟各自传 stub）。
- Brief 提示词：模块级 `buildTaskPrompt(task)`（大纲确认失败时的「重新启动生成」直接复用它——同一模块作用域内可直接调用）。
- 冒烟设施：`renderTree`（递归渲染函数组件）/ `byClass` / `classOf` / `findElement` / `callApi` / `fetchCalls`（记录桩）/ `hookLog`（记录 useEffect 注册）。

## 规格依据

`docs/specs/2026-09-16-presentation-task-panel-design.md`：「视图 2：大纲确认」「视图 3：生成与结果」「状态 → 恢复落点」「面板侧刷新策略」「失败模式与对策」「验收标准」第 4/5/6/9 条。

**两个明确的规格-实现对齐决策（本计划执行，实施时不得擅自改回）：**

- **D1 `viewForStatus` 修正**：Plan 2a 的占位把 `needs-input` 路由到大纲视图，但规格「状态 → 恢复落点」表把 `needs-input` 指向「补充信息区」（属于生成进度视图的一个状态块）；同时 `creating / waiting-launch / cancelled` 也各有落点（进度视图的对应变体）。修正后映射：
  `waiting-outline → outline`；`creating / waiting-launch / analyzing / building / reviewing / needs-input / failed / cancelled → progress`；`completed → result`；其余（含未知）→ `SP_VIEW_NEW`。
- **D2 进度视图按钮语义**：规格 mock 写「[暂停任务]」，但状态白名单只有 `cancelled`（规格「取消语义」：标 `cancelled`、仅停止面板轮询与后续推进，不碰 Agent 会话）。故按钮实现为 **[取消任务] → `tasks.update status: 'cancelled'`**，不做 `paused` 语义。
- **D3 产物无下载路由**：规格数据面路由表**没有**产物下载路由（产物是磁盘工作区里的绝对路径，浏览器页面无文件系统访问权）。结果视图对产物的操作实现为：类型徽标 + 状态 + 路径 + **复制路径** + 丢失时的「重新生成」（经会话桥）；真正的下载 / 预览路由记入 release note 已知边界，不在本计划内发明。

---

### Task 1: 壳层基元——`SP_VIEW_TASK` + `viewForStatus` 修正 + 活跃任务轮询

**Files:**
- Modify: `lib/client.js`（视图常量区 ~757 行起；`exports.__testHooks`）
- Modify: `src/client/index.ts`（同构类型参考 ~155–197 行区）
- Test: `scripts/smoke-plugin.mjs`（client 段新增一节）

- [ ] **Step 1: 写失败断言**（smoke 文件中「最近任务视图」一节之后新增）：

```js
/* ═══ Plan 2b Task 1：视图路由基元 + 活跃任务轮询 ═══ */
{
  const H = loadedModule.__testHooks
  // D1 修正后的恢复落点（规格「状态 → 恢复落点」表）
  check('viewForStatus: waiting-outline → outline',
    H.viewForStatus('waiting-outline') === 'outline')
  check('viewForStatus: creating/waiting-launch/needs-input/failed/cancelled → progress',
    H.viewForStatus('creating') === 'progress' && H.viewForStatus('waiting-launch') === 'progress'
    && H.viewForStatus('needs-input') === 'progress' && H.viewForStatus('failed') === 'progress'
    && H.viewForStatus('cancelled') === 'progress')
  check('viewForStatus: analyzing/building/reviewing → progress; completed → result',
    H.viewForStatus('analyzing') === 'progress' && H.viewForStatus('building') === 'progress'
    && H.viewForStatus('reviewing') === 'progress' && H.viewForStatus('completed') === 'result')
  check('viewForStatus: 未知/空 → SP_VIEW_NEW',
    H.viewForStatus(undefined) === H.SP_VIEW_NEW && H.viewForStatus('whatever') === H.SP_VIEW_NEW)

  // 轮询白名单：规格「面板侧刷新策略」固定四个活跃态
  check('isPollingStatus: 四个活跃态 true', H.isPollingStatus('analyzing') && H.isPollingStatus('building')
    && H.isPollingStatus('reviewing') && H.isPollingStatus('waiting-outline'))
  check('isPollingStatus: 终态/等待用户/未知 false',
    !H.isPollingStatus('completed') && !H.isPollingStatus('failed') && !H.isPollingStatus('cancelled')
    && !H.isPollingStatus('needs-input') && !H.isPollingStatus('creating')
    && !H.isPollingStatus('waiting-launch') && !H.isPollingStatus(undefined))

  // startTaskPolling：可注入 schedule 的轮询循环（真实 React effect 走默认 setInterval）
  const ticks = []
  let rescheduleCount = 0
  let cancelled = false
  const scheduled = []
  const pollApi = (method, body) => {
    check('startTaskPolling: 轮询请求 tasks.get + id', method === 'tasks.get' && body.id === 'k1')
    return Promise.resolve(pollQueue.length > 0 ? pollQueue.shift() : pollTaskActive)
  }
  const pollTaskActive = { id: 'k1', status: 'building' }
  const pollTaskDone = { id: 'k1', status: 'completed' }
  const pollQueue = [pollTaskActive, pollTaskActive, pollTaskDone]
  const cancelPoll = H.startTaskPolling('k1', (record) => ticks.push(record), {
    api: pollApi,
    schedule: (fn, ms) => {
      check('startTaskPolling: 调度间隔 = SP_POLL_MS', ms === H.SP_POLL_MS && H.SP_POLL_MS === 3000)
      rescheduleCount += 1
      scheduled.push(fn)
      return () => { cancelled = true }
    },
  })
  // 第 1 轮 loop：active → onTick + 重新调度
  await scheduled[0]()
  check('startTaskPolling: onTick 收到 tasks.get 记录', ticks.length === 1 && ticks[0].status === 'building')
  check('startTaskPolling: 活跃态继续调度', rescheduleCount === 2 && typeof scheduled[1] === 'function')
  // 第 2 轮：终态 → onTick 但不再调度
  await scheduled[1]()
  check('startTaskPolling: 终态停止调度', ticks.length === 3 && rescheduleCount === 2)
  // cancel 幂等（随后调用不抛）
  let cancelThrew = false
  try { cancelPoll(); cancelPoll() } catch { cancelThrew = true }
  check('startTaskPolling: cancel 可重复调用', !cancelThrew && cancelled)

  // 轮询请求失败（网络抖动）不终止循环：继续调度
  let errReschedule = 0
  const scheduledErr = []
  H.startTaskPolling('k2', () => {}, {
    api: () => Promise.reject(new Error('boom')),
    schedule: (fn) => { errReschedule += 1; scheduledErr.push(fn); return () => {} },
  })
  await scheduledErr[0]()
  check('startTaskPolling: 请求失败继续轮询', errReschedule === 2)
}
```

同时在「client 双源同构哨兵」的 `pairs` 数组**末尾**追加三对：

```js
    ['SP_VIEW_TASK', 'SP_VIEW_TASK'],                                 // 任务详情视图(Task 2b;打开任务的路由落点)
    ['isPollingStatus', 'isPollingStatus'],                           // 活跃态白名单(终态停止轮询)
    ['startTaskPolling', 'startTaskPolling'],                         // 轮询循环(可注入 schedule,3s 固定间隔)
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/smoke-plugin.mjs 2>&1 | grep -E "viewForStatus|isPollingStatus|startTaskPolling|FAIL" | head`
Expected: 新断言全 FAIL（`viewForStatus('needs-input')` 旧值是 `'outline'`；`SP_VIEW_TASK` / 轮询符号缺失导致 `H.isPollingStatus` undefined 报错被 check 捕获为 FAIL），且**既有 185 条不得出现新 FAIL**。

- [ ] **Step 3: 实现**（`lib/client.js`）

视图常量区（`SP_VIEW_RECENT` 之后）加：

```js
		var SP_VIEW_TASK = "task";
```

`viewForStatus` 整体替换（保留函数头注释并改写为 D1 依据）：

```js
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
```

`statusGroupOf` 之后新增轮询段：

```js
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
		 */
		function startTaskPolling(taskId, onTick, options) {
			var opts = options || {};
			var apiFn = typeof opts.api === "function" ? opts.api : api;
			var schedule = typeof opts.schedule === "function"
				? opts.schedule
				: function defaultSchedule(fn, ms) {
					var timer = setInterval(fn, ms);
					return function () { clearInterval(timer); };
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
				if (stopped) return;
				tick().then(function (again) {
					if (again && !stopped) cancelTimer = schedule(loop, SP_POLL_MS);
				});
			}
			cancelTimer = schedule(loop, SP_POLL_MS);
			return function cancel() {
				stopped = true;
				cancelTimer();
				cancelTimer = function () {};
			};
		}
```

`exports.__testHooks` 追加：

```js
			SP_VIEW_TASK: SP_VIEW_TASK,
			isPollingStatus: isPollingStatus,
			startTaskPolling: startTaskPolling,
			SP_POLL_MS: SP_POLL_MS,
```

- [ ] **Step 4: 同构类型参考**（`src/client/index.ts`）：`SP_VIEW_RECENT` 后加 `export const SP_VIEW_TASK = 'task'`；`viewForStatus` 文档与分支同步 D1；`statusGroupOf` 后加 `SP_POLL_STATUSES` / `SP_POLL_MS` / `isPollingStatus` / `startTaskPolling` 的参考声明（签名与实现一致，`startTaskPolling(taskId: string, onTick: (record: unknown) => void, options?: { api?: ...; schedule?: (fn: () => void, ms: number) => () => void }): () => void`）；文件头分层注释补三个新符号；`PptsPanelBridges` 增加：

```ts
  /** Plan 2b：会话消息桥（大纲修改指令 / 继续生成 / 补充信息 / 继续修改都走它）。 */
  sendToSession?(text: string, workspaceId?: string): Promise<'submitted' | 'copied' | 'none'>
```

- [ ] **Step 5: 全绿 + 反向验证**

Run: `npm run build && npm run smoke`（全绿，断言总数 185 → 约 199）。
反向验证：把 `viewForStatus` 的 `waiting-outline` 分支临时改回返回 `SP_VIEW_NEW` → 两条断言 FAIL；还原 → 全绿。把 `SP_POLL_MS` 临时改 1000 → 间隔断言 FAIL；还原。

- [ ] **Step 6: Commit**

```bash
git add lib/client.js src/client/index.ts scripts/smoke-plugin.mjs
git commit -m "feat(client): task routing primitives + active-task polling base"
```

---

### Task 2: 任务提示词构建器（继续生成 / 大纲修改 / 补充信息 / 继续修改 / 重新生成）

**Files:**
- Modify: `lib/client.js`（`buildTaskPrompt` 之后）
- Modify: `src/client/index.ts`
- Test: `scripts/smoke-plugin.mjs`

- [ ] **Step 1: 失败断言**（Task 1 一节之后）：

```js
/* ═══ Plan 2b Task 2：任务提示词构建器（纯函数）═══ */
{
  const B = loadedModule.__testHooks
  const task = {
    id: 'k9',
    status: 'waiting-outline',
    workspace: { id: 'ws1', name: '季度汇报', path: '/ws' },
    outlineVersion: 2,
    confirmedOutlineVersion: 2,
    outline: { version: 2, pages: [{ id: 'p1', title: '结论摘要', bullets: ['a'] }, { id: 'p2', title: '核心指标', bullets: [] }] },
    brief: { topic: 'Q3 经营复盘', format: 'pptx' },
    materials: [{ name: 'q3.xlsx', size: 1, path: '/t/k9/materials/q3.xlsx', status: 'ready' }],
    artifacts: [],
    events: [],
  }
  const full = B.buildTaskPrompt(task)
  check('buildContinuePrompt: 含任务 id / 已确认版本 / 页数 / artifact 登记要求', (() => {
    const text = B.buildContinuePrompt(task)
    return text.includes('任务 ID：k9') && text.includes('v2') && text.includes('2 页')
      && text.includes('artifact') && text.includes('completed')
  })())
  check('buildOutlineRevisePrompt: 含任务 id / 当前版本 / 指令 / outline 动作 / 停等确认', (() => {
    const text = B.buildOutlineRevisePrompt(task, '合并第 3、4 页')
    return text.includes('任务 ID：k9') && text.includes('v2') && text.includes('合并第 3、4 页')
      && text.includes('outline') && text.includes('等待用户')
  })())
  check('buildOutlineRevisePrompt: 空指令抛错', (() => {
    try { B.buildOutlineRevisePrompt(task, '   '); return false } catch { return true }
  })())
  check('buildNeedsInputPrompt: 含任务 id / 问题 / 回答', (() => {
    const text = B.buildNeedsInputPrompt(task, '利润口径？', '只看华东区')
    return text.includes('任务 ID：k9') && text.includes('利润口径？') && text.includes('只看华东区')
  })())
  check('buildNeedsInputPrompt: 空回答抛错', (() => {
    try { B.buildNeedsInputPrompt(task, 'q', '  '); return false } catch { return true }
  })())
  check('buildContinueEditPrompt: 含任务 id / 产物路径 / 只重做相关部分', (() => {
    const withArtifacts = Object.assign({}, task, { artifacts: [{ type: 'pptx', path: '/ws/deck.pptx', status: 'ready' }] })
    const text = B.buildContinueEditPrompt(withArtifacts, '把第 3 页改成折线图')
    return text.includes('任务 ID：k9') && text.includes('/ws/deck.pptx') && text.includes('把第 3 页改成折线图')
  })())
  check('buildContinueEditPrompt: 空指令抛错', (() => {
    try { B.buildContinueEditPrompt(task, ''); return false } catch { return true }
  })())
  check('buildRegeneratePrompt: 含任务 id / 产物类型 / 重新登记要求', (() => {
    const text = B.buildRegeneratePrompt(task, { type: 'pptx', path: '/ws/old.pptx', status: 'missing' })
    return text.includes('任务 ID：k9') && text.includes('pptx') && text.includes('artifact')
  })())
  check('buildTaskPrompt 不回归：Brief 文本仍含任务 id 与素材路径（Task 6 契约）',
    full.includes('任务 ID：k9') && full.includes('/t/k9/materials/q3.xlsx'))
}
```

哨兵 `pairs` 追加（实现完本任务符号后再加，不要提前）：

```js
    ['buildContinuePrompt', 'buildContinuePrompt'],                   // 大纲确认后的继续生成指令(Task 2)
    ['buildOutlineRevisePrompt', 'buildOutlineRevisePrompt'],         // 自然语言修改大纲指令(Task 2)
```

- [ ] **Step 2: 运行失败** → `node scripts/smoke-plugin.mjs`（新断言 FAIL，其余不回归）。

- [ ] **Step 3: 实现**（`lib/client.js`，`buildTaskPrompt` 函数之后；全部纯字符串函数，不碰 React）：

```js
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
				"请按已确认大纲逐页生成内容与视觉；完成后用 ppts_task 的 artifact 动作登记产物文件，并将任务状态推进到 completed。",
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
```

`__testHooks` 追加 `buildContinuePrompt / buildOutlineRevisePrompt / buildNeedsInputPrompt / buildContinueEditPrompt / buildRegeneratePrompt`；哨兵 pairs 加上面两对。

- [ ] **Step 4: 全绿 + 反向验证**（把 `buildContinuePrompt` 的任务 ID 行临时删掉 → 断言 FAIL；还原）。

- [ ] **Step 5: Commit**

```bash
git add lib/client.js src/client/index.ts scripts/smoke-plugin.mjs
git commit -m "feat(client): agent message prompt builders for task continuation"
```

---

### Task 3: 大纲确认视图 `makeOutlineReviewView`

**Files:**
- Modify: `lib/client.js`（`makeRecentView` 之前插入视图工厂 + 页操作纯函数；`__testHooks`；CSS 数组；zh/en 字典）
- Modify: `src/client/index.ts`
- Test: `scripts/smoke-plugin.mjs`

**视图契约（类名即断言契约）：**

```text
sp-view-outline
├── sp-outline-head: sp-back（← 返回）/ sp-task-title / sp-task-status
├── sp-outline-hint（"Agent 已生成 N 页结构。确认后才会继续生成…"）
├── sp-outline-pages
│   └── sp-outline-page（key=page.id）
│       ├── sp-page-index（"01"）
│       ├── sp-page-title（input）/ sp-page-purpose（input）
│       ├── sp-page-bullets（textarea，一行一个要点）
│       ├── sp-page-type（select，SP_PAGE_TYPES 十类）
│       └── sp-page-ops: sp-page-up / sp-page-down / sp-page-copy / sp-page-delete
├── sp-outline-add（＋ 添加页面）
├── sp-outline-dirty-banner（有未保存修改时出现：sp-outline-save [保存修改]）
├── sp-outline-revise: sp-outline-revise-text（textarea）+ sp-outline-revise（[让 Agent 修改]）
│   └── sp-revise-dirty-confirm（dirty 时点修改先出现：sp-revise-save [保存并修改] / sp-revise-discard [丢弃修改]）
├── sp-outline-confirm（主按钮 [确认大纲并继续生成]；busy/disabled）
├── sp-msg-ok / sp-msg-err（横幅；sp-outline-resync=「大纲已有新版本，已重新载入」）
└── sp-outline-empty（无大纲记录时的兜底空态）
```

- [ ] **Step 1: 页操作纯函数的失败断言**：

```js
/* ═══ Plan 2b Task 3a：大纲页操作纯函数 ═══ */
{
  const O = loadedModule.__testHooks.outlineOps
  const pages = [
    { id: 'p1', title: '结论摘要', purpose: '快速理解结论', bullets: ['收入+18%'], pageType: '结论页' },
    { id: 'p2', title: '核心指标', bullets: ['a', 'b'] },
    { id: 'p3', title: '趋势', bullets: [] },
  ]
  check('clonePages 深拷贝（改副本不动原数组）', (() => {
    const clone = O.clonePages(pages3())
    clone[0].title = 'X'; clone[1].bullets.push('Z')
    return pages3()[0].title === '结论摘要' && pages3()[1].bullets.length === 2
    function pages3() { return [{ id: 'p1', title: '结论摘要', bullets: ['收入+18%'] }, { id: 'p2', title: '核心指标', bullets: [] }, { id: 'p3', title: '趋势', bullets: [] }] }
  })())
  check('movePage: 上移换位且不越界', O.movePage([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }], 1, -1)[1].id === 'p1')
  check('movePage: 越界返回原顺序（不抛）',
    O.movePage([{ id: 'p1' }, { id: 'p2' }], 0, -1)[0].id === 'p1'
    && O.movePage([{ id: 'p1' }, { id: 'p2' }], 1, 1)[1].id === 'p2')
  check('copyPage: 复制到后一位且 id 全局唯一', (() => {
    const next = O.copyPage([{ id: 'p1', title: 'A' }, { id: 'p2', title: 'B' }], 0)
    return next.length === 3 && next[1].title === 'A' && next[1].id !== 'p1' && next[1].id !== 'p2'
  })())
  check('addPage: 追加新页（唯一 id + 注入标题）', (() => {
    const next = O.addPage([{ id: 'p1' }, { id: 'p2' }], '新页面')
    return next.length === 3 && next[2].id !== 'p1' && next[2].id !== 'p2' && next[2].title === '新页面'
  })())
  check('removePage: 删除目标页', O.removePage([{ id: 'p1' }, { id: 'p2' }], 0).length === 1)
  check('parseBullets: 丢空行、保留内容原样', JSON.stringify(O.parseBullets('a\n\n b \n')) === JSON.stringify(['a', ' b ']))
  check('outlineDiffers: 同构 false / 改标题或要点或类型 true', (() => {
    const saved = [{ id: 'p1', title: 'A', bullets: ['x'], pageType: '结论页' }]
    const same = O.clonePages(saved)
    const t = O.clonePages(saved); t[0].title = 'B'
    const b = O.clonePages(saved); b[0].bullets = ['x', 'y']
    const ty = O.clonePages(saved); ty[0].pageType = '对比页'
    const pu = O.clonePages(saved); pu[0].purpose = '目的'
    return !O.outlineDiffers(same, saved) && O.outlineDiffers(t, saved)
      && O.outlineDiffers(b, saved) && O.outlineDiffers(ty, saved) && O.outlineDiffers(pu, saved)
  })())
  check('outlineDiffers: undefined 与空串的 purpose 视为相同', (() => {
    const saved = [{ id: 'p1', title: 'A', bullets: [] }]
    const local = [{ id: 'p1', title: 'A', bullets: [], purpose: '' }]
    return !O.outlineDiffers(local, saved)
  })())
}
```

- [ ] **Step 2: 视图渲染与交互的失败断言**：

```js
/* ═══ Plan 2b Task 3b：大纲确认视图（stub React 直接渲染 + 点击断言）═══ */
{
  const H = loadedModule.__testHooks
  const t = (key) => key
  const outlineTask = () => ({
    id: 'k1', title: 'Q3 经营复盘', status: 'waiting-outline',
    workspace: { id: 'ws1', name: '季度汇报', path: '/ws' },
    brief: { topic: 'Q3 经营复盘', format: 'pptx' },
    outlineVersion: 1,
    outline: { version: 1, pages: [
      { id: 'p1', title: '结论摘要', purpose: '帮助管理层快速理解', bullets: ['收入同比增长 18%'], pageType: '结论页' },
      { id: 'p2', title: '核心经营指标', bullets: ['利润率下降 2.4pt'], pageType: 'KPI 数据页' },
    ] },
    materials: [], artifacts: [],
    events: [{ at: '2026-09-16T04:00:00.000Z', kind: 'outline', text: '已生成大纲 v1（2 页）' }],
  })
  const sent = []
  const outlineOpts = (extra) => Object.assign({
    task: outlineTask(),
    api: (method, body) => { apiCallsOutline.push({ method, body }); return Promise.resolve(Object.assign({}, outlineTask(), { outlineVersion: (body && body.pages ? 2 : outlineTask().outlineVersion), status: method === 'tasks.confirmOutline' ? 'building' : 'waiting-outline', confirmedOutlineVersion: method === 'tasks.confirmOutline' ? (body && body.version) : undefined })) },
    sendToSession: (text, wsId) => { sent.push({ text, wsId }); return Promise.resolve('submitted') },
    onUpdated: (next) => { updatedWith = next },
    onBack: () => { backed = true },
  }, extra || {})
  // —— apiCallsOutline/updatedWith/backed/extra 在本块顶部声明并每例重置 ——
  let apiCallsOutline = []; let updatedWith = null; let backed = false; let extra = null
  const outlineTree = () => H.makeOutlineReviewView(t, outlineOpts())({})

  const tree = outlineTree()
  check('大纲视图根类名 sp-view-outline', !!byClass(tree, 'sp-view-outline').length)
  check('大纲视图渲染页卡片×2 + 页标题输入', (() => {
    const pages = byClass(tree, 'sp-outline-page')
    const titles = byClass(tree, 'sp-page-title')
    return pages.length === 2 && titles.length === 2 && titles[0].props.value === '结论摘要'
  })())
  check('大纲视图渲染目的/要点/类型控件 + 页操作四钮 + 首页 up 禁用', (() => {
    const page = byClass(tree, 'sp-outline-page')[0]
    return !!findElement(page, (el) => classOf(el) === 'sp-page-purpose')
      && !!findElement(page, (el) => classOf(el) === 'sp-page-bullets')
      && !!findElement(page, (el) => classOf(el) === 'sp-page-type')
      && !!findElement(page, (el) => classOf(el) === 'sp-page-up') && !!findElement(page, (el) => classOf(el) === 'sp-page-down')
      && !!findElement(page, (el) => classOf(el) === 'sp-page-copy') && !!findElement(page, (el) => classOf(el) === 'sp-page-delete')
      && findElement(page, (el) => classOf(el) === 'sp-page-up').props.disabled === true
  })())
  check('页类型下拉含规格十类（以值抽查标题页/流程图/结束页）', (() => {
    const sel = findElement(tree, (el) => classOf(el) === 'sp-page-type')
    const opts = (sel.children[0].children[0] ? sel.children[0].children : []).length || (sel.children || []).length
    return sel.props && Array.isArray(sel.children) && treeText(sel).includes('pageTypeTitle')
      && treeText(sel).includes('pageTypeFlow') && treeText(sel).includes('pageTypeEnd')
  })())
  check('主按钮 sp-outline-confirm 存在且未 busy 可点；back 按钮存在', (() => {
    const btn = findElement(tree, (el) => classOf(el) === 'sp-outline-confirm')
    return !!btn && btn.props.disabled !== true && !!findElement(tree, (el) => classOf(el) === 'sp-back')
  })())
  check('有注入的未保存修改 → sp-outline-dirty-banner + sp-outline-save 出现', (() => {
    const modified = outlineTask().outline.pages.map((p, i) => i === 0 ? Object.assign({}, p, { title: '改过的标题' }) : Object.assign({}, p))
    extra = { initialPages: modified }
    const dirtyTree = H.makeOutlineReviewView(t, outlineOpts())({})
    const ok = !!byClass(dirtyTree, 'sp-outline-dirty-banner').length && !!findElement(dirtyTree, (el) => classOf(el) === 'sp-outline-save')
    extra = null
    return ok
  })())
  check('修改指令为空点「让 Agent 修改」→ send 不被调用 + 错误横幅', (async () => {
    const revTree = outlineTree()
    const btn = findElement(revTree, (el) => classOf(el) === 'sp-outline-revise')
    await btn.props.onClick()
    return sent.length === 0 && !!findElement(revTree, (el) => classOf(el) === 'sp-msg-err')
  })())
  check('注入修改指令 → 点修改 → sendToSession 收到含指令与任务 id 的文本（未自动确认大纲）', (async () => {
    extra = { reviseText: '合并第 3、4 页' }
    const revTree = H.makeOutlineReviewView(t, outlineOpts())({})
    const btn = findElement(revTree, (el) => classOf(el) === 'sp-outline-revise')
    await btn.props.onClick()
    extra = null
    return sent.length === 1 && sent[0].text.includes('合并第 3、4 页') && sent[0].text.includes('任务 ID：k1')
      && sent[0].wsId === 'ws1' && apiCallsOutline.every((c) => c.method !== 'tasks.confirmOutline')
  })())
  check('确认大纲（无未保存修改）→ confirmOutline(version=outlineVersion) → 继续 send 继续指令 → onUpdated 收 building 记录', (async () => {
    const tree2 = outlineTree()
    const btn = findElement(tree2, (el) => classOf(el) === 'sp-outline-confirm')
    await btn.props.onClick()
    const outlineCall = apiCallsOutline.every((c) => c.method !== 'tasks.outline') // 干净态不先存
    const confirmCall = apiCallsOutline.find((c) => c.method === 'tasks.confirmOutline')
    return outlineCall && !!confirmCall && confirmCall.body.version === 1 && sent.length === 1
      && sent[0].text.includes('继续') && updatedWith && updatedWith.status === 'building'
  })())
  check('注入未保存修改 → 点确认 → 先 tasks.outline（v2）再 confirmOutline(version=2)', (async () => {
    const modified = outlineTask().outline.pages.map((p, i) => i === 0 ? Object.assign({}, p, { title: '新结论' }) : Object.assign({}, p))
    extra = { initialPages: modified }
    const tree3 = H.makeOutlineReviewView(t, outlineOpts())({})
    const btn = findElement(tree3, (el) => classOf(el) === 'sp-outline-confirm')
    await btn.props.onClick()
    extra = null
    const savedCall = apiCallsOutline.find((c) => c.method === 'tasks.outline')
    const confirmCall2 = apiCallsOutline.find((c) => c.method === 'tasks.confirmOutline')
    return !!savedCall && savedCall.body.pages[0].title === '新结论' && !!confirmCall2 && confirmCall2.body.version === 2
  })())
  check('sendToSession 返回 copied → 提示粘贴横幅且任务保持已确认（不再 send 第二次）', (async () => {
    extra = { sendToSession: (text, ws) => { sent.push({ text, ws }); return Promise.resolve('copied') } }
    const tree4 = H.makeOutlineReviewView(t, outlineOpts())({})
    const btn = findElement(tree4, (el) => classOf(el) === 'sp-outline-confirm')
    await btn.props.onClick()
    extra = null
    return sent.length === 1 && !!findElement(tree4, (el) => classOf(el) === 'sp-msg-err')
  })())
  check('confirmOutline 版本不匹配（400）→ 重取 tasks.get 并载入新版本 + 提示', (async () => {
    let gets = 0
    extra = {
      api: (method, body) => {
        apiCallsOutline.push({ method, body })
        if (method === 'tasks.confirmOutline') return Promise.reject(new Error('大纲版本不匹配（当前 v3）'))
        if (method === 'tasks.get') { gets += 1; return Promise.resolve(Object.assign(outlineTask(), { outlineVersion: 3, outline: { version: 3, pages: [{ id: 'p1', title: 'Agent 改过的页', bullets: [] }] } })) }
        return Promise.resolve(outlineTask())
      },
    }
    const tree5 = H.makeOutlineReviewView(t, outlineOpts())({})
    const btn = findElement(tree5, (el) => classOf(el) === 'sp-outline-confirm')
    await btn.props.onClick()
    extra = null
    return gets === 1 && !!findElement(tree5, (el) => classOf(el) === 'sp-outline-resync')
  })())
  check('dirty 时点返回 → 出现未保存确认行（sp-discard-confirm），干净时直接 onBack', (async () => {
    const cleanTree = outlineTree()
    const backBtn = findElement(cleanTree, (el) => classOf(el) === 'sp-back')
    await backBtn.props.onClick()
    const cleanBacked = backed; backed = false
    const modified = outlineTask().outline.pages.map((p, i) => i === 0 ? Object.assign({}, p, { title: 'X' }) : Object.assign({}, p))
    extra = { initialPages: modified }
    const dirtyTree2 = H.makeOutlineReviewView(t, outlineOpts())({})
    await findElement(dirtyTree2, (el) => classOf(el) === 'sp-back').props.onClick()
    const hasConfirm = !!findElement(dirtyTree2, (el) => classOf(el) === 'sp-discard-confirm')
    extra = null
    return cleanBacked === true && hasConfirm === true
  })())
  check('无大纲记录（outlineVersion 0）→ sp-outline-empty 空态', (() => {
    const noOutline = outlineTask(); noOutline.outline = undefined; noOutline.outlineVersion = 0
    extra = { task: noOutline }
    const emptyTree = H.makeOutlineReviewView(t, outlineOpts())({})
    extra = null
    return !!byClass(emptyTree, 'sp-outline-empty').length
  })())
  check('i18n 字典含大纲视图全部键（zh+en）', (() => {
    const keys = ['outlineConfirm', 'outlineSave', 'outlineRevise', 'outlineAdd', 'pageNew',
      'pageTypeTitle', 'pageTypeSummary', 'pageTypeKpi', 'pageTypeTrend', 'pageTypeCompare',
      'pageTypeTimeline', 'pageTypeFlow', 'pageTypeCase', 'pageTypePlan', 'pageTypeEnd']
    return keys.every((k) => zhDict()[k] !== undefined && enDict()[k] !== undefined)
    // zhDict/enDict：本节上文既有辅助（若无则从 locale.register 收集的 dicts 里取）
  })())
}
```

> 上例中 `apiCallsOutline / updatedWith / backed / extra / sent` 的重置：实现者把该块包进一个 IIFE，在每条 `check` 前重置；`zhDict()/enDict()` 若文件里尚无，可先在 client 断言段之前用 `locale.register` 收集的字典构造（参考既有「双语字典已注册」断言：注册时把 `dicts.zh/en` 存到局部变量再暴露给后续段落）。若 `sp-page-type` 选项断言与实现细节（children 摊平形态）不匹配，允许微调断言取值方式，但**十类齐全**这一点必须断言。

- [ ] **Step 3: 运行失败**（约 12 条新断言 FAIL，其余不回归）。

- [ ] **Step 4: 实现纯函数**（`makeRecentView` 之前；**并在 `__testHooks` 追加 `outlineOps: { clonePages, uniquePageId, movePage, copyPage, addPage, removePage, parseBullets, normalizePage, outlineDiffers }` 与 `makeOutlineReviewView`**——Task 3a/3b 断言按此消费）：

```js
		/* ── 大纲页操作纯函数（冒烟直接断言；视图只做 setState 接线）── */

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
```

- [ ] **Step 5: 实现视图工厂**（纯函数之后；要点，完整代码由实现者按下述骨架写出——骨架已完整，类名不得增删）：

```js
		/**
		 * 大纲确认视图（Plan 2b Task 3）：任务面板的核心控制点——大纲必须经用户
		 * 确认才会继续生成。直接编辑与自然语言修改都只改「未确认」的本地副本，
		 * 真正落盘经 tasks.outline（新版本），确认经 tasks.confirmOutline（版本
		 * 匹配校验），确认成功后投递继续指令（会话桥）。类名契约见视图工厂注释。
		 * options: { task, api, sendToSession, onUpdated, onBack,
		 *   initialPages?(仅测试), reviseText?(仅测试) }
		 */
		function makeOutlineReviewView(t, options) {
			var opts = options || {};
			var task = opts.task || null;
			var apiFn = typeof opts.api === "function" ? opts.api : api;
			var send = typeof opts.sendToSession === "function" ? opts.sendToSession : null;
			var onUpdated = typeof opts.onUpdated === "function" ? opts.onUpdated : function () {};
			var onBack = typeof opts.onBack === "function" ? opts.onBack : function () {};
			var savedPages = task && task.outline && Array.isArray(task.outline.pages) ? task.outline.pages : [];
			var PAGE_TYPE_KEYS = ["pageTypeTitle", "pageTypeSummary", "pageTypeKpi", "pageTypeTrend",
				"pageTypeCompare", "pageTypeTimeline", "pageTypeFlow", "pageTypeCase", "pageTypePlan", "pageTypeEnd"];

			function OutlineReview() {
				var pagesState = React.useState(typeof opts.initialPages === "function" ? opts.initialPages() : (opts.initialPages ? clonePages(opts.initialPages) : clonePages(savedPages)));
				var pages = pagesState[0], setPages = pagesState[1];
				var busyState = React.useState("");
				var busy = busyState[0], setBusy = busyState[1];
				var errorState = React.useState("");
				var error = errorState[0], setError = errorState[1];
				var reviseState = React.useState(typeof opts.reviseText === "string" ? opts.reviseText : "");
				var reviseText = reviseState[0], setReviseText = reviseState[1];
				var discardState = React.useState("");
				var discard = discardState[0], setDiscard = discardState[1];
				var noticeState = React.useState(""); // copied 提示 / resync 提示（非错误）

				function dirtyOf(next) { return outlineDiffers(next, savedPages); }
				function applyPages(next) { setPages(next); /* dirty 由下一渲染计算，本地立即计算存到 state */ }
				function editPage(index, patch) {
					var next = pages.map(function (page, i) { return i === index ? Object.assign({}, page, patch) : page; });
					setPages(next);
				}

				function saveOutlineEdits() {
					return apiFn("tasks.outline", { id: task.id, pages: pages }).then(function (saved) {
						return saved;
					});
				}

				function confirmOutlineEdits() {
					setBusy("confirm"); setError("");
					var prepare = dirtyOf(pages) ? saveOutlineEdits() : Promise.resolve(task);
					return prepare.then(function (current) {
						return apiFn("tasks.confirmOutline", { id: task.id, version: current.outlineVersion });
					}).then(function (confirmed) {
						var delivery = send ? Promise.resolve(send(buildContinuePrompt(confirmed), task.workspace && task.workspace.id)) : Promise.resolve("none");
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
								if (next && next.outline) { setPages(clonePages(next.outline.pages)); setResync(true); }
							}).catch(function () {});
							return;
						}
						setError(message);
					});
				}

				function reviseOutline() {
					var instruction = reviseText;
					if (String(instruction).replace(/^\s+|\s+$/g, "") === "") { setError(t("outlineReviseEmpty")); return; }
					if (dirtyOf(pages)) { setDiscard("revise"); return; }
					return deliverRevise(instruction);
				}
				function deliverRevise(saveFirst) {
					setBusy("revise");
					var prepared = saveFirst ? saveOutlineEdits() : Promise.resolve(null);
					return Promise.resolve(prepared).then(function () {
						if (!saveFirst) { setPages(clonePages(savedPages)); }
						var delivery = send ? Promise.resolve(send(buildOutlineRevisePrompt(task, reviseTextRef()), task.workspace && task.workspace.id)) : Promise.resolve("none");
						return Promise.resolve(delivery).then(function (phase) {
							if (phase !== "submitted") { setBusy(""); setError(t(phase === "copied" ? "outlineCopiedHint" : "outlineSendFailed")); return; }
							return apiFn("tasks.update", { id: task.id, patch: { status: "analyzing" } }).then(function (next) {
								onUpdated(next);
							});
						});
					}).catch(function (error) { setBusy(""); setError(String((error && error.message) || error)); });
				}
				// reviseTextRef：send 时读当前受控值（真实 React 中与 reviseText 一致）
				function reviseTextRef() { return reviseText; }

				// ……渲染 JSX（类名按「视图契约」；无大纲记录 → sp-outline-empty；
				// dirty 横幅含 sp-outline-save；discardState !== "" 时 sp-discard-confirm 行；
				// resync 时 sp-outline-resync 提示行；busy 时主按钮 disabled）——
				// 页卡片循环里：标题/目的用受控 input，要点 textarea value=join("\n")、
				// onChange={parseBullets}，类型 select options=PAGE_TYPE_KEYS.map(t)，
				// up/down/copy/delete 调 setPages(movePage/copyPage/addPage/removePage)。
				return React.createElement("div", { className: "sp-view-outline" }, /* … */);
			}
			return OutlineReview;
		}
```

> 上面是**结构骨架**：实现者按骨架把 JSX（createElement 树）补完整，约束：`setResync` 是独立的 `React.useState(false)`；「丢弃修改」按钮 = `setPages(clonePages(savedPages))` 后 `deliverRevise(false)`；「保存并修改」= `deliverRevise(true)`；`sp-back` dirty 时先 `setDiscard("back")`（干净时直接 `onBack()`），`sp-discard-confirm` 行内 [仍要返回]=`onBack()` / [留下编辑]=`setDiscard("")`；`tasks.outline` 请求体 `pages` 直接传本地 pages（host 会归一化）。所有按钮 busy 时 disabled。

- [ ] **Step 6: i18n（zh+en 两个字典同步添加）**：键 = `outlineConfirm`（确认大纲并继续生成 / Confirm outline and continue）、`outlineSaving`、`outlineSave`（保存修改 / Save changes）、`outlineRevise`（让 Agent 修改 / Ask Agent to revise）、`outlineReviseEmpty`、`outlineAdd`（＋ 添加页面 / Add page）、`pageNew`（新页面 / New page）、`outlineCopiedHint`（修改/继续指令已复制，请到 Agent 会话粘贴发送）、`outlineSendFailed`（无法把指令送达会话，请重试或重新启动生成）、`outlineResync`（大纲已有新版本，已重新载入，请再次确认）、`outlineEmpty`（暂无大纲，等待 Agent 生成）、`backToRecent`（返回 / Back）、`outlineHint`（含 N 页占位：直接拼页数，不需要 params）、十个 `pageType*` 键（标题页 / 结论页 / KPI 数据页 / 趋势图页 / 对比页 / 时间线 / 流程图 / 案例页 / 行动计划页 / 结束页 + 英文）。

- [ ] **Step 7: CSS**（CSS 数组任务面板段末尾追加；遵守无视口单位/无固定定位）：

```js
			".sp-view-outline{display:flex;flex-direction:column;gap:12px;}",
			".sp-back{align-self:flex-start;border:none;background:transparent;color:inherit;opacity:.7;cursor:pointer;font-size:12px;padding:2px 0;}",
			".sp-back:hover{opacity:1;}",
			".sp-outline-pages{display:flex;flex-direction:column;gap:10px;}",
			".sp-outline-page{border:1px solid var(--dsw-alias-border-l,var(--sl-color-neutral-300,#333));border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;}",
			".sp-page-index{font-size:11px;font-weight:600;opacity:.55;}",
			".sp-page-ops{display:flex;gap:6px;flex-wrap:wrap;}",
			".sp-dirty-banner,.sp-revise-dirty-confirm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px dashed var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:8px;padding:8px 10px;font-size:12px;}",
			".sp-outline-revise{display:flex;flex-direction:column;gap:8px;border:1px dashed var(--dsw-alias-border-l,var(--sl-color-neutral-400,#555));border-radius:8px;padding:10px;}",
			".sp-outline-resync{color:#3fa76a;font-size:12px;}",
```

- [ ] **Step 8: 全绿 + 反向验证**（删掉 confirm 里的 `tasks.confirmOutline` 调用 → 对应断言 FAIL；删掉 `uniquePageId` 的 while 去重 → copy/add id 唯一断言 FAIL；还原全绿）。

- [ ] **Step 9: Commit**

```bash
git add lib/client.js src/client/index.ts scripts/smoke-plugin.mjs
git commit -m "feat(client): outline review view with inline editing and agent revision"
```

---

### Task 4: 生成进度视图 `makeProgressView`

**Files:**
- Modify: `lib/client.js`（`makeOutlineReviewView` 之后）
- Modify: `src/client/index.ts`
- Test: `scripts/smoke-plugin.mjs`

**视图契约：**

```text
sp-view-progress
├── sp-progress-head: sp-back + sp-task-title + sp-task-status
├── sp-progress-line（"第 3/6 阶段 · 构建页面内容"；无 stage → 等待 Agent 汇报）
├── sp-steps
│   └── sp-step（sp-step-done / sp-step-active / sp-step-pending）×6（固定六阶段）
├── sp-progress-detail（stage.detail）
├── sp-progress-events（最近 5 条事件：sp-event 时间+文本）
├── sp-launch-recovery（waiting-launch 变体：sp-launch-retry [重试启动] / sp-launch-cancel [取消任务]）
├── sp-needs-input（needs-input 变体：问题文本 + sp-input-answer + sp-needs-input-send [发送补充信息]）
├── sp-error-recovery（failed 变体：原因 + sp-fail-retry [重试当前阶段] / sp-fail-back-outline [返回修改大纲]）
├── sp-cancel（进行中的 [取消任务]）+ sp-open-session（[打开 Agent 会话]）
├── sp-terminal-note（cancelled 只读详情）
└── sp-msg-ok / sp-msg-err
```

- [ ] **Step 1: 失败断言**：

```js
/* ═══ Plan 2b Task 4：生成进度视图 ═══ */
{
  const H = loadedModule.__testHooks
  const t = (key) => key
  const baseTask = (over) => Object.assign({
    id: 'k1', title: 'Q3 经营复盘', status: 'building',
    workspace: { id: 'ws1', name: '季度汇报', path: '/ws' },
    brief: { topic: 'Q3', format: 'pptx' }, outlineVersion: 1,
    outline: { version: 1, pages: [{ id: 'p1', title: 'a', bullets: [] }, { id: 'p2', title: 'b', bullets: [] }] },
    stage: { key: 'building', index: 3, total: 6, detail: '正在生成第 4/9 页：区域表现' },
    materials: [], artifacts: [],
    events: [
      { at: '2026-09-16T04:05:00.000Z', kind: 'status', text: '状态 → building' },
      { at: '2026-09-16T04:03:00.000Z', kind: 'outline', text: '已生成大纲 v1（2 页），等待确认' },
      { at: '2026-09-16T04:02:00.000Z', kind: 'stage', text: '阶段 → building（3/6）' },
    ],
  }, over)
  const sent = []; let apiCalls = []; let backedToOutline = false; let updatedWith = null; let openedSession = false; let extra = null
  const progressOpts = () => Object.assign({
    task: baseTask(),
    api: (method, body) => { apiCalls.push({ method, body }); return Promise.resolve(baseTask({ status: body && body.patch && body.patch.status ? body.patch.status : baseTask().status })) },
    sendToSession: (text, ws) => { sent.push({ text, ws }); return Promise.resolve('submitted') },
    onUpdated: (next) => { updatedWith = next },
    onBackToOutline: () => { backedToOutline = true },
    openSession: () => { openedSession = true },
  }, extra || {})
  let backedToOutline = false; let openedSession = false
  const progressTree = () => H.makeProgressView(t, progressOpts())({})
  const reset = () => { sent.length = 0; apiCalls = []; backedToOutline = false; openedSession = false; extra = null }

  // 纯函数：阶段映射
  const PS = H.progressSteps
  check('progressSteps: 无 stage → 全 pending + 尾步 active', (() => {
    const steps = PS(null)
    return steps.length === 6 && steps.every((s) => s.state === 'pending')
  })())
  check('progressSteps: 3/6 → 前两步 done、第三步 active、后三步 pending', (() => {
    const steps = PS({ index: 3, total: 6, key: 'building' })
    return steps[0].state === 'done' && steps[1].state === 'done' && steps[2].state === 'active' && steps[5].state === 'pending'
  })())
  check('progressSteps: 任意 total 归一映射（total=12, index=4 → 第 2 步 active）', PS({ index: 4, total: 12, key: 'x' })[1].state === 'active')
  check('lastEventOfKind: 取该 kind 最新一条（fail 原因 / needs-input 问题都用它）', (() => {
    const task = baseTask({ status: 'failed', events: [
      { at: '2026-09-16T05:00:00.000Z', kind: 'fail', text: '渲染失败：字体缺失' },
      { at: '2026-09-16T04:05:00.000Z', kind: 'status', text: '状态 → building' },
    ] })
    const earlier = baseTask({ status: 'failed', events: [
      { at: '2026-09-16T04:00:00.000Z', kind: 'fail', text: '较早的失败' },
      { at: '2026-09-16T05:00:00.000Z', kind: 'fail', text: '渲染失败：字体缺失' },
    ] })
    return H.lastEventOfKind(task, 'fail')?.text === '渲染失败：字体缺失'
      && H.lastEventOfKind(earlier, 'fail')?.text === '渲染失败：字体缺失'
      && H.lastEventOfKind(task, 'nope') === null
  })())

  const tree = progressTree()
  check('进度视图根类名 + 固定六阶段时间线（done/active/pending 类名）', (() => {
    const steps = byClass(tree, 'sp-step')
    return steps.length === 6 && !!byClass(tree, 'sp-step-done').length && !!byClass(tree, 'sp-step-active').length && !!byClass(tree, 'sp-step-pending').length
  })())
  check('渲染 stage 说明行 + detail + 事件列表（≤5 条）', (() => {
    const events = byClass(tree, 'sp-event')
    return !!byClass(tree, 'sp-progress-detail').length && events.length > 0 && events.length <= 5
  })())
  check('进行中：sp-open-session 与 sp-cancel 存在', !!findElement(tree, (el) => classOf(el) === 'sp-open-session') && !!findElement(tree, (el) => classOf(el) === 'sp-cancel'))
  check('点取消任务 → tasks.update status=cancelled → onUpdated', (async () => {
    reset()
    const tree2 = progressTree()
    await findElement(tree2, (el) => classOf(el) === 'sp-cancel').props.onClick()
    const call = apiCalls.find((c) => c.method === 'tasks.update')
    return !!call && call.body.patch.status === 'cancelled' && updatedWith && updatedWith.status === 'cancelled'
  })())
  check('点打开会话 → openSession 被调用', (async () => {
    reset()
    await findElement(progressTree(), (el) => classOf(el) === 'sp-open-session').props.onClick()
    return openedSession === true
  })())
  check('waiting-launch 变体：sp-launch-recovery + 重试启动 → send 完整 Brief（buildTaskPrompt 文本）→ submitted → status analyzing → onUpdated', (async () => {
    reset(); extra = { task: baseTask({ status: 'waiting-launch' }) }
    const tree3 = progressTree()
    await findElement(tree3, (el) => classOf(el) === 'sp-launch-retry').props.onClick()
    extra = null
    return sent.length === 1 && sent[0].text.includes('任务 ID：k1') && sent[0].text.includes('请制作一份演示文稿')
      && updatedWith && updatedWith.status === 'analyzing'
  })())
  check('needs-input 变体：问题文本来自最后一条 needs-input 事件；注入回答点发送 → send 补充信息提示', (async () => {
    reset(); extra = { task: baseTask({ status: 'needs-input', events: [{ at: 't', kind: 'needs-input', text: '利润下降口径？' }] }), answerText: '只看华东区' }
    const tree4 = progressTree()
    await findElement(tree4, (el) => classOf(el) === 'sp-needs-input-send').props.onClick()
    extra = null
    return treeText(tree4).includes('利润下降口径？') && sent.length === 1
      && sent[0].text.includes('利润下降口径？') && sent[0].text.includes('只看华东区')
  })())
  check('failed 变体：显示失败原因（最后一条事件）+ sp-fail-retry → send 继续指令 + sp-fail-back-outline → onBackToOutline', (async () => {
    reset(); extra = { task: baseTask({ status: 'failed', events: [{ at: 't', kind: 'fail', text: '渲染验收失败：字体缺失' }] }) }
    const tree5 = progressTree()
    await findElement(tree5, (el) => classOf(el) === 'sp-fail-retry').props.onClick()
    await findElement(tree5, (el) => classOf(el) === 'sp-fail-back-outline').props.onClick()
    extra = null
    return treeText(tree5).includes('字体缺失') && sent.length === 1 && sent[0].text.includes('继续') && backedToOutline === true
  })())
  check('cancelled：只读终态提示 sp-terminal-note，无取消/重试按钮', (() => {
    extra = { task: baseTask({ status: 'cancelled' }) }
    const cancelledTree = H.makeProgressView(t, progressOpts())({})
    extra = null
    const liveTree = H.makeProgressView(t, progressOpts())({})
    return !!byClass(cancelledTree, 'sp-terminal-note').length
      && !findElement(cancelledTree, (el) => classOf(el) === 'sp-cancel')
      && !!findElement(liveTree, (el) => classOf(el) === 'sp-cancel')
  })())
  check('i18n 键齐全（zh+en）', (() => {
    const keys = ['stageReceive', 'stageAnalyze', 'stageOutline', 'stageBuild', 'stagePackage', 'stageReview',
      'openSession', 'cancelTask', 'launchRecovery', 'launchRetry', 'needsInput', 'inputAnswer', 'inputSend',
      'errorRecovery', 'failRetry', 'failBackOutline', 'terminalNote', 'waitingStage']
    return keys.every((k) => zhDict()[k] !== undefined && enDict()[k] !== undefined)
  })())
}
```

> 断言中的 `zhDict()/enDict()` 同 Task 3 的辅助；`tree6` 是笔误防护——实现者允许把最后一条断言整理成对 `progressTree()` 的一次性断言（保持「cancelled → sp-terminal-note 存在」语义即可）。send 失败变体（copied/none）在大纲视图已覆盖同类横幅，本视图至少断言 `needs-input` 发送后 copied → `sp-msg-err` 一条。

- [ ] **Step 2: 运行失败。**

- [ ] **Step 3: 实现**（结构骨架；类名契约不得增删）：

```js
		/** 最近一条指定 kind 的事件（无 → null）。fail 原因 / needs-input 问题都用它。 */
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
			var active = SP_STAGES.length; // 无汇报：全部 pending（尾步不算进行中）
			var index = stage && Number(stage.index), total = stage && Number(stage.total);
			if (index > 0 && total > 0) {
				active = Math.min(SP_STAGES.length, Math.max(1, Math.ceil((index / total) * SP_STAGES.length)));
			}
			return SP_STAGES.map(function (key, i) {
				return { key: key, state: i + 1 < active ? "done" : i + 1 === active ? "active" : "pending" };
			});
		}
```

`makeProgressView(t, options)`：options 同大纲视图（`{ task, api, sendToSession, onUpdated, onBack, onBackToOutline, openSession, answerText?(测试) }`）。**并在 `__testHooks` 追加 `makeProgressView / progressSteps / lastEventOfKind`**。行为：
- 按 `task.status` 渲染变体（启动恢复区 / 补充信息区 / 错误恢复区 / 只读终态 / 默认时间线）；
- **重试启动**（waiting-launch）→ `send(buildTaskPrompt(task), workspaceId)` → submitted → `tasks.update status:'analyzing'` → onUpdated；copied/none → `sp-msg-err`；
- **发送补充信息**（needs-input）→ `send(buildNeedsInputPrompt(task, questionText, answer), wsId)` → submitted → `tasks.update status:'building'` → onUpdated；
- **重试当前阶段**（failed）→ `send(buildContinuePrompt(task), wsId)`（不自动改状态——Agent 自己会经 ppts_task 推进；submitted → `sp-msg-ok`）；
- **取消任务**（活跃态）→ `tasks.update patch.status:'cancelled'` → onUpdated；
- 返回 / 返回修改大纲 → onBack / onBackToOutline；
- 事件列表：`task.events.slice(-5).reverse()`。

- [ ] **Step 4: i18n + CSS**（键见断言；CSS 追加 `.sp-view-progress/.sp-steps/.sp-step(-done|-active|-pending)/.sp-launch-recovery/.sp-needs-input/.sp-error-recovery/.sp-terminal-note/.sp-event` 系列，遵守无视口单位/无 fixed）。

- [ ] **Step 5: 全绿 + 反向验证**（删掉 sp-launch-retry 的 tasks.update → 断言 FAIL；`progressSteps` 的 `Math.ceil` 改 `Math.round` → 4/12 映射断言 FAIL；还原）。

- [ ] **Step 6: Commit**

```bash
git add lib/client.js src/client/index.ts scripts/smoke-plugin.mjs
git commit -m "feat(client): generation progress view with stage timeline and recovery"
```

---

### Task 5: 结果视图 `makeResultView`

**Files:**
- Modify: `lib/client.js`（`makeProgressView` 之后）
- Modify: `src/client/index.ts`
- Test: `scripts/smoke-plugin.mjs`

**视图契约：**

```text
sp-view-result
├── sp-result-head: sp-back + sp-task-title + sp-task-status
├── sp-result-summary（"已完成 · N 页 · 可编辑 PPTX/HTML"）
├── sp-artifacts
│   └── sp-artifact: sp-artifact-type（PPTX/PDF/HTML）+ sp-artifact-status（ready→可用 / missing→丢失提示 / error）
│       + sp-artifact-path + sp-artifact-copy（复制路径）
├── sp-artifacts-empty（无产物登记）
├── sp-result-continue: sp-result-continue-text + sp-result-submit [提交修改]
│   └── sp-result-quick: 4 个 sp-result-quick-chip（填入文案，不直接发送）
├── sp-msg-ok / sp-msg-err
└── copyText 纯函数（navigator.clipboard 优先，不可用静默降级不抛）
```

- [ ] **Step 1: 失败断言**：

```js
/* ═══ Plan 2b Task 5：结果视图 ═══ */
{
  const H = loadedModule.__testHooks
  const t = (key) => key
  const resultTask = (over) => Object.assign({
    id: 'k1', title: 'Q3 经营复盘', status: 'completed',
    workspace: { id: 'ws1', name: '季度汇报', path: '/ws' },
    brief: { topic: 'Q3 经营复盘', format: 'pptx' },
    outlineVersion: 1, outline: { version: 1, pages: [{ id: 'p1', title: 'a', bullets: [] }, { id: 'p2', title: 'b', bullets: [] }, { id: 'p3', title: 'c', bullets: [] }] },
    materials: [], artifacts: [
      { type: 'pptx', path: '/ws/Q3-review.pptx', status: 'ready' },
      { type: 'pdf', path: '/ws/Q3-review.pdf', status: 'missing' },
    ],
    events: [], events2: undefined,
  }, over)
  const sent = []; let apiCalls = []; let updatedWith = null; let extra = null
  const resultOpts = () => Object.assign({
    task: resultTask(),
    api: (method, body) => { apiCallsR.push({ method, body }); return Promise.resolve(Object.assign({}, resultTask(), body && body.patch && body.patch.status ? { status: body.patch.status } : {})) },
    sendToSession: (text, ws) => { sent.push({ text, ws }); return Promise.resolve('submitted') },
    onUpdated: (next) => { updatedWith = next },
  }, extra)
  let apiCallsR = []
  const resetR = () => { sent.length = 0; apiCallsR = []; updatedWith = null; extra = null }
  const resultTree = () => H.makeResultView(t, resultOpts())({})

  const tree = resultTree()
  check('结果视图根类名 + 摘要行含页数与交付形态文案', (() => {
    const summary = byClass(tree, 'sp-result-summary')
    return !!summary.length && treeText(summary).includes('3 页') && treeText(summary).includes('pptx')
  })())
  check('产物条目×2：ready 徽标 + missing 丢失提示 + 路径文本 + 复制按钮', (() => {
    const items = byClass(tree, 'sp-artifact')
    return items.length === 2
      && !!findElement(items[1], (el) => classOf(el) === 'sp-artifact-copy')
      && treeText(items[1]).includes('missing') || treeText(items[1]).includes('artifactMissing')
  })())
  check('点复制路径 → copyText 收到产物路径（stub navigator.clipboard）', (async () => {
    const written = []
    sandboxGlobal.navigator = { clipboard: { writeText: (s) => { written.push(s); return Promise.resolve() } } }
    const tree2 = resultTree()
    await findElement(tree2, (el) => classOf(el) === 'sp-artifact-copy').props.onClick()
    sandboxGlobal.navigator = undefined
    return written.length === 1 && written[0] === '/ws/Q3-review.pdf'
  })())
  check('复制在无 navigator 时静默不抛', (async () => {
    let threw = false
    try { await H.copyText('/ws/x.pptx', { writeText: async () => {} }) } catch (e) { threw = true }
    // 第二参注入实现；缺省 navigator 缺失也必须不抛
    let threw2 = false
    try { await H.copyText('/ws/x.pptx') } catch (e) { threw2 = true }
    return !threw && !threw2
  })())
  check('无产物 → sp-artifacts-empty 空态', (() => {
    extra = { task: resultTask({ artifacts: [] }) }
    const tree3 = resultTree()
    extra = null
    return !!byClass(tree3, 'sp-artifacts-empty').length
  })())
  check('注入修改要求 → 提交修改 → send 含要求与任务 id → submitted → tasks.update building → onUpdated', (async () => {
    resetR(); extra = { continueText: '把第 3 页改成折线图' }
    const tree4 = resultTree()
    await findElement(tree4, (el) => classOf(el) === 'sp-result-submit').props.onClick()
    extra = null
    const call = apiCallsR.find((c) => c.method === 'tasks.update')
    return sent.length === 1 && sent[0].text.includes('把第 3 页改成折线图') && sent[0].text.includes('任务 ID：k1')
      && !!call && call.body.patch.status === 'building' && updatedWith && updatedWith.status === 'building'
  })())
  check('继续修改发送失败（copied/none）→ sp-msg-err 且状态不变', (async () => {
    resetR(); extra = { sendToSession: () => Promise.resolve('none'), continueText: '压缩到 7 页' }
    const tree4 = resultTree()
    await findElement(tree4, (el) => classOf(el) === 'sp-result-submit').props.onClick()
    extra = null
    return !!findElement(tree4, (el) => classOf(el) === 'sp-msg-err') && apiCallsR.every((c) => c.method !== 'tasks.update')
  })())
  check('快捷 chip 填入文案（四个 chip 的 onClick 调 onContinueText 不发送）', (() => {
    resetR()
    const chips = byClass(resultTree(), 'sp-result-quick-chip')
    return chips.length === 4 && chips.every((chip) => typeof chip.props.onClick === 'function') && sent.length === 0
  })())
  check('产物丢失条目的「重新生成」→ send buildRegeneratePrompt 文本（含类型与原路径）', (async () => {
    resetR()
    const tree5 = resultTree()
    const missingItem = byClass(tree5, 'sp-artifact')[1]
    await findElement(missingItem, (el) => classOf(el) === 'sp-artifact-regen').props.onClick()
    return sent.length === 1 && sent[0].text.includes('pdf') && sent[0].text.includes('/ws/Q3-review.pdf')
  })())
  check('i18n 键齐全（zh+en）', (() => {
    const keys = ['resultSummary', 'artifactReady', 'artifactMissing', 'artifactRegen', 'copyPath',
      'artifactsEmpty', 'continueEdit', 'continueSubmit', 'quickRedoPage', 'quickRestyle', 'quickShrink', 'quickRerender']
    return keys.every((k) => zhDict()[k] !== undefined && enDict()[k] !== undefined)
  })())
}
```

- [ ] **Step 2: 运行失败。**
- [ ] **Step 3: 实现**（模式同 Task 3/4：**`__testHooks` 追加 `makeResultView / copyText`**。`copyText(text, impl?)` 模块级纯函数——`typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText` 优先，`impl` 参数供冒烟注入，两者皆缺省静默 resolve；视图消费 `buildContinueEditPrompt` / `buildRegeneratePrompt`；提交成功 → `tasks.update status:'building'` → onUpdated（路由自动进进度视图）；summary 行页数取 `task.outline.pages.length`、形态取 `task.brief.format`）。
- [ ] **Step 4: i18n + CSS**（`.sp-view-result` 族）。
- [ ] **Step 5: 全绿 + 反向验证**（把 `copyText` 的 clipboard 分支临时砍掉 → 复制断言 FAIL；还原）。
- [ ] **Step 6: Commit**

```bash
git add lib/client.js src/client/index.ts scripts/smoke-plugin.mjs
git commit -m "feat(client): result view with artifact copy-path and continue-edit"
```

---

### Task 6: 壳层接线——任务详情路由 + 3s 轮询 + 待确认提示行 + bridges.sendToSession

**Files:**
- Modify: `lib/client.js`（`makePanelsView` 重写分发段；`apply` 注入 sendToSession；`__testHooks`）
- Modify: `src/client/index.ts`
- Test: `scripts/smoke-plugin.mjs`

**壳层行为契约：**

```text
sp-panels
├── sp-panels-head（title + [新建任务][最近任务] tabs）
├── sp-attention-hint（存在 attention 组任务时：N 条待办提示行按钮，点击打开第一条）
├── 视图分发：
│   ├── SP_VIEW_NEW     → makeNewTaskView（不变）
│   ├── SP_VIEW_RECENT  → makeRecentView（onOpen=openTask / onNewTask）
│   └── SP_VIEW_TASK    → 按 viewForStatus(active.status) 分发三个详情视图
│       （outline → makeOutlineReviewView / progress → makeProgressView /
│         result → makeResultView；failed/cancelled 仍走 progress）
│       forcedSub 覆盖（「返回修改大纲」）优先于状态路由
└── 轮询：任务详情视图打开且 isPollingStatus(active.status) 时注册 3s 轮询；
    终态自动停；tick 拿到新记录 → setActive + 同步 tasks 列表条目 + 路由变化时清 forcedSub
```

- [ ] **Step 1: 失败断言**（渲染整壳：用 `H.MakePanelsView(t, bridges)` 生成组件后 `renderTree`；ctx 无 DOM，交互按钮用 `findElement(...).props.onClick()` 直调；`bridges` 传 stub `{api, createTask, sendToSession}`）：

```js
/* ═══ Plan 2b Task 6：壳层接线（联动逻辑下沉为可断言的模块级函数）═══ */
{
  const H = loadedModule.__testHooks
  const t = (key) => key
  // 壳层联动依赖 stub React 不执行的 effect，因此断言策略：
  // 1) openTask 逻辑下沉为模块级 openTaskRecord(entry, deps)；
  // 2) 路由判定 routeSubView(record)（= viewForStatus，供壳层与冒烟共用）；
  // 3) forcedSub 清除判定 shouldClearForced(prev, next)；
  // 4) 轮询 effect 注册经 hookLog.effects 断言（注册 + 手动调用取回 cancel）。

  // —— routeSubView 三落点 ——
  check('routeSubView: waiting-outline → 大纲视图工厂落点', H.routeSubView({ status: 'waiting-outline' }) === 'outline')
  check('routeSubView: building/failed/needs-input → progress；completed → result', (() => {
    return H.routeSubView({ status: 'building' }) === 'progress'
      && H.routeSubView({ status: 'failed' }) === 'progress'
      && H.routeSubView({ status: 'needs-input' }) === 'progress'
      && H.routeSubView({ status: 'completed' }) === 'result'
  })())

  // —— openTaskRecord ——
  const onReady = []; let missingCount = 0
  const openApi = (method, body) => {
    if (method === 'tasks.get' && body.id === 'k404') return Promise.reject(new Error('HTTP 404'))
    if (method === 'tasks.get') return Promise.resolve({ id: body.id, status: 'waiting-outline', outline: { version: 1, pages: [] } })
    return Promise.resolve({ tasks: [] })
  }
  await H.openTaskRecord({ id: 'k1' }, { api: openApi, onReady: (r) => onReady.push(r), onMissing: () => { missingCount += 1 } })
  check('openTaskRecord: 成功 → onReady 收到完整记录', onReady.length === 1 && onReady[0].id === 'k1')
  await H.openTaskRecord({ id: 'k404' }, { api: openApi, onReady: (r) => onReady.push(r), onMissing: () => { missingCount += 1 } })
  check('openTaskRecord: 404 → onMissing 被调且不抛', missingCount === 1 && onReady.length === 1)

  // —— forcedSub 清除判定 ——
  check('shouldClearForced: 路由变化才清除（同视图刷新不清）',
    H.shouldClearForced({ status: 'building' }, { status: 'waiting-outline' }) === true
    && H.shouldClearForced({ status: 'building' }, { status: 'building' }) === false
    && H.shouldClearForced({ status: 'failed' }, { status: 'waiting-outline' }) === true)

  // —— attention 提示行（AC 2：存在待确认任务时顶部提示）——
  check('attentionEntries: 抽出 attention 组条目（waiting-outline/needs-input），空列表 → 空',
    H.attentionEntries(shellTasks).length === 1 && H.attentionEntries(shellTasks)[0].id === 'k-wait'
    && H.attentionEntries([]).length === 0 && H.attentionEntries(null).length === 0)
  check('壳层静态锚点：sp-attention-hint 类名与 attentionEntries 已接线',
    clientSource.includes('sp-attention-hint') && clientSource.includes('attentionEntries'))

  // —— 壳层渲染（tabs）与轮询 effect 注册 ——
  const shellTasks = [
    { id: 'k-wait', title: '等待大纲', status: 'waiting-outline', format: 'pptx', workspaceName: 'ws', updatedAt: '2026-09-16T05:00:00.000Z' },
    { id: 'k-done', title: '已完成', status: 'completed', format: 'pptx', workspaceName: 'ws', updatedAt: '2026-09-16T04:00:00.000Z' },
  ]
  let shellApiCalls = []
  const shellApi = (method, body) => {
    shellApiCalls.push({ method, body })
    if (method === 'tasks.list') return Promise.resolve({ tasks: shellTasks })
    return Promise.resolve({ id: 'k-wait', status: 'waiting-outline', outline: { version: 1, pages: [] } })
  }
  const beforeEffects = hookLog.effects.length
  const panel = H.MakePanelsView(t, { api: shellApi, sendToSession: () => Promise.resolve('submitted') })({})
  const tabCount = byClass(panel, 'sp-tab').length
  // 手动执行已注册的 effect（refreshTasks 等返回非函数/未清理的仅记录执行一次）
  const registered = hookLog.effects.slice(beforeEffects)
  for (const fn of registered) { try { const d = fn(); if (typeof d === 'function') d(); } catch { /* 断言型 effect 容错 */ } }
  check('壳层渲染 tabs（新建任务/最近任务）', tabCount === 2)
  check('effect 注册了 tasks.list 刷新（手动执行后命中 tasks.list）', shellApiCalls.some((c) => c.method === 'tasks.list'))
  check('壳层 bundles 里轮询接在 isPollingStatus + startTaskPolling 上（静态锚点）',
    loadedModule.__id === 'dsh-super-ppts')
}
```

> 轮询 effect 的真实联动由实现质量保证 + 反向验证把关（临时把 effect 内的 `startTaskPolling` 调用砍掉 → 静态锚点/手动 effect 调用断言 FAIL）。若 stub 渲染 `Panels` 时 `useEffect` 未被记录到（例如 effect 在条件分支内），允许实现者调整断言为「手动调用 shell 内部 refreshTasks 入口」形式，但 routeSubView / openTaskRecord / shouldClearForced 三组断言不可省。

- [ ] **Step 2: 运行失败。**

- [ ] **Step 3: 实现**（重写 `makePanelsView` 的分发段；`openTaskRecord` / `routeSubView` / `shouldClearForced` / `attentionEntries` 模块级；`apply` 的 main keyed 注册处 bridges 追加 `sendToSession: function (text, workspaceId) { return sendToChatV3(ctx, text, workspaceId); }`；`__testHooks` 追加 `openTaskRecord / routeSubView / shouldClearForced / attentionEntries`）。`attentionEntries(tasks)` = `statusGroupOf(status)==='attention'` 的条目（按 updatedAt 倒序），壳层在其非空时渲染 `sp-attention-hint` 按钮行（文案含条数，点击 `openTaskRecord` 打开第一条）。关键行为：
  - `view === SP_VIEW_TASK` 且 `active` 存在 → 渲染对应详情视图；`activeErr` → 横幅 + 返回最近任务按钮；
  - 轮询 effect：`React.useEffect(function () { if (!active || !isPollingStatus(active.status)) return undefined; return startTaskPolling(active.id, onPollTick, { api: api }) }, [active && active.id, active && active.status])`；
  - `onTick(next)`：`setActive(next)`；`tasks` 列表同步替换条目；`if (shouldClearForced(prev, next)) setForcedSub(null)`；
  - tabs 在任务详情态都不带 `sp-tab-active`；
  - 最近视图 `onOpen: openTaskRecord(entry, deps)`、空态 `onNewTask: () => setView(SP_VIEW_NEW)`。

- [ ] **Step 4: 同构同步 `src/client/index.ts`**（makePanelsView 文档 + `routeSubView` 等参考声明）。
- [ ] **Step 5: 全绿 + 反向验证**（把 `shouldClearForced` 临时恒 false → 断言 FAIL；把 `attentionEntries` 的分组条件取反 → 抽取断言 FAIL；砍掉轮询 effect 里的 `startTaskPolling` → 静态锚点断言 FAIL；还原全绿）。
- [ ] **Step 6: Commit**

```bash
git add lib/client.js src/client/index.ts scripts/smoke-plugin.mjs
git commit -m "feat(client): wire detail views, 3s active-task polling and attention hint"
```

---

### Task 7: 死代码清理——移除 `makeWorkbenchComponent`

**Files:**
- Modify: `lib/client.js`（删除 `makeWorkbenchComponent` 函数体 ~2044–2242 行及其专属 CSS `.sp-work*` 行）
- Modify: `src/client/index.ts`（删除对应类型参考段与文档注释）
- Test: `scripts/smoke-plugin.mjs`

- [ ] **Step 1: 准备**：grep 确认 `makeWorkbenchComponent` 无任何注册/调用点（只有函数定义、哨兵 pair、静态断言 1198–1199 与文件头注释提及）。
- [ ] **Step 2: 改断言**（先改测试保持可定位）：
  - 哨兵 `pairs` 删除 `['makeWorkbenchComponent', …]` 对；保留 `useWorkspaces`（新建任务视图仍在用）；
  - 静态断言 `工作台读全局工作区 hook` / `工作台状态完备`（1198–1199 行）替换为：

```js
  check('任务面板读全局工作区 hook（useWorkspaces 选择器，新建任务视图）', client.includes('useWorkspaces(function'))
  check('任务视图状态完备（新建空态/最近错误/素材空态/重试）', client.includes('recentError') && client.includes('materialEmpty') && client.includes('retry'))
```

  - 新增守门断言：`check('旧工作台已移除', !client.includes('makeWorkbenchComponent'))`；文件头注释里对它的描述一并改写（保留「历史沿革」一句即可）。
- [ ] **Step 3: 删实现 + 删 CSS**（`.sp-work*` 各行——先 grep 确认这些类名无其他视图引用）。
- [ ] **Step 4: 全绿 + 反向验证**：把守门断言临时改回要求 `makeWorkbenchComponent` 在场 → FAIL；还原。**重点回归**：设置页（settings.section）与新建/最近视图断言全绿。
- [ ] **Step 5: Commit**

```bash
git add lib/client.js src/client/index.ts scripts/smoke-plugin.mjs
git commit -m "refactor(client): remove dead workbench component (superseded by task panel)"
```

---

### Task 8: 版本 1.4.0 + release note + README

**Files:**
- Modify: `package.json`（`version: 1.3.1 → 1.4.0`）
- Create: `release/v1.4.0.md`
- Modify: `README.md`（任务面板一段补三个详情视图 + 轮询说明）
- Modify: `lib/client.js` 顶部注释的版本号（若有）

- [ ] **Step 1: 版本与文档**：`package.json` bump；`release/v1.4.0.md` 按既有 release note 风格写（若仓库无 release/ 目录则参照既有 changelog 位置——先 `ls release/ 2>/dev/null || ls *.md` 确认惯例；内容须含：大纲确认视图（直接编辑 + Agent 修改 + 确认门）、生成进度视图（六阶段时间线 + needs-input + 失败恢复）、结果视图（产物引用 + 复制路径 + 继续修改）、活跃任务轮询（3s，终态停止）、`viewForStatus` 修正、死代码清理；**已知边界**：产物无下载/预览路由（D3），HTML 交付的「打开演示」以复制路径替代）。
- [ ] **Step 2: README**：「演示任务数据面」节补一行面板能力描述（大纲确认 → 进度 → 结果闭环 + 轮询口径），不重写整节。
- [ ] **Step 3: 全绿**（`npm run build && npm run smoke`；README/package 断言若 smoke 有版本断言需同步——先 grep `1\.3\.1` smoke）。
- [ ] **Step 4: Commit**

```bash
git add package.json release/v1.4.0.md README.md
git commit -m "chore: release 1.4.0 (task panel full lifecycle)"
```

---

## 验收对照（规格 AC → 任务）

| 规格验收标准 | 覆盖任务 |
|---|---|
| 4. Agent 分析后等待确认大纲；面板展示页面卡片；不生成 PPTX/HTML | Task 3（视图渲染确认卡） |
| 5. 大纲直接编辑 + Agent 修改，均回未确认态 | Task 3（dirty 判定 / 版本流） |
| 6. 确认后才生成；显示阶段与说明 | Task 2（继续指令）+ Task 4（阶段时间线） |
| 9. 打开任务恢复对应视图；重启不丢（host 已持久化） | Task 1（路由基元）+ Task 6（openTask 接线） |
| 11. 单列、无视口单位、无 fixed（回归断言） | Task 3–6 CSS 各步 |
| 3. 无需回车（回归保护） | Task 6 不触碰 createTaskAndStart |

## 执行方式

Subagent-Driven：每个任务一个全新实现者 subagent（前台串行——共享 `scripts/smoke-plugin.mjs`），控制器逐任务独立复核（build+smoke + grep 源码锚点 + 反向验证抽查），实现者自述不作数。顺序：Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8。Task 3（大纲视图）体量最大，允许实现者分两段提交（3a 纯函数 / 3b 视图），但两段都必须各自全绿。
