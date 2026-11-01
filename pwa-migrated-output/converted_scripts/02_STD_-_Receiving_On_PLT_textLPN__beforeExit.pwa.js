/**
 * Page: STD - Receiving On PLT
 * Component: textLPN
 * Event: _beforeExit
 */

if(textLPN.getValue().length>0)
 {
 flexi.putSessionObject("LPN_NUM",textLPN.getValue());
}