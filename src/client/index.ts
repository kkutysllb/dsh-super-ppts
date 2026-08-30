/**
 * DSH Web GUI Client Extension for dsh-super-ppts（类型参考）。
 *
 * BUILD NOTE（重要）：`lib/client.js` 是手写的自注册产物，不由 tsc 生成。
 * dsh 的 client 模块加载器要求特定 bundle 形态——编译物必须经
 * `window.__ModuleLoader__.load({ id, factory })` 自注册、经 `exports.apply`
 * 暴露扩展并 `return module.exports`；裸 ESM `export` 不会注册，触发：
 *   "bundle .../client.js loaded without registering \"dsh-super-ppts\" via __ModuleLoader__.load"
 * 因此任何 client 侧改动请直接编辑 `lib/client.js`（保持自注册壳不变）。
 *
 * APPLY NOTE：`apply` 收到的是 Cordis context（ctx）。访问任何 Cordis 服务
 * （如 ctx.slots / ctx.locale）必须先在 package.json → dsh.client.inject 里
 * 声明对应 runtime 包，否则抛 "cannot get property \"X\" without inject"。
 * 本插件的交付面全部在 host 侧（技能 + CLI 工具），client 有意保持 no-op。
 */
export function apply(ctx: unknown): void {
  console.log('[dsh-super-ppts] Client extension loaded')
  // Intentional no-op：见 APPLY NOTE。加 UI 入口前先补 inject 声明。
}

export default { apply }
