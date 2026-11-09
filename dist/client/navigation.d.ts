import type { Page } from '../panel/contracts.js';
export interface NavigationHost {
    mounted(): boolean;
    subscribe(listener: () => void): () => void;
    startSession(): void;
    open(page: Page): void;
}
/** Coalesce left-menu clicks while retaining the host's existing drafts. */
export declare class OdooNavigation {
    private readonly host;
    private readonly timeoutMs;
    private target;
    private pending;
    private cleanup;
    private reject;
    constructor(host: NavigationHost, timeoutMs?: number);
    activate(page: Page): Promise<void>;
    cancel(): void;
}
