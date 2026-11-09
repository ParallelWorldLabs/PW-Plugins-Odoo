import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { OdooPanelModel } from '../dist/client/model.js';
import { OdooNavigation } from '../dist/client/navigation.js';
import { summarize, summaryIsTruncated } from '../dist/panel/contracts.js';

class Pipe {
  queue = [{ kind: 'ready' }]; sent = []; closed = false; wake;
  push(frame) { this.queue.push(frame); this.wake?.(); this.wake = undefined; }
  async *[Symbol.asyncIterator]() { while (!this.closed) { const frame = this.queue.shift(); if (frame) yield JSON.stringify(frame); else await new Promise(resolve => { this.wake = resolve; }); } }
  async send(text) { this.sent.push(JSON.parse(text)); }
  dispose() { this.closed = true; this.wake?.(); }
}
function fixture(t, hook, preferences) {
  const calls = []; const pipe = new Pipe();
  const connections = ['odoo19', 'odoo20'].map(id => ({ id, label: id, url: 'https://odoo.example.com', database: id, companyIds: [1, 2], lang: 'zh_CN', timezone: 'Asia/Shanghai', readOnly: true }));
  const metadata = Object.fromEntries(['id', 'name', 'type', 'stage_id', 'user_id', 'partner_id', 'company_id', 'state', 'date_order', 'currency_id', 'amount_total'].map(field => [field, { type: 'char' }]));
  const transport = {
    connections: async () => JSON.stringify(connections), panel: () => pipe,
    read: async (connectionId, companyId, operation, input, signal) => {
      const call = { connectionId, companyId, operation, input, signal }; calls.push(call);
      const value = hook ? await hook(call) : undefined;
      if (value !== undefined) return JSON.stringify(value);
      if (operation === 'pw_odoo_fields') return JSON.stringify(metadata);
      if (operation === 'pw_odoo_get') return JSON.stringify({ record: { id: input.id, name: `${connectionId} detail` }, fetchedAt: new Date().toISOString() });
      if (operation === 'pw_odoo_crm_activities') return JSON.stringify({ records: [] });
      return JSON.stringify({ records: [{ id: connectionId === 'odoo19' ? 7 : 8, name: connectionId, company_id: [companyId, 'Company'] }], fields: input.fields ?? ['id', 'name'], fetchedAt: new Date().toISOString(), nextOffset: null });
    },
  };
  const model = new OdooPanelModel(transport, 'c1', 't1', 'o1', preferences);
  const lifetime = new AbortController(); t.after(() => { lifetime.abort(); model.stop(); });
  return { model, lifetime, pipe, calls };
}

test('sales and purchase keep independent applied filters and model targets', async t => {
  const { model, lifetime, calls } = fixture(t);
  await model.start(lifetime.signal);
  await model.navigate('sales'); await model.filter({ keyword: 'SO123', state: 'sale' });
  await model.navigate('purchase'); await model.filter({ keyword: 'PO456', state: 'draft' });
  await model.navigate('sales');
  assert.equal(model.getSnapshot().view.filter.keyword, 'SO123');
  assert.equal(model.getSnapshot().view.filter.state, 'sale');
  assert.ok(calls.some(call => call.input.model === 'sale.order'));
  assert.ok(calls.some(call => call.input.model === 'purchase.order'));
});

test('connection/company switches clear old selections and every page cache', async t => {
  const { model, lifetime } = fixture(t);
  await model.start(lifetime.signal); model.select(7); await model.detail(7);
  await model.switchScope('odoo20', 2);
  const state = model.getSnapshot();
  assert.equal(state.connectionId, 'odoo20'); assert.equal(state.companyId, 2);
  assert.equal(state.view.selectedId, null); assert.equal(state.view.detail, null);
  assert.equal(state.view.rows[0].id, 8);
  await assert.rejects(model.switchScope('odoo20', 99));
});

test('remembered public scope is restored only while the Host still authorizes it', async t => {
  const remembered = fixture(t, undefined, { initialScope: { connectionId: 'odoo20', companyId: 2 } });
  await remembered.model.start(remembered.lifetime.signal);
  assert.equal(remembered.model.getSnapshot().connectionId, 'odoo20');
  assert.equal(remembered.model.getSnapshot().companyId, 2);
  const revoked = fixture(t, undefined, { initialScope: { connectionId: 'odoo19', companyId: 99 } });
  await revoked.model.start(revoked.lifetime.signal);
  assert.equal(revoked.model.getSnapshot().companyId, 0);
});

test('a slow response from the previous connection cannot overwrite the new view', async t => {
  let finish;
  const { model, lifetime } = fixture(t, call => call.connectionId === 'odoo19' && call.operation === 'pw_odoo_query' && call.input.model === 'sale.order' ? new Promise(resolve => { finish = resolve; }) : undefined);
  await model.start(lifetime.signal);
  const pending = model.navigate('sales');
  while (!finish) await setImmediate();
  const cancelled = assert.rejects(pending, /页面已改变/);
  await model.switchScope('odoo20', 1);
  finish({ records: [{ id: 999, name: 'stale' }], fields: ['id'], fetchedAt: new Date().toISOString(), nextOffset: null });
  await cancelled;
  assert.equal(model.getSnapshot().connectionId, 'odoo20');
  assert.equal(model.getSnapshot().view.rows[0].id, 8);
});

test('Agent navigation acknowledges only after the resulting UI version is rendered', async t => {
  const { model, lifetime, pipe } = fixture(t); await model.start(lifetime.signal);
  model.rendered(model.getSnapshot().version);
  const before = model.snapshot();
  pipe.push({ kind: 'action', command: { requestId: 'request1', target: { clientId: 'c1', tabId: 't1', occurrence: 'o1', expectedVersion: before.version }, action: { kind: 'navigate', page: 'purchase' }, connectionId: 'odoo19', companyId: 0, expiresAt: Date.now() + 1000 } });
  for (let i = 0; i < 5; i++) await setImmediate();
  assert.equal(model.getSnapshot().page, 'purchase');
  assert.ok(!pipe.sent.some(frame => frame.kind === 'receipt'));
  model.rendered(model.getSnapshot().version);
  const receipt = pipe.sent.find(frame => frame.kind === 'receipt');
  assert.equal(receipt.ok, true); assert.equal(receipt.snapshot.page, 'purchase');
});

test('manual typing invalidates an Agent action based on the previous panel version', async t => {
  const { model, lifetime, pipe, calls } = fixture(t); await model.start(lifetime.signal);
  const before = model.snapshot(); model.draftKeyword('unfinished user input'); model.rendered(model.getSnapshot().version);
  const count = calls.length;
  pipe.push({ kind: 'action', command: { requestId: 'stale', target: { clientId: 'c1', tabId: 't1', occurrence: 'o1', expectedVersion: before.version }, action: { kind: 'filter', keyword: 'overwrite' }, connectionId: 'odoo19', companyId: 0, expiresAt: Date.now() + 1000 } });
  await setImmediate(); await setImmediate();
  assert.equal(calls.length, count); assert.equal(model.getSnapshot().view.draftKeyword, 'unfinished user input');
  assert.equal(pipe.sent.find(frame => frame.kind === 'receipt').ok, false);
});

test('panel context omits hidden rows and bounds business text', async t => {
  const { model, lifetime } = fixture(t, call => call.operation === 'pw_odoo_query' && call.input.model === 'crm.lead'
    ? { records: Array.from({ length: 25 }, (_, index) => ({ id: index + 1, name: index === 24 ? 'HIDDEN_ROW_25' : 'x'.repeat(2000) })), fields: ['id', 'name'], fetchedAt: new Date().toISOString(), nextOffset: 25 } : undefined);
  await model.start(lifetime.signal);
  const snapshot = model.snapshot();
  assert.equal(snapshot.truncated, true); assert.ok(snapshot.displayed.length <= 24000);
  assert.ok(!snapshot.displayed.includes('HIDDEN_ROW_25'));
});

test('bounded page context retains relation IDs/names and marks omitted detail text', () => {
  const value = { rows: [{ id: 7, partner_id: [12, 'Selected customer'], stage_id: [3, 'Qualified'] }] };
  assert.deepEqual(summarize(value), value);
  assert.equal(summaryIsTruncated(value), false);
  const long = { detail: { id: 7, description: 'x'.repeat(2000) } };
  assert.equal(summaryIsTruncated(long), true);
  assert.equal(summarize(long).detail.description.length, 500);
});

test('non-session activation retains drafts, coalesces clicks and opens the last requested page', async () => {
  let mounted = false; let callback; let starts = 0; const opened = [];
  const nav = new OdooNavigation({ mounted: () => mounted, subscribe: listener => { callback = listener; return () => { callback = undefined; }; }, startSession: () => { starts++; }, open: page => opened.push(page) });
  const first = nav.activate('sales'); const second = nav.activate('purchase');
  assert.equal(starts, 1); mounted = true; callback(); await Promise.all([first, second]);
  assert.deepEqual(opened, ['purchase']); assert.equal(callback, undefined);
});

test('non-session activation has bounded wait and cancellation cleanup', async () => {
  let subscribed = false;
  const nav = new OdooNavigation({ mounted: () => false, subscribe: () => { subscribed = true; return () => { subscribed = false; }; }, startSession() {}, open() { assert.fail(); } }, 15);
  await assert.rejects(nav.activate('crm'), /未能挂载/); assert.equal(subscribed, false);
  const pending = nav.activate('sales'); const rejected = assert.rejects(pending, /取消/); nav.cancel(); await rejected; assert.equal(subscribed, false);
});

test('cancelling the startup business read cannot turn a configured Host into a setup error or reset newer navigation', async t => {
  let finish;
  const { model, lifetime } = fixture(t, call => call.operation === 'pw_odoo_query' && call.input.model === 'crm.lead' ? new Promise(resolve => { finish = resolve; }) : undefined);
  const startup = model.start(lifetime.signal);
  while (!finish) await setImmediate();
  await model.navigate('purchase');
  finish({ records: [], fields: ['id'], fetchedAt: new Date().toISOString(), nextOffset: null });
  await startup;
  assert.equal(model.getSnapshot().page, 'purchase');
  assert.equal(model.getSnapshot().startupError, null);
  assert.equal(model.getSnapshot().view.rows[0].id, 7);
});


test('All defaults to the authorized company set and switching one/all clears cached data', async t => {
  const { model, lifetime, calls } = fixture(t);
  await model.start(lifetime.signal);
  assert.equal(model.getSnapshot().companyId, 0);
  assert.deepEqual(model.snapshot().companyIds, [1, 2]);
  await model.switchScope('odoo19', 2);
  assert.deepEqual(model.snapshot().companyIds, [2]);
  model.select(7);
  await model.switchScope('odoo19', 0);
  assert.equal(model.getSnapshot().view.selectedId, null);
  assert.deepEqual(model.snapshot().companyIds, [1, 2]);
  assert.equal(calls.at(-1).companyId, 0);
});
