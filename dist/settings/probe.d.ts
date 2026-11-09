import { type OdooConfig } from '../core/config.js';
import type { ConnectionDraft, ProbeResult } from './contracts.js';
/** Bootstrap only the authenticated user's own company scope, before a configured company context exists. */
export declare function probeConnection(draft: ConnectionDraft, apiKey: string, signal: AbortSignal): Promise<{
    config: OdooConfig;
    result: ProbeResult;
}>;
