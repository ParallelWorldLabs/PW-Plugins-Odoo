import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createServer } from '../dist/mcp/server.js';
import { OdooError } from '../dist/core/contracts.js';

test('official MCP client negotiates, lists seven read-only tools and calls shared service', async (t) => {
  const calls = [];
  const service = {
    status: async () => ({ readOnly: true }),
    fields: async (model) => { calls.push(model); return { id: { type: 'integer' } }; },
    query: async (args) => ({ records: [], model: args.model }),
    get: async () => { throw new OdooError('ACCESS_DENIED', 'Odoo request failed (HTTP 403).', 403); },
    crmActivities: async (args) => ({ leadId: args.leadId, records: [] }),
    inventoryStatus: async () => ({ infrastructureReady: true }),
    procurementTrace: async (args) => ({ saleOrderId: args.saleOrderId, links: [] }),
  };
  const server = createServer(service);
  const client = new Client({ name: 'test', version: '1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });
  const { tools } = await client.listTools();
  assert.equal(tools.length, 7);
  assert.ok(tools.every((tool) => tool.annotations.readOnlyHint === true));
  const result = await client.callTool({ name: 'pw_odoo_fields', arguments: { model: 'res.partner' } });
  assert.deepEqual(JSON.parse(result.content[0].text), { id: { type: 'integer' } });
  assert.deepEqual(calls, ['res.partner']);
  const invalid = await client.callTool({ name: 'pw_odoo_fields', arguments: { model: 'res.users' } });
  assert.equal(invalid.isError, true);
  const denied = await client.callTool({ name: 'pw_odoo_get', arguments: { model: 'sale.order', id: 7 } });
  assert.equal(denied.isError, true);
  assert.equal(JSON.parse(denied.content[0].text).code, 'ACCESS_DENIED');
  const crm = await client.callTool({ name: 'pw_odoo_crm_activities', arguments: { leadId: 7 } });
  assert.deepEqual(JSON.parse(crm.content[0].text), { leadId: 7, records: [] });
  const crmQuery = await client.callTool({ name: 'pw_odoo_query', arguments: { model: 'crm.lead' } });
  assert.equal(JSON.parse(crmQuery.content[0].text).model, 'crm.lead');
  const stock = await client.callTool({ name: 'pw_odoo_stock_status', arguments: {} });
  assert.equal(JSON.parse(stock.content[0].text).infrastructureReady, true);
  const trace = await client.callTool({ name: 'pw_odoo_procurement_trace', arguments: { saleOrderId: 7 } });
  assert.equal(JSON.parse(trace.content[0].text).saleOrderId, 7);
});

test('real stdio process initializes without stdout logging or ERP connection', async (t) => {
  const transport = new StdioClientTransport({ command: process.execPath, args: ['dist/mcp/stdio.js'], env: { ODOO_URL: 'https://odoo.example.com', ODOO_API_KEY: 'test-secret', ODOO_COMPANY_IDS: '1' }, stderr: 'pipe' });
  const client = new Client({ name: 'stdio-test', version: '1' });
  await client.connect(transport);
  t.after(() => client.close());
  assert.equal((await client.listTools()).tools.length, 7);
});
