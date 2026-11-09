/** Coalesce left-menu clicks while retaining the host's existing drafts. */
export class OdooNavigation {
    host;
    timeoutMs;
    target = 'crm';
    pending;
    cleanup;
    reject;
    constructor(host, timeoutMs = 10000) {
        this.host = host;
        this.timeoutMs = timeoutMs;
    }
    activate(page) {
        this.target = page;
        if (this.pending)
            return this.pending;
        if (this.host.mounted()) {
            this.host.open(page);
            return Promise.resolve();
        }
        const pending = new Promise((resolve, reject) => {
            this.reject = reject;
            let timer;
            let unsubscribe = () => { };
            this.cleanup = () => { clearTimeout(timer); unsubscribe(); this.cleanup = undefined; this.reject = undefined; };
            const check = () => {
                if (!this.host.mounted())
                    return;
                this.cleanup?.();
                try {
                    this.host.open(this.target);
                    resolve();
                }
                catch (error) {
                    reject(error);
                }
            };
            timer = setTimeout(() => { this.cleanup?.(); reject(new Error('未能挂载会话工作区，请先打开一个会话后重试。')); }, this.timeoutMs);
            unsubscribe = this.host.subscribe(check);
            try {
                this.host.startSession();
                check();
            }
            catch (error) {
                this.cleanup?.();
                reject(error);
            }
        });
        this.pending = pending;
        void pending.then(() => { if (this.pending === pending)
            this.pending = undefined; }, () => { if (this.pending === pending)
            this.pending = undefined; });
        return pending;
    }
    cancel() { const reject = this.reject; this.cleanup?.(); reject?.(new Error('已取消打开 Odoo 面板。')); this.pending = undefined; }
}
