import { z } from 'zod';
import { type Settings, type ConnectionDraft } from '../settings/contracts.js';
import type { FieldInfo, RecordData } from '../core/contracts.js';
import { type Page, type PanelAction, type PanelSnapshot } from '../panel/contracts.js';
export declare const connectionSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    url: z.ZodString;
    database: z.ZodNullable<z.ZodString>;
    companyIds: z.ZodArray<z.ZodNumber>;
    companies: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        label: z.ZodString;
    }, z.core.$strip>>>;
    companyNamesUnavailable: z.ZodOptional<z.ZodBoolean>;
    lang: z.ZodString;
    timezone: z.ZodString;
    allowHttp: z.ZodOptional<z.ZodBoolean>;
    hasApiKey: z.ZodOptional<z.ZodBoolean>;
    configVersion: z.ZodDefault<z.ZodString>;
    source: z.ZodOptional<z.ZodEnum<{
        saved: "saved";
        environment: "environment";
    }>>;
    readOnly: z.ZodLiteral<true>;
}, z.core.$strip>;
export type Connection = z.infer<typeof connectionSchema>;
export interface PanelStream extends AsyncIterable<string> {
    send(value: string): Promise<void>;
    dispose(): void;
}
export interface OdooTransport {
    connections(signal: AbortSignal): Promise<string>;
    read(connectionId: string, companyId: number, operation: string, input: unknown, signal: AbortSignal, configVersion?: string): Promise<string>;
    settings?(signal: AbortSignal): Promise<string>;
    testConnection?(input: ConnectionDraft, signal: AbortSignal): Promise<string>;
    saveConnection?(input: unknown, signal: AbortSignal): Promise<string>;
    deleteConnection?(input: unknown, signal: AbortSignal): Promise<string>;
    panel(clientId: string, tabId: string, occurrence: string, signal: AbortSignal): PanelStream;
}
type Filter = {
    keyword: string;
    state: string;
    stageId: number | null;
    crmType: 'lead' | 'opportunity';
    includeArchived: boolean;
};
type InventoryKind = 'quant' | 'incoming' | 'outgoing' | 'products';
type View = {
    filter: Filter;
    draftKeyword: string;
    offset: number;
    rows: RecordData[];
    fields: string[];
    metadata: Record<string, FieldInfo>;
    selectedId: number | null;
    detail: RecordData | null;
    trace: Record<string, unknown> | null;
    activities: RecordData[];
    fetchedAt: string | null;
    nextOffset: number | null;
    loading: boolean;
    error: string | null;
};
export interface PanelState {
    version: number;
    connections: Connection[];
    connectionId: string;
    companyId: number;
    page: Page;
    inventoryKind: InventoryKind;
    view: View;
    stages: RecordData[];
    history: {
        time: string;
        label: string;
        ok: boolean;
    }[];
    settings: Settings | null;
    settingsDirty: boolean;
    diagnostic: Record<string, unknown> | null;
    visible: boolean;
    online: boolean;
    startupError: string | null;
}
/** One occurrence's model. Navigation, mouse actions and Agent commands share these operations. */
export declare class OdooPanelModel {
    private readonly transport;
    readonly clientId: string;
    readonly tabId: string;
    readonly occurrence: string;
    private readonly preferences?;
    private state;
    private lifetime;
    private listeners;
    private views;
    private epoch;
    private request;
    private stream;
    private streamAbort;
    private lastRendered;
    private pendingReceipts;
    constructor(transport: OdooTransport, clientId: string, tabId: string, occurrence: string, preferences?: {
        initialScope?: {
            connectionId: string;
            companyId: number;
        };
        saveScope?: (connectionId: string, companyId: number) => void;
    } | undefined);
    getSnapshot: () => PanelState;
    subscribe: (listener: () => void) => () => void;
    private change;
    private view;
    private key;
    private log;
    private cancel;
    private begin;
    private valid;
    private call;
    currentModel(): string | null;
    connection(): {
        id: string;
        label: string;
        url: string;
        database: string | null;
        companyIds: number[];
        lang: string;
        timezone: string;
        configVersion: string;
        readOnly: true;
        companies?: {
            id: number;
            label: string;
        }[] | undefined;
        companyNamesUnavailable?: boolean | undefined;
        allowHttp?: boolean | undefined;
        hasApiKey?: boolean | undefined;
        source?: "saved" | "environment" | undefined;
    } | undefined;
    start(signal: AbortSignal): Promise<void>;
    settingsEdited(dirty: boolean): void;
    private settingsSignal;
    refreshSettings(): Promise<void>;
    private adoptSettings;
    testConnection(input: ConnectionDraft): Promise<{
        authenticated: true;
        version: string | null;
        userId: number;
        companyIds: number[];
        companies: {
            id: number;
            label: string;
        }[];
        lang: string;
        timezone: string;
    }>;
    saveConnection(input: ConnectionDraft, makeDefault: boolean, expectedRevision: number): Promise<void>;
    deleteConnection(id: string, expectedRevision: number): Promise<void>;
    private attach;
    reconnect(signal: AbortSignal): Promise<void>;
    stop(): void;
    setVisible(visible: boolean): void;
    switchScope(connectionId: string, companyId: number): Promise<void>;
    navigate(page: Page): Promise<void>;
    inventory(kind: InventoryKind): Promise<void>;
    draftKeyword(value: string): void;
    reportError(message: string): void;
    filter(patch: Partial<Filter>): Promise<void>;
    paginate(offset: number): Promise<void>;
    select(id: number): void;
    back(): void;
    load(): Promise<void>;
    detail(id: number): Promise<void>;
    trace(): Promise<void>;
    diagnostic(): Promise<void>;
    snapshot(): PanelSnapshot;
    rendered(version: number): void;
    private send;
    private flushReceipts;
    private receiveAction;
    apply(action: PanelAction): Promise<void>;
}
export declare function messageOf(error: unknown): string;
export {};
