import test from 'node:test';
import assert from 'node:assert/strict';
import { OdooBackend } from '../dist/cordis/backend.js';

const config = { url: 'https://odoo.example.com', apiKey: 'fixture-secret-key', database: 'test', companyIds: [1, 2], lang: 'zh_CN', timezone: 'Asia/Shanghai', allowHttp: false, timeoutMs: 1000 };

test('public connection choices never return credentials or environment references', () => {
  const backend = new OdooBackend([{ id: 'test', label: 'Test', config }]);
  const text = JSON.stringify(backend.connections());
  assert.ok(!text.includes(config.apiKey) && !text.includes('apiKey') && !text.includes('envFile'));
});

test('UI requests cannot broaden company scope or choose an unconfigured connection', async () => {
  const backend = new OdooBackend([{ id: 'test', label: 'Test', config }]);
  await assert.rejects(backend.service('test', 99), { code: 'ACCESS_DENIED' });
  await assert.rejects(backend.service('other', 1), { code: 'INVALID_CONNECTION' });
});

test('UI Remote execution cannot select arbitrary methods or bypass query schemas', async () => {
  const backend = new OdooBackend([{ id: 'test', label: 'Test', config }]);
  const signal = new AbortController().signal;
  await assert.rejects(backend.execute('test', 1, 'write', '{}', signal), { code: 'READ_ONLY' });
  await assert.rejects(backend.execute('test', 1, 'pw_odoo_query', JSON.stringify({ model: 'res.users' }), signal));
  await assert.rejects(backend.execute('test', 1, 'pw_odoo_query', JSON.stringify({ model: 'sale.order', context: { allowed_company_ids: [99] } }), signal));
});
