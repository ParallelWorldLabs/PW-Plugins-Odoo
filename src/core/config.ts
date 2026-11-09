import { z } from 'zod';
import { isBlockedAddress } from '../odoo/network.js';

export const configSchema = z.object({
  url: z.string().url(),
  apiKey: z.string().trim().min(1).max(4096).regex(/^[\x21-\x7e]+$/),
  database: z.string().min(1).max(128).regex(/^[^\r\n]+$/).optional(),
  companyIds: z.array(z.number().int().positive()).min(1).max(50),
  lang: z.string().regex(/^[a-z]{2,3}_[A-Z]{2}$/).default('zh_CN'),
  timezone: z.string().min(1).max(100).default('Asia/Shanghai'),
  allowHttp: z.boolean().default(false),
  timeoutMs: z.number().int().min(100).max(60000).default(15000),
}).strict().superRefine((config, ctx) => {
  const url = new URL(config.url);
  if ((url.protocol !== 'https:' && !(config.allowHttp && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      isBlockedAddress(url.hostname.replace(/^\[|\]$/g, '')) ||
      /(^|\.)metadata\.google\.internal$/i.test(url.hostname)) {
    ctx.addIssue({ code: 'custom', message: 'Use an approved Odoo origin; HTTPS is required unless allowHttp is enabled.' });
  }
  try { new Intl.DateTimeFormat('en', { timeZone: config.timezone }); }
  catch { ctx.addIssue({ code: 'custom', message: 'Invalid timezone' }); }
});
export type OdooConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): OdooConfig {
  const parsed = configSchema.safeParse({
    url: env.ODOO_URL,
    apiKey: env.ODOO_API_KEY,
    database: env.ODOO_DB || undefined,
    companyIds: (env.ODOO_COMPANY_IDS || '').split(',').filter(Boolean).map(Number),
    lang: env.ODOO_LANG || undefined,
    timezone: env.ODOO_TIMEZONE || undefined,
    allowHttp: env.ODOO_ALLOW_HTTP === 'true',
  });
  if (!parsed.success) throw new Error('Invalid Odoo configuration. Set ODOO_URL, ODOO_API_KEY and ODOO_COMPANY_IDS; see README.');
  return parsed.data;
}
