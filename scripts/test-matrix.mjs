import { spawnSync } from 'node:child_process';

// Make each file authoritative for this test run and avoid leaking one instance's environment into the other.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('ODOO_') && key !== 'PW_ODOO_CONNECTIONS_FILE'));
for (const [label, file] of [['Odoo 19', '.env'], ['Odoo 20', '.env.odoo20']]) {
  process.stdout.write(`\n${label}: read-only instance acceptance\n`);
  const result = spawnSync(process.execPath, [`--env-file=${file}`, '--test', 'tests/live.integration.mjs'], { env, stdio: 'inherit' });
  if (result.error) {
    process.stderr.write(`${label}: unable to start; verify local configuration files.\n`);
    process.exitCode = 1;
    break;
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
