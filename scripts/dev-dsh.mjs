import { access, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { loadLayeredEnv } from '@deepseek-ai/dsh-app-boot';
import { initializeProfileFromDefault, runProfile } from '@deepseek-ai/dsh/profile-boot';
import { linkDevelopmentPackage } from './dsh-development-profile.mjs';

// A private development profile. Never replace the user's normal DSH home or profile.
const home = resolve(process.env.PW_ODOO_DEV_HOME ?? 'artifacts/dsh-dev-home');
process.env.DSH_HOME = home;
const profiles = resolve('.local/connections.json');
try { await access(profiles); process.env.PW_ODOO_CONNECTIONS_FILE ??= profiles; } catch { /* Single-connection .env remains supported. */ }
const profile = 'pw-odoo-dev';
try { await access(join(home, 'profiles', profile, 'package.json')); }
catch { initializeProfileFromDefault(profile, 'web', home); }
await linkDevelopmentPackage(home, profile);
await mkdir('artifacts', { recursive: true });
const overlay = resolve('artifacts/dsh-dev-overlay.json');
await writeFile(overlay, JSON.stringify([
  { id: 'ui-settings-models', config: { credentialOnboarding: false } },
  { insert: [{ id: 'pw-plugins-odoo', name: 'pw-plugins-odoo', config: {} }] },
], null, 2));
await runProfile({ environment: loadLayeredEnv('pw-odoo-dev'), profile, patchFiles: [overlay], args: ['--no-open', '--port', '8879', ...process.argv.slice(2)] });
