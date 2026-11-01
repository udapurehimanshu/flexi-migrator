/**
 * Page: STD - Receiving On PLT
 * Component: XX_HAND_TYPE
 * Event: _beforeExit
 */

flexi.putSessionObject("HANDLING_OBJ_NEW",XX_HAND_TYPE.getValue());
flexi.putSessionObject("HANDLING_OBJ_NEW_SHORT",XX_HAND_TYPE.getSelectedValues()[1]);

 if((XX_HAND_TYPE.getValue() === "PLT-GENERAL-REEFER"))
 {
    XX_TEMP.setHidden(false);
 }
 else if((XX_HAND_TYPE.getValue() === "NPLT-GENERAL-REEFER"))
 {
  XX_TEMP.setHidden(false);
 }
else{
XX_TEMP.setHidden(true);
}