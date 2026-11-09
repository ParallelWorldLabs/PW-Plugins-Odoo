import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OdooBackend } from '../dist/cordis/backend.js';
import { ConnectionStore } from '../dist/settings/store.js';

async function fixture(t, legacy = false) {
  const directory = await mkdtemp(join(tmpdir(), 'pw-odoo-settings-'));
  const secrets = new Map(); const calls = [];
  const vault = { read: async key => secrets.get(key), write: async (key, value) => { secrets.set(key, value); }, remove: async key => { secrets.delete(key); } };
  const server = createServer(async (request, response) => {
    let text = ''; for await (const chunk of request) text += chunk;
    const body = text ? JSON.parse(text) : null; calls.push({ path: request.url, body });
    response.setHeader('Content-Type', 'application/json');
    const reply = request.url === '/web/version' ? { version: '20.0-test' } : request.url.endsWith('/context_get') ? { uid: 7 } : request.url.includes('res.users/read') ? [{ id: 7, company_id: [2, 'Main'], company_ids: [2, 3], lang: 'zh_CN', tz: 'Asia/Shanghai' }] : request.url.includes('res.company/read') ? body.ids.map(id => ({ id, name: `Company ${id}` })) : request.url.endsWith('/fields_get') ? { id: { type: 'integer' } } : request.url.endsWith('/search_read') ? [] : {};
    response.end(JSON.stringify(reply));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const draft = { label: 'Fixture', url: `http://127.0.0.1:${server.address().port}`, database: 'fixture', apiKey: 'fixture-settings-secret', lang: '', timezone: '', allowHttp: true };
  const file = join(directory, 'settings.json');
  const store = new ConnectionStore(file, vault);
  const backend = new OdooBackend(legacy ? [{ id: 'legacy', label: 'Legacy', config: { ...draft, companyIds: [2], timeoutMs: 1000, lang: 'zh_CN', timezone: 'Asia/Shanghai' } }] : [], store);
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  return { backend, store, secrets, calls, draft, file, vault, signal: AbortSignal.timeout(10000) };
}

test('fresh Host settings are usable without a connection; business tools explain setup', async t => {
  const { backend } = await fixture(t);
  assert.deepEqual((await backend.settings()).connections, []);
  assert.equal((await backend.settings()).writable, true);
  await assert.rejects(backend.defaultService(), { code: 'NOT_CONFIGURED' });
});

test('bootstrap authenticates only own user, discovers authorized scope and never persists a test', async t => {
  const { backend, draft, calls, file, secrets, signal } = await fixture(t);
  const result = await backend.testConnection(draft, signal);
  assert.deepEqual(result.companyIds, [2, 3]);
  assert.ok(!JSON.stringify(result).includes(draft.apiKey));
  assert.deepEqual(calls[1].body.ids, [7]);
  assert.equal(calls[0].body.context.allowed_company_ids, undefined);
  assert.equal(calls[1].body.context.allowed_company_ids, undefined);
  assert.deepEqual(calls[2].body.context.allowed_company_ids, [2, 3]);
  assert.equal(secrets.size, 0); await assert.rejects(readFile(file), { code: 'ENOENT' });
  await assert.rejects(backend.testConnection({ ...draft, companyIds: [99] }, signal), { name: 'ZodError' });
});

test('save uses a private atomic metadata file and a separate credential record; restart restores it', async t => {
  const { backend, draft, file, store, secrets, signal } = await fixture(t);
  const saved = await backend.saveConnection({ ...draft, expectedRevision: 0 }, signal);
  assert.equal(saved.connections.length, 1); assert.equal(saved.defaultConnectionId, saved.savedConnectionId);
  assert.ok(!JSON.stringify(saved).includes(draft.apiKey)); assert.ok(!JSON.stringify(saved).includes('credentialRef'));
  assert.equal(secrets.size, 1);
  assert.ok(!String(await readFile(file)).includes(draft.apiKey));
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  const restarted = new OdooBackend([], store);
  assert.equal((await restarted.settings()).connections[0].label, draft.label);
  assert.ok(await restarted.defaultService());
});

test('blank key editing preserves credentials; changing destination requires a new key and revokes old config version', async t => {
  const { backend, draft, secrets, signal } = await fixture(t);
  const saved = await backend.saveConnection({ ...draft, expectedRevision: 0 }, signal);
  const id = saved.savedConnectionId; const version = saved.connections[0].configVersion;
  const edited = await backend.saveConnection({ ...draft, apiKey: '', id, label: 'Renamed', expectedRevision: 1 }, signal);
  assert.equal(edited.connections[0].label, 'Renamed'); assert.equal(secrets.size, 1);
  await assert.rejects(backend.service(id, 2, version), { code: 'CONNECTION_CHANGED' });
  await assert.rejects(backend.saveConnection({ ...draft, apiKey: '', id, database: 'other', expectedRevision: 2 }, signal), { code: 'KEY_REQUIRED' });
  await assert.rejects(backend.testConnection({ ...draft, apiKey: '', id, url: 'http://localhost:1' }, signal), { code: 'KEY_REQUIRED' });
});

test('two settings writers cannot silently overwrite each other or retain losing credentials', async t => {
  const { backend, store, draft, secrets, signal } = await fixture(t);
  const second = new OdooBackend([], store);
  const results = await Promise.allSettled([backend.saveConnection({ ...draft, expectedRevision: 0 }, signal), second.saveConnection({ ...draft, label: 'Second', expectedRevision: 0 }, signal)]);
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(results.find(row => row.status === 'rejected').reason.code, 'SETTINGS_CONFLICT');
  assert.equal(secrets.size, 1); assert.equal((await store.read()).revision, 1);
});

test('deletion removes credentials, clears default and does not resurrect a legacy environment connection', async t => {
  const { backend, store, draft, secrets, signal } = await fixture(t, true);
  const saved = await backend.saveConnection({ ...draft, id: 'legacy', expectedRevision: 0, makeDefault: true }, signal);
  const result = await backend.deleteConnection({ id: 'legacy', expectedRevision: saved.revision }, signal);
  assert.equal(result.defaultConnectionId, null); assert.deepEqual(result.connections, []); assert.equal(secrets.size, 0);
  assert.ok((await store.read()).hiddenEnvironmentIds.includes('legacy'));
});

test('credential write failure leaves metadata uncommitted; malformed stored settings are never overwritten', async t => {
  const { backend, store, draft, file, vault, signal } = await fixture(t);
  vault.write = async () => { throw new Error('fixture credential backend failure'); };
  await assert.rejects(backend.saveConnection({ ...draft, expectedRevision: 0 }, signal));
  assert.equal((await store.read()).revision, 0);
  await writeFile(file, 'corrupt');
  await assert.rejects(backend.settings(), { code: 'SETTINGS_STORAGE_ERROR' });
  await assert.rejects(backend.saveConnection({ ...draft, expectedRevision: 0 }, signal), { code: 'SETTINGS_STORAGE_ERROR' });
  assert.equal(await readFile(file, 'utf8'), 'corrupt');
});


test('All resolves server-side to the Key user company set and never sends zero to Odoo', async t => {
  const { backend, draft, calls, signal } = await fixture(t);
  const saved = await backend.saveConnection({ ...draft, expectedRevision: 0 }, signal);
  const service = await backend.service(saved.savedConnectionId, 0);
  const all = await service.query({ model: 'crm.lead', fields: ['id'] }, signal);
  assert.deepEqual(all.scope.companyIds, [2, 3]);
  assert.deepEqual(calls.at(-1).body.context.allowed_company_ids, [2, 3]);
  const single = await (await backend.service(saved.savedConnectionId, 3)).query({ model: 'crm.lead', fields: ['id'] }, signal);
  assert.deepEqual(single.scope.companyIds, [3]);
  await assert.rejects(backend.service(saved.savedConnectionId, 99), { code: 'ACCESS_DENIED' });
  await assert.rejects(backend.service(saved.savedConnectionId, -1), { code: 'ACCESS_DENIED' });
});
