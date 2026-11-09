import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { connectionDraftSchema } from '../settings/contracts.js';
import { messageOf } from './model.js';
const initial = (connection, defaultId) => ({ label: connection?.label ?? '', url: connection?.url ?? '', database: connection?.database ?? '', apiKey: '',
    lang: connection?.lang ?? '', timezone: connection?.timezone ?? '', allowHttp: connection?.allowHttp ?? false, makeDefault: !defaultId || connection?.id === defaultId });
/** Only this short-lived form holds a user-entered secret. It never enters model snapshots or browser storage. */
function ConnectionEditor({ model, state, connection, close }) {
    const [values, setValues] = useState(() => initial(connection, state.settings?.defaultConnectionId));
    const [revision] = useState(state.settings.revision);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [probe, setProbe] = useState(null);
    const set = (key, value) => { setValues(previous => ({ ...previous, [key]: value })); setError(''); setProbe(null); model.settingsEdited(true); };
    const submit = async (save) => {
        setBusy(true);
        setError('');
        setProbe(null);
        try {
            const parsed = connectionDraftSchema.safeParse({ ...(connection ? { id: connection.id } : {}), label: values.label, url: values.url, database: values.database,
                apiKey: values.apiKey, lang: values.lang.trim(), timezone: values.timezone.trim(), allowHttp: values.allowHttp });
            if (!parsed.success)
                throw new Error('请填写连接名称、有效的服务器地址和数据库。');
            if (new URL(parsed.data.url).protocol === 'http:' && !values.allowHttp)
                throw new Error('此地址使用 HTTP，请勾选“允许 HTTP”后重试。');
            if (save) {
                await model.saveConnection(parsed.data, values.makeDefault, revision);
                setValues(previous => ({ ...previous, apiKey: '' }));
                close(true);
            }
            else
                setProbe(await model.testConnection(parsed.data));
        }
        catch (failure) {
            setError(messageOf(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return _jsxs("form", { className: "pw-odoo-settings-form", "aria-label": connection ? '编辑连接' : '新增连接', autoComplete: "off", onSubmit: event => { event.preventDefault(); void submit(true); }, children: [_jsx("h3", { children: connection ? `编辑连接 · ${connection.label}` : '新增连接' }), _jsxs("fieldset", { disabled: busy, children: [_jsxs("label", { children: ["\u8FDE\u63A5\u540D\u79F0", _jsx("input", { "aria-label": "\u8FDE\u63A5\u540D\u79F0", value: values.label, maxLength: 80, required: true, placeholder: "\u4F8B\u5982\uFF1A\u672C\u673A Odoo 20", onChange: event => set('label', event.target.value) })] }), _jsxs("label", { children: ["\u670D\u52A1\u5668\u5730\u5740", _jsx("input", { "aria-label": "\u670D\u52A1\u5668\u5730\u5740", type: "url", value: values.url, maxLength: 2000, required: true, placeholder: "http://localhost:8070", onChange: event => set('url', event.target.value) })] }), _jsxs("label", { children: ["\u6570\u636E\u5E93", _jsx("input", { "aria-label": "\u6570\u636E\u5E93", value: values.database, maxLength: 128, required: true, placeholder: "\u4F8B\u5982\uFF1Aplugin", onChange: event => set('database', event.target.value) })] }), _jsxs("label", { children: ["API Key", _jsx("input", { "aria-label": "API Key", type: "password", autoComplete: "new-password", spellCheck: false, value: values.apiKey, maxLength: 4096, required: !connection?.hasApiKey, placeholder: connection?.hasApiKey ? '已保存；留空保留原密钥' : '输入 Odoo API Key', onChange: event => set('apiKey', event.target.value) })] }), _jsx("p", { className: "pw-odoo-muted", children: "\u5728 Odoo \u7528\u6237\u504F\u597D\u8BBE\u7F6E\u4E2D\u751F\u6210 API Key\u3002\u4FDD\u5B58\u540E\u4E0D\u56DE\u663E\uFF1B\u66F4\u6362\u670D\u52A1\u5668\u6216\u6570\u636E\u5E93\u65F6\u9700\u91CD\u65B0\u586B\u5199\u3002" }), _jsx("p", { className: "pw-odoo-muted", children: "\u516C\u53F8\u81EA\u52A8\u6839\u636E API Key \u7684\u7528\u6237\u6743\u9650\u8BC6\u522B\uFF1B\u8FDE\u63A5\u540E\u53EF\u5728\u9876\u90E8\u9009\u62E9\u5168\u90E8\u516C\u53F8\u6216\u67D0\u4E00\u5BB6\u516C\u53F8\u3002" }), _jsxs("label", { className: "pw-odoo-settings-check", children: [_jsx("input", { type: "checkbox", checked: values.allowHttp, onChange: event => set('allowHttp', event.target.checked) }), "\u5141\u8BB8 HTTP\uFF08\u7528\u4E8E\u672C\u673A\u6216\u53D7\u4FE1\u4EFB\u5185\u7F51\uFF09"] }), _jsxs("label", { className: "pw-odoo-settings-check", children: [_jsx("input", { type: "checkbox", checked: values.makeDefault, onChange: event => set('makeDefault', event.target.checked) }), "\u8BBE\u4E3A\u9ED8\u8BA4\u8FDE\u63A5"] }), _jsxs("details", { children: [_jsx("summary", { children: "\u8BED\u8A00\u4E0E\u65F6\u533A" }), _jsxs("div", { className: "pw-odoo-settings-advanced", children: [_jsxs("label", { children: ["\u8BED\u8A00", _jsx("input", { "aria-label": "\u8BED\u8A00", value: values.lang, placeholder: "\u7559\u7A7A\u4F7F\u7528 Odoo \u7528\u6237\u8BED\u8A00\uFF0C\u5982 zh_CN", onChange: event => set('lang', event.target.value) })] }), _jsxs("label", { children: ["\u65F6\u533A", _jsx("input", { "aria-label": "\u65F6\u533A", value: values.timezone, placeholder: "\u7559\u7A7A\u4F7F\u7528 Odoo \u7528\u6237\u65F6\u533A\uFF0C\u5982 Asia/Shanghai", onChange: event => set('timezone', event.target.value) })] })] })] })] }), error && _jsx("p", { className: "pw-odoo-error", role: "alert", children: error }), probe && _jsxs("div", { className: "pw-odoo-settings-success", role: "status", children: ["\u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F \u00B7 Odoo ", probe.version ?? '版本未知', _jsx("p", { children: probe.companies.map(row => `${row.label} (#${row.id})`).join('、') }), _jsx("p", { className: "pw-odoo-muted", children: "\u6D4B\u8BD5\u5C1A\u672A\u4FDD\u5B58\u3002\u4FDD\u5B58\u65F6\u4F1A\u518D\u6B21\u9A8C\u8BC1\u8FDE\u63A5\u3002" })] }), busy && _jsx("p", { role: "status", children: "\u6B63\u5728\u9A8C\u8BC1\u8FDE\u63A5\u2026" }), _jsxs("div", { className: "pw-odoo-settings-actions", children: [_jsx("button", { type: "button", disabled: busy, onClick: () => void submit(false), children: "\u6D4B\u8BD5\u8FDE\u63A5" }), _jsx("button", { type: "submit", disabled: busy, children: "\u9A8C\u8BC1\u5E76\u4FDD\u5B58" }), _jsx("button", { type: "button", disabled: busy, onClick: () => { setValues(previous => ({ ...previous, apiKey: '' })); model.settingsEdited(false); close(false); }, children: "\u53D6\u6D88" })] })] });
}
export function SettingsPage({ model, state }) {
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const settings = state.settings;
    const run = async (operation) => { setBusy(true); setError(''); setMessage(''); try {
        await operation();
    }
    catch (failure) {
        setError(messageOf(failure));
    }
    finally {
        setBusy(false);
    } };
    const edit = (id) => { setEditing(id); setDeleting(null); setMessage(''); setError(''); model.settingsEdited(true); };
    return _jsxs("section", { className: "pw-odoo-settings", "aria-label": "\u8BBE\u7F6E", children: [_jsx("h2", { children: "\u8BBE\u7F6E" }), _jsx("p", { className: "pw-odoo-muted", children: "\u7BA1\u7406 Odoo \u8FDE\u63A5\u4E0E\u8BBF\u95EE\u8303\u56F4\u3002" }), _jsxs("div", { className: "pw-odoo-settings-heading", children: [_jsx("h3", { children: "\u8FDE\u63A5\u7BA1\u7406" }), _jsx("button", { type: "button", disabled: busy || state.settingsDirty || !settings?.writable, onClick: () => edit('new'), children: "\u65B0\u589E\u8FDE\u63A5" }), _jsx("button", { type: "button", disabled: busy || state.settingsDirty, onClick: () => void run(() => model.refreshSettings()), children: "\u5237\u65B0\u8BBE\u7F6E" })] }), settings?.warnings.map((warning, index) => _jsx("p", { className: "pw-odoo-muted", children: warning }, index)), settings && !settings.writable && _jsx("p", { role: "alert", className: "pw-odoo-error", children: "\u5F53\u524D Host \u672A\u63D0\u4F9B\u53EF\u5199\u51ED\u636E\u5E93\uFF0C\u8BF7\u5728 DSH \u6807\u51C6 profile \u4E2D\u542F\u7528\u63D2\u4EF6\u3002" }), !settings && !state.startupError && _jsx("p", { role: "status", children: "\u6B63\u5728\u52A0\u8F7D\u8BBE\u7F6E\u2026" }), settings && !settings.connections.length && _jsx("p", { className: "pw-odoo-settings-welcome", children: "\u5C1A\u672A\u914D\u7F6E Odoo\u3002\u70B9\u51FB\u201C\u65B0\u589E\u8FDE\u63A5\u201D\uFF0C\u586B\u5199\u5730\u5740\u3001\u6570\u636E\u5E93\u548C API Key \u540E\u5373\u53EF\u4F7F\u7528 CRM \u7B49\u6A21\u5757\u3002" }), error && _jsx("p", { className: "pw-odoo-error", role: "alert", children: error }), message && _jsx("p", { role: "status", className: "pw-odoo-settings-success", children: message }), settings?.connections.map(connection => _jsxs("article", { className: "pw-odoo-settings-connection", children: [_jsxs("strong", { children: [connection.label, settings.defaultConnectionId === connection.id && _jsx("span", { className: "pw-odoo-muted", children: " \u00B7 \u9ED8\u8BA4" })] }), _jsx("span", { children: connection.url }), _jsxs("span", { className: "pw-odoo-muted", children: ["\u6570\u636E\u5E93 ", connection.database ?? '自动选择', " \u00B7 ", connection.companyIds.length, " \u5BB6\u516C\u53F8 \u00B7 ", connection.hasApiKey ? 'API Key 已保存' : 'API Key 未配置'] }), connection.source === 'environment' && _jsx("span", { className: "pw-odoo-muted", children: "\u6765\u81EA Host \u73AF\u5883\u914D\u7F6E\uFF1B\u7F16\u8F91\u4FDD\u5B58\u540E\u7531\u8BBE\u7F6E\u7BA1\u7406\u3002" }), _jsxs("div", { className: "pw-odoo-settings-actions", children: [_jsx("button", { type: "button", "aria-label": `编辑 ${connection.label}`, disabled: busy || state.settingsDirty || !settings.writable, onClick: () => edit(connection.id), children: "\u7F16\u8F91" }), _jsx("button", { type: "button", "aria-label": `删除 ${connection.label}`, disabled: busy || state.settingsDirty || !settings.writable, onClick: () => setDeleting(connection.id), children: "\u5220\u9664" })] }), deleting === connection.id && _jsxs("div", { className: "pw-odoo-settings-confirm", children: [_jsx("p", { children: "\u5220\u9664\u6B64\u8FDE\u63A5\u8BBE\u7F6E\uFF1FOdoo \u4E2D\u7684\u4E1A\u52A1\u6570\u636E\u4E0D\u53D7\u5F71\u54CD\u3002" }), _jsx("button", { type: "button", disabled: busy, onClick: () => void run(async () => { await model.deleteConnection(connection.id, settings.revision); setDeleting(null); setMessage('连接已删除。'); }), children: "\u786E\u8BA4\u5220\u9664" }), _jsx("button", { type: "button", disabled: busy, onClick: () => setDeleting(null), children: "\u4FDD\u7559\u8FDE\u63A5" })] })] }, connection.id)), editing && settings && _jsx(ConnectionEditor, { model: model, state: state, connection: settings.connections.find(row => row.id === editing), close: saved => { setEditing(null); if (saved)
                    setMessage('连接已保存，可切换到 CRM、销售等模块。'); } }, editing), !editing && model.connection() && _jsxs("section", { "aria-label": "\u8FDE\u63A5\u8BCA\u65AD", children: [_jsx("h3", { children: "\u8FDE\u63A5\u8BCA\u65AD" }), _jsx("p", { className: "pw-odoo-muted", children: "\u8BCA\u65AD\u5F53\u524D\u9009\u4E2D\u7684\u8FDE\u63A5\u4E0E\u516C\u53F8\u3002\u5207\u6362\u8303\u56F4\u4F1A\u6E05\u7A7A\u6B64\u524D\u7684\u4E1A\u52A1\u7F13\u5B58\u3002" }), _jsx("button", { type: "button", disabled: state.view.loading || busy, onClick: () => void run(() => model.diagnostic()), children: "\u8BCA\u65AD\u8FDE\u63A5\u4E0E\u5E93\u5B58\u4F9D\u8D56" }), state.diagnostic && _jsxs("div", { className: "pw-odoo-diagnostic", children: [_jsxs("p", { children: ["\u5B9E\u9645\u7248\u672C\uFF1A", String(state.diagnostic.status?.version ?? '未知')] }), _jsxs("p", { children: ["\u5E93\u5B58/MTO \u4F9D\u8D56\uFF1A", state.diagnostic.stock?.infrastructureReady ? '已安装' : '需要处理'] }), _jsx("p", { className: "pw-odoo-muted", children: "\u4EA7\u54C1\u8DEF\u7EBF\u548C\u4F9B\u5E94\u5546\u914D\u7F6E\u9700\u6309\u4EA7\u54C1\u6838\u5BF9\u3002" })] })] })] });
}
