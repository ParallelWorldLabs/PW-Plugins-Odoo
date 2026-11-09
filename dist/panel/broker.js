import { randomUUID } from 'node:crypto';
import { OdooError } from '../core/contracts.js';
import { panelIdentitySchema, panelSnapshotSchema, uplinkSchema } from './contracts.js';
export class PanelLink {
    binding;
    validateScope;
    timeoutMs;
    released;
    snapshot = null;
    queue = [];
    wake;
    closed = false;
    pending = new Map();
    constructor(binding, validateScope, timeoutMs, released) {
        this.binding = binding;
        this.validateScope = validateScope;
        this.timeoutMs = timeoutMs;
        this.released = released;
    }
    receive(text) {
        if (this.closed)
            return;
        if (text.length > 64000)
            throw new OdooError('INVALID_PANEL', 'Panel message is too large.');
        const frame = uplinkSchema.parse(JSON.parse(text));
        const snapshot = frame.snapshot;
        if (snapshot.clientId !== this.binding.clientId || snapshot.tabId !== this.binding.tabId || snapshot.occurrence !== this.binding.occurrence)
            throw new OdooError('INVALID_PANEL', 'Panel identity changed.');
        this.validateScope(snapshot.connectionId, snapshot.companyId, snapshot.configVersion);
        if (this.snapshot && snapshot.version < this.snapshot.version)
            throw new OdooError('INVALID_PANEL', 'Panel version went backwards.');
        this.snapshot = snapshot;
        if (frame.kind === 'receipt') {
            const pending = this.pending.get(frame.requestId);
            if (pending) {
                this.pending.delete(frame.requestId);
                pending.cleanup();
                pending.resolve({ ok: frame.ok, message: frame.message, snapshot });
            }
        }
    }
    async request(action, target, signal) {
        signal.throwIfAborted();
        const before = this.snapshot;
        if (this.closed || !before)
            throw new OdooError('NO_PANEL', 'Odoo panel is not available.');
        if (target && (target.clientId !== before.clientId || target.tabId !== before.tabId || target.occurrence !== before.occurrence || target.expectedVersion !== before.version))
            throw new OdooError('PANEL_CONFLICT', 'The panel changed. Read its context again.');
        if (this.pending.size >= 16 || this.queue.length >= 32)
            throw new OdooError('PANEL_BUSY', 'Panel has too many pending requests.');
        const requestId = randomUUID();
        const result = new Promise((resolve, reject) => {
            const fail = () => { const pending = this.pending.get(requestId); if (pending) {
                this.pending.delete(requestId);
                this.queue = this.queue.filter(frame => frame.kind === 'context' ? frame.requestId !== requestId : frame.kind !== 'action' || frame.command.requestId !== requestId);
                pending.cleanup();
                reject(new OdooError('PANEL_TIMEOUT', 'Panel request was cancelled or timed out.'));
            } };
            const timer = setTimeout(fail, this.timeoutMs);
            signal.addEventListener('abort', fail, { once: true });
            this.pending.set(requestId, { resolve, reject, cleanup: () => { clearTimeout(timer); signal.removeEventListener('abort', fail); } });
        });
        this.queue.push(action ? { kind: 'action', command: { requestId, target: target, action, connectionId: before.connectionId, companyId: before.companyId, expiresAt: Date.now() + this.timeoutMs } } : { kind: 'context', requestId });
        this.wake?.();
        this.wake = undefined;
        return result;
    }
    async *frames() {
        while (!this.closed) {
            const frame = this.queue.shift();
            if (frame)
                yield frame;
            else
                await new Promise(resolve => { this.wake = resolve; });
        }
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        this.wake?.();
        this.wake = undefined;
        this.queue = [];
        for (const pending of this.pending.values()) {
            pending.cleanup();
            pending.reject(new OdooError('NO_PANEL', 'The Odoo panel disconnected.'));
        }
        this.pending.clear();
        this.released();
    }
}
export class PanelBroker {
    validateScope;
    timeoutMs;
    links = new Set();
    constructor(validateScope, timeoutMs = 10000) {
        this.validateScope = validateScope;
        this.timeoutMs = timeoutMs;
    }
    open(binding, signal) {
        signal.throwIfAborted();
        panelIdentitySchema.parse(binding);
        for (const link of this.links)
            if (link.binding.peerId === binding.peerId && link.binding.clientId === binding.clientId && link.binding.sessionId === binding.sessionId && link.binding.tabId === binding.tabId)
                link.close();
        if (this.links.size >= 64)
            throw new OdooError('PANEL_BUSY', 'Too many Odoo panels.');
        const close = () => link.close();
        const link = new PanelLink(binding, this.validateScope, this.timeoutMs, () => { this.links.delete(link); signal.removeEventListener('abort', close); });
        this.links.add(link);
        signal.addEventListener('abort', close, { once: true });
        return link;
    }
    find(sessionId, target) {
        const candidates = [...this.links].filter(link => link.binding.sessionId === sessionId && link.snapshot?.visible &&
            (!target || (link.binding.clientId === target.clientId && link.binding.tabId === target.tabId && link.binding.occurrence === target.occurrence)));
        if (!candidates.length)
            throw new OdooError('NO_PANEL', 'Open the Odoo panel in this conversation first.');
        if (candidates.length > 1)
            throw new OdooError('AMBIGUOUS_PANEL', 'Multiple Odoo panels are visible. Specify the client and tab.');
        return candidates[0];
    }
    async context(sessionId, signal, target) {
        const candidates = [...this.links].filter(link => link.binding.sessionId === sessionId && link.snapshot?.visible).map(link => link.snapshot);
        if (!target && candidates.length > 1)
            return { ok: false, message: '请选择目标 Client/标签，再读取上下文。', candidates: candidates.map(({ clientId, tabId, occurrence, version, page, connectionId, companyId }) => ({ clientId, tabId, occurrence, version, page, connectionId, companyId })) };
        const reply = await this.find(sessionId, target).request(null, null, signal);
        return { ...reply, snapshot: panelSnapshotSchema.parse(reply.snapshot) };
    }
    async action(sessionId, target, action, signal) { return this.find(sessionId, target).request(action, target, signal); }
    async activeScope(sessionId, signal, target) {
        if (!target && ![...this.links].some(link => link.binding.sessionId === sessionId && link.snapshot?.visible))
            return null;
        const context = target ? await this.find(sessionId, target).request(null, target, signal) : await this.context(sessionId, signal);
        if (!('snapshot' in context))
            throw new OdooError('AMBIGUOUS_PANEL', 'Multiple Odoo panels are visible; select one before querying.');
        if (!context.ok)
            throw new OdooError('PANEL_CONFLICT', 'Panel context could not be confirmed.');
        if (target && context.snapshot.version !== target.expectedVersion)
            throw new OdooError('PANEL_CONFLICT', 'The panel changed. Read its context again.');
        return { connectionId: context.snapshot.connectionId, companyId: context.snapshot.companyId, configVersion: context.snapshot.configVersion };
    }
    dispose() { for (const link of this.links)
        link.close(); }
}
