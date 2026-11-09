var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { OdooError, publicError } from '../core/contracts.js';
import { z } from 'zod';
/** Owner-authenticated browser entry; ERP credentials remain in this Host service. */
let OdooController = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _connections_decorators;
    let _execute_decorators;
    let _settings_decorators;
    let _testConnection_decorators;
    let _saveConnection_decorators;
    let _deleteConnection_decorators;
    let _panel_decorators;
    return class OdooController extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _connections_decorators = [Remote('connections')];
            _execute_decorators = [Remote('execute')];
            _settings_decorators = [Remote('settings')];
            _testConnection_decorators = [Remote('testConnection')];
            _saveConnection_decorators = [Remote('saveConnection')];
            _deleteConnection_decorators = [Remote('deleteConnection')];
            _panel_decorators = [Remote({ mode: 'stream' })];
            __esDecorate(this, null, _connections_decorators, { kind: "method", name: "connections", static: false, private: false, access: { has: obj => "connections" in obj, get: obj => obj.connections }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _execute_decorators, { kind: "method", name: "execute", static: false, private: false, access: { has: obj => "execute" in obj, get: obj => obj.execute }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _settings_decorators, { kind: "method", name: "settings", static: false, private: false, access: { has: obj => "settings" in obj, get: obj => obj.settings }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _testConnection_decorators, { kind: "method", name: "testConnection", static: false, private: false, access: { has: obj => "testConnection" in obj, get: obj => obj.testConnection }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _saveConnection_decorators, { kind: "method", name: "saveConnection", static: false, private: false, access: { has: obj => "saveConnection" in obj, get: obj => obj.saveConnection }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _deleteConnection_decorators, { kind: "method", name: "deleteConnection", static: false, private: false, access: { has: obj => "deleteConnection" in obj, get: obj => obj.deleteConnection }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _panel_decorators, { kind: "method", name: "panel", static: false, private: false, access: { has: obj => "panel" in obj, get: obj => obj.panel }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        backend = __runInitializers(this, _instanceExtraInitializers);
        panels;
        constructor(ctx, backend, panels) {
            super(ctx, 'pwOdoo', { namespace: 'pwOdoo' });
            this.backend = backend;
            this.panels = panels;
        }
        /** Return public connection choices, never environment paths or credentials. */
        async connections(signal) {
            this.owner();
            signal.throwIfAborted();
            return JSON.stringify(await this.backend.choices(signal));
        }
        /** Execute one owner read request with a Client Session identity and narrowed company scope. */
        async execute(sessionId, connectionId, companyId, configVersion, operation, payload, signal) {
            this.owner();
            z.string().min(1).max(200).parse(sessionId);
            signal.throwIfAborted();
            try {
                return await this.backend.execute(connectionId, companyId, operation, payload, signal, configVersion);
            }
            catch (error) {
                const safe = publicError(error);
                throw new RemoteError('pw-odoo/rejected', safe.message, { code: safe.code });
            }
        }
        async settings(signal) {
            this.owner();
            signal.throwIfAborted();
            return this.settingRequest(() => this.backend.settings());
        }
        async testConnection(payload, signal) {
            this.owner();
            signal.throwIfAborted();
            return this.settingRequest(() => this.backend.testConnection(this.settingPayload(payload), signal));
        }
        async saveConnection(payload, signal) {
            this.owner();
            signal.throwIfAborted();
            return this.settingRequest(() => this.backend.saveConnection(this.settingPayload(payload), signal));
        }
        async deleteConnection(payload, signal) {
            this.owner();
            signal.throwIfAborted();
            return this.settingRequest(() => this.backend.deleteConnection(this.settingPayload(payload), signal));
        }
        settingPayload(payload) {
            if (payload.length > 12000)
                throw new OdooError('INVALID_INPUT', '连接设置过大。');
            return JSON.parse(payload);
        }
        async settingRequest(operation) {
            try {
                return JSON.stringify(await operation());
            }
            catch (error) {
                const safe = error instanceof OdooError ? publicError(error) : { code: 'INVALID_SETTINGS', message: '设置未能保存或验证，请检查地址、凭据、语言及本机存储后重试。' };
                throw new RemoteError('pw-odoo/rejected', safe.message, { code: safe.code });
            }
        }
        /** Bind one concrete Client/tab occurrence to its Session, with validated bounded snapshot uplink. */
        async *panel(sessionId, clientId, tabId, occurrence, signal) {
            this.owner();
            z.string().min(1).max(200).parse(sessionId);
            const invocation = this.ctx.invocation;
            if (!invocation || invocation.peer.principal.kind !== 'owner')
                throw new RemoteError('pw-odoo/rejected', 'Only the Host owner may access Odoo panels.', { code: 'ACCESS_DENIED' });
            const link = this.panels.open({ sessionId, peerId: invocation.peer.id, clientId, tabId, occurrence }, AbortSignal.any([signal, invocation.peer.signal]));
            const uplink = invocation.uplink()[Symbol.asyncIterator]();
            const pump = async () => { try {
                for (;;) {
                    const frame = await uplink.next();
                    if (frame.done)
                        break;
                    link.receive(frame.value);
                }
            }
            finally {
                link.close();
            } };
            void pump().catch(() => link.close());
            try {
                yield JSON.stringify({ kind: 'ready' });
                for await (const frame of link.frames())
                    yield JSON.stringify(frame);
            }
            finally {
                link.close();
                void uplink.return?.();
            }
        }
        owner() {
            if (this.ctx.invocation?.peer.principal.kind !== 'owner')
                throw new RemoteError('pw-odoo/rejected', 'Only the Host owner may access Odoo.', { code: 'ACCESS_DENIED' });
        }
    };
})();
export { OdooController };
