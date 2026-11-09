import { cp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { WorkspaceTypertGenerator, writePackageArtifacts } from '@deepseek-ai/dsh-typert-generator';

// The upstream analyzer owns workspace-shaped projects. Stage only this package; no machine-specific generated contracts are handwritten.
const root = resolve('artifacts/typert-workspace');
const directory = join(root, 'packages/pw-plugins-odoo');
await rm(root, { recursive: true, force: true });
await mkdir(directory, { recursive: true });
await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir');
await cp('src', join(directory, 'src'), { recursive: true });
await writeFile(join(directory, 'src/index.ts'), "export { OdooController } from './cordis/controller.js';\n");
// Upstream resolves decorator identity from a registered protocol package, including for third-party consumers.
const protocol = join(root, 'packages/dsh-typert-protocol');
await cp('node_modules/@deepseek-ai/dsh-typert-protocol', protocol, { recursive: true });
// Materialize the published declaration plane at the source paths the analyzer indexes; it is analysis-only, never executed or shipped.
await mkdir(join(protocol, 'src'), { recursive: true });
for (const file of await readdir(join(protocol, 'lib/types'))) if (file.endsWith('.d.ts')) {
  await cp(join(protocol, 'lib/types', file), join(protocol, 'src', file.replace('.d.ts', '.ts')));
}
await writeFile(join(protocol, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, skipLibCheck: true, module: 'NodeNext', moduleResolution: 'NodeNext' }, include: ['src/**/*.ts'] }));
const source = JSON.parse(await readFile('package.json', 'utf8'));
const manifest = { ...source, exports: {
  '.': { types: './lib/types/index.d.ts', default: './lib/index.js' },
  './typert': { types: './lib/typert.host.d.ts', default: './lib/typert.host.js' },
  './remote': { types: './lib/typert.remote-client.d.ts', default: './lib/typert.remote-client.js' },
}, files: ['lib/typert.host.js', 'lib/typert.host.d.ts', 'lib/typert.remote-client.js', 'lib/typert.remote-client.d.ts'] };
await writeFile(join(directory, 'package.json'), JSON.stringify(manifest));
const options = { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: true, noUncheckedIndexedAccess: true, types: ['node'], allowImportingTsExtensions: true, noEmit: true, lib: ['ES2023', 'ESNext.Disposable', 'DOM'],
  paths: { '@deepseek-ai/dsh-typert-protocol': [join(protocol, 'src/index.ts')] } };
await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: options, files: ['src/index.ts'] }));
await writeFile(join(root, 'tsconfig.host.json'), JSON.stringify({ compilerOptions: options, files: [], references: [{ path: './packages/pw-plugins-odoo' }, { path: './packages/dsh-typert-protocol' }] }));
const artifacts = new WorkspaceTypertGenerator(root, { checkDiagnostics: false }).generate(['pw-plugins-odoo'], ['host']);
if (artifacts.length !== 1 || !artifacts[0].remote) throw new Error('Expected one generated Odoo Host/Client contract.');
writePackageArtifacts(resolve('.'), artifacts);
process.stdout.write('Generated Odoo Typert Host/Client contract.\n');
