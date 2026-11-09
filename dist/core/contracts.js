import { z } from 'zod';
export const modelSchema = z.enum([
    'res.partner', 'product.template', 'product.product', 'sale.order', 'purchase.order',
    'crm.lead', 'crm.stage', 'crm.team', 'crm.tag', 'crm.lost.reason',
    'sale.order.line', 'purchase.order.line', 'product.supplierinfo',
    'stock.warehouse', 'stock.location', 'stock.picking.type', 'stock.picking',
    'stock.move', 'stock.move.line', 'stock.quant', 'stock.route', 'stock.rule',
]);
const scalar = z.union([z.string().max(1000), z.number().finite(), z.boolean()]);
export const filterSchema = z.object({
    field: z.string().regex(/^[a-z][a-z0-9_]*$/),
    operator: z.enum(['=', '!=', '>', '>=', '<', '<=', 'in', 'not in', 'ilike', 'like']),
    value: z.union([scalar, z.array(scalar).max(100)]),
}).strict().superRefine((filter, ctx) => {
    if (['in', 'not in'].includes(filter.operator) !== Array.isArray(filter.value)) {
        ctx.addIssue({ code: 'custom', message: 'in/not in require arrays; other operators require scalars' });
    }
    if (['ilike', 'like'].includes(filter.operator) && typeof filter.value !== 'string') {
        ctx.addIssue({ code: 'custom', message: 'Text operators require strings' });
    }
});
export const querySchema = z.object({
    model: modelSchema,
    fields: z.array(z.string()).min(1).max(25).optional(),
    filters: z.array(filterSchema).max(20).default([]),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).max(10000).default(0),
    includeArchived: z.boolean().default(false),
    sort: z.object({ field: z.string(), direction: z.enum(['asc', 'desc']) }).strict().optional(),
}).strict();
export const crmActivitiesSchema = z.object({
    leadId: z.number().int().positive(),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).max(10000).default(0),
}).strict();
export const procurementTraceSchema = z.object({
    saleOrderId: z.number().int().positive(),
    maxLines: z.number().int().min(1).max(25).default(10),
    maxMoves: z.number().int().min(1).max(100).default(50),
    maxDepth: z.number().int().min(1).max(8).default(4),
}).strict();
export const getSchema = z.object({
    model: modelSchema,
    id: z.number().int().positive(),
    fields: z.array(z.string()).min(1).max(25).optional(),
}).strict();
export class OdooError extends Error {
    code;
    status;
    constructor(code, message, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'OdooError';
    }
}
export function publicError(error) {
    if (error instanceof OdooError)
        return { code: error.code, message: error.message, status: error.status };
    if (error instanceof z.ZodError)
        return { code: 'INVALID_INPUT', message: 'Invalid arguments. Check model, fields, filters and pagination.' };
    return { code: 'INTERNAL_ERROR', message: 'Operation could not be completed.' };
}
