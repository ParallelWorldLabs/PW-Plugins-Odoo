import { OdooPanelModel, type PanelState } from './model.js';
export declare function formatValue(value: unknown, field?: string, state?: PanelState): string;
export interface OdooAppProps {
    model: OdooPanelModel;
    visible: boolean;
    lifetime: AbortSignal;
}
/** The actual right-tab UI, reused by the DSH slot and the integration harness. */
export declare function OdooApp({ model, visible, lifetime }: OdooAppProps): import("react").JSX.Element;
