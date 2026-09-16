/**
 * dsh-super-ppts 原生 Agent 工具（host 侧）。
 *
 * 工具面刻意收敛为 4 个，生成主体由技能层编排（agent 直跑 python / 写 HTML）：
 * - ppts_check     ：环境自检（Python 3 / pptx-designer / 渲染链），输出结构化报告。
 * - ppts_render    ：PPTX → PDF → PNG 渲染验收（跨平台，soffice 优先 / Win COM 可选）。
 * - ppts_templates ：模板库与生成偏好查询（设置页数据的 agent 侧唯一读取面）。
 * - ppts_task      ：演示任务状态桥（工作台任务的阶段/大纲确认/产物/失败上报）。
 *
 * 注册形态：dsh tools registry 的 raw definition（plain object，parameters 与
 * output.schema 均为 JSON Schema；output.render 返回 content-block 数组）。
 * 不 import @deepseek-ai/dsh-tools（defineTool）——保持零 npm 依赖红线
 * （github 直装不跑 npm install，host 侧第三方包不可 resolve）。
 *
 * 工程红线：所有外部进程一律 execFile 参数数组（禁 shell 字符串拼接）、带
 * timeout、固定 cwd 到插件包根。
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { packageRoot } from './paths.js';
import { TemplateStoreError, loadRegistry, } from './templates.js';
import { BUILTIN_TEMPLATES } from './builtin-templates.js';
import { TaskStoreError, addArtifact, appendEvent, requireTask, saveOutline, setStatus, updateTask, } from './tasks.js';
export { packageRoot };
const COMPILER_SCRIPT = resolve(packageRoot, 'compiler', 'build_pptx.py');
const RENDER_SCRIPT = resolve(packageRoot, 'skills', 'ppts-pptx', 'scripts', 'render_pptx.py');
const PYTHON_CANDIDATES = [
    { cmd: 'python3', args: [] },
    { cmd: 'python', args: [] },
    { cmd: 'py', args: ['-3'] },
];
function runOne(cmd, args, timeoutMs) {
    return new Promise((resolvePromise) => {
        // maxBuffer 显式放宽（默认 1MB）：--check 报告/渲染输出超长时不至于误判失败
        execFile(cmd, [...args], { timeout: timeoutMs, cwd: packageRoot, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            resolvePromise({ ok: !error, stdout: String(stdout ?? ''), stderr: String(stderr ?? error?.message ?? '') });
        });
    });
}
/** 依次探测候选 Python（py -3 → python3 → python），返回第一个可执行者。 */
export async function findPython() {
    for (const candidate of PYTHON_CANDIDATES) {
        const probe = await runOne(candidate.cmd, [...candidate.args, '--version'], 10_000);
        if (probe.ok && /python/i.test(probe.stdout + probe.stderr))
            return candidate;
    }
    return null;
}
/** 环境自检：委托 compiler/build_pptx.py --check 输出统一报告。 */
export async function runCheck() {
    const python = await findPython();
    if (!python) {
        return { ok: false, message: '未找到可用的 Python 3（已尝试 py -3 / python3 / python）。请安装 Python 3.10+ 后重试。' };
    }
    if (!existsSync(COMPILER_SCRIPT)) {
        return { ok: false, message: `编译桥缺失：${COMPILER_SCRIPT}` };
    }
    const result = await runOne(python.cmd, [...python.args, COMPILER_SCRIPT, '--check'], 120_000);
    const report = (result.stdout + '\n' + result.stderr).trim();
    return {
        ok: result.ok,
        message: result.ok ? '环境自检完成' : '环境自检发现问题（详见 report，可按建议修复后重试）',
        report,
    };
}
/** 渲染验收：PPTX → PDF → PNG，供视觉复核与返工。 */
export async function runRender(params) {
    const pptxPath = resolve(params.pptxPath);
    if (!existsSync(pptxPath)) {
        return { ok: false, message: `PPTX 文件未找到：${pptxPath}` };
    }
    const python = await findPython();
    if (!python) {
        return { ok: false, message: '未找到可用的 Python 3，无法执行渲染验收。' };
    }
    if (!existsSync(RENDER_SCRIPT)) {
        return { ok: false, message: `渲染脚本缺失：${RENDER_SCRIPT}` };
    }
    const args = [...python.args, RENDER_SCRIPT, pptxPath];
    if (params.outDir)
        args.push('--out', resolve(params.outDir));
    const result = await runOne(python.cmd, args, 300_000);
    const output = (result.stdout + '\n' + result.stderr).trim();
    return result.ok
        ? { ok: true, message: '渲染完成，请逐页复核 PNG 后决定交付或返工', output }
        : { ok: false, message: `渲染失败：${output.slice(-500)}` };
}
/** 工具输出的标准 JSON 呈现（content-block 数组）。 */
function jsonRender(_args, value) {
    return [{ type: 'text', text: JSON.stringify(value) }];
}
export const pptsCheckTool = {
    name: 'ppts_check',
    description: 'dsh-super-ppts 环境自检：探测 Python 3.10+ / pptx-designer 库 / PPTX 渲染验收链（soffice + pdftoppm）。' +
        '生成 PPTX 前先调用；缺 pptx-designer 时按报告提示执行 ' +
        '"python3 <插件包根>/compiler/build_pptx.py --ensure-deps" 自动安装。',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    output: {
        schema: {
            type: 'object',
            properties: {
                ok: { type: 'boolean' },
                message: { type: 'string' },
                report: { type: 'string' },
            },
            required: ['ok', 'message'],
        },
        render: jsonRender,
    },
    timeoutMs: 180_000,
    execute: async () => runCheck(),
};
export const pptsRenderTool = {
    name: 'ppts_render',
    description: 'PPTX 渲染验收：把生成的 PPTX 经 LibreOffice + poppler 转成逐页 PNG（PPTX → PDF → PNG），' +
        '供视觉复核与返工闭环。交付级 PPTX 在宣告完成前必须调用本工具并通过视觉复核。',
    parameters: {
        type: 'object',
        properties: {
            pptxPath: { type: 'string', description: '待验收的 PPTX 绝对路径（或相对当前工作目录）' },
            outDir: { type: 'string', description: '可选：PNG 输出目录，缺省为 PPTX 同目录下 render_review/' },
        },
        required: ['pptxPath'],
        additionalProperties: false,
    },
    output: {
        schema: {
            type: 'object',
            properties: {
                ok: { type: 'boolean' },
                message: { type: 'string' },
                output: { type: 'string' },
            },
            required: ['ok', 'message'],
        },
        render: jsonRender,
    },
    timeoutMs: 360_000,
    execute: async (args) => runRender(args),
};
function sizeMbOf(record) {
    return Math.round((record.size / 1024 / 1024) * 100) / 100;
}
function toToolEntry(record, defaultId) {
    return {
        id: record.id,
        name: record.name,
        description: record.description,
        path: record.file,
        sizeMb: sizeMbOf(record),
        uploadedAt: record.uploadedAt,
        isDefault: record.id === defaultId,
    };
}
/** 模板库查询：list 返回全部模板 + 生成偏好 + 内置模板；detail 按 id/名称取单条。 */
export function runTemplates(params = {}) {
    try {
        const registry = loadRegistry();
        if (params.action === 'detail') {
            const key = String(params.id ?? '').trim();
            if (key === '')
                return { ok: false, message: 'action=detail 需要 id（模板 id 或名称）' };
            const lowered = key.toLowerCase();
            const record = registry.templates.find(item => item.id === key || item.name.toLowerCase() === lowered);
            if (!record)
                return { ok: false, message: `模板不存在：${key}（用 action=list 查看全部）` };
            return { ok: true, message: `模板「${record.name}」`, template: toToolEntry(record, registry.defaultTemplate) };
        }
        const templates = registry.templates.map(item => toToolEntry(item, registry.defaultTemplate));
        const result = {
            ok: true,
            message: templates.length === 0 ? '模板库为空' : `共 ${templates.length} 个模板`,
            count: templates.length,
            prefs: registry.prefs,
            templates,
            builtinTemplates: BUILTIN_TEMPLATES,
        };
        // 未设置默认模板时字段整体缺省（dsh-tools schema 子集不支持 type 数组，
        // defaultTemplate 声明为 object，不能落 null；isDefault 标志始终可判断）。
        const defaultEntry = templates.find(item => item.isDefault);
        if (defaultEntry)
            result.defaultTemplate = defaultEntry;
        if (templates.length === 0) {
            result.hint = '模板库为空：请到 Web 设置页「演示文稿」上传 .pptx 模板并命名；之后用户即可说「按模板名制作」';
        }
        return result;
    }
    catch (error) {
        const message = error instanceof TemplateStoreError ? error.message : String(error);
        return { ok: false, message: `模板库读取失败：${message}` };
    }
}
export const pptsTemplatesTool = {
    name: 'ppts_templates',
    description: '查询用户模板库与生成偏好（Web 设置页「演示文稿」维护的数据）。' +
        'list：全部模板（名称/id/绝对路径/描述/是否默认）+ 偏好（默认交付形态/渲染验收策略/输出目录/风格备注）；' +
        'detail：按 id 或名称取单条。' +
        '用户要求「按模板 X 制作 / 用我的模板」或 Brief 涉及模板时必须先调用本工具拿路径；' +
        '模板化 PPTX 用技能线 VI Build 路径（以模板为基底 Presentation(path)）。'
        + '返回中的 builtinTemplates 为插件内置模板（source=builtin，随插件版本提供，不可删除）；'
        + 'templates 为用户上传模板（source=user 口径，见各自 isDefault）。',
    parameters: {
        type: 'object',
        properties: {
            action: { type: 'string', enum: ['list', 'detail'], description: 'list（默认）=全部模板+偏好；detail=单条' },
            id: { type: 'string', description: 'action=detail 时必填：模板 id 或名称（精确，不区分大小写）' },
        },
        required: [],
        additionalProperties: false,
    },
    output: {
        schema: {
            type: 'object',
            properties: {
                ok: { type: 'boolean' },
                message: { type: 'string' },
                count: { type: 'number' },
                defaultTemplate: { type: 'object', description: '默认模板条目；未设置默认时本字段不出现（templates[].isDefault 亦可判断）' },
                prefs: { type: 'object' },
                templates: { type: 'array', items: { type: 'object' } },
                builtinTemplates: { type: 'array', items: { type: 'object' }, description: '插件内置模板（source=builtin，无 .pptx 基底，由技能线按大纲生成）' },
                template: { type: 'object' },
                hint: { type: 'string' },
            },
            required: ['ok', 'message'],
        },
        render: jsonRender,
    },
    timeoutMs: 10_000,
    execute: async (args) => runTemplates(args),
};
/** 阶段键 → 任务状态（面板据此渲染阶段时间线）。 */
const STAGE_STATUS = {
    analyzing: 'analyzing',
    planning: 'analyzing',
    building: 'building',
    reviewing: 'reviewing',
};
/** 任务状态桥：Agent 上报阶段/大纲/产物/补充/失败，或读取当前确认状态。 */
export function runTask(params) {
    const taskId = String(params?.taskId ?? '').trim();
    if (taskId === '')
        return { ok: false, message: '缺少 taskId（取工作台 Brief 中的「任务 ID」）' };
    try {
        const task = requireTask(taskId);
        switch (params.action) {
            case 'stage': {
                const key = String(params.stageKey ?? '').trim();
                if (key === '')
                    return { ok: false, message: 'action=stage 需要 stageKey' };
                const next = updateTask(taskId, {
                    stage: {
                        key,
                        index: Number(params.stageIndex ?? 0),
                        total: Number(params.stageTotal ?? 0),
                        detail: params.detail === undefined ? undefined : String(params.detail),
                    },
                });
                const mapped = STAGE_STATUS[key];
                const withStatus = mapped === undefined ? next : setStatus(taskId, mapped);
                return {
                    ok: true,
                    message: `阶段已上报：${key}`,
                    taskId,
                    status: withStatus.status,
                    outlineVersion: withStatus.outlineVersion,
                    confirmedOutlineVersion: withStatus.confirmedOutlineVersion ?? 0,
                };
            }
            case 'outline': {
                const saved = saveOutline(taskId, Array.isArray(params.pages) ? params.pages : []);
                return {
                    ok: true,
                    message: `大纲已记录（v${saved.outlineVersion}，${saved.outline?.pages.length ?? 0} 页）。`
                        + '请立即停止后续生成，等待用户在工作台确认大纲后再继续（不要先生成 PPTX/HTML）。',
                    taskId,
                    status: saved.status,
                    outlineVersion: saved.outlineVersion,
                    confirmedOutlineVersion: saved.confirmedOutlineVersion ?? 0,
                    pageCount: saved.outline?.pages.length ?? 0,
                };
            }
            case 'artifact': {
                const type = params.artifactType;
                const path = String(params.artifactPath ?? '').trim();
                if (type !== 'pptx' && type !== 'pdf' && type !== 'html') {
                    return { ok: false, message: 'action=artifact 需要 artifactType（pptx / pdf / html）' };
                }
                if (path === '')
                    return { ok: false, message: 'action=artifact 需要 artifactPath' };
                const saved = addArtifact(taskId, { type, path, status: 'ready' });
                return { ok: true, message: `产物已登记：${type} → ${path}`, taskId, status: saved.status };
            }
            case 'needs-input': {
                const question = String(params.question ?? '').trim();
                if (question === '')
                    return { ok: false, message: 'action=needs-input 需要 question' };
                appendEvent(taskId, 'needs-input', question);
                const saved = setStatus(taskId, 'needs-input');
                return { ok: true, message: `已请求用户补充：${question}`, taskId, status: saved.status };
            }
            case 'fail': {
                const reason = String(params.reason ?? '').trim();
                if (reason === '')
                    return { ok: false, message: 'action=fail 需要 reason' };
                // 先转失败状态再压原因：setStatus 自身会追加一条「状态 → failed」事件，
                // 若反序则原因不是最后一条——面板「最近事件」直接展示原因更有用。
                setStatus(taskId, 'failed');
                const failed = appendEvent(taskId, 'fail', reason);
                return { ok: true, message: `已记录失败：${reason}（可重试当前阶段）`, taskId, status: failed.status };
            }
            case 'get':
            default:
                return {
                    ok: true,
                    message: task.status === 'waiting-outline'
                        ? '大纲尚未确认：请等待用户在工作台确认后再继续生成。'
                        : `任务状态：${task.status}`,
                    taskId,
                    status: task.status,
                    outlineVersion: task.outlineVersion,
                    confirmedOutlineVersion: task.confirmedOutlineVersion ?? 0,
                    pageCount: task.outline?.pages.length ?? 0,
                };
        }
    }
    catch (error) {
        const message = error instanceof TaskStoreError ? error.message : String(error);
        return { ok: false, message: `任务状态桥失败：${message}` };
    }
}
export const pptsTaskTool = {
    name: 'ppts_task',
    description: '演示任务状态桥（工作台创建的任务专用）。当 Brief 中带有「任务 ID：<id>」时必须使用本工具：' +
        'action=stage 上报阶段（analyzing/planning/building/reviewing）；' +
        'action=outline 提交页面大纲（{title,purpose,bullets,pageType}[]）——提交后任务转入「等待确认大纲」，' +
        '你必须立即停止后续生成，等用户在工作台确认；' +
        'action=get 读取当前状态与 confirmedOutlineVersion（收到「大纲已确认」消息后可先用它核对）；' +
        'action=artifact 登记产物路径；action=needs-input 请求用户补充信息；action=fail 记录失败原因与可恢复动作。',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['stage', 'outline', 'artifact', 'needs-input', 'fail', 'get'],
                description: 'stage=上报阶段；outline=提交大纲并停下等确认；artifact=登记产物；needs-input=请求补充；fail=记录失败；get=读取状态',
            },
            taskId: { type: 'string', description: '任务 id（Brief 中的「任务 ID」）' },
            stageKey: { type: 'string', description: 'action=stage：阶段键（analyzing / planning / building / reviewing）' },
            stageIndex: { type: 'number', description: 'action=stage：当前阶段序号（从 1 起）' },
            stageTotal: { type: 'number', description: 'action=stage：阶段总数' },
            detail: { type: 'string', description: 'action=stage：当前阶段的具体说明（面板会展示）' },
            pages: { type: 'array', items: { type: 'object' }, description: 'action=outline：页面数组，每页 {id?,title,purpose?,bullets?,pageType?}' },
            artifactType: { type: 'string', enum: ['pptx', 'pdf', 'html'], description: 'action=artifact：产物类型' },
            artifactPath: { type: 'string', description: 'action=artifact：产物绝对路径' },
            question: { type: 'string', description: 'action=needs-input：需要用户回答的问题' },
            reason: { type: 'string', description: 'action=fail：失败原因（面板展示并可重试）' },
        },
        required: ['action', 'taskId'],
        additionalProperties: false,
    },
    output: {
        schema: {
            type: 'object',
            properties: {
                ok: { type: 'boolean' },
                message: { type: 'string' },
                taskId: { type: 'string' },
                status: { type: 'string' },
                outlineVersion: { type: 'number' },
                confirmedOutlineVersion: { type: 'number' },
                pageCount: { type: 'number' },
            },
            required: ['ok', 'message'],
        },
        render: jsonRender,
    },
    timeoutMs: 10_000,
    execute: async (args) => runTask(args),
};
