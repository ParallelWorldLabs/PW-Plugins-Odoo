export declare function isBlockedAddress(address: string): boolean;
export declare function requestJson(url: URL, headers: Record<string, string>, body: unknown, timeoutMs: number, signal?: AbortSignal): Promise<unknown>;
