import { z } from 'zod';
export declare const connectionIdSchema: z.ZodString;
export declare const connectionDraftSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    label: z.ZodString;
    url: z.ZodString;
    database: z.ZodString;
    apiKey: z.ZodOptional<z.ZodString>;
    lang: z.ZodDefault<z.ZodString>;
    timezone: z.ZodDefault<z.ZodString>;
    allowHttp: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
export declare const saveConnectionSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    label: z.ZodString;
    url: z.ZodString;
    database: z.ZodString;
    apiKey: z.ZodOptional<z.ZodString>;
    lang: z.ZodDefault<z.ZodString>;
    timezone: z.ZodDefault<z.ZodString>;
    allowHttp: z.ZodDefault<z.ZodBoolean>;
    expectedRevision: z.ZodNumber;
    makeDefault: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
export declare const deleteConnectionSchema: z.ZodObject<{
    id: z.ZodString;
    expectedRevision: z.ZodNumber;
}, z.core.$strict>;
export type ConnectionDraft = z.infer<typeof connectionDraftSchema>;
export type SaveConnection = z.infer<typeof saveConnectionSchema>;
export declare const publicConnectionSchema: z.ZodObject<{
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
export declare const settingsSchema: z.ZodObject<{
    revision: z.ZodNumber;
    defaultConnectionId: z.ZodNullable<z.ZodString>;
    connections: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
    writable: z.ZodBoolean;
    warnings: z.ZodArray<z.ZodString>;
    savedConnectionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Settings = z.infer<typeof settingsSchema>;
export declare const probeSchema: z.ZodObject<{
    authenticated: z.ZodLiteral<true>;
    version: z.ZodNullable<z.ZodString>;
    userId: z.ZodNumber;
    companyIds: z.ZodArray<z.ZodNumber>;
    companies: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        label: z.ZodString;
    }, z.core.$strip>>;
    lang: z.ZodString;
    timezone: z.ZodString;
}, z.core.$strip>;
export type ProbeResult = z.infer<typeof probeSchema>;
