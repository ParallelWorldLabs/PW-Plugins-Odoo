import test from 'node:test';
import assert from 'node:assert/strict';
import { quantityUnitField, serviceOutsourcingField } from '../dist/odoo/capabilities.js';

const unit = { type: 'many2one', relation: 'uom.uom' };

test('quantity units resolve the actual Odoo 19 and 20 field names', () => {
  assert.equal(quantityUnitField({ product_uom_id: unit }), 'product_uom_id');
  assert.equal(quantityUnitField({ product_uom: unit }), 'product_uom');
  assert.equal(quantityUnitField({ uom_id: unit }), 'uom_id');
  assert.equal(quantityUnitField({ uom_id: unit, product_uom_id: unit }), 'uom_id');
});

test('quantity units fail closed for absent or semantically different relationships', () => {
  for (const fields of [{}, { uom_id: { type: 'char' } }, { product_uom_id: { type: 'many2one', relation: 'res.company' } }]) {
    assert.throws(() => quantityUnitField(fields), { code: 'FIELD_DENIED' });
  }
});

test('outsourcing resolves the Odoo 19 boolean and Odoo 20 subcontract selection', () => {
  assert.deepEqual(serviceOutsourcingField({ service_to_purchase: { type: 'boolean' } }), { field: 'service_to_purchase', enabledValue: true });
  assert.deepEqual(serviceOutsourcingField({ service_tracking: { type: 'selection', selection: [['no', 'Nothing'], ['subcontract', 'Subcontracting RFQ']] } }), { field: 'service_tracking', enabledValue: 'subcontract' });
  assert.equal(serviceOutsourcingField({ service_tracking: { type: 'selection', selection: [['no', 'Nothing'], ['task', 'Task']] } }), null);
  assert.equal(serviceOutsourcingField({}), null);
});
