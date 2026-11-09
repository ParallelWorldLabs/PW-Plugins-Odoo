import { configSchema } from '../core/config.js';
import { modelSchema, OdooError } from '../core/contracts.js';
import { requestJson } from './network.js';
export class OdooClient {
    #config;
    constructor(config) { this.#config = configSchema.parse(config); }
    get scope() {
        return { url: new URL(this.#config.url).origin, database: this.#config.database ?? null,
            companyIds: [...this.#config.companyIds], lang: this.#config.lang, timezone: this.#config.timezone };
    }
    async readCall(model, method, params, signal, options) {
        // A runtime allowlist is required even when TypeScript callers are typed.
        if (!['fields_get', 'search_read', 'read'].includes(method))
            throw new OdooError('READ_ONLY', 'Only approved read methods are available.');
        if (!['mail.activity', 'ir.module.module', 'ir.model.data', 'res.company'].includes(model) && !modelSchema.safeParse(model).success)
            throw new OdooError('MODEL_DENIED', 'Model is not allowed.');
        const headers = { Authorization: `bearer ${this.#config.apiKey}` };
        if (this.#config.database)
            headers['X-Odoo-Database'] = this.#config.database;
        return requestJson(new URL(`/json/2/${model}/${method}`, this.#config.url), headers, {
            ...params,
            context: { allowed_company_ids: [...this.#config.companyIds], lang: this.#config.lang, tz: this.#config.timezone,
                ...(options?.includeArchived ? { active_test: false } : {}) },
        }, this.#config.timeoutMs, signal);
    }
    async version(signal) {
        const headers = {};
        if (this.#config.database)
            headers['X-Odoo-Database'] = this.#config.database;
        const data = await requestJson(new URL('/web/version', this.#config.url), headers, undefined, this.#config.timeoutMs, signal);
        if (!data || typeof data !== 'object' || !('version' in data) || typeof data.version !== 'string' || !/^\d{2}\.\d/.test(data.version)) {
            throw new OdooError('VERSION_UNKNOWN', 'Odoo version could not be determined.');
        }
        return data.version.slice(0, 100);
    }
}
