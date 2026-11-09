import { useState } from 'react';
import { connectionDraftSchema, type ProbeResult } from '../settings/contracts.js';
import { messageOf, type Connection, type OdooPanelModel, type PanelState } from './model.js';

type FormValues = { label: string; url: string; database: string; apiKey: string; lang: string; timezone: string; allowHttp: boolean; makeDefault: boolean };
const initial = (connection?: Connection, defaultId?: string | null): FormValues => ({ label: connection?.label ?? '', url: connection?.url ?? '', database: connection?.database ?? '', apiKey: '',
  lang: connection?.lang ?? '', timezone: connection?.timezone ?? '', allowHttp: connection?.allowHttp ?? false, makeDefault: !defaultId || connection?.id === defaultId });

/** Only this short-lived form holds a user-entered secret. It never enters model snapshots or browser storage. */
function ConnectionEditor({ model, state, connection, close }: { model: OdooPanelModel; state: PanelState; connection?: Connection; close: (saved: boolean) => void }) {
  const [values, setValues] = useState(() => initial(connection, state.settings?.defaultConnectionId));
  const [revision] = useState(state.settings!.revision);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => { setValues(previous => ({ ...previous, [key]: value })); setError(''); setProbe(null); model.settingsEdited(true); };
  const submit = async (save: boolean) => {
    setBusy(true); setError(''); setProbe(null);
    try {
      const parsed = connectionDraftSchema.safeParse({ ...(connection ? { id: connection.id } : {}), label: values.label, url: values.url, database: values.database,
        apiKey: values.apiKey, lang: values.lang.trim(), timezone: values.timezone.trim(), allowHttp: values.allowHttp });
      if (!parsed.success) throw new Error('请填写连接名称、有效的服务器地址和数据库。');
      if (new URL(parsed.data.url).protocol === 'http:' && !values.allowHttp) throw new Error('此地址使用 HTTP，请勾选“允许 HTTP”后重试。');
      if (save) { await model.saveConnection(parsed.data, values.makeDefault, revision); setValues(previous => ({ ...previous, apiKey: '' })); close(true); }
      else setProbe(await model.testConnection(parsed.data));
    } catch (failure) { setError(messageOf(failure)); }
    finally { setBusy(false); }
  };
  return <form className="pw-odoo-settings-form" aria-label={connection ? '编辑连接' : '新增连接'} autoComplete="off" onSubmit={event => { event.preventDefault(); void submit(true); }}>
    <h3>{connection ? `编辑连接 · ${connection.label}` : '新增连接'}</h3>
    <fieldset disabled={busy}>
      <label>连接名称<input aria-label="连接名称" value={values.label} maxLength={80} required placeholder="例如：本机 Odoo 20" onChange={event => set('label', event.target.value)} /></label>
      <label>服务器地址<input aria-label="服务器地址" type="url" value={values.url} maxLength={2000} required placeholder="http://localhost:8070" onChange={event => set('url', event.target.value)} /></label>
      <label>数据库<input aria-label="数据库" value={values.database} maxLength={128} required placeholder="例如：plugin" onChange={event => set('database', event.target.value)} /></label>
      <label>API Key<input aria-label="API Key" type="password" autoComplete="new-password" spellCheck={false} value={values.apiKey} maxLength={4096} required={!connection?.hasApiKey} placeholder={connection?.hasApiKey ? '已保存；留空保留原密钥' : '输入 Odoo API Key'} onChange={event => set('apiKey', event.target.value)} /></label>
      <p className="pw-odoo-muted">在 Odoo 用户偏好设置中生成 API Key。保存后不回显；更换服务器或数据库时需重新填写。</p>
      <p className="pw-odoo-muted">公司自动根据 API Key 的用户权限识别；连接后可在顶部选择全部公司或某一家公司。</p>
      <label className="pw-odoo-settings-check"><input type="checkbox" checked={values.allowHttp} onChange={event => set('allowHttp', event.target.checked)} />允许 HTTP（用于本机或受信任内网）</label>
      <label className="pw-odoo-settings-check"><input type="checkbox" checked={values.makeDefault} onChange={event => set('makeDefault', event.target.checked)} />设为默认连接</label>
      <details><summary>语言与时区</summary><div className="pw-odoo-settings-advanced"><label>语言<input aria-label="语言" value={values.lang} placeholder="留空使用 Odoo 用户语言，如 zh_CN" onChange={event => set('lang', event.target.value)} /></label><label>时区<input aria-label="时区" value={values.timezone} placeholder="留空使用 Odoo 用户时区，如 Asia/Shanghai" onChange={event => set('timezone', event.target.value)} /></label></div></details>
    </fieldset>
    {error && <p className="pw-odoo-error" role="alert">{error}</p>}
    {probe && <div className="pw-odoo-settings-success" role="status">连接测试成功 · Odoo {probe.version ?? '版本未知'}<p>{probe.companies.map(row => `${row.label} (#${row.id})`).join('、')}</p><p className="pw-odoo-muted">测试尚未保存。保存时会再次验证连接。</p></div>}
    {busy && <p role="status">正在验证连接…</p>}
    <div className="pw-odoo-settings-actions"><button type="button" disabled={busy} onClick={() => void submit(false)}>测试连接</button><button type="submit" disabled={busy}>验证并保存</button><button type="button" disabled={busy} onClick={() => { setValues(previous => ({ ...previous, apiKey: '' })); model.settingsEdited(false); close(false); }}>取消</button></div>
  </form>;
}

export function SettingsPage({ model, state }: { model: OdooPanelModel; state: PanelState }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const settings = state.settings;
  const run = async (operation: () => Promise<unknown>) => { setBusy(true); setError(''); setMessage(''); try { await operation(); } catch (failure) { setError(messageOf(failure)); } finally { setBusy(false); } };
  const edit = (id: string) => { setEditing(id); setDeleting(null); setMessage(''); setError(''); model.settingsEdited(true); };
  return <section className="pw-odoo-settings" aria-label="设置"><h2>设置</h2><p className="pw-odoo-muted">管理 Odoo 连接与访问范围。</p>
    <div className="pw-odoo-settings-heading"><h3>连接管理</h3><button type="button" disabled={busy || state.settingsDirty || !settings?.writable} onClick={() => edit('new')}>新增连接</button><button type="button" disabled={busy || state.settingsDirty} onClick={() => void run(() => model.refreshSettings())}>刷新设置</button></div>
    {settings?.warnings.map((warning, index) => <p className="pw-odoo-muted" key={index}>{warning}</p>)}
    {settings && !settings.writable && <p role="alert" className="pw-odoo-error">当前 Host 未提供可写凭据库，请在 DSH 标准 profile 中启用插件。</p>}
    {!settings && !state.startupError && <p role="status">正在加载设置…</p>}
    {settings && !settings.connections.length && <p className="pw-odoo-settings-welcome">尚未配置 Odoo。点击“新增连接”，填写地址、数据库和 API Key 后即可使用 CRM 等模块。</p>}
    {error && <p className="pw-odoo-error" role="alert">{error}</p>}
    {message && <p role="status" className="pw-odoo-settings-success">{message}</p>}
    {settings?.connections.map(connection => <article className="pw-odoo-settings-connection" key={connection.id}>
      <strong>{connection.label}{settings.defaultConnectionId === connection.id && <span className="pw-odoo-muted"> · 默认</span>}</strong><span>{connection.url}</span><span className="pw-odoo-muted">数据库 {connection.database ?? '自动选择'} · {connection.companyIds.length} 家公司 · {connection.hasApiKey ? 'API Key 已保存' : 'API Key 未配置'}</span>
      {connection.source === 'environment' && <span className="pw-odoo-muted">来自 Host 环境配置；编辑保存后由设置管理。</span>}
      <div className="pw-odoo-settings-actions"><button type="button" aria-label={`编辑 ${connection.label}`} disabled={busy || state.settingsDirty || !settings.writable} onClick={() => edit(connection.id)}>编辑</button><button type="button" aria-label={`删除 ${connection.label}`} disabled={busy || state.settingsDirty || !settings.writable} onClick={() => setDeleting(connection.id)}>删除</button></div>
      {deleting === connection.id && <div className="pw-odoo-settings-confirm"><p>删除此连接设置？Odoo 中的业务数据不受影响。</p><button type="button" disabled={busy} onClick={() => void run(async () => { await model.deleteConnection(connection.id, settings.revision); setDeleting(null); setMessage('连接已删除。'); })}>确认删除</button><button type="button" disabled={busy} onClick={() => setDeleting(null)}>保留连接</button></div>}
    </article>)}
    {editing && settings && <ConnectionEditor key={editing} model={model} state={state} connection={settings.connections.find(row => row.id === editing)} close={saved => { setEditing(null); if (saved) setMessage('连接已保存，可切换到 CRM、销售等模块。'); }} />}
    {!editing && model.connection() && <section aria-label="连接诊断"><h3>连接诊断</h3><p className="pw-odoo-muted">诊断当前选中的连接与公司。切换范围会清空此前的业务缓存。</p><button type="button" disabled={state.view.loading || busy} onClick={() => void run(() => model.diagnostic())}>诊断连接与库存依赖</button>{state.diagnostic && <div className="pw-odoo-diagnostic"><p>实际版本：{String((state.diagnostic.status as Record<string, unknown>)?.version ?? '未知')}</p><p>库存/MTO 依赖：{(state.diagnostic.stock as Record<string, unknown>)?.infrastructureReady ? '已安装' : '需要处理'}</p><p className="pw-odoo-muted">产品路线和供应商配置需按产品核对。</p></div>}</section>}
  </section>;
}
