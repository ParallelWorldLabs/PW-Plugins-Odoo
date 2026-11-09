import { type RecordData } from './contracts.js';
import type { OdooService } from './service.js';
import type { OdooClient } from '../odoo/client.js';
export declare function inventoryStatus(service: OdooService, client: OdooClient, signal?: AbortSignal): Promise<{
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
export declare function procurementTrace(service: OdooService, client: OdooClient, input: unknown, signal?: AbortSignal): Promise<{
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
