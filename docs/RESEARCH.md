# Odoo 上游调研与实施决策

调研日期：2026-11-08（Asia/Shanghai）。用户已确认：Odoo 社区版，DeepSeek Harness 官方最新版。首版目标沿用既定 Odoo 19/20 计划。

## 结论

**保留独立 TypeScript 业务核心，以官方 JSON-2 和官方 MCP SDK 为运行基础。** DSH 参考 `dsh-erp-bridge` 的入口与分层，不整体 fork。OCA 的服务端模块作为后续强幂等、异步任务和事件扩展的优先候选；首版不要求给公司 Odoo 安装 addon。

这是基于本项目双入口、同一权限策略和 19/20 目标作出的工程选择。成熟的通用 Odoo 项目确实存在，但其成熟部分主要在 ERP 服务端或通用 MCP；没有在本次候选中找到已交付本仓库所需 DSH 三栏工作台、Agent 页面回执及双格式包的现成底座。源码检查不等于已运行其测试，更不等于已完成公司环境验收。

## 比较

| 项目 | 检查结果与适合复用的部分 | 当前决定 |
| --- | --- | --- |
| [odoo/odoo](https://github.com/odoo/odoo) | 官方 ERP 源码；当前默认分支 20.0，19.0 仍有独立版本分支。根 LICENSE 标识 LGPLv3，具体第三方文件另有许可。 | 协议/模型依据；不 fork 整个 ERP 来实现外部插件。 |
| [odoo/docker](https://github.com/odoo/docker) | 官方容器构建工程，适合建立社区版独立测试环境。 | 后续 19/20 实例验收优先考虑；本机 Docker daemon 当前未运行，尚未拉取镜像或创建测试库。 |
| [OCA/connector](https://github.com/OCA/connector) | 19.0 分支包含 connector、component、component_event；适合复杂连接器和组件扩展。仓库 AGPL-3.0，各 addon 另查 manifest。 | 服务端扩展候选；不为首版远程查询引入额外服务端依赖。 |
| [OCA/queue](https://github.com/OCA/queue) | 19.0 的 queue_job 与配套测试模块已有迁移；部分附属模块仍显示 18.0 unported。 | 后续异步事件优先评估，不把存在 19.0 主分支当作全部模块均已迁移。 |
| [OCA/rest-framework](https://github.com/OCA/rest-framework) | 19.0 列出 FastAPI endpoint addon，有 OCA 测试配置。仓库 AGPL-3.0，各 addon 独立核对。 | 有专用原子业务方法需求时评估；普通读取直接使用官方 JSON-2。 |
| [ivnvxd/mcp-server-odoo](https://github.com/ivnvxd/mcp-server-odoo) | 当前约 413 stars，有独立单元和集成测试路径，MPL-2.0。标准模式依赖 Odoo MCP addon；直接连接模式支持 JSON-2，但项目定位为开发/演示模式。 | 较成熟的 MCP 候选；参考字段、公司、权限和测试分层。Python/addon 架构不能直接提供本项目的 TS 共享核心与 DSH 面板。 |
| [Vauxoo/mcp.odoo](https://github.com/Vauxoo/mcp.odoo) | MIT，多 profile、CLI、自动协议探测，README 自述 290+ 测试；本次没有执行其测试。 | 多连接配置参考；不引入自动协议回退及泛化 CRUD。 |
| [AlanOgic/odoo-mcp-19](https://github.com/AlanOgic/odoo-mcp-19) | MIT，Python/FastMCP，JSON-2、locked 模式和方法知识资料。 | JSON-2 与权限设计参考；不开放其通用方法入口，也不据 19+ 自述推断公司 20 兼容。 |
| [buiducnhat/odoo-mcp](https://github.com/buiducnhat/odoo-mcp) | MIT，TypeScript，3 个提交、约 2 stars；已阅读 JSON-2 client 源码。具有通用写入与方法入口。 | 语言最接近，但成熟度证据不足；请求协议需回到官方文档核对。未复制代码。 |
| [dengkun0/dsh-erp-bridge](https://github.com/dengkun0/dsh-erp-bridge) | MIT，现有计划已按固定提交分析；Odoo 适配使用旧 RPC，实际验收以 mock ERP 为主。 | DSH/适配器/审批分层参考，不能直接充当 19/20 JSON-2 和右侧面板的完成品。 |

stars 和 push 时间仅为采集时信息，不单独用来证明成熟度。默认分支、完整提交和许可证 API 结果保存在 [upstreams.json](upstreams.json)。`NOASSERTION` 表示 GitHub 未自动识别，不表示没有许可证；Odoo 已另外阅读 LICENSE。当前未复制上述候选的实现源码。运行依赖为 MCP SDK 与 Zod，实际打包许可证由构建脚本根据输入模块收集。

## 官方协议核对

依据 [Odoo 19 JSON-2 文档](https://www.odoo.com/documentation/19.0/developer/reference/external_api.html)及[官方文档源码](https://github.com/odoo/documentation/blob/19.0/content/developer/reference/external_api.rst)：

- JSON-2 在 19.0 加入，`POST /json/2/<model>/<method>`，请求采用命名参数，不用旧 `execute_kw` 的位置参数数组。
- API key 放在 Authorization，数据库按需要放在 X-Odoo-Database。调用保留 Odoo 用户权限与记录规则。
- `/web/version` 使用 **GET**，文档返回 `{ "version": "19.0", "version_info": [...] }`。已纠正参考客户端“读取任意 JSON 即完成版本检测”的做法，版本失败返回 unknown。
- 字段和方法取决于实例数据库与安装模块。每次查询先调用批准模型的 fields_get，不缓存权限结论。
- 每个 JSON-2 调用有独立事务。首版只读；将来创建/确认不能假设多个 HTTP 请求构成一个事务。

本次成功读取了 19.0 官方文档及其源码；20.0 文档网页抓取曾超时，未以其内容作额外兼容证明。已核对官方仓库 20.0 存在。实际 19/20 能力仍须分别验收。

## DSH 基线与后续面板

[锁定提交 fcc0ad46](https://github.com/deepseek-ai/deepseek-harness/tree/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159)，根版本 0.2.2-rc.1，Node ≥24.9.0，pnpm 11.28.5。采集时 npm `@deepseek-ai/dsh-tools@latest` 指向旧的 0.0.1-rc.1，因此开发依赖显式锁到 0.2.2-rc.1。Cordis 为 4.1.0。将来更新“最新版”需重新跑装配与 UI 验收。

已阅读官方[工具指南](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/docs/cookbook/adding-a-tool.zh.md)、[Remote 指南](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/docs/cookbook/adding-a-remote-api.zh.md)、[右侧 Sidebar 参考](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/docs/subsystems/sidebar-right.zh.md)与 sidebar/right service 类型源码。

Host 工具现已通过真实 Cordis 与工具注册表验证。Client 下一步须按实际 API 实现，而非猜测 slot：

1. 以 `sidebarRightTabs.register` 注册独立 Odoo kind，正文占 `sidebar.right.pane.tab`，顶部功能分页与左侧导航共用状态。
2. `sidebar.panellist` 的默认行会按 id 切换中央 main panel；不能仅注册一个图标就认为符合本仓库“左侧浮层 → 右侧标签”的布局。左侧入口需要正式行/菜单能力，或封装并说明适配边界。
3. Client 仅通过正式 Remote API 查询 Host，不持有 API key。最新版 `@Remote` 需要生成的 typert/remote 贡献与 assembly；只写 decorator 不等于已经接通客户端。
4. 页面工具单独绑定 Agent/Session/Client/tab occurrence 和状态版本；Client 确认已显示结果后回执，避免把 ERP 查询返回误认为页面已操作成功。
5. 非会话页启动保留草稿、创建/复用空白会话、有界等待，卸载清理订阅；随后执行仓库既定布局与页面交互验收。

## 等待的信息与决定

- 公司 19/20 测试库地址、数据库名、允许公司 ID、已装 sale/purchase 模块和定制字段。密钥由用户在本机配置。
- 完整 DSH 桌面/Web 测试入口，或允许使用的本地最新版部署；当前本机仅发现速记插件文件，未发现完整 DSH 源码 checkout。
- 首版写入场景及审批方式暂未选择；仍按已定只读阶段推进。
- 发布许可证及是否引入需安装 addon 的上游实现，待实际复用方案形成后确认；当前不阻塞本地开发。

后续进展：用户已提供本机独立 Odoo 19 测试库，完成版本、安装模块、用户公司范围发现及只读集成测试。连接信息已在本机配置，凭据不纳入本文。上述环境待办中的 Odoo 19 基础联调已完成，Odoo 20 与完整 DSH/Client 仍待推进，详见 [VALIDATION.md](VALIDATION.md)。
