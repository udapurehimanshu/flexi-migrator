/**
 * Page: STD - Receiving On PLT
 * Component: XX_LPN_AS_PLT
 * Event: _beforeExit
 */

if((XX_LPN_AS_PLT.getValue() === "YES"))
 {
    textLPN.setValue(flexi.getSessionObject("PLT_NUM"));
 }
 else if ((XX_LPN_AS_PLT.getValue() === "NO"))
 {
   textLPN.setValue("");
 }