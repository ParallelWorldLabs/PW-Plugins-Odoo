import { mkdir, readFile, readlink, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/** A bare package entry lets the official Loader own metadata in both source and installed runs. */
export async function linkDevelopmentPackage(home, profile) {
  const directory = join(home, 'profiles', profile);
  const path = join(directory, 'package.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  manifest.dependencies = { ...manifest.dependencies, 'pw-plugins-odoo': `link:${resolve('.')}` };
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
  await mkdir(join(directory, 'node_modules'), { recursive: true });
  const link = join(directory, 'node_modules/pw-plugins-odoo');
  try { await symlink(resolve('.'), link, 'dir'); }
  catch (error) {
    if (error.code !== 'EEXIST' || resolve(await readlink(link)) !== resolve('.')) throw error;
  }
}
