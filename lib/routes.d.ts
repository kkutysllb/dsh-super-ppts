/**
 * /super-ppts HTTP 面（host 侧）：设置页 client 与 host 的唯一通道。
 *
 * - POST /super-ppts/upload?name=&description=   raw .pptx 流式上传（octet-stream）
 * - POST /super-ppts/api/<method>                JSON 操作面（templates.* / prefs.*）
 *
 * 信任围栏：行为同位镜像 dsh-client-connection /api 网关围栏（loopback Host
 * 或 trustedHosts 放行；跨站浏览器标记拒之门外）——这是 DNS-rebind / 跨站
 * 防御，不是认证。trustedHosts 经 ctx.get('webRuntime') 软探测：未声明服务
 * 不影响加载，非 web 部署自然退化为纯 loopback。
 *
 * 响应信封：{ok:true,value} / {ok:false,error:{code,message}}（与生态内
 * 插件路由约定一致，client 侧统一解包）。
 *
 * 工程红线：不引入新依赖（node:http 类型 + templates.ts 存储层）；上传体
 * 流式落盘、限额即断，失败不留半截文件（见 templates.writeUploadTemp）。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
/** webServer 服务面（结构镜像 dsh-host-webserver 的 WebRoute）。 */
export interface PptsWebServerFace {
    register(route: {
        kind: 'exact' | 'prefix';
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
    }): () => void;
}
/** 路由注册收到的 ctx 面（effect 为 cordis ctx 自带，返回 disposer；get 为软探测读）。 */
export interface PptsRoutesContext {
    webServer: PptsWebServerFace;
    effect(fn: () => () => void, name?: string): () => void;
    get(name: string): unknown;
}
/** wire 层可预期失败。 */
export declare class PptsRouteError extends Error {
    readonly code: 'bad-request' | 'not-found' | 'forbidden' | 'method-error' | 'too-large' | 'conflict' | 'internal';
    readonly status: number;
    constructor(code: 'bad-request' | 'not-found' | 'forbidden' | 'method-error' | 'too-large' | 'conflict' | 'internal', message: string, status?: number);
}
/** 信任围栏：Host header loopback / trustedHosts 精确匹配才放行。 */
export declare function fenceRequest(req: IncomingMessage, trustedHosts: readonly string[]): boolean;
/** JSON 操作面：method → handler（templates.* / prefs.*）。 */
export declare function buildPptsApiHandlers(): Record<string, (payload: unknown) => unknown>;
export interface PptsRoutesOptions {
    /** 上传体积上限（字节；来自插件 Config.uploadLimitMb）。 */
    uploadLimitBytes: number;
}
/** 注册 /super-ppts 路由（api + upload）；返回组合 disposer 由 effect 回收。 */
export declare function registerPptsRoutes(ctx: PptsRoutesContext, options: PptsRoutesOptions): () => void;
