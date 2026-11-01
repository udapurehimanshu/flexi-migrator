/**
 * Page: STD - Receiving On PLT
 * Component: XX_BILLING_INFO
 * Event: _afterClick
 */

flexi.putSessionObject("PLT_NUM",textPlt.getValue());
flexi.openApplication("BILLING_INFORMATION_CAPTURE_CUSTOM");