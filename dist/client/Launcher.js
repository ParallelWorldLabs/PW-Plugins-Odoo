import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pages } from '../panel/contracts.js';
/** The current DSH row supplies only an icon seat. Isolate the row adapter here until a dedicated launcher seat exists upstream. */
export function Launcher({ size, navigation, activePage }) {
    const icon = useRef(null);
    const popup = useRef(null);
    const row = useRef(null);
    const [position, setPosition] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const opened = useRef(false);
    const menuId = useRef(`pw-odoo-menu-${crypto.randomUUID()}`).current;
    const close = () => { opened.current = false; setPosition(null); navigation.cancel(); row.current?.setAttribute('aria-expanded', 'false'); };
    useEffect(() => {
        const button = icon.current?.closest('button,[role="button"]');
        if (!button) {
            setError('当前宿主未提供兼容的左侧导航行。请从右侧引导入口打开 Odoo。');
            return;
        }
        row.current = button;
        const original = ['aria-haspopup', 'aria-expanded', 'aria-controls'].map(name => [name, button.getAttribute(name)]);
        button.setAttribute('aria-haspopup', 'menu');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', menuId);
        const click = (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            if (opened.current) {
                close();
                return;
            }
            const rect = button.getBoundingClientRect();
            setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 218)), top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 290)) });
            opened.current = true;
            button.setAttribute('aria-expanded', 'true');
            setError('');
        };
        button.addEventListener('click', click, true);
        return () => { button.removeEventListener('click', click, true); for (const [name, value] of original)
            value === null ? button.removeAttribute(name) : button.setAttribute(name, value); navigation.cancel(); row.current = null; };
    }, [menuId, navigation]);
    useEffect(() => {
        if (!position)
            return;
        popup.current?.querySelector('button')?.focus();
        const outside = (event) => { if (!popup.current?.contains(event.target) && !row.current?.contains(event.target))
            close(); };
        const resize = () => close();
        document.addEventListener('pointerdown', outside);
        window.addEventListener('resize', resize);
        return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize); };
    }, [position]);
    const choose = async (page) => {
        setBusy(true);
        setError('');
        try {
            await navigation.activate(page);
            opened.current = false;
            setPosition(null);
            row.current?.setAttribute('aria-expanded', 'false');
            row.current?.focus();
        }
        catch (error) {
            if (opened.current)
                setError(error instanceof Error ? error.message : '无法打开 Odoo 面板。');
        }
        finally {
            setBusy(false);
        }
    };
    return _jsxs(_Fragment, { children: [_jsx("span", { ref: icon, className: "pw-odoo-launcher", style: { width: size, height: size }, "aria-hidden": "true", children: "O" }), error && !position && _jsx("span", { className: "pw-odoo-menu-error", role: "alert", children: error }), position && createPortal(_jsxs("div", { id: menuId, className: "pw-odoo-menu", role: "menu", "aria-label": "Odoo \u529F\u80FD", ref: popup, style: position, onClick: event => event.stopPropagation(), onPointerDown: event => event.stopPropagation(), onKeyDown: event => {
                    if (event.key === 'Escape') {
                        close();
                        row.current?.focus();
                    }
                    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                        event.preventDefault();
                        const buttons = [...popup.current.querySelectorAll('button')];
                        let index = buttons.indexOf(document.activeElement);
                        index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
                        buttons[index]?.focus();
                    }
                }, children: [pages.map(page => _jsx("button", { type: "button", role: "menuitem", "aria-current": activePage() === page.id ? 'page' : undefined, onClick: () => void choose(page.id), children: page.label }, page.id)), busy && _jsx("p", { className: "pw-odoo-menu-error", role: "status", children: "\u6B63\u5728\u6253\u5F00\u4F1A\u8BDD\u4E0E\u9762\u677F\u2026" }), error && _jsx("p", { className: "pw-odoo-menu-error", role: "alert", children: error })] }), document.body)] });
}
