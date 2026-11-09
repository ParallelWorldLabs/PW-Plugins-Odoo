# Odoo 19 / 20 兼容验证（0.3.1）

0.5.1 延续下述双版本适配，并在实际 DSH Web 工作台完成界面/Agent 联调；当前界面范围和证据见 [FRONTEND.md](FRONTEND.md)。本文件保留 0.3.1 基线。

验证日期：2026-11-08（Asia/Shanghai）。仅记录已实际验证的两个本机社区版实例，不宣称所有定制部署或未来构建均已覆盖。

| 项目 | Odoo 19 | Odoo 20 |
| --- | --- | --- |
| 实际版本 | 19.0-20251222 | 20.0-20260926 |
| 地址 / 数据库 | localhost:8079 / plugins | localhost:8070 / plugin |
| 本机配置 | `.env` | `.env.odoo20` |
| 公司范围（首个为当前公司） | 1, 3, 2 | 1, 3, 2, 4 |
| 用户语言 / 时区 | zh_CN / Europe/Brussels | zh_CN / Asia/Shanghai |
| CRM、销售、采购、库存及 MTO 桥接 | 已安装；19 的库存由前一轮授权安装 | 本轮检查时均已安装，未再安装/升级 |
| 只读集成测试 | 34 项通过，零跳过 | 34 项通过，零跳过 |
| 实物 MTO + 服务外包 | 克隆库复测通过 | 克隆库验收通过 |

API Key 仅保存在本机 0600 的 gitignored 配置，不存于本文、源码、日志或插件包。默认 `.env` 保持指向 Odoo 19；Odoo 20 配置未覆盖它。

## 发现与修复

初轮 20 的基础列表测试 31 项已通过，但进一步对比 22 个模型后发现，6 个模型存在当前白名单字段缺失。基础列表并不足以证明全部能力。已增加专项测试以及对所有可用白名单字段的有界读取。

| 模型/行为 | 19 测试库 | 20 测试库 | 处理 |
| --- | --- | --- | --- |
| purchase.order.line 单位 | product_uom_id | uom_id | 白名单/默认列覆盖真实字段；追溯按元数据选取 |
| product.supplierinfo 单位 | product_uom_id | uom_id | 补充 uom_id，保留供应商价格/数量门槛的单位上下文 |
| stock.move 单位 | product_uom | uom_id | 库存默认列和追溯动态解析，避免有移动记录时失败 |
| stock.move.line 单位 | product_uom_id | uom_id | 明细默认列覆盖两种实际名称 |
| sale.order.line 单位 | product_uom_id | product_uom_id | 保持原字段，不假设所有模型同时改名 |
| product.template / product.product 服务外包 | service_to_purchase = true | service_tracking = subcontract | 新增服务配置能力解析与字段发现，不再写死旧字段 |
| Buy 路线选择 | 隐藏路线也可由原生供应商采购生效 | 本测试库 Buy 为 product_selectable=false，直接绑定到产品会被拒绝 | 验收仅绑定可选择路线；隐藏 Buy 由原生供应商配置触发 |
| 克隆库 neutralized 标志读取 | 原脚本使用 get_param | 该实例的 JSON-2 get_param 返回 404 | 验收改用固定 key 的 search_read，19/20 均通过；未开放通用配置工具 |

`src/odoo/capabilities.ts` 验证候选单位字段确为 many2one → uom.uom，无法确定时拒绝；不只根据版本号猜测。服务外包仅识别旧 boolean 或明确含 subcontract 的 selection，避免把普通“创建任务/项目”误当采购配置。采购追溯新增 quantityUnitFields，明确标出三个模型的实际单位键；通用 query/get/fields 继续使用实例真实技术字段名。

源码语义补充核对：[20 服务外包](https://github.com/odoo/odoo/blob/20.0/addons/sale_purchase/models/product_template.py)、[20 采购明细](https://github.com/odoo/odoo/blob/20.0/addons/purchase/models/purchase_order_line.py)、[20 库存移动](https://github.com/odoo/odoo/blob/20.0/addons/stock/models/stock_move.py)。实际采用的字段以本次实例 fields_get 和读取结果为准。

## 验证证据

- `npm test`：37 项离线测试通过，含三个能力解析测试、20 追溯单位字段回归、既有策略与打包检查。
- `npm run test:matrix`：19、20 各 34 项真实只读集成测试通过。除 22 模型列表/详情/ID 筛选，还验证全部当前可用白名单字段、单位默认返回、服务外包配置、CRM、库存诊断、实际采购追溯及七工具的 MCP/Cordis Host 调用。
- 19 的既有去活化克隆库复测通过：旧服务开关、自动 Buy 补给、混合订单、2 张 RFQ、确认采购后 1 张收货单、追溯和上限回执均通过。
- 20 从原 `plugin` 库备份并建立独立克隆 `pw_plugins_mto_odoo20_20261108`，用官方 neutralize 命令去活化。创建/确认的验收单据仅在克隆中，未修改原 20 库的产品、路线或业务订单。
- 20 克隆的混合订单验收通过：实物 3 件使用 MTO 与供应商配置，服务 2 件使用 service_tracking=subcontract；形成 2 张 RFQ，确认采购后 1 张收货单，实物库存需求与服务直接关联均正确。未执行收发货过账。

原 20 服务的 dbfilter 仅允许其现有数据库，不能通过同一个入口访问新克隆。为此临时运行了仅绑定 localhost:8071 的独立验收容器，使用相同镜像和只读挂载、单独临时数据目录，cron 关闭；未修改原服务 dbfilter 或重启原容器。验收容器已在完成后停止并删除，克隆数据库和本机备份保留供检查。

## 复现与边界

```sh
npm test
npm run test:live       # Odoo 19，本机 .env
npm run test:live:20    # Odoo 20，本机 .env.odoo20
npm run test:matrix    # 两套环境分开验证
```

真实写入验收仍用受限的 `tests/mto.acceptance.mjs`，只允许另建的本机、已去活化且名称以 pw_plugins_mto_ 开头的克隆。`npm run test:mto:20` 使用 20 配置；原服务器 dbfilter 限制仍在，需先建立允许访问克隆的隔离测试入口，不能直接对原 plugin 库运行。不要把克隆的测试入口当成生产配置。

以下仍未验收：普通权限用户、所有定制 addon、复杂仓库/退货/取消/数量变更、库存实际过账、完整 DSH 中央 Agent 与浏览器页面。本次只更新当前七个只读工具的 19/20 适配，不新增业务写工具或右侧页面。
