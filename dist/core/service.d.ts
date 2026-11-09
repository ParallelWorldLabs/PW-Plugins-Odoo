import { OdooClient } from '../odoo/client.js';
import { type FieldInfo, type Model, type RecordData } from './contracts.js';
export declare const readableFields: Record<Model, readonly string[]>;
export declare class OdooService {
    private readonly client;
    constructor(client: OdooClient);
    inventoryStatus(signal?: AbortSignal): Promise<{
        scope: {
            url: string;
            database: string | null;
            companyIds: number[];
            lang: string;
            timezone: string;
        };
        modules: {
            name: string;
            state: string;
        }[];
        missingModules: string[];
        infrastructureReady: boolean;
        routes: never[];
        checkedAt: string;
        productReadiness: string;
        readOnly: boolean;
        globalRoutesActive?: undefined;
        warehouses?: undefined;
        warehousesMayHaveMore?: undefined;
    } | {
        scope: {
            url: string;
            database: string | null;
            companyIds: number[];
            lang: string;
            timezone: string;
        };
        modules: {
            name: string;
            state: string;
        }[];
        missingModules: string[];
        infrastructureReady: boolean;
        routes: {
            purpose: "mto" | "buy";
            externalId: string;
            record: RecordData | null;
        }[];
        globalRoutesActive: boolean;
        warehouses: RecordData[];
        warehousesMayHaveMore: boolean;
        checkedAt: string;
        productReadiness: string;
        readOnly: boolean;
    }>;
    procurementTrace(input: unknown, signal?: AbortSignal): Promise<{
        scope: {
            url: string;
            database: string | null;
            companyIds: number[];
            lang: string;
            timezone: string;
        };
        saleOrder: RecordData;
        quantityUnitFields: {
            'sale.order.line': string;
            'purchase.order.line': string;
            'stock.move': string;
        };
        saleLines: {
            [x: string]: unknown;
            id: number;
        }[];
        links: {
            saleLineId: number;
            purchaseLineId: number;
            kind: string;
            moveId?: number;
        }[];
        purchaseLines: RecordData[];
        purchaseOrders: RecordData[];
        moves: {
            [x: string]: unknown;
            id: number;
        }[];
        truncated: boolean;
        unresolvedRecordCount: number;
        completeWithinLimits: boolean;
        limits: {
            maxLines: number;
            maxMoves: number;
            maxDepth: number;
        };
        interpretation: string;
        fetchedAt: string;
        dataTrust: string;
    }>;
    fields(input: unknown, signal?: AbortSignal): Promise<Record<string, FieldInfo>>;
    private discoverFields;
    private selectFields;
    private checkField;
    private records;
    query(input: unknown, signal?: AbortSignal): Promise<{
        scope: {
            url: string;
            database: string | null;
            companyIds: number[];
            lang: string;
            timezone: string;
        };
        model: "res.partner" | "product.template" | "product.product" | "sale.order" | "purchase.order" | "crm.lead" | "crm.stage" | "crm.team" | "crm.tag" | "crm.lost.reason" | "sale.order.line" | "purchase.order.line" | "product.supplierinfo" | "stock.warehouse" | "stock.location" | "stock.picking.type" | "stock.picking" | "stock.move" | "stock.move.line" | "stock.quant" | "stock.route" | "stock.rule";
        fields: string[];
        records: RecordData[];
        offset: number;
        limit: number;
        nextOffset: number | null;
        includeArchived: boolean;
        fetchedAt: string;
        dataTrust: string;
    }>;
    get(input: unknown, signal?: AbortSignal): Promise<{
        scope: {
            url: string;
            database: string | null;
            companyIds: number[];
            lang: string;
            timezone: string;
        };
        model: "res.partner" | "product.template" | "product.product" | "sale.order" | "purchase.order" | "crm.lead" | "crm.stage" | "crm.team" | "crm.tag" | "crm.lost.reason" | "sale.order.line" | "purchase.order.line" | "product.supplierinfo" | "stock.warehouse" | "stock.location" | "stock.picking.type" | "stock.picking" | "stock.move" | "stock.move.line" | "stock.quant" | "stock.route" | "stock.rule";
        record: RecordData | null;
        fetchedAt: string;
        dataTrust: string;
    }>;
    crmActivities(input: unknown, signal?: AbortSignal): Promise<{
        scope: {
            url: string;
            database: string | null;
            companyIds: number[];
            lang: string;
            timezone: string;
        };
        model: string;
        leadId: number;
        fields: string[];
        records: RecordData[];
        limit: number;
        offset: number;
        nextOffset: number | null;
        fetchedAt: string;
        dataTrust: string;
    }>;
    status(signal?: AbortSignal): Promise<{
        scope: {
            url: string;
            database: string | null;
            companyIds: number[];
            lang: string;
            timezone: string;
        };
        version: string | null;
        versionError: {
            code: string;
            message: string;
            status: number | undefined;
        } | {
            code: string;
            message: string;
            status?: undefined;
        } | undefined;
        readOnly: boolean;
        authenticated: boolean;
        compatibility: string;
        models: ("res.partner" | "product.template" | "product.product" | "sale.order" | "purchase.order" | "crm.lead" | "crm.stage" | "crm.team" | "crm.tag" | "crm.lost.reason" | "sale.order.line" | "purchase.order.line" | "product.supplierinfo" | "stock.warehouse" | "stock.location" | "stock.picking.type" | "stock.picking" | "stock.move" | "stock.move.line" | "stock.quant" | "stock.route" | "stock.rule")[];
        partnerReadableFields: string[];
        checkedAt: string;
    }>;
}
