import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import type { RecordData } from '../core/contracts.js';
import { SettingsPage } from './Settings.js';
import { pages } from '../panel/contracts.js';
import { OdooPanelModel, messageOf, type PanelState } from './model.js';

const labels: Record<string, string> = { id: '记录 ID', name: '名称', type: '类型', partner_id: '客户 / 供应商', stage_id: '阶段', user_id: '负责人', team_id: '销售团队', expected_revenue: '预计收入', company_currency: '币种', probability: '赢率（%）', date_deadline: '预计成交日期', description: '备注', activity_summary: '下一步活动', activity_date_deadline: '活动截止日期', amount_total: '总金额', currency_id: '币种', date_order: '单据时间', state: '状态', company_id: '公司', receipt_status: '收货状态', delivery_status: '交付状态', origin: '来源', opportunity_id: '关联商机', product_id: '产品', location_id: '库位', quantity: '现存 / 当前数量', reserved_quantity: '已预留', available_quantity: '可用数量', uom_id: '单位', product_uom_id: '单位', product_uom: '单位', scheduled_date: '计划时间', picking_type_id: '作业类型', sale_id: '销售单', purchase_id: '采购单', route_ids: '产品路线', route_from_categ_ids: '类别继承路线', seller_ids: '供应商配置', service_to_purchase: '分包服务', service_tracking: '接单后创建', qty_available: '现存数量', virtual_available: '预测数量', default_code: '内部编码', active: '启用', won_status: '商机状态', lost_reason_id: '丢单原因', tag_ids: '标签', date_closed: '关闭时间' };

export function formatValue(value: unknown, field = '', state?: PanelState): string {
  const metadata = state?.view.metadata[field];
  if (value === false && metadata?.type === 'boolean') return '否';
  if (value === false || value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length === 2 && typeof value[1] === 'string' ? value[1] : value.slice(0, 12).map(item => String(item)).join('、');
  const choice = metadata?.selection?.find(([key]) => key === value);
  if (choice) return choice[1];
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
  if (metadata?.type === 'html') return String(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim(); // React still renders this as text, never HTML.
  if (metadata?.type === 'datetime' && /^\d{4}-\d{2}-\d{2} /.test(String(value))) {
    const date = new Date(`${String(value).replace(' ', 'T')}Z`);
    const zone = state?.connections.find(item => item.id === state.connectionId)?.timezone;
    if (!Number.isNaN(date.valueOf())) return new Intl.DateTimeFormat('zh-CN', { timeZone: zone, dateStyle: 'short', timeStyle: 'short', hour12: false }).format(date);
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
function name(row: RecordData) { return formatValue(row.name || row.product_id || row.display_name || `记录 ${row.id}`); }

export interface OdooAppProps { model: OdooPanelModel; visible: boolean; lifetime: AbortSignal }
/** The actual right-tab UI, reused by the DSH slot and the integration harness. */
export function OdooApp({ model, visible, lifetime }: OdooAppProps) {
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const run = (operation: Promise<unknown>) => { void operation.catch(error => { const message = messageOf(error); if (!lifetime.aborted && message !== '页面已改变，请重新操作。') model.reportError(message); }); };
  useEffect(() => { void model.start(lifetime); return () => model.stop(); }, [model, lifetime]);
  useEffect(() => { model.setVisible(visible); }, [model, visible]);
  useLayoutEffect(() => { model.rendered(state.version); }, [model, state.version]);
  const connection = model.connection();
  const companyName = state.companyId === 0 ? '全部公司' : connection?.companies?.find(item => item.id === state.companyId)?.label ?? `公司 ${state.companyId}`;
  const view = state.view;
  const title = pages.find(page => page.id === state.page)!.label;
  const business = model.currentModel() !== null;
  const stateChoices = view.metadata[state.page === 'crm' ? 'won_status' : 'state']?.selection;
  const money = (row: RecordData) => `${formatValue(row.expected_revenue ?? row.amount_total)} ${formatValue(row.company_currency ?? row.currency_id)}`;
  const summary = (row: RecordData) => state.page === 'crm' ? `${formatValue(row.partner_id)} · ${formatValue(row.stage_id)} · ${formatValue(row.user_id)}` : state.page === 'inventory' ? `${formatValue(row.location_id ?? row.picking_type_id)} · ${formatValue(row.state, 'state', state)}` : `${formatValue(row.partner_id)} · ${formatValue(row.state, 'state', state)}`;
  const relatedPurchase = (id: number) => run((async () => { await model.navigate('purchase'); await model.detail(id); })());

  return <div className="pw-odoo" data-pw-odoo-page={state.page}>
    <div className="pw-odoo-scope">
      <label>连接<select aria-label="Odoo 连接" value={state.connectionId} disabled={!state.connections.length || view.loading || state.settingsDirty} onChange={event => { const item = state.connections.find(row => row.id === event.target.value)!; run(model.switchScope(item.id, 0)); }}>{!state.connections.length && <option value="">未配置</option>}{state.connections.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>公司<select aria-label="Odoo 公司" value={state.companyId} disabled={!connection || view.loading || state.settingsDirty} onChange={event => run(model.switchScope(state.connectionId, Number(event.target.value)))}>{!connection && <option value={state.companyId}>未选择</option>}{connection && <option value={0}>全部公司（All）</option>}{(connection?.companyIds ?? []).map(id => <option key={id} value={id}>{connection?.companies?.find(item => item.id === id)?.label ?? `公司 ${id}`} (#{id})</option>)}</select></label>
      <span className="pw-odoo-badge">只读</span>
    </div>
    <nav className="pw-odoo-tabs" aria-label="Odoo 功能">{pages.map(page => <button key={page.id} type="button" aria-pressed={page.id === state.page} data-pw-page={page.id} disabled={(page.id !== 'settings' && !connection) || (state.settingsDirty && page.id !== 'settings')} onClick={() => run(model.navigate(page.id))}>{page.label}</button>)}</nav>
    <div className="pw-odoo-scroll">
      {(state.startupError || view.error) && <div className="pw-odoo-error" role="alert">{state.startupError || view.error}<button type="button" onClick={() => state.startupError ? run(model.start(lifetime)) : run(model.load())}>重试</button></div>}
      {state.page === 'crm' && !view.detail && <div className="pw-odoo-segment" aria-label="线索与商机">{(['opportunity', 'lead'] as const).map(type => <button key={type} type="button" aria-pressed={view.filter.crmType === type} onClick={() => run(model.filter({ crmType: type }))}>{type === 'opportunity' ? '商机' : '线索'}</button>)}</div>}
      {state.page === 'inventory' && <div className="pw-odoo-segment" aria-label="库存视图">{([['quant', '库存数量'], ['incoming', '收货'], ['outgoing', '发货'], ['products', '产品补给']] as const).map(([kind, label]) => <button key={kind} type="button" aria-pressed={state.inventoryKind === kind} onClick={() => run(model.inventory(kind))}>{label}</button>)}</div>}
      {business && !view.detail && <form className="pw-odoo-filters" onSubmit={event => { event.preventDefault(); run(model.filter({ keyword: view.draftKeyword })); }}>
        <label className="pw-odoo-search">{model.currentModel() === 'stock.quant' ? '产品名称' : '名称 / 单号'}<input aria-label="查询名称或单号" value={view.draftKeyword} maxLength={200} onChange={event => model.draftKeyword(event.target.value)} /></label>
        {state.page === 'crm' && <label>阶段<select aria-label="CRM 阶段" value={view.filter.stageId ?? ''} onChange={event => run(model.filter({ stageId: event.target.value ? Number(event.target.value) : null }))}><option value="">全部阶段</option>{state.stages.map(stage => <option key={stage.id} value={stage.id}>{formatValue(stage.name)}</option>)}</select></label>}
        {stateChoices && <label>状态<select aria-label={`${title}状态`} value={view.filter.state} onChange={event => run(model.filter({ state: event.target.value }))}><option value="">全部状态</option>{stateChoices.map(([value, label]) => <option key={String(value)} value={String(value)}>{label}</option>)}</select></label>}
        {state.page === 'crm' && <label className="pw-odoo-checkbox"><input type="checkbox" aria-label="包含归档商机" checked={view.filter.includeArchived} onChange={event => run(model.filter({ includeArchived: event.target.checked }))} />包含归档</label>}
        <button type="submit" disabled={view.loading}>查询</button>
        <button type="button" onClick={() => run(model.load())} disabled={view.loading}>刷新</button>
      </form>}
      {view.loading && <p className="pw-odoo-muted" role="status">正在读取 {title}…</p>}
      {business && !view.detail && !view.loading && <>
        <div className="pw-odoo-list" aria-label={`${title}列表`}>{!view.rows.length && !view.error ? <div className="pw-odoo-empty">当前范围没有记录</div> : view.rows.map(row => <article key={row.id} className={`pw-odoo-record${view.selectedId === row.id ? ' is-selected' : ''}`}>
          <button type="button" className="pw-odoo-record-select" aria-pressed={view.selectedId === row.id} onClick={() => { try { model.select(row.id); } catch (error) { model.reportError(messageOf(error)); } }}><span className="pw-odoo-record-name">{name(row)}</span><span className="pw-odoo-muted">{summary(row)}</span>
          {state.page !== 'inventory' && <span className="pw-odoo-amount">{money(row)}</span>}
          {model.currentModel() === 'stock.quant' && <span>现存 {formatValue(row.quantity)} · 预留 {formatValue(row.reserved_quantity)} · 可用 {formatValue(row.available_quantity)} {formatValue(row.uom_id ?? row.product_uom_id)}</span>}
          {model.currentModel() === 'product.product' && <span>现存 {formatValue(row.qty_available)} {formatValue(row.uom_id)} · 类型 {formatValue(row.type, 'type', state)}</span>}
          </button><button type="button" className="pw-odoo-row-detail" aria-label={`查看 ${name(row)} 详情`} onClick={() => run(model.detail(row.id))}>详情</button>
        </article>)}</div>
        <div className="pw-odoo-pagination"><button type="button" disabled={view.offset === 0 || view.loading} onClick={() => run(model.paginate(Math.max(0, view.offset - 25)))}>上一页</button><span>当前页 {view.rows.length} 条</span><button type="button" disabled={view.nextOffset === null || view.loading} onClick={() => run(model.paginate(view.nextOffset!))}>下一页</button></div>
      </>}
      {view.detail && <section className="pw-odoo-detail" aria-label={`${title}详情`}>
        <div className="pw-odoo-detail-head"><button type="button" onClick={() => model.back()}>返回列表</button><strong>{name(view.detail)}</strong></div>
        <dl>{Object.entries(view.detail).map(([field, value]) => <div key={field}><dt>{labels[field] ?? view.metadata[field]?.string ?? field}</dt><dd>{formatValue(value, field, state)}</dd></div>)}</dl>
        {state.page === 'crm' && <section aria-label="计划跟进活动"><h3>计划跟进</h3>{view.activities.length ? view.activities.map(activity => <div className="pw-odoo-activity" key={activity.id}><strong>{formatValue(activity.summary ?? activity.activity_type_id)}</strong><span>{formatValue(activity.date_deadline)} · {formatValue(activity.user_id)}</span><p>{formatValue(activity.note).replace(/<[^>]*>/g, ' ')}</p></div>) : <p className="pw-odoo-muted">没有可见的计划活动；这不代表从未跟进。</p>}</section>}
        {state.page === 'sales' && <button type="button" disabled={view.loading} onClick={() => run(model.trace())}>查看关联采购 / MTO 追溯</button>}
        {view.trace && <section className="pw-odoo-trace" aria-label="采购来源追溯"><h3>关联采购</h3><p className="pw-odoo-muted">实际关系追溯，不代表已交付或独占采购数量。</p>{(view.trace.truncated || Number(view.trace.unresolvedRecordCount) > 0) && <p className="pw-odoo-error">结果有截断或不可见关联，不能作为完整链路。</p>}
          {Array.isArray(view.trace.purchaseOrders) && (view.trace.purchaseOrders as RecordData[]).map(order => <button key={order.id} type="button" className="pw-odoo-trace-order" onClick={() => relatedPurchase(order.id)}>{name(order)} · {formatValue(order.partner_id)} · {(view.trace?.purchaseOrderStateLabels as [string, string][] | undefined)?.find(([value]) => value === order.state)?.[1] ?? formatValue(order.state)} → 打开采购详情</button>)}
          {Array.isArray(view.trace.purchaseOrders) && !view.trace.purchaseOrders.length && <p>当前范围未找到关联采购。</p>}
        </section>}
      </section>}
      {state.page === 'history' && <section aria-label="最近页面操作"><h3>最近页面操作</h3><p className="pw-odoo-muted">当前会话与连接范围内的查询、导航回执。</p>{state.history.length ? <ol className="pw-odoo-history">{state.history.map((item, index) => <li key={`${item.time}-${index}`}><span>{item.label}{item.ok ? '' : ' · 未完成'}</span><time>{new Date(item.time).toLocaleTimeString('zh-CN', { hour12: false })}</time></li>)}</ol> : <p>暂无记录</p>}</section>}
      {state.page === 'settings' && <SettingsPage model={model} state={state} />}
    </div>
    <footer className="pw-odoo-footer"><span>{connection?.label ?? '请先在设置中添加连接'}{connection ? ` · ${companyName}` : ''}</span><span>{state.online ? 'Agent 页面通道已连接' : 'Agent 页面通道未连接'}{!state.online && connection && <button type="button" onClick={() => run(model.reconnect(lifetime))}>重连</button>}</span>{view.fetchedAt && <time dateTime={view.fetchedAt}>读取于 {new Date(view.fetchedAt).toLocaleTimeString('zh-CN', { hour12: false })}</time>}</footer>
  </div>;
}
