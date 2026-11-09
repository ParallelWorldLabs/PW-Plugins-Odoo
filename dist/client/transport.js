/** Consume the generated namespace directly; no browser ERP connection or hand-built RPC endpoint. */
export function createTransport(ctx, sessionId) {
    return {
        async connections(signal) { const result = await ctx.remote.pwOdoo.connections(signal); if (!result.ok)
            throw result.error; return result.value; },
        async read(connectionId, companyId, operation, input, signal, configVersion) {
            const result = await ctx.remote.pwOdoo.execute(sessionId, connectionId, companyId, configVersion ?? '', operation, JSON.stringify(input), signal);
            if (!result.ok)
                throw result.error;
            return result.value;
        },
        async settings(signal) { const result = await ctx.remote.pwOdoo.settings(signal); if (!result.ok)
            throw result.error; return result.value; },
        async testConnection(input, signal) { const result = await ctx.remote.pwOdoo.testConnection(JSON.stringify(input), signal); if (!result.ok)
            throw result.error; return result.value; },
        async saveConnection(input, signal) { const result = await ctx.remote.pwOdoo.saveConnection(JSON.stringify(input), signal); if (!result.ok)
            throw result.error; return result.value; },
        async deleteConnection(input, signal) { const result = await ctx.remote.pwOdoo.deleteConnection(JSON.stringify(input), signal); if (!result.ok)
            throw result.error; return result.value; },
        panel(clientId, tabId, occurrence, signal) {
            const handle = ctx.remote.pwOdoo.panel(sessionId, clientId, tabId, occurrence, signal);
            return { [Symbol.asyncIterator]: () => handle[Symbol.asyncIterator](), async send(value) { handle.send(value); }, dispose() { handle.dispose(); } };
        },
    };
}
