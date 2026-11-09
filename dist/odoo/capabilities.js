import { OdooError } from '../core/contracts.js';
// Resolve against the actual instance, including customized builds; never infer semantics from the version string alone.
export function quantityUnitField(fields) {
    for (const name of ['uom_id', 'product_uom_id', 'product_uom']) {
        if (fields[name]?.type === 'many2one' && fields[name]?.relation === 'uom.uom')
            return name;
    }
    throw new OdooError('FIELD_DENIED', 'Quantity unit is unavailable or has an unsupported relationship.');
}
export function serviceOutsourcingField(fields) {
    if (fields.service_to_purchase?.type === 'boolean')
        return { field: 'service_to_purchase', enabledValue: true };
    if (fields.service_tracking?.type === 'selection' && fields.service_tracking.selection?.some(([value]) => value === 'subcontract')) {
        return { field: 'service_tracking', enabledValue: 'subcontract' };
    }
    return null;
}
