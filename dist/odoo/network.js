import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { OdooError } from '../core/contracts.js';
// Private enterprise networks are supported. Link-local metadata and non-unicast destinations are not.
export function isBlockedAddress(address) {
    const value = isIP(address) === 6 ? new URL(`http://[${address}]/`).hostname.slice(1, -1) : address.toLowerCase();
    if (isIP(value) === 4) {
        const [a, b] = value.split('.').map(Number);
        return a === 0 || a >= 224 || (a === 169 && b === 254) || value === '100.100.100.200';
    }
    if (isIP(value) === 6) {
        if (value.startsWith('::ffff:')) {
            const tail = value.slice(7);
            if (isIP(tail) === 4)
                return isBlockedAddress(tail);
            const parts = tail.split(':');
            if (parts.length === 2) {
                const n = parseInt(parts[0], 16) * 65536 + parseInt(parts[1], 16);
                return isBlockedAddress([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'));
            }
        }
        return value === '::' || value.startsWith('ff') || /^fe[89ab]/.test(value) || value === 'fd00:ec2::254';
    }
    return false;
}
export async function requestJson(url, headers, body, timeoutMs, signal) {
    if (isBlockedAddress(url.hostname.replace(/^\[|\]$/g, '')))
        throw new OdooError('BLOCKED_TARGET', 'Odoo target is blocked.');
    const payload = body === undefined ? '' : JSON.stringify(body);
    if (Buffer.byteLength(payload) > 32768)
        throw new OdooError('INVALID_INPUT', 'Request is too large.');
    const abort = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]);
    return new Promise((resolve, reject) => {
        const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
            method: body === undefined ? 'GET' : 'POST', signal: abort, agent: false,
            headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(payload)), 'User-Agent': 'pw-plugins-odoo/0.5.2' },
            lookup(hostname, options, callback) {
                lookup(hostname, { ...options, all: true }, (error, addresses) => {
                    if (error)
                        return callback(error, []);
                    if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address)))
                        return callback(new Error('Blocked address'), []);
                    if (options.all)
                        callback(null, addresses);
                    else
                        callback(null, addresses[0].address, addresses[0].family);
                });
            },
        }, (res) => {
            if (res.statusCode !== 200) {
                res.destroy();
                const status = res.statusCode ?? 500;
                const code = status === 401 ? 'AUTHENTICATION_FAILED' : status === 403 ? 'ACCESS_DENIED' : 'ODOO_HTTP_ERROR';
                reject(new OdooError(code, `Odoo request failed (HTTP ${status}).`, status));
                return;
            }
            const chunks = [];
            let size = 0;
            res.on('data', (chunk) => {
                size += chunk.length;
                if (size > 2 * 1024 * 1024) {
                    reject(new OdooError('RESPONSE_TOO_LARGE', 'Reduce the page size or selected fields.'));
                    res.destroy();
                }
                else
                    chunks.push(chunk);
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
                }
                catch {
                    reject(new OdooError('INVALID_RESPONSE', 'Odoo returned an invalid JSON response.'));
                }
            });
            res.on('error', () => reject(new OdooError('NETWORK_ERROR', 'Odoo response was interrupted.')));
        });
        req.on('error', () => reject(new OdooError(abort.aborted ? 'CANCELLED_OR_TIMEOUT' : 'NETWORK_ERROR', 'Odoo request was interrupted or could not connect.')));
        req.end(payload);
    });
}
