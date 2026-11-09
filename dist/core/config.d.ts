import { z } from 'zod';
export declare const configSchema: z.ZodObject<{
    url: z.ZodString;
    apiKey: z.ZodString;
    database: z.ZodOptional<z.ZodString>;
    companyIds: z.ZodArray<z.ZodNumber>;
    lang: z.ZodDefault<z.ZodString>;
    timezone: z.ZodDefault<z.ZodString>;
    allowHttp: z.ZodDefault<z.ZodBoolean>;
    timeoutMs: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
export type OdooConfig = z.infer<typeof configSchema>;
export declare function loadConfig(env?: NodeJS.ProcessEnv): OdooConfig;
