import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('packed plugin initializes from a clean directory without node_modules', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'pw-odoo-package-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const packArgs = ['pack', '--silent', '--ignore-scripts', '--json', '--pack-destination', directory];
  const npmCli = process.env.npm_execpath;
  const [pack] = JSON.parse(npmCli?.endsWith('/npm-cli.js')
    ? execFileSync(process.execPath, [npmCli, ...packArgs], { encoding: 'utf8' })
    : execFileSync('npm', packArgs, { encoding: 'utf8' }));
  assert.ok(pack.files.some((file) => file.path === 'dist/THIRD_PARTY_NOTICES.txt'));
  assert.ok(pack.files.some((file) => file.path === '.env.example'));
  for (const resource of ['LICENSE', 'icon.svg', 'locale/en.json', 'locale/zh.json']) assert.ok(pack.files.some(file => file.path === resource));
  assert.ok(!pack.files.some((file) => /(^|\/)(\.env|node_modules)(\/|$)/.test(file.path)));
  assert.ok(!pack.files.some((file) => file.path.split('/').some((part) => part.startsWith('.env') && part !== '.env.example')));
  assert.ok(!pack.files.some((file) => file.path.startsWith('artifacts/') || file.path.endsWith('.dump')));
  execFileSync('tar', ['-xzf', join(directory, pack.filename), '-C', directory]);
  const root = join(directory, 'package');
  await assert.rejects(access(join(root, 'node_modules')));
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, 'dist/mcp/stdio.js')], cwd: directory, env: { ODOO_URL: 'https://odoo.example.com', ODOO_API_KEY: 'test-key', ODOO_COMPANY_IDS: '1' }, stderr: 'pipe' });
  const client = new Client({ name: 'packed-test', version: '1' });
  await client.connect(transport);
  try { assert.equal((await client.listTools()).tools.length, 7); }
  finally { await client.close(); }
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.license, 'MIT'); assert.ok(!manifest.private); assert.equal(manifest.engines.dsh, '0.2.2-rc.1');
  const { exports: entries } = manifest;
  const require = createRequire(import.meta.url);
  let loaded = false;
  runInNewContext(await readFile(join(root, entries['./client'].default), 'utf8'), { window: { __ModuleLoader__: { load(entry) {
    assert.equal(entry.id, 'pw-plugins-odoo');
    const plugin = entry.factory((name) => { assert.ok(['react', 'react-dom', 'react/jsx-runtime'].includes(name)); return require(name); });
    assert.equal(typeof plugin.apply, 'function'); loaded = true;
  } } } });
  assert.equal(loaded, true);
});
