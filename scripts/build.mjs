import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const options = { bundle: true, platform: 'node', format: 'esm', target: 'node20.19', legalComments: 'external', metafile: true, banner: { js: 'import { createRequire as __pwCreateRequire } from "node:module"; const require = __pwCreateRequire(import.meta.url);' } };
const mcp = await build({ ...options, entryPoints: ['src/mcp/stdio.ts'], outfile: 'dist/mcp/stdio.js' });
const cordis = await build({ ...options, entryPoints: ['src/cordis/index.ts'], outfile: 'dist/cordis/index.js', external: ['@deepseek-ai/cordis', '@deepseek-ai/dsh-typert-protocol', '@deepseek-ai/dsh-typert-protocol/*'] });
const client = await build({ bundle: true, platform: 'browser', format: 'cjs', target: 'es2022', metafile: true, legalComments: 'external',
  entryPoints: ['src/client/index.tsx'], outfile: 'dist/client.js', external: ['react', 'react-dom', 'react/jsx-runtime'],
  banner: { js: 'window.__ModuleLoader__.load({id:"pw-plugins-odoo",factory(require){const module={exports:{}};const exports=module.exports;' },
  footer: { js: 'return module.exports;}});' },
});
if (Object.keys(client.metafile.inputs).some(path => path.includes('src/cordis/') || path.includes('src/odoo/network'))) throw new Error('Host implementation leaked into the browser bundle.');
const packages = new Map();
for (const file of [...Object.keys(mcp.metafile.inputs), ...Object.keys(cordis.metafile.inputs), ...Object.keys(client.metafile.inputs)]) {
  if (!file.startsWith('node_modules/')) continue;
  let directory = dirname(file);
  while (directory !== '.') {
    try {
      const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      if (pkg.name && pkg.version) { packages.set(pkg.name, { ...pkg, directory }); break; }
    } catch {}
    directory = dirname(directory);
  }
}
const notices = [];
for (const pkg of [...packages.values()].sort((a, b) => a.name.localeCompare(b.name))) {
  let license;
  for (const filename of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.txt', 'COPYING']) {
    try { license = await readFile(join(pkg.directory, filename), 'utf8'); break; } catch {}
  }
  if (!license) throw new Error(`Missing license text for bundled dependency ${pkg.name}`);
  notices.push(`${pkg.name}@${pkg.version} (${pkg.license ?? 'see license'})\n\n${license}`);
}
await writeFile('dist/THIRD_PARTY_NOTICES.txt', notices.join('\n\n========================================\n\n'));
