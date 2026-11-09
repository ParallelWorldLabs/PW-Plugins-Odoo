import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo } from 'react';
import remoteContribution from '../../lib/typert.remote-client.js';
import { pageSchema } from '../panel/contracts.js';
import { OdooApp } from './App.js';
import { Launcher } from './Launcher.js';
import { OdooPanelModel } from './model.js';
import { createTransport } from './transport.js';
import { OdooNavigation } from './navigation.js';
import { styles } from './styles.js';
export const TAB_KIND = 'pw-odoo';
export const TAB_ID = 'pw-plugins-odoo/workbench';
function Body({ useTabInfo, modelFor }) {
    const { tab } = useTabInfo();
    const model = useMemo(() => modelFor(tab), [modelFor, tab.id, tab.signal]);
    const params = tab.navigation.params;
    useEffect(() => { const page = pageSchema.safeParse(params?.page); if (page.success && page.data !== model.getSnapshot().page)
        void model.navigate(page.data).catch(error => model.reportError(error instanceof Error ? error.message : '请先保存或取消设置。')); }, [model, tab.navigation.revision]);
    return _jsx(OdooApp, { model: model, visible: tab.visible, lifetime: tab.signal });
}
export const inject = ['slots', 'sidebarRightTabs', 'sidebarRight', 'uiWorkspace', 'remote'];
export async function apply(ctx) {
    // External packages select and mount their own generated contribution explicitly.
    ctx.effect(() => ctx.remote.$mount(remoteContribution));
    ctx.inject(['remote.pwOdoo'], (ctx) => {
        const clientId = crypto.randomUUID();
        const models = new Map();
        const navigation = new OdooNavigation({
            mounted: () => ctx.sidebarRight.mounted.getSnapshot() !== undefined,
            subscribe: listener => ctx.sidebarRight.mounted.subscribe(listener),
            startSession: () => ctx.uiWorkspace.startSession(undefined, { whenDraftExists: 'keep' }),
            open: page => {
                const session = ctx.sidebarRight.mounted.getSnapshot();
                const existing = [...models.entries()].filter(([key, value]) => session && key.startsWith(`${session}:`) && !value.signal.aborted);
                if (existing.length === 1)
                    ctx.sidebarRight.focus(existing[0][1].model.tabId);
                else if (existing.length > 1 && ctx.sidebarRight.active()?.kind !== TAB_KIND)
                    throw new Error('当前会话有多个 Odoo 标签，请先选中目标标签。');
                ctx.sidebarRight.openTab(TAB_KIND, { params: { page } });
            },
        });
        ctx.effect(() => { const style = document.createElement('style'); style.dataset.pwOdoo = 'workbench'; style.textContent = styles; document.head.append(style); return () => style.remove(); });
        ctx.effect(() => () => { navigation.cancel(); for (const entry of models.values())
            entry.model.stop(); models.clear(); });
        ctx.effect(() => ctx.sidebarRightTabs.register({ id: TAB_ID, kind: TAB_KIND, title: () => 'Odoo', keepMounted: true,
            guide: [{ id: 'pw-odoo-workbench', order: 30, title: () => 'Odoo', description: () => 'CRM、销售、采购与库存，只读查询和采购追溯。' }] }));
        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'pw-odoo-launcher', order: 21, label: () => 'Odoo',
            inject: () => ({ navigation, activePage: () => {
                    const session = ctx.sidebarRight.mounted.getSnapshot();
                    const active = ctx.sidebarRight.active();
                    return session && active ? models.get(`${session}:${active.id}`)?.model.getSnapshot().page : undefined;
                } }),
        }, Launcher)));
        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID,
            inject: sessionId => ({ modelFor: (tab) => {
                    const key = `${sessionId}:${tab.id}`;
                    const current = models.get(key);
                    if (current && current.signal === tab.signal)
                        return current.model;
                    current?.model.stop();
                    const preferenceKey = `pw-odoo-scope:${sessionId}:${tab.id}`;
                    let initialScope;
                    try {
                        const value = JSON.parse(sessionStorage.getItem(preferenceKey) ?? 'null');
                        if (typeof value?.connectionId === 'string' && Number.isSafeInteger(value.companyId))
                            initialScope = value;
                    }
                    catch { /* Optional public UI preference storage can be unavailable. */ }
                    const model = new OdooPanelModel(createTransport(ctx, sessionId), clientId, tab.id, crypto.randomUUID(), {
                        initialScope,
                        saveScope: (connectionId, companyId) => { try {
                            sessionStorage.setItem(preferenceKey, JSON.stringify({ connectionId, companyId }));
                        }
                        catch { /* No business data or credentials are persisted. */ } },
                    });
                    const entry = { signal: tab.signal, model };
                    models.set(key, entry);
                    tab.signal.addEventListener('abort', () => { model.stop(); if (models.get(key) === entry)
                        models.delete(key); }, { once: true });
                    return model;
                } }),
        }, Body)));
    });
}
