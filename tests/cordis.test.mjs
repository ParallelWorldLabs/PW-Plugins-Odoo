import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { ToolsService } from '@deepseek-ai/dsh-tools';
import { registerReadTools } from '../dist/cordis/index.js';

test('actual Cordis and DSH registry load, invoke and dispose seven shared read tools', async (t) => {
  const ctx = new Context();
  ctx.provide('systemPrompt', { tools() {} });
  const toolsFiber = await ctx.plugin(ToolsService);
  t.after(async () => { await toolsFiber.dispose(); });
  const signal = new AbortController().signal;
  let receivedSignal;
  const service = {
    status: async (value) => { receivedSignal = value; return { version: null, versionError: undefined, readOnly: true }; },
    fields: async () => ({ id: { type: 'integer' } }),
    query: async (args) => ({ model: args.model, records: [] }),
    get: async () => { throw new Error('private provider failure with credentials'); },
  };
  const fiber = await ctx.plugin({ inject: ['tools'], apply(child) { registerReadTools(child, service); } });
  assert.equal(ctx.tools.schemas().length, 7);
  const tool = ctx.tools.get('pw_odoo_status');
  assert.deepEqual(await tool.execute({}, { signal }), { version: null, readOnly: true });
  assert.equal(receivedSignal, signal);
  await assert.rejects(ctx.tools.get('pw_odoo_query').execute({ model: 'res.users' }, { signal }), /INVALID_INPUT/);
  await assert.rejects(ctx.tools.get('pw_odoo_get').execute({ model: 'sale.order', id: 1 }, { signal }), (error) => error.message.includes('INTERNAL_ERROR') && !error.message.includes('credentials'));
  await fiber.dispose();
  assert.equal(ctx.tools.schemas().length, 0);
});
