import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { z } from 'zod';
import { configSchema, loadConfig, type OdooConfig } from '../core/config.js';
import { OdooError } from '../core/contracts.js';
import { OdooService } from '../core/service.js';
import { readTools } from '../core/tools.js';
import { OdooClient } from '../odoo/client.js';
import { connectionDraftSchema, deleteConnectionSchema, saveConnectionSchema, type ConnectionDraft } from '../settings/contracts.js';
import { ConnectionStore, type SettingsDocument } from '../settings/store.js';
import { probeConnection } from '../settings/probe.js';

const profileSchema = z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,60}$/), label: z.string().min(1).max(80), envFile: z.string().min(1).max(1000) }).strict()).min(1).max(10);
type Legacy = { id: string; label: string; config: OdooConfig };
type Profile = { id: string; label: string; config: Omit<OdooConfig, 'apiKey'>; apiKey?: string; credentialRef?: string; configVersion: string; source: 'saved' | 'environment'; companies?: { id: number; label: string }[] };

/** Host-owned settings. Only public metadata crosses the Remote boundary. */
export class OdooBackend {
  private profiles: Profile[];
  private readonly environment: Profile[];
  private document: SettingsDocument = { schemaVersion: 1, revision: 0, defaultConnectionId: null, connections: [], hiddenEnvironmentIds: [] };
  private warnings: string[] = [];
  private listeners = new Set<() => void>();
  constructor(profiles: readonly Legacy[], private readonly store?: ConnectionStore) {
    this.environment = profiles.map(({ config, ...row }) => { const { apiKey, ...metadata } = config; return { ...row, config: metadata, apiKey, configVersion: randomUUID(), source: 'environment' }; });
    this.profiles = [...this.environment];
  }
  static async load(store?: ConnectionStore) {
    const profiles: Legacy[] = [];
    let warning = '';
    try {
      const file = process.env.PW_ODOO_CONNECTIONS_FILE;
      if (file) {
        const records = profileSchema.parse(JSON.parse(await readFile(file, 'utf8')));
        if (new Set(records.map(row => row.id)).size !== records.length) throw new Error('Duplicate IDs');
        for (const row of records) profiles.push({ id: row.id, label: row.label, config: loadConfig(parseEnv(await readFile(resolve(dirname(file), row.envFile), 'utf8'))) });
      } else if (process.env.ODOO_URL || process.env.ODOO_API_KEY || process.env.ODOO_COMPANY_IDS) profiles.push({ id: 'default', label: 'Odoo', config: loadConfig() });
    } catch { warning = '原有环境配置不完整，已跳过；请在设置中添加连接。'; profiles.length = 0; }
    const backend = new OdooBackend(profiles, store);
    if (warning) backend.warnings.push(warning);
    await backend.reload(); return backend;
  }
  private async reload() {
    if (this.store) this.document = await this.store.read();
    const saved: Profile[] = this.document.connections.map(({ credentialRef, configVersion, companies, id, label, ...config }) => ({ id, label, config: { ...config, timeoutMs: 15000 }, credentialRef, configVersion, source: 'saved', companies }));
    this.profiles = [...saved, ...this.environment.filter(row => !saved.some(item => item.id === row.id) && !this.document.hiddenEnvironmentIds.includes(row.id))];
  }
  private profile(connectionId: string) {
    const row = this.profiles.find(profile => profile.id === connectionId);
    if (!row) throw new OdooError('INVALID_CONNECTION', '连接不存在，请刷新设置。');
    return row;
  }
  assertScope(connectionId: string, companyId: number, configVersion?: string) {
    const profile = this.profile(connectionId);
    if (configVersion !== undefined && profile.configVersion !== configVersion) throw new OdooError('CONNECTION_CHANGED', '连接设置已改变，请刷新设置后重试。');
    if (!Number.isSafeInteger(companyId) || companyId < 0 || (companyId !== 0 && !profile.config.companyIds.includes(companyId))) throw new OdooError('ACCESS_DENIED', 'Company is outside this connection scope.');
  }
  private async config(profile: Profile): Promise<OdooConfig> {
    const apiKey = profile.credentialRef ? await this.store?.vault?.read(profile.credentialRef) : profile.apiKey;
    if (!apiKey) throw new OdooError('NOT_CONFIGURED', 'API Key 尚未配置，请在设置中编辑连接。');
    return configSchema.parse({ ...profile.config, apiKey });
  }
  connections() {
    return this.profiles.map(({ id, label, config, configVersion, source, companies, apiKey, credentialRef }) => ({ id, label, url: new URL(config.url).origin, database: config.database ?? null,
      companyIds: [...config.companyIds], lang: config.lang, timezone: config.timezone, allowHttp: config.allowHttp, readOnly: true as const,
      configVersion, source, hasApiKey: Boolean(apiKey || credentialRef), ...(companies ? { companies } : {}) }));
  }
  async choices(signal: AbortSignal) {
    await this.reload();
    return Promise.all(this.connections().map(async (choice) => {
      if (choice.companies) return choice;
      try {
        const records = z.array(z.object({ id: z.number().int().positive(), name: z.string() })).max(50).parse(
          await new OdooClient(await this.config(this.profile(choice.id))).readCall('res.company', 'read', { ids: choice.companyIds, fields: ['name'] }, signal));
        return { ...choice, companies: choice.companyIds.map(id => ({ id, label: records.find(row => row.id === id)?.name.slice(0, 200) ?? `公司 ${id}` })), companyNamesUnavailable: false };
      } catch { signal.throwIfAborted(); return { ...choice, companies: choice.companyIds.map(id => ({ id, label: `公司 ${id}` })), companyNamesUnavailable: true }; }
    }));
  }
  async service(connectionId: string, companyId: number, configVersion?: string) {
    await this.reload(); this.assertScope(connectionId, companyId, configVersion);
    const config = await this.config(this.profile(connectionId));
    return new OdooService(new OdooClient({ ...config, companyIds: companyId === 0 ? config.companyIds : [companyId] }));
  }
  async defaultService() {
    await this.reload();
    const first = this.profiles.find(row => row.id === this.document.defaultConnectionId) ?? this.profiles[0];
    if (!first) throw new OdooError('NOT_CONFIGURED', '请先打开 Odoo → 设置，添加并保存连接。');
    return new OdooService(new OdooClient(await this.config(first)));
  }
  async execute(connectionId: string, companyId: number, operation: string, payload: string, signal: AbortSignal, configVersion?: string) {
    if (payload.length > 32768) throw new OdooError('INVALID_INPUT', 'Request is too large.');
    const service = await this.service(connectionId, companyId, configVersion);
    const tool = readTools(service).find(([name]) => name === operation);
    if (!tool) throw new OdooError('READ_ONLY', 'Only approved read tools are available.');
    const args = tool[2].parse(JSON.parse(payload));
    return JSON.stringify(await tool[3](args as never, signal));
  }
  async settings() {
    await this.reload();
    return { revision: this.document.revision, defaultConnectionId: this.document.defaultConnectionId ?? this.profiles[0]?.id ?? null,
      connections: this.connections(), writable: Boolean(this.store?.vault) && this.store?.vault?.available?.() !== false, warnings: this.warnings };
  }
  private async candidate(draft: ConnectionDraft, signal: AbortSignal) {
    await this.reload();
    const old = draft.id ? this.profile(draft.id) : undefined;
    let key = draft.apiKey?.trim();
    if (!key && old && new URL(draft.url).origin === new URL(old.config.url).origin && draft.database === old.config.database) key = (await this.config(old)).apiKey;
    if (!key) throw new OdooError('KEY_REQUIRED', '请填写 API Key；更换服务器或数据库时必须重新填写。');
    return probeConnection(draft, key, signal);
  }
  async testConnection(input: unknown, signal: AbortSignal) { return (await this.candidate(connectionDraftSchema.parse(input), signal)).result; }
  async saveConnection(input: unknown, signal: AbortSignal) {
    if (!this.store?.vault) throw new OdooError('SETTINGS_UNAVAILABLE', '当前 Host 未提供可写凭据库。');
    const data = saveConnectionSchema.parse(input);
    const draft = connectionDraftSchema.parse(Object.fromEntries(Object.entries(data).filter(([key]) => !['expectedRevision', 'makeDefault'].includes(key))));
    const { config, result } = await this.candidate(draft, signal);
    const id = draft.id ?? `odoo-${randomUUID().slice(0, 8)}`;
    const credentialRef = `pw-plugins-odoo/connection-${id}-${randomUUID()}`;
    let oldReference: string | undefined;
    let committed = false;
    try {
      await this.store.update(data.expectedRevision, async current => {
        if (!draft.id && this.profiles.length >= 10) throw new OdooError('CONNECTION_LIMIT', '最多保存 10 个连接。');
        oldReference = current.connections.find(row => row.id === id)?.credentialRef;
        await this.store!.vault!.write(credentialRef, config.apiKey);
        return { ...current, connections: [...current.connections.filter(row => row.id !== id), { id, label: draft.label, url: new URL(config.url).origin, database: config.database!, companyIds: config.companyIds,
          companies: result.companies, lang: config.lang, timezone: config.timezone, allowHttp: config.allowHttp, credentialRef, configVersion: randomUUID() }],
          hiddenEnvironmentIds: current.hiddenEnvironmentIds.filter(value => value !== id), defaultConnectionId: data.makeDefault || !current.defaultConnectionId ? id : current.defaultConnectionId };
      }, signal);
      committed = true;
    } finally { if (!committed) await this.store.vault.remove(credentialRef).catch(() => {}); }
    if (oldReference) await this.store.vault.remove(oldReference).catch(() => {});
    await this.reload(); this.notify();
    return { ...await this.settings(), savedConnectionId: id };
  }
  async deleteConnection(input: unknown, signal: AbortSignal) {
    if (!this.store?.vault) throw new OdooError('SETTINGS_UNAVAILABLE', '当前 Host 未提供可写凭据库。');
    const data = deleteConnectionSchema.parse(input); await this.reload(); this.profile(data.id);
    let reference: string | undefined;
    await this.store.update(data.expectedRevision, async current => {
      reference = current.connections.find(row => row.id === data.id)?.credentialRef;
      return { ...current, connections: current.connections.filter(row => row.id !== data.id), hiddenEnvironmentIds: [...new Set([...current.hiddenEnvironmentIds, data.id])], defaultConnectionId: current.defaultConnectionId === data.id ? null : current.defaultConnectionId };
    }, signal);
    if (reference) await this.store.vault.remove(reference).catch(() => {});
    await this.reload(); this.notify(); return this.settings();
  }
  onChange(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify() { for (const listener of this.listeners) { try { listener(); } catch { /* A committed save remains successful. */ } } }
}
