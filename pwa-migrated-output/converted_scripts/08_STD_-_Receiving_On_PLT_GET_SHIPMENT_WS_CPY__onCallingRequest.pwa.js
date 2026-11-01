/**
 * Page: STD - Receiving On PLT
 * Component: GET_SHIPMENT_WS_CPY
 * Event: _onCallingRequest
 */

if(textASN.getValue().length>0){
flexi.putObject("SHIP_STARTS","&shipment_nbr__startswith="+textASN.getValue());
}
else{
flexi.putObject("SHIP_STARTS","");
}
