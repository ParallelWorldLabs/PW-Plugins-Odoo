import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryStatus, procurementTrace } from '../dist/core/stock.js';

function fixture() {
  const company = [1, 'Test company'];
  const data = {
    'sale.order': [{ id: 1, name: 'SO-test', company_id: company, state: 'sale' }],
    'sale.order.line': [
      { id: 10, order_id: [1, 'SO-test'], company_id: company, product_id: [50, 'Goods'], product_uom_id: [1, 'Units'], display_type: false, move_ids: [100], purchase_line_ids: [] },
      { id: 11, order_id: [1, 'SO-test'], company_id: company, product_id: [51, 'Service'], product_uom_id: [1, 'Units'], display_type: false, move_ids: [], purchase_line_ids: [201] },
    ],
    'stock.move': [
      { id: 100, company_id: company, state: 'waiting', move_orig_ids: [101], purchase_line_id: false, created_purchase_line_ids: [200] },
      { id: 101, company_id: company, state: 'assigned', move_orig_ids: [], purchase_line_id: [200, 'PO line'], created_purchase_line_ids: [] },
    ],
    'purchase.order.line': [200, 201].map((id) => ({ id, company_id: company, order_id: [300, 'PO-test'], product_uom_id: [1, 'Units'] })),
    'purchase.order': [{ id: 300, company_id: company, state: 'draft' }],
  };
  const calls = [];
  const client = { scope: { companyIds: [1], database: 'test' } };
  const service = {
    fields: async () => ({ product_uom_id: { type: 'many2one', relation: 'uom.uom' } }),
    get: async ({ model, id }) => ({ record: data[model]?.find((record) => record.id === id) ?? null }),
    query: async (args) => {
      calls.push(args);
      let records = [...(data[args.model] ?? [])];
      for (const filter of args.filters ?? []) records = records.filter((record) => {
        const raw = record[filter.field];
        const value = Array.isArray(raw) && typeof raw[1] === 'string' ? raw[0] : raw;
        return filter.operator === 'in' ? filter.value.includes(value) : value === filter.value;
      });
      return { records: records.slice(0, args.limit), nextOffset: null };
    },
  };
  return { service, client, data, calls };
}

test('mixed goods/services trace uses direct links and upstream stock relations, never origin text', async () => {
  const { service, client, calls } = fixture();
  const result = await procurementTrace(service, client, { saleOrderId: 1 });
  assert.equal(result.completeWithinLimits, true);
  assert.ok(result.links.some((link) => link.saleLineId === 10 && link.purchaseLineId === 200 && link.kind === 'stock_demand_relation'));
  assert.ok(result.links.some((link) => link.saleLineId === 10 && link.purchaseLineId === 200 && link.kind === 'stock_purchase_move'));
  assert.ok(result.links.some((link) => link.saleLineId === 11 && link.purchaseLineId === 201 && link.kind === 'sale_line_relation'));
  assert.equal(result.purchaseOrders.length, 1);
  assert.ok(calls.every((args) => !(args.filters ?? []).some((filter) => ['origin', 'name'].includes(filter.field))));
});

test('Odoo 20 trace requests native unit fields across sales, stock and purchases', async () => {
  const { service, client, calls } = fixture();
  service.fields = async (model) => model === 'sale.order.line'
    ? { product_uom_id: { type: 'many2one', relation: 'uom.uom' } }
    : { uom_id: { type: 'many2one', relation: 'uom.uom' } };
  const result = await procurementTrace(service, client, { saleOrderId: 1 });
  assert.equal(result.completeWithinLimits, true);
  assert.deepEqual(result.quantityUnitFields, { 'sale.order.line': 'product_uom_id', 'purchase.order.line': 'uom_id', 'stock.move': 'uom_id' });
  for (const request of calls.filter((args) => ['stock.move', 'purchase.order.line'].includes(args.model))) {
    assert.ok(request.fields.includes('uom_id'));
    assert.ok(!request.fields.includes('product_uom') && !request.fields.includes('product_uom_id'));
  }
});

test('trace marks line, node and depth bounds rather than claiming completeness', async () => {
  for (const limits of [{ maxLines: 1 }, { maxMoves: 1 }, { maxDepth: 1 }]) {
    const { service, client } = fixture();
    const result = await procurementTrace(service, client, { saleOrderId: 1, ...limits });
    assert.equal(result.truncated, true);
    assert.equal(result.completeWithinLimits, false);
    if (limits.maxMoves) assert.ok(result.moves.length <= limits.maxMoves);
  }
});

test('cyclic/shared stock moves terminate and preserve provenance', async () => {
  const { service, client, data, calls } = fixture();
  data['stock.move'][1].move_orig_ids = [100];
  data['sale.order.line'][1].move_ids = [100];
  const result = await procurementTrace(service, client, { saleOrderId: 1 });
  assert.equal(result.completeWithinLimits, true);
  assert.equal(result.moves.length, 2);
  assert.ok(result.links.some((link) => link.saleLineId === 11 && link.purchaseLineId === 200));
  assert.equal(calls.filter((args) => args.model === 'stock.move').length, 2);
});

test('trace rejects missing root, cross-company records and wrong relationship identities', async () => {
  for (const mutate of [
    (data) => { data['sale.order'] = []; },
    (data) => { data['sale.order'][0].company_id = [99, 'Other']; },
    (data) => { data['stock.move'][0].company_id = [99, 'Other']; },
    (data) => { data['purchase.order.line'][0].company_id = [2, 'Other']; },
    (data) => { data['stock.move'][0].move_orig_ids = ['not-an-id']; },
  ]) {
    const { service, client, data } = fixture(); mutate(data);
    await assert.rejects(procurementTrace(service, client, { saleOrderId: 1 }));
  }
  const { service, client } = fixture();
  const query = service.query;
  service.query = async (args) => args.model === 'sale.order.line' ? { records: [{ id: 12, company_id: [1, 'Test'], order_id: [2, 'Different'] }] } : query(args);
  await assert.rejects(procurementTrace(service, client, { saleOrderId: 1 }), { code: 'INVALID_RESPONSE' });
});

test('inaccessible linked records are reported as unresolved and not fabricated', async () => {
  const { service, client, data } = fixture();
  data['stock.move'] = data['stock.move'].slice(0, 1);
  data['purchase.order.line'] = data['purchase.order.line'].slice(1);
  const result = await procurementTrace(service, client, { saleOrderId: 1 });
  assert.equal(result.completeWithinLimits, false);
  assert.equal(result.unresolvedRecordCount, 2);
  assert.ok(!result.links.some((link) => link.purchaseLineId === 200));
});

test('trace validates limits and refuses arbitrary domains before any ERP reads', async () => {
  const { service, client } = fixture();
  service.get = () => { assert.fail('ERP read must not occur'); };
  for (const args of [{ saleOrderId: 1, maxMoves: 1000 }, { saleOrderId: 1, maxDepth: 0 }, { saleOrderId: 1, domain: [] }]) {
    await assert.rejects(procurementTrace(service, client, args));
  }
});

test('missing inventory dependencies return diagnostics without touching absent stock models', async () => {
  const client = { scope: { companyIds: [1] }, readCall: async () => [{ name: 'stock', state: 'uninstalled' }] };
  const service = { get() { assert.fail(); }, query() { assert.fail(); } };
  const result = await inventoryStatus(service, client);
  assert.equal(result.infrastructureReady, false);
  assert.ok(result.missingModules.includes('stock'));
  assert.equal(result.productReadiness, 'not_evaluated');
});

test('route diagnostics use stable external IDs and distinguish archived routes from missing infrastructure', async () => {
  const dependencies = ['stock', 'stock_account', 'sale_stock', 'purchase_stock', 'sale_purchase', 'sale_purchase_stock'];
  const requests = [];
  const client = { scope: { companyIds: [1] }, readCall: async (model, method, params) => {
    requests.push({ model, method, params });
    if (model === 'ir.module.module') return dependencies.map((name) => ({ name, state: 'installed' }));
    return [{ module: 'stock', name: 'route_warehouse0_mto', model: 'stock.route', res_id: 1 }, { module: 'purchase_stock', name: 'route_warehouse0_buy', model: 'stock.route', res_id: 6 }];
  } };
  const service = {
    get: async ({ id }) => ({ record: { id, company_id: false, active: id !== 1, name: 'Translated label' } }),
    query: async () => ({ records: [{ id: 1, company_id: [1, 'Test'] }], nextOffset: null }),
  };
  const result = await inventoryStatus(service, client);
  assert.equal(result.infrastructureReady, true);
  assert.equal(result.globalRoutesActive, false);
  assert.equal(result.routes[0].externalId, 'stock.route_warehouse0_mto');
  assert.ok(!JSON.stringify(requests).includes('Translated label'));
});
