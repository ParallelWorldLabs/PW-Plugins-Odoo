export const styles = `
.pw-odoo,.pw-odoo *,.pw-odoo-menu,.pw-odoo-menu *{box-sizing:border-box}
.pw-odoo{display:flex;flex-direction:column;width:100%;height:100%;min-width:0;min-height:0;color:var(--dsw-alias-label-primary,CanvasText);background:var(--dsw-alias-bg-base,Canvas);font:13px/1.6 system-ui,-apple-system,"PingFang SC",sans-serif}
.pw-odoo button,.pw-odoo-menu button{font:inherit;color:inherit;border:.5px solid var(--dsw-alias-border-l3,GrayText);background:transparent;border-radius:7px;padding:5px 10px;min-height:30px;cursor:pointer}
.pw-odoo button:disabled{cursor:default;opacity:.45}
.pw-odoo button:hover:not(:disabled),.pw-odoo-menu button:hover{background:var(--dsw-alias-interactive-bg-hover,ButtonFace)}
.pw-odoo button:focus-visible,.pw-odoo input:focus-visible,.pw-odoo select:focus-visible,.pw-odoo-menu button:focus-visible{outline:2px solid var(--dsw-focus-ring-color,Highlight);outline-offset:2px}
.pw-odoo-scope{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:10px 12px;border-bottom:.5px solid var(--dsw-alias-border-l4,GrayText)}
.pw-odoo label{display:flex;gap:5px;align-items:center;flex-wrap:wrap;color:var(--dsw-alias-label-secondary,GrayText)}
.pw-odoo-scope label{min-width:0;max-width:100%}
.pw-odoo select,.pw-odoo input{min-width:0;max-width:100%;font:inherit;border:.5px solid var(--dsw-alias-border-l3,GrayText);border-radius:6px;padding:5px 7px;color:var(--dsw-alias-label-primary,CanvasText);background:var(--dsw-alias-bg-base,Canvas)}
.pw-odoo-badge{margin-left:auto;color:var(--dsw-alias-label-tertiary,GrayText);font-size:12px}
.pw-odoo-tabs,.pw-odoo-segment{display:flex;flex-wrap:wrap;gap:4px}
.pw-odoo-tabs{padding:8px 10px;border-bottom:.5px solid var(--dsw-alias-border-l4,GrayText);flex:none}
.pw-odoo-tabs button{border:0}
.pw-odoo button[aria-pressed=true]{background:var(--dsw-alias-bg-module-platform,ButtonFace);color:var(--dsw-alias-state-business-primary,LinkText)}
.pw-odoo-scroll{flex:1;min-height:0;overflow:auto;padding:14px;scrollbar-gutter:stable}
.pw-odoo-scroll>section,.pw-odoo-detail{display:flex;flex-direction:column;gap:12px}
.pw-odoo-segment{margin-bottom:12px}
.pw-odoo-filters{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-bottom:12px}
.pw-odoo-filters label{display:flex;flex-direction:column;align-items:stretch;gap:3px;font-size:12px}
.pw-odoo-search{flex:1 1 130px}
.pw-odoo-filters input{width:100%}
.pw-odoo-filters label.pw-odoo-checkbox{flex-direction:row;align-items:center;align-self:end;padding-bottom:6px}
.pw-odoo-filters .pw-odoo-checkbox input{width:auto}
.pw-odoo-list{display:flex;flex-direction:column;gap:8px}
.pw-odoo-record{display:flex;border:.5px solid var(--dsw-alias-border-l3,GrayText);border-radius:10px;overflow:hidden}
.pw-odoo-record.is-selected{border-color:var(--dsw-alias-state-business-primary,Highlight)}
.pw-odoo button.pw-odoo-record-select{display:flex;flex:1;min-width:0;flex-direction:column;text-align:left;align-items:start;gap:4px;border:0;border-radius:0;padding:11px 12px}
.pw-odoo-record-name{font-weight:500;overflow-wrap:anywhere}
.pw-odoo .pw-odoo-row-detail{flex:none;align-self:center;margin:8px;font-size:12px}
.pw-odoo-muted,.pw-odoo-footer{color:var(--dsw-alias-label-secondary,GrayText);font-size:12px}
.pw-odoo-amount{font-variant-numeric:tabular-nums}
.pw-odoo-pagination{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:12px 0;font-size:12px}
.pw-odoo-empty{padding:32px 8px;text-align:center;color:var(--dsw-alias-label-secondary,GrayText)}
.pw-odoo-error{border-left:2px solid var(--dsw-alias-state-error-primary,Mark);color:var(--dsw-alias-label-primary,CanvasText);padding:8px 10px;margin-bottom:10px;overflow-wrap:anywhere}
.pw-odoo-error button{margin-left:8px}
.pw-odoo-detail-head{display:flex;align-items:start;gap:10px;flex-wrap:wrap}
.pw-odoo h3{font-size:14px;font-weight:500;margin:6px 0}
.pw-odoo p{margin:4px 0}
.pw-odoo dl{display:flex;flex-direction:column;gap:0;margin:0}
.pw-odoo dl>div{display:grid;grid-template-columns:minmax(78px,30%) minmax(0,1fr);gap:8px;padding:8px 0;border-bottom:.5px solid var(--dsw-alias-border-l4,GrayText)}
.pw-odoo dt{color:var(--dsw-alias-label-secondary,GrayText)}
.pw-odoo dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.pw-odoo-activity{display:flex;flex-direction:column;gap:4px;padding:10px;border-left:2px solid var(--dsw-alias-border-l3,GrayText);margin-bottom:8px}
.pw-odoo-trace{border-top:.5px solid var(--dsw-alias-border-l3,GrayText);padding-top:10px}
.pw-odoo button.pw-odoo-trace-order{display:block;width:100%;text-align:left;margin:8px 0}
.pw-odoo-history{display:flex;flex-direction:column;gap:10px;margin:8px 0;padding-left:20px}
.pw-odoo-history li>time{display:block;color:var(--dsw-alias-label-secondary,GrayText);font-size:12px}
.pw-odoo-footer{display:flex;gap:5px 10px;flex-wrap:wrap;padding:8px 12px;border-top:.5px solid var(--dsw-alias-border-l4,GrayText);flex:none}
.pw-odoo-footer button{font-size:12px;padding:0 5px;min-height:22px;margin-left:5px}
.pw-odoo-launcher{display:inline-flex;align-items:center;justify-content:center;font-size:inherit;color:inherit}
.pw-odoo-menu{position:fixed;z-index:2100;width:210px;max-width:calc(100vw - 16px);padding:5px;border:.5px solid var(--dsw-alias-border-l3,GrayText);border-radius:10px;background:var(--dsw-alias-bg-base,Canvas);color:var(--dsw-alias-label-primary,CanvasText);box-shadow:0 8px 28px #0002;font:13px/1.5 system-ui}
.pw-odoo-menu button{width:100%;display:block;text-align:left;border:0;padding:8px 10px;border-radius:6px}
.pw-odoo-menu button[aria-current=page]{background:var(--dsw-alias-bg-module-platform,ButtonFace);color:var(--dsw-alias-state-business-primary,LinkText)}
.pw-odoo-menu-error{padding:6px 10px;color:var(--dsw-alias-state-error-primary,Mark);font-size:12px}
.pw-odoo h2{font-size:18px;font-weight:600;margin:0}
.pw-odoo-settings-heading,.pw-odoo-settings-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.pw-odoo-settings-heading h3{margin-right:auto}
.pw-odoo-settings-connection{display:flex;flex-direction:column;gap:4px;padding:12px;border:.5px solid var(--dsw-alias-border-l3,GrayText);border-radius:9px;overflow-wrap:anywhere}
.pw-odoo-settings-form{display:flex;flex-direction:column;gap:12px;padding:14px;border:.5px solid var(--dsw-alias-border-l3,GrayText);border-radius:9px}
.pw-odoo-settings-form fieldset{display:flex;flex-direction:column;gap:12px;border:0;padding:0;margin:0;min-width:0}
.pw-odoo-settings-form label{display:flex;flex-direction:column;align-items:stretch;gap:4px}
.pw-odoo-settings-form input{width:100%}
.pw-odoo-settings-form label.pw-odoo-settings-check{flex-direction:row;align-items:center;flex-wrap:nowrap}
.pw-odoo-settings-check input{width:auto;flex:none}
.pw-odoo-settings-advanced{display:flex;flex-direction:column;gap:12px;margin-top:10px}
.pw-odoo-settings summary{cursor:pointer}
.pw-odoo-settings-success,.pw-odoo-settings-welcome{padding:10px 12px;border-left:2px solid var(--dsw-alias-state-business-primary,Highlight);background:var(--dsw-alias-bg-module-platform,ButtonFace);overflow-wrap:anywhere}
.pw-odoo-settings-confirm{margin-top:5px;padding:10px;border:.5px solid var(--dsw-alias-border-l3,GrayText);border-radius:7px}
.pw-odoo-settings-confirm button{margin:6px 6px 0 0}
@media(pointer:coarse){.pw-odoo button,.pw-odoo-menu button{min-height:40px}.pw-odoo input,.pw-odoo select{font-size:16px}}
`;
