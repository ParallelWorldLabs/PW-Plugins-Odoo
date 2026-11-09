import { z } from 'zod';
import { configSchema } from '../core/config.js';
import { OdooError } from '../core/contracts.js';
import { requestJson } from '../odoo/network.js';
import { OdooClient } from '../odoo/client.js';
/** Bootstrap only the authenticated user's own company scope, before a configured company context exists. */
export async function probeConnection(draft, apiKey, signal) {
    const initial = configSchema.parse({ url: draft.url, apiKey, database: draft.database, companyIds: [1], lang: draft.lang || 'zh_CN', timezone: draft.timezone || 'Asia/Shanghai', allowHttp: draft.allowHttp });
    const headers = { Authorization: `bearer ${initial.apiKey}`, 'X-Odoo-Database': initial.database, 'User-Agent': 'pw-plugins-odoo/settings' };
    const call = (method, params) => requestJson(new URL(`/json/2/res.users/${method}`, initial.url), headers, { ...params, context: { lang: initial.lang } }, initial.timeoutMs, signal);
    const context = z.object({ uid: z.number().int().positive() }).parse(await call('context_get', {}));
    const users = z.array(z.object({ id: z.number().int().positive(), company_id: z.tuple([z.number().int().positive(), z.string()]), company_ids: z.array(z.number().int().positive()).min(1).max(50), lang: z.union([z.string(), z.literal(false)]), tz: z.union([z.string(), z.literal(false)]) })).length(1).parse(await call('read', { ids: [context.uid], fields: ['company_id', 'company_ids', 'lang', 'tz'] }));
    const user = users[0];
    if (user.id !== context.uid)
        throw new OdooError('INVALID_RESPONSE', '用户身份不一致。');
    const allowed = [...new Set([user.company_id[0], ...user.company_ids])];
    const config = configSchema.parse({ ...initial, url: new URL(initial.url).origin, companyIds: allowed, lang: draft.lang || user.lang || 'zh_CN', timezone: draft.timezone || user.tz || 'Asia/Shanghai' });
    const client = new OdooClient(config);
    const companies = z.array(z.object({ id: z.number().int().positive(), name: z.string() })).max(50).parse(await client.readCall('res.company', 'read', { ids: config.companyIds, fields: ['name'] }, signal));
    let version = null;
    try {
        version = await client.version(signal);
    }
    catch {
        signal.throwIfAborted();
    }
    return { config, result: { authenticated: true, version, userId: user.id, companyIds: config.companyIds,
            companies: config.companyIds.map(id => ({ id, label: companies.find(row => row.id === id)?.name.slice(0, 200) ?? `公司 ${id}` })), lang: config.lang, timezone: config.timezone } };
}
