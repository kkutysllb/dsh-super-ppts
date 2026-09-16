# dsh-super-ppts 演示任务面板重设计（DSH 原生单面板）

- 日期：2026-09-16
- 状态：设计已确认（用户批准），待转实现计划
- 目标版本：1.3.1 → 1.4.0（面板信息架构重做，disruptive 但保留既有设置页与模板库兼容）
- 关联文档：[`2026-09-15-dsh-0.1.16-upgrade-design.md`](./2026-09-15-dsh-0.1.16-upgrade-design.md)（侧边栏 slot 接入与草稿桥 v2）

## 背景与问题

当前侧边栏「演示文稿」主面板（`lib/client.js` 的 `makeWorkbenchComponent`）本质是一个
**Brief 快速填充器**：工作区选择 + 一句话主题 + 交付形态下拉 + 模板下拉 + 模板速览，
点击「放入对话输入框」后把拼好的提示词写进聊天输入框，再由用户回车发送。

页面看起来像工作台，但实际只能完成「拼一段提示词」，导致：

1. **没有任务概念**：没有任务记录、状态、进度、结果，刷新即丢失上下文。
2. **主按钮是内部机制**：「放入对话输入框」不是用户目标，流程被割裂到聊天窗口。
3. **信息层级混乱**：快速开始、主题、工作区、形态、模板、模板速览并列，用户不知道必填项与推荐项。
4. **模板只是下拉框**：无来源区分、无预览、无描述，用户无法判断选哪个。
5. **交付后无归属**：生成完的文件回到会话，页面侧没有任何可恢复的入口。
6. **设置与任务职责混淆**：模板管理与单次任务创建挤在同一个心智模型里。

用户反馈明确：**当前 UI 用户没法用，需要重新设计。**

## 目标 / 非目标

### 目标

- 把插件主面板从「Brief 填充器」升级为 **演示任务工作区**：
  创建任务 → Agent 自动分析 → 生成大纲 → **用户确认大纲** → 继续生成 → 预览/下载/继续修改。
- 保持 **DSH/KCoder 原生单面板**：插件只负责一个 `main` keyed 面板内部的内容与状态，
  不自建第二套壳层（无插件自有侧边栏、无右侧固定栏、无全屏工作台、无自有工作区导航、无自有全屏滚动容器）。
- 覆盖两类模板来源：**插件内置模板** 与 **用户上传模板**，来源可辨识、可选择，管理仍在设置页。
- 任务持久化到插件数据根，刷新与重启 DSH 后可恢复。
- 默认路径极简（写一句话即可开始），需要时可展开完整配置。
- 用户在流失结构（大纲）上拥有确认权，避免高成本生成后大面积返工。

### 非目标（本版明确不做）

- 在线 PPT 画布 / 拖拽排版 / 页面级视觉编辑（大纲阶段只编辑内容结构）。
- 插件自有侧边栏、右侧摘要栏、第二套工作区导航、自造全屏工作台。
- 任务页内的模板上传 / 重命名 / 删除（仍在设置页）。
- 网页链接抓取作为素材来源（首版仅文本 + 本地文件）。
- 多用户协作、权限体系、计费与模型选择。
- 模板 PPTX 缩略图渲染（首版使用统一占位预览）。
- 原生附件通道（`createDrafts` / `addAttachments`）作为素材主路径（首版走插件自有上传落盘）。

## 宿主边界与布局约束（硬约束）

### DSH/KCoder 负责

```text
侧边栏（新会话 / 工作区 / 插件入口 / 其他宿主入口）
主内容容器宽度、滚动、主题、字体、面板激活态、窗口尺寸
```

### 插件负责

```text
一个 main keyed 原生面板
└── 面板内部视图切换与内容
```

### 实现红线（沿用插件既有工程红线）

- 面板不得使用 `100vw` / `100vh` / 自有 `position: fixed` 全屏容器 / 自有全局滚动容器。
- 面板宽度、边距、滚动交还宿主；内部只做单列纵向内容流。
- 颜色、间距、圆角优先复用宿主 alias token（`--dsw-alias-*`），保持主题一致。
- 弹层优先复用宿主 dialog / popover 能力；宿主不提供时退化为面板内展开区，**不得**引入嵌套 drawer。
- 零 npm 依赖；外部进程调用一律 `execFile` 参数数组；不监听新端口，仅插件自有 `/super-ppts/*` 路由。

## 面板信息架构

主面板顶部一个轻量切换（面板内视图切换，不是应用级导航）：

```text
演示文稿

[新建任务] [最近任务]
```

- **默认落点**：点击侧边栏进入时始终打开「新建任务」。
- 若存在等待用户处理的任务，在「新建任务」视图顶部显示一条提示行，不抢占默认落点：

```text
你有 1 个任务等待确认大纲   [查看 Q3 经营复盘]
```

### 面板视图树

```text
PresentationPanel（一个 main keyed 面板）
├── NewTaskView        新建任务（默认）
├── OutlineReviewView  大纲确认
├── TaskProgressView   生成进度 / 错误恢复
├── ResultView         结果预览与继续修改
└── RecentTasksView    最近任务
```

## 视图 1：新建任务（NewTaskView）

```text
演示文稿                                  [新建任务] [最近任务]

新建演示任务
从一个想法、文本或本地文件开始。

这次想制作什么？
┌──────────────────────────────────────────────┐
│ 输入主题、目标、受众与重点内容                  │
│                                              │
└──────────────────────────────────────────────┘
[＋ 添加素材]   已添加 2 个文件

快速开始
[季度汇报] [项目复盘] [产品发布] [技术分享] [更多]

交付形态
[可编辑 PPTX]  [HTML 在线演示]

⌄ 更多制作选项
  内容信息 / 素材 / 模板与视觉 / 高级设置

当前配置
Q3 经营复盘 · PPTX · 跟随默认模板 · 2 个素材 · 预计 8–10 页
                                 [开始制作]
```

### 交互规则

- **必填**：主题（文本）。未填写时主按钮禁用，并给出明确提示「先描述你想制作的演示」。
- **默认值**：交付形态默认取设置页 `prefs.defaultFormat`；为 `ask` 时默认选中 PPTX。
- **即时摘要**：主按钮上方一行实时反映当前配置，可展开查看完整配置（纵向区域，不是右侧栏）。
- **快速开始**：点击任务类型不只填文字，同时填充推荐配置（受众、场景、页数、视觉方向、结构），且全部可改。
- **更多制作选项**：默认折叠，展开后分组可再折叠，避免一次性抛出完整表单。

### 完整配置分组

| 分组 | 字段 |
|---|---|
| 内容信息 | 目标受众、使用场景、预计页数（自动/5/10/15/自定义） |
| 素材 | 拖拽区、文件列表、上传与解析状态、删除与重试 |
| 模板与视觉 | 当前模板、更换模板、视觉方向、风格备注 |
| 高级设置 | 工作区、输出目录、渲染验收策略 |

### 素材（文本 + 本地文件）

- 支持类型：`.pdf` `.docx` `.xlsx` `.pptx` `.txt` `.md` `.png` `.jpg` `.jpeg`。
- 状态机：`waiting` → `uploading` → `parsing` → `ready` / `error`。
- 无素材也可创建；文案明确「也可以只根据文字描述开始制作」。
- 文件状态与任务状态分离，不得混用同一套语义。
- 素材字节经插件自有路由落盘到任务目录（见「数据面」），Brief 文本内嵌素材绝对路径清单，Agent 用自身能力读取。
- 素材读取失败可重试或删除后继续；不允许因单个素材阻塞创建（若主题文本已充分）。

## 视图 2：大纲确认（OutlineReviewView）

这是本设计的核心控制点：**大纲必须由用户确认后，才允许进入高成本生成**。

```text
← 返回新建任务

Q3 经营复盘
等待确认大纲

Agent 已根据你的描述和 2 个素材生成 9 页结构。
确认后才会继续生成视觉与 PPT 文件。

01 结论摘要
页面目的：[帮助管理层快速理解本季度最重要的结论]
核心要点：
 • 收入同比增长 18%
 • 利润率下降 2.4 个百分点
 • 华东区域贡献主要增长
页面类型：[KPI 结论页 ▾]
[上移] [下移] [复制] [删除]

02 核心经营指标
...

[＋ 添加页面]

让 Agent 修改大纲
[例如：合并第 3、4 页，并增加一页解释利润下降原因]
[修改大纲]

──────────────────────────────
[确认大纲并继续生成]
```

### 大纲编辑范围（基础内容编辑）

可直接编辑：页面标题、页面目的、核心要点（多行，一行一个）、页面类型、页面顺序、增删、复制。

明确不做：字号、颜色、图片、图表细节、多栏排版、动画。

页面类型选项：标题页 / 结论页 / KPI 数据页 / 趋势图页 / 对比页 / 时间线 / 流程图 / 案例页 / 行动计划页 / 结束页。

### 修改与确认规则

1. 任何修改（直接编辑或 Agent 修改）都进入「未确认」状态，**不得**自动继续生成。
2. Agent 修改后生成新版本（`outline-vN`），退回确认状态。
3. 存在未保存修改时离开视图 / 让 Agent 修改 / 重新生成大纲，需提示确认。
4. 主操作唯一且固定：**确认大纲并继续生成**；其余操作降级为次按钮。
5. 确认后进入生成阶段，且记录 `confirmedOutlineVersion`。

## 视图 3：生成与结果

### 生成进度（TaskProgressView）

```text
Q3 经营复盘
正在生成 · 第 3/6 阶段 · 构建页面内容

✓ 接收需求
✓ 分析素材
✓ 生成并确认大纲
● 构建页面内容
   正在生成第 4/9 页：区域表现（对比页）
   正在处理 Excel 中的 4 个数据表，预计还需 30 秒
○ 生成演示文件
○ 渲染验收
```

- 阶段级进度 + 当前阶段具体说明，避免只显示「生成中」。
- 提供 `[打开 Agent 会话]`、`[暂停任务]`。
- 失败必须可恢复，不得只有「重新开始」：`[重试当前阶段]` `[返回修改大纲]` `[查看错误详情]`。
- 需要用户补充信息时使用 `needs-input` 状态并给出具体问题与补充入口。

### 结果（ResultView）

```text
Q3 经营复盘
已完成 · 9 页 · 可编辑 PPTX · 渲染验收通过

[页面缩略图网格：01 结论 / 02 指标 / 03 趋势 / ...]

[下载 PPTX] [下载 PDF] [打开预览] [继续修改]

继续修改
[例如：把第 3 页改成折线图，并突出 7 月之后的下降趋势]
[提交修改]
快捷：[重做第 3 页] [换一种视觉风格] [压缩到 7 页] [重新渲染验收]
```

- 继续修改默认只重做相关部分，不做整份重生成（除非用户要求）。
- 产物只保存引用（路径 + 状态）；结果页需处理「文件已被移动或删除」并提供重新生成入口。
- HTML 交付形态的操作为：打开 HTML 演示 / 下载 HTML / 录屏提示 / 继续修改。

## 视图 4：最近任务（RecentTasksView）

同一面板内切换，不是第二套壳层。

```text
最近任务
[全部状态 ▾] [全部工作区 ▾]

需要你的操作
Q3 经营复盘 · 等待确认大纲 · 季度汇报工作区 · 刚刚   [继续处理]

进行中
产品发布演示 · 正在生成 · 产品发布工作区 · 今天 14:20  [查看进度]

最近完成
技术架构分享 · 已完成 · 12 页 · PPTX · 昨天          [打开结果]
```

### 排序优先级

```text
1. 等待用户处理（waiting-outline / needs-input）
2. 正在生成
3. 等待启动 / 已中断
4. 最近打开
5. 最近完成
```

### 状态 → 恢复落点

| 任务状态 | 点击后进入 |
|---|---|
| `creating` | 生成进度视图（创建中） |
| `waiting-launch` | 启动恢复区 |
| `analyzing` / `building` / `reviewing` | 生成进度视图 |
| `waiting-outline` | 大纲确认视图 |
| `needs-input` | 补充信息区 |
| `completed` | 结果视图 |
| `failed` | 错误恢复区 |
| `cancelled` | 任务详情（只读，可复制重做） |

> `draft` 不是持久化状态：它只表示「面板表单已填写但尚未点击开始制作」的内存态，
> 不写入任务索引，因此不出现在「最近任务」列表与恢复落点表中。

### 任务操作

第一版：打开 / 重命名 / 删除。

- 删除仅移除任务记录，不删除已生成的 PPTX 文件（需在确认文案中说明）。
- 生成中的任务不允许直接删除，只能取消。
- 复制任务作为后续增强，不入首版。

## 模板体系

### 两类来源

| 来源 | 标识 | 权限 |
|---|---|---|
| 插件内置模板 | `插件内置` | 随插件版本提供，不可删除 / 重命名 |
| 用户上传模板 | `我的模板 · 用户上传` | 设置页上传/命名/描述/设默认/删除；任务页只选择 |

### 任务页模板选择器

默认态（不开第二个工作台）：

```text
模板    跟随默认模板        [更换模板]
```

点击「更换模板」：

- 优先使用宿主 dialog / popover；
- 宿主无可用弹层时，在当前面板内展开模板区（`[收起]` 关闭）。

选择器内部：

```text
选择模板
[全部] [插件内置] [我的模板]        [搜索]

插件内置模板
┌───────────┐ ┌───────────┐
│ 占位预览   │ │ 占位预览   │
│ 高管经营汇报│ │ 产品发布   │
│ 插件内置   │ │ 插件内置   │
│ 商务·数据  │ │ 品牌·发布  │
│ [使用]     │ │ [使用]     │
└───────────┘ └───────────┘

我的模板
┌───────────┐ ┌───────────┐
│ 占位预览   │ │ 占位预览   │
│ 公司品牌模板│ │ 投资人路演 │
│ 我的模板   │ │ 我的模板   │
│ 默认       │ │ 商务·16:9  │
│ [使用]     │ │ [使用]     │
└───────────┘ └───────────┘
```

### 三个必须区分的语义

1. **跟随默认模板**：使用设置页配置的 `defaultTemplate`。
2. **不使用模板**：明确要求 Agent 不套用任何模板（不是「没选」）。
3. **未选择**：不得与「不使用模板」等价。

### 首版模板预览

- 统一占位预览图 + 来源标签 + 名称 + 描述 + 方向/比例 + 默认标记。
- 按来源做轻量视觉区分（内置用插件预设色板，用户模板用中性预览）。
- 缩略图（`template-preview.png`）作为后续增强，不阻塞本版。

### 模板与任务的版本绑定

任务创建时记录：`templateId` / `templateName` / `templateSource` / `templateFingerprint`（文件指纹）。

- 模板被重命名或删除后，历史任务仍知其当时使用的模板。
- 未开始使用模板时删除 → 提示「该模板已被删除，请选择其他模板后继续」。
- 已完成任务不因模板删除而丢失结果。

## 任务执行链路（会话桥 v3：直接开始制作）

### 已核实的宿主契约（可行性依据）

宿主 `@deepseek-ai/dsh-client-ui-conversation` 的输入契约同时提供：

```ts
// src/client/contract/input.ts
export interface SessionInput extends InputTarget {
  setDraft(text: string): void
  addAttachments(ids: readonly DraftAttachmentId[]): boolean
  submit(mode?: InputSubmitMode): void
  notify(level: 'info' | 'error', text: string): void
  readonly state: SnapshotStore<InputState>
}
export interface SessionInputResolver { for(actx: Context): SessionInput }
```

结论：

- **`setDraft` + `submit()` 均存在**，因此「点击开始制作后自动提交、用户无需回车」可走原生路径，
  这是 v2 草稿桥（只 `setDraft`）的自然升级：**先 `setDraft(brief)`，再 `submit()`**。
- 附件是**浏览器拥有的 `File` 对象**（`ComposerAttachment` / `createDrafts`），
  跨插件程序化注入本地文件路径不是稳定公开路径 → 素材改用插件自有上传落盘 + Brief 内嵌绝对路径。

### 执行流程

```text
用户点击「开始制作」
  ↓
保存任务记录（先落盘，再启动，避免「已创建但无记录」）
  ↓
定位会话：同工作区复用当前会话，否则 uiWorkspace.openWorkspace(ws)
  ↓
setDraft(brief) → submit()
  ↓
Agent 开始执行（自动，无人工回车）
  ↓
Agent 调 ppts_task 上报阶段与大纲
  ↓
任务状态变为 waiting-outline，Agent 停止
  ↓
用户在大纲视图确认 → 插件向同一会话提交「继续」消息
  ↓
Agent 继续生成 → 上报产物
  ↓
completed → 结果视图
```

### 任务状态桥（新增 host 工具 `ppts_task`）

Agent 与插件之间需要一条显式状态通道（不能靠猜会话事件）：

| action | 作用 |
|---|---|
| `stage` | 上报阶段（analyzing / planning / building / reviewing） |
| `outline` | 提交大纲 JSON → 任务转 `waiting-outline`，工具返回「等待用户确认」 |
| `artifact` | 登记产物（类型 / 路径 / 状态） |
| `needs-input` | 请求用户补充信息，附具体问题 |
| `fail` | 记录失败阶段与原因，提供可恢复动作 |

- 能力通告（`SUPER_PPTS_GUIDANCE`）补充说明：PPT 任务必须经 `ppts_task` 上报阶段并在提交大纲后停下等待确认。
- 用户在面板确认大纲后，插件以同一会话提交继续指令（`setDraft` + `submit`），并把 `confirmedOutlineVersion` 写入任务记录。

### 面板侧刷新策略

- 任务处于活跃态（`analyzing` / `building` / `reviewing` / `waiting-outline`）时，面板按固定间隔轮询
  `/super-ppts/api/tasks.get`。
- 任务进入终态（`completed` / `failed` / `cancelled`）后停止轮询。
- 不新增事件流服务、不监听新端口。

### 会话启动失败

```text
任务已保存，但 Agent 尚未启动

[重试启动] [选择其他工作区] [打开工作区] [取消任务]
```

任务状态为 `waiting-launch`（可恢复），不是 `failed`。

### 防重复创建

- 主按钮进入 loading，Brief 不允许重复提交；
- 创建成功后按钮禁用；
- 提交失败不得新建第二个任务，而是保留当前任务并提供重试。

## 数据模型

```ts
type TaskStatus =
  | 'draft' | 'creating' | 'waiting-launch'
  | 'analyzing' | 'waiting-outline' | 'needs-input'
  | 'building' | 'reviewing'
  | 'completed' | 'failed' | 'cancelled'

interface PresentationTask {
  id: string
  title: string
  status: TaskStatus
  stage?: { key: string; index: number; total: number; detail?: string }

  workspace: { id: string; name: string; path: string }
  sessionId?: string

  brief: {
    topic: string
    audience?: string
    scenario?: string
    pageCount?: string
    format: 'pptx' | 'html'
    templateId?: string | null     // null = 不使用模板；undefined = 跟随默认
    templateName?: string
    templateSource?: 'builtin' | 'user'
    templateFingerprint?: string
    style?: string
    styleNotes?: string
    outputDir?: string
    renderReview?: string
  }

  materials: Array<{
    id: string; name: string; size: number; type: string
    path: string            // 插件存储根之下的绝对路径
    status: 'waiting' | 'uploading' | 'parsing' | 'ready' | 'error'
    error?: string
  }>

  outline?: Outline
  outlineVersion: number
  confirmedOutlineVersion?: number

  events: Array<{ at: string; kind: string; text: string }>
  artifacts: Array<{ type: 'pptx' | 'pdf' | 'html'; path: string; status: 'ready' | 'missing' | 'error' }>

  createdAt: string
  updatedAt: string
}

interface Outline {
  version: number
  pages: Array<{
    id: string
    index: number
    title: string
    purpose?: string
    bullets: string[]
    pageType?: string
  }>
}
```

## 数据面（host 路由与存储）

### 存储布局

```text
<DSH_HOME>/super-ppts/
├── registry.json                 # 既有：模板库 + 偏好（不动）
├── templates/                    # 既有：用户上传 .pptx（不动）
└── tasks/
    ├── index.json                # 任务索引（列表渲染只读它）
    └── <taskId>/
        ├── task.json
        ├── outline-v1.json
        ├── outline-v2.json
        ├── events.json
        └── materials/<file>
```

- `DSH_HOME` 解析口径与 `templates.ts` 一致（`$DSH_HOME` → `~/.dsh`；KCoder 桌面端指向 `~/.kcoder`）。
- 全部写入原子替换（tmp + rename）。
- 单任务损坏（坏 JSON / 形态不符）改名 `*.corrupt-*` 留底，不影响其他任务加载。
- 默认保留最近 50 个任务；已完成任务不自动删除；失败任务保留以便查错。

### 新增路由（沿既有 `/super-ppts` 信任围栏与信封）

| 路由 | 作用 |
|---|---|
| `POST /super-ppts/api/tasks.list` | 任务列表（支持状态 / 工作区筛选） |
| `POST /super-ppts/api/tasks.get` | 单任务详情（含大纲、产物、事件） |
| `POST /super-ppts/api/tasks.create` | 创建任务（返回 taskId） |
| `POST /super-ppts/api/tasks.update` | 更新 Brief / 重命名 / 状态推进 |
| `POST /super-ppts/api/tasks.delete` | 删除任务记录（不删产物文件） |
| `POST /super-ppts/api/tasks.outline` | 保存大纲编辑（产生新版本） |
| `POST /super-ppts/api/tasks.confirmOutline` | 确认大纲版本 |
| `POST /super-ppts/tasks/upload?taskId=&name=` | 素材流式上传落盘到任务目录 |

响应信封沿用 `{ok:true,value}` / `{ok:false,error:{code,message}}`。

### 内置模板资源

插件包内新增 `templates/builtin/`（随 npm 包分发），每个内置模板包含元数据与可选 `.pptx` 基底；
`ppts_templates` 工具的返回值扩展为「内置 + 用户」两类来源，供 Agent 与面板共用同一份口径。

## 失败模式与对策

| 场景 | 对策 |
|---|---|
| 任务记录写入失败 | 明确报「无法保存任务记录，任务尚未开始」，不得假装已创建 |
| 会话创建 / 提交失败 | 任务置 `waiting-launch` 并提供重试 / 换工作区 / 取消 |
| 素材解析失败 | 单项标 `error`，可重试或删除后继续，不阻塞创建 |
| 素材文件后续被移动 | 结果页与任务详情标注「素材不可用」，提供重新上传 |
| Agent 未调用 `ppts_task` 上报 | 任务停留在 `analyzing`；提供「打开 Agent 会话」与手动刷新入口 |
| 大纲确认后会话已关闭 | 重新定位会话后提交继续指令；失败则提示「重新启动生成」 |
| 产物文件被移动 / 删除 | 产物标 `missing`，提供重新生成 |
| 工作区被删除 / 路径变化 | 保留任务，提示选择新工作区；已完成任务仍可查看摘要与产物 |
| 任务记录损坏 | 改名留底，列表跳过该任务并提示 |
| 面板轮询期间页面关闭 | 状态已持久化，重开后按状态恢复 |

## 与既有实现的关系

### 保留复用

- `sidebar.panellist` + `main` keyed 面板注册形态（slot id `super-ppts-panel`）。
- `/super-ppts` 信任围栏、信封、`templates.ts` 存储层与 `registry.json`。
- 设置页 `settings.section`「演示文稿」（模板管理 + 偏好），一行不动。
- 既有 `ppts_check` / `ppts_render` / `ppts_templates` 工具与能力通告。
- 技能线 `skills/ppts-pptx`、`skills/ppts-html` 不因本版改动而变。

### 改造

- `makeWorkbenchComponent` → 拆为面板 + 四个视图组件（新建 / 大纲 / 进度 / 结果）+ 最近任务视图。
- 草稿桥 v2（`setDraft`）→ 会话桥 v3（`setDraft` + `submit()`），保留剪贴板降级为最后兜底。
- 模板下拉 → 模板选择器（内置 + 用户、来源标签、占位预览、三个语义选项）。

### 新增

- 任务存储层（`src/tasks.ts`）。
- 任务路由与素材上传路由（`src/routes.ts` 扩展）。
- `ppts_task` host 工具（`src/tools.ts` 扩展）与能力通告补充。
- 内置模板资源 `templates/builtin/`。
- 面板视图与任务状态消费逻辑（`lib/client.js` + `src/client/index.ts` 类型参考同构）。

## 验收标准

1. `npm run build && npm run smoke` 通过；smoke 覆盖任务存储层、任务路由方法表、`ppts_task` 工具注册与既有断言不回归。
2. 点击侧边栏「演示文稿」默认进入「新建任务」；存在待确认任务时顶部出现提示行。
3. 仅填写主题即可点击「开始制作」，任务立即创建并自动启动 Agent（**无需回到聊天窗口按回车**）。
4. Agent 完成分析后，任务进入「等待确认大纲」，面板展示页面卡片；此时**不生成** PPTX / HTML。
5. 大纲支持直接编辑（标题 / 目的 / 要点 / 类型 / 顺序 / 增删 / 复制）与自然语言让 Agent 修改；两种修改均回到未确认态。
6. 点击「确认大纲并继续生成」后才开始生成；生成过程显示阶段与当前阶段说明。
7. 模板选择器同时展示「插件内置」与「我的模板」并要求来源可辨；「跟随默认模板」「不使用模板」「未选择」三者语义不混淆。
8. 素材可上传、可删除、有状态；无素材也能创建任务；素材失败不阻塞创建。
9. 「最近任务」按待处理优先排序，点击任务恢复到对应视图；刷新页面与重启 DSH 后任务不丢失。
10. 任务记录损坏不导致整个列表不可用；工作区不可用时可选择新工作区。
11. 面板不出现插件自有侧边栏 / 右侧栏 / 全屏容器；窄窗口下仍单列可用，滚动由宿主承担。
12. 设置页模板管理与偏好编辑回归正常。

## 分期建议

| 期 | 内容 | 版本 |
|---|---|---|
| 一期 | 面板视图重构 + 新建任务（快速创建 / 完整配置 / 模板选择器 / 素材上传）+ 会话桥 v3 直接启动 | 1.4.0 |
| 二期 | 任务存储层 + `ppts_task` 状态桥 + 大纲确认视图 + 生成进度与结果视图 + 最近任务 | 1.4.0（同版本内合并发布） |
| 三期 | 内置模板资源扩充 + 模板缩略图渲染 + 复制任务 + 任务清理策略 | 1.5.0 |

## 未决问题（进入实现计划前需确认或按默认执行）

1. **内置模板清单**：首版内置模板的具体数量与主题（默认建议 4 个：高管经营汇报 / 产品发布 / 技术架构分享 / 教学课件），是否需要随包附带 `.pptx` 基底文件。
   默认执行：先只提供元数据 + 统一占位预览，不附带 `.pptx` 基底，由 Agent 按 `skills/ppts-pptx` 生成路径落地。
2. **任务保留上限**：**取消索引裁剪上限**（原设计「最近 50 条」在实现审查中被否决：按 `updatedAt` 裁剪会把「等待用户确认最久」的任务挤出索引，被裁掉的任务目录仍在磁盘却永久不可见）。改为索引自愈——索引缺失/损坏/条目数少于磁盘任务目录数时，从任务目录重建；索引只作缓存，磁盘才是真源。任务列表默认按恢复优先级全量返回，由面板做分页或折叠。
3. **轮询间隔**：默认活跃任务 3 秒，不在设置页暴露；终态任务停止轮询。
4. **取消语义**：默认保留 Agent 会话（不归档、不删除），任务记录标 `cancelled`，仅停止面板轮询与后续阶段推进。
