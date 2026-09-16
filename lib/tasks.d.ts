/** 任务存储根（与模板库同属插件存储根；DSH_HOME 口径见 templates.ts）。 */
export declare const TASKS_ROOT: string;
export declare const TASK_INDEX_FILE: string;
/** 任务标题长度上限（索引每次列表都读标题，超长标题会撑大索引）。 */
export declare const TITLE_MAX = 120;
/** 任务主题长度上限。 */
export declare const TOPIC_MAX = 500;
/** 持久化状态白名单（`draft` 是面板内存态，不入库；见规格「状态 → 恢复落点」）。 */
export declare const TASK_STATUSES: readonly ["creating", "waiting-launch", "analyzing", "waiting-outline", "needs-input", "building", "reviewing", "completed", "failed", "cancelled"];
export type TaskStatus = (typeof TASK_STATUSES)[number];
/** 交付形态白名单。 */
export declare const TASK_FORMATS: readonly ["pptx", "html"];
export type TaskFormat = (typeof TASK_FORMATS)[number];
export interface TaskMaterial {
    id: string;
    name: string;
    size: number;
    /** 素材绝对路径（TASKS_ROOT 之下）。 */
    path: string;
    status: 'uploading' | 'ready' | 'error';
    error?: string;
}
export interface OutlinePage {
    id: string;
    title: string;
    purpose?: string;
    bullets: string[];
    pageType?: string;
}
export interface Outline {
    version: number;
    pages: OutlinePage[];
}
export interface TaskArtifact {
    type: 'pptx' | 'pdf' | 'html';
    path: string;
    status: 'ready' | 'missing' | 'error';
}
export interface TaskEvent {
    at: string;
    kind: string;
    text: string;
}
export interface TaskBrief {
    topic: string;
    audience?: string;
    scenario?: string;
    pageCount?: string;
    format: TaskFormat;
    /** null = 明确不使用模板；undefined/缺省 = 跟随设置页默认模板。 */
    templateId?: string | null;
    templateName?: string;
    templateSource?: 'builtin' | 'user';
    templateFingerprint?: string;
    style?: string;
    styleNotes?: string;
    outputDir?: string;
    renderReview?: string;
}
export interface TaskWorkspace {
    id: string;
    name: string;
    path: string;
}
export interface TaskStage {
    key: string;
    index: number;
    total: number;
    detail?: string;
}
export interface TaskRecord {
    id: string;
    title: string;
    status: TaskStatus;
    stage?: TaskStage;
    workspace: TaskWorkspace;
    sessionId?: string;
    brief: TaskBrief;
    materials: TaskMaterial[];
    outline?: Outline;
    outlineVersion: number;
    confirmedOutlineVersion?: number;
    events: TaskEvent[];
    artifacts: TaskArtifact[];
    createdAt: string;
    updatedAt: string;
}
/** 索引条目：列表渲染只读它，避免逐任务读盘。 */
export interface TaskIndexEntry {
    id: string;
    title: string;
    status: TaskStatus;
    format: TaskFormat;
    workspaceId: string;
    workspaceName: string;
    createdAt: string;
    updatedAt: string;
}
interface TaskIndex {
    tasks: TaskIndexEntry[];
}
export declare class TaskStoreError extends Error {
    readonly code: 'bad-request' | 'not-found' | 'fs-error';
    constructor(code: 'bad-request' | 'not-found' | 'fs-error', message: string);
}
export declare function newTaskId(): string;
/** 校验并返回安全 taskId。 */
export declare function assertTaskId(id: string): string;
export declare function taskDir(id: string): string;
export declare function taskFile(id: string): string;
export declare function materialsDir(id: string): string;
/** 大纲文件路径；版本号先过值域校验（非正整数拼进文件名可越出 TASKS_ROOT）。 */
export declare function outlineFile(id: string, version: number): string;
/**
 * 读索引。索引只是缓存、磁盘任务目录才是真源：
 * - 文件缺失 / 损坏 → 整份从磁盘重建；
 * - 缓存里 id 在磁盘上已无「含 task.json 的目录」的条目 = 幽灵条目（任务目录被手工删除，
 *   或 task.json 已被 quarantine 改名）→ 加载时剔除并回写索引，否则列表会一直显示一个
 *   loadTask() 返回 null、点不开的任务（缺陷 1）；
 * - 剔除后条目数仍不少于「含 task.json 的目录」数 → 直接用缓存（读取路径不写盘、不解析 JSON）；
 * - 少于 → 从磁盘重建补条目；重建补不出更多时仍用缓存。
 */
export declare function loadIndex(): TaskIndex;
export declare function saveIndex(index: TaskIndex): void;
/** 读任务详情；缺失或损坏返回 null（列表由索引兜底）。 */
export declare function loadTask(id: string): TaskRecord | null;
/** 读任务；不存在即抛 not-found（工具与路由的统一入口）。 */
export declare function requireTask(id: string): TaskRecord;
/** 写任务详情并同步索引（无损：不裁剪条目，条目数 === 磁盘任务目录数）。 */
export declare function saveTask(task: TaskRecord): TaskRecord;
export interface CreateTaskInput {
    title: string;
    brief: TaskBrief;
    workspace: TaskWorkspace;
    status?: TaskStatus;
}
/** 创建任务：先校验再写盘（写失败回收空目录，不留孤儿）。 */
export declare function createTask(input: CreateTaskInput): TaskRecord;
export interface UpdateTaskPatch {
    title?: string;
    status?: TaskStatus;
    stage?: TaskStage | null;
    sessionId?: string | null;
    brief?: Partial<TaskBrief>;
}
export declare function updateTask(id: string, patch: UpdateTaskPatch): TaskRecord;
export declare function appendEvent(id: string, kind: string, text: string): TaskRecord;
/**
 * 保存大纲：版本号自增、落盘 outline-vN.json、任务转 waiting-outline。
 * 规范化在存储层完成（页面 id 缺失即补、标题为空即兜底），保证读侧形态稳定。
 * 契约：生成新版本时调用方**须回传既有页 id**（只改内容不换 id，新增页才给新 id）——
 * 页 id 是「按 id 编辑某页」的唯一句柄，同版本内必须唯一。
 */
export declare function saveOutline(id: string, pages: OutlinePage[]): TaskRecord;
/** 确认大纲；版本不符即拒绝（防串版本确认；v0 = 尚无大纲，不可确认）。 */
export declare function confirmOutline(id: string, version: number): TaskRecord;
export declare function setStatus(id: string, status: TaskStatus): TaskRecord;
export declare function addArtifact(id: string, artifact: TaskArtifact): TaskRecord;
/** 删除任务记录与任务目录（产物文件在工作区，不在任务目录，故不被删除）。 */
export declare function deleteTask(id: string): void;
export interface ListTasksFilter {
    status?: TaskStatus;
    workspaceId?: string;
}
export declare function listTasks(filter?: ListTasksFilter): TaskIndexEntry[];
/** 素材名安全化：只取 basename，剔除路径分隔、控制字符与首部点。 */
export declare function safeMaterialName(raw: string): string;
export interface MaterialUploadResult {
    name: string;
    size: number;
    path: string;
}
/**
 * 流式写素材到任务 materials 目录并登记到任务记录。
 * 超限即断、失败即清理（不留半截文件）；文件名经 safeMaterialName 安全化。
 */
export declare function writeMaterial(taskId: string, rawName: string, body: AsyncIterable<unknown>, limitBytes: number): Promise<MaterialUploadResult>;
export {};
