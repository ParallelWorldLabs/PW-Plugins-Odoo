import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService, type RemoteStream } from '@deepseek-ai/dsh-typert-protocol';
import { OdooBackend } from './backend.js';
import { PanelBroker } from '../panel/broker.js';
declare module '@deepseek-ai/cordis' {
    interface Context {
        pwOdoo: OdooController;
    }
}
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface RemoteErrorDetailsMap {
        'pw-odoo/rejected': {
            readonly code: string;
        };
    }
}
/** Owner-authenticated browser entry; ERP credentials remain in this Host service. */
export declare class OdooController extends TypertRemoteService {
    private readonly backend;
    private readonly panels;
    constructor(ctx: Context, backend: OdooBackend, panels: PanelBroker);
    /** Return public connection choices, never environment paths or credentials. */
    connections(signal: AbortSignal): Promise<string>;
    /** Execute one owner read request with a Client Session identity and narrowed company scope. */
    execute(sessionId: string, connectionId: string, companyId: number, configVersion: string, operation: string, payload: string, signal: AbortSignal): Promise<string>;
    settings(signal: AbortSignal): Promise<string>;
    testConnection(payload: string, signal: AbortSignal): Promise<string>;
    saveConnection(payload: string, signal: AbortSignal): Promise<string>;
    deleteConnection(payload: string, signal: AbortSignal): Promise<string>;
    private settingPayload;
    private settingRequest;
    /** Bind one concrete Client/tab occurrence to its Session, with validated bounded snapshot uplink. */
    panel(sessionId: string, clientId: string, tabId: string, occurrence: string, signal: AbortSignal): RemoteStream<string, string>;
    private owner;
}
