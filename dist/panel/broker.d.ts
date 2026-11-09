import { type Downlink, type PanelAction, type PanelSnapshot, type PanelTarget } from './contracts.js';
type Receipt = {
    ok: boolean;
    message: string;
    snapshot: PanelSnapshot;
};
type Binding = {
    sessionId: string;
    peerId: string;
    clientId: string;
    tabId: string;
    occurrence: string;
};
export declare class PanelLink {
    readonly binding: Binding;
    private readonly validateScope;
    private readonly timeoutMs;
    private readonly released;
    snapshot: PanelSnapshot | null;
    private queue;
    private wake;
    private closed;
    private pending;
    constructor(binding: Binding, validateScope: (connectionId: string, companyId: number, configVersion?: string) => void, timeoutMs: number, released: () => void);
    receive(text: string): void;
    request(action: PanelAction | null, target: PanelTarget | null, signal: AbortSignal): Promise<Receipt>;
    frames(): AsyncGenerator<Downlink>;
    close(): void;
}
export declare class PanelBroker {
    private readonly validateScope;
    private readonly timeoutMs;
    private links;
    constructor(validateScope: (connectionId: string, companyId: number, configVersion?: string) => void, timeoutMs?: number);
    open(binding: Binding, signal: AbortSignal): PanelLink;
    private find;
    context(sessionId: string, signal: AbortSignal, target?: Omit<PanelTarget, 'expectedVersion'>): Promise<{
        ok: boolean;
        message: string;
        candidates: {
            clientId: string;
            tabId: string;
            occurrence: string;
            version: number;
            page: "crm" | "sales" | "purchase" | "inventory" | "history" | "settings";
            connectionId: string;
            companyId: number;
        }[];
    } | {
        snapshot: {
            clientId: string;
            tabId: string;
            occurrence: string;
            version: number;
            connectionId: string;
            companyId: number;
            configVersion: string;
            page: "crm" | "sales" | "purchase" | "inventory" | "history" | "settings";
            visible: boolean;
            model: string | null;
            filter: string;
            selectedId: number | null;
            displayed: string;
            loading: boolean;
            error: string | null;
            fetchedAt: string | null;
            capturedAt: string;
            truncated: boolean;
            companyIds?: number[] | undefined;
        };
        ok: boolean;
        message: string;
        candidates?: undefined;
    }>;
    action(sessionId: string, target: PanelTarget, action: PanelAction, signal: AbortSignal): Promise<Receipt>;
    activeScope(sessionId: string, signal: AbortSignal, target?: PanelTarget): Promise<{
        connectionId: string;
        companyId: number;
        configVersion: string;
    } | null>;
    dispose(): void;
}
export {};
