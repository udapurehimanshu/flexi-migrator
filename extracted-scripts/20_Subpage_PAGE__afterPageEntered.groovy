if(textInputable!=void){
 if(textInputable.getLabel().contains("Expiry Date")) {
       textInputable.setDateTimeFormat("dd-MM-yyyy");
 }

if(textInputable.getLabel().contains("Batch"))
{
XX_PREV_BTN.setHidden(false);
}
else
{
XX_PREV_BTN.setHidden(true);

}

}