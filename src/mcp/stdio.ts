import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from '../core/config.js';
import { OdooService } from '../core/service.js';
import { OdooClient } from '../odoo/client.js';
import { createServer } from './server.js';

try {
  const server = createServer(new OdooService(new OdooClient(loadConfig())));
  await server.connect(new StdioServerTransport());
} catch {
  process.stderr.write('PW Odoo could not start. Check local configuration; see README.\n');
  process.exitCode = 1;
}
