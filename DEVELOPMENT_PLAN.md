# PW-Plugins-Odoo 开发计划

编写日期：2026-11-08（Asia/Shanghai）

状态：已实现 0.5.1 真实 DSH Web 工作台，销售、采购独立；CRM/库存/记录/设置与页面上下文/动作工具已接通。19/20 双版本只读服务、隔离克隆库 MTO 验收延续有效；实际 DSH Session/Agent 和浏览器端到端验证见 [前端说明](docs/FRONTEND.md)。插件仍只读，Electron 桌面壳及更广业务场景待专项验收。

## 1. 目标与首版范围

为平行世界开发独立 Odoo 插件，明确以公司使用的 **Odoo 19 与 Odoo 20** 为兼容目标。同时交付 DeepSeek Harness 的 Cordis 菜单扩展，以及可供其他兼容客户端使用的 Agent Plugins 标准包。菜单、DSH 工具和 MCP 工具复用业务与权限逻辑。

首版优先接入用户前期要用的 CRM：线索、商机、阶段、负责人/团队、客户关联、收入/币种、成交日期与计划跟进活动，同时保留客户/供应商、产品、销售和采购查询。先打通连接配置、版本诊断及选中记录后的 Agent 分析。第二阶段增加受控 CRM 写入、草稿与订单确认；库存与财务先只读，不把付款、过账或删除列为首版写入能力。双向事件、重试台账放在基础查询及菜单稳定之后。

最初计划交付阶段仅创建文档。2026-11-08 用户已进一步授权调研和开始开发，现已安装开发依赖并实现标准清单、共享核心和两个工具入口；未复制候选上游源码，不读取或引入 Memory hub 内容。真实兼容状态以测试证据更新。

## 2. 参考项目分析

主要源码基线为 [dengkun0/dsh-erp-bridge @ 365605a9](https://github.com/dengkun0/dsh-erp-bridge/tree/365605a9fb1c43b4116e10c108eb08f716b56bfd)，包版本 `0.1.0`。本次阅读 README、Odoo 适配器、工具、生命周期、台账和上游验收记录。以下“已具备”均指上游源码或其自述，不代表本项目已运行验证。

| 分析项 | 上游现状与证据 | 本项目处理 |
| --- | --- | --- |
| 产品方向 | 通用 ERP 双向桥接，含 mock、Odoo、HTTP 网关；不是专门的 Odoo 工作台 | 聚焦 Odoo，保留适配器分层思路；不把其他 ERP 一并搬入 |
| Odoo 协议 | [`lib/adapters/odoo.js`](https://github.com/dengkun0/dsh-erp-bridge/blob/365605a9fb1c43b4116e10c108eb08f716b56bfd/lib/adapters/odoo.js) 调 `/jsonrpc`、`common.login`、`object.execute_kw`；README 定位 Odoo 12–18 | 新建 JSON-2 客户端，重写认证和命名参数映射，目标为 19/20 |
| 查询与写入 | 模型/字段白名单、分页、草稿、配置化提交方法已存在 | 分离可读字段、可写字段和允许业务动作；增加字段发现、公司上下文和版本差异处理 |
| 写操作审批 | [`lib/tools.js`](https://github.com/dengkun0/dsh-erp-bridge/blob/365605a9fb1c43b4116e10c108eb08f716b56bfd/lib/tools.js) 默认不注册写工具；调用时请求 DSH 审批 | 保留默认只读；将策略下沉，使菜单和 MCP 同样受约束，而非只在 DSH 工具层拦截 |
| 双向事件 | inbox/outbox、HMAC、幂等键、重试及会话关联已有实现 | 后置复用其设计；新增 Odoo 事件来源与协议版本，避免把通用 webhook 当成 Odoo 原生能力 |
| 持久化 | [`lib/ledger.js`](https://github.com/dengkun0/dsh-erp-bridge/blob/365605a9fb1c43b4116e10c108eb08f716b56bfd/lib/ledger.js) 为追加 JSONL；有截断恢复和已完成记录保留上限 | 明确单实例及持久性边界；上线事件桥接前验证崩溃窗口、压缩并发与去重保留期；按需采用事务存储 |
| 菜单与界面 | 源码树未包含浏览器客户端；上游记录将台账侧栏列为未实现 | 新增可操作的 Odoo 面板及记录菜单，不只添加图标或配置文字 |
| 真实验收 | [上游验收记录](https://github.com/dengkun0/dsh-erp-bridge/blob/365605a9fb1c43b4116e10c108eb08f716b56bfd/docs/acceptance-evidence.md) 是 DSH + mock ERP 链路，明确未验证真实 Odoo | 公司 Odoo 19/20 的测试库分别验收，不能继承上游“已通过”结论 |
| 打包 | DSH bundle 有 `package.json` 与 `cordis.patch.yml`，未见根 `plugin.json`、`mcp.json` | 新增标准包与 MCP server，保持两种宿主入口独立可装 |

补充参考：

- [buiducnhat/odoo-mcp @ 323002c2](https://github.com/buiducnhat/odoo-mcp/tree/323002c218f3ea7ec465fc6adad753b594ffd9dd)：已阅读 README、文档索引及 `src/odoo-json2-client.ts`，可参考 TypeScript JSON-2 的请求组织、`fields_get`、命名参数与 MCP 资源映射。不能直接照搬其通用方法调用；名称合法不代表业务操作可授权。
- [ivnvxd/mcp-server-odoo](https://github.com/ivnvxd/mcp-server-odoo)：本次补充阅读 README，参考多公司范围、分页、字段选择和服务端聚合设计。该项目有 Odoo 模块依赖及不同运行模式，不作为本插件的直接运行依赖，也不据此宣称兼容 20。
- [maxwell-feng/dsh-kingdee](https://github.com/maxwell-feng/dsh-kingdee/tree/3a8f77ddb40795b9a93048a15a276c6cd0802134)：借鉴无宿主依赖的业务核心、凭据引用和 Host/Client 分离方式；不复用金蝶接口语义。

## 3. Odoo 19 / 20 适配决策

### 3.1 协议与认证

依据 [Odoo 19 JSON-2 文档](https://www.odoo.com/documentation/19.0/developer/reference/external_api.html)及 [Odoo 20 JSON-2 文档](https://www.odoo.com/documentation/20.0/developer/reference/external_api.html)，使用 `POST /json/2/<model>/<method>`，通过 `Authorization: bearer <API key>` 认证，按部署需要发送 `X-Odoo-Database`。不再依赖用户名密码登录后缓存 uid 的旧调用链。

| 项目 | Odoo 19 | Odoo 20 | 实施要求 |
| --- | --- | --- | --- |
| 默认传输 | JSON-2 | JSON-2 | 同一传输实现，业务差异由能力表处理 |
| 版本诊断 | `/web/version` | `/web/version` | 保存实际版本、构建信息和探测时间；无法探测时显示未知 |
| 字段/方法 | 取决于安装模块与定制 | 同样需按实例确认 | 使用允许模型的 `fields_get`；辅以实例 `/doc`，不假定动态文档格式固定或必然可用 |
| 旧 RPC | 非默认兼容通道 | 非默认兼容通道 | 首版不做自动回退；认证失败不得触发协议降级 |
| 实际支持状态 | 待公司测试库验证 | 待公司测试库验证 | 分别记录 edition、部署方式、模块和定制字段，不写成“19+ 全兼容” |

当前官方文档将旧 RPC 的 common/object 服务移除计划列到 Odoo 22，而不是“20 已全部删除”。选择 JSON-2 是面向 19/20 的新实现决策，不以错误的移除时间作依据。[迁移说明](https://www.odoo.com/documentation/20.0/developer/reference/external_api.html#migrating-from-xml-rpc-json-rpc)

### 3.2 字段、业务与公司上下文

- 通用模型清单限定 `res.partner`、`product.template`、`product.product`、`sale.order`、`purchase.order`、`crm.lead`、`crm.stage`、`crm.team`、`crm.tag`、`crm.lost.reason`。`mail.activity` 仅由专用工具在父记录权限校验后访问；库存、发票模型后续按权限启用。
- 建立 `OdooCapabilities`：记录版本、可读字段、关系类型、币种、可调用业务动作；缓存按连接、数据库、用户、公司及配置版本隔离。配置或权限变化后失效，写前始终以 ERP 权限为准。
- 查询使用结构化 domain；过滤字段、排序字段、操作符、页大小均校验。提供稳定排序、查询取消、结果上限及有界导出，不向模型返回无限量记录。
- 写入单独定义字段白名单和类型转换。验证关系字段、税、币种、计量单位、必填字段；规范化 `create` 的单个/列表 ID 返回，不能直接照搬旧适配器的数组封装。
- 连接指定 `allowed_company_ids`、当前公司、语言与时区；调用只能收窄授权范围。公司切换后清空选择与缓存；真正的数据隔离仍由 Odoo 用户权限和记录规则执行。
- 销售确认、采购确认使用经实例核对的业务方法映射；不允许 Agent 自由指定任意公开方法。财务确认与普通订单确认分开设计。

### 3.3 事务与重试

JSON-2 每个调用独立提交，连续 HTTP 调用不构成一个事务。[官方事务说明](https://www.odoo.com/documentation/20.0/developer/reference/external_api.html#transaction)

因此首版将“保存草稿”和“确认订单”分开；写请求超时后先标记结果未知并对账，不自动重建单据。需要原子组合操作或强幂等时，后续再增加可选的 Odoo 19/20 addon，在服务端单方法内校验与执行；客户端操作台账本身不能保证 ERP 端恰好执行一次。

## 4. Cordis 菜单与界面

产品入口为 **Odoo**，与金蝶保持独立连接和状态。默认遵循仓库的 [DeepSeek 插件前端布局](../docs/FRONTEND_LAYOUT.md)，参考用户指定的速记插件实现。本插件当前无布局例外：左侧一行 Odoo 入口，点击弹出 More 式功能菜单；功能在右侧 Odoo 标签页呈现，中间保留对话，不切换中央主面板。

左侧菜单与右侧顶部功能分页初拟为 **概览 / 业务查询 / 操作记录 / 连接设置**。客户、供应商、产品、销售和采购作为“业务查询”内部分类；草稿及写入流程后续并入操作记录，事件功能在启用阶段再增加对应视图。以下功能表为右侧标签内的信息架构，不代表独立中央页面或已确认存在的宿主 Slot 名称。

| 菜单/页面 | 首版行为 | 后续能力 |
| --- | --- | --- |
| 连接与诊断 | 新建连接、选择数据库/公司、设置凭据引用、只读连通测试、查看实际版本 | 多环境切换、凭据到期提示 |
| 业务查询 | 客户/供应商、产品、销售、采购列表；结构化筛选、分页、详情 | 库存与财务只读视图、受控导出 |
| 记录右键或省略号菜单 | 查看详情、复制单号、交给 Agent 分析、打开经校验的 ERP 链接 | 创建相关草稿、确认订单 |
| 草稿与操作记录 | 初期显示只读状态与禁用原因 | 变更预览、逐次确认、成功回读、未知结果对账 |
| 事件与回调 | 首版不启用 | inbox/outbox、错误诊断、受控重试及关联会话 |

实施方式：

1. Host 声明配置 schema、凭据访问及受控业务服务；Client 通过宿主正式远程服务通道调用 Host，浏览器不直连 Odoo、不接触 API key。
2. 按锁定 DSH 版本验证左侧 `sidebar.panellist`、右侧标签注册和正文等参考接入点，采用插件专属标签身份。左侧菜单、右侧分页及可选头部按钮/guide 复用同一导航入口，不重复创建标签；不默认注册替代中央对话的 `main` 页面。记录动作另参考官方 [`contextMenus`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-context-menu/README.zh.md) 服务，注册和清理纳入 Cordis 生命周期，不把记录右键菜单与左侧功能弹层混为一体。
3. 菜单捕获连接、公司、模型、记录 ID；切换选中项不改变正在操作的目标。执行前再检查配置版本、记录状态和权限。
4. 中央对话 Agent 通过页面上下文/动作工具与当前右侧视图交互；“交给 Agent 分析”保留为快捷入口。两种方式均只传必要字段，ERP 描述作为不可信业务数据；不传凭据，也不因读取或导航自动触发写入。
5. 加载、空数据、权限不足、请求取消、断线和错误均有明确状态；支持中文、键盘操作、浅深色主题，卸载后无残留入口或订阅。
6. 在非会话页选择功能时，保留已有草稿并新建/复用空白会话，等待右侧栏挂载后打开目标视图，不发送模型消息；合并重复点击，提供有界超时和工作区不可用提示，取消/卸载时停止等待。
7. 右侧内部切换保留筛选、详情与草稿，状态按会话、连接、数据库和公司隔离；不照搬速记的浏览器全局存储。宽表格先采用列选择、横向滚动和详情分层，确需独立大屏时再记录布局例外。

### 中央 Agent 与右侧 Odoo 页面交互

遵循[统一 Host 交互约定](../docs/AGENT_PANEL_INTERACTION.md)。P0 按实际 DSH 版本验证模型工具注册、生成的 Remote contribution、Host/Client 装配及双向流；P1 即实现只读面板交互。仅注册 `@Remote` 不会自动把方法暴露给 Agent，仅注册页面也不会让 Agent 看到其内容。

- 初拟 `pw_odoo_panel_context`：读取当前 Agent 会话的指定 Odoo 标签，返回连接、数据库/公司、视图、筛选、展示字段、当前页有界记录、选中 ID、详情及未保存变更摘要，包含 Client/标签身份、occurrence、版本和新鲜度。
- 初拟 `pw_odoo_panel_action`：按白名单执行打开/聚焦视图、设置查询、选择/打开记录、刷新等动作；受控表单补丁在草稿阶段增加。参数绑定目标与预期版本，Client 应用并呈现结果后回执；Host 入队不等于页面成功。
- Agent 的“右边这张采购单”通过快照中的稳定模型/记录 ID 定位；需要最新事实时调用 Host 的 Odoo 查询，不把页面缓存冒充最新 ERP 数据。手动修改与 Agent 修改共用状态和冲突检查。
- 表单补丁仅准备待保存内容；创建/保存/确认继续走 P2 的业务写入与审批。成功后回读 Odoo，更新右侧并返回同一操作号；面板超时不自动重发写请求。
- 多 Client、公司切换、标签重开、无页面与 headless 状态有明确结果；从实际中央会话验证工具可见性，避免只在另一个开发 preset 中可用。

DSH 上游接口正在迭代：调研时的设置指南与金蝶参考项目使用的配置卡片接口已有差异。P0 先冻结实际部署版本，再决定配置表单与远程调用的具体实现。[官方即时配置指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-settings-card.zh.md)

## 5. 模块结构与双格式交付

```text
PW-Plugins-Odoo/
├── DEVELOPMENT_PLAN.md
├── README.md                  # 实现阶段添加
├── plugin.json                # 标准标识 pw-plugins-odoo
├── mcp.json                   # 标准 MCP 配置
├── package.json               # npm 包名 pw-plugins-odoo
├── cordis.patch.yml           # DSH bundle
├── src/
│   ├── core/                  # 领域服务、策略、操作记录，不依赖 DSH
│   ├── odoo/                  # JSON-2、元数据、版本能力与模型映射
│   ├── cordis/                # Host、Client、面板上下文/动作工具、生成 Remote 与状态回执
│   ├── mcp/                   # MCP 协议入口
│   └── events/                # 后续事件桥接
├── skills/odoo-operations/    # 操作指导，不承担权限控制
├── tests/
└── docs/                      # 配置、兼容矩阵、验收与来源记录
```

以上是后续源码布局，不要求现在创建空文件。目录保留用户指定的 `PW-Plugins-Odoo`；包内标识使用小写。两插件首版分别自包含，先统一接口约定，不添加依赖相邻插件路径的共享运行库。

建议 TypeScript + Node.js，DSH UI 使用其支持的 React/构建格式，MCP 使用官方 SDK。`core` 暴露连接诊断、字段发现、查询、详情、写操作预览和执行；DSH 与 MCP 的工具只是入口适配。

标准包遵循仓库的 [Agent Plugins 版本与兼容策略](../docs/AGENT_PLUGINS_COMPATIBILITY.md)：优先支持最新正式版，同时跟进新版草案。2026-11-08 核对结果为正式版 1.0.0、1.1.0 Working Draft；当前保留 1.0 交付基线，并规划 1.1 预览构建，发布时采纳已通过目标客户端验证的新正式版。根 `plugin.json` 与 `mcp.json` 的 schema 版本一致；Skills 按目标规范组织。先交付 stdio MCP，远程 HTTP 后置。凭据由宿主或本地凭据提供方在运行时解析，不假定标准会展开 `${ODOO_API_KEY}`，也不把密钥写入包。状态置于客户端提供的数据目录，避免写入安装目录。

1.1 适配重点为 `displayName`、标准图标资源、MCP server 级扩展及更严格的扩展字段校验；同一 Odoo Core 生成不同规范产物，不能混用两版 schema 或删除影响权限/认证的扩展来伪装降级。以上为计划，尚未验证客户端兼容。

初拟业务工具：`pw_odoo_status`、`pw_odoo_fields`、`pw_odoo_query`、`pw_odoo_get`；P1 增加 DSH 页面工具 `pw_odoo_panel_context`、`pw_odoo_panel_action`；后续增加 `pw_odoo_prepare_operation`、`pw_odoo_execute_operation`。页面工具名为本项目设计，不是 DSH 内置 API。MCP 只读业务功能应能在未安装 DSH 的环境运行；没有绑定 DSH Client 时不宣称具有右侧页面操作能力。

## 6. 写入、凭据与审计

默认只读，先查询后开放写入。写策略由服务层统一执行，前端按钮禁用不能作为唯一限制。

- 创建草稿与确认订单分别授权；预览显示连接、数据库、公司、单据、字段变化及影响范围。
- DSH 工具通过宿主审批能力执行；直接菜单操作通过已认证的用户交互生成一次性操作授权。授权绑定请求摘要、目标、配置版本及有效期，不能用 Agent 传入 `approved: true` 代替。
- MCP 的确认方式取决于客户端能力与本地授权代理；没有可信确认通道时只读，不把二次工具调用本身当成人工批准。
- 执行前重新检查权限和记录状态；操作完成回读 ERP。网络中断后记录“未知”，不把超时解释为失败并无条件重试。
- 诊断与审计记录操作者、入口、目标、请求摘要、决定、结果和关联号；敏感字段按配置脱敏。菜单操作也留证，不只依赖 Agent 会话日志。
- ERP 地址通过管理员配置的目标白名单支持企业内网；拒绝云元数据地址、意外重定向和 URL 内嵌凭据，DNS 与实际连接地址检查一致。默认 HTTPS，开发 HTTP 例外明确配置。

## 7. 开发阶段与验收门槛

| 阶段 | 任务与交付 | 完成条件 |
| --- | --- | --- |
| P0：环境基线 | 确认 19/20 的版本、edition、部署方式、模块、公司、API 权限；锁定 DSH/Node 版本；记录上游来源及许可证；验证工具与 Remote 装配 | 两套测试库只读探测成功；中央 Agent→Host→所属 Client→右侧页面→回执最小往返通过；形成真实兼容矩阵 |
| P1：只读核心与菜单 | JSON-2、模型/字段发现、公司范围、五类查询；左侧浮层与右侧标签/功能分页、列表/详情/记录菜单；页面上下文/动作工具 | 两版本均能查询与回读；越权公司/字段拒绝；配置修改生效；会话/非会话布局验收；Agent 可读取实际选中记录并改变筛选/详情，页面与回执版本一致 |
| P2：标准包与受控写入 | stdio MCP、Skills、双入口打包；草稿、订单确认、操作审计 | 无 DSH 可运行只读 MCP；菜单/DSH/MCP 执行同一策略；拒绝/过期授权不写入；重复点击不重复创建 |
| P3：事件与运维 | Odoo 事件来源方案、签名、台账、回调、重启恢复、手工重试 | 重复事件去重、签名错误拒绝、崩溃恢复及超时对账通过；明确至少一次投递语义 |
| P4：发布 | 安装、升级、卸载、版本说明、依赖与许可证、截图及测试报告 | 从打包产物干净安装，两版本各跑查询与写入验收；卸载清理运行资源，数据保留策略明确 |

标准版本任务纳入 P0/P2/P4：P0 固定规范提交与目标客户端版本；P2 验证正式版基线和 1.1 预览产物的 schema、组件发现及 MCP 启动；P4 重新核对最新正式版并更新实际支持矩阵。DSH Cordis 菜单/Host 页面工具与标准包分别验收。

顺序建议：先完成 P0/P1，再并入 MCP 与写入；事件桥接不阻塞首个只读可用版本。暂不以未知环境给出固定工期。

重点测试：JSON-2 请求契约和错误脱敏；401/403、失效密钥、定制字段缺失、多公司；19/20 各自真实测试库；创建/确认权限与状态变化；菜单焦点切换和热重载；MCP stdout 不混入日志；包内路径及独立安装。基准用同数据集记录延迟、返回体积及分页结果，不预设没有测量依据的性能提升百分比。

前端另逐项执行[统一布局验收清单](../docs/FRONTEND_LAYOUT.md#6-默认验收清单)，覆盖非会话页启动/复用、草稿保留、重复点击、挂载超时、左右视图同步、窄栏表格、两插件并存及卸载清理。当前已开始核心与入口实现，尚未进行浏览器视觉验收。

同时执行[Agent 页面交互验收](../docs/AGENT_PANEL_INTERACTION.md#6-默认开发与验收要求)：真实中央对话读取选中采购单、按指令筛选列表与打开详情；手动并发编辑、公司切换、多窗口和断线不误读误改。不能仅用工具返回成功或 mock 状态替代页面观察。

## 8. 实现前需要补齐的环境信息

这些信息不影响本次计划交付，在 P0 收集，不要求现在提交生产密钥：

- Odoo 19/20 的实际构建版本、Community/Enterprise、Online/Odoo.sh/自建方式；云订阅 API 可用性需按公司方案核实。
- 测试环境地址、可读模型、定制 addon/字段、多公司、主要业务语言和时区。
- 首个写入场景选择销售还是采购、审批责任人、是否允许安装可选 addon。
- 公司实际 DeepSeek Harness 版本、桌面/Web 使用方式、需支持的其他 Agent 客户端及内网可达性。

## 9. 来源与复用边界

主参考项目的 [LICENSE](https://github.com/dengkun0/dsh-erp-bridge/blob/365605a9fb1c43b4116e10c108eb08f716b56bfd/LICENSE) 为 MIT。后续实际复制代码时保留原版权与许可，记录提交和改动文件。补充项目分别核对许可证；`ivnvxd/mcp-server-odoo` 的 README 标识 MPL-2.0，本计划只参考设计，不直接复制其代码。官方资料为协议依据，社区项目为实现参考，均不代替公司环境验收。

## 10. 开发进展（2026-11-08）

已实现 JSON-2 只读服务、模型/字段策略、固定公司上下文、四个共享工具、官方 SDK stdio MCP 与 Cordis Host 注册。标准包与 Skills 提前交付只读部分，P2 写入仍未开放。DSH 锁定 fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159（0.2.2-rc.1），完整宿主需要 Node >=24.9.0。补充比较和选择理由见 [RESEARCH.md](docs/RESEARCH.md)。

P0 仅完成协议/源码/类型与本地装配验证；P1 的核心查询已实现，Client/Remote/页面回执尚未实现；P0/P1 均未满足真实环境完成门槛。测试及打包证据见 [VALIDATION.md](docs/VALIDATION.md)。

随后用户提供本机独立测试库并授权联调，已验证 Odoo 19.0-20251222、五模型查询/详情/筛选、公司范围收窄、真实 MCP stdio 和 Cordis Host 查询链路。凭据仅在 gitignored 的本机 `.env` 配置。Odoo 20、完整 DSH 与面板仍未验收，P0/P1 不标记整体完成。

## 11. CRM 优先接入（0.2.0）

按用户明确要求，将 CRM 调整为前期重点，新增五个 CRM 通用模型及 `pw_odoo_crm_activities` 专用只读工具。支持枚举/币种元数据、归档查询、商机关联报价；活动必须绑定可访问的 CRM 父记录及公司。23 项离线、17 项真实集成测试通过，已读回实际计划活动；没有创建或修改 ERP 业务记录。详见 [CRM.md](docs/CRM.md)。

下一步 Client 信息架构优先呈现 CRM 线索/商机列表、阶段筛选、详情与跟进活动；写入和阶段变更需落实可信确认通道后再开放，不能由本次只读接入推断已具备完整 CRM 工作台。

## 12. 库存与 MTO（0.3.0）

用户明确要求混合实物/服务业务支持 MTO。本机库备份后安装官方 stock、stock_account、sale_stock、purchase_stock、sale_purchase_stock，复用既有 sale_purchase。库存扩展新增 12 个通用模型，总计 22 个；新增库存配置诊断与销售—采购关系追溯，共七个共享只读工具。配置以 Odoo 产品/类别/销售路线和产品供应商为准，不另建固定启用名单。

33 项离线、31 项真实只读集成测试通过。独立去活化克隆库的混合销售单验收生成 2 张 RFQ；实物通过库存需求关系、服务通过销售明细直连追溯，确认采购后生成 1 张收货单并再次追溯通过。未验证收发货过账；原应用数据库只执行模块安装和只读联调，没有用其既有订单做写入验收。详见 [INVENTORY_MTO.md](docs/INVENTORY_MTO.md)。

后续写入阶段再开发可信确认通道下的库存业务动作；当前插件不开放修改路线、选供应商、确认销售/采购、调整库存或验证收发货的 Agent 工具。

## 13. Odoo 20 适配与双版本回归（0.3.1）

用户提供本机 20.0-20260926 测试库 plugin。检查发现既有官方模块齐全，原库仅执行只读测试，未修改产品、路线或订单。对比 22 个模型发现 6 个模型存在白名单字段差异：新增 uom_id，按真实关系动态解析数量单位；同时识别 19 的 service_to_purchase 与 20 的 service_tracking=subcontract。追溯回执新增 quantityUnitFields。

补足所有可用白名单字段的读取验证，37 项离线及两版各 34 项真实只读测试通过。20 独立去活化克隆与 19 既有克隆的混合采购验收均通过；20 的原 dbfilter 保持不变，临时隔离入口已清理。新增 test:live:20、test:matrix 和 test:mto:20，保留 19 默认配置，详见 [COMPATIBILITY.md](docs/COMPATIBILITY.md)。

## 14. 列表优先工作台与销售/采购分离（0.4.0）

按用户选定方案实现六个独立分页：CRM、销售、采购、库存、记录、连接。左侧 Odoo 单行弹出功能菜单；右侧同一标签完成列表、筛选、详情、跟进与采购追溯，中央对话保留。非会话启动保留草稿、合并点击并有界等待。多连接/公司切换取消旧请求并清空业务缓存，只记忆经 Host 重新验证的公开范围 ID。

接入官方生成器与 typert-loader，Client 显式挂载生成贡献并通过 Remote 查询 Host；页面通道按 Session/Peer/Client/tab occurrence 绑定，实际渲染后才回执。新增 panel_context/panel_action 两个 DSH 工具，七个业务工具在有单一可见面板时跟随其明确范围，多 Client 不采用首个响应。MCP 保持独立且不增加伪页面工具。

已用官方 DSH profile、真实 Session/Agent 工具流水线和 Chrome 观察实际页面，验证多 Client、旧版本/旧 occurrence 拒绝、手动输入冲突及双环境范围跟随。精确测试数量与安装包状态见 FRONTEND.md；本轮不调用远程模型推理、不写入原 ERP 业务记录。当前支持 Host owner，Guest 到 ERP 的授权策略、Electron 桌面壳、复杂分栏及写入审批仍待后续工作。

## 15. 手动设置与首次连接（0.5.0）

修复缺少环境变量导致整个插件启动失败的问题。连接改名为设置，按连接管理分组支持新增、测试、编辑、删除和默认选择。自动验证 API 用户公司范围，密钥交给 DSH 凭据库且不回显；Host 按 profile 原子保存设置、检查并发修订号和业务请求连接版本，防止旧窗口错用新连接。设置修改仅经 owner UI Remote，不作为 Agent 工具。源码和安装包均验证首次使用、19/20、重启恢复及删除清理；原有 14 场景/18 次 Agent 派发继续回归。

0.5.1：移除公司 ID 手填；根据 API Key 自动发现公司，顶部支持 All/单家公司，页面与 Agent 查询同步范围。
