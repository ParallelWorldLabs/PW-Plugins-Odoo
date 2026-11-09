import test from 'node:test';
import assert from 'node:assert/strict';
import { PanelBroker } from '../dist/panel/broker.js';

const identity = { clientId: 'c1', tabId: 't1', occurrence: 'o1' };
const snapshot = (patch = {}) => ({ ...identity, version: 1, connectionId: 'odoo19', companyId: 1, page: 'crm', visible: true, model: 'crm.lead', filter: '{}', selectedId: 7, displayed: '{"rows":[{"id":7}]}', loading: false, error: null, fetchedAt: '2026-11-08T00:00:00Z', capturedAt: '2026-11-08T00:00:00Z', truncated: false, ...patch });
function setup(t, timeout = 1000) {
  const broker = new PanelBroker((connection, company) => { if (!['odoo19', 'odoo20'].includes(connection) || ![1, 2].includes(company)) throw new Error('Scope denied'); }, timeout);
  const signal = new AbortController().signal;
  const link = broker.open({ sessionId: 's1', peerId: 'p1', ...identity }, signal);
  link.receive(JSON.stringify({ kind: 'snapshot', snapshot: snapshot() }));
  t.after(() => broker.dispose());
  return { broker, link, signal };
}

test('panel context waits for a fresh Client receipt rather than returning cached content', async t => {
  const { broker, link, signal } = setup(t);
  let resolved = false;
  const result = broker.context('s1', signal).then(value => { resolved = true; return value; });
  const frame = (await link.frames().next()).value;
  assert.equal(resolved, false);
  link.receive(JSON.stringify({ kind: 'receipt', requestId: frame.requestId, ok: true, message: 'Rendered', snapshot: snapshot({ version: 2, selectedId: 8 }) }));
  assert.equal((await result).snapshot.selectedId, 8);
});

test('panel actions bind target, expected version, company and expiry', async t => {
  const { broker, link, signal } = setup(t);
  const target = { ...identity, expectedVersion: 1 };
  const result = broker.action('s1', target, { kind: 'navigate', page: 'sales' }, signal);
  const frame = (await link.frames().next()).value;
  assert.equal(frame.command.connectionId, 'odoo19');
  assert.equal(frame.command.companyId, 1);
  assert.ok(frame.command.expiresAt > Date.now());
  link.receive(JSON.stringify({ kind: 'receipt', requestId: frame.command.requestId, ok: true, message: 'Sales rendered', snapshot: snapshot({ version: 3, page: 'sales', model: 'sale.order' }) }));
  assert.equal((await result).snapshot.page, 'sales');
  await assert.rejects(broker.action('s1', target, { kind: 'refresh' }, signal), { code: 'PANEL_CONFLICT' });
});

test('Agent session cannot read another session panel, and headless reads have no implicit panel', async t => {
  const { broker, signal } = setup(t);
  await assert.rejects(broker.context('s2', signal), { code: 'NO_PANEL' });
  assert.equal(await broker.activeScope('s2', signal), null);
});

test('multiple visible Clients require explicit target selection', async t => {
  const { broker, signal } = setup(t);
  const secondIdentity = { clientId: 'c2', tabId: 't2', occurrence: 'o2' };
  const second = broker.open({ sessionId: 's1', peerId: 'p1', ...secondIdentity }, signal);
  second.receive(JSON.stringify({ kind: 'snapshot', snapshot: snapshot(secondIdentity) }));
  const ambiguous = await broker.context('s1', signal);
  assert.equal(ambiguous.ok, false); assert.equal(ambiguous.candidates.length, 2);
  await assert.rejects(broker.activeScope('s1', signal), { code: 'AMBIGUOUS_PANEL' });
  const result = broker.context('s1', signal, secondIdentity);
  const request = (await second.frames().next()).value;
  second.receive(JSON.stringify({ kind: 'receipt', requestId: request.requestId, ok: true, message: 'Ready', snapshot: snapshot(secondIdentity) }));
  assert.equal((await result).snapshot.clientId, 'c2');
});

test('scope/occurrence spoofing and regressing versions are rejected', t => {
  const { link } = setup(t);
  for (const patch of [{ companyId: 99 }, { occurrence: 'old-or-other-tab' }, { version: 0 }, { connectionId: 'unknown' }]) {
    assert.throws(() => link.receive(JSON.stringify({ kind: 'snapshot', snapshot: snapshot(patch) })));
  }
});

test('closing an occurrence rejects pending actions and does not retarget a reopened tab', async t => {
  const { broker, link, signal } = setup(t);
  const pending = broker.action('s1', { ...identity, expectedVersion: 1 }, { kind: 'refresh' }, signal);
  const rejected = assert.rejects(pending, { code: 'NO_PANEL' });
  link.close(); await rejected;
  const next = broker.open({ sessionId: 's1', peerId: 'p1', ...identity, occurrence: 'new' }, signal);
  next.receive(JSON.stringify({ kind: 'snapshot', snapshot: snapshot({ occurrence: 'new' }) }));
  await assert.rejects(broker.action('s1', { ...identity, expectedVersion: 1 }, { kind: 'refresh' }, signal), { code: 'NO_PANEL' });
});

test('timed-out queued commands are removed, not delivered later', async t => {
  const { broker, link, signal } = setup(t, 15);
  await assert.rejects(broker.action('s1', { ...identity, expectedVersion: 1 }, { kind: 'refresh' }, signal), { code: 'PANEL_TIMEOUT' });
  const next = link.frames().next(); link.close();
  assert.equal((await next).done, true);
});
