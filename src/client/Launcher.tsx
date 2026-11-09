import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pages, type Page } from '../panel/contracts.js';
import { OdooNavigation } from './navigation.js';

export interface LauncherProps { size: number; navigation: OdooNavigation; activePage: () => Page | undefined }
/** The current DSH row supplies only an icon seat. Isolate the row adapter here until a dedicated launcher seat exists upstream. */
export function Launcher({ size, navigation, activePage }: LauncherProps) {
  const icon = useRef<HTMLSpanElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const opened = useRef(false);
  const menuId = useRef(`pw-odoo-menu-${crypto.randomUUID()}`).current;
  const close = () => { opened.current = false; setPosition(null); navigation.cancel(); row.current?.setAttribute('aria-expanded', 'false'); };
  useEffect(() => {
    const button = icon.current?.closest<HTMLElement>('button,[role="button"]');
    if (!button) { setError('当前宿主未提供兼容的左侧导航行。请从右侧引导入口打开 Odoo。'); return; }
    row.current = button;
    const original = ['aria-haspopup', 'aria-expanded', 'aria-controls'].map(name => [name, button.getAttribute(name)] as const);
    button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', menuId);
    const click = (event: Event) => {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      if (opened.current) { close(); return; }
      const rect = button.getBoundingClientRect();
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 218)), top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 290)) });
      opened.current = true; button.setAttribute('aria-expanded', 'true'); setError('');
    };
    button.addEventListener('click', click, true);
    return () => { button.removeEventListener('click', click, true); for (const [name, value] of original) value === null ? button.removeAttribute(name) : button.setAttribute(name, value); navigation.cancel(); row.current = null; };
  }, [menuId, navigation]);
  useEffect(() => {
    if (!position) return;
    popup.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => { if (!popup.current?.contains(event.target as Node) && !row.current?.contains(event.target as Node)) close(); };
    const resize = () => close();
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize); };
  }, [position]);
  const choose = async (page: Page) => {
    setBusy(true); setError('');
    try { await navigation.activate(page); opened.current = false; setPosition(null); row.current?.setAttribute('aria-expanded', 'false'); row.current?.focus(); }
    catch (error) { if (opened.current) setError(error instanceof Error ? error.message : '无法打开 Odoo 面板。'); }
    finally { setBusy(false); }
  };
  return <><span ref={icon} className="pw-odoo-launcher" style={{ width: size, height: size }} aria-hidden="true">O</span>{error && !position && <span className="pw-odoo-menu-error" role="alert">{error}</span>}{position && createPortal(<div id={menuId} className="pw-odoo-menu" role="menu" aria-label="Odoo 功能" ref={popup} style={position} onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onKeyDown={event => {
    if (event.key === 'Escape') { close(); row.current?.focus(); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); const buttons = [...popup.current!.querySelectorAll<HTMLButtonElement>('button')];
      let index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[index]?.focus();
    }
  }}>{pages.map(page => <button key={page.id} type="button" role="menuitem" aria-current={activePage() === page.id ? 'page' : undefined} onClick={() => void choose(page.id)}>{page.label}</button>)}{busy && <p className="pw-odoo-menu-error" role="status">正在打开会话与面板…</p>}{error && <p className="pw-odoo-menu-error" role="alert">{error}</p>}</div>, document.body)}</>;
}
