import { z } from 'zod';
export interface SecretVault {
    available?(): boolean;
    read(reference: string): Promise<string | undefined>;
    write(reference: string, value: string): Promise<void>;
    remove(reference: string): Promise<void>;
}
export declare const savedConnectionSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    url: z.ZodString;
    database: z.ZodString;
    companyIds: z.ZodArray<z.ZodNumber>;
    companies: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        label: z.ZodString;
    }, z.core.$strip>>;
    lang: z.ZodString;
    timezone: z.ZodString;
    allowHttp: z.ZodBoolean;
    credentialRef: z.ZodString;
    configVersion: z.ZodString;
}, z.core.$strict>;
export type SavedConnection = z.infer<typeof savedConnectionSchema>;
declare const documentSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    revision: z.ZodNumber;
    defaultConnectionId: z.ZodNullable<z.ZodString>;
    connections: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        url: z.ZodString;
        database: z.ZodString;
        companyIds: z.ZodArray<z.ZodNumber>;
        companies: z.ZodArray<z.ZodObject<{
            id: z.ZodNumber;
            label: z.ZodString;
        }, z.core.$strip>>;
        lang: z.ZodString;
        timezone: z.ZodString;
        allowHttp: z.ZodBoolean;
        credentialRef: z.ZodString;
        configVersion: z.ZodString;
    }, z.core.$strict>>;
    hiddenEnvironmentIds: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export type SettingsDocument = z.infer<typeof documentSchema>;
export declare class ConnectionStore {
    readonly file: string;
    readonly vault?: SecretVault | undefined;
    constructor(file: string, vault?: SecretVault | undefined);
    read(): Promise<SettingsDocument>;
    update(expectedRevision: number, mutate: (current: SettingsDocument) => Promise<SettingsDocument>, signal: AbortSignal): Promise<{
        schemaVersion: 1;
        revision: number;
        defaultConnectionId: string | null;
        connections: {
            id: string;
            label: string;
            url: string;
            database: string;
            companyIds: number[];
            companies: {
                id: number;
                label: string;
            }[];
            lang: string;
            timezone: string;
            allowHttp: boolean;
            credentialRef: string;
            configVersion: string;
        }[];
        hiddenEnvironmentIds: string[];
    }>;
}
export {};
