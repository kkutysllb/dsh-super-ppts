/**
 * DSH Web GUI Client Extension for dsh-super-ppts.
 *
 * BUILD NOTE: dsh's client module loader expects a specific bundle shape.
 * This file is HAND-MAINTAINED (not produced by tsc): the compiled output
 * must self-register via `window.__ModuleLoader__.load({ id, factory })`,
 * expose its extension via `exports.apply`, and `return module.exports`.
 * A bare ES-module `export` will not register and triggers:
 *   "bundle .../client.js loaded without registering \"dsh-super-ppts\" via __ModuleLoader__.load"
 *
 * APPLY NOTE: `apply` receives a Cordis context (`ctx`). Accessing any Cordis
 * service on `ctx` requires declaring the matching runtime package in
 * package.json -> dsh.client.inject first. This plugin intentionally keeps
 * `apply` a no-op: delivery happens host-side (skills + CLI tools), not via
 * client commands. Add a UI entry later via `ctx.slots.inject(...)` and list
 * the matching runtime packages in `dsh.client.inject` first.
 */
window.__ModuleLoader__.load({
	id: "dsh-super-ppts",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		function apply(ctx) {
			console.log('[dsh-super-ppts] Client extension loaded');
			// Intentional no-op: delivery is host-side (skills + CLI tools).
			// See APPLY NOTE before adding any ctx.* usage.
		}

		exports.apply = apply;
		exports.default = { apply };
		return module.exports;
	}
});
