# Security Audit — Host Plugin (TS)

**Scope**: `/Users/libing/kk_Projects/dsh-super-ppts/src/{index,tools,routes,tasks,templates,paths,builtin-templates}.ts` + `cordis.patch.yml`
**Mode**: READ-ONLY (no source modification)
**Auditor**: dsh-harness subagent
**Date**: 2026-10-01

**修复状态（2026-10-09 补注）**: M1–M5 已在 v1.5.0 全量修复（见 `release/v1.5.0.md`）；
L1、L3、I1、I2 属纵深防御 / 设计取舍项，L2、L4 经复核为「写法本就正确」，均无待办。
本文件是 `src/routes.ts`、`src/templates.ts`、`scripts/smoke-plugin.mjs` 中
「security-audit-host M1–M5」注释所引用的来源记录，故随仓库保留。

## Summary

- **Total findings**: 11 (Critical 0, High 0, Medium 5, Low 4, Info 2)
- **Top risks**:
  1. `deleteTemplate` uses `record.file` from registry for `rmSync` — registry poisoning (write access to `~/.dsh/super-ppts/registry.json`) yields arbitrary file deletion. Defense-in-depth: file path is not re-validated against `TEMPLATE_DIR` at delete time.
  2. `prefs.outputDir` accepts up to 500 chars of free-form path text without canonicalization or containment check; persisted verbatim and returned to the Agent, which can be steered (by prompt injection) into writing generated PPTX/HTML to attacker-chosen directories.
  3. No CSRF/origin check on `POST /super-ppts/api/*` — Host-header loopback + `trustedHosts` whitelist is the only barrier. Acceptable for loopback deployments; risky for non-loopback trustedHosts setups.
  4. Upload `name`/`description` and `prefs.styleNotes` are stored raw into JSON and reflected through `ppts_templates` to the Agent — XSS posture depends entirely on the (out-of-scope) client escaping.
  5. `ppts_render.outDir` accepts any path — Agent can ask soffice to write the rendered PDF into arbitrary filesystem locations (e.g. `/etc/cron.d/`). Documented Agent capability, but no containment guard.

**No issues found** in: command-injection (all spawns use `execFile` with arrays, no shell), SSRF (no outbound `fetch`/`http`/`https` calls in audited files), direct user-input → argv injection (all argv come from validated IDs or sanitized filenames).

---

## Findings

### [Medium] deleteTemplate trusts registry.file without re-validating containment

- **Location**: `src/templates.ts:347-356` (deleteTemplate); related: `src/templates.ts:205-212` (reanchorRecord)
- **Evidence**:
  ```ts
  // deleteTemplate — registry.file flows directly to rmSync
  try { rmSync(record.file, { force: true }) } catch { /* 清单已一致，文件清理尽力而为 */ }
  ```
  ```ts
  // reanchorRecord — trusts registry.file if it exists on disk
  if (!force && typeof record.file === 'string' && record.file !== '' && existsSync(record.file)) return record
  ```
- **Why it's a vulnerability**: Registry entries loaded from `registry.json` carry an absolute `file` path used verbatim for deletion. `reanchorRecord` preserves an arbitrary pre-existing absolute path that happens to resolve to a real file. An attacker with write access to `registry.json` (e.g. compromised sibling plugin, malicious web request that already crosses the fence, or local FS attacker) can plant `{ id, file: "/etc/important.conf" }` and then invoke `templates.delete(id)` to force `rmSync("/etc/important.conf", {force:true})`. The fence requirement for `/super-ppts/api/templates.delete` raises the bar, but defense-in-depth still fails. `addTemplate` and `renameTemplate` keep `file` inside `TEMPLATE_DIR` by construction — only `deleteTemplate` skips the re-check.
- **Fix**: In `deleteTemplate`, recompute the deletion target as `join(TEMPLATE_DIR, ${record.id}.pptx)` and refuse to delete if `record.file !== target`. Symmetrically, harden `reanchorRecord` to reject any path whose `path.resolve()` does not start with `path.resolve(TEMPLATE_DIR)`.
- **CWE**: CWE-22 (Path Traversal) / CWE-73 (External Control of File Name or Path).

### [Medium] prefs.outputDir accepted with no canonicalization or containment check

- **Location**: `src/templates.ts:496-500`
- **Evidence**:
  ```ts
  if (input.outputDir !== undefined) {
    const value = String(input.outputDir).trim()
    if (value.length > 500) throw new TemplateStoreError('bad-request', 'outputDir 过长（≤ 500 字符）')
    next.outputDir = value
  }
  ```
- **Why it's a vulnerability**: `outputDir` is persisted verbatim into `registry.json` and returned through `ppts_templates` to the Agent, which uses it as the working/output directory for skill output. A user (or a malicious request that crossed the fence) can set this to any path the host process can write to (e.g. `/etc/cron.d/`, `/var/spool/cron/`, arbitrary deep paths). Once stored, it influences every subsequent skill invocation until the user resets it. No `~` expansion, no `path.resolve`, no containment check.
- **Fix**: When storing, run `path.resolve(outputDir)`; at read/consume time the Agent should re-validate. Optionally enforce the path starts under `$HOME` or `$DSH_HOME`. At minimum, log when `outputDir` is an absolute path or contains path-traversal segments.
- **CWE**: CWE-22 / CWE-732 (Incorrect Permission Assignment for Critical Resource).

### [Medium] POST JSON routes rely solely on Host-header fence — no CSRF/origin check

- **Location**: `src/routes.ts:95-106` (`fenceRequest`); applied at `routes.ts:313, 341, 368, 402`
- **Evidence**:
  ```ts
  export function fenceRequest(req: IncomingMessage, trustedHosts: readonly string[]): boolean {
    const host = req.headers.host
    if (typeof host !== 'string' || host === '') return false
    let authority: URL
    try { authority = new URL(`http://${host}`) } catch { return false }
    if (isLoopbackHostname(authority.hostname)) return true
    return trustedHosts.some(entry => entry === host || entry === authority.hostname)
  }
  ```
- **Why it's a vulnerability**: No `Origin` / `Referer` / `Sec-Fetch-Site` validation. No CORS headers are emitted (verified via grep — no `access-control-allow-origin` in src/), so cross-origin XHR/fetch from a browser would be blocked by preflight for state-changing JSON. However, a malicious page can still drive `<form method=POST enctype=text/plain action=/super-ppts/api/prefs.update>` cross-origin with no preflight; the response body is opaque to the attacker, yet the *state change succeeds* (CSRF). The impact is bounded to mutating the user's own template registry / task store (templates.delete, prefs.update, tasks.delete, tasks.outline, tasks.confirmOutline, tasks.materialDelete, tasks.materialStatus). For loopback deployments this is moot (cross-origin pages cannot reach `127.0.0.1`), but the design allows non-loopback `trustedHosts` and the README at line 159 markets `/super-ppts/*` as "behind a trust fence" — a CSRF token would be cheap insurance.
- **Fix**: Accept `application/json` content-type (already implicit) and require `Origin` header to match the trusted host on state-changing methods; OR emit a CSRF token cookie and require it in JSON body. Document this as a known limitation for non-loopback deployments if no fix is applied.
- **CWE**: CWE-352 (Cross-Site Request Forgery).

### [Medium] Free-form template name/description and styleNotes stored and reflected without sanitization

- **Location**: `src/templates.ts:133-148` (`validateName`, `validateDescription`); `src/templates.ts:501-505` (`styleNotes`); write path at `routes.ts:351-354`, read at `tools.ts:232-242`
- **Evidence**:
  ```ts
  export function validateName(raw: string): string {
    const name = String(raw ?? '').trim()
    if (name.length === 0) throw new TemplateStoreError('bad-request', '模板名称不能为空')
    if (name.length > NAME_MAX) throw new TemplateStoreError('bad-request', `模板名称过长（≤ ${NAME_MAX} 字符）`)
    return name
  }
  ```
- **Why it's a vulnerability**: `name`, `description`, and `styleNotes` accept any Unicode except only length is enforced; no control-character or markup filtering. They are returned to the Agent verbatim via `ppts_templates` and via `tasks.brief.*` flows. If the (out-of-scope) client renders any of these fields as HTML (rather than text), the host provides no defense-in-depth. Even without client XSS, prompt-injection vectors for the Agent grow when free-form text is round-tripped into Agent context. The `prefs.styleNotes` field is explicitly used as a global style guidance — an attacker who can write the registry can inject persistent prompt-influence.
- **Fix**: Strip control chars (`\u0000-\u001f\u007f`) at validation time; document the responsibility split between host and client for HTML escaping; consider rate-limiting settings writes.
- **CWE**: CWE-79 (Cross-site Scripting, defense-in-depth) / CWE-94 (Code Injection, prompt-injection variant).

### [Medium] ppts_render outDir accepts any resolved path (Agent capability, but no host guardrail)

- **Location**: `src/tools.ts:114-133` (`runRender`)
- **Evidence**:
  ```ts
  export async function runRender(params: PptsRenderParams): Promise<PptsRenderResult> {
    const pptxPath = resolve(params.pptxPath)
    ...
    const args = [...python.args, RENDER_SCRIPT, pptxPath]
    if (params.outDir) args.push('--out', resolve(params.outDir))
  ```
- **Why it's a vulnerability**: `outDir` flows from the Agent into `execFile` argv after `path.resolve` against process cwd — no containment check. soffice will write a `.pdf` derived from `pptxPath`'s basename into `outDir`. An Agent driven by prompt injection could direct the renderer to drop a file into any directory the host user can write (e.g. cron spool, autostart, shell rc). This is *the documented capability* of `ppts_render` — the Agent picks the output location — so this is not a bug per se, but the host has no defense-in-depth (e.g. refusing writes outside `$HOME`, or requiring `outDir` to be an existing subdirectory of cwd).
- **Fix**: Document the trust boundary explicitly. Optionally refuse `outDir` paths that traverse symlinks, or paths that don't satisfy `realpath(outDir).startsWith(realpath(process.cwd()))`.
- **CWE**: CWE-22 / CWE-73.

### [Low] tasks.update brief merge via Object.entries + bracket assignment — theoretical prototype-pollution surface

- **Location**: `src/tasks.ts:532-549`
- **Evidence**:
  ```ts
  const merged: Record<string, unknown> = { ...task.brief }
  for (const [key, value] of Object.entries(patch.brief)) {
    if (value === undefined) continue
    merged[key] = value
  }
  ```
- **Why it's a vulnerability**: `Object.entries(JSON.parse(...))` does include `__proto__` as an own enumerable key (V8 sets it as a normal own property, not via the prototype setter). Then `merged['__proto__'] = value` invokes the `__proto__` setter, which mutates the prototype of `merged` itself (not `Object.prototype`). Because the merge target is a freshly-spread object, the mutation is local and does not persist across JSON serialization (JSON.stringify omits the `__proto__` accessor). So full `Object.prototype` pollution is **not exploitable** through this code path. The path is still worth flagging because a future change (e.g. deep merge or recursive spread) could escalate this to real pollution. No CVE today; defense-in-depth only.
- **Fix**: Filter keys explicitly: `if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;`. Or use `Object.create(null)` for `merged`.
- **CWE**: CWE-1321 (Improperly Controlled Modification of Object Prototype — defense-in-depth).

### [Low] thumb route id-validator stricter than thumbFileFor — but id flows from URL path

- **Location**: `src/templates.ts:281-288` (`thumbFileFor`); `src/routes.ts:377-378`
- **Evidence**:
  ```ts
  export function thumbFileFor(id: string): string | null {
    if (!/^[a-z0-9]+$/.test(id)) return null
    for (const ext of ['jpg', 'png'] as const) {
      const candidate = join(TEMPLATE_DIR, `${id}.thumb.${ext}`)
      if (existsSync(candidate)) return candidate
    }
    return null
  }
  ```
- **Why it's a vulnerability**: `thumbFileFor` correctly enforces `/^[a-z0-9]+$/` before joining — good. The route reads `pathname.slice('/super-ppts/templates/thumb/'.length)` then `decodeURIComponent` and passes to `thumbFileFor`, which rejects non-conforming ids. No path traversal possible. Noted for completeness; behavior is correct.
- **Fix**: None required. Keep the regex.
- **CWE**: N/A.

### [Low] Internal error log may include user-controlled paths/values

- **Location**: `src/routes.ts:151-153`
- **Evidence**:
  ```ts
  // 未知异常不回传 message（可能含绝对路径等内部细节）：详情只进 host 日志
  console.error('[dsh-super-ppts] internal error:', error)
  ```
- **Why it's a vulnerability**: Internal exception messages (which may contain `pptxPath`, `taskId`, `materialId`, etc. from user requests) are written to `console.error`. The host intentionally does NOT echo them to the client (good — see the comment). Log injection via newlines in user-controlled paths could forge additional log lines, but the impact is limited to host-side operators. Low.
- **Fix**: Sanitize strings before logging (replace `\n`/`\r`).
- **CWE**: CWE-117 (Improper Output Neutralization for Logs).

### [Low] TOCTOU window during template upload (`.part` → rename)

- **Location**: `src/templates.ts:516-557` (`writeUploadTemp`); `src/templates.ts:399-413` (`addTemplate`)
- **Evidence**:
  ```ts
  const tmp = join(TEMPLATE_DIR, `upload-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.part`)
  const fd = openSync(tmp, 'wx')
  ...
  return tmp
  // ... later, addTemplate does: renameSync(tmpFile, finalPath)
  ```
- **Why it's a vulnerability**: The `.part` file is opened with `O_EXCL` (good — race-free create), but between `closeSync` and `renameSync(tmp, finalPath)` in `addTemplate`, the tmp file is a fully-named but pre-final-state file inside `TEMPLATE_DIR`. A same-process concurrent request to `ppts_render` reading `templates/<id>.pptx` would not see it (different filename), so no direct exploit surface. However, if `TEMPLATE_DIR` were ever shared (e.g. symlink), the tmp could be observed between stages. Acceptable as written because `wx` + atomic rename protects the file identity. Noted for completeness.
- **Fix**: None required. The `wx` + atomic-rename pattern is correct.
- **CWE**: N/A.

### [Info] prefs.styleNotes is a documented prompt-influence vector

- **Location**: `src/templates.ts:501-505`; reflected in `ppts_templates` tool output
- **Evidence**:
  ```ts
  if (input.styleNotes !== undefined) {
    const value = String(input.styleNotes)
    if (value.length > 2000) throw new TemplateStoreError('bad-request', 'styleNotes 过长（≤ 2000 字符）')
    next.styleNotes = value
  }
  ```
- **Why it's a vulnerability**: This is an explicit design choice ("风格偏好备注（自由文本，agent 的全局审美基线）"). Any actor crossing the fence can persistently inject 2000 chars of prompt-influence text that travels with every `ppts_templates` call. Worth knowing, not a host bug.
- **Fix**: Document the trust assumption; consider surfacing edits in a confirmation step.
- **CWE**: CWE-94 (prompt-injection variant).

### [Info] ppts_render pptxPath accepts arbitrary resolved file (by Agent design)

- **Location**: `src/tools.ts:114-127`
- **Evidence**:
  ```ts
  const pptxPath = resolve(params.pptxPath)
  if (!existsSync(pptxPath)) return { ok: false, message: `PPTX 文件未找到：${pptxPath}` }
  ...
  const args = [...python.args, RENDER_SCRIPT, pptxPath]
  ```
- **Why it's a vulnerability**: The Agent (a trusted caller within the same process) can ask the renderer to read any file readable by the host user, then return its rendering error/output. Since the Agent is trusted, this is by design. No issue.
- **Fix**: N/A. Document the trust boundary.
- **CWE**: N/A.

---

## Notes on Stated Guarantees

| Stated invariant | Status | Evidence |
|---|---|---|
| **Zero npm dependencies** | **Confirmed** | `package.json` declares only `@types/node` and `typescript` as `devDependencies`; `peerDependencies` only `@deepseek-ai/dsh*` (optional peer set). Audited `.ts` files import exclusively `node:*` modules (`node:fs`, `node:os`, `node:path`, `node:child_process`, `node:zlib`, `node:http` types) and local relative modules. No third-party runtime imports. |
| **All external process calls use `execFile` with array argv, no shell string concat** | **Confirmed** | `tools.ts:61` (`runOne`) and `templates.ts:350,358` (soffice, pdftoppm) all use `execFile` with array argv, no `shell: true`, no `exec`, no string-template argv. `cwd` is set explicitly to `packageRoot` for `tools.ts`. |
| **Route surface = `/super-ppts/*` only** | **Confirmed** | `routes.ts` registers exactly four routes: `/super-ppts/api` (prefix), `/super-ppts/upload` (exact), `/super-ppts/templates/thumb` (prefix), `/super-ppts/tasks/upload` (exact). No additional routes. No `app.listen()` / port binding — README claim "zero local services" is upheld by the audited code (no `net.Server`, `createServer` only as type imports). |
| **Trust fence on `/super-ppts/*`** | **Confirmed present, but not authentication** | `routes.ts:95` `fenceRequest` checks Host header loopback + `trustedHosts` whitelist. README at line 159 explicitly documents this as anti-DNS-rebind / cross-site defense, not authentication. Acceptable for stated trust model. |
| **Atomic writes (tmp + rename)** | **Confirmed** | `templates.ts:252-257` (`saveRegistry`), `templates.ts:219-225` (`writeJsonAtomic`), `tasks.ts:220-225` (`writeJsonAtomic`), `templates.ts:409-412` (template file rename), `tasks.ts:709-710` (`openSync(target, 'wx')`). All write paths use atomic patterns. |
| **JSON parse safety** | **Mostly safe** | `JSON.parse` is used at `templates.ts:223`, `tasks.ts:260`, `tasks.ts:388`, `routes.ts:121`. No `eval`, no `new Function`. Prototype pollution from `__proto__` keys is mitigated by the fact that bracket-assignment only mutates the target object's prototype (not `Object.prototype`); flagged as defense-in-depth in finding L1. |
| **YAML patch safety (`cordis.patch.yml`)** | **Confirmed minimal** | `cordis.patch.yml` is 4 lines: a list with one `insert` entry declaring the plugin id and name. No regex, no user input, no parse-hostile constructs. |

---

## Threat-by-Category Coverage

| Category | Status |
|---|---|
| 1. Command injection / shell escape | No issues found. All spawns are `execFile` with arrays. |
| 2. Path traversal | Defense-in-depth gaps in `deleteTemplate` (M1) and `prefs.outputDir` (M2). |
| 3. SSRF | No issues found. No outbound network calls in audited files (verified by absence of `fetch`/`http`/`https`/`net` runtime use). |
| 4. Input validation on tool args | Mostly validated; `prefs.outputDir` and `prefs.styleNotes` weak (M2 / Info). |
| 5. Privilege / capability mismatch | `ppts_render` and `ppts_task` surfaces match README description. |
| 6. Secret / config leakage | Only `process.env.{QILIN_HOME,DSH_HOME}` are read (intentional). No secret material. |
| 7. Filesystem safety | `wx` + atomic rename used consistently. `rmSync(...,{force:true})` only on paths derived from validated ids, except `deleteTemplate.record.file` (M1). |
| 8. HTTP route auth/authz | Host-header fence only (M3). |
| 9. JSON ops safety | Safe; one theoretical proto-pollution vector (L1). |
| 10. `cordis.patch.yml` | No issues found (4-line minimal declaration). |