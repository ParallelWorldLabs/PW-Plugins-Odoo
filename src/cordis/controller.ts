import type { Context } from '@deepseek-ai/cordis';
import { Remote, RemoteError, TypertRemoteService, type RemoteStream } from '@deepseek-ai/dsh-typert-protocol';
import { OdooError, publicError } from '../core/contracts.js';
import { OdooBackend } from './backend.js';
import { PanelBroker } from '../panel/broker.js';
import { z } from 'zod';

declare module '@deepseek-ai/cordis' { interface Context { pwOdoo: OdooController } }
declare module '@deepseek-ai/dsh-typert-protocol' { interface RemoteErrorDetailsMap { 'pw-odoo/rejected': { readonly code: string } } }

/** Owner-authenticated browser entry; ERP credentials remain in this Host service. */
export class OdooController extends TypertRemoteService {
  constructor(ctx: Context, private readonly backend: OdooBackend, private readonly panels: PanelBroker) { super(ctx, 'pwOdoo', { namespace: 'pwOdoo' }); }

  /** Return public connection choices, never environment paths or credentials. */
  @Remote('connections')
  async connections(signal: AbortSignal): Promise<string> {
    this.owner();
    signal.throwIfAborted(); return JSON.stringify(await this.backend.choices(signal));
  }

  /** Execute one owner read request with a Client Session identity and narrowed company scope. */
  @Remote('execute')
  async execute(sessionId: string, connectionId: string, companyId: number, configVersion: string, operation: string, payload: string, signal: AbortSignal): Promise<string> {
    this.owner(); z.string().min(1).max(200).parse(sessionId);
    signal.throwIfAborted();
    try { return await this.backend.execute(connectionId, companyId, operation, payload, signal, configVersion); }
    catch (error) { const safe = publicError(error); throw new RemoteError('pw-odoo/rejected', safe.message, { code: safe.code }); }
  }

  @Remote('settings')
  async settings(signal: AbortSignal): Promise<string> {
    this.owner(); signal.throwIfAborted();
    return this.settingRequest(() => this.backend.settings());
  }

  @Remote('testConnection')
  async testConnection(payload: string, signal: AbortSignal): Promise<string> {
    this.owner(); signal.throwIfAborted();
    return this.settingRequest(() => this.backend.testConnection(this.settingPayload(payload), signal));
  }

  @Remote('saveConnection')
  async saveConnection(payload: string, signal: AbortSignal): Promise<string> {
    this.owner(); signal.throwIfAborted();
    return this.settingRequest(() => this.backend.saveConnection(this.settingPayload(payload), signal));
  }

  @Remote('deleteConnection')
  async deleteConnection(payload: string, signal: AbortSignal): Promise<string> {
    this.owner(); signal.throwIfAborted();
    return this.settingRequest(() => this.backend.deleteConnection(this.settingPayload(payload), signal));
  }

  private settingPayload(payload: string): unknown {
    if (payload.length > 12000) throw new OdooError('INVALID_INPUT', '连接设置过大。');
    return JSON.parse(payload);
  }
  private async settingRequest(operation: () => Promise<unknown>): Promise<string> {
    try { return JSON.stringify(await operation()); }
    catch (error) {
      const safe = error instanceof OdooError ? publicError(error) : { code: 'INVALID_SETTINGS', message: '设置未能保存或验证，请检查地址、凭据、语言及本机存储后重试。' };
      throw new RemoteError('pw-odoo/rejected', safe.message, { code: safe.code });
    }
  }

  /** Bind one concrete Client/tab occurrence to its Session, with validated bounded snapshot uplink. */
  @Remote({ mode: 'stream' })
  async *panel(sessionId: string, clientId: string, tabId: string, occurrence: string, signal: AbortSignal): RemoteStream<string, string> {
    this.owner(); z.string().min(1).max(200).parse(sessionId);
    const invocation = this.ctx.invocation;
    if (!invocation || invocation.peer.principal.kind !== 'owner') throw new RemoteError('pw-odoo/rejected', 'Only the Host owner may access Odoo panels.', { code: 'ACCESS_DENIED' });
    const link = this.panels.open({ sessionId, peerId: invocation.peer.id, clientId, tabId, occurrence }, AbortSignal.any([signal, invocation.peer.signal]));
    const uplink = invocation.uplink<string>()[Symbol.asyncIterator]();
    const pump = async () => { try { for (;;) { const frame = await uplink.next(); if (frame.done) break; link.receive(frame.value); } } finally { link.close(); } };
    void pump().catch(() => link.close());
    try { yield JSON.stringify({ kind: 'ready' }); for await (const frame of link.frames()) yield JSON.stringify(frame); }
    finally { link.close(); void uplink.return?.(); }
  }

  private owner(): void {
    if (this.ctx.invocation?.peer.principal.kind !== 'owner') throw new RemoteError('pw-odoo/rejected', 'Only the Host owner may access Odoo.', { code: 'ACCESS_DENIED' });
  }
}
