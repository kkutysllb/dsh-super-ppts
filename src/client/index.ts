/**
 * DSH Web GUI Client Extension for dsh-super-ppts（类型参考，非构建产物）。
 *
 * BUILD NOTE（重要）：`lib/client.js` 是手写的自注册产物，不由 tsc 生成。
 * dsh 的 client 模块加载器要求特定 bundle 形态——编译物必须经
 * `window.__ModuleLoader__.load({ id, factory })` 自注册、经 `exports.apply`
 * 暴露扩展并 `return module.exports`；裸 ESM `export` 不会注册，触发：
 *   "bundle .../client.js loaded without registering \"dsh-super-ppts\" via __ModuleLoader__.load"
 * 因此任何 client 侧改动请直接编辑 `lib/client.js`，并保持本文件与它的
 * 结构同构（服务声明、注册调用、行为约定）。
 *
 * 功能面（与 lib/client.js 对应）：
 * 1. 注册 `settings.section` 导航项（id: super-ppts，名称「演示文稿」）；
 * 2. 模板库管理：上传（原始流式 → POST /super-ppts/upload）、重命名/描述、
 *    设默认、删除；
 * 3. 生成偏好编辑：defaultFormat / renderReview / outputDir / styleNotes；
 * 4. 数据面 = /super-ppts/api/<method>（POST JSON，{ok,value} 信封）。
 *
 * 5. 设置页导航图标：宿主 0.1.x 的 settings.section 契约只投影
 *    id/order/label，壳层对外部分区一律渲染通用齿轮。挂载后按本地化
 *    文案标记本插件导航行（data-dsh-super-ppts-settings-nav），由注入
 *    CSS 用 Lucide presentation（幕布）字形替换齿轮；disposer 清标记，
 *    HMR/停用无残留。
 *
 * 6. 0.1.16 草稿桥 v2：工作区选择（uiWorkspace.openWorkspace 复用/新建会话）
 *    + 会话输入框程序化填充（sessions.scope(id).conversation.input
 *    .for(actx).setDraft）；剪贴板为降级路径（clipboardFallback /
 *    apply 内的 copyToClipboardBridge）。
 *
 * 6b. **会话桥 v3（Task 6 已交付，模块级 `sendToChatV3(ctx, text, workspaceId)`）**：
 *    会话定位逻辑同 v2，差别是填完草稿后**自动 `submit()`**——用户点「开始制作」
 *    任务立即启动，无需回聊天窗口回车。宿主输入面没有 `submit` 或任一步抛错时
 *    **不得假装提交成功**：一律降级剪贴板桥并返回 'copied'/'none'。
 *    返回 'submitted' | 'copied' | 'none'。
 *
 * 7. 任务面板壳（0.1.5 sidebar.panellist + main keyed）：主面板是
 *    makePanelsView 产出的**单列**任务工作区——顶部两个轻量视图切换
 *    （[新建任务][最近任务]）+ 视图分发 + 共享任务列表状态。视图是
 *    「工厂返回组件」形态（makeNewTaskView / makeRecentView /
 *    makeTemplatePicker），视图根**自持**容器类名
 *    （sp-view-new-task / sp-view-recent），壳层只传 props。壳层宽度与滚动归宿主：
 *    **不自建**侧边栏 / 右侧固定栏 / 全屏容器 / 100vw / 100vh。
 *    文件内分层：SP_* 常量 → api/uploadMaterial/clipboardFallback/sendToChatV3
 *    → createTask/createTaskAndStart/buildTaskPrompt → 轮询基元
 *    （isPollingStatus / startTaskPolling / SP_POLL_MS）→ makePanelsView（壳）→
 *    各视图工厂（含大纲确认视图 makeOutlineReviewView + 页操作纯函数族、
 *    生成进度视图 makeProgressView + 时间线/事件纯函数 progressSteps /
 *    lastEventOfKind，Plan 2b Task 4）；
 *    测试钩子见 bundle 末尾 `exports.__testHooks`
 *    （MakePanelsView / viewForStatus / statusGroupOf / SP_VIEW_NEW /
 *    SP_VIEW_TASK / isPollingStatus / startTaskPolling / SP_POLL_MS /
 *    makeNewTaskView / makeRecentView / makeTemplatePicker / buildBriefFrom /
 *    createTask / createTaskAndStart / buildTaskPrompt / outlineOps /
 *    makeOutlineReviewView / makeProgressView / progressSteps /
 *    lastEventOfKind / sendToChatV3 / clipboardFallback / uploadMaterial）。
 *
 * 8. 新建任务视图（Task 3 已交付）：主题 textarea（sp-topic-input，rows 3）+
 *    快速开始 8 chip（sp-quick-row / sp-quick-chip，点一条填入 qNText）+
 *    交付形态两张卡（sp-format-card，选中态 sp-format-card-active，默认取
 *    prefs.defaultFormat，ask → PPTX）+ 更多选项（默认折叠：sp-advanced-toggle
 *    切换 sp-advanced-body）+ 配置摘要（sp-config-summary 一行五项，展开明细
 *    sp-config-summary-extra）+ 素材入口/列表（sp-material-add /
 *    sp-material-list / sp-material-item / sp-material-remove + 隐藏
 *    multiple file input）+ 主按钮 sp-start（文案 startTask，主题 trim 为空即
 *    disabled）。brief 由 buildBriefFrom 组装，templateId 三态保真。
 *    模板入口 sp-tpl-open 已是**真实选择器**入口（Task 4，打开/关闭由视图层
 *    状态控制，折叠态不渲染选择器）；素材已接上传通道（Task 5：
 *    `uploadMaterial(taskId, file)` → POST /super-ppts/tasks/upload，视图把原始
 *    File 留在本地待上传队列，真正的上传编排由 createTaskAndStart 做）；
 *    「开始制作」走 apply 注入的桥 `bridges.createTask(input)`——Task 6 起注入的是
 *    绑定 ctx 的完整编排 createTaskAndStart（落盘 → 素材上传 → 会话桥 v3 提交 →
 *    状态推进），phase 可为 'started'（任务已自动启动）/ 'waiting-launch'（已落盘，
 *    启动链路降级剪贴板待重试）。
 *
 * 9. 模板选择器（Task 4 已交付）：makeTemplatePicker(t, options) 返回组件工厂，
 *    options = { builtin, user, onPick, onClose }——内置来自 host 的
 *    builtinTemplates，用户来自 templates（默认项由视图按 defaultTemplate 标
 *    isDefault）。分组容器 sp-tpl-group-builtin / sp-tpl-group-user，卡片
 *    sp-tpl-card + 占位预览 sp-tpl-thumb（内置取 accent，用户取中性灰）+
 *    来源标签 sp-tpl-source（文本 tplBuiltin / tplUser，**不依赖颜色**）+
 *    默认标记 sp-tpl-default + 使用按钮 sp-tpl-use；筛选 sp-tpl-filter
 *    （全部/插件内置/我的模板）+ 搜索 sp-tpl-search 均为纯内存过滤。
 *    「不使用模板」sp-tpl-none 与「跟随默认模板」sp-tpl-follow 是两个并列选项，
 *    onPick 载荷与 buildBriefFrom 三态同构：模板对象 / 'none' / ''。
 *
 * APPLY NOTE：访问 ctx.slots / ctx.locale 需要两处同时声明——
 * - exports.inject = ['slots', 'locale', 'sessions', 'uiConversation',
 *   'uiWorkspace', 'workspaces', 'layout']（cordis 服务名）；
 * - package.json → dsh.client.inject 列出对应 runtime 包
 *   （@deepseek-ai/dsh-client-locale、@deepseek-ai/dsh-client-ui-slots、
 *   @deepseek-ai/dsh-client-ui-conversation、@deepseek-ai/dsh-client-ui-workspace）。
 */
/** 客户端入口收到的 ctx 服务面（声明的服务 + cordis 自带 effect）。 */
export interface PptsClientContext {
  slots: {
    inject(slotType: string, loader: () => unknown): unknown
    register(options: Record<string, unknown>, component: unknown): () => void
  }
  locale: {
    register(ns: string, dicts: { zh: Record<string, string>; en: Record<string, string> }): () => void
    bind(ns: string): (key: string, params?: Record<string, unknown>) => string
  }
  uiWorkspace?: { openWorkspace(workspaceId: string): Promise<void> }
  workspaces?: {
    list: {
      getSnapshot(): {
        items: Array<{ workspaceId: string; path: string; title: string; sessionIds: string[] }>
        phase: string
      }
    }
  }
  effect(fn: () => () => void, name?: string): () => void
}

/** 必需服务（cordis fiber inject）。 */
export const inject = ['slots', 'locale', 'sessions', 'uiConversation', 'uiWorkspace', 'workspaces', 'layout']

/**
 * 设置页导航图标标记（与 lib/client.js 的 registerSettingsNavIcon 同构）：
 * 按本地化文案找到 [role="dialog"] nav button 中本插件的行并打标记，
 * MutationObserver 跟随语言切换与弹窗重开；返回的 disposer 清除全部标记。
 * 缺 DOM/Observer 时为空操作。
 */
export const NAV_MARKER = 'data-dsh-super-ppts-settings-nav'

export function registerSettingsNavIcon(label: () => string): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}
  let disposed = false
  const sync = (): void => {
    if (disposed) return
    let current = ''
    try { current = String(label() || '').trim() } catch (e) { current = '' }
    const buttons = document.querySelectorAll('[role="dialog"] nav button')
    for (const button of buttons) {
      const matches = current.length > 0 && (button.textContent || '').trim() === current
      if (matches) button.setAttribute(NAV_MARKER, '')
      else button.removeAttribute(NAV_MARKER)
    }
  }
  sync()
  const observer = new MutationObserver(sync)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  return () => {
    disposed = true
    observer.disconnect()
    const marked = document.querySelectorAll('[' + NAV_MARKER + ']')
    for (const element of marked) element.removeAttribute(NAV_MARKER)
  }
}

/* ── 任务面板壳 / 视图状态机（与 lib/client.js 同构，以其实现为准）─────
 * 真实分层：SP_* 常量 → api / uploadMaterial / sendToChatV3 →
 * 轮询基元（isPollingStatus / startTaskPolling / SP_POLL_STATUSES /
 * SP_POLL_MS）→ makePanelsView（面板壳）→ makeNewTaskView / makeRecentView /
 * makeTemplatePicker（视图工厂，返回组件）。
 * 本节的函数体只是**类型参考占位**，真实形态见 lib/client.js 同名符号。
 * 旧工作台 makeWorkbenchComponent（v2：工作区选择行 + 状态文案）仍保留在
 * lib/client.js 内（其 useWorkspaces 选择器用法与加载/空/错误文案由新视图
 * 承接），但 main keyed 主面板已改为 makePanelsView。
 */

/** 面板壳视图常量：新建任务（默认落点）/ 最近任务 / 任务详情（Plan 2b）。 */
export const SP_VIEW_NEW = 'new-task'
export const SP_VIEW_RECENT = 'recent'
export const SP_VIEW_TASK = 'task'

/* 视图容器类名契约（视图根自持、壳层只传 props，不产生多余包裹层）：
 * 新建任务 → 'sp-view-new-task'；最近任务 → 'sp-view-recent'。 */

/**
 * 任务状态 → 恢复落点视图（规格「状态 → 恢复落点」表，Plan 2b D1 修正）：
 * - waiting-outline → 大纲确认视图；
 * - creating / waiting-launch / analyzing / building / reviewing /
 *   needs-input / failed / cancelled → 生成进度视图（启动恢复区 /
 *   补充信息区 / 错误恢复区 / 只读详情是同一视图内的状态变体）；
 * - completed → 结果视图；其余（未知）→ 新建任务。
 */
export function viewForStatus(status?: string): string {
  switch (status) {
    case 'waiting-outline':
      return 'outline'
    case 'creating':
    case 'waiting-launch':
    case 'analyzing':
    case 'building':
    case 'reviewing':
    case 'needs-input':
    case 'failed':
    case 'cancelled':
      return 'progress'
    case 'completed':
      return 'result'
    default:
      return SP_VIEW_NEW
  }
}

/** 状态分组：待处理优先（与 host 的恢复优先级口径一致），供「最近任务」分组渲染。 */
export function statusGroupOf(status?: string): 'attention' | 'active' | 'failed' | 'done' | 'other' {
  if (status === 'waiting-outline' || status === 'needs-input') return 'attention'
  if (status === 'creating' || status === 'waiting-launch' || status === 'analyzing'
    || status === 'building' || status === 'reviewing') return 'active'
  if (status === 'failed') return 'failed'
  if (status === 'completed') return 'done'
  return 'other'
}

/* ── 活跃任务轮询（规格「面板侧刷新策略」：活跃态 3s 固定间隔，终态停止）── */

/** 轮询白名单：仅这四个活跃态轮询；终态与等待用户输入（needs-input）不轮询。 */
export const SP_POLL_STATUSES = ['analyzing', 'building', 'reviewing', 'waiting-outline']
/** 轮询固定间隔（毫秒）。 */
export const SP_POLL_MS = 3000

/** 轮询白名单判定：仅 SP_POLL_STATUSES 内的活跃态返回 true。 */
export function isPollingStatus(status?: string): boolean {
  return SP_POLL_STATUSES.indexOf(String(status || '')) !== -1
}

/**
 * 单任务轮询循环：到点 → tasks.get → onTick(record) → 记录仍是活跃态则
 * 按固定间隔续期，终态（或 cancel）即停。网络抖动（请求失败）按「继续
 * 轮询」处理——一次失败不该杀死恢复观察；onTick 拿不到记录时收到 null，
 * 由调用方决定是否提示。返回 cancel（幂等，可重复调用）。
 * （真实形态见 lib/client.js 同名函数：schedule 语义 = 到点单发一次，
 * 默认用 setTimeout 实现，不用 setInterval；loop 返回 promise 供注入方
 * await 完整一轮。）
 */
export function startTaskPolling(
  taskId: string,
  onTick: (record: unknown) => void,
  options?: {
    api?: (method: string, body?: unknown) => Promise<unknown>
    schedule?: (fn: () => void, ms: number) => () => void
  },
): () => void {
  return function cancel() { /* 类型参考占位，真实形态见 lib/client.js */ }
}

/** 面板壳 bridges：api + 任务启动编排 createTask（+ 素材上传 uploadMaterial）。 */
export interface PptsPanelBridges {
  /** 任务数据面（既有 api）：POST /super-ppts/api/<method>（tasks.list / tasks.get / …）。 */
  api(method: string, body?: unknown): Promise<unknown>
  /**
   * 「开始制作」的桥（真实形态 = apply 里绑定 ctx 的
   * `function (input) { return createTaskAndStart(ctx, input) }`）。
   * Task 6 起 phase 可能是 'started'（已自动提交启动）或 'waiting-launch'
   * （已落盘、启动链路降级剪贴板，可重试）；视图层的调用形状与返回语义不变。
   */
  createTask(input: {
    title: string
    brief: Record<string, unknown>
    workspace: { id: string; name: string; path: string }
    materials?: unknown[]
  }): Promise<{ task: unknown; phase: 'started' | 'waiting-launch'; message?: string }>
  /** Task 5 已交付：素材原始流式上传（POST /super-ppts/tasks/upload?taskId=&name=）。 */
  uploadMaterial?(taskId: string, file: { name?: string; size?: number }): Promise<{ name: string; size: number; path: string }>
  /** Task 6 已交付：会话桥 v3（模块级 `sendToChatV3(ctx, text, workspaceId)`）。 */
  sendToChatV3?(ctx: PptsClientContext, text: string, workspaceId?: string): Promise<SendToChatV3Result>
  /** Plan 2b：会话消息桥（大纲修改指令 / 继续生成 / 补充信息 / 继续修改都走它）。 */
  sendToSession?(text: string, workspaceId?: string): Promise<'submitted' | 'copied' | 'none'>
}

/**
 * 面板壳工厂（真实实现见 lib/client.js 的 makePanelsView）：返回宿主 main
 * keyed 槽位使用的组件——顶部 `sp-tabs`（[新建任务][最近任务]），视图容器
 * `sp-panels`，按 view 分发到 makeNewTaskView / makeRecentView，并共享任务
 * 列表状态（tasks / loadErr / refresh）。
 */
export function makePanelsView(
  t: (key: string, params?: Record<string, unknown>) => string,
  bridges: PptsPanelBridges,
): (props?: Record<string, unknown>) => unknown {
  return function Panels() { return null }
}

/**
 * 新建任务视图工厂（Task 3 已交付；真实形态见 lib/client.js 的 makeNewTaskView）。
 * 返回的组件视图根自持 `sp-view-new-task`，内部结构（className 是断言契约）：
 * `sp-topic-input`（textarea rows=3）/ `sp-quick-row` + `sp-quick-chip`×8 /
 * `sp-format-card`×2（选中 `sp-format-card-active`）/ `sp-tpl-open`（模板选择器
 * 入口按钮，Task 4 起打开态渲染 makeTemplatePicker 的 `sp-tpl-picker`）/
 * `sp-advanced-toggle` → `sp-advanced-body` / `sp-config-summary`（+`sp-summary-item`×5、
 * 展开明细 `sp-config-summary-extra`）/ `sp-material-add` + `sp-material-list` +
 * `sp-material-item` + `sp-material-remove` / `sp-start`（主题为空即 disabled）。
 */
export function makeNewTaskView(
  t: (key: string, params?: Record<string, unknown>) => string,
  options: Record<string, unknown>,
): (props?: Record<string, unknown>) => unknown {
  return function NewTaskView() { return null }
}

/** brief 组装状态：视图本地态 → buildBriefFrom 的入参（templateId 三态见下）。 */
export interface PptsBriefState {
  topic: string
  format: string
  audience?: string
  scenario?: string
  pageCount?: string
  style?: string
  styleNotes?: string
  /** '' = 跟随设置页默认（不写键）；'none' = 不使用模板（null）；对象 = 具体模板。 */
  templateChoice?: '' | 'none' | { id: string; name: string; source: string }
}

/**
 * 按 host 契约组装 brief（Task 3 已交付；真实形态见 lib/client.js 的 buildBriefFrom）。
 * templateId 三态语义保真：
 * - `templateChoice` 为空 → **不写 templateId 键**（跟随设置页默认模板）；
 * - `templateChoice === 'none'` → `templateId: null`（明确不使用模板）；
 * - `templateChoice` 为模板对象 → 写 `templateId` / `templateName` / `templateSource`。
 */
export function buildBriefFrom(state: PptsBriefState): Record<string, unknown> {
  return { topic: state.topic, format: state.format }
}

/**
 * 任务落盘（Task 3 引入的桥；Task 6 起成为 createTaskAndStart 的**第 1 步**，
 * 真实形态见 lib/client.js 的 `function createTask(input)`）。
 * 只做落盘：`api('tasks.create', { title, brief, workspace })` → 返回
 * `{ task, phase: 'waiting-launch', message: '' }`（如实反映「已落盘但尚未启动」，
 * 不假装已创建/已启动）。落盘失败即 reject——**先落盘再启动**的顺序不可颠倒。
 */
export function createTask(input: {
  title: string
  brief: Record<string, unknown>
  workspace: { id: string; name: string; path: string }
  materials?: unknown[]
}): Promise<{ task: unknown; phase: 'started' | 'waiting-launch'; message?: string }> {
  return Promise.resolve({ task: null, phase: 'waiting-launch', message: '' })
}

/** 视图本地素材条目（Task 5）：真实字节在 file，上传通道在 upload。 */
export interface PptsMaterialEntry {
  name: string
  size?: number
  status?: 'pending' | 'ready' | 'failed'
  file?: unknown
  upload?(taskId: string, file: unknown): Promise<{ name: string; size: number; path: string }>
}

/**
 * 创建并启动一个演示任务（Task 6 已交付；真实形态见 lib/client.js 的
 * `function createTaskAndStart(ctx, input)`）——apply 里按 ctx 绑定成
 * `bridges.createTask(input)` 注入面板壳，**视图层调用形状与返回语义不变**：
 * 1) 先在 host 落盘（`api('tasks.create', …)`）——失败即中止，绝不产生
 *    「启动了但没有记录」的孤儿任务；
 * 2) 逐个上传素材（`uploadMaterial(taskId, entry.file)`，单素材失败只记错误、
 *    不阻塞启动）；
 * 3) `buildTaskPrompt(task)` 组装 Brief（内嵌「任务 ID：<id>」，上传回执的
 *    path 补进 materials，Agent 据此调 ppts_task 并先读素材）；
 * 4) `sendToChatV3` 写入并提交（自动启动）；
 * 5) 提交成功 → 任务置 analyzing、phase 'started'；提交失败（降级剪贴板）→
 *    任务置 waiting-launch（可恢复，**不是 failed**）、phase 'waiting-launch'。
 * 本函数体只是**类型参考占位**，真实形态见 lib/client.js 同名符号。
 */
export function createTaskAndStart(
  ctx: PptsClientContext,
  input: {
    title: string
    brief: Record<string, unknown>
    workspace: { id: string; name: string; path: string }
    materials?: PptsMaterialEntry[]
  },
): Promise<{ task: unknown; phase: 'started' | 'waiting-launch'; message?: string }> {
  return Promise.resolve({ task: null, phase: 'waiting-launch', message: '' })
}

/**
 * 组装投递给 Agent 的 Brief 文本（Task 6 已交付；真实形态见 lib/client.js 的
 * `function buildTaskPrompt(task)`）：首行请示制作 + 「任务 ID：<id>」（Agent 据此
 * 调用 ppts_task 上报阶段/大纲）；随后按 brief 逐项补主题/受众/场景/页数/
 * 交付形态/模板三态（null = 不使用模板 → 自由设计；templateId 有值 → 名称+来源）/
 * 风格要求/素材路径清单；末段要求先报「分析内容」→ 提交 outline → **停下等用户在
 * 工作台确认**，不要先生成 PPTX/HTML。
 */
export function buildTaskPrompt(task: {
  id?: string
  brief?: Record<string, unknown>
  materials?: Array<{ path?: string }>
}): string {
  const brief = task?.brief ?? {}
  const lines = ['请制作一份演示文稿。', '任务 ID：' + task?.id]
  if (brief.topic) lines.push('主题：' + String(brief.topic))
  if (brief.audience) lines.push('目标受众：' + String(brief.audience))
  if (brief.scenario) lines.push('使用场景：' + String(brief.scenario))
  if (brief.pageCount) lines.push('预计页数：' + String(brief.pageCount))
  lines.push('交付形态：' + (brief.format === 'html' ? 'HTML 在线演示' : '可编辑 PPTX'))
  if (brief.templateId === null) lines.push('模板：不使用模板，按内容自由设计')
  else if (brief.templateId) lines.push('模板：' + String(brief.templateName) + '（' + String(brief.templateSource) + '）')
  if (brief.styleNotes) lines.push('风格要求：' + String(brief.styleNotes))
  const materials = task?.materials ?? []
  if (materials.length > 0) {
    lines.push('素材文件（请先读取）：')
    for (const material of materials) lines.push('- ' + String(material.path))
  }
  lines.push('')
  lines.push('请先用 ppts_task 汇报「分析内容」阶段，完成内容分析与页面规划后，用 ppts_task 的 outline 动作提交页面大纲，然后**停下等待用户在工作台确认**，不要先生成 PPTX/HTML。')
  return lines.join('\n')
}

/**
 * 任务消息构建器族（Plan 2b Task 2；真实形态见 lib/client.js 同名函数）：
 * 全部是**纯字符串组装**（不触 ctx / React），供后续 Task 3/4/5 的详情视图经
 * 壳层 `bridges.sendToSession(text, workspaceId)` 桥投递给 Agent。约定每条
 * 都内嵌「任务 ID：<id>」，Agent 据此调用 ppts_task 续跑任务。
 */
export interface PptsPromptTask {
  id?: string
  outlineVersion?: number
  confirmedOutlineVersion?: number
  outline?: { version?: number; pages?: Array<{ id?: string; title?: string }> }
  artifacts?: Array<{ type?: string; path?: string; status?: string }>
}

/** 确认大纲后的继续生成指令：按已确认大纲逐页生成 + artifact 登记 + 推进 completed。 */
export function buildContinuePrompt(task: PptsPromptTask): string {
  const outline = task?.outline ?? {}
  const pages = Array.isArray(outline.pages) ? outline.pages : []
  const version = task?.confirmedOutlineVersion || outline.version || 0
  return [
    '大纲已确认，请继续制作演示文稿。',
    '任务 ID：' + task?.id,
    '已确认大纲版本：v' + version + '（' + pages.length + ' 页）',
    '请按已确认大纲逐页生成内容与视觉；完成后用 ppts_task 的 artifact 动作登记产物文件，并将任务状态推进到 completed。',
  ].join('\n')
}

/** 自然语言修改大纲指令：Agent 提交新版本大纲后必须停下等再次确认（空指令抛错）。 */
export function buildOutlineRevisePrompt(task: PptsPromptTask, instruction: string): string {
  const text = String(instruction || '').trim()
  if (text === '') throw new Error('缺少修改指令')
  const outline = task?.outline ?? {}
  const pages = Array.isArray(outline.pages) ? outline.pages : []
  return [
    '请根据用户指令修改演示大纲。',
    '任务 ID：' + task?.id,
    '当前大纲版本：v' + (task?.outlineVersion || 0) + '（' + pages.length + ' 页）',
    '用户指令：' + text,
    '请调用 ppts_task 的 outline 动作提交修改后的完整大纲（生成新版本），然后停下等待用户在工作台再次确认，不要直接生成 PPTX/HTML。',
  ].join('\n')
}

/** needs-input 的补充信息投递（问题文本来自面板展示的同一条事件；空回答抛错）。 */
export function buildNeedsInputPrompt(task: PptsPromptTask, question: string, answer: string): string {
  const q = String(question || '').trim()
  const a = String(answer || '').trim()
  if (a === '') throw new Error('缺少补充内容')
  return [
    '补充信息（演示任务）。',
    '任务 ID：' + task?.id,
    q ? '待补充问题：' + q : '',
    '用户补充：' + a,
    '请基于以上信息继续任务。',
  ].filter((line) => line !== '').join('\n')
}

/** 已完成任务的自然语言继续修改（默认只重做相关部分；空指令抛错）。 */
export function buildContinueEditPrompt(task: PptsPromptTask, instruction: string): string {
  const text = String(instruction || '').trim()
  if (text === '') throw new Error('缺少修改指令')
  const artifacts = task?.artifacts ?? []
  const lines = ['继续修改已完成的演示文稿。', '任务 ID：' + task?.id]
  if (artifacts.length > 0) {
    lines.push('现有产物：')
    for (const a of artifacts) lines.push('- ' + a.path)
  }
  lines.push('修改要求：' + text)
  lines.push('只重做与要求相关的部分，不要整份重新生成；完成后重新登记产物并推进任务状态。')
  return lines.join('\n')
}

/** 产物丢失后的重新生成指令（结果页「重新生成」按钮；基于已确认大纲重登记新路径）。 */
export function buildRegeneratePrompt(task: PptsPromptTask, artifact: { type?: string; path?: string; status?: string }): string {
  return [
    '演示任务的产物文件已丢失，请重新生成。',
    '任务 ID：' + task?.id,
    '丢失产物：' + artifact?.type + '（原路径：' + artifact?.path + '）',
    '请基于已确认大纲重新生成该产物，并用 ppts_task 的 artifact 动作重新登记新路径。',
  ].join('\n')
}

/**
 * 大纲页操作纯函数族（Plan 2b Task 3a；真实形态见 lib/client.js 同名函数）：
 * 大纲确认视图的全部多字段编辑逻辑（换位/复制/增删/要点解析/dirty 比较）一律
 * 下沉为模块级纯函数，视图只做 setState 接线；`exports.__testHooks.outlineOps`
 * 按 { clonePages, uniquePageId, movePage, copyPage, addPage, removePage,
 * parseBullets, normalizePage, outlineDiffers } 聚合暴露给冒烟。
 */
/** 归一化后的单页（clonePages 的输出形状；可选字段一律落成空串/空数组）。 */
export interface PptsOutlinePage {
  id: string
  title: string
  purpose: string
  bullets: string[]
  pageType: string
}

/** 深拷贝 + 形状归一（可选字段容忍）；改副本不影响原数组。 */
export function clonePages(pages: unknown[]): PptsOutlinePage[] {
  return []
}

/** 新页 id：'p' + (length+1) 起，跳过已占用（while 去重保证全局唯一）。 */
export function uniquePageId(pages: PptsOutlinePage[]): string {
  return 'p1'
}

/** 相邻换位；越界（含空数组）返回原数组不抛。 */
export function movePage(pages: PptsOutlinePage[], index: number, delta: number): PptsOutlinePage[] {
  return pages
}

/** 复制到后一位，副本取全局唯一 id。 */
export function copyPage(pages: PptsOutlinePage[], index: number): PptsOutlinePage[] {
  return pages
}

/** 追加新页（唯一 id + 注入标题），供「＋ 添加页面」。 */
export function addPage(pages: PptsOutlinePage[], title: string): PptsOutlinePage[] {
  return pages
}

/** 删除目标页（越界返回原数组）。 */
export function removePage(pages: PptsOutlinePage[], index: number): PptsOutlinePage[] {
  return pages
}

/** 要点 textarea 文本 → 数组：丢空行，行内容原样保留。 */
export function parseBullets(text: string): string[] {
  return []
}

/** 归一化单页（undefined purpose/pageType 与空串等价、bullets 合成单串），供 dirty 比较。 */
export function normalizePage(page: unknown): { id: string; title: string; purpose: string; bullets: string; pageType: string } {
  return { id: '', title: '', purpose: '', bullets: '', pageType: '' }
}

/** 本地页数组 vs 已保存页数组是否发生了有效修改（大纲 dirty 判定）。 */
export function outlineDiffers(localPages: unknown[], savedPages: unknown[]): boolean {
  return false
}

/** 大纲记录的最小形状（tasks.get 返回 TaskRecord 中，本视图实际读取的字段）。 */
export interface PptsOutlineTaskRecord {
  id?: string
  title?: string
  status?: string
  outlineVersion?: number
  confirmedOutlineVersion?: number
  workspace?: { id?: string; name?: string; path?: string }
  outline?: { version?: number; pages?: unknown[] }
}

/**
 * 大纲确认视图选项（Plan 2b Task 3b 已交付；真实形态见 lib/client.js 的
 * makeOutlineReviewView）。api=数据面桥（缺省回 bundle 内 api）；
 * sendToSession=会话桥（确认成功后投递继续指令 / 修改指令投递给 Agent）；
 * onUpdated=确认/修改后的记录回写（壳层据此切视图/续轮询）；onBack=返回。
 * initialPages / reviseText 为**仅测试注入**（stub React 无重渲染，
 * 冒烟经 options 构造未保存态与修改指令初值）。
 */
export interface PptsOutlineOptions {
  task?: PptsOutlineTaskRecord
  api?(method: string, body: Record<string, unknown>): Promise<unknown>
  sendToSession?(text: string, workspaceId?: string): Promise<'submitted' | 'copied' | 'none'>
  onUpdated?(next: unknown): void
  onBack?(): void
  initialPages?: unknown[] | (() => unknown[])
  reviseText?: string
}

/**
 * 大纲确认视图工厂（Plan 2b Task 3b；真实形态见 lib/client.js）。核心控制点：
 * **大纲必须经用户确认才继续生成**。直接编辑只改本地副本（渲染期 outlineDiffers
 * 直算 dirty，常驻渲染的 sp-outline-dirty-banner / sp-discard-confirm 行按状态
 * display 切换）；落盘走 tasks.outline（新版本），确认走 tasks.confirmOutline
 * （version 必须等于当前 outlineVersion）；确认成功 → buildContinuePrompt 经
 * 会话桥投递 → onUpdated；版本不匹配 → tasks.get 重取载入新版本（不自动确认）
 * + sp-outline-resync 提示。类名契约（断言按全等匹配，勿复合拼接）：
 * sp-view-outline / sp-outline-head(sp-back·sp-task-title·sp-task-status) /
 * sp-outline-hint / sp-outline-pages > sp-outline-page(sp-page-index·
 * sp-page-title·sp-page-purpose·sp-page-bullets·sp-page-type·sp-page-ops>
 * sp-page-up|down|copy|delete) / sp-outline-add / sp-outline-dirty-banner>
 * sp-outline-save / sp-outline-revise-text / sp-outline-revise /
 * sp-revise-dirty-confirm>sp-discard-confirm(sp-revise-save·sp-revise-discard) /
 * sp-outline-confirm / sp-msg-ok·sp-msg-err / sp-outline-resync / sp-outline-empty。
 */
export function makeOutlineReviewView(
  t: (key: string, params?: Record<string, unknown>) => string,
  options: PptsOutlineOptions,
): (props?: Record<string, unknown>) => unknown {
  return function OutlineReview() { return null }
}

/**
 * 生成进度视图原语（Plan 2b Task 4；真实形态见 lib/client.js 同名符号）：
 * agent 经 ppts_task 上报的 stage{key,index,total} 是**任意总步数**，面板固定
 * 渲染六阶段时间线——线性归一映射（Math.ceil 向上取整，保证「有汇报必有
 * active 步」）；fail 原因 / needs-input 问题统一取该 kind 的最近一条事件。
 */
/** 固定六阶段标签键（sp-step ×6 的渲染顺序）。 */
export const SP_STAGES: string[] = ['stageReceive', 'stageAnalyze', 'stageOutline', 'stageBuild', 'stagePackage', 'stageReview']

/** 单步状态：done（已过）/ active（进行中）/ pending（未到）。 */
export interface PptsProgressStep {
  key: string
  state: 'done' | 'active' | 'pending'
}

/** agent 上报的阶段投影（host TaskStage 的最小消费形状）。 */
export interface PptsProgressStage {
  key?: string
  index?: number
  total?: number
  detail?: string
}

/** 时间线映射：无 stage（或 index/total 非法）→ 全 pending；否则 index/total
 *  线性映射到六步（向上取整并钳位 1..6）。 */
export function progressSteps(stage: PptsProgressStage | null | undefined): PptsProgressStep[] {
  return SP_STAGES.map((key) => ({ key, state: 'pending' as const }))
}

/** 最近一条指定 kind 的事件（无 → null；events 按 host 追加序旧→新）。 */
export function lastEventOfKind(
  task: { events?: Array<{ at?: string; kind?: string; text?: string }> } | null | undefined,
  kind: string,
): { at?: string; kind?: string; text?: string } | null {
  return null
}

/** 进度视图记录的最小消费形状（tasks.get TaskRecord 的视图侧投影）。 */
export interface PptsProgressTaskRecord {
  id?: string
  title?: string
  status?: string
  workspace?: { id?: string; name?: string; path?: string }
  brief?: Record<string, unknown>
  outline?: { version?: number; pages?: unknown[] }
  stage?: PptsProgressStage
  events?: Array<{ at?: string; kind?: string; text?: string }>
}

/**
 * 生成进度视图选项。sendToSession=会话桥（重试启动/发送补充/重试阶段投递）；
 * openSession=壳层会话桥（Task 6 接线，冒烟传 stub）；onBackToOutline=错误恢复
 * 区「返回修改大纲」。answerText 为**仅测试注入**（stub React 无重渲染，
 * 冒烟经 options 构造补充回答初值）。
 */
export interface PptsProgressOptions {
  task?: PptsProgressTaskRecord
  api?(method: string, body: Record<string, unknown>): Promise<unknown>
  sendToSession?(text: string, workspaceId?: string): Promise<'submitted' | 'copied' | 'none'>
  onUpdated?(next: unknown): void
  onBack?(): void
  onBackToOutline?(): void
  openSession?(): void
  answerText?: string
}

/**
 * 生成进度视图工厂（Plan 2b Task 4；真实形态见 lib/client.js）。D1：
 * creating/waiting-launch/analyzing/building/reviewing/needs-input/failed/
 * cancelled 全部落在此视图；四个状态变体按 task.status **条件渲染**（启动
 * 恢复区/补充信息区/错误恢复区/只读终态）。D2 硬约束：取消 = tasks.update
 * status:'cancelled'（仅活跃态渲染 sp-cancel，不做 paused）；重试启动重投
 * 完整 Brief（buildTaskPrompt）成功后推 analyzing；发送补充（buildNeedsInput-
 * Prompt）成功后回 building；重试当前阶段（buildContinuePrompt）**不自动改
 * 状态**。类名契约（断言按 token 精确匹配，勿复合拼接）：sp-view-progress /
 * sp-progress-head(sp-back·sp-task-title·sp-task-status) / sp-progress-line /
 * sp-steps>sp-step(sp-step-done|sp-step-active|sp-step-pending) /
 * sp-progress-detail / sp-progress-events>sp-event / sp-launch-recovery
 * (sp-launch-retry·sp-launch-cancel) / sp-needs-input(sp-input-answer·
 * sp-needs-input-send) / sp-error-recovery(sp-fail-retry·sp-fail-back-outline)
 * / sp-cancel / sp-open-session / sp-terminal-note / sp-msg-ok·sp-msg-err。
 */
export function makeProgressView(
  t: (key: string, params?: Record<string, unknown>) => string,
  options: PptsProgressOptions,
): (props?: Record<string, unknown>) => unknown {
  return function Progress() { return null }
}

/**
 * 任务索引条目（client 侧类型参考，形状镜像 host 的 `TaskIndexEntry`）：
 * `tasks.list` 返回的列表元素，列表渲染只读它（host 侧不逐任务读盘）。
 * `format` 目前只用于展示，`makeRecentView` 未消费它（保留给 Plan 2b 的筛选行）。
 */
export interface PptsTaskIndexEntry {
  id: string
  title: string
  status: string
  format?: string
  workspaceId?: string
  workspaceName?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * 最近任务视图选项（Task 7 已交付；真实形态见 lib/client.js 的 makeRecentView）。
 * tasks / loadErr / refresh 由面板壳共享的任务列表状态注入；onOpen / onNewTask
 * 是**恢复落点判定**的注入点（默认实现只返回 viewForStatus(status) / SP_VIEW_NEW，
 * Plan 2b 把它们接到视图状态机的 outline / progress / result 三个落点）。
 */
export interface PptsRecentViewOptions {
  tasks?: PptsTaskIndexEntry[]
  /** 列表加载失败原因（非空即渲染错误态 sp-recent-error，而不是伪装成空列表）。 */
  loadErr?: string
  refresh?(): Promise<unknown>
  /** 打开任务（sp-task-open 的 onClick 载荷）；默认返回 viewForStatus(task.status)。 */
  onOpen?(task: PptsTaskIndexEntry | null): string
  /** 空态引导去向；默认返回 SP_VIEW_NEW。 */
  onNewTask?(): string
}

/**
 * 最近任务视图工厂（Task 7 已交付；真实形态见 lib/client.js 的 makeRecentView）。
 * 返回的组件视图根自持 `sp-view-recent`，结构（className 是断言契约）：
 * 按 statusGroupOf 分四组，容器依次 `sp-group-attention` / `sp-group-active` /
 * `sp-group-failed` / `sp-group-done`（数组顺序即渲染顺序——待处理优先，
 * **空分组不渲染**），组标题文案键 groupAttention / groupActive / groupFailed /
 * groupDone；条目 `sp-task-item` = 标题 `sp-task-title` + 状态徽标 `sp-task-status` +
 * 工作区名 `sp-work-name` + 更新时间 `sp-task-time` + 打开按钮 `sp-task-open`
 * （`onOpen(task)`，本任务只做 viewForStatus 判定，落点由 Plan 2b 接）。
 * 空列表渲染 `sp-recent-empty`（文案 recentEmpty）；loadErr 非空渲染
 * `sp-recent-error` + 重试按钮 `sp-recent-retry`（文案 retry，点击 refresh）。
 * 未归类状态（cancelled / 未知）并入 active 容器，徽标仍显示真实状态。
 */
export function makeRecentView(
  t: (key: string, params?: Record<string, unknown>) => string,
  options: PptsRecentViewOptions,
): (props?: Record<string, unknown>) => unknown {
  return function RecentView() { return null }
}

/** 模板选择器的一张卡片（内置来自 builtinTemplates，用户来自 templates）。 */
export interface PptsTemplateCard {
  id: string
  name: string
  /** 内置模板为 'builtin'；用户模板由视图按来源补 'user'。 */
  source?: 'builtin' | 'user'
  description?: string
  /** 内置模板的适用场景（用户模板通常没有）。 */
  scenario?: string
  tags?: string[]
  accent?: string
  /** 用户模板：是否当前默认模板（视图按 defaultTemplate 标注，渲染 sp-tpl-default）。 */
  isDefault?: boolean
}

/**
 * 模板选择器选项（Task 4 已交付；真实形态见 lib/client.js 的 makeTemplatePicker）。
 * onPick 的载荷与 PptsBriefState.templateChoice 三态**同构**：
 * 模板对象 / 'none'（不使用模板）/ ''（跟随默认模板）。
 */
export interface PptsTemplatePickerOptions {
  builtin?: PptsTemplateCard[]
  user?: PptsTemplateCard[]
  onPick?(choice: '' | 'none' | { id: string; name: string; source: string }): void
  onClose?(): void
}

/**
 * 模板选择器工厂（Task 4 已交付；真实形态见 lib/client.js 的 makeTemplatePicker）。
 * 结构（className 是断言契约，纯内存筛选、不发请求）：
 * 根 `sp-tpl-picker`；筛选 `sp-tpl-filter`（全部/插件内置/我的模板）+ 搜索
 * `sp-tpl-search`；分组容器 `sp-tpl-group-builtin` / `sp-tpl-group-user`；
 * 卡片 `sp-tpl-card` = 占位预览 `sp-tpl-thumb`（内置取 accent，用户取中性灰）+
 * 来源标签 `sp-tpl-source`（文本 tplBuiltin / tplUser，不依赖颜色）+ 可选默认标记
 * `sp-tpl-default` + 使用按钮 `sp-tpl-use`；「不使用模板」`sp-tpl-none` 与
 * 「跟随默认模板」`sp-tpl-follow` 是两个并列选项，另有管理入口 `sp-tpl-manage`。
 */
export function makeTemplatePicker(
  t: (key: string, params?: Record<string, unknown>) => string,
  options: PptsTemplatePickerOptions,
): (props?: Record<string, unknown>) => unknown {
  return function TemplatePicker() { return null }
}

/* 后续任务符号（此处仅 JSDoc 引用，实现由各自任务追加到 lib/client.js）：
 * - api(method, body)：既有实现，复用为任务数据面客户端（tasks.* / templates.list）。
 * Task 6 的 sendToChatV3 / createTaskAndStart / buildTaskPrompt 已在上文给出
 * 类型同构形态（见各符号 JSDoc）。 */

/**
 * 素材上传（Task 5 已交付；真实形态见 lib/client.js 的
 * `function uploadMaterial(taskId, file)`）：原始流式 POST 到
 * `/super-ppts/tasks/upload?taskId=&name=`（body 即 File/Blob，不套 JSON 信封），
 * 返回宿主登记的素材信息 `{ name, size, path }`；宿主拒绝（信封 ok:false）时
 * 抛出带宿主 message 的错误，不静默吞掉。
 * 只登记到**已有任务**：任务尚未创建时素材先留在视图的本地待上传队列
 * （materials 条目的 file 字段），任务落盘后由 Task 6 的编排逐项调用本函数。
 */
export function uploadMaterial(
  taskId: string,
  file: { name?: string; size?: number },
): Promise<{ name: string; size: number; path: string }> {
  return Promise.resolve({ name: file.name ?? 'material', size: file.size ?? 0, path: '' })
}

/** v2 草稿桥结果：'draft' = 已填输入框；'copied' = 剪贴板降级成功；'none' = 全失败。 */
export type SendToChatResult = 'draft' | 'copied' | 'none'

/**
 * 草稿桥 v2（与 lib/client.js 的 sendToChat/copyToClipboardBridge 行为同构，
 * 以 lib/client.js 实现为准）：
 * 1) 会话落点（含工作区选择）：同工作区 → 当前会话；跨工作区/无会话 →
 *    uiWorkspace.openWorkspace(ws)（复用空白会话或新建 + 自动切回对话）；
 *    工作区列表空 → sessions.create() + open。
 * 2) 填草稿：sessions.scope(id).conversation.input.for(actx).setDraft(text)
 *    —— shell 按 session binding 构建，面板激活时也能写输入框。
 * 3) 任一步不可达 → 降级剪贴板（v1：复制 + 切回会话视图）。
 */
export async function sendToChat(ctx: PptsClientContext, text: string, workspaceId?: string): Promise<SendToChatResult> {
  type SessionsFace = {
    list?: { getSnapshot?(): { current?: string } }
    create?(opts?: { cwd?: string }): Promise<string>
    open?(id: string): void
    scope?(id: string): (Record<string, unknown> & { conversation?: { input?: { for?(c: unknown): { setDraft?(t: string): void } } } }) | undefined
  }
  const sessions = (ctx as unknown as { sessions?: SessionsFace }).sessions
  const workspaces = ctx.workspaces
  const uiWorkspace = ctx.uiWorkspace
  const backToChat = (): void => {
    try { (ctx as unknown as { layout?: { selectPanel?(id: unknown): void } }).layout?.selectPanel?.(null) } catch { /* 服务不可达:留在当前面板 */ }
  }
  const clipboardFallback = async (): Promise<SendToChatResult> => {
    let copied = false
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        copied = await navigator.clipboard.writeText(text).then(() => true).catch(() => false)
      }
    } catch { /* 剪贴板不可用 */ }
    if (!copied) return 'none'
    try {
      const current = sessions?.list?.getSnapshot?.().current
      if (!current && typeof sessions?.create === 'function') {
        await sessions.create().then(async (id) => { try { sessions?.open?.(id) } catch { /* 已选中 */ } }).catch(() => { /* 无落点 */ })
      }
    } catch { /* 服务不可达 */ }
    backToChat()
    return 'copied'
  }
  try {
    if (!sessions?.list?.getSnapshot) return clipboardFallback()
    const current = sessions.list.getSnapshot().current
    const wsList = workspaces?.list?.getSnapshot?.() ?? null
    let wsOfCurrent: string | null = null
    if (current && wsList) {
      for (const item of wsList.items) {
        if (item.sessionIds.includes(current)) { wsOfCurrent = item.workspaceId; break }
      }
    }
    const wantsSwitch = workspaceId !== undefined && workspaceId !== '' && wsOfCurrent !== workspaceId
    let sessionId: string | null | undefined = current
    if (!current || wantsSwitch) {
      if (uiWorkspace?.openWorkspace && wsList && wsList.items.length > 0) {
        const target = workspaceId || wsOfCurrent || wsList.items[0].workspaceId
        await uiWorkspace.openWorkspace(target)
        sessionId = sessions.list.getSnapshot().current ?? null
      } else if (typeof sessions.create === 'function') {
        sessionId = await sessions.create()
        try { sessions?.open?.(sessionId) } catch { /* 已选中 */ }
        backToChat()
      } else {
        sessionId = null
      }
    }
    if (sessionId === null || sessionId === undefined) return clipboardFallback()
    backToChat()
    const actx = sessions.scope?.(sessionId)
    const shell = actx?.conversation?.input?.for?.(actx)
    if (shell && typeof shell.setDraft === 'function') {
      shell.setDraft(text)
      return 'draft'
    }
    return clipboardFallback()
  } catch {
    return clipboardFallback()
  }
}

/** v3 会话桥结果：'submitted' = 已写入并自动提交；'copied' = 降级剪贴板；'none' = 全失败。 */
export type SendToChatV3Result = 'submitted' | 'copied' | 'none'

/**
 * 会话桥 v3（Task 6 已交付；真实形态见 lib/client.js 的
 * `function sendToChatV3(ctx, text, workspaceId)`——与 v2 不同，它是**模块级**
 * 函数，ctx 显式传入，供 createTaskAndStart 与冒烟 __testHooks 直接调用）。
 *
 * 与 v2 的唯一差别是最后一步：填完草稿后调用同一 shell 的 `submit()`，
 * 用户点「开始制作」任务**立即启动**，无需回聊天窗口按回车。
 *
 * 1) 会话落点（沿用 v2）：同工作区 → 当前会话；跨工作区/无会话 →
 *    uiWorkspace.openWorkspace(ws) 后取当前会话；工作区列表空 →
 *    sessions.create() + open；定位失败 → 降级。
 * 2) 写草稿：sessions.scope(id).conversation.input.for(actx).setDraft(text)。
 * 3) 提交：同一 shell 上 `submit()`（顺序不可颠倒：setDraft 先于 submit）。
 *    **若 submit 不存在或任一步抛错，不得假装提交成功**——一律降级剪贴板桥，
 *    绝不返回 'submitted'（否则 createTaskAndStart 会把没启动的任务置成
 *    analyzing，用户以为在做其实没动）。
 * 4) 剪贴板降级=模块级 clipboardFallback(ctx, text)：'copied' | 'none'。
 */
export async function sendToChatV3(
  ctx: PptsClientContext,
  text: string,
  workspaceId?: string,
): Promise<SendToChatV3Result> {
  type Shell = { setDraft?(t: string): void; submit?(mode?: unknown): void }
  type SessionsFace = {
    list?: { getSnapshot?(): { current?: string } }
    create?(opts?: { cwd?: string }): Promise<string>
    open?(id: string): void
    scope?(id: string): (Record<string, unknown> & { conversation?: { input?: { for?(c: unknown): Shell } } }) | undefined
  }
  const sessions = (ctx as unknown as { sessions?: SessionsFace }).sessions
  const workspaces = ctx.workspaces
  const uiWorkspace = ctx.uiWorkspace
  const backToChat = (): void => {
    try { (ctx as unknown as { layout?: { selectPanel?(id: unknown): void } }).layout?.selectPanel?.(null) } catch { /* 服务不可达:留在当前面板 */ }
  }
  const fallback = async (): Promise<SendToChatV3Result> => {
    let copied = false
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        copied = await navigator.clipboard.writeText(text).then(() => true).catch(() => false)
      }
    } catch { /* 剪贴板不可用 */ }
    if (!copied) return 'none'
    try {
      const current = sessions?.list?.getSnapshot?.().current
      if (!current && typeof sessions?.create === 'function') {
        await sessions.create().then(async (id) => { try { sessions?.open?.(id) } catch { /* 已选中 */ } }).catch(() => { /* 无落点 */ })
      }
    } catch { /* 服务不可达 */ }
    backToChat()
    return 'copied'
  }
  try {
    if (!sessions?.list?.getSnapshot) return fallback()
    const current = sessions.list.getSnapshot().current
    const wsList = workspaces?.list?.getSnapshot?.() ?? null
    let wsOfCurrent: string | null = null
    if (current && wsList) {
      for (const item of wsList.items) {
        if (item.sessionIds.includes(current)) { wsOfCurrent = item.workspaceId; break }
      }
    }
    const wantsSwitch = workspaceId !== undefined && workspaceId !== '' && wsOfCurrent !== workspaceId
    let sessionId: string | null | undefined = current
    if (!current || wantsSwitch) {
      if (uiWorkspace?.openWorkspace && wsList && wsList.items.length > 0) {
        const target = workspaceId || wsOfCurrent || wsList.items[0].workspaceId
        await uiWorkspace.openWorkspace(target)
        sessionId = sessions.list.getSnapshot().current ?? null
      } else if (typeof sessions.create === 'function') {
        sessionId = await sessions.create()
        try { sessions?.open?.(sessionId) } catch { /* 已选中 */ }
        backToChat()
      } else {
        sessionId = null
      }
    }
    if (sessionId === null || sessionId === undefined) return fallback()
    backToChat()
    const actx = sessions.scope?.(sessionId)
    const shell = actx?.conversation?.input?.for?.(actx)
    if (shell && typeof shell.setDraft === 'function') {
      shell.setDraft(text)
      // v3 的关键一步：Write 之后必须 Submit（否则退化成 v2，用户还得回车）。
      if (typeof shell.submit === 'function') {
        shell.submit()
        return 'submitted'
      }
      // 宿主输入面没有 submit（≤旧宿主）→ 不假装提交成功，降级剪贴板。
    }
    return fallback()
  } catch {
    return fallback()
  }
}

/** 挂载设置页「演示文稿」区块 + 左侧栏工作台主面板。 */
export function apply(ctx: PptsClientContext): void {
  ctx.effect(() => ctx.locale.register('superPpts', { zh: {}, en: {} }), 'dsh-super-ppts: section dictionaries')
  const t = ctx.locale.bind('superPpts')
  // 设置页导航图标：标记本插件行后由 CSS 把齿轮换成幕布字形（见功能面 5）。
  ctx.effect(() => registerSettingsNavIcon(() => t('nav')), 'dsh-super-ppts: settings navigation icon')
  ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      { name: 'settings.section', id: 'super-ppts', order: 20, label: () => t('nav'), locale: 'superPpts' },
      // 真实组件形态见 lib/client.js 的 makeStatefulComponent() 产物
      function Stateful() { return null },
    ),
  )
  // 0.1.5 左侧栏原生接入:panellist 图标行 + main keyed 任务面板壳
  // （makePanelsView,真实形态见 lib/client.js）;宿主 ≤0.1.4 软回退。
  ctx.slots.inject('sidebar.panellist', () => {
    const disposeIcon = ctx.slots.register(
      { name: 'sidebar.panellist', id: 'super-ppts-panel', order: 100, label: () => t('nav'), locale: 'superPpts' },
      function PanelIcon() { return null },
    )
    const disposePanel = ctx.slots.register(
      { name: 'main', key: 'super-ppts-panel' },
      // 任务面板壳（makePanelsView(t, { api, createTask, uploadMaterial })）：
      // createTask 注入的是**绑定本 ctx 的完整编排**——
      // `function (input) { return createTaskAndStart(ctx, input) }`
      // （Task 6：落盘 → 素材上传 → 会话桥 v3 提交 → 状态推进；单参调用形状与
      // { task, phase } 返回语义不变，真实形态见 lib/client.js）：
      // root 面板接收全局标准 props useWorkspaces（工作区选择行，
      // 选择器用法 useWorkspaces(s => s.items)；旧宿主缺失时行隐藏）。
      function Workbench() { return null },
    )
    return () => { disposePanel(); disposeIcon() }
  })
}
