# 库存与 MTO（0.3.0）

后续 0.3.1 已完成 Odoo 19/20 双实例及双克隆库回归，并修复单位/服务外包配置差异；本文保留首次库存接入证据。当前结果和实际字段映射见 [COMPATIBILITY.md](COMPATIBILITY.md)。

日期：2026-11-08（Asia/Shanghai）。目标是兼容实物与服务业务：实物依赖官方库存/MTO 补给，外包服务继续采用官方 sale_purchase。插件提供查询与追溯，不开放订单确认、库存调整或收发货过账工具。

## 本机部署结果

用户授权的本机测试库 `plugins` 已安装 `stock`、`stock_account`、`sale_stock`、`purchase_stock`、`sale_purchase_stock`；既有 `sale_purchase` 保留。安装前数据库备份保存于本机 gitignored `artifacts/private/`，权限 0600，备份不进入插件包。安装由官方模块生命周期完成，可能初始化仓库、规则及随环境启用的演示数据；未批量改动用户既有产品路线或确认既有订单。

安装后检查：六个依赖均为 installed；原生 MTO 路线与采购路线存在且 active，有公司 1 的仓库。路线按固定 external ID 识别，不以中文/英文显示名猜测。

依据 [sale_purchase_stock 官方清单](https://github.com/odoo/odoo/blob/19.0/addons/sale_purchase_stock/__manifest__.py)，该桥接依赖 sale_stock、purchase_stock、sale_purchase。采用现有实现，不复制另一个采购引擎。

## 由产品设置控制

- **实物**：在 Odoo 产品的库存/路线配置 MTO，配置可用的采购补给规则、供应商、数量门槛、价格/币种及交期。仓库、公司和产品可售/可采购状态也必须匹配。按当前原生界面/模块版本配置，不能只看到 MTO 勾选就忽略供应商和采购规则。
- **服务外包**：服务类型产品启用“分包服务”并配置供应商；沿用 sale_purchase。不要把服务产品强行变成库存产品。
- 插件不维护独立的启用产品名单；展示产品 route_ids、类别继承路线 route_from_categ_ids、seller_ids、service_to_purchase 等可读配置。实际补给及供应商选择由 Odoo 原生流程执行，可能受公司、供应商顺序、适用数量、单位、日期和产品变体影响。
- 先在 Odoo 原生界面确认销售单，满足条件后由 Odoo 生成 RFQ。查询与诊断本身不会创建采购单。不要把 RFQ 草稿、已确认 PO、已收货视为同一状态。

## 查询范围

| 模型 | 可读内容 |
| --- | --- |
| stock.warehouse / stock.location | 仓库、库位、用途及公司 |
| stock.picking.type / stock.picking | 作业类型、收发货状态、时间、销售/采购来源及欠单关联 |
| stock.move / stock.move.line | 需求量、当前 quantity、单位、移动状态、来源/目的库位、批次引用 |
| stock.quant | 按产品/库位/公司等分开的现存、预留和可用数量 |
| stock.route / stock.rule | 路线、动作、补给方式、仓库与来源/目的库位 |
| sale.order.line / purchase.order.line | 单据明细、需求/采购量、单位、已交付/已接收数量及实际关联 |
| product.supplierinfo | 供应商、适用产品、公司、价格/币种、单位、数量门槛和交期 |

加上原有十个通用模型，共 22 个。仍有每页 100 条和公司上下文限制。stock.quant 的明细页不是全公司总量；不能忽略库位用途、批次、货主或单位直接相加。库存移动的 quantity 也不自动代表已完成交付，须结合 state 和实际业务语义。

## 专用工具

`pw_odoo_stock_status({})` 返回官方依赖状态、MTO/Buy external ID 对应路线、active 标志及最多 25 个可见仓库。`infrastructureReady` 只表示所需模块已安装；`globalRoutesActive` 表示读到的全局路线启用，`productReadiness: not_evaluated` 明确没有认证所有产品配置。技术模块/外部 ID 读取可能要求额外 Odoo 权限；普通库存查询继续按模型权限执行。

`pw_odoo_procurement_trace` 示例（saleOrderId 替换为实际 ID）：

```json
{"saleOrderId": 123, "maxLines": 10, "maxMoves": 50, "maxDepth": 4}
```

追溯使用固定公司下的实际关系：

1. 验证销售单与销售明细的稳定身份及公司。
2. 读取销售明细 purchase_line_ids，支持外包服务等直接关联。
3. 由销售明细 move_ids 遍历库存移动的 move_orig_ids，读取 purchase_line_id 与 created_purchase_line_ids；后者可识别尚未确认的 RFQ 与需求关系。
4. 回读已授权的采购明细与采购单，附带状态和单位。

不按 origin、单号、产品名称相似度或相同商机猜测 SO/PO 关系。结果中的关系证明来源关系，不证明配置一定为 MTO，也不保证某采购数量专属于该销售行；合并采购、拆分及多步移动需按实际关系解释。

上限：最多 25 条销售明细、100 个库存移动、8 层上游、100 条采购明细/单，关系证据最多 500 条。循环终止，跨销售行共用节点可复用读取。到上限返回 truncated；关联记录不可见/缺失时返回 unresolvedRecordCount，completeWithinLimits 为 false。即使为 true，也仅表示这次可见读取在所设上限内完成，不能绕过 Odoo 权限或把多个独立 HTTP 调用视为单一事务快照。

## 已执行验收

- **33 项离线测试通过**：原有策略及 CRM 回归；库存字段边界、诊断、直接/上游关系、循环、共享节点、数量/深度限制、公司/身份错配、缺失关联和非法输入。
- **31 项本机只读集成测试通过**：22 个通用模型、原有 CRM、库存模块/路线/仓库、原生单据追溯、真实 MCP 与 Cordis Host 的七工具装配和调用。
- 从安装后数据库创建独立克隆 `pw_plugins_mto_acceptance_20261108`，用 Odoo 官方 neutralize 命令完成去活化后才创建验收业务。原应用 `.env` 仍指向 `plugins`。
- 在克隆库创建一个实物、一个服务、一个供应商和混合销售单：实物数量 3，配置 MTO+Buy；服务数量 2，配置分包；供应商来源为各自产品的供应商配置。
- 确认克隆库销售单后产生 **2 张 RFQ**；实物由库存需求关系追溯，服务由销售明细直连追溯，两种采购数量均核对通过。
- 确认验收采购单后产生 **1 张收货单**，再次追溯通过；未验证收发货过账或实际库存入账。没有用原测试库的既有业务单据做写入验收。

验收脚本 `tests/mto.acceptance.mjs` 仅接受本机、名称以 pw_plugins_mto_ 开头且与应用数据库不同的独立克隆；还必须存在 neutralized 标志。它会在该克隆创建/确认验收单据，不属于只读工具，也不打入标准插件包。

复现已有克隆上的验收（每次创建新测试单据）：

```sh
ODOO_ACCEPTANCE_DB=pw_plugins_mto_acceptance_20261108 npm run test:mto
```

Odoo 20 的当前基础查询及混合采购链路已在 0.3.1 验证。普通权限用户、更多仓库路线、退货/取消/变更数量、库存过账及完整 DSH 页面仍待专项验收。本版未增加自定义服务端 addon，也未开放库存调整、预留、确认采购或验证收发货的 Agent 写工具。
