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
  // 0.1.5 左侧栏原生接入:panellist 图标行 + main keyed 工作台主面板
  // （makeWorkbenchComponent,真实形态见 lib/client.js）;宿主 ≤0.1.4 软回退。
  ctx.slots.inject('sidebar.panellist', () => {
    const disposeIcon = ctx.slots.register(
      { name: 'sidebar.panellist', id: 'super-ppts-panel', order: 100, label: () => t('nav'), locale: 'superPpts' },
      function PanelIcon() { return null },
    )
    const disposePanel = ctx.slots.register(
      { name: 'main', key: 'super-ppts-panel' },
      // 工作台组件（makeWorkbenchComponent，真实形态见 lib/client.js）：
      // root 面板接收全局标准 props useWorkspaces（工作区选择行，
      // 选择器用法 useWorkspaces(s => s.items)；旧宿主缺失时行隐藏）。
      function Workbench() { return null },
    )
    return () => { disposePanel(); disposeIcon() }
  })
}
