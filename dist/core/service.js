import { z } from 'zod';
import { crmActivitiesSchema, getSchema, modelSchema, OdooError, publicError, querySchema } from './contracts.js';
import { inventoryStatus, procurementTrace } from './stock.js';
const common = ['id', 'name', 'display_name', 'company_id'];
export const readableFields = {
    'res.partner': [...common, 'is_company', 'customer_rank', 'supplier_rank', 'email', 'phone', 'city', 'country_id', 'active'],
    'product.template': [...common, 'default_code', 'list_price', 'uom_id', 'categ_id', 'sale_ok', 'purchase_ok', 'active', 'type', 'is_storable', 'route_ids', 'route_from_categ_ids', 'seller_ids', 'service_to_purchase', 'service_tracking', 'qty_available', 'virtual_available'],
    'product.product': [...common, 'default_code', 'list_price', 'uom_id', 'categ_id', 'product_tmpl_id', 'active', 'type', 'is_storable', 'sale_ok', 'purchase_ok', 'route_ids', 'route_from_categ_ids', 'seller_ids', 'service_to_purchase', 'service_tracking', 'qty_available', 'virtual_available'],
    'sale.order': [...common, 'partner_id', 'date_order', 'state', 'amount_total', 'currency_id', 'user_id', 'opportunity_id', 'warehouse_id', 'picking_ids', 'delivery_status'],
    'purchase.order': [...common, 'partner_id', 'date_order', 'state', 'amount_total', 'currency_id', 'user_id', 'picking_ids', 'receipt_status', 'origin'],
    'crm.lead': [...common, 'type', 'active', 'partner_id', 'partner_name', 'contact_name', 'email_from', 'phone',
        'stage_id', 'user_id', 'team_id', 'tag_ids', 'priority', 'expected_revenue', 'prorated_revenue', 'company_currency',
        'probability', 'won_status', 'date_deadline', 'date_open', 'date_closed', 'date_last_stage_update', 'lost_reason_id',
        'activity_state', 'activity_date_deadline', 'activity_summary', 'activity_type_id', 'description', 'create_date', 'write_date',
        'quotation_count', 'sale_order_count'],
    'crm.stage': ['id', 'name', 'display_name', 'sequence', 'is_won', 'fold', 'team_ids'],
    'crm.team': [...common, 'active', 'user_id', 'use_leads', 'use_opportunities', 'currency_id'],
    'crm.tag': ['id', 'name', 'display_name', 'color'],
    'crm.lost.reason': ['id', 'name', 'display_name', 'active'],
    'sale.order.line': [...common, 'order_id', 'product_id', 'product_uom_qty', 'product_uom_id', 'product_uom', 'qty_delivered', 'price_unit', 'state', 'route_ids', 'move_ids', 'purchase_line_ids', 'display_type'],
    'purchase.order.line': [...common, 'order_id', 'product_id', 'product_qty', 'uom_id', 'product_uom_id', 'product_uom', 'qty_received', 'price_unit', 'state', 'sale_line_id', 'move_ids', 'move_dest_ids', 'date_planned', 'display_type'],
    'product.supplierinfo': ['id', 'display_name', 'company_id', 'partner_id', 'product_tmpl_id', 'product_id', 'price', 'currency_id', 'uom_id', 'product_uom_id', 'min_qty', 'delay', 'sequence', 'date_start', 'date_end'],
    'stock.warehouse': [...common, 'code', 'active', 'partner_id', 'lot_stock_id', 'view_location_id', 'in_type_id', 'out_type_id', 'reception_steps', 'delivery_steps'],
    'stock.location': [...common, 'complete_name', 'usage', 'location_id', 'active', 'warehouse_id'],
    'stock.picking.type': [...common, 'code', 'warehouse_id', 'default_location_src_id', 'default_location_dest_id', 'active'],
    'stock.picking': [...common, 'origin', 'state', 'picking_type_id', 'location_id', 'location_dest_id', 'partner_id', 'scheduled_date', 'date_done', 'sale_id', 'purchase_id', 'backorder_id'],
    'stock.move': ['id', 'display_name', 'company_id', 'reference', 'product_id', 'product_uom_qty', 'uom_id', 'product_uom', 'quantity', 'state', 'picking_id', 'location_id', 'location_dest_id', 'sale_line_id', 'purchase_line_id', 'created_purchase_line_ids', 'move_orig_ids', 'move_dest_ids', 'procure_method', 'rule_id', 'origin_returned_move_id'],
    'stock.move.line': ['id', 'display_name', 'company_id', 'move_id', 'picking_id', 'product_id', 'uom_id', 'product_uom_id', 'quantity', 'location_id', 'location_dest_id', 'lot_id', 'state'],
    'stock.quant': ['id', 'display_name', 'company_id', 'product_id', 'location_id', 'quantity', 'reserved_quantity', 'available_quantity', 'uom_id', 'product_uom_id', 'lot_id', 'owner_id'],
    'stock.route': [...common, 'active', 'sequence', 'product_selectable', 'product_categ_selectable', 'warehouse_selectable', 'warehouse_ids', 'rule_ids'],
    'stock.rule': [...common, 'active', 'action', 'route_id', 'warehouse_id', 'picking_type_id', 'location_src_id', 'location_dest_id', 'procure_method'],
};
const defaultFields = {
    'crm.lead': ['name', 'type', 'company_id', 'partner_id', 'stage_id', 'user_id', 'team_id', 'expected_revenue', 'company_currency', 'probability', 'date_deadline', 'active'],
    'crm.stage': ['name', 'sequence', 'is_won', 'fold', 'team_ids'],
    'crm.team': ['name', 'company_id', 'user_id', 'use_leads', 'use_opportunities', 'active'],
    'crm.tag': ['name', 'color'],
    'crm.lost.reason': ['name', 'active'],
    'sale.order.line': ['order_id', 'company_id', 'product_id', 'product_uom_qty', 'product_uom_id', 'product_uom', 'qty_delivered', 'state'],
    'purchase.order.line': ['order_id', 'company_id', 'product_id', 'product_qty', 'uom_id', 'product_uom_id', 'product_uom', 'qty_received', 'state'],
    'product.supplierinfo': ['partner_id', 'product_tmpl_id', 'product_id', 'company_id', 'price', 'currency_id', 'uom_id', 'product_uom_id', 'min_qty', 'delay'],
    'stock.warehouse': ['name', 'code', 'company_id', 'lot_stock_id', 'active'],
    'stock.location': ['complete_name', 'usage', 'company_id', 'location_id', 'active'],
    'stock.picking.type': ['name', 'code', 'company_id', 'warehouse_id'],
    'stock.picking': ['name', 'origin', 'state', 'company_id', 'picking_type_id', 'scheduled_date', 'sale_id', 'purchase_id'],
    'stock.move': ['reference', 'company_id', 'product_id', 'product_uom_qty', 'uom_id', 'product_uom', 'quantity', 'state', 'picking_id', 'procure_method'],
    'stock.move.line': ['move_id', 'product_id', 'quantity', 'uom_id', 'product_uom_id', 'location_id', 'location_dest_id', 'company_id'],
    'stock.quant': ['product_id', 'location_id', 'company_id', 'quantity', 'reserved_quantity', 'available_quantity', 'uom_id', 'product_uom_id'],
    'stock.route': ['name', 'company_id', 'active', 'product_selectable', 'rule_ids'],
    'stock.rule': ['name', 'company_id', 'action', 'route_id', 'procure_method', 'location_src_id', 'location_dest_id'],
};
const activityFields = ['id', 'res_model', 'res_id', 'activity_type_id', 'summary', 'note', 'date_deadline', 'user_id', 'state'];
const fieldInfoSchema = z.object({ type: z.string(), string: z.string().optional(), relation: z.string().optional(), required: z.boolean().optional(), readonly: z.boolean().optional(),
    selection: z.array(z.tuple([z.union([z.string(), z.number()]), z.string()])).optional(), currency_field: z.string().optional() });
export class OdooService {
    client;
    constructor(client) {
        this.client = client;
    }
    inventoryStatus(signal) { return inventoryStatus(this, this.client, signal); }
    procurementTrace(input, signal) { return procurementTrace(this, this.client, input, signal); }
    async fields(input, signal) {
        const model = modelSchema.parse(input);
        return this.discoverFields(model, readableFields[model], signal);
    }
    async discoverFields(model, allowed, signal) {
        const result = await this.client.readCall(model, 'fields_get', {
            allfields: [...allowed], attributes: ['string', 'type', 'relation', 'required', 'readonly', 'selection', 'currency_field'],
        }, signal);
        if (!result || typeof result !== 'object' || Array.isArray(result))
            throw new OdooError('INVALID_RESPONSE', 'Invalid field metadata.');
        const output = {};
        for (const name of allowed) {
            if (Object.hasOwn(result, name)) {
                const parsed = fieldInfoSchema.safeParse(result[name]);
                if (!parsed.success)
                    throw new OdooError('INVALID_RESPONSE', 'Invalid field metadata.');
                output[name] = parsed.data;
            }
        }
        return output;
    }
    selectFields(requested, metadata, defaults = ['name', 'company_id']) {
        const fields = [...new Set(['id', ...(requested ?? defaults.filter((name) => Object.hasOwn(metadata, name)))])];
        for (const field of fields)
            this.checkField(field, metadata);
        return fields;
    }
    checkField(field, metadata) {
        if (!Object.hasOwn(metadata, field))
            throw new OdooError('FIELD_DENIED', 'A requested field is unavailable or not allowed.');
    }
    records(value, fields, limit) {
        if (!Array.isArray(value) || value.length > limit)
            throw new OdooError('INVALID_RESPONSE', 'Unexpected record response.');
        const seenIds = new Set();
        return value.map((record) => {
            if (!record || typeof record !== 'object' || !('id' in record) || !Number.isSafeInteger(record.id) || record.id <= 0)
                throw new OdooError('INVALID_RESPONSE', 'Unexpected record response.');
            if (seenIds.has(record.id))
                throw new OdooError('INVALID_RESPONSE', 'Duplicate record identity.');
            seenIds.add(record.id);
            // Drop unrequested fields, including fields added by a customized upstream method.
            return Object.fromEntries(fields.filter((field) => Object.hasOwn(record, field)).map((field) => [field, record[field]]));
        });
    }
    async query(input, signal) {
        const args = querySchema.parse(input);
        const metadata = await this.fields(args.model, signal);
        const fields = this.selectFields(args.fields, metadata, defaultFields[args.model]);
        for (const filter of args.filters)
            this.checkField(filter.field, metadata);
        if (args.sort)
            this.checkField(args.sort.field, metadata);
        const order = args.sort ? `${args.sort.field} ${args.sort.direction}${args.sort.field === 'id' ? '' : ', id asc'}` : 'id asc';
        const result = await this.client.readCall(args.model, 'search_read', {
            fields, domain: args.filters.map(({ field, operator, value }) => [field, operator, value]),
            limit: args.limit, offset: args.offset, order,
        }, signal, { includeArchived: args.includeArchived });
        const records = this.records(result, fields, args.limit);
        return { scope: this.client.scope, model: args.model, fields, records, offset: args.offset, limit: args.limit,
            nextOffset: records.length === args.limit && args.offset + args.limit <= 10000 ? args.offset + args.limit : null,
            includeArchived: args.includeArchived, fetchedAt: new Date().toISOString(), dataTrust: 'untrusted_erp_data' };
    }
    async get(input, signal) {
        const args = getSchema.parse(input);
        const metadata = await this.fields(args.model, signal);
        const fields = this.selectFields(args.fields, metadata, defaultFields[args.model]);
        const records = this.records(await this.client.readCall(args.model, 'read', { ids: [args.id], fields }, signal), fields, 1);
        if (records.some((record) => record.id !== args.id))
            throw new OdooError('INVALID_RESPONSE', 'Unexpected record identity.');
        return { scope: this.client.scope, model: args.model, record: records[0] ?? null, fetchedAt: new Date().toISOString(), dataTrust: 'untrusted_erp_data' };
    }
    async crmActivities(input, signal) {
        const args = crmActivitiesSchema.parse(input);
        // Check the parent before touching the cross-application activity model.
        const parent = await this.get({ model: 'crm.lead', id: args.leadId, fields: ['company_id'] }, signal);
        if (!parent.record)
            throw new OdooError('RECORD_UNAVAILABLE', 'CRM record is missing or unavailable.');
        const company = parent.record.company_id;
        if (company !== false && (!Array.isArray(company) || !Number.isSafeInteger(company[0]))) {
            throw new OdooError('INVALID_RESPONSE', 'CRM company scope could not be verified.');
        }
        if (Array.isArray(company) && !this.client.scope.companyIds.includes(company[0])) {
            throw new OdooError('ACCESS_DENIED', 'CRM record is outside the configured company scope.');
        }
        const metadata = await this.discoverFields('mail.activity', activityFields, signal);
        for (const field of ['res_model', 'res_id', 'date_deadline'])
            this.checkField(field, metadata);
        const fields = this.selectFields(undefined, metadata, activityFields);
        const records = this.records(await this.client.readCall('mail.activity', 'search_read', {
            fields, domain: [['res_model', '=', 'crm.lead'], ['res_id', '=', args.leadId]],
            limit: args.limit, offset: args.offset, order: 'date_deadline asc, id asc',
        }, signal), fields, args.limit);
        if (records.some((record) => record.res_model !== 'crm.lead' || record.res_id !== args.leadId)) {
            throw new OdooError('INVALID_RESPONSE', 'Unexpected CRM activity target.');
        }
        return { scope: this.client.scope, model: 'mail.activity', leadId: args.leadId, fields, records,
            limit: args.limit, offset: args.offset,
            nextOffset: records.length === args.limit && args.offset + args.limit <= 10000 ? args.offset + args.limit : null,
            fetchedAt: new Date().toISOString(), dataTrust: 'untrusted_erp_data' };
    }
    async status(signal) {
        let version = null;
        let versionError;
        try {
            version = await this.client.version(signal);
        }
        catch (error) {
            versionError = publicError(error);
        }
        // A public version endpoint alone does not prove API authentication.
        const fields = await this.fields('res.partner', signal);
        return { scope: this.client.scope, version, versionError, readOnly: true, authenticated: true,
            compatibility: version && /^(19|20)\./.test(version) ? 'target_version_requires_instance_acceptance' : 'unknown_or_outside_target',
            models: modelSchema.options, partnerReadableFields: Object.keys(fields), checkedAt: new Date().toISOString() };
    }
}
