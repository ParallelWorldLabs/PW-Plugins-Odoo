import type { Context } from '@deepseek-ai/cordis';
import type { OdooTransport } from './model.js';
/** Consume the generated namespace directly; no browser ERP connection or hand-built RPC endpoint. */
export declare function createTransport(ctx: Context, sessionId: string): OdooTransport;
