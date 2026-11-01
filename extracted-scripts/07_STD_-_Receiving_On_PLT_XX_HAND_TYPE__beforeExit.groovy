flexi.putSessionObject("HANDLING_OBJ_NEW",XX_HAND_TYPE.getValue());
flexi.putSessionObject("HANDLING_OBJ_NEW_SHORT",XX_HAND_TYPE.getSelectedValues().get(1));

 if("PLT-GENERAL-REEFER".equals(XX_HAND_TYPE.getValue()))
 {
    XX_TEMP.setHidden(false);
 }
 else if("NPLT-GENERAL-REEFER".equals(XX_HAND_TYPE.getValue()))
 {
  XX_TEMP.setHidden(false);
 }
else{
XX_TEMP.setHidden(true);
}