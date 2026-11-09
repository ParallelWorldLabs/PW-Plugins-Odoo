import { z } from 'zod';
export declare const pageSchema: z.ZodPipe<z.ZodEnum<{
    connections: "connections";
    crm: "crm";
    sales: "sales";
    purchase: "purchase";
    inventory: "inventory";
    history: "history";
    settings: "settings";
}>, z.ZodTransform<"crm" | "sales" | "purchase" | "inventory" | "history" | "settings", "connections" | "crm" | "sales" | "purchase" | "inventory" | "history" | "settings">>;
export type Page = z.infer<typeof pageSchema>;
export declare const pages: {
    id: Page;
    label: string;
}[];
export declare const panelActionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"navigate">;
    page: z.ZodPipe<z.ZodEnum<{
        connections: "connections";
        crm: "crm";
        sales: "sales";
        purchase: "purchase";
        inventory: "inventory";
        history: "history";
        settings: "settings";
    }>, z.ZodTransform<"crm" | "sales" | "purchase" | "inventory" | "history" | "settings", "connections" | "crm" | "sales" | "purchase" | "inventory" | "history" | "settings">>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"filter">;
    keyword: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    stageId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    crmType: z.ZodOptional<z.ZodEnum<{
        lead: "lead";
        opportunity: "opportunity";
    }>>;
    includeArchived: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"select">;
    id: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"detail">;
    id: z.ZodNumber;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"refresh">;
}, z.core.$strict>], "kind">;
export type PanelAction = z.infer<typeof panelActionSchema>;
export declare const panelIdentitySchema: z.ZodObject<{
    clientId: z.ZodString;
    tabId: z.ZodString;
    occurrence: z.ZodString;
}, z.core.$strip>;
export declare const panelSnapshotSchema: z.ZodObject<{
    clientId: z.ZodString;
    tabId: z.ZodString;
    occurrence: z.ZodString;
    version: z.ZodNumber;
    connectionId: z.ZodString;
    companyId: z.ZodNumber;
    configVersion: z.ZodDefault<z.ZodString>;
    companyIds: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    page: z.ZodPipe<z.ZodEnum<{
        connections: "connections";
        crm: "crm";
        sales: "sales";
        purchase: "purchase";
        inventory: "inventory";
        history: "history";
        settings: "settings";
    }>, z.ZodTransform<"crm" | "sales" | "purchase" | "inventory" | "history" | "settings", "connections" | "crm" | "sales" | "purchase" | "inventory" | "history" | "settings">>;
    visible: z.ZodBoolean;
    model: z.ZodNullable<z.ZodString>;
    filter: z.ZodString;
    selectedId: z.ZodNullable<z.ZodNumber>;
    displayed: z.ZodString;
    loading: z.ZodBoolean;
    error: z.ZodNullable<z.ZodString>;
    fetchedAt: z.ZodNullable<z.ZodString>;
    capturedAt: z.ZodString;
    truncated: z.ZodBoolean;
}, z.core.$strict>;
export type PanelSnapshot = z.infer<typeof panelSnapshotSchema>;
export declare const panelTargetSchema: z.ZodObject<{
    clientId: z.ZodString;
    tabId: z.ZodString;
    occurrence: z.ZodString;
    expectedVersion: z.ZodNumber;
}, z.core.$strict>;
export type PanelTarget = z.infer<typeof panelTargetSchema>;
export declare const panelCommandSchema: z.ZodObject<{
    requestId: z.ZodString;
    target: z.ZodObject<{
        clientId: z.ZodString;
        tabId: z.ZodString;
        occurrence: z.ZodString;
        expectedVersion: z.ZodNumber;
    }, z.core.$strict>;
    action: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"navigate">;
        page: z.ZodPipe<z.ZodEnum<{
            connections: "connections";
            crm: "crm";
            sales: "sales";
            purchase: "purchase";
            inventory: "inventory";
            history: "history";
            settings: "settings";
        }>, z.ZodTransform<"crm" | "sales" | "purchase" | "inventory" | "history" | "settings", "connections" | "crm" | "sales" | "purchase" | "inventory" | "history" | "settings">>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"filter">;
        keyword: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        stageId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        crmType: z.ZodOptional<z.ZodEnum<{
            lead: "lead";
            opportunity: "opportunity";
        }>>;
        includeArchived: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"select">;
        id: z.ZodNumber;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"detail">;
        id: z.ZodNumber;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"refresh">;
    }, z.core.$strict>], "kind">;
    connectionId: z.ZodString;
    companyId: z.ZodNumber;
    expiresAt: z.ZodNumber;
}, z.core.$strict>;
export type PanelCommand = z.infer<typeof panelCommandSchema>;
export declare const uplinkSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"snapshot">;
    snapshot: z.ZodObject<{
        clientId: z.ZodString;
        tabId: z.ZodString;
        occurrence: z.ZodString;
        version: z.ZodNumber;
        connectionId: z.ZodString;
        companyId: z.ZodNumber;
        configVersion: z.ZodDefault<z.ZodString>;
        companyIds: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        page: z.ZodPipe<z.ZodEnum<{
            connections: "connections";
            crm: "crm";
            sales: "sales";
            purchase: "purchase";
            inventory: "inventory";
            history: "history";
            settings: "settings";
        }>, z.ZodTransform<"crm" | "sales" | "purchase" | "inventory" | "history" | "settings", "connections" | "crm" | "sales" | "purchase" | "inventory" | "history" | "settings">>;
        visible: z.ZodBoolean;
        model: z.ZodNullable<z.ZodString>;
        filter: z.ZodString;
        selectedId: z.ZodNullable<z.ZodNumber>;
        displayed: z.ZodString;
        loading: z.ZodBoolean;
        error: z.ZodNullable<z.ZodString>;
        fetchedAt: z.ZodNullable<z.ZodString>;
        capturedAt: z.ZodString;
        truncated: z.ZodBoolean;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"receipt">;
    requestId: z.ZodString;
    ok: z.ZodBoolean;
    message: z.ZodString;
    snapshot: z.ZodObject<{
        clientId: z.ZodString;
        tabId: z.ZodString;
        occurrence: z.ZodString;
        version: z.ZodNumber;
        connectionId: z.ZodString;
        companyId: z.ZodNumber;
        configVersion: z.ZodDefault<z.ZodString>;
        companyIds: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        page: z.ZodPipe<z.ZodEnum<{
            connections: "connections";
            crm: "crm";
            sales: "sales";
            purchase: "purchase";
            inventory: "inventory";
            history: "history";
            settings: "settings";
        }>, z.ZodTransform<"crm" | "sales" | "purchase" | "inventory" | "history" | "settings", "connections" | "crm" | "sales" | "purchase" | "inventory" | "history" | "settings">>;
        visible: z.ZodBoolean;
        model: z.ZodNullable<z.ZodString>;
        filter: z.ZodString;
        selectedId: z.ZodNullable<z.ZodNumber>;
        displayed: z.ZodString;
        loading: z.ZodBoolean;
        error: z.ZodNullable<z.ZodString>;
        fetchedAt: z.ZodNullable<z.ZodString>;
        capturedAt: z.ZodString;
        truncated: z.ZodBoolean;
    }, z.core.$strict>;
}, z.core.$strict>], "kind">;
export declare const downlinkSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"ready">;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"context">;
    requestId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"action">;
    command: z.ZodObject<{
        requestId: z.ZodString;
        target: z.ZodObject<{
            clientId: z.ZodString;
            tabId: z.ZodString;
            occurrence: z.ZodString;
            expectedVersion: z.ZodNumber;
        }, z.core.$strict>;
        action: z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"navigate">;
            page: z.ZodPipe<z.ZodEnum<{
                connections: "connections";
                crm: "crm";
                sales: "sales";
                purchase: "purchase";
                inventory: "inventory";
                history: "history";
                settings: "settings";
            }>, z.ZodTransform<"crm" | "sales" | "purchase" | "inventory" | "history" | "settings", "connections" | "crm" | "sales" | "purchase" | "inventory" | "history" | "settings">>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"filter">;
            keyword: z.ZodOptional<z.ZodString>;
            state: z.ZodOptional<z.ZodString>;
            stageId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            crmType: z.ZodOptional<z.ZodEnum<{
                lead: "lead";
                opportunity: "opportunity";
            }>>;
            includeArchived: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"select">;
            id: z.ZodNumber;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"detail">;
            id: z.ZodNumber;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"refresh">;
        }, z.core.$strict>], "kind">;
        connectionId: z.ZodString;
        companyId: z.ZodNumber;
        expiresAt: z.ZodNumber;
    }, z.core.$strict>;
}, z.core.$strict>], "kind">;
export type Downlink = z.infer<typeof downlinkSchema>;
/** Keep only bounded business text, never DOM, HTML execution, credentials or hidden records. */
export declare function summarize(value: unknown, depth?: number): unknown;
export declare function summaryIsTruncated(value: unknown, depth?: number): boolean;
