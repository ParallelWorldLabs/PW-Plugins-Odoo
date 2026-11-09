import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
import { connectionIdSchema } from './contracts.js';
import { OdooError } from '../core/contracts.js';

export interface SecretVault { available?(): boolean; read(reference: string): Promise<string | undefined>; write(reference: string, value: string): Promise<void>; remove(reference: string): Promise<void> }
export const savedConnectionSchema = z.object({
  id: connectionIdSchema, label: z.string(), url: z.string(), database: z.string(), companyIds: z.array(z.number().int().positive()).min(1).max(50),
  companies: z.array(z.object({ id: z.number(), label: z.string() })), lang: z.string(), timezone: z.string(), allowHttp: z.boolean(),
  credentialRef: z.string().regex(/^pw-plugins-odoo\/[a-z0-9-]+$/), configVersion: z.string().min(1),
}).strict();
export type SavedConnection = z.infer<typeof savedConnectionSchema>;
const documentSchema = z.object({ schemaVersion: z.literal(1), revision: z.number().int().nonnegative(), defaultConnectionId: z.string().nullable(),
  connections: z.array(savedConnectionSchema).max(10), hiddenEnvironmentIds: z.array(connectionIdSchema).max(100),
}).strict();
export type SettingsDocument = z.infer<typeof documentSchema>;
const empty = (): SettingsDocument => ({ schemaVersion: 1, revision: 0, defaultConnectionId: null, connections: [], hiddenEnvironmentIds: [] });

export class ConnectionStore {
  constructor(readonly file: string, readonly vault?: SecretVault) {}
  async read(): Promise<SettingsDocument> {
    try { return documentSchema.parse(JSON.parse(await readFile(this.file, 'utf8'))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return empty(); throw new OdooError('SETTINGS_STORAGE_ERROR', '已保存的设置无法读取，请检查 Host 本机存储。'); }
  }
  async update(expectedRevision: number, mutate: (current: SettingsDocument) => Promise<SettingsDocument>, signal: AbortSignal) {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    return withFileLock(this.file, async () => {
      const current = await this.read();
      if (current.revision !== expectedRevision) throw new OdooError('SETTINGS_CONFLICT', '设置已被其他窗口修改，请刷新设置后重试。');
      const next = documentSchema.parse(await mutate(current));
      next.revision = current.revision + 1;
      await writeFileAtomic(this.file, JSON.stringify(next, null, 2) + '\n', { mode: 0o600, dirMode: 0o700 });
      return next;
    }, { signal });
  }
}
