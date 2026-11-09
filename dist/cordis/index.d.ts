import type { Context } from '@deepseek-ai/cordis';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import { OdooService } from '../core/service.js';
import { type PanelTarget } from '../panel/contracts.js';
export { OdooController } from './controller.js';
export declare const name = "pw-plugins-odoo";
export declare const inject: string[];
export declare function registerReadTools(ctx: Context, service?: OdooService, resolveService?: (exec: ToolRunContext, target?: PanelTarget) => Promise<OdooService>): void;
export declare function apply(ctx: Context): Promise<void>;
