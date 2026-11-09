import type { Context } from '@deepseek-ai/cordis';
import { type Page } from '../panel/contracts.js';
export declare const TAB_KIND = "pw-odoo";
export declare const TAB_ID = "pw-plugins-odoo/workbench";
declare module '@deepseek-ai/dsh-client-ui-sidebar-right/client' {
    interface SidebarRightTabParamsMap {
        'pw-odoo': {
            page: Page;
        };
    }
}
export declare const inject: string[];
export declare function apply(ctx: Context): Promise<void>;
