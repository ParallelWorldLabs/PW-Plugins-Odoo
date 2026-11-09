import { z } from 'zod';
import { OdooError, procurementTraceSchema } from './contracts.js';
import { quantityUnitField } from '../odoo/capabilities.js';
const dependencies = ['stock', 'stock_account', 'sale_stock', 'purchase_stock', 'sale_purchase', 'sale_purchase_stock'];
const moduleRows = z.array(z.object({ name: z.enum(dependencies), state: z.string() })).max(6);
const externalIds = z.array(z.object({ module: z.string(), name: z.string(), model: z.literal('stock.route'), res_id: z.number().int().positive() })).max(2);
function scopeCheck(record, client, allowShared = true) {
    const company = record.company_id;
    if (company === false && allowShared)
        return;
    if (!Array.isArray(company) || !Number.isSafeInteger(company[0]))
        throw new OdooError('INVALID_RESPONSE', 'Company identity could not be verified.');
    if (!client.scope.companyIds.includes(company[0]))
        throw new OdooError('ACCESS_DENIED', 'Record is outside the configured company scope.');
}
function relationId(value) {
    if (!Array.isArray(value) || !Number.isSafeInteger(value[0]) || value[0] <= 0)
        throw new OdooError('INVALID_RESPONSE', 'Invalid record relationship.');
    return value[0];
}
function relationIds(value) {
    if (!Array.isArray(value) || !value.every((id) => Number.isSafeInteger(id) && id > 0))
        throw new OdooError('INVALID_RESPONSE', 'Invalid record relationships.');
    return [...new Set(value)];
}
export async function inventoryStatus(service, client, signal) {
    const modules = moduleRows.parse(await client.readCall('ir.module.module', 'search_read', {
        domain: [['name', 'in', dependencies]], fields: ['name', 'state'], limit: 6, order: 'name asc',
    }, signal));
    const installed = new Set(modules.filter((row) => row.state === 'installed').map((row) => row.name));
    const missingModules = dependencies.filter((name) => !installed.has(name));
    if (missingModules.length)
        return { scope: client.scope, modules, missingModules, infrastructureReady: false,
            routes: [], checkedAt: new Date().toISOString(), productReadiness: 'not_evaluated', readOnly: true };
    const ids = externalIds.parse(await client.readCall('ir.model.data', 'search_read', {
        domain: [['model', '=', 'stock.route'], '|', '&', ['module', '=', 'stock'], ['name', '=', 'route_warehouse0_mto'],
            '&', ['module', '=', 'purchase_stock'], ['name', '=', 'route_warehouse0_buy']],
        fields: ['module', 'name', 'model', 'res_id'], limit: 2, order: 'id asc',
    }, signal));
    const routes = [];
    for (const [module, name, purpose] of [['stock', 'route_warehouse0_mto', 'mto'], ['purchase_stock', 'route_warehouse0_buy', 'buy']]) {
        const xmlid = ids.find((row) => row.module === module && row.name === name);
        const result = xmlid ? await service.get({ model: 'stock.route', id: xmlid.res_id, fields: ['name', 'active', 'company_id', 'product_selectable', 'rule_ids'] }, signal) : null;
        if (result?.record)
            scopeCheck(result.record, client);
        routes.push({ purpose, externalId: `${module}.${name}`, record: result?.record ?? null });
    }
    const warehouses = await service.query({ model: 'stock.warehouse', limit: 25 }, signal);
    for (const warehouse of warehouses.records)
        scopeCheck(warehouse, client, false);
    return { scope: client.scope, modules, missingModules, infrastructureReady: true, routes,
        globalRoutesActive: routes.every((route) => route.record?.active === true),
        warehouses: warehouses.records, warehousesMayHaveMore: warehouses.nextOffset !== null,
        checkedAt: new Date().toISOString(), productReadiness: 'not_evaluated', readOnly: true };
}
export async function procurementTrace(service, client, input, signal) {
    const args = procurementTraceSchema.parse(input);
    const root = await service.get({ model: 'sale.order', id: args.saleOrderId, fields: ['name', 'state', 'company_id'] }, signal);
    if (!root.record)
        throw new OdooError('RECORD_UNAVAILABLE', 'Sales order is missing or unavailable.');
    scopeCheck(root.record, client, false);
    const companyId = relationId(root.record.company_id);
    const saleMetadata = await service.fields('sale.order.line', signal);
    const purchaseMetadata = await service.fields('purchase.order.line', signal);
    const moveMetadata = await service.fields('stock.move', signal);
    const quantityUnitFields = {
        'sale.order.line': quantityUnitField(saleMetadata),
        'purchase.order.line': quantityUnitField(purchaseMetadata),
        'stock.move': quantityUnitField(moveMetadata),
    };
    const lineFields = ['order_id', 'company_id', 'product_id', 'product_uom_qty', quantityUnitFields['sale.order.line'], 'qty_delivered', 'state', 'move_ids', 'purchase_line_ids'];
    const linePage = await service.query({ model: 'sale.order.line', fields: lineFields,
        filters: [{ field: 'order_id', operator: '=', value: args.saleOrderId }, { field: 'display_type', operator: '=', value: false }], limit: args.maxLines + 1 }, signal);
    let truncated = linePage.records.length > args.maxLines;
    const lines = linePage.records.slice(0, args.maxLines);
    const moves = new Map();
    const missingMoves = new Set();
    const wantedPurchases = new Set();
    const evidence = [];
    const moveFields = ['company_id', 'state', 'product_id', 'product_uom_qty', quantityUnitFields['stock.move'], 'quantity', 'picking_id', 'procure_method', 'move_orig_ids', 'purchase_line_id', 'created_purchase_line_ids'];
    const addPurchase = (saleLineId, purchaseLineId, kind, moveId) => {
        if (wantedPurchases.size >= 100 && !wantedPurchases.has(purchaseLineId)) {
            truncated = true;
            return;
        }
        wantedPurchases.add(purchaseLineId);
        if (evidence.length >= 500) {
            truncated = true;
            return;
        }
        evidence.push({ saleLineId, purchaseLineId, kind, ...(moveId ? { moveId } : {}) });
    };
    const sameCompany = (record) => {
        scopeCheck(record, client, false);
        if (relationId(record.company_id) !== companyId)
            throw new OdooError('INVALID_RESPONSE', 'Unexpected company relationship in procurement chain.');
    };
    for (const line of lines) {
        sameCompany(line);
        if (relationId(line.order_id) !== args.saleOrderId)
            throw new OdooError('INVALID_RESPONSE', 'Unexpected sales line identity.');
        for (const id of relationIds(line.purchase_line_ids).slice(0, 101))
            addPurchase(line.id, id, 'sale_line_relation');
        if (relationIds(line.purchase_line_ids).length > 100)
            truncated = true;
        const seen = new Set();
        let frontier = relationIds(line.move_ids);
        for (let depth = 0; depth < args.maxDepth && frontier.length; depth++) {
            const pending = frontier.filter((id) => !seen.has(id));
            if (!pending.length) {
                frontier = [];
                break;
            }
            const unknown = pending.filter((id) => !moves.has(id) && !missingMoves.has(id));
            const batch = unknown.slice(0, Math.max(0, args.maxMoves - moves.size - missingMoves.size));
            if (batch.length < unknown.length)
                truncated = true;
            if (batch.length) {
                const page = await service.query({ model: 'stock.move', fields: moveFields,
                    filters: [{ field: 'id', operator: 'in', value: batch }], limit: batch.length }, signal);
                for (const move of page.records) {
                    if (!batch.includes(move.id))
                        throw new OdooError('INVALID_RESPONSE', 'Unexpected stock move identity.');
                    sameCompany(move);
                    moves.set(move.id, move);
                }
                for (const id of batch)
                    if (!moves.has(id))
                        missingMoves.add(id);
            }
            const next = new Set();
            for (const id of pending) {
                seen.add(id);
                const move = moves.get(id);
                if (!move)
                    continue;
                if (move.purchase_line_id !== false)
                    addPurchase(line.id, relationId(move.purchase_line_id), 'stock_purchase_move', id);
                for (const purchaseId of relationIds(move.created_purchase_line_ids).slice(0, 101))
                    addPurchase(line.id, purchaseId, 'stock_demand_relation', id);
                if (relationIds(move.created_purchase_line_ids).length > 100)
                    truncated = true;
                const ancestors = relationIds(move.move_orig_ids);
                if (ancestors.length > args.maxMoves)
                    truncated = true;
                for (const ancestor of ancestors.slice(0, args.maxMoves))
                    if (!seen.has(ancestor))
                        next.add(ancestor);
            }
            frontier = [...next];
        }
        if (frontier.some((id) => !seen.has(id)))
            truncated = true;
    }
    const purchaseIds = [...wantedPurchases];
    const purchaseLines = purchaseIds.length ? (await service.query({ model: 'purchase.order.line',
        fields: ['order_id', 'company_id', 'product_id', 'product_qty', quantityUnitFields['purchase.order.line'], 'qty_received', 'state', 'sale_line_id'],
        filters: [{ field: 'id', operator: 'in', value: purchaseIds }], limit: purchaseIds.length }, signal)).records : [];
    for (const line of purchaseLines) {
        sameCompany(line);
        if (!wantedPurchases.has(line.id))
            throw new OdooError('INVALID_RESPONSE', 'Unexpected purchase line identity.');
    }
    const orderIds = [...new Set(purchaseLines.map((line) => relationId(line.order_id)))];
    const purchaseOrders = orderIds.length ? (await service.query({ model: 'purchase.order',
        fields: ['name', 'company_id', 'state', 'partner_id', 'currency_id', 'amount_total'],
        filters: [{ field: 'id', operator: 'in', value: orderIds }], limit: orderIds.length }, signal)).records : [];
    for (const order of purchaseOrders) {
        sameCompany(order);
        if (!orderIds.includes(order.id))
            throw new OdooError('INVALID_RESPONSE', 'Unexpected purchase order identity.');
    }
    const visiblePurchases = new Set(purchaseLines.map((line) => line.id));
    const unresolved = missingMoves.size + purchaseIds.length - purchaseLines.length + orderIds.length - purchaseOrders.length;
    return { scope: client.scope, saleOrder: root.record, quantityUnitFields,
        saleLines: lines.map(({ move_ids: _moves, purchase_line_ids: _purchases, ...line }) => line),
        links: evidence.filter((link) => visiblePurchases.has(link.purchaseLineId)), purchaseLines, purchaseOrders,
        moves: [...moves.values()].map(({ move_orig_ids: _orig, created_purchase_line_ids: _created, ...move }) => move),
        truncated, unresolvedRecordCount: unresolved, completeWithinLimits: !truncated && unresolved === 0,
        limits: { maxLines: args.maxLines, maxMoves: args.maxMoves, maxDepth: args.maxDepth },
        interpretation: 'Relationships show provenance, not proof of MTO configuration or current fulfillment. No matching by document names.',
        fetchedAt: new Date().toISOString(), dataTrust: 'untrusted_erp_data' };
}
