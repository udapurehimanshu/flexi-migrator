try{
if(textShipment.getValue().length()>0){
flexi.putObject("SHIP_STARTS","&shipment_nbr__startswith="+textShipment.getValue());
}
else{
flexi.putObject("SHIP_STARTS","");
}
}
catch(Exception e)
{
	
}


