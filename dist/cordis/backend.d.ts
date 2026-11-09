import { type OdooConfig } from '../core/config.js';
import { OdooService } from '../core/service.js';
import { ConnectionStore } from '../settings/store.js';
type Legacy = {
    id: string;
    label: string;
    config: OdooConfig;
};
/** Host-owned settings. Only public metadata crosses the Remote boundary. */
export declare class OdooBackend {
    private readonly store?;
    private profiles;
    private readonly environment;
    private document;
    private warnings;
    private listeners;
    constructor(profiles: readonly Legacy[], store?: ConnectionStore | undefined);
    static load(store?: ConnectionStore): Promise<OdooBackend>;
    private reload;
    private profile;
    assertScope(connectionId: string, companyId: number, configVersion?: string): void;
    private config;
    connections(): {
        companies?: {
            id: number;
            label: string;
        }[] | undefined;
        id: string;
        label: string;
        url: string;
        database: string | null;
        companyIds: number[];
        lang: string;
        timezone: string;
        allowHttp: boolean;
        readOnly: true;
        configVersion: string;
        source: "saved" | "environment";
        hasApiKey: boolean;
    }[];
    choices(signal: AbortSignal): Promise<({
        companies?: {
            id: number;
            label: string;
        }[] | undefined;
        id: string;
        label: string;
        url: string;
        database: string | null;
        companyIds: number[];
        lang: string;
        timezone: string;
        allowHttp: boolean;
        readOnly: true;
        configVersion: string;
        source: "saved" | "environment";
        hasApiKey: boolean;
    } | {
        companies: {
            id: number;
            label: string;
        }[];
        companyNamesUnavailable: boolean;
        id: string;
        label: string;
        url: string;
        database: string | null;
        companyIds: number[];
        lang: string;
        timezone: string;
        allowHttp: boolean;
        readOnly: true;
        configVersion: string;
        source: "saved" | "environment";
        hasApiKey: boolean;
    })[]>;
    service(connectionId: string, companyId: number, configVersion?: string): Promise<OdooService>;
    defaultService(): Promise<OdooService>;
    execute(connectionId: string, companyId: number, operation: string, payload: string, signal: AbortSignal, configVersion?: string): Promise<string>;
    settings(): Promise<{
        revision: number;
        defaultConnectionId: string | null;
        connections: {
            companies?: {
                id: number;
                label: string;
            }[] | undefined;
            id: string;
            label: string;
            url: string;
            database: string | null;
            companyIds: number[];
            lang: string;
            timezone: string;
            allowHttp: boolean;
            readOnly: true;
            configVersion: string;
            source: "saved" | "environment";
            hasApiKey: boolean;
        }[];
        writable: boolean;
        warnings: string[];
    }>;
    private candidate;
    testConnection(input: unknown, signal: AbortSignal): Promise<{
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
    saveConnection(input: unknown, signal: AbortSignal): Promise<{
        savedConnectionId: string;
        revision: number;
        defaultConnectionId: string | null;
        connections: {
            companies?: {
                id: number;
                label: string;
            }[] | undefined;
            id: string;
            label: string;
            url: string;
            database: string | null;
            companyIds: number[];
            lang: string;
            timezone: string;
            allowHttp: boolean;
            readOnly: true;
            configVersion: string;
            source: "saved" | "environment";
            hasApiKey: boolean;
        }[];
        writable: boolean;
        warnings: string[];
    }>;
    deleteConnection(input: unknown, signal: AbortSignal): Promise<{
        revision: number;
        defaultConnectionId: string | null;
        connections: {
            companies?: {
                id: number;
                label: string;
            }[] | undefined;
            id: string;
            label: string;
            url: string;
            database: string | null;
            companyIds: number[];
            lang: string;
            timezone: string;
            allowHttp: boolean;
            readOnly: true;
            configVersion: string;
            source: "saved" | "environment";
            hasApiKey: boolean;
        }[];
        writable: boolean;
        warnings: string[];
    }>;
    onChange(listener: () => void): () => void;
    private notify;
}
export {};
