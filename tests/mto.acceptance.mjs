import assert from 'node:assert/strict';
import { loadConfig } from '../dist/core/config.js';
import { OdooClient } from '../dist/odoo/client.js';
import { OdooService } from '../dist/core/service.js';
import { serviceOutsourcingField } from '../dist/odoo/capabilities.js';

// This explicit fixture runner can write only to a separately cloned local acceptance DB.
const original = loadConfig();
const database = process.env.ODOO_ACCEPTANCE_DB;
if (!database || !/^pw_plugins_mto_[a-z0-9_]+$/.test(database) || database === original.database ||
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(original.url).hostname)) {
  throw new Error('Set ODOO_ACCEPTANCE_DB to an isolated local pw_plugins_mto_* clone. The configured application DB is forbidden.');
}
const companyId = original.companyIds[0];
const config = { ...original, database, companyIds: [companyId] };
const service = new OdooService(new OdooClient(config));
const call = async (model, method, params) => {
  const response = await fetch(`${config.url}/json/2/${model}/${method}`, {
    method: 'POST', headers: { Authorization: `bearer ${config.apiKey}`, 'X-Odoo-Database': database, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, context: { allowed_company_ids: [companyId], lang: config.lang, tz: config.timezone } }),
    signal: AbortSignal.timeout(60000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`Acceptance setup failed (${model}/${method}, HTTP ${response.status}); no server error body is exposed.`);
  return response.json();
};
const create = async (model, values) => {
  const ids = await call(model, 'create', { vals_list: [values] });
  const id = Array.isArray(ids) ? ids[0] : ids;
  assert.ok(Number.isSafeInteger(id) && id > 0); return id;
};
const neutralized = await call('ir.config_parameter', 'search_read', {
  domain: [['key', '=', 'database.is_neutralized']], fields: ['value'], limit: 1,
});
assert.ok(neutralized.length === 1 && ['true', 'True', '1'].includes(String(neutralized[0].value)), 'Acceptance clone must be neutralized before creating fixtures.');
const prefix = `PW MTO acceptance ${Date.now()}`;
const status = await service.inventoryStatus();
assert.equal(status.infrastructureReady, true);
const mto = status.routes.find((route) => route.purpose === 'mto').record;
const buy = status.routes.find((route) => route.purpose === 'buy').record;
assert.ok(mto && buy);
if (!mto.active) await call('stock.route', 'write', { ids: [mto.id], vals: { active: true } });
const warehouse = status.warehouses.find((item) => item.company_id[0] === companyId);
assert.ok(warehouse);
const customer = await create('res.partner', { name: `${prefix} customer`, customer_rank: 1, company_id: companyId });
const vendor = await create('res.partner', { name: `${prefix} supplier`, supplier_rank: 1, company_id: companyId });
const seller = () => [[0, 0, { partner_id: vendor, price: 40, delay: 2, company_id: companyId }]];
// A hidden Buy route is automatically considered by native procurement from the product's supplier configuration.
const productRouteIds = [mto.id, ...(buy.product_selectable ? [buy.id] : [])];
const goodsTemplate = await create('product.template', { name: `${prefix} goods`, type: 'consu', is_storable: true,
  company_id: companyId, sale_ok: true, purchase_ok: true, list_price: 100, route_ids: [[6, 0, productRouteIds]], seller_ids: seller() });
const outsourcing = serviceOutsourcingField(await service.fields('product.template'));
assert.ok(outsourcing, 'The instance must expose a supported native service-outsourcing configuration.');
const serviceTemplate = await create('product.template', { name: `${prefix} service`, type: 'service', company_id: companyId,
  sale_ok: true, purchase_ok: true, list_price: 80, [outsourcing.field]: outsourcing.enabledValue, seller_ids: seller() });
const templates = await call('product.template', 'read', { ids: [goodsTemplate, serviceTemplate], fields: ['product_variant_id'] });
const goods = templates.find((item) => item.id === goodsTemplate).product_variant_id[0];
const outsourced = templates.find((item) => item.id === serviceTemplate).product_variant_id[0];
const orderId = await create('sale.order', { partner_id: customer, company_id: companyId, warehouse_id: warehouse.id,
  order_line: [[0, 0, { product_id: goods, product_uom_qty: 3, price_unit: 100 }], [0, 0, { product_id: outsourced, product_uom_qty: 2, price_unit: 80 }]] });
await call('sale.order', 'action_confirm', { ids: [orderId] });
const trace = await service.procurementTrace({ saleOrderId: orderId });
assert.equal(trace.completeWithinLimits, true);
const goodsLine = trace.saleLines.find((line) => line.product_id[0] === goods);
const serviceLine = trace.saleLines.find((line) => line.product_id[0] === outsourced);
assert.ok(goodsLine && serviceLine);
const goodsLink = trace.links.find((link) => link.saleLineId === goodsLine.id && link.kind === 'stock_demand_relation');
const serviceLink = trace.links.find((link) => link.saleLineId === serviceLine.id && link.kind === 'sale_line_relation');
assert.ok(goodsLink, 'Native MTO must expose the generated draft RFQ through stock demand relationships.');
assert.ok(serviceLink, 'Outsourced services must expose a direct sale-line purchase relationship.');
assert.equal(trace.purchaseLines.find((line) => line.id === goodsLink.purchaseLineId).product_qty, 3);
assert.equal(trace.purchaseLines.find((line) => line.id === serviceLink.purchaseLineId).product_qty, 2);
assert.ok(trace.purchaseOrders.every((order) => order.partner_id[0] === vendor && order.state === 'draft'));
assert.ok(trace.moves.some((move) => move.procure_method === 'make_to_order'));
const purchaseOrderIds = trace.purchaseOrders.map((order) => order.id);
await call('purchase.order', 'button_confirm', { ids: purchaseOrderIds });
const receipts = await service.query({ model: 'stock.picking', fields: ['purchase_id', 'state', 'company_id'],
  filters: [{ field: 'purchase_id', operator: 'in', value: purchaseOrderIds }], limit: 10 });
assert.ok(receipts.records.length > 0);
assert.ok(receipts.records.every((receipt) => receipt.state !== 'done'));
const confirmedTrace = await service.procurementTrace({ saleOrderId: orderId });
assert.equal(confirmedTrace.completeWithinLimits, true);
assert.ok(confirmedTrace.purchaseOrders.every((order) => order.state === 'purchase'));
const bounded = await service.procurementTrace({ saleOrderId: orderId, maxLines: 1 });
assert.equal(bounded.truncated, true);
console.log(JSON.stringify({ database, accepted: true, saleOrderId: orderId, serviceOutsourcingField: outsourcing.field, nativeMtoDraftRfqLinked: true,
  buyRouteSelection: buy.product_selectable ? 'explicit_product_route' : 'native_automatic_from_supplier',
  serviceOutsourcingLinked: true, supplierFromProductConfiguration: true, purchaseOrderCount: purchaseOrderIds.length,
  incomingTransferCount: receipts.records.length, confirmedProcurementTrace: true, boundedTrace: true,
  originalDatabaseBusinessRecordsTouched: false, transfersValidated: false }, null, 2));
