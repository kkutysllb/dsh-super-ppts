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
 * 6. 0.1.16 草稿桥：工作区选择（uiWorkspace.openWorkspace 复用/新建会话）
 *    + 会话输入框程序化填充（sessions.scope(id).conversation.input
 *    .for(actx).setDraft）；剪贴板为降级路径（copyToClipboardBridge）。
 *
 * 7. 任务面板壳（0.1.5 sidebar.panellist + main keyed）：主面板是
 *    makePanelsView 产出的**单列**任务工作区——顶部两个轻量视图切换
 *    （[新建任务][最近任务]）+ 视图分发 + 共享任务列表状态。视图是
 *    「工厂返回组件」形态（makeNewTaskView / makeRecentView /
 *    makeTemplatePicker），视图根**自持**容器类名
 *    （sp-view-new-task / sp-view-recent），壳层只传 props。壳层宽度与滚动归宿主：
 *    **不自建**侧边栏 / 右侧固定栏 / 全屏容器 / 100vw / 100vh。
 *    文件内分层：SP_* 常量 → api/uploadMaterial/sendToChatV3 →
 *    makePanelsView（壳）→ 各视图工厂；测试钩子见 bundle 末尾
 *    `exports.__testHooks`（MakePanelsView / viewForStatus /
 *    statusGroupOf / SP_VIEW_NEW / makeNewTaskView / makeRecentView /
 *    makeTemplatePicker / buildBriefFrom / createTask）。
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
 *    File 留在本地待上传队列，真正的上传编排由 Task 6 的 createTaskAndStart 做）；
 *    「开始制作」走 apply 注入的最小桥 createTask（只落盘，phase 恒为
 *    'waiting-launch'，Task 6 换成完整 createTaskAndStart）。
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
 * makePanelsView（面板壳）→ makeNewTaskView / makeRecentView /
 * makeTemplatePicker（视图工厂，返回组件）。
 * 本节的函数体只是**类型参考占位**，真实形态见 lib/client.js 同名符号。
 * 旧工作台 makeWorkbenchComponent（v2：工作区选择行 + 状态文案）仍保留在
 * lib/client.js 内（其 useWorkspaces 选择器用法与加载/空/错误文案由新视图
 * 承接），但 main keyed 主面板已改为 makePanelsView。
 */

/** 面板壳视图常量：新建任务（默认落点）/ 最近任务。 */
export const SP_VIEW_NEW = 'new-task'
export const SP_VIEW_RECENT = 'recent'

/* 视图容器类名契约（视图根自持、壳层只传 props，不产生多余包裹层）：
 * 新建任务 → 'sp-view-new-task'；最近任务 → 'sp-view-recent'。 */

/**
 * 任务状态 → 恢复落点视图（Plan 2b 补 outline / progress / result 三个落点）：
 * waiting-outline | needs-input → outline；analyzing | building | reviewing | failed
 * → progress；completed → result；其余（creating / waiting-launch / cancelled / 未知）
 * → SP_VIEW_NEW。
 */
export function viewForStatus(status?: string): string {
  switch (status) {
    case 'waiting-outline':
    case 'needs-input':
      return 'outline'
    case 'analyzing':
    case 'building':
    case 'reviewing':
      return 'progress'
    case 'completed':
      return 'result'
    case 'failed':
      return 'progress'
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

/** 面板壳 bridges：api + Task 3 的最小桥 createTask；其余由后续任务实现后注入。 */
export interface PptsPanelBridges {
  /** 任务数据面（既有 api）：POST /super-ppts/api/<method>（tasks.list / tasks.get / …）。 */
  api(method: string, body?: unknown): Promise<unknown>
  /**
   * Task 3 的最小桥（真实形态 = lib/client.js 的 `function createTask(input)`）：
   * 只做任务落盘 `api('tasks.create', { title, brief, workspace })`，返回
   * `{ task, phase: 'waiting-launch' }`。Task 6 会把它替换成完整的
   * createTaskAndStart（素材上传 → 会话桥 v3 提交 → 状态推进，phase
   * 可为 'started'），**视图层的调用形状与返回语义不变**。
   */
  createTask(input: {
    title: string
    brief: Record<string, unknown>
    workspace: { id: string; name: string; path: string }
    materials?: unknown[]
  }): Promise<{ task: unknown; phase: 'started' | 'waiting-launch'; message?: string }>
  /** Task 5 已交付：素材原始流式上传（POST /super-ppts/tasks/upload?taskId=&name=）。 */
  uploadMaterial?(taskId: string, file: { name?: string; size?: number }): Promise<{ name: string; size: number; path: string }>
  /** Task 6 实现：会话桥 v3（定位会话 → setDraft → submit，任务自动启动）。 */
  sendToChatV3?: unknown
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
 * 任务创建最小桥（Task 3；真实形态见 lib/client.js 的 `function createTask(input)`）。
 * 只做落盘：`api('tasks.create', { title, brief, workspace })` → 返回
 * `{ task, phase: 'waiting-launch', message: '' }`（如实反映「已落盘但尚未启动」）。
 * **Task 6 用完整的 createTaskAndStart 替换它**（apply 里换注入对象即可，
 * 视图层接口不变）：素材上传 → 会话桥 v3 提交 → 状态推进到 analyzing，
 * phase 置为 'started'。
 */
export function createTask(input: {
  title: string
  brief: Record<string, unknown>
  workspace: { id: string; name: string; path: string }
  materials?: unknown[]
}): Promise<{ task: unknown; phase: 'started' | 'waiting-launch'; message?: string }> {
  return Promise.resolve({ task: null, phase: 'waiting-launch', message: '' })
}

/** 最近任务视图工厂（Task 7 实现；真实形态见 lib/client.js 的 makeRecentView）。 */
export function makeRecentView(
  t: (key: string, params?: Record<string, unknown>) => string,
  options: Record<string, unknown>,
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
 * - sendToChatV3(task, sessionId)：Task 6，定位会话 → conversation.input
 *   .for(actx).setDraft(text) → submit()（任务自动启动，无需回聊天窗口回车）；
 * - createTaskAndStart(input)：Task 6，替换上面的最小桥 createTask。
 * - api(method, body)：既有实现，复用为任务数据面客户端（tasks.* / templates.list）。
 */

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
      // 任务面板壳（makePanelsView(t, { api, createTask })——sendToChatV3 /
      // uploadMaterial 由后续任务实现后注入；createTask 是 Task 3 的最小桥，
      // Task 6 换成完整 createTaskAndStart，真实形态见 lib/client.js）：
      // root 面板接收全局标准 props useWorkspaces（工作区选择行，
      // 选择器用法 useWorkspaces(s => s.items)；旧宿主缺失时行隐藏）。
      function Workbench() { return null },
    )
    return () => { disposePanel(); disposeIcon() }
  })
}
