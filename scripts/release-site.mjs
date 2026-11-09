import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { parseMarketIndex, marketInstallTarget } from '@deepseek-ai/dsh-plugin-market-index';

// Only a real registry publication can produce a deployable index. Never advertise a pending package.
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const archive = process.argv[2];
if (!archive) throw new Error('Pass the exact accepted npm tarball as the first argument.');
const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`, { signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error(`npm package is not available (HTTP ${response.status}); no site generated.`);
const registry = await response.json();
const current = registry.versions?.[pkg.version];
const integrity = 'sha512-' + createHash('sha512').update(await readFile(archive)).digest('base64');
if (!current || current.dist?.integrity !== integrity) throw new Error('Registry version does not match the accepted local tarball; no site generated.');
const versions = Object.values(registry.versions).filter(row => row.name === pkg.name && row.dsh?.bundle && row.repository?.url === pkg.repository.url && !row.deprecated && !row.private && row.engines?.dsh && registry.time?.[row.version]).map(row => ({
  version: row.version, publishTimestamp: Math.floor(Date.parse(registry.time[row.version]) / 1000), engines: { dsh: row.engines.dsh }, source: { type: 'npm', registry: 'https://registry.npmjs.org' },
}));
const index = { format: 1, title: { en: 'Parallel World Plugins', zh: '平行世界插件' }, description: { en: 'Plugins published by ParallelWorldLabs.', zh: 'ParallelWorldLabs 发布的插件。' }, plugins: [{
  name: pkg.name, title: { en: 'PW Odoo', zh: '平行世界 Odoo' }, description: { en: pkg.description, zh: 'Odoo CRM、销售、采购与库存只读工作台，支持连接设置、公司选择和 Agent 页面联动。' },
  icon: 'icons/odoo.svg', author: 'ParallelWorldLabs', homepage: pkg.homepage, repository: { url: 'https://github.com/ParallelWorldLabs/PW-Plugins-Odoo' }, versions,
}] };
const siteUrl = 'https://parallelworldlabs.github.io/PW-Plugins-Odoo/';
const validated = parseMarketIndex(index, siteUrl + 'index.json');
if (!validated.plugins[0].versions.some(row => marketInstallTarget(pkg.name, row).spec === `${pkg.name}@${pkg.version}`)) throw new Error('Index must offer this exact release.');
const directory = resolve('artifacts/release-site');
await mkdir(resolve(directory, 'icons'), { recursive: true });
await copyFile('icon.svg', resolve(directory, 'icons/odoo.svg'));
await writeFile(resolve(directory, 'index.json'), JSON.stringify(index, null, 2) + '\n');
await writeFile(resolve(directory, '.nojekyll'), '');
await writeFile(resolve(directory, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>平行世界插件</title><style>body{font:16px/1.8 system-ui,sans-serif;max-width:760px;margin:60px auto;padding:24px;color:#18313d}code{overflow-wrap:anywhere}a{color:#087d79}img{width:64px}</style><img src="icons/odoo.svg" alt=""><h1>平行世界 Odoo</h1><p>CRM、销售、采购、库存只读工作台 · ${pkg.version} · MIT</p><p>支持已验收的 DeepSeek Harness ${pkg.engines.dsh} 与 Odoo 19/20 社区版。</p><h2>添加插件索引</h2><p>在 DSH 插件页启用实验性的“自定义插件索引”，进入“发现 → 添加索引源”，粘贴：</p><p><code>${siteUrl}index.json</code></p><p>也可在“添加插件”中输入 <code>${pkg.name}@${pkg.version}</code>，安装后进入 Odoo → 设置添加连接。</p><p><a href="index.json">索引 JSON</a> · <a href="https://www.npmjs.com/package/${pkg.name}">npm</a> · <a href="https://github.com/ParallelWorldLabs/PW-Plugins-Odoo">源代码与使用说明</a></p></html>`);
console.log(JSON.stringify({ directory, siteUrl, version: pkg.version, integrityVerified: true, indexValidated: true }));
