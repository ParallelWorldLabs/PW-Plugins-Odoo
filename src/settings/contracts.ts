import { z } from 'zod';

export const connectionIdSchema = z.string().regex(/^[a-z0-9-]{1,60}$/);
export const connectionDraftSchema = z.object({
  id: connectionIdSchema.optional(), label: z.string().trim().min(1).max(80),
  url: z.string().trim().url().max(2000), database: z.string().trim().min(1).max(128).regex(/^[^\r\n]+$/),
  apiKey: z.string().max(4096).optional(),
  lang: z.string().max(20).default(''), timezone: z.string().max(100).default(''), allowHttp: z.boolean().default(false),
}).strict();
export const saveConnectionSchema = connectionDraftSchema.extend({ expectedRevision: z.number().int().nonnegative(), makeDefault: z.boolean().default(false) });
export const deleteConnectionSchema = z.object({ id: connectionIdSchema, expectedRevision: z.number().int().nonnegative() }).strict();
export type ConnectionDraft = z.infer<typeof connectionDraftSchema>;
export type SaveConnection = z.infer<typeof saveConnectionSchema>;
export const publicConnectionSchema = z.object({
  id: z.string(), label: z.string(), url: z.string(), database: z.string().nullable(), companyIds: z.array(z.number().int().positive()).min(1),
  companies: z.array(z.object({ id: z.number(), label: z.string() })).optional(), companyNamesUnavailable: z.boolean().optional(),
  lang: z.string(), timezone: z.string(), allowHttp: z.boolean().optional(), hasApiKey: z.boolean().optional(),
  configVersion: z.string().default(''), source: z.enum(['saved', 'environment']).optional(), readOnly: z.literal(true),
});
export const settingsSchema = z.object({ revision: z.number().int().nonnegative(), defaultConnectionId: z.string().nullable(), connections: z.array(publicConnectionSchema).max(10), writable: z.boolean(), warnings: z.array(z.string()), savedConnectionId: z.string().optional() });
export type Settings = z.infer<typeof settingsSchema>;
export const probeSchema = z.object({ authenticated: z.literal(true), version: z.string().nullable(), userId: z.number().int().positive(),
  companyIds: z.array(z.number().int().positive()), companies: z.array(z.object({ id: z.number(), label: z.string() })), lang: z.string(), timezone: z.string() });
export type ProbeResult = z.infer<typeof probeSchema>;
