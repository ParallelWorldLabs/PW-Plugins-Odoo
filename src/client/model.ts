import { z } from 'zod';
import { publicConnectionSchema, settingsSchema, probeSchema, type Settings, type ConnectionDraft } from '../settings/contracts.js';
import type { FieldInfo, RecordData } from '../core/contracts.js';
import { downlinkSchema, summarize, summaryIsTruncated, type Downlink, type Page, type PanelAction, type PanelCommand, type PanelSnapshot } from '../panel/contracts.js';

export const connectionSchema = publicConnectionSchema;
export type Connection = z.infer<typeof connectionSchema>;
export interface PanelStream extends AsyncIterable<string> { send(value: string): Promise<void>; dispose(): void }
export interface OdooTransport {
  connections(signal: AbortSignal): Promise<string>;
  read(connectionId: string, companyId: number, operation: string, input: unknown, signal: AbortSignal, configVersion?: string): Promise<string>;
  settings?(signal: AbortSignal): Promise<string>;
  testConnection?(input: ConnectionDraft, signal: AbortSignal): Promise<string>;
  saveConnection?(input: unknown, signal: AbortSignal): Promise<string>;
  deleteConnection?(input: unknown, signal: AbortSignal): Promise<string>;
  panel(clientId: string, tabId: string, occurrence: string, signal: AbortSignal): PanelStream;
}
type Filter = { keyword: string; state: string; stageId: number | null; crmType: 'lead' | 'opportunity'; includeArchived: boolean };
type InventoryKind = 'quant' | 'incoming' | 'outgoing' | 'products';
type View = { filter: Filter; draftKeyword: string; offset: number; rows: RecordData[]; fields: string[]; metadata: Record<string, FieldInfo>; selectedId: number | null; detail: RecordData | null; trace: Record<string, unknown> | null; activities: RecordData[]; fetchedAt: string | null; nextOffset: number | null; loading: boolean; error: string | null };
export interface PanelState {
  version: number; connections: Connection[]; connectionId: string; companyId: number; page: Page;
  inventoryKind: InventoryKind; view: View; stages: RecordData[]; history: { time: string; label: string; ok: boolean }[];
  settings: Settings | null; settingsDirty: boolean;
  diagnostic: Record<string, unknown> | null; visible: boolean; online: boolean; startupError: string | null;
}
const freshView = (): View => ({ filter: { keyword: '', state: '', stageId: null, crmType: 'opportunity', includeArchived: false }, draftKeyword: '', offset: 0, rows: [], fields: [], metadata: {}, selectedId: null, detail: null, trace: null, activities: [], fetchedAt: null, nextOffset: null, loading: false, error: null });
const fieldsByModel: Record<string, string[]> = {
  'crm.lead': ['name', 'type', 'partner_id', 'stage_id', 'user_id', 'team_id', 'expected_revenue', 'company_currency', 'probability', 'date_deadline', 'activity_summary', 'activity_date_deadline', 'won_status', 'active'],
  'sale.order': ['name', 'partner_id', 'state', 'date_order', 'amount_total', 'currency_id', 'opportunity_id', 'delivery_status'],
  'purchase.order': ['name', 'partner_id', 'state', 'date_order', 'amount_total', 'currency_id', 'receipt_status', 'origin'],
  'stock.quant': ['product_id', 'location_id', 'quantity', 'reserved_quantity', 'available_quantity', 'uom_id', 'product_uom_id', 'company_id'],
  'stock.picking': ['name', 'partner_id', 'state', 'scheduled_date', 'picking_type_id', 'sale_id', 'purchase_id'],
  'product.product': ['name', 'default_code', 'type', 'route_ids', 'route_from_categ_ids', 'seller_ids', 'service_to_purchase', 'service_tracking', 'qty_available', 'virtual_available', 'uom_id'],
};
const listSchema = z.object({ records: z.array(z.object({ id: z.number().int().positive() }).passthrough()).max(100), fields: z.array(z.string()), fetchedAt: z.string(), nextOffset: z.number().nullable() });
const singleSchema = z.object({ record: z.object({ id: z.number().int().positive() }).passthrough().nullable(), fetchedAt: z.string() });

/** One occurrence's model. Navigation, mouse actions and Agent commands share these operations. */
export class OdooPanelModel {
  private state: PanelState = { version: 0, connections: [], connectionId: '', companyId: 0, page: 'crm', inventoryKind: 'quant', view: freshView(), stages: [], history: [], diagnostic: null, settings: null, settingsDirty: false, visible: true, online: false, startupError: null };
  private lifetime: AbortSignal | undefined;
  private listeners = new Set<() => void>();
  private views = new Map<string, View>();
  private epoch = 0;
  private request: AbortController | undefined;
  private stream: PanelStream | undefined;
  private streamAbort: AbortController | undefined;
  private lastRendered: PanelSnapshot | null = null;
  private pendingReceipts: { requestId: string; ok: boolean; message: string; version: number }[] = [];
  constructor(private readonly transport: OdooTransport, readonly clientId: string, readonly tabId: string, readonly occurrence: string,
    private readonly preferences?: { initialScope?: { connectionId: string; companyId: number }; saveScope?: (connectionId: string, companyId: number) => void }) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private change(patch: Partial<PanelState>) { this.state = { ...this.state, ...patch, version: this.state.version + 1 }; for (const listener of this.listeners) listener(); }
  private view(patch: Partial<View>) { this.change({ view: { ...this.state.view, ...patch } }); }
  private key() { return `${this.state.page}:${this.state.inventoryKind}`; }
  private log(label: string, ok = true) { this.change({ history: [{ time: new Date().toISOString(), label, ok }, ...this.state.history].slice(0, 50) }); }
  private cancel() { this.epoch++; this.request?.abort(); this.request = undefined; }
  private begin() { this.cancel(); const request = new AbortController(); this.request = request; return { epoch: this.epoch, signal: request.signal }; }
  private valid(epoch: number) { if (epoch !== this.epoch) throw new Error('页面已改变，请重新操作。'); }
  private async call(operation: string, input: unknown, signal: AbortSignal) { signal.throwIfAborted(); return JSON.parse(await this.transport.read(this.state.connectionId, this.state.companyId, operation, input, signal, this.connection()?.configVersion)) as unknown; }
  currentModel(): string | null {
    return this.state.page === 'crm' ? 'crm.lead' : this.state.page === 'sales' ? 'sale.order' : this.state.page === 'purchase' ? 'purchase.order' : this.state.page === 'inventory' ? (this.state.inventoryKind === 'quant' ? 'stock.quant' : this.state.inventoryKind === 'products' ? 'product.product' : 'stock.picking') : null;
  }
  connection() { return this.state.connections.find(row => row.id === this.state.connectionId); }

  async start(signal: AbortSignal) {
    this.lifetime = signal;
    try {
      const connections = z.array(connectionSchema).max(10).parse(JSON.parse(await this.transport.connections(signal)));
      const settings = this.transport.settings ? settingsSchema.parse(JSON.parse(await this.transport.settings(signal))) : null;
      if (signal.aborted) return;
      const preferred = this.preferences?.initialScope;
      const remembered = connections.find(row => row.id === preferred?.connectionId && (preferred.companyId === 0 || row.companyIds.includes(preferred.companyId)));
      const first = remembered ?? connections.find(row => row.id === settings?.defaultConnectionId) ?? connections[0];
      const companyId = remembered ? preferred!.companyId : 0;
      this.change({ connections, settings, connectionId: first?.id ?? '', companyId, startupError: null, ...(!first ? { page: 'settings' as const } : {}) });
      // A newer navigation may cancel this first business read after settings loaded successfully.
      // load() already reports current request failures; a cancelled old read must not reset setup/page state.
      if (first) { this.attach(signal); await this.load().catch(() => {}); }
    } catch (error) { if (!signal.aborted) this.change({ startupError: messageOf(error), page: 'settings' }); }
  }

  settingsEdited(dirty: boolean) { this.change({ settingsDirty: dirty }); }
  private settingsSignal() { if (!this.lifetime || this.lifetime.aborted) throw new Error('页面已关闭，请重新打开设置。'); return this.lifetime; }
  async refreshSettings() {
    if (this.state.settingsDirty) throw new Error('请先保存或取消正在编辑的设置。');
    if (!this.transport.settings) return;
    const signal = this.settingsSignal();
    const settings = settingsSchema.parse(JSON.parse(await this.transport.settings(signal)));
    const connections = z.array(connectionSchema).max(10).parse(JSON.parse(await this.transport.connections(signal)));
    this.adoptSettings({ ...settings, connections });
  }
  private adoptSettings(settings: Settings) {
    this.cancel(); this.views.clear(); this.lastRendered = null; this.pendingReceipts = [];
    this.streamAbort?.abort(); this.stream?.dispose();
    const connection = settings.connections.find(row => row.id === (settings.savedConnectionId ?? this.state.connectionId)) ?? settings.connections.find(row => row.id === settings.defaultConnectionId) ?? settings.connections[0];
    const companyId = this.state.companyId === 0 || connection?.companyIds.includes(this.state.companyId) ? this.state.companyId : 0;
    this.change({ settings, connections: settings.connections, connectionId: connection?.id ?? '', companyId, settingsDirty: false, startupError: null, view: freshView(), history: [], stages: [], diagnostic: null, online: false });
    if (connection && this.lifetime && !this.lifetime.aborted) { this.preferences?.saveScope?.(connection.id, companyId); this.attach(this.lifetime); }
  }
  async testConnection(input: ConnectionDraft) {
    if (!this.transport.testConnection) throw new Error('当前 Host 不支持设置，请升级插件。');
    return probeSchema.parse(JSON.parse(await this.transport.testConnection(input, this.settingsSignal())));
  }
  async saveConnection(input: ConnectionDraft, makeDefault: boolean, expectedRevision: number) {
    if (!this.transport.saveConnection) throw new Error('当前 Host 不支持设置，请升级插件。');
    const signal = this.settingsSignal();
    const settings = settingsSchema.parse(JSON.parse(await this.transport.saveConnection({ ...input, makeDefault, expectedRevision }, signal)));
    signal.throwIfAborted(); this.adoptSettings(settings);
  }
  async deleteConnection(id: string, expectedRevision: number) {
    if (!this.transport.deleteConnection) throw new Error('当前 Host 不支持设置，请升级插件。');
    const signal = this.settingsSignal();
    const settings = settingsSchema.parse(JSON.parse(await this.transport.deleteConnection({ id, expectedRevision }, signal)));
    signal.throwIfAborted(); this.adoptSettings(settings);
  }

  private attach(lifetime: AbortSignal) {
    this.streamAbort?.abort(); this.stream?.dispose();
    this.change({ online: false });
    const controller = new AbortController(); this.streamAbort = controller;
    const signal = AbortSignal.any([controller.signal, lifetime]);
    const stream = this.transport.panel(this.clientId, this.tabId, this.occurrence, signal); this.stream = stream;
    const receive = async () => {
      try {
        for await (const text of stream) {
          const frame = downlinkSchema.parse(JSON.parse(text));
          if (frame.kind === 'ready') { this.change({ online: true }); continue; }
          if (frame.kind === 'context') this.pendingReceipts.push({ requestId: frame.requestId, ok: true, message: '当前页面快照', version: this.state.version });
          else await this.receiveAction(frame.command);
          this.flushReceipts();
        }
      } catch { /* Transport reset is reflected in the UI; no implicit business write or retry. */ }
      finally { if (this.stream === stream) { this.stream = undefined; this.change({ online: false }); } }
    };
    void receive();
    signal.addEventListener('abort', () => { stream.dispose(); this.cancel(); }, { once: true });
  }
  async reconnect(signal: AbortSignal) { this.lifetime = signal; await this.refreshSettings(); }
  stop() { this.cancel(); this.streamAbort?.abort(); this.stream?.dispose(); this.stream = undefined; this.pendingReceipts = []; }
  setVisible(visible: boolean) { if (visible !== this.state.visible) this.change({ visible }); }

  async switchScope(connectionId: string, companyId: number) {
    if (this.state.settingsDirty) throw new Error('请先保存或取消正在编辑的设置。');
    const connection = this.state.connections.find(row => row.id === connectionId);
    if (!connection || (!Number.isSafeInteger(companyId) || companyId < 0 || (companyId !== 0 && !connection.companyIds.includes(companyId)))) throw new Error('连接或公司不在配置范围内。');
    this.cancel(); this.views.clear(); this.lastRendered = null;
    this.change({ connectionId, companyId, view: freshView(), stages: [], diagnostic: null, history: [] });
    this.preferences?.saveScope?.(connectionId, companyId);
    await this.load();
  }
  async navigate(page: Page) {
    if (this.state.settingsDirty && page !== 'settings') throw new Error('请先保存或取消正在编辑的设置。');
    if (!this.state.connectionId) page = 'settings';
    this.cancel(); this.views.set(this.key(), { ...this.state.view, loading: false });
    this.change({ page, view: this.views.get(`${page}:${this.state.inventoryKind}`) ?? freshView() });
    this.log(`打开${page === 'sales' ? '销售' : page === 'purchase' ? '采购' : page === 'crm' ? 'CRM' : page === 'inventory' ? '库存' : page === 'history' ? '记录' : '设置'}`);
    if (this.currentModel() && !this.state.view.fetchedAt) await this.load();
  }
  async inventory(kind: InventoryKind) { this.cancel(); this.views.set(this.key(), { ...this.state.view, loading: false }); this.change({ inventoryKind: kind, view: this.views.get(`${this.state.page}:${kind}`) ?? freshView() }); if (!this.state.view.fetchedAt) await this.load(); }
  draftKeyword(value: string) { this.view({ draftKeyword: value.slice(0, 200) }); }
  reportError(message: string) { this.view({ error: message.slice(0, 600) }); }
  async filter(patch: Partial<Filter>) { this.view({ filter: { ...this.state.view.filter, ...patch }, draftKeyword: patch.keyword ?? this.state.view.draftKeyword, offset: 0, selectedId: null, detail: null, trace: null }); await this.load(); }
  async paginate(offset: number) { this.view({ offset, selectedId: null, detail: null, trace: null }); await this.load(); }
  select(id: number) { if (!this.state.view.rows.some(row => row.id === id)) throw new Error('记录已不在当前页，请刷新后重试。'); this.cancel(); this.view({ selectedId: id, detail: null, trace: null, loading: false }); }
  back() { this.cancel(); this.view({ detail: null, trace: null, activities: [], loading: false }); }

  async load() {
    const model = this.currentModel(); if (!model || !this.state.connectionId) return;
    const { epoch, signal } = this.begin();
    this.view({ loading: true, error: null, rows: [], detail: null, trace: null, activities: [], selectedId: null });
    try {
      const metadata = await this.call('pw_odoo_fields', { model }, signal) as Record<string, FieldInfo>;
      this.valid(epoch);
      const fields = ['id', ...(fieldsByModel[model] ?? []).filter(name => Object.hasOwn(metadata, name))];
      const filters: { field: string; operator: string; value: unknown }[] = [];
      const filter = this.state.view.filter;
      if (model === 'crm.lead') { filters.push({ field: 'type', operator: '=', value: filter.crmType }); if (filter.stageId) filters.push({ field: 'stage_id', operator: '=', value: filter.stageId }); }
      if (filter.keyword) filters.push({ field: model === 'stock.quant' ? 'product_id' : 'name', operator: 'ilike', value: filter.keyword });
      const stateField = model === 'crm.lead' ? 'won_status' : 'state';
      if (filter.state && Object.hasOwn(metadata, stateField)) filters.push({ field: stateField, operator: '=', value: filter.state });
      if (model === 'stock.picking') {
        const types = listSchema.parse(await this.call('pw_odoo_query', { model: 'stock.picking.type', fields: ['id'], filters: [{ field: 'code', operator: '=', value: this.state.inventoryKind }], limit: 100 }, signal));
        this.valid(epoch);
        if (types.nextOffset !== null) throw new Error('作业类型超过当前上限，请收窄公司范围。');
        filters.push({ field: 'picking_type_id', operator: 'in', value: types.records.map(row => row.id) });
      }
      const page = listSchema.parse(await this.call('pw_odoo_query', { model, fields, filters, includeArchived: filter.includeArchived, limit: 25, offset: this.state.view.offset }, signal));
      this.valid(epoch);
      if (model === 'crm.lead') {
        const stages = listSchema.parse(await this.call('pw_odoo_query', { model: 'crm.stage', fields: ['name', 'sequence', 'is_won'], limit: 100, sort: { field: 'sequence', direction: 'asc' } }, signal));
        this.valid(epoch); this.change({ stages: stages.records });
      }
      this.view({ ...page, rows: page.records, metadata, loading: false, error: null });
      this.log('列表查询完成');
    } catch (error) { if (epoch === this.epoch) { this.view({ loading: false, error: messageOf(error) }); this.log('列表查询失败', false); } else throw new Error('页面已改变，请重新操作。'); }
  }

  async detail(id: number) {
    const model = this.currentModel(); if (!model) throw new Error('当前页面没有业务记录。');
    const { epoch, signal } = this.begin(); this.view({ loading: true, error: null, selectedId: id, detail: null, trace: null, activities: [] });
    try {
      const metadata = Object.keys(this.state.view.metadata).length ? this.state.view.metadata : await this.call('pw_odoo_fields', { model }, signal) as Record<string, FieldInfo>;
      this.valid(epoch);
      const preferred = ['id', ...(fieldsByModel[model] ?? []), 'description', 'lost_reason_id', 'tag_ids', 'company_id', 'date_closed', 'probability'];
      const fields = [...new Set(preferred)].filter(name => Object.hasOwn(metadata, name)).slice(0, 25);
      const result = singleSchema.parse(await this.call('pw_odoo_get', { model, id, fields }, signal));
      this.valid(epoch);
      if (!result.record) throw new Error('记录不存在或已不可见。');
      let activities: RecordData[] = [];
      if (model === 'crm.lead') {
        const result = await this.call('pw_odoo_crm_activities', { leadId: id, limit: 10 }, signal) as { records: RecordData[] };
        activities = result.records;
      }
      this.valid(epoch); this.view({ detail: result.record, fetchedAt: result.fetchedAt, metadata, activities, loading: false }); this.log('详情已回读');
    } catch (error) { if (epoch === this.epoch) { this.view({ loading: false, error: messageOf(error) }); this.log('详情读取失败', false); } else throw new Error('页面已改变，请重新操作。'); }
  }
  async trace() {
    const id = this.state.view.selectedId; if (this.state.page !== 'sales' || !id) throw new Error('请先选择一张销售单。');
    const { epoch, signal } = this.begin(); this.view({ loading: true, error: null });
    try {
      const metadata = await this.call('pw_odoo_fields', { model: 'purchase.order' }, signal) as Record<string, FieldInfo>;
      this.valid(epoch);
      const trace = await this.call('pw_odoo_procurement_trace', { saleOrderId: id }, signal) as Record<string, unknown>;
      this.valid(epoch); this.view({ trace: { ...trace, purchaseOrderStateLabels: metadata.state?.selection ?? [] }, loading: false }); this.log('采购来源追溯完成');
    }
    catch (error) { if (epoch === this.epoch) this.view({ loading: false, error: messageOf(error) }); else throw new Error('页面已改变，请重新操作。'); }
  }
  async diagnostic() {
    const { epoch, signal } = this.begin(); this.view({ loading: true, error: null });
    try { const status = await this.call('pw_odoo_status', {}, signal); const stock = await this.call('pw_odoo_stock_status', {}, signal); this.valid(epoch); this.change({ diagnostic: { status, stock } }); this.view({ loading: false }); this.log('连接与库存诊断完成'); }
    catch (error) { if (epoch === this.epoch) this.view({ loading: false, error: messageOf(error) }); else throw new Error('页面已改变，请重新操作。'); }
  }

  snapshot(): PanelSnapshot {
    const state = this.state;
    const value = state.page === 'history' ? { history: state.history } : state.page === 'settings' ? { connection: this.connection(), companyId: state.companyId, diagnostic: state.diagnostic, editing: state.settingsDirty } : { rows: state.view.rows, detail: state.view.detail, activities: state.view.activities, trace: state.view.trace };
    let displayed = JSON.stringify(summarize(value));
    const truncated = summaryIsTruncated(value) || state.view.nextOffset !== null || displayed.length > 24000;
    if (displayed.length > 24000) displayed = JSON.stringify({ ids: state.view.rows.slice(0, 10).map(row => row.id), selectedId: state.view.selectedId, contentOmitted: true });
    return { clientId: this.clientId, tabId: this.tabId, occurrence: this.occurrence, version: state.version,
      connectionId: state.connectionId, companyId: state.companyId, configVersion: this.connection()?.configVersion ?? '', companyIds: state.companyId === 0 ? this.connection()?.companyIds : [state.companyId], page: state.page, visible: state.visible,
      model: this.currentModel(), filter: JSON.stringify({ applied: state.view.filter, draftKeyword: state.view.draftKeyword, offset: state.view.offset, inventoryKind: state.inventoryKind }),
      selectedId: state.view.selectedId, displayed, loading: state.view.loading, error: state.view.error,
      fetchedAt: state.view.fetchedAt, capturedAt: new Date().toISOString(), truncated };
  }
  rendered(version: number) {
    if (version !== this.state.version || !this.state.connectionId) return;
    this.lastRendered = this.snapshot();
    this.send({ kind: 'snapshot', snapshot: this.lastRendered }); this.flushReceipts();
  }
  private send(value: unknown) {
    const stream = this.stream;
    if (stream) void stream.send(JSON.stringify(value)).catch(() => {
      if (this.stream !== stream) return;
      this.stream = undefined; this.pendingReceipts = []; stream.dispose();
      if (this.state.online) this.change({ online: false });
    });
  }
  private flushReceipts() {
    if (!this.lastRendered || this.lastRendered.version !== this.state.version) return;
    const receipts = this.pendingReceipts.splice(0);
    for (const receipt of receipts) this.send({ kind: 'receipt', requestId: receipt.requestId, ok: receipt.ok && receipt.version === this.state.version,
      message: receipt.version === this.state.version ? receipt.message : '页面再次改变，请重新读取上下文。', snapshot: this.snapshot() });
  }
  private async receiveAction(command: PanelCommand) {
    let ok = true; let message = '页面已显示操作结果';
    try {
      const target = command.target;
      if (!this.state.visible || command.expiresAt < Date.now() || target.clientId !== this.clientId || target.tabId !== this.tabId || target.occurrence !== this.occurrence || target.expectedVersion !== this.state.version || command.connectionId !== this.state.connectionId || command.companyId !== this.state.companyId) throw new Error('页面或连接已改变，请重新读取上下文。');
      await this.apply(command.action);
      if (this.state.view.error) throw new Error(this.state.view.error);
    } catch (error) { ok = false; message = messageOf(error); }
    this.pendingReceipts.push({ requestId: command.requestId, ok, message, version: this.state.version });
  }
  async apply(action: PanelAction) {
    if (this.state.settingsDirty) throw new Error('正在编辑设置，请先保存或取消。');
    if (action.kind === 'navigate') await this.navigate(action.page);
    else if (action.kind === 'filter') { const { kind: _kind, ...filter } = action; await this.filter(filter); }
    else if (action.kind === 'select') this.select(action.id);
    else if (action.kind === 'detail') await this.detail(action.id);
    else await this.load();
  }
}

export function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 600);
  return '操作未完成，请重试。';
}
