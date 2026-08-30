---
name: super-ppts-html-protocol-viz
description: >
  网络协议可视化动画：数据包/帧结构分层展开、握手时序、路由转发表高亮。
  TCP/IP、HTTP/TLS、ARP、DHCP 等协议的教学演示。
metadata:
  short-description: 网络协议结构与交互可视化
  parent: super-ppts-html
---

# 协议可视化（protocol-viz）

把网络协议做成动态演示：字段结构逐层展开、报文在两端来回流动、
路由表逐行匹配高亮。

> 遵守入口共享工作流与 [../../shared/design-tokens.md](../../shared/design-tokens.md)。

## 经典协议子集

| 协议 | 演示重点 |
|------|---------|
| TCP 三次握手/四次挥手 | 报文状态机、序列号演进（示例 `assets/tcp-visualization.html`） |
| IPv4 数据报 | 字段结构逐层展开、3D 分解（`assets/ipv4_datagram.html`） |
| ARP | 广播请求 → 单播应答、MAC 缓存表 |
| ICMP | 报文类型、ping/traceroute 流程 |
| DHCP | 四步流程 Discover→Offer→Request→ACK |
| HTTPS/TLS | 握手流程、证书验证、加密通道建立（`assets/HTTPS.html`） |
| 路由/交换 | 路由表最长前缀匹配（`assets/router-routing-table.html`）、交换机 MAC 学习（`assets/switch-mac-table.html`） |
| 以太网帧 / PPP | 帧结构、链路协议 |
| 防火墙 | 基于 IP/端口的流量过滤 |

## Step 1 · 确定演示对象

识别目标协议。不明确时问：「演示哪个协议或概念？重点：结构解析 /
交互流程 / 过滤演示？」**信息充足直接生成。**

## Step 2 · 规划演示结构

- **数据包/帧结构**：分层矩形块展示字段；hover 弹出字段说明；
  动画依次展开各层；
- **交互流程（如握手）**：客户端/服务端左右布局；带箭头时序图，
  报文在两端来回流动；每步附说明；
- **路由/转发**：拓扑图（节点+连线）；数据包沿路径流动；路由表高亮匹配行。

## Step 3 · 生成标准

- 默认暗色科技风：深底（`#0d1117`/`#0a0a1a`）；节点圆形渐变填充；
  报文用小矩形/圆点带发光尾迹；箭头动态流动虚线；
- 协议层语义色：物理层(灰) / 数据链路层(蓝) / 网络层(绿) / 传输层(橙) /
  应用层(紫)——全片锁定；
- 单文件 HTML 内联 CSS/JS，600-1200 行；支持自动播放 + 手动步进 + 重置。

## Step 4 · 交互与验收

必含：播放/暂停、重置/重播、每步说明文字。可选：步进、速度控制、
hover 字段解释。

**安全教育模式**：演示涉及安全场景（钓鱼、攻击链、绕过）时，页面底部加
免责声明「本演示仅供安全教育用途」；内容聚焦攻击原理可视化，不提供
可直接使用的攻击代码。

验收：截图多时间点检查（`node ../video-shots/scripts/shot.js`）——
报文动画同步、表格高亮正确、无遮挡穿帮。

## 参考

- Prompt 模板：`references/prompts.md`
- 成片示例：`assets/`（tcp/ipv4/router/switch/HTTPS 等）
