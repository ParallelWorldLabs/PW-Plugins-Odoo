# PW-Plugins-Odoo · DeepSeek Harness 工作台

**在 DeepSeek Harness（DSH）里，一边和 Agent 对话，一边在右侧查看 Odoo。** 从左侧 Odoo 菜单打开工作台，中央保留对话，右侧可切换 CRM、销售、采购、库存、记录和设置。销售与采购各有独立列表、筛选和详情。

- **直接在界面管理连接。** 在“设置”中添加和测试 Odoo 连接，自动识别 API Key 对应的公司。顶部可切换连接，选择全部授权公司或单家公司。
- **让 Agent 和界面配合。** 可以请 Agent 查看当前选中的商机、筛选销售订单或打开记录详情，操作结果会显示在右侧工作台。
- **从销售单追溯关联采购。** 查看实际采购来源和 MTO 相关链路，并打开对应的采购详情。

0.5.2 支持 Odoo 19/20 社区版，DSH 兼容声明为 0.2.2-rc.1。工作台提供只读查询，验收使用 DSH Web profile。详见 [工作台使用说明](docs/FRONTEND.md)。


## 在 DeepSeek Harness 安装

1. 打开“插件 → 实验性插件”，启用“自定义插件索引”。
2. 打开“发现 → 添加索引源”，填写 [平行世界插件索引](https://parallelworldlabs.github.io/PW-Plugins-Odoo/index.json) 的地址。
3. 找到“平行世界 Odoo · DSH 工作台”，安装 0.5.2。安装确认框会显示 GitHub 仓库和固定提交。
4. 安装后打开“Odoo → 设置”，添加并验证连接。

索引从 GitHub 分发已构建的安装文件。已在独立 DSH 0.2.2-rc.1 profile 验证索引读取、Git 安装和首次打开设置页。

## 已实现

- 首次安装无需环境变量即可启动；在 **Odoo → 设置 → 连接管理** 手动新增、测试、编辑、删除连接并设置默认连接。自动识别 API 用户可访问公司，API Key 使用 DSH 凭据库保存且不回显。

- JSON-2 命名参数、API key 认证、数据库选择；GET `/web/version` 诊断与独立 API 权限探测。
- 客户/供应商（`res.partner`）、产品模板/变体、销售与采购订单的元数据、分页查询和单条详情。
- CRM 线索/商机（`crm.lead`）、阶段、销售团队、标签和丢单原因；负责人、预计收入/币种、赢率、成交日期、客户及报价关联。
- 专用 `pw_odoo_crm_activities` 读取指定线索/商机的计划跟进活动，先检查父记录权限与公司，再限定活动目标；不开放通用 mail.activity 查询。
- 库存仓库、库位、作业类型、收发货单、库存移动/明细、现存与预留数量、路线/规则、销售/采购明细、产品供应商配置查询。
- `pw_odoo_stock_status` 检查库存/MTO 依赖及原生路线；`pw_odoo_procurement_trace` 通过真实明细/库存移动关系追溯销售到采购，支持未确认 RFQ、服务直连及遍历上限回执。
- 模型/字段白名单、每次查询前字段发现、结构化 AND 筛选、稳定排序、每页最多 100 条、最大 offset 10000。
- 固定公司上下文、语言和时区；工具不能覆盖公司范围、URL、密钥或调用任意 ORM 方法。
- 超时、取消、最大 2 MiB 响应、错误脱敏、不跟随重定向；支持企业私网地址，连接时拒绝链路本地/已知元数据目的地址。
- 官方 MCP SDK stdio 入口和真实 Cordis/DSH 工具注册；两入口复用服务、参数和字段策略。
- 真实 DSH Client、生成的 Host/Client Remote 契约、多连接/公司切换；Agent 可读取选中记录、切换页面、筛选、打开详情和刷新，UI 提交渲染后才回执。

客户/供应商分类依赖实例中 `customer_rank` / `supplier_rank` 是否存在及可读。插件只允许常用业务字段；自定义字段需经开发配置白名单后开放。Odoo 用户权限和记录规则继续决定实际可见范围；插件不提升权限。

## 本地开发

已打包 MCP 入口以 Node.js ≥20.19 为目标；构建、界面测试和最新 DSH 完整宿主需要 **Node.js ≥24.9**，开发依赖提供本机 Node 24.22.2。开发/验收使用独立 profile，不修改用户平时的 DSH home。

```sh
cd PW-Plugins-Odoo
npm ci
npm test
```

在本机配置 `.env` 后，可显式运行 `npm run test:live` 执行真实库只读联调。默认 `npm test` 不连接 ERP；真实联调不打印业务记录或凭据。

本机 Odoo 20 使用独立且 gitignored 的 `.env.odoo20`，不覆盖 Odoo 19 的 `.env`。`npm run test:live:20` 验证 20；`npm run test:matrix` 逐套验证 19/20 并隔离各自环境变量。实际字段差异和验证边界见 [19/20 兼容矩阵](docs/COMPATIBILITY.md)。

配置本机连接后运行 `npm run dev:dsh` 可在独立开发 profile 预览实际工作台；`npm run test:frontend` 执行真实 DSH + Chrome 的显式只读验收；`npm run test:settings` 验证无配置启动、手工连接管理与重启恢复。多连接 JSON、安装及页面工具说明见 [FRONTEND.md](docs/FRONTEND.md)。

DSH 前端推荐直接在“设置”中添加连接，保存后立即可用，重启后保留。未配置时会显示设置引导，不再让插件启动异常。使用本机 HTTP 地址时需勾选“允许 HTTP”。

独立 MCP 继续使用环境变量，本机环境变量配置示例见 [.env.example](.env.example)。设置 `ODOO_URL`、`ODOO_API_KEY`、`ODOO_COMPANY_IDS`，按实例需要设置 `ODOO_DB`。`ODOO_COMPANY_IDS` 是逗号分隔的正整数，第一个为当前公司；使用 API 用户有权访问的公司。地址须为 origin，例如 `https://odoo.example.com`；反向代理子路径暂不支持。默认 HTTPS，本机测试 HTTP 需要显式 `ODOO_ALLOW_HTTP=true`。

程序**不自动读取 `.env`**。可通过宿主的安全环境配置注入变量，或在 Node.js ≥20.19 下运行：

```sh
cp .env.example .env
# 在本机编辑 .env；不要提交或发送密钥。
node --env-file=.env dist/mcp/stdio.js
```

连接本机 20 测试库时改用 `node --env-file=.env.odoo20 dist/mcp/stdio.js`。这两个文件只在本机管理凭据，不进入构建包；没有向已安装的 DSH 客户端自动切换连接。

stdio 启动后等待 MCP 消息，没有普通交互提示；stdout 只用于协议。

## 其他 Agent 的 MCP 接入

根 `plugin.json`、`mcp.json` 和 `skills/odoo-operations/SKILL.md` 按 Agent Plugins 1.0.0 布局组织。客户端需要支持标准配置并向子进程安全注入上述环境变量。`${PLUGIN_ROOT}` 仅用于脚本路径，不假定标准支持展开任意凭据变量。

MCP 提供七个业务工具：`pw_odoo_status`、`pw_odoo_fields`、`pw_odoo_query`、`pw_odoo_get`、`pw_odoo_crm_activities`、`pw_odoo_stock_status`、`pw_odoo_procurement_trace`，无需 DSH 可独立运行。DSH 额外注册 `pw_odoo_panel_context` 和 `pw_odoo_panel_action` 两个页面工具；业务查询会跟随本会话明确确认的可见面板范围，多 Client 歧义不会静默选第一个。

CRM 模型、商机查询及活动调用示例见 [CRM 接入说明](docs/CRM.md)。查询参数 `includeArchived: true` 可包含归档记录；通用活动模型仍不开放，活动必须通过专用工具绑定一条线索/商机。

库存/MTO 安装、产品路线/供应商配置、追溯示例及混合订单验收见 [库存与 MTO](docs/INVENTORY_MTO.md)。是否 MTO 取决于 Odoo 产品/类别/销售行的有效路线；供应商由 Odoo 原生规则按产品供应商配置选择，不在插件中另建固定名单。

查询示例：

```json
{
  "model": "sale.order",
  "fields": ["name", "partner_id", "state", "amount_total", "currency_id"],
  "filters": [{ "field": "state", "operator": "=", "value": "draft" }],
  "limit": 25,
  "offset": 0,
  "sort": { "field": "date_order", "direction": "desc" }
}
```

条件全部按 AND 组合；首版不接受原始 domain、OR/NOT 或关系路径。`nextOffset` 只是下一页提示，末页恰好满页时下一页可能为空，不代表总数。响应的 `fetchedAt` 和 `scope` 标明读取时间与公司范围；ERP 文本视为不可信数据。

## DeepSeek Harness / Cordis

本包提供 Host、`./client`、`./typert` 和 `./remote` 入口及 `dsh.client` 声明；Host 依赖 tools/typert，官方 Loader 管理严格契约注册，Client 显式挂载生成的 Remote contribution。原生会话 Agent 已验证页面工具可见并经实际工具流水线调用；未用额外业务 HTTP 网关或 DOM 抓取代替页面上下文。

前端按会话/Client/标签 occurrence 隔离，面板动作检查版本与有效期。加载、错误、空态、分页、断线/重连、连接切换清缓存均有状态。具体官方宿主接口、左侧行结构适配边界及验收证据见 [FRONTEND.md](docs/FRONTEND.md)。

## 构建与打包

```sh
npm run build
npm pack --ignore-scripts
```

`build` 先调用官方生成器生成严格 Remote 契约，再进行 TypeScript 检查并打包 MCP、Cordis Host 和浏览器 Client。MCP 入口自包含；Host 由匹配 DSH 提供 Cordis/Typert peer，Client 从宿主 ModuleLoader 取得 React，复用框架身份。包不依赖相邻插件或调研源码目录。第三方许可保存在 `dist/THIRD_PARTY_NOTICES.txt`，法律注释需要时另输出 `.LEGAL.txt`。

源码安装先运行 `npm ci && npm run build`；已构建包可由标准 Agent 插件客户端加载 MCP，或通过 DSH 官方插件管理安装。凭据文件、备份、截图、测试 profile 与开发依赖均不进入包，安装方法见前端文档。

上游比较、提交快照见 [RESEARCH.md](docs/RESEARCH.md) 和 [upstreams.json](docs/upstreams.json)，当前验收证据见 [VALIDATION.md](docs/VALIDATION.md)。尚未决定本项目对外发布许可证，保持 `private: true`；未复制社区项目源码或引入自定义 Odoo addon。本机测试库现使用 Odoo 官方库存及销售/采购桥接模块。

## 公开发行

许可证为 MIT，版权署名 ParallelWorldLabs。公开源代码仓库为 https://github.com/ParallelWorldLabs/PW-Plugins-Odoo 。0.5.2 沿用已验收的 0.5.1 业务行为，补齐公开发行元数据、图标和许可。DSH 插件索引已上线，当前安装源为 GitHub。维护流程见 [发布说明](docs/PUBLISHING.md)。Codex、Hermes 的本地接入步骤见 [MCP 配置](docs/MCP.md)。
