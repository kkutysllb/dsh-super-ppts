/**
 * /super-ppts HTTP 面（host 侧）：设置页 client 与 host 的唯一通道。
 *
 * - POST /super-ppts/upload?name=&description=   raw .pptx 流式上传（octet-stream）
 * - POST /super-ppts/api/<method>                JSON 操作面（templates.* / prefs.*）
 *
 * 信任围栏：行为同位镜像 dsh-client-connection /api 网关围栏（loopback Host
 * 或 trustedHosts 放行；跨站浏览器标记拒之门外）——这是 DNS-rebind / 跨站
 * 防御，不是认证。trustedHosts 经软探测解析（dsh 0.2.1-alpha.2 起优先
 * ctx.get('webStartup')，回退已被移除的 'webRuntime'；两者皆缺则退化为纯
 * loopback，非 web 部署不受影响），并额外放行监听器自身绑定地址，对齐 dsh
 * 自身围栏（api-request-trust.ts 的 isBindAddressAuthority）。CSRF 纵深（M3）：写路由
 * 额外过 Origin 同源粗校验；JSON 操作面再要求 application/json content-type
 * （跨站表单伪造不了该类型，带该类型的跨站 fetch 必触发预检且必败）。
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
    /** 监听绑定地址（dsh-host-webserver `get host()`）；非 web 部署可缺省。 */
    readonly host?: string;
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
/**
 * 解析本部署认可的 trustedHosts 来源。
 *
 * dsh 0.2.1-alpha.2 移除了 `webRuntime` 服务，改由 `webStartup` 承载
 * `--trusted-host` 权威（见 dsh 升级指南
 * docs/upgrade-guide/v0.2.1-alpha.1/web-listener-trust-config/guide.md）。
 * 两者都软探测：都没有时退化为纯 loopback——非 web 部署本就没有 LAN 面，
 * 故不声明 `inject`（声明了反而会等待永不挂载的服务而卡住启动）。
 *
 * 另外放行监听器自身绑定地址：绑定一块具体网卡即为显式部署意图，对齐 dsh
 * 自身围栏（dsh-client-connection/api-request-trust.ts 的
 * isBindAddressAuthority）。alpha.2 起通配地址在加载期即被拒绝，故此处拿到的
 * 绑定地址必为具体本机地址，不会因此把围栏放宽到全网段。
 */
export declare function resolveTrustedHosts(ctx: PptsRoutesContext): readonly string[];
/** JSON 操作面：method → handler（templates.* / prefs.* / tasks.*）。 */
export declare function buildPptsApiHandlers(): Record<string, (payload: unknown) => unknown>;
export interface PptsRoutesOptions {
    /** 上传体积上限（字节；来自插件 Config.uploadLimitMb）。 */
    uploadLimitBytes: number;
}
/** 注册 /super-ppts 路由（api + upload）；返回组合 disposer 由 effect 回收。 */
export declare function registerPptsRoutes(ctx: PptsRoutesContext, options: PptsRoutesOptions): () => void;
