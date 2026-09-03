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
 * APPLY NOTE：访问 ctx.slots / ctx.locale 需要两处同时声明——
 * - exports.inject = ['slots', 'locale']（cordis 服务名）；
 * - package.json → dsh.client.inject 列出对应 runtime 包
 *   （@deepseek-ai/dsh-client-locale、@deepseek-ai/dsh-client-ui-slots、
 *   @deepseek-ai/dsh-client-ui-settings）。
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
  effect(fn: () => () => void, name?: string): () => void
}

/** 必需服务（cordis fiber inject）。 */
export const inject = ['slots', 'locale']

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

/** 挂载设置页「演示文稿」区块。 */
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
}
