# 开发预览验证

最新 **0.5.1** 已实现真实 DSH Web 工作台，销售与采购为独立分页，设置支持手动连接管理及未配置启动；新增 9 个首次使用/凭据/重启恢复浏览器场景。67 项离线测试、19/20 各 34 项真实只读 API 测试通过；官方 profile 的实际 Session/Agent、Host/Client 严格契约、浏览器页面往返和安装包验证见 [FRONTEND.md](FRONTEND.md)。MCP 保持七个业务工具，DSH 增加两个页面工具，共 22 个通用模型。0.3.1 的双版本适配证据见 [COMPATIBILITY.md](COMPATIBILITY.md)，库存/MTO 克隆库业务验收仍有效。下文保留早期基线；旧的“页面未实现/未启动完整 DSH”状态不再代表本版，Electron 桌面壳及更广业务场景仍待专项验证。

日期：2026-11-08（Asia/Shanghai）。下文为早期验证历史，当前前端验收以本节及 FRONTEND.md 为准。

## 已执行

| 检查 | 结果与边界 |
| --- | --- |
| TypeScript strict 编译 | 通过，TypeScript 5.9.3。 |
| `npm test` | 18 项通过，Node.js 20.20.0。使用本机临时 HTTP 服务模拟 JSON-2 返回，不冒充真实 ERP。 |
| 请求契约 | 验证五个模型、命名参数、认证头、数据库头、固定公司上下文、稳定排序与字段投影。 |
| 权限/输入边界 | 拒绝任意模型、禁止字段、关系路径、排序注入、原始 domain、公司 context 覆盖、超大页与任意写方法。字段缺失明确报错。 |
| 网络/错误 | 验证 401/403/429/500 不转发密钥/traceback；不跟随 302；取消、超时、非法 JSON、2 MiB 上限、IP 地址检查。 |
| 版本与状态 | GET `/web/version`，读取 `version`；版本探测失败保留 unknown，API 权限通过 fields_get 独立验证。 |
| 官方 MCP SDK | InMemory 客户端完成握手/工具列表/调用/拒绝；真正 stdio 子进程完成握手与四个只读工具发现。 |
| Cordis / DSH Tools | 真实 Cordis 4.1.0 与 DSH Tools 0.2.2-rc.1 注册四个工具，验证调用、取消信号传递、参数拒绝和卸载后零残留。仅 systemPrompt 的装配入口使用测试桩，不是完整 DSH Agent 回合。 |
| 干净包启动 | npm pack 后解压到临时目录，不安装 node_modules；官方 MCP 客户端成功启动包内入口并发现四个工具，Cordis Host 模块也可独立 import。 |
| 标准清单 | 下载 Agent Plugins 1.0.0 官方 plugin/mcp JSON Schema，用 Ajv draft-2020 校验两份清单通过。这是 schema 验证，尚未逐个客户端安装。 |
| Skill | skill-creator 的 quick_validate.py 检查通过。 |
| 生产依赖审计 | npm 官方 registry audit 报告 0 个已报告漏洞；默认 npmmirror 审计端点未实现，改用单次官方 registry 参数，未修改用户 npm 配置。该报告不等于完整安全审计。 |
| 仓库差异 | git diff --check 通过；不含密钥、ERP 数据或运行日志。 |

## 尚未执行

- Odoo 20 社区版真实测试库；Odoo 19 的普通权限用户、定制字段/记录规则和更多公司场景（已通过的管理员只读联调见下文）。
- 完整 DSH `fcc0ad46`（0.2.2-rc.1）Node >=24.9 部署、中央 Agent 工具可见性和真实调用。
- 左侧菜单/右侧 Client、生成 Remote 装配、页面上下文和动作回执；这些功能尚未实现。
- 浏览器浅/深主题、键盘、窄栏、非会话启动、跨会话/多窗口隔离和真实界面卸载。
- 草稿、确认、付款、库存或其他业务写入；首版根本未开放写工具。

初轮离线验证时未启动 Docker、拉取镜像或创建数据库。随后使用用户已建立的本机测试库执行下述只读联调；未新建数据库或修改 ERP 业务数据。

## 本机 Odoo 19 真实联调

用户明确说明这是本机独立测试环境并提供访问凭据，授权范围用于本插件开发联调。地址 `http://localhost:8079`，数据库 `plugins`；凭据未写入本报告、源码或测试输出，仅保存在 gitignored `.env`，权限 0600。未保存用户名/密码，仅使用 API key。

- 实际版本：`19.0-20251222`，API 用户 ID 2；公司范围从当前用户读取，当前公司 1，可访问公司顺序 `[1, 3, 2]`。
- 用户语言 `zh_CN`、时区 `Europe/Brussels`；沿用实例用户设置，没有更改 ERP 用户时区。
- 已安装：base、web、sale、purchase、account；stock 未安装，未尝试安装。
- 发现并修复：GET `/web/version` 在此部署必须携带 `X-Odoo-Database`，否则返回 404。客户端版本探测现发送数据库头，仍不向公共版本端点发送 API key；已加入回归断言。
- 五模型均返回非空首批记录，字段发现、最多两条查询、ID 筛选与详情身份回读通过。报告不保存具体业务内容。
- 将上下文收窄为公司 1，销售和采购查询只返回该公司记录；请求其他公司记录返回空。仅证明当前管理员测试用户与这两个模型的实际行为，未覆盖普通权限用户或所有定制记录规则。
- 官方 MCP 客户端通过真实 stdio 服务完成四工具调用，禁止模型请求返回错误。
- 真实 Cordis 4.1.0 / DSH Tools 0.2.2-rc.1 注册本包 Host 插件，完成四工具到真实 Odoo 的读取及卸载清理。systemPrompt 入口仍为装配测试桩，不代替完整 DSH 中央 Agent 验收。
- `npm run test:live`：9 项只读集成测试通过；`npm test`：18 项离线测试通过。

上文“尚未执行”的真实实例清单现已有本节列出的 Odoo 19 管理员场景证据；Odoo 20、普通权限用户、完整 DSH Client/Agent 和浏览器界面仍待完成。

## 复现

```sh
cd PW-Plugins-Odoo
npm ci
npm test
python3 /path/to/skill-creator/scripts/quick_validate.py skills/odoo-operations
npm audit --omit=dev --registry=https://registry.npmjs.org
```

技能校验脚本属于开发环境工具，运行插件不依赖该绝对路径。普通构建/测试只需要项目 Node 与 npm 依赖。上游及 SDK 测试未在此执行，以上结果仅针对本仓库实现。
