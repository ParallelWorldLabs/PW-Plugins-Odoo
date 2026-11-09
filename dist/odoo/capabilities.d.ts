import { type FieldInfo } from '../core/contracts.js';
export declare function quantityUnitField(fields: Record<string, FieldInfo>): string;
export declare function serviceOutsourcingField(fields: Record<string, FieldInfo>): {
    field: string;
    enabledValue: boolean | string;
} | null;
