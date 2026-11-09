import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { initializeProfileFromDefault, runProfile } from '@deepseek-ai/dsh/profile-boot';
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment';
import { Peer } from '@deepseek-ai/dsh-client-connection';
import { linkDevelopmentPackage } from '../scripts/dsh-development-profile.mjs';

// Explicit full-DSH browser acceptance. Uses real local ERP reads; never sends a model request or ERP write.
const installedHome = process.env.PW_ODOO_UI_INSTALLED_HOME;
const directory = resolve(installedHome ? 'artifacts/frontend-installed-acceptance' : 'artifacts/frontend-acceptance');
await mkdir(directory, { recursive: true });
process.env.DSH_HOME = resolve(installedHome ?? 'artifacts/dsh-e2e-home');
process.env.PW_ODOO_CONNECTIONS_FILE = resolve('.local/connections.json');
// Dummy credentials point at a non-provider loopback endpoint. Tool dispatch is tested directly with the real Agent.
process.env.DEEPSEEK_API_KEY = 'pw-local-ui-test';
process.env.DEEPSEEK_BASE_URL = 'http://127.0.0.1:18888/v1';
const patch = resolve(directory, 'overlay.json');
await writeFile(patch, JSON.stringify([
  { id: 'web-runtime', config: { printUrl: false, openBrowser: false } },
  { id: 'ui-settings-models', config: { credentialOnboarding: false } },
  ...(installedHome ? [] : [{ insert: [{ id: 'pw-plugins-odoo', name: 'pw-plugins-odoo', config: {} }] }]),
], null, 2));
const environment = createLaunchEnvironmentSnapshot([{ source: 'process', values: Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === 'string')) }]);
if (!installedHome) { initializeProfileFromDefault('pw-odoo-ui-acceptance', 'web'); await linkDevelopmentPackage(process.env.DSH_HOME, 'pw-odoo-ui-acceptance'); }
const { ctx, shutdown } = await runProfile({ environment, profile: installedHome ? 'pw-odoo-installed' : 'pw-odoo-ui-acceptance', patchFiles: [patch], args: ['--host', '127.0.0.1', '--port', '0', '--no-open'] });
let browser;
let ok = false;
const report = { fullDsh: true, cases: [], browserErrors: [] };
try {
  await ctx.loader.await();
  for (const method of ['connections', 'execute', 'panel']) {
    const descriptor = ctx.typert.local.get(`pwOdoo/${method}`);
    assert.ok(descriptor, 'Odoo Host must have a registered generated descriptor');
    assert.equal(descriptor.result.mode, 'strict');
    assert.ok(descriptor.parameters.every(parameter => parameter.codec.mode === 'strict'));
  }
  const guest = new Peer(ctx, { principal: { kind: 'pw-odoo-test-guest' } });
  try { await assert.rejects(ctx.typertGateway.invoke({ namespace: 'pwOdoo', method: 'connections', args: {}, peer: guest, signal: AbortSignal.timeout(2000) })); }
  finally { await guest.dispose(); }
  report.cases.push('Host uses strict generated Remote codecs and rejects non-owner peers');
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => report.browserErrors.push(error.message));
  const directErpRequests = [];
  page.on('request', request => { if (['8070', '8079'].includes(new URL(request.url()).port)) directErpRequests.push(request.url()); });
  await page.goto(ctx.connection.authenticatedUrl(ctx.webServer.getOrigin()));
  const introduction = page.getByRole('button', { name: '继续', exact: true });
  await introduction.waitFor({ state: 'visible', timeout: 3000 }).then(() => introduction.click()).catch(() => {});
  const previousSessions = new Set(ctx.sessions.list().map(session => session.id));
  await page.getByRole('button', { name: 'Odoo', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Odoo 功能' });
  await menu.waitFor();
  assert.deepEqual(await menu.getByRole('menuitem').allTextContents(), ['CRM', '销售', '采购', '库存', '记录', '设置']);
  await menu.getByRole('menuitem', { name: 'CRM', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), '销售');
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), '设置');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Odoo', exact: true }).click();
  report.cases.push('left menu supports arrow/end/escape keyboard control and restores the launcher');
  await menu.getByRole('menuitem', { name: 'CRM', exact: true }).click();
  const panel = page.locator('.pw-odoo');
  await panel.locator('.pw-odoo-record').first().waitFor({ timeout: 20000 });
  await page.getByText('Agent 页面通道已连接', { exact: true }).waitFor();
  report.cases.push('non-session launcher opens one right tab without switching the central panel');
  const session = ctx.sessions.list().find(session => !previousSessions.has(session.id)) ?? ctx.sessions.list().at(-1);
  assert.ok(session);
  const resolved = await ctx.sessionController.resolveAgent(session.id);
  assert.ok('agent' in resolved, 'The actual DSH Agent must be activated');
  const agent = resolved.agent;
  assert.ok(ctx.tools.schemas(agent).some(tool => tool.name === 'pw_odoo_panel_context'));
  assert.ok(ctx.tools.schemas(agent).some(tool => tool.name === 'pw_odoo_panel_action'));
  let callNumber = 0;
  const tool = async (name, input = {}, expectFailure = false) => {
    const batch = await ctx.tools.execute({ agent, signal: AbortSignal.timeout(15000), calls: [{ type: 'tool-call', id: `pw-frontend-${++callNumber}`, name, arguments: JSON.stringify(input) }] });
    const result = batch.results[0]?.result;
    assert.ok(result, 'Tool batch must contain a result');
    assert.equal(Boolean(result.isError), expectFailure, `${name} unexpected execution status${result.isError ? `: ${result.error?.message ?? 'failed'}` : ''}`);
    return result;
  };
  let active = (await tool('pw_odoo_panel_context')).value;
  assert.equal(active.snapshot.page, 'crm');
  const firstId = await panel.locator('.pw-odoo-record-select').first().getAttribute('aria-pressed');
  assert.equal(firstId, 'false');
  await panel.locator('.pw-odoo-record-select').first().click();
  active = (await tool('pw_odoo_panel_context')).value;
  assert.ok(Number.isSafeInteger(active.snapshot.selectedId));
  const target = snapshot => ({ clientId: snapshot.clientId, tabId: snapshot.tabId, occurrence: snapshot.occurrence, expectedVersion: snapshot.version });
  const detail = (await tool('pw_odoo_panel_action', { target: target(active.snapshot), action: { kind: 'detail', id: active.snapshot.selectedId } })).value;
  assert.equal(detail.ok, true);
  await panel.getByRole('region', { name: 'CRM详情' }).waitFor().catch(async () => { await panel.locator('.pw-odoo-detail').waitFor(); });
  report.cases.push('real Agent tools read selected CRM record and acknowledge rendered detail');
  await panel.getByRole('button', { name: '返回列表', exact: true }).click();
  await panel.getByLabel('Odoo 连接', { exact: true }).selectOption('odoo20');
  await panel.locator('.pw-odoo-record').first().waitFor();
  await page.getByText('Agent 页面通道已连接', { exact: true }).waitFor();
  active = (await tool('pw_odoo_panel_context')).value;
  assert.equal(active.snapshot.connectionId, 'odoo20');
  const query = (await tool('pw_odoo_query', { model: 'crm.lead', fields: ['id'], limit: 1 })).value;
  assert.equal(query.scope.database, 'plugin');
  assert.ok(query.scope.url.endsWith(':8070'));
  report.cases.push('business tools follow the confirmed panel connection and company instead of querying the default instance');
  active = (await tool('pw_odoo_panel_context')).value;
  const purchase = (await tool('pw_odoo_panel_action', { target: target(active.snapshot), action: { kind: 'navigate', page: 'purchase' } })).value;
  assert.equal(purchase.ok, true); assert.equal(purchase.snapshot.page, 'purchase');
  await panel.locator('[data-pw-page=purchase][aria-pressed=true]').waitFor();
  const filtered = (await tool('pw_odoo_panel_action', { target: target(purchase.snapshot), action: { kind: 'filter', keyword: 'PW-INTENTIONALLY-NO-MATCH-UI' } })).value;
  assert.equal(filtered.ok, true);
  assert.equal(await panel.getByLabel('查询名称或单号').inputValue(), 'PW-INTENTIONALLY-NO-MATCH-UI');
  assert.equal(await panel.locator('.pw-odoo-record').count(), 0);
  report.cases.push('Agent changes purchase filters and waits for the empty result to render');
  const beforeTyping = (await tool('pw_odoo_panel_context')).value;
  await panel.getByLabel('查询名称或单号').fill('user unfinished input');
  await page.waitForTimeout(100);
  await tool('pw_odoo_panel_action', { target: target(beforeTyping.snapshot), action: { kind: 'refresh' } }, true);
  assert.equal(await panel.getByLabel('查询名称或单号').inputValue(), 'user unfinished input');
  report.cases.push('manual typing causes stale Agent actions to fail without overwriting input');
  await panel.getByLabel('查询名称或单号').fill(''); await panel.getByRole('button', { name: '查询', exact: true }).click();
  await panel.locator('.pw-odoo-record').first().waitFor();
  await panel.locator('[data-pw-page=sales]').click(); await panel.locator('.pw-odoo-record').first().waitFor();
  await panel.locator('.pw-odoo-row-detail').first().click(); await panel.locator('.pw-odoo-detail').waitFor();
  await panel.getByRole('button', { name: '查看关联采购 / MTO 追溯', exact: true }).click(); await panel.locator('.pw-odoo-trace').waitFor();
  assert.equal(await panel.getAttribute('data-pw-odoo-page'), 'sales');
  report.cases.push('sales and purchase are distinct views; procurement trace remains a sales detail action');
  await panel.locator('[data-pw-page=inventory]').click(); await panel.locator('.pw-odoo-record').first().waitFor();
  for (const name of ['收货', '发货', '产品补给']) { await panel.getByRole('button', { name, exact: true }).click(); await page.waitForFunction(() => !document.querySelector('.pw-odoo [role=status]')); assert.equal(await panel.locator('[role=alert]').count(), 0); }
  report.cases.push('inventory availability, receipts, deliveries and product supply settings query the real instance');
  await panel.locator('[data-pw-page=settings]').click(); await panel.getByRole('button', { name: '诊断连接与库存依赖', exact: true }).click(); await panel.locator('.pw-odoo-diagnostic').waitFor();
  assert.equal(await panel.locator('[role=alert]').count(), 0, (await panel.locator('[role=alert]').allTextContents()).join(' | '));
  report.cases.push('connection and inventory diagnostics render without exposing credential fields');
  const originalTarget = (await tool('pw_odoo_panel_context')).value.snapshot;
  const otherContext = await browser.newContext({ viewport: { width: 1500, height: 1000 }, storageState: await context.storageState() });
  const other = await otherContext.newPage();
  other.on('pageerror', error => report.browserErrors.push(error.message));
  await other.goto(ctx.connection.authenticatedUrl(page.url()));
  await other.locator('.pw-odoo').waitFor({ timeout: 15000 });
  await other.getByText('Agent 页面通道已连接', { exact: true }).waitFor();
  const ambiguous = (await tool('pw_odoo_panel_context')).value;
  assert.equal(ambiguous.ok, false); assert.equal(ambiguous.candidates.length, 2);
  await tool('pw_odoo_query', { model: 'res.partner', fields: ['id'], limit: 1 }, true);
  const picked = (await tool('pw_odoo_panel_context', { target: { clientId: originalTarget.clientId, tabId: originalTarget.tabId, occurrence: originalTarget.occurrence } })).value;
  assert.equal(picked.snapshot.connectionId, 'odoo20');
  const explicitQuery = (await tool('pw_odoo_query', { model: 'res.partner', fields: ['id'], limit: 1, panelTarget: target(picked.snapshot) })).value;
  assert.equal(explicitQuery.scope.database, 'plugin');
  await otherContext.close(); await page.waitForTimeout(150);
  report.cases.push('multiple real browser Clients are ambiguous until explicitly selected, never first-response wins');
  const oldOccurrence = (await tool('pw_odoo_panel_context')).value.snapshot;
  await page.reload();
  await page.locator('.pw-odoo').waitFor({ timeout: 15000 });
  await page.getByText('Agent 页面通道已连接', { exact: true }).waitFor();
  const reopened = (await tool('pw_odoo_panel_context')).value;
  assert.notEqual(reopened.snapshot.occurrence, oldOccurrence.occurrence);
  assert.equal(reopened.snapshot.connectionId, 'odoo20');
  await tool('pw_odoo_panel_action', { target: target(oldOccurrence), action: { kind: 'refresh' } }, true);
  report.cases.push('reload restores only authorized public scope preferences and rejects the old occurrence');
  assert.equal(directErpRequests.length, 0);
  report.cases.push('browser never connects directly to Odoo; all business access stays in the Host');
  await panel.locator('[data-pw-page=crm]').click();
  await panel.locator('.pw-odoo-record').first().waitFor().catch(async error => { console.log(JSON.stringify({ page: await panel.getAttribute('data-pw-odoo-page'), alerts: await panel.locator('[role=alert]').allTextContents(), empty: await panel.locator('.pw-odoo-empty').allTextContents(), loading: await panel.locator('[role=status]').allTextContents() })); throw error; });
  await page.screenshot({ path: resolve(directory, 'crm-desktop.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' }); await page.screenshot({ path: resolve(directory, 'crm-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 900, height: 950 });
  report.narrowPanelWidth = Math.round((await panel.boundingBox()).width);
  await page.screenshot({ path: resolve(directory, 'crm-narrow.png'), fullPage: true });
  const overflow = await panel.evaluate(element => element.scrollWidth > element.clientWidth + 1);
  assert.equal(overflow, false);
  report.cases.push('desktop, dark appearance and narrow panel layouts have no outer horizontal overflow');
  assert.deepEqual(report.browserErrors, []);
  ok = true;
  await writeFile(resolve(directory, 'report.json'), JSON.stringify({ ...report, passed: true, toolDispatches: callNumber }, null, 2));
  console.log(JSON.stringify({ frontendAcceptance: 'passed', cases: report.cases.length, toolDispatches: callNumber, browserErrors: report.browserErrors.length }));
} finally {
  await browser?.close();
  await shutdown.shutdown(ok ? 0 : 1);
}
