import { type Page } from '../panel/contracts.js';
import { OdooNavigation } from './navigation.js';
export interface LauncherProps {
    size: number;
    navigation: OdooNavigation;
    activePage: () => Page | undefined;
}
/** The current DSH row supplies only an icon seat. Isolate the row adapter here until a dedicated launcher seat exists upstream. */
export declare function Launcher({ size, navigation, activePage }: LauncherProps): import("react").JSX.Element;
