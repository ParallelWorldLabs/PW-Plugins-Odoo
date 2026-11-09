# CRM 只读接入（0.2.0）

CRM 是用户明确的前期使用模块。本次将 CRM 接入共享核心、MCP 和 Cordis Host，未实现右侧 CRM 页面或业务写入。测试环境已安装 crm、sales_team 和 sale_crm，无需安装额外 addon。

## 模型与能力

| 模型/工具 | 读取范围 |
| --- | --- |
| `crm.lead` | 线索与商机，按 type 区分；客户、联系人、阶段、负责人、团队、标签、预计/加权收入、币种、赢率、预计成交日期、丢单原因、活动摘要 |
| `crm.stage` | 阶段名称、顺序、赢单标志、折叠标志、适用销售团队 |
| `crm.team` | 团队、公司、负责人、线索/商机开关 |
| `crm.tag` / `crm.lost.reason` | 标签、丢单原因字典 |
| `pw_odoo_crm_activities` | 一条可访问线索/商机的计划活动：类型、摘要、备注、负责人、截止日期、状态 |
| `sale.order.opportunity_id` | 安装 sale_crm 且字段可读时，按稳定商机 ID 查询关联报价/订单 |

查询默认只包含活动记录；`includeArchived: true` 允许同时查询归档记录，需要仅归档时再加 `active = false`。不会改变公司范围或 Odoo 权限。归档不等于丢单，阶段 fold 不等于赢单；结合 `won_status`、`lost_reason_id`、阶段 `is_won` 等事实判断。字段发现会返回 selection 枚举与 monetary 的 currency_field，避免猜测键值或混合不同币种。

## 调用示例

`pw_odoo_query`：查询商机，按预计成交日期排列。

```json
{
  "model": "crm.lead",
  "fields": ["name", "type", "partner_id", "stage_id", "user_id", "team_id", "expected_revenue", "company_currency", "probability", "date_deadline"],
  "filters": [{"field": "type", "operator": "=", "value": "opportunity"}],
  "sort": {"field": "date_deadline", "direction": "asc"},
  "limit": 25
}
```

线索使用相同查询并将 `type` 改为 `lead`。`pw_odoo_get` 用 `model: crm.lead` 与稳定记录 ID 回读详情。未指定 fields 时，CRM 默认返回阶段、负责人、团队、预计收入和币种等常用事实。

`pw_odoo_crm_activities`：将以下 leadId 替换为前一步实际查询得到的 ID。

```json
{"leadId": 123, "limit": 25, "offset": 0}
```

该工具先读取父记录、核对公司，再固定 `res_model = crm.lead` 和 `res_id = leadId`。不允许传入任意活动模型、raw domain 或公司 context；返回绑定不一致时拒绝整个结果。`mail.activity` 不在通用 query/get/fields 工具允许模型中。每个 HTTP 调用独立事务，Odoo 在实际查询时继续执行其权限检查。

本工具读取当前计划活动，不包含完整 chatter 或所有已完成活动历史。Odoo 的活动完成与归档行为取决于活动类型和保留策略，不能以活动列表为空推断从未跟进。协议与字段已参考 [Odoo CRM 源码](https://github.com/odoo/odoo/blob/19.0/addons/crm/models/crm_lead.py)和[活动模型源码](https://github.com/odoo/odoo/blob/19.0/addons/mail/models/mail_activity.py)，并在本机实例核对。ERP 描述与活动备注中的 HTML 仍是不可信数据，未来页面须安全渲染。

## 验收与限制

- `npm test`：23 项离线测试通过，含父记录不可访问/公司超范围/公司身份缺失、活动目标错配、字段白名单、缺失 CRM 模块和归档上下文边界。
- `npm run test:live`：17 项真实只读集成测试通过，覆盖原有五模型与新增五个 CRM 模型、线索/商机区分、归档、公司范围、枚举/币种元数据和报价关联查询。
- 在本机 Odoo 19.0-20251222 同时查到线索与商机样本；选取有计划活动的 CRM 记录，读回一条实际活动并核对目标绑定。未打印业务内容或凭据，未创建测试记录。
- MCP 与 Cordis Host 都完成了 CRM 查询及专用活动工具调用；构建产物仍可独立启动。
- 未验证 Odoo 20、普通权限用户或完整 DSH 中央 Agent/浏览器界面。CRM 创建、编辑、阶段变更、赢单/丢单和活动完成均未开放。
