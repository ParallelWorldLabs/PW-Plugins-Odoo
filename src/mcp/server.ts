import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { publicError } from '../core/contracts.js';
import { OdooService } from '../core/service.js';
import { readTools } from '../core/tools.js';

export function createServer(service: OdooService) {
  const server = new McpServer({ name: 'pw-plugins-odoo', version: '0.5.2' });
  for (const [name, description, inputSchema, run] of readTools(service)) {
    server.registerTool(name, { description, inputSchema, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true } }, async (args: unknown, extra: { signal: AbortSignal }) => {
      try { return { content: [{ type: 'text' as const, text: JSON.stringify(await run(args as never, extra.signal)) }] }; }
      catch (error) { return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify(publicError(error)) }] }; }
    });
  }
  return server;
}
