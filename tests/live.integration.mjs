import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { loadConfig } from '../dist/core/config.js';
import { OdooClient } from '../dist/odoo/client.js';
import { OdooService } from '../dist/core/service.js';
import { Context } from '@deepseek-ai/cordis';
import { ToolsService } from '@deepseek-ai/dsh-tools';
import * as hostPlugin from '../dist/cordis/index.js';
import TypertRegistry from '@deepseek-ai/dsh-typert-registry';
import { modelSchema } from '../dist/core/contracts.js';
import { quantityUnitField, serviceOutsourcingField } from '../dist/odoo/capabilities.js';

// Explicit opt-in via npm run test:live. No record contents or credentials are logged.
const config = loadConfig();
const service = new OdooService(new OdooClient(config));
const models = modelSchema.options;

test('live version detection and authenticated metadata', async () => {
  const status = await service.status();
  assert.equal(status.authenticated, true);
  assert.equal(status.readOnly, true);
  assert.ok(status.version !== null && /^(19|20)\./.test(status.version));
  assert.deepEqual(status.scope.companyIds, config.companyIds);
});

for (const model of models) {
  test(`live fields, bounded query, filter and detail: ${model}`, async () => {
    const metadata = await service.fields(model);
    assert.ok(Object.hasOwn(metadata, 'id'));
    const fields = ['id', 'name', 'company_id', 'state', 'currency_id', 'amount_total'].filter((name) => Object.hasOwn(metadata, name));
    const page = await service.query({ model, fields, limit: 2 });
    assert.ok(page.records.length <= 2);
    for (const record of page.records) {
      if (Array.isArray(record.company_id)) assert.ok(config.companyIds.includes(record.company_id[0]));
    }
    if (!page.records.length) return; // Empty databases verify discovery/query only.
    const id = page.records[0].id;
    const detail = await service.get({ model, id, fields });
    assert.equal(detail.record?.id, id);
    const filtered = await service.query({ model, fields: ['id'], filters: [{ field: 'id', operator: '=', value: id }], limit: 2 });
    assert.equal(filtered.records.length, 1);
    assert.equal(filtered.records[0].id, id);
  });
}

test('live company context can be narrowed for sales and purchases', async () => {
  const companyId = config.companyIds[0];
  const narrow = new OdooService(new OdooClient({ ...config, companyIds: [companyId] }));
  for (const model of ['sale.order', 'purchase.order']) {
    const page = await narrow.query({ model, fields: ['id', 'company_id'], limit: 10 });
    assert.ok(page.records.every((record) => Array.isArray(record.company_id) && record.company_id[0] === companyId));
    const otherCompanies = await narrow.query({ model, fields: ['id'], filters: [{ field: 'company_id', operator: '!=', value: companyId }], limit: 10 });
    assert.equal(otherCompanies.records.length, 0);
  }
});

test('live CRM leads, opportunities, archived visibility and company scope', async () => {
  for (const type of ['lead', 'opportunity']) {
    const page = await service.query({ model: 'crm.lead', filters: [{ field: 'type', operator: '=', value: type }], limit: 5 });
    assert.ok(page.records.every((record) => record.type === type));
    if (page.records.length) assert.ok(Object.hasOwn(page.records[0], 'company_currency'));
  }
  const archived = await service.query({ model: 'crm.lead', includeArchived: true, fields: ['id', 'active'], filters: [{ field: 'active', operator: '=', value: false }], limit: 2 });
  assert.ok(archived.records.every((record) => record.active === false));
  const companyId = config.companyIds[0];
  const narrow = new OdooService(new OdooClient({ ...config, companyIds: [companyId] }));
  const page = await narrow.query({ model: 'crm.lead', fields: ['id', 'company_id'], limit: 10 });
  assert.ok(page.records.every((record) => record.company_id === false || (Array.isArray(record.company_id) && record.company_id[0] === companyId)));
});

test('live CRM activity query is bound to one accessible lead or opportunity', async (t) => {
  let page = await service.query({ model: 'crm.lead', fields: ['id'], filters: [{ field: 'activity_date_deadline', operator: '!=', value: false }], limit: 1 });
  const hasScheduledActivities = page.records.length > 0;
  if (!hasScheduledActivities) page = await service.query({ model: 'crm.lead', fields: ['id'], limit: 1 });
  if (!page.records.length) return t.skip('No CRM records available; no test records are created.');
  const leadId = page.records[0].id;
  const activities = await service.crmActivities({ leadId, limit: 5 });
  if (hasScheduledActivities) assert.ok(activities.records.length > 0);
  assert.ok(activities.records.every((record) => record.res_model === 'crm.lead' && record.res_id === leadId));
});

test('live CRM metadata explains selections and currency; related quotations remain bounded', async () => {
  const fields = await service.fields('crm.lead');
  assert.ok(fields.type.selection.some(([value]) => value === 'lead'));
  assert.ok(fields.type.selection.some(([value]) => value === 'opportunity'));
  assert.equal(fields.expected_revenue.currency_field, 'company_currency');
  const orders = await service.fields('sale.order');
  if (!Object.hasOwn(orders, 'opportunity_id')) return;
  const leads = await service.query({ model: 'crm.lead', fields: ['id'], limit: 1 });
  if (!leads.records.length) return;
  const id = leads.records[0].id;
  const page = await service.query({ model: 'sale.order', fields: ['id', 'opportunity_id'], filters: [{ field: 'opportunity_id', operator: '=', value: id }], limit: 5 });
  assert.ok(page.records.every((record) => Array.isArray(record.opportunity_id) && record.opportunity_id[0] === id));
});

test('live inventory dependencies, native route identities and warehouses are readable', async () => {
  const status = await service.inventoryStatus();
  assert.equal(status.infrastructureReady, true);
  assert.equal(status.missingModules.length, 0);
  assert.ok(status.routes.every((route) => route.record !== null));
  assert.equal(status.productReadiness, 'not_evaluated');
  const products = await service.fields('product.template');
  assert.ok(Object.hasOwn(products, 'route_ids'));
  assert.ok(Object.hasOwn(products, 'seller_ids'));
});

test('live quantity-bearing models return their native unit alongside quantities', async () => {
  for (const model of ['sale.order.line', 'purchase.order.line', 'product.supplierinfo', 'stock.move', 'stock.move.line']) {
    const metadata = await service.fields(model);
    const unitField = quantityUnitField(metadata);
    const page = await service.query({ model, limit: 1 });
    assert.ok(page.fields.includes(unitField), `${model} must include its native unit field`);
    assert.ok(page.records.every((record) => Object.hasOwn(record, unitField)), `${model} must return its native unit field`);
  }
});

test('live product metadata exposes the supported service-outsourcing configuration', async () => {
  for (const model of ['product.template', 'product.product']) {
    const metadata = await service.fields(model);
    const capability = serviceOutsourcingField(metadata);
    assert.ok(capability, `${model} must expose the installed outsourcing capability`);
    const page = await service.query({ model, fields: ['id', 'type', capability.field], limit: 1 });
    assert.ok(page.records.every((record) => Object.hasOwn(record, capability.field)));
  }
});

test('live bounded reads cover every available allowlisted field, not only basic list columns', async () => {
  for (const model of models) {
    const fields = Object.keys(await service.fields(model));
    for (let offset = 0; offset < fields.length; offset += 24) {
      const selected = fields.slice(offset, offset + 24);
      const page = await service.query({ model, fields: selected, limit: 1 });
      assert.ok(page.records.every((record) => selected.every((field) => Object.hasOwn(record, field))), `${model} must return each requested available field`);
    }
  }
});

test('live procurement trace is bound to one accessible sales order', async (t) => {
  const page = await service.query({ model: 'sale.order', fields: ['id'], limit: 1 });
  if (!page.records.length) return t.skip('No sales orders; no fixtures are written to the application DB.');
  const id = page.records[0].id;
  const trace = await service.procurementTrace({ saleOrderId: id, maxLines: 3, maxMoves: 10 });
  assert.equal(trace.saleOrder.id, id);
  assert.ok(trace.saleLines.every((line) => line.order_id[0] === id));
  assert.ok(trace.moves.length <= 10);
  for (const model of ['sale.order.line', 'purchase.order.line', 'stock.move']) assert.equal(trace.quantityUnitFields[model], quantityUnitField(await service.fields(model)));
});

test('live stdio MCP performs status, metadata, query and detail against the real instance', async () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => key.startsWith('ODOO_') && typeof value === 'string'));
  const transport = new StdioClientTransport({ command: process.execPath, args: ['dist/mcp/stdio.js'], env, stderr: 'pipe' });
  const client = new Client({ name: 'pw-odoo-live-acceptance', version: '0.1.0' });
  await client.connect(transport);
  try {
    assert.equal((await client.listTools()).tools.length, 7);
    const call = async (name, args = {}) => {
      const response = await client.callTool({ name, arguments: args });
      assert.ok(!response.isError, `${name} returned a sanitized error`);
      return JSON.parse(response.content[0].text);
    };
    const hostStatus = await call('pw_odoo_status');
    assert.equal(hostStatus.authenticated, true);
    assert.equal(hostStatus.scope.database, config.database);
    assert.equal(hostStatus.scope.url, new URL(config.url).origin);
    assert.ok(Object.hasOwn(await call('pw_odoo_fields', { model: 'res.partner' }), 'id'));
    const page = await call('pw_odoo_query', { model: 'res.partner', fields: ['id'], limit: 1 });
    if (page.records.length) {
      const id = page.records[0].id;
      assert.equal((await call('pw_odoo_get', { model: 'res.partner', id, fields: ['id'] })).record?.id, id);
    }
    const denied = await client.callTool({ name: 'pw_odoo_query', arguments: { model: 'res.users' } });
    assert.equal(denied.isError, true);
    const crm = await call('pw_odoo_query', { model: 'crm.lead', fields: ['id', 'type', 'stage_id'], limit: 1 });
    if (crm.records.length) {
      const leadId = crm.records[0].id;
      const activities = await call('pw_odoo_crm_activities', { leadId, limit: 1 });
      assert.equal(activities.leadId, leadId);
    }
    assert.equal((await call('pw_odoo_stock_status')).infrastructureReady, true);
    const sales = await call('pw_odoo_query', { model: 'sale.order', fields: ['id'], limit: 1 });
    if (sales.records.length) assert.equal((await call('pw_odoo_procurement_trace', { saleOrderId: sales.records[0].id, maxLines: 2 })).saleOrder.id, sales.records[0].id);
  } finally { await client.close(); }
});

test('live Cordis Host plugin queries the instance through the actual DSH registry', async () => {
  const ctx = new Context();
  ctx.provide('systemPrompt', { tools() {} });
  const typertFiber = await ctx.plugin(TypertRegistry);
  const toolsFiber = await ctx.plugin(ToolsService);
  let pluginFiber;
  try {
    pluginFiber = await ctx.plugin(hostPlugin);
    const signal = new AbortController().signal;
    const call = (name, args = {}) => ctx.tools.get(name).execute(args, { signal });
    const status = await call('pw_odoo_status');
    assert.equal(status.authenticated, true);
    assert.equal(status.scope.database, config.database);
    assert.equal(status.scope.url, new URL(config.url).origin);
    assert.ok(Object.hasOwn(await call('pw_odoo_fields', { model: 'purchase.order' }), 'id'));
    const page = await call('pw_odoo_query', { model: 'purchase.order', fields: ['id'], limit: 1 });
    if (page.records.length) {
      const id = page.records[0].id;
      assert.equal((await call('pw_odoo_get', { model: 'purchase.order', id, fields: ['id'] })).record?.id, id);
    }
    const crm = await call('pw_odoo_query', { model: 'crm.lead', fields: ['id'], limit: 1 });
    if (crm.records.length) assert.equal((await call('pw_odoo_crm_activities', { leadId: crm.records[0].id })).leadId, crm.records[0].id);
    assert.equal((await call('pw_odoo_stock_status')).infrastructureReady, true);
    const sales = await call('pw_odoo_query', { model: 'sale.order', fields: ['id'], limit: 1 });
    if (sales.records.length) assert.equal((await call('pw_odoo_procurement_trace', { saleOrderId: sales.records[0].id })).saleOrder.id, sales.records[0].id);
  } finally {
    await pluginFiber?.dispose();
    assert.equal(ctx.tools.schemas().length, 0);
    await toolsFiber.dispose();
    await typertFiber.dispose();
  }
});
