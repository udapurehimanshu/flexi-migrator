/**
 * Page:  
 * Component: -1
 * Event: _afterPageEntered
 */

if((typeof textInputable !== "undefined" && textInputable !== null)){
 if(textInputable.getLabel().indexOf("Expiry Date") !== -1) {
       textInputable.setDateTimeFormat("dd-MM-yyyy");
 }

if(textInputable.getLabel().indexOf("Batch") !== -1)
{
XX_PREV_BTN.setHidden(false);
}
else
{
XX_PREV_BTN.setHidden(true);

}

}