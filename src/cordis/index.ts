import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-app-boot';
import { parseCredentialKey } from '@deepseek-ai/dsh-credentials';
import { join } from 'node:path';
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools';
import { z } from 'zod';
import { OdooError, publicError } from '../core/contracts.js';
import { OdooService } from '../core/service.js';
import { readTools } from '../core/tools.js';
import { OdooBackend } from './backend.js';
import { OdooController } from './controller.js';
import { PanelBroker } from '../panel/broker.js';
import { registerPanelTools } from './panel-tools.js';
import { panelTargetSchema, type PanelTarget } from '../panel/contracts.js';
import { ConnectionStore, type SecretVault } from '../settings/store.js';

export { OdooController } from './controller.js';

export const name = 'pw-plugins-odoo';
export const inject = ['tools', 'typert'];

export function registerReadTools(ctx: Context, service?: OdooService, resolveService?: (exec: ToolRunContext, target?: PanelTarget) => Promise<OdooService>) {
  for (const [name, description, schema, run] of readTools(service)) {
    const wireSchema = resolveService ? schema.extend({ panelTarget: panelTargetSchema.optional() }) : schema;
    const { $schema: _schema, ...parameters } = z.toJSONSchema(wireSchema, { io: 'input' });
    ctx.tools.register({
      name, description,
      parameters: parameters as ToolDefinition['parameters'],
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        try {
          const envelope = wireSchema.parse(args) as Record<string, unknown>;
          const { panelTarget, ...payload } = envelope;
          const parsed = schema.parse(payload);
          const execute = resolveService ? readTools(await resolveService(exec, panelTarget as PanelTarget | undefined)).find(([toolName]) => toolName === name)![3] : run;
          // DSH canonical values must be lossless JSON; omit optional undefined properties.
          return JSON.parse(JSON.stringify(await execute(parsed as never, exec.signal)));
        } catch (error) {
          throw new Error(JSON.stringify(publicError(error)));
        }
      },
    });
  }
}

export async function apply(ctx: Context) {
  const provider = () => { const value = ctx.get('credentials'); if (!value) throw new OdooError('SETTINGS_UNAVAILABLE', '当前 Host 的凭据库尚未就绪。'); return value; };
  const profile = ctx.get('profileContext');
  const vault: SecretVault = {
    available: () => Boolean(ctx.get('credentials')),
    async read(reference) { const record = await provider().readRecord(parseCredentialKey(reference)); return record?.kind === 'api-key' ? record.key : undefined; },
    async write(reference, key) { await provider().modifyRecord(parseCredentialKey(reference), async () => ({ kind: 'api-key', key })); },
    async remove(reference) { await provider().deleteRecord(parseCredentialKey(reference)); },
  };
  const backend = await OdooBackend.load(profile ? new ConnectionStore(join(profile.dir, 'data', 'pw-plugins-odoo', 'settings.json'), vault) : undefined);
  const panels = new PanelBroker((connectionId, companyId, version) => backend.assertScope(connectionId, companyId, version));
  registerReadTools(ctx, undefined, async (exec, target) => {
    if (target && !exec.agent) throw new OdooError('NO_AGENT', 'A panel target requires an Agent conversation.');
    const scope = exec.agent ? await panels.activeScope(exec.agent.session.id, exec.signal, target) : null;
    return scope ? backend.service(scope.connectionId, scope.companyId, scope.configVersion) : backend.defaultService();
  });
  ctx.effect(() => backend.onChange(() => panels.dispose()));
  ctx.effect(() => () => panels.dispose());
  new OdooController(ctx, backend, panels);
  registerPanelTools(ctx, panels);
}
