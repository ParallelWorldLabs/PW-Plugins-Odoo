import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { configSchema, loadConfig } from '../dist/core/config.js';
import { OdooClient } from '../dist/odoo/client.js';
import { OdooService, readableFields } from '../dist/core/service.js';
import { publicError } from '../dist/core/contracts.js';
import { isBlockedAddress } from '../dist/odoo/network.js';

async function fixture(t, handler) {
  const calls = [];
  const server = createServer(async (req, res) => {
    let text = '';
    for await (const chunk of req) text += chunk;
    const call = { path: req.url, method: req.method, headers: req.headers, body: text ? JSON.parse(text) : null };
    calls.push(call);
    if (handler && await handler(call, res)) return;
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/web/version') return res.end(JSON.stringify({ version: '19.0', version_info: [19, 0] }));
    if (req.url.endsWith('/fields_get')) return res.end(JSON.stringify(Object.fromEntries((readableFields[req.url.split('/')[3]] ?? call.body.allfields).map((name) => [name, { string: name, type: name === 'id' ? 'integer' : 'char' }]))));
    res.end(JSON.stringify([{ id: 7, name: 'Test record', company_id: [1, 'Test'], secret_field: 'hidden' }]));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const config = configSchema.parse({ url: `http://127.0.0.1:${server.address().port}`, apiKey: 'test-secret-key', database: 'test-db', companyIds: [1], allowHttp: true, timeoutMs: 1000 });
  const client = new OdooClient(config);
  return { service: new OdooService(client), client, config, calls };
}

test('JSON-2 contract, fixed company context, field projection and stable ordering', async (t) => {
  const { service, calls } = await fixture(t);
  const result = await service.query({ model: 'res.partner', fields: ['name'], filters: [{ field: 'name', operator: 'ilike', value: 'Test' }], sort: { field: 'name', direction: 'desc' } });
  assert.deepEqual(result.records, [{ id: 7, name: 'Test record' }]);
  assert.equal(calls[1].path, '/json/2/res.partner/search_read');
  assert.equal(calls[1].headers.authorization, 'bearer test-secret-key');
  assert.equal(calls[1].headers['x-odoo-database'], 'test-db');
  assert.deepEqual(calls[1].body, { fields: ['id', 'name'], domain: [['name', 'ilike', 'Test']], limit: 25, offset: 0, order: 'name desc, id asc', context: { allowed_company_ids: [1], lang: 'zh_CN', tz: 'Asia/Shanghai' } });
});

test('all approved models use the same read policy', async (t) => {
  const { service } = await fixture(t);
  for (const model of Object.keys(readableFields)) assert.equal((await service.query({ model })).records[0].id, 7);
});

test('reject arbitrary models, context injection, unbounded pages, raw domains and invalid filters', async (t) => {
  const { service, calls } = await fixture(t);
  for (const input of [
    { model: 'res.users' }, { model: 'res.partner', limit: 1000 },
    { model: 'res.partner', context: { allowed_company_ids: [99] } },
    { model: 'res.partner', domain: [] }, { model: 'res.partner', offset: -1 },
    { model: 'res.partner', filters: [{ field: 'id', operator: 'in', value: 1 }] },
    { model: 'res.partner', filters: [{ field: 'name', operator: 'ilike', value: true }] },
  ]) await assert.rejects(service.query(input));
  assert.equal(calls.length, 0);
});

test('reject forbidden output, filter and sort fields before fetching records', async (t) => {
  const { service, calls } = await fixture(t);
  for (const extra of [
    { fields: ['bank_ids'] }, { filters: [{ field: 'bank_ids', operator: '=', value: false }] },
    { sort: { field: 'name desc; secret', direction: 'asc' } }, { fields: ['__proto__'] },
  ]) await assert.rejects(service.query({ model: 'res.partner', ...extra }), { code: 'FIELD_DENIED' });
  assert.ok(calls.every((call) => call.path.endsWith('/fields_get')));
});

test('unavailable custom or optional fields fail explicitly', async (t) => {
  const { service } = await fixture(t, (call, res) => {
    if (!call.path.endsWith('/fields_get')) return false;
    res.end(JSON.stringify({ id: { type: 'integer' }, name: { type: 'char' } }));
    return true;
  });
  assert.equal((await service.query({ model: 'res.partner' })).records[0].name, 'Test record');
  await assert.rejects(service.query({ model: 'res.partner', fields: ['customer_rank'] }), { code: 'FIELD_DENIED' });
});

test('read ID and empty response are handled without identity substitution', async (t) => {
  const { service, calls } = await fixture(t);
  assert.equal((await service.get({ model: 'sale.order', id: 7 })).record.id, 7);
  assert.deepEqual(calls[1].body.ids, [7]);
  await assert.rejects(service.get({ model: 'sale.order', id: 9 }), { code: 'INVALID_RESPONSE' });
  const empty = await fixture(t, (call, res) => {
    if (!call.path.endsWith('/read')) return false;
    res.end('[]'); return true;
  });
  assert.equal((await empty.service.get({ model: 'sale.order', id: 7 })).record, null);
});

test('read methods cannot become arbitrary business writes at runtime', async (t) => {
  const { client, calls } = await fixture(t);
  for (const method of ['create', 'write', 'unlink', 'action_confirm']) await assert.rejects(client.readCall('sale.order', method, {}), { code: 'READ_ONLY' });
  assert.equal(calls.length, 0);
});

test('HTTP errors never forward Odoo tracebacks, keys or error bodies', async (t) => {
  for (const status of [401, 403, 429, 500]) {
    const { service } = await fixture(t, (_call, res) => { res.statusCode = status; res.end('{"debug":"private traceback","message":"test-secret-key"}'); return true; });
    try { await service.fields('res.partner'); assert.fail(); }
    catch (error) {
      const exposed = JSON.stringify(publicError(error));
      assert.ok(!exposed.includes('test-secret-key') && !exposed.includes('traceback'));
      assert.equal(error.status, status);
    }
  }
});

test('redirects are not followed or given credentials', async (t) => {
  const { service, calls } = await fixture(t, (_call, res) => { res.writeHead(302, { Location: 'http://169.254.169.254/' }); res.end(); return true; });
  await assert.rejects(service.fields('res.partner'), { status: 302 });
  assert.equal(calls.length, 1);
});

test('version GET is public; status also verifies authenticated metadata', async (t) => {
  const { service, calls } = await fixture(t);
  const status = await service.status();
  assert.equal(status.version, '19.0');
  assert.equal(status.authenticated, true);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].headers['x-odoo-database'], 'test-db');
  assert.equal(calls[0].headers.authorization, undefined);
  assert.ok(!JSON.stringify(status).includes('test-secret-key'));
});

test('version failure is unknown while API authentication remains independently checked', async (t) => {
  const { service } = await fixture(t, (call, res) => { if (call.path !== '/web/version') return false; res.statusCode = 404; res.end(); return true; });
  const status = await service.status();
  assert.equal(status.version, null);
  assert.equal(status.authenticated, true);
  assert.equal(status.versionError.status, 404);
});

test('cancellation, malformed JSON and oversized response have bounded failures', async (t) => {
  const cancelled = await fixture(t, () => true);
  const abort = new AbortController();
  const pending = cancelled.service.fields('res.partner', abort.signal);
  abort.abort();
  await assert.rejects(pending, { code: 'CANCELLED_OR_TIMEOUT' });
  const timedService = new OdooService(new OdooClient({ ...cancelled.config, timeoutMs: 100 }));
  await assert.rejects(timedService.fields('res.partner'), { code: 'CANCELLED_OR_TIMEOUT' });
  const malformed = await fixture(t, (_call, res) => { res.end('not json'); return true; });
  await assert.rejects(malformed.service.fields('res.partner'), { code: 'INVALID_RESPONSE' });
  const large = await fixture(t, (_call, res) => { res.end('x'.repeat(2 * 1024 * 1024 + 1)); return true; });
  await assert.rejects(large.service.fields('res.partner'), { code: 'RESPONSE_TOO_LARGE' });
});

test('configuration rejects secrets in URLs, insecure HTTP, metadata and empty company scope', () => {
  const base = { url: 'https://odoo.example.com', apiKey: 'key', companyIds: [1] };
  for (const url of ['http://odoo.example.com', 'https://user:pass@odoo.example.com', 'https://odoo.example.com/path', 'https://odoo.example.com?key=abc', 'https://169.254.169.254', 'https://[::ffff:a9fe:a9fe]', 'https://metadata.google.internal']) assert.equal(configSchema.safeParse({ ...base, url }).success, false);
  assert.equal(configSchema.safeParse({ ...base, companyIds: [] }).success, false);
  assert.throws(() => loadConfig({ ODOO_API_KEY: 'sensitive-test-key' }), (error) => !error.message.includes('sensitive-test-key'));
});

test('IP checks allow enterprise networks and deny IPv4/IPv6 metadata forms', () => {
  for (const ip of ['169.254.169.254', '100.100.100.200', '0.0.0.0', '224.0.0.1', 'fe80::1', 'fd00:ec2::254', '::ffff:169.254.169.254', '0:0:0:0:0:ffff:a9fe:a9fe']) assert.equal(isBlockedAddress(ip), true, ip);
  for (const ip of ['10.0.0.1', '192.168.1.1', '127.0.0.1', '::1', 'fd12::1']) assert.equal(isBlockedAddress(ip), false, ip);
});

test('CRM defaults include pipeline facts and currency; archives preserve company scope', async (t) => {
  const { service, calls } = await fixture(t);
  await service.query({ model: 'crm.lead', includeArchived: true, filters: [{ field: 'type', operator: '=', value: 'opportunity' }] });
  const query = calls.at(-1).body;
  for (const field of ['type', 'stage_id', 'user_id', 'team_id', 'expected_revenue', 'company_currency', 'probability']) assert.ok(query.fields.includes(field));
  assert.deepEqual(query.context.allowed_company_ids, [1]);
  assert.equal(query.context.active_test, false);
  assert.deepEqual(query.domain, [['type', '=', 'opportunity']]);
  await assert.rejects(service.query({ model: 'crm.lead', fields: ['message_ids'] }), { code: 'FIELD_DENIED' });
});

test('CRM activities check parent and fix the cross-application target domain', async (t) => {
  const { service, calls } = await fixture(t, (call, res) => {
    if (call.path !== '/json/2/mail.activity/search_read') return false;
    res.end(JSON.stringify([{ id: 12, res_model: 'crm.lead', res_id: 7, summary: 'Follow up', secret_field: 'hidden' }]));
    return true;
  });
  const result = await service.crmActivities({ leadId: 7, limit: 5 });
  assert.equal(result.records[0].id, 12);
  assert.equal(result.records[0].secret_field, undefined);
  const query = calls.at(-1);
  assert.equal(query.path, '/json/2/mail.activity/search_read');
  assert.deepEqual(query.body.domain, [['res_model', '=', 'crm.lead'], ['res_id', '=', 7]]);
  assert.equal(query.body.order, 'date_deadline asc, id asc');
  assert.equal(calls[1].path, '/json/2/crm.lead/read');
  assert.deepEqual(query.body.context.allowed_company_ids, [1]);
  await assert.rejects(service.query({ model: 'mail.activity' }));
  const before = calls.length;
  await assert.rejects(service.crmActivities({ leadId: 7, domain: [] }));
  assert.equal(calls.length, before);
});

test('CRM activities never query the activity model for inaccessible or unverified parents', async (t) => {
  for (const parent of [[], [{ id: 7, company_id: [99, 'Other'] }], [{ id: 7 }]]) {
    const { service, calls } = await fixture(t, (call, res) => {
      if (call.path !== '/json/2/crm.lead/read') return false;
      res.end(JSON.stringify(parent)); return true;
    });
    await assert.rejects(service.crmActivities({ leadId: 7 }));
    assert.ok(!calls.some((call) => call.path.includes('mail.activity')));
  }
});

test('CRM activity results with an incorrect document identity are rejected', async (t) => {
  for (const binding of [{ res_model: 'sale.order', res_id: 7 }, { res_model: 'crm.lead', res_id: 9 }]) {
    const { service } = await fixture(t, (call, res) => {
      if (call.path !== '/json/2/mail.activity/search_read') return false;
      res.end(JSON.stringify([{ id: 12, ...binding }])); return true;
    });
    await assert.rejects(service.crmActivities({ leadId: 7 }), { code: 'INVALID_RESPONSE' });
  }
});

test('missing CRM module is an explicit error and does not trigger a different model or protocol', async (t) => {
  const { service, calls } = await fixture(t, (_call, res) => { res.statusCode = 404; res.end(); return true; });
  await assert.rejects(service.query({ model: 'crm.lead' }), { code: 'ODOO_HTTP_ERROR', status: 404 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/json/2/crm.lead/fields_get');
});

test('inventory adjustment and valuation fields stay outside the read allowlist', async (t) => {
  const { service, calls } = await fixture(t);
  for (const [model, field] of [['stock.quant', 'inventory_quantity'], ['stock.move', 'value'], ['product.product', 'standard_price']]) {
    await assert.rejects(service.query({ model, fields: [field] }), { code: 'FIELD_DENIED' });
  }
  assert.ok(calls.every((call) => call.path.endsWith('/fields_get')));
  for (const model of ['ir.module.module', 'ir.model.data']) await assert.rejects(service.query({ model }));
});

test('duplicate upstream record IDs are rejected before interpreting graph or pagination counts', async (t) => {
  const { service } = await fixture(t, (call, res) => {
    if (!call.path.endsWith('/search_read')) return false;
    res.end(JSON.stringify([{ id: 7 }, { id: 7 }])); return true;
  });
  await assert.rejects(service.query({ model: 'stock.move', fields: ['id'], limit: 2 }), { code: 'INVALID_RESPONSE' });
});
