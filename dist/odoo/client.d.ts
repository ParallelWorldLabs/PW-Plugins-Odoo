import { type OdooConfig } from '../core/config.js';
import { type Model } from '../core/contracts.js';
export declare class OdooClient {
    #private;
    constructor(config: OdooConfig);
    get scope(): {
        url: string;
        database: string | null;
        companyIds: number[];
        lang: string;
        timezone: string;
    };
    readCall(model: Model | 'mail.activity' | 'ir.module.module' | 'ir.model.data' | 'res.company', method: 'fields_get' | 'search_read' | 'read', params: Record<string, unknown>, signal?: AbortSignal, options?: {
        includeArchived?: boolean;
    }): Promise<unknown>;
    version(signal?: AbortSignal): Promise<string>;
}
