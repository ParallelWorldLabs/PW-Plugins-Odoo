# DSH 工作台（0.5.1）

2026-11-08，按用户确认的“列表优先”设计实现真实 DeepSeek Harness Web 前端；**销售与采购分开**，不再共用一个业务分页。

## 已实现的界面

左侧只有一行 Odoo，点击打开浮层菜单；功能在当前会话的同一个右侧 Odoo 标签展示，中央 DeepSeek 对话保留。六个独立功能为：

| 分页 | 当前功能 |
| --- | --- |
| CRM | 商机/线索切换、阶段/状态/名称筛选、包含归档、分页、详情与计划跟进活动 |
| 销售 | 独立销售列表/状态筛选/详情；从详情查看实际采购来源与 MTO 追溯，并打开对应采购详情 |
| 采购 | 独立采购列表、询价/采购状态、筛选与详情；与销售保留各自查询条件 |
| 库存 | 数量明细、收货、发货、产品补给；展示实际单位与路线/供应商配置字段 |
| 记录 | 当前会话和连接范围内的近期查询与页面动作记录，不是完整 ERP 审计台账 |
| 设置 | 连接管理（新增、测试、编辑、删除、默认连接）及版本/库存依赖诊断；按设置分组保留扩展空间 |

没有连接时自动进入设置并显示引导；已配置时默认 CRM。切换公司或连接时取消旧请求、清空业务缓存/选择/详情；回到同一范围的不同功能时保留各自筛选与已读页面。页脚显示范围、读取时间、Agent 页面通道状态，断线可手动重连。列表是当前页，不冒充总量。备注按文本呈现，不执行 ERP HTML。

非会话页选择功能时，由宿主保留草稿并创建/复用空白会话，等待右侧挂载后打开；连续点击合并，最长等 10 秒，取消或卸载清理等待。打开已有 Odoo 标签会优先聚焦，不通过 main 面板替换对话。

## Host 与 Client

- 业务查询复用既有 OdooService，浏览器不直连 ERP。Remote 仅允许既定七个只读业务工具，不能指定任意模型方法或注入公司 context。
- Host 读取本地配置与密钥；返回给 Client 的设置只有公开连接信息和“API Key 已保存”状态。用户在表单输入新密钥时仅暂存在该表单，经 owner Remote 交给 Host；保存/取消/关闭后清空，不进入页面模型、快照、操作记录或浏览器持久存储。
- 由官方 Typert 生成器产生 Host/Client 契约。Host 交给官方 typert-loader 注册 `./typert`；Client 显式 `$mount()` 生成的 `./remote` contribution。不把 decorator 或 JS 对象存在当作已接通。
- 外部生成器目前要求 workspace 形态，并以注册包判断 decorator 来源。构建脚本将本包和已发布 protocol 声明放入临时分析目录，再调用官方生成器；这些声明只用于分析，不执行、不手写通信契约、不进入交付包，也不依赖调研源码 checkout。
- 已验证严格 codec 实际注册，非 owner Peer 被拒绝。本版按本机 Host owner 使用，不开放共享 Guest 到 ERP 的访问策略。

### Agent 页面工具

DSH 除七个业务工具外再注册：

1. `pw_odoo_panel_context`：获取所属实际 Agent 会话的当前可见面板新鲜回执，含范围、模型、筛选、版本、选中 ID、有限记录/详情、加载和错误状态。多个 Client/标签可回答时返回候选，必须明确选择。
2. `pw_odoo_panel_action`：按 target（clientId、tabId、occurrence、expectedVersion）执行 navigate、filter、select、detail、refresh；动作有期限，过期目标/公司切换/手动输入并发会冲突，不能执行任意脚本或 ERP 写入。

示意流程：

```text
Agent → panel_context → 用稳定 ID/版本定位
Agent → panel_action → Host 检查目标 → Client 共用导航/查询模型
Client → React 提交渲染 → 回执版本和显示快照 → Agent 获得结果
```

不会在 Host 刚入队时就返回页面成功。页面快照是 Client 的显示事实，ERP 描述视为不可信数据；需要最新业务事实时调用共享业务查询。DSH 的七个业务工具会先确认本会话可见页面的连接/公司再读取 ERP，避免页面已选 20 而工具仍查询默认 19。没有页面时使用 Host 默认连接；多个可见页面不静默挑第一个，可在 DSH 业务工具参数中额外提供 `panelTarget`（同 target 的四个字段），明确绑定并核对当前版本。MCP 参数不增加该页面字段。

同一 owner Peer 可能承载多个浏览器 Client，登记按 Session + Peer + Client + 标签/occurrence 区分。刷新后新 occurrence 不能接收旧动作。快照最多返回 10 条摘要、有限文本，截断有标志；关系 ID/名称保留，不能凭当前行号猜记录。

MCP 仍只有七个独立业务工具，不宣称在未绑定 DSH 时能操作右侧页面。

## 设置与连接管理

通过桌面应用的插件管理界面将旧包升级为 `pw-plugins-odoo-0.5.1.tgz`，重载或重启相同 profile，打开 **Odoo → 设置**。

1. 点击“新增连接”，填写名称、服务器 origin、数据库和该 Odoo 用户的 API Key。API Key 不是登录密码。
2. 本机测试地址如 `http://localhost:8070` 要勾选“允许 HTTP”。无需填写公司 ID：保存时根据 API Key 自动识别用户可访问公司。顶部“公司”默认选择“全部公司（All）”，也可选择任意一家。
3. “测试连接”只验证，不保存。点击“验证并保存”会再次验证并生效，可直接切到 CRM。语言/时区默认读取 Odoo 用户设置，可展开手动指定。
4. 编辑时不回显旧密钥；留空保留。更换服务器或数据库必须重新输入 API Key，避免向新目的地址发送旧凭据。
5. 可编辑连接名称、指定默认连接；删除需二次确认，仅删除插件连接信息。没有连接时仍可使用设置。

普通设置位于当前 `<profile目录>/data/pw-plugins-odoo/settings.json`，文件权限 0600；其中只保存凭据引用。API Key 通过官方 `ctx.credentials` 保存至 DSH 的凭据库（本机提供者默认是 `$DSH_HOME/.credentials.yaml`），不会进入插件安装目录或打包文件。应按本机敏感文件管理该凭据库，不宣称它由系统钥匙串加密。

设置使用原子替换和跨进程锁，并校验修订号，拒绝另一窗口的过期保存。保存后当前页面重新建立 Agent 通道、清空原有业务缓存；其他窗口需刷新设置/重连。业务请求同时核对连接配置版本，拒绝拿旧页面的记录 ID 访问已改动的连接。编辑表单时阻止页面动作覆盖未保存的输入。设置增删改不注册为 Agent 工具；Agent 只能读取公开页面状态与既有业务数据。

### 兼容原有环境配置

单连接继续使用原有环境变量；MCP 仍可运行：

```sh
node --env-file=.env dist/mcp/stdio.js
```

多连接在本机创建 `.local/connections.json`（已被 Git 忽略），只保存引用：

```json
[
  {"id":"odoo19","label":"Odoo 19 测试库","envFile":"../.env"},
  {"id":"odoo20","label":"Odoo 20 测试库","envFile":"../.env.odoo20"}
]
```

envFile 相对该 JSON 文件目录解析。Host 启动时设置 `PW_ODOO_CONNECTIONS_FILE` 为这个本机文件路径。每套 env 中的公司 ID 都来自各自授权范围；顶部可选择该集合内的全部公司或一家；旧环境文件的公司范围继续保留。更改环境文件后重启/重载插件以重新读取。设置中编辑保存会覆盖同 ID 的环境连接；设置中删除会隐藏它，重启后也不会意外重新出现。无效环境配置会显示提示并允许进入设置补充。

sessionStorage 仅记忆“会话/标签所属的连接 ID 与公司 ID”；不保存业务记录、关键词、草稿或凭据，且恢复时重新核对 Host 当前授权集合。禁用存储不阻止使用。硬刷新会重新读取业务数据；页面内部切换的缓存只在本次 Client 生命周期中存在。

## 开发运行与安装

构建和 DSH 使用 Node >=24.9（开发依赖提供 Node 24.22.2），MCP 已打包入口仍以 Node >=20.19 为目标。DSH 锁定官方 0.2.2-rc.1 / fcc0ad46；不宣称旧 rc 接口兼容。

```sh
npm ci
npm run dev:dsh
```

开发脚本使用独立 `artifacts/dsh-dev-home`，默认端口 8879，不修改用户平时的 DSH home/profile。它链接本包作为标准裸包入口，因此开发和安装都由官方 Loader 管理契约；不会在 Host 重复手动注册。脚本自动使用已存在的 `.local/connections.json`，否则采用单连接环境配置；两者都没有时进入设置引导。它关闭开发 profile 的强制模型凭据引导，便于只读界面预览；实际自然语言分析仍需在 DSH 配置可用模型。

已有兼容 DSH 环境可通过官方 CLI 安装本地构建包：

```sh
dsh plugin --profile <你的配置名> add /path/to/pw-plugins-odoo-0.5.1.tgz
```

CLI 会把包加入该 profile 的 bundle 列表，重启相同 profile，然后在 Odoo → 设置中添加连接即可。不要再额外插入同一个插件条目。开发时反复改同版本的 tar 文件，包管理器可能复用旧的 file: 缓存；验收使用内容哈希文件名并核对安装后的代码，正常发布应保持版本/包内容不可变。

### 安装入口常见问题

- `zsh: command not found: dsh` 表示终端 PATH 中没有该命令，不表示必须进入 DSH 仓库。桌面应用不会保证把同名全局 CLI 放进 PATH。本开发包目录已安装本地 CLI，可在本目录运行 `npm exec -- dsh --version`；要求匹配的 Node 版本，项目本地 Node 已提供。
- 示例中的 `<你的配置名>` 是占位符，不要把尖括号输入 shell。名为 odoo 的独立 profile 应写成 `--profile odoo`；它不等于当前桌面应用的 profile。安装到桌面应用时，优先使用该应用内的插件管理界面；npm CLI 对 desktop profile 有专门限制。
- “添加插件”的上方输入框填本地包/目录路径。“安装源”是 npm registry：可以选内置中国大陆镜像；自定义时填写真实的 `https://...` registry 地址。它不是本地插件包路径，选择自定义却留空会出现网址校验红字。
- 本地路径建议使用带引号的绝对路径。若仅预览本项目，无需先装全局 dsh，在本插件目录运行 `npm run dev:dsh` 即可；此命令使用独立开发 profile。

## 验收

```sh
npm test
npm run test:matrix
npm run test:frontend
npm run test:settings
```

`test:frontend` 是显式实际 DSH + Chrome + 本机 ERP 只读验收，要求 `.local/connections.json` 中有 odoo19/odoo20 两个测试连接。它在独立 profile 启动官方应用，使用真实 Session/Agent 和 tools.execute 流水线，验证工具可见性与页面往返；不调用远程模型推理、不向 ERP 写业务记录。

当前源码验收覆盖 14 个场景、18 次 Agent 工具调用：菜单键盘操作、非会话启动、销售采购分离、选中 CRM/详情、20 范围跟随、Agent 筛选和显示回执、手动编辑冲突、多 Client 歧义/显式范围查询、硬刷新旧目标拒绝、库存页面、连接诊断、Host 严格契约和非 owner 拒绝、浏览器不直连 ERP，以及浅/深主题和 900px 窗口布局。截图和只含结果标志的报告在本机 artifacts 中，不进入包。

源码与正式安装包均已通过上述 14 个场景、18 次 Agent 工具调用，浏览器错误为 0。安装包通过官方 `dsh plugin` 加入独立 profile，并核对已安装 Host 代码与当前构建一致；安装后再启动完整应用验收，不依赖源码中的运行文件。原始报告分别为 `artifacts/frontend-acceptance/report.json` 和 `artifacts/frontend-installed-acceptance/report.json`。

`test:settings` 额外覆盖 9 个真实 DSH 场景：空配置启动、owner 权限、19/20 手工连接测试/保存、密钥不回显、留空保留、更换数据库要求新密钥、重启恢复/默认连接、删除凭据及窄屏深色设置。源码和安装包均使用独立测试 profile，未写入 ERP 业务数据。

`npm test` 67 项通过；`npm run test:matrix` 两套实例各 34 项通过。浅色、深色及 900px 窗口截图已人工查看。Electron 桌面壳、更多版本/定制插件、复杂分栏浮窗和网络中断恢复压力测试仍需专项验证。

## 接入边界

左侧 `sidebar.panellist` 在当前 DSH 只提供图标席位，原生行默认选择 main 面板。为满足三栏设计，`Launcher.tsx` 将父行点击截获集中在一个小适配器中，并恢复原 ARIA 属性及监听器；浮层 Portal 阻断 React 冒泡，避免误切中央页面。此处依赖宿主行结构，需要在 DSH 升级时回归。右侧类型、正文席位、导航、会话创建和 Remote 通信均使用正式接口。

本版仍不提供创建/编辑业务记录、确认订单、调整库存、验证收发货、财务过账、完整操作审批或聊天自动发送。页面导航不会自动向模型发送消息。既有 MTO/服务外包规则继续由 Odoo 原生配置和流程执行。

0.5.1 移除连接表单的公司 ID，连接保存/测试自动发现权限范围；顶部默认 All。页面与 Agent 共用同一范围，切换时取消旧请求并清空业务缓存。快照中的 companyId=0 表示 All，同时给出实际 companyIds；Host 仅使用已授权的正整数公司 ID 调用 Odoo。旧连接若曾手填限制，可编辑后重新保存以自动识别全部授权公司。
