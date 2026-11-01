/**
 * Page: STD - Receiving On PLT
 * Component: textPlt
 * Event: _beforeExit
 */

if(textPlt.getValue().length>0)
 {
 flexi.putSessionObject("PLT_NUM",textPlt.getValue());
}
