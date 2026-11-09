import { z } from 'zod';
export declare const modelSchema: z.ZodEnum<{
    "res.partner": "res.partner";
    "product.template": "product.template";
    "product.product": "product.product";
    "sale.order": "sale.order";
    "purchase.order": "purchase.order";
    "crm.lead": "crm.lead";
    "crm.stage": "crm.stage";
    "crm.team": "crm.team";
    "crm.tag": "crm.tag";
    "crm.lost.reason": "crm.lost.reason";
    "sale.order.line": "sale.order.line";
    "purchase.order.line": "purchase.order.line";
    "product.supplierinfo": "product.supplierinfo";
    "stock.warehouse": "stock.warehouse";
    "stock.location": "stock.location";
    "stock.picking.type": "stock.picking.type";
    "stock.picking": "stock.picking";
    "stock.move": "stock.move";
    "stock.move.line": "stock.move.line";
    "stock.quant": "stock.quant";
    "stock.route": "stock.route";
    "stock.rule": "stock.rule";
}>;
export type Model = z.infer<typeof modelSchema>;
export declare const filterSchema: z.ZodObject<{
    field: z.ZodString;
    operator: z.ZodEnum<{
        "=": "=";
        "!=": "!=";
        ">": ">";
        ">=": ">=";
        "<": "<";
        "<=": "<=";
        in: "in";
        "not in": "not in";
        ilike: "ilike";
        like: "like";
    }>;
    value: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>]>;
}, z.core.$strict>;
export declare const querySchema: z.ZodObject<{
    model: z.ZodEnum<{
        "res.partner": "res.partner";
        "product.template": "product.template";
        "product.product": "product.product";
        "sale.order": "sale.order";
        "purchase.order": "purchase.order";
        "crm.lead": "crm.lead";
        "crm.stage": "crm.stage";
        "crm.team": "crm.team";
        "crm.tag": "crm.tag";
        "crm.lost.reason": "crm.lost.reason";
        "sale.order.line": "sale.order.line";
        "purchase.order.line": "purchase.order.line";
        "product.supplierinfo": "product.supplierinfo";
        "stock.warehouse": "stock.warehouse";
        "stock.location": "stock.location";
        "stock.picking.type": "stock.picking.type";
        "stock.picking": "stock.picking";
        "stock.move": "stock.move";
        "stock.move.line": "stock.move.line";
        "stock.quant": "stock.quant";
        "stock.route": "stock.route";
        "stock.rule": "stock.rule";
    }>;
    fields: z.ZodOptional<z.ZodArray<z.ZodString>>;
    filters: z.ZodDefault<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodEnum<{
            "=": "=";
            "!=": "!=";
            ">": ">";
            ">=": ">=";
            "<": "<";
            "<=": "<=";
            in: "in";
            "not in": "not in";
            ilike: "ilike";
            like: "like";
        }>;
        value: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>, z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>]>;
    }, z.core.$strict>>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    includeArchived: z.ZodDefault<z.ZodBoolean>;
    sort: z.ZodOptional<z.ZodObject<{
        field: z.ZodString;
        direction: z.ZodEnum<{
            asc: "asc";
            desc: "desc";
        }>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const crmActivitiesSchema: z.ZodObject<{
    leadId: z.ZodNumber;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
export declare const procurementTraceSchema: z.ZodObject<{
    saleOrderId: z.ZodNumber;
    maxLines: z.ZodDefault<z.ZodNumber>;
    maxMoves: z.ZodDefault<z.ZodNumber>;
    maxDepth: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
export declare const getSchema: z.ZodObject<{
    model: z.ZodEnum<{
        "res.partner": "res.partner";
        "product.template": "product.template";
        "product.product": "product.product";
        "sale.order": "sale.order";
        "purchase.order": "purchase.order";
        "crm.lead": "crm.lead";
        "crm.stage": "crm.stage";
        "crm.team": "crm.team";
        "crm.tag": "crm.tag";
        "crm.lost.reason": "crm.lost.reason";
        "sale.order.line": "sale.order.line";
        "purchase.order.line": "purchase.order.line";
        "product.supplierinfo": "product.supplierinfo";
        "stock.warehouse": "stock.warehouse";
        "stock.location": "stock.location";
        "stock.picking.type": "stock.picking.type";
        "stock.picking": "stock.picking";
        "stock.move": "stock.move";
        "stock.move.line": "stock.move.line";
        "stock.quant": "stock.quant";
        "stock.route": "stock.route";
        "stock.rule": "stock.rule";
    }>;
    id: z.ZodNumber;
    fields: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strict>;
export type FieldInfo = {
    string?: string;
    type: string;
    relation?: string;
    required?: boolean;
    readonly?: boolean;
    selection?: [string | number, string][];
    currency_field?: string;
};
export type RecordData = Record<string, unknown> & {
    id: number;
};
export declare class OdooError extends Error {
    readonly code: string;
    readonly status?: number | undefined;
    constructor(code: string, message: string, status?: number | undefined);
}
export declare function publicError(error: unknown): {
    code: string;
    message: string;
    status: number | undefined;
} | {
    code: string;
    message: string;
    status?: undefined;
};
