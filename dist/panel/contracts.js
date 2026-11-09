import { z } from 'zod';
export const pageSchema = z.enum(['crm', 'sales', 'purchase', 'inventory', 'history', 'settings', 'connections']).transform(page => page === 'connections' ? 'settings' : page);
export const pages = [
    { id: 'crm', label: 'CRM' }, { id: 'sales', label: '销售' }, { id: 'purchase', label: '采购' },
    { id: 'inventory', label: '库存' }, { id: 'history', label: '记录' }, { id: 'settings', label: '设置' },
];
export const panelActionSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('navigate'), page: pageSchema }).strict(),
    z.object({ kind: z.literal('filter'), keyword: z.string().max(200).optional(), state: z.string().max(80).optional(), stageId: z.number().int().positive().nullable().optional(), crmType: z.enum(['lead', 'opportunity']).optional(), includeArchived: z.boolean().optional() }).strict(),
    z.object({ kind: z.literal('select'), id: z.number().int().positive() }).strict(),
    z.object({ kind: z.literal('detail'), id: z.number().int().positive() }).strict(),
    z.object({ kind: z.literal('refresh') }).strict(),
]);
export const panelIdentitySchema = z.object({
    clientId: z.string().min(1).max(120), tabId: z.string().min(1).max(200), occurrence: z.string().min(1).max(100),
});
export const panelSnapshotSchema = panelIdentitySchema.extend({
    version: z.number().int().nonnegative(), connectionId: z.string().max(80), companyId: z.number().int().nonnegative(), configVersion: z.string().max(100).default(''),
    companyIds: z.array(z.number().int().positive()).min(1).max(50).optional(),
    page: pageSchema, visible: z.boolean(), model: z.string().max(100).nullable(),
    filter: z.string().max(2000), selectedId: z.number().int().positive().nullable(),
    displayed: z.string().max(24000), loading: z.boolean(), error: z.string().max(1000).nullable(),
    fetchedAt: z.string().max(50).nullable(), capturedAt: z.string().max(50), truncated: z.boolean(),
}).strict();
export const panelTargetSchema = panelIdentitySchema.extend({ expectedVersion: z.number().int().nonnegative() }).strict();
export const panelCommandSchema = z.object({
    requestId: z.string().max(100), target: panelTargetSchema, action: panelActionSchema,
    connectionId: z.string().max(80), companyId: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
}).strict();
export const uplinkSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('snapshot'), snapshot: panelSnapshotSchema }).strict(),
    z.object({ kind: z.literal('receipt'), requestId: z.string().max(100), ok: z.boolean(), message: z.string().max(1000), snapshot: panelSnapshotSchema }).strict(),
]);
export const downlinkSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('ready') }).strict(),
    z.object({ kind: z.literal('context'), requestId: z.string().max(100) }).strict(),
    z.object({ kind: z.literal('action'), command: panelCommandSchema }).strict(),
]);
/** Keep only bounded business text, never DOM, HTML execution, credentials or hidden records. */
export function summarize(value, depth = 0) {
    if (typeof value === 'string')
        return value.slice(0, 500);
    if (value === null || typeof value === 'boolean' || typeof value === 'number')
        return value;
    if (Array.isArray(value) && value.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item)))
        return value.slice(0, 10).map(item => typeof item === 'string' ? item.slice(0, 500) : item);
    if (depth > 2)
        return '[已省略]';
    if (Array.isArray(value))
        return value.slice(0, 10).map(item => summarize(item, depth + 1));
    if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).slice(0, 20).map(([key, item]) => [key, summarize(item, depth + 1)]));
    return null;
}
export function summaryIsTruncated(value, depth = 0) {
    if (typeof value === 'string')
        return value.length > 500;
    if (!value || typeof value !== 'object')
        return false;
    if (Array.isArray(value) && value.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item)))
        return value.length > 10 || value.some(item => typeof item === 'string' && item.length > 500);
    if (depth > 2)
        return true;
    if (Array.isArray(value))
        return value.length > 10 || value.slice(0, 10).some(item => summaryIsTruncated(item, depth + 1));
    const entries = Object.values(value);
    return entries.length > 20 || entries.slice(0, 20).some(item => summaryIsTruncated(item, depth + 1));
}
