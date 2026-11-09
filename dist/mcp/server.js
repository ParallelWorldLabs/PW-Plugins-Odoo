import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { publicError } from '../core/contracts.js';
import { readTools } from '../core/tools.js';
export function createServer(service) {
    const server = new McpServer({ name: 'pw-plugins-odoo', version: '0.5.2' });
    for (const [name, description, inputSchema, run] of readTools(service)) {
        server.registerTool(name, { description, inputSchema, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true } }, async (args, extra) => {
            try {
                return { content: [{ type: 'text', text: JSON.stringify(await run(args, extra.signal)) }] };
            }
            catch (error) {
                return { isError: true, content: [{ type: 'text', text: JSON.stringify(publicError(error)) }] };
            }
        });
    }
    return server;
}
