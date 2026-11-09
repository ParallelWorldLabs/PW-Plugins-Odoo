import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
import { initializeProfileFromDefault, runProfile } from '@deepseek-ai/dsh/profile-boot';
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment';
import { Peer } from '@deepseek-ai/dsh-client-connection';
import { linkDevelopmentPackage } from '../scripts/dsh-development-profile.mjs';

// Explicit local read-only acceptance; keys remain in memory and the isolated native Host credential store.
const env19 = parseEnv(await readFile('.env', 'utf8'));
const env20 = parseEnv(await readFile('.env.odoo20', 'utf8'));
for (const key of Object.keys(process.env)) if (key.startsWith('ODOO_') || key === 'PW_ODOO_CONNECTIONS_FILE') delete process.env[key];
const installed = process.env.PW_ODOO_UI_INSTALLED_HOME;
const directory = resolve(installed ? 'artifacts/settings-installed-acceptance' : 'artifacts/settings-acceptance');
await mkdir(directory, { recursive: true });
process.env.DSH_HOME = resolve(installed ?? 'artifacts/dsh-settings-home');
assert.ok(process.env.DSH_HOME.startsWith(resolve('artifacts') + '/'), 'Acceptance only touches a dedicated artifacts home');
const profile = installed ? 'pw-odoo-installed' : 'pw-odoo-settings';
if (!installed) { initializeProfileFromDefault(profile, 'web'); await linkDevelopmentPackage(process.env.DSH_HOME, profile); }
await rm(join(process.env.DSH_HOME, 'profiles', profile, 'data', 'pw-plugins-odoo'), { recursive: true, force: true });
await rm(join(process.env.DSH_HOME, '.credentials.yaml'), { force: true });
process.env.DEEPSEEK_API_KEY = 'pw-local-ui-test'; process.env.DEEPSEEK_BASE_URL = 'http://127.0.0.1:18888/v1';
const patch = resolve(directory, 'overlay.json');
await writeFile(patch, JSON.stringify([
  { id: 'web-runtime', config: { printUrl: false, openBrowser: false } }, { id: 'ui-settings-models', config: { credentialOnboarding: false } },
  ...(installed ? [] : [{ insert: [{ id: 'pw-plugins-odoo', name: 'pw-plugins-odoo', config: {} }] }]),
]));
const environment = createLaunchEnvironmentSnapshot([{ source: 'process', values: Object.fromEntries(Object.entries(process.env).filter(([, v]) => typeof v === 'string')) }]);
let host; let browser; let ok = false;
const report = { cases: [], browserErrors: [], fullDsh: true, installed: Boolean(installed) };
const boot = async () => { console.log('Booting isolated settings profile'); host = await runProfile({ environment, profile, patchFiles: [patch], args: ['--host', '127.0.0.1', '--port', '0', '--no-open'] }); await host.ctx.loader.await(); };
const pageFor = async () => {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } }); const page = await context.newPage();
  page.on('pageerror', error => report.browserErrors.push(error.message));
  await page.goto(host.ctx.connection.authenticatedUrl(host.ctx.webServer.getOrigin()));
  const intro = page.getByRole('button', { name: '继续', exact: true }); await intro.waitFor({ state: 'visible', timeout: 2000 }).then(() => intro.click()).catch(() => {});
  await page.getByRole('button', { name: 'Odoo', exact: true }).click(); await page.getByRole('menuitem', { name: '设置', exact: true }).click();
  await page.locator('.pw-odoo [data-pw-page=settings][aria-pressed=true]').waitFor({ timeout: 15000 }).catch(async error => { await page.screenshot({ path: resolve(directory, 'startup-failure.png') }); console.log(JSON.stringify({ panelCount: await page.locator('.pw-odoo').count(), pages: await page.locator('.pw-odoo').evaluateAll(rows => rows.map(row => row.dataset.pwOdooPage)), alerts: await page.locator('.pw-odoo [role=alert]').allTextContents(), browserErrors: report.browserErrors })); throw error; });
  await page.waitForFunction(() => { const rect = document.querySelector('.pw-odoo')?.getBoundingClientRect(); return rect && rect.left < innerWidth - 300 && rect.right <= innerWidth + 1; });
  await page.locator('.pw-odoo-settings-heading').getByRole('button', { name: '新增连接' }).waitFor();
  return { context, page, panel: page.locator('.pw-odoo') };
};
const add = async (panel, env, label) => {
  await panel.getByRole('button', { name: '新增连接', exact: true }).click();
  assert.equal(await panel.getByLabel('公司 ID', { exact: true }).count(), 0);
  await panel.getByLabel('连接名称', { exact: true }).fill(label); await panel.getByLabel('服务器地址', { exact: true }).fill(env.ODOO_URL);
  await panel.getByLabel('数据库', { exact: true }).fill(env.ODOO_DB); await panel.getByLabel('API Key', { exact: true }).fill(env.ODOO_API_KEY);
  await panel.getByLabel('允许 HTTP', { exact: false }).check();
};
const saved = async panel => { await panel.getByText('连接已保存，可切换到 CRM、销售等模块。', { exact: true }).waitFor({ timeout: 20000 }); };
try {
  await boot(); browser = await chromium.launch({ headless: true, channel: 'chrome' });
  for (const method of ['settings', 'testConnection', 'saveConnection', 'deleteConnection']) {
    assert.equal(host.ctx.typert.local.get(`pwOdoo/${method}`).result.mode, 'strict');
    const guest = new Peer(host.ctx, { principal: { kind: 'pw-odoo-test-guest' } });
    try { await assert.rejects(host.ctx.typertGateway.invoke({ namespace: 'pwOdoo', method, args: method === 'settings' ? {} : { payload: '{}' }, peer: guest, signal: AbortSignal.timeout(2000) })); }
    finally { await guest.dispose(); }
  }
  report.cases.push('all settings Remotes use generated strict codecs and reject non-owner access');
  let { context, page, panel } = await pageFor();
  await panel.getByText(/尚未配置 Odoo/).waitFor();
  assert.equal(await panel.locator('[role=alert]').count(), 0);
  assert.equal(await panel.locator('[data-pw-page=crm]').isDisabled(), true);
  await page.screenshot({ path: resolve(directory, 'first-run.png') });
  report.cases.push('fresh installation boots without ODOO variables, opens Settings and disables unconfigured business navigation');
  await add(panel, env19, '本机 Odoo 19');
  await panel.getByRole('button', { name: '测试连接', exact: true }).click();
  await panel.getByText(/连接测试成功 · Odoo 19/).waitFor({ timeout: 20000 });
  assert.equal(await host.ctx.credentials.listRecords().then(rows => rows.filter(row => row.key.startsWith('pw-plugins-odoo/')).length), 0);
  report.cases.push('manual test discovers real Odoo 19 companies without storing a connection or credential');
  await panel.getByRole('button', { name: '验证并保存' }).click(); await saved(panel);
  assert.equal(await panel.getByLabel('API Key', { exact: true }).count(), 0);
  await panel.locator('[data-pw-page=crm]').click(); await panel.locator('.pw-odoo-record').first().waitFor({ timeout: 20000 });
  await page.getByText('Agent 页面通道已连接', { exact: true }).waitFor();
  report.cases.push('save activates the real CRM and native Agent panel channel immediately');
  const session = host.ctx.sessions.list().at(-1); const { agent } = await host.ctx.sessionController.resolveAgent(session.id);
  const result = await host.ctx.tools.execute({ agent, signal: AbortSignal.timeout(15000), calls: [{ type: 'tool-call', id: 'settings-snapshot', name: 'pw_odoo_panel_context', arguments: '{}' }] });
  const snapshot = result.results[0].result.value.snapshot;
  assert.ok(snapshot.configVersion); assert.ok(!JSON.stringify(snapshot).includes(env19.ODOO_API_KEY));
  assert.equal(snapshot.companyId, 0); assert.ok(snapshot.companyIds.length > 1);
  const queryCompanies = async id => {
    const batch = await host.ctx.tools.execute({ agent, signal: AbortSignal.timeout(15000), calls: [{ type: 'tool-call', id, name: 'pw_odoo_query', arguments: JSON.stringify({ model: 'crm.lead', fields: ['id'], limit: 1 }) }] });
    assert.ok(!batch.results[0].result.isError); return batch.results[0].result.value.scope.companyIds;
  };
  assert.deepEqual(await queryCompanies('all-companies'), snapshot.companyIds);
  const selected = snapshot.companyIds[1];
  await panel.getByLabel('Odoo 公司', { exact: true }).selectOption(String(selected));
  await page.waitForFunction(() => !document.querySelector('.pw-odoo [role=status]'));
  assert.deepEqual(await queryCompanies('one-company'), [selected]);
  await panel.getByLabel('Odoo 公司', { exact: true }).selectOption('0');
  await page.waitForFunction(() => !document.querySelector('.pw-odoo [role=status]'));
  assert.deepEqual(await queryCompanies('all-again'), snapshot.companyIds);
  report.cases.push('company IDs are absent from the form; All/single/All matches actual Host business tool scope');

  await panel.locator('[data-pw-page=settings]').click(); await panel.getByRole('button', { name: '编辑 本机 Odoo 19', exact: true }).click();
  assert.equal(await panel.getByLabel('API Key', { exact: true }).inputValue(), '');
  await panel.getByLabel('连接名称', { exact: true }).fill('本机 Odoo 19 已编辑');
  assert.equal(await panel.locator('[data-pw-page=crm]').isDisabled(), true);
  await panel.getByRole('button', { name: '验证并保存' }).click(); await saved(panel);
  report.cases.push('editing keeps the stored key hidden and supports blank-key reuse; unsaved form blocks navigation');
  await add(panel, env20, '本机 Odoo 20'); await panel.getByLabel('设为默认连接', { exact: true }).check();
  await panel.getByRole('button', { name: '验证并保存' }).click(); await saved(panel);
  await panel.getByRole('button', { name: '编辑 本机 Odoo 20', exact: true }).click();
  await panel.getByLabel('数据库', { exact: true }).fill('other-db'); await panel.getByRole('button', { name: '测试连接', exact: true }).click();
  await panel.getByRole('alert').filter({ hasText: '更换服务器或数据库时必须重新填写' }).waitFor();
  await panel.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal((await host.ctx.credentials.listRecords()).filter(row => row.key.startsWith('pw-plugins-odoo/')).length, 2);
  const metadata = await readFile(join(process.env.DSH_HOME, 'profiles', profile, 'data', 'pw-plugins-odoo', 'settings.json'), 'utf8');
  assert.ok(!metadata.includes(env19.ODOO_API_KEY) && !metadata.includes(env20.ODOO_API_KEY));
  assert.ok(!await page.locator('body').textContent().then(text => text.includes(env19.ODOO_API_KEY) || text.includes(env20.ODOO_API_KEY)));
  await page.screenshot({ path: resolve(directory, 'connections-saved.png') });
  report.cases.push('Odoo 20 supports default selection; changed destination requires a new key; metadata and rendered page omit credentials');
  await context.close(); await host.shutdown.shutdown(0); host = undefined;
  await boot(); ({ context, page, panel } = await pageFor());
  await panel.getByRole('button', { name: '编辑 本机 Odoo 19 已编辑', exact: true }).waitFor();
  await panel.getByRole('button', { name: '编辑 本机 Odoo 20', exact: true }).waitFor();
  assert.ok((await panel.getByLabel('Odoo 连接', { exact: true }).locator('option:checked').textContent()).includes('Odoo 20'));
  await panel.locator('[data-pw-page=crm]').click(); await panel.locator('.pw-odoo-record').first().waitFor();
  report.cases.push('Host restart restores both connections and the chosen default, then reads real CRM without re-entering keys');
  await panel.locator('[data-pw-page=settings]').click();
  await page.setViewportSize({ width: 900, height: 950 });
  await panel.getByRole('button', { name: '编辑 本机 Odoo 20', exact: true }).click();
  assert.equal(await panel.evaluate(element => element.scrollWidth > element.clientWidth + 1), false);
  await page.emulateMedia({ colorScheme: 'dark' }); await page.screenshot({ path: resolve(directory, 'settings-narrow-dark.png') });
  await panel.getByRole('button', { name: '取消', exact: true }).click();
  for (const label of ['本机 Odoo 19 已编辑', '本机 Odoo 20']) {
    await panel.getByRole('button', { name: `删除 ${label}`, exact: true }).click(); await panel.getByRole('button', { name: '确认删除', exact: true }).click();
    await panel.getByText('连接已删除。', { exact: true }).waitFor();
  }
  await panel.getByText(/尚未配置 Odoo/).waitFor();
  assert.equal((await host.ctx.credentials.listRecords()).filter(row => row.key.startsWith('pw-plugins-odoo/')).length, 0);
  assert.deepEqual(report.browserErrors, []);
  report.cases.push('narrow dark settings stay within the panel; deleting both connections cleans native credentials and returns to first-run state');
  await writeFile(resolve(directory, 'report.json'), JSON.stringify({ ...report, passed: true }, null, 2));
  console.log(JSON.stringify({ settingsAcceptance: 'passed', cases: report.cases.length, browserErrors: report.browserErrors.length, installed: Boolean(installed) }));
  ok = true;
} finally { await browser?.close(); await host?.shutdown.shutdown(ok ? 0 : 1); }
