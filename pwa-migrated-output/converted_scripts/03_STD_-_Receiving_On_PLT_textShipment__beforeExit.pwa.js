/**
 * Page: STD - Receiving On PLT
 * Component: textShipment
 * Event: _beforeExit
 */

if (textShipment.getValue().length > 0) {
    flexi.putSessionObject("SHIP_NBR", textShipment.getValue());

    //Call web service to get balance lpn on shipment//
    GET_BAL_LPN_RECV_WS.callWebService(null);
    if (GET_BAL_LPN_RECV_WS.getResponseCode() == 200) {
      var lpn_res = (typeof GET_BAL_LPN_RECV_WS.getRawResponse() === "string" ? JSON.parse(GET_BAL_LPN_RECV_WS.getRawResponse()) : GET_BAL_LPN_RECV_WS.getRawResponse());
      var lpn_arr = lpn_res.results;
      flexi.putObject("TOT_LPN_CNT", String(lpn_res.result_count));
    //NEW CODE MODIFY 
	  if (flexi.getObject("TOT_LPN_CNT") != null) {
        XX_TOTAL_LPN_SHIP.setValue(flexi.getObject("TOT_LPN_CNT"));
      } else {
        XX_TOTAL_LPN_SHIP.setValue("");
      }

      //flexi.setStatusMessage("Total Balance LPN--->"+flexi.getObject("TOT_LPN_CNT"));

// NEW CODE 11-06-2024
GET_LPN_REC_WS.callWebService(null);
    if (GET_LPN_REC_WS.getResponseCode() == 200) {
      var lpn_ress = (typeof GET_LPN_REC_WS.getRawResponse() === "string" ? JSON.parse(GET_LPN_REC_WS.getRawResponse()) : GET_LPN_REC_WS.getRawResponse());
      var lpn_arrr = lpn_ress.results;
      flexi.putObject("RES_LPN_CNT", String(lpn_ress.result_count));

//NEW CODE MODIFY 
	  
	  if (flexi.getObject("RES_LPN_CNT") != null) {
        XX_RECEIVED_LPN.setValue(flexi.getObject("RES_LPN_CNT"));
      } else {
        XX_RECEIVED_LPN.setValue("");
      }
      //flexi.setStatusMessage("Received Balance LPN--->"+flexi.getObject("RES_LPN_CNT"));
var total_qty = parseFloat(flexi.getObject("TOT_LPN_CNT"));
 var recei_qty = parseFloat(flexi.getObject("RES_LPN_CNT"));
 //var balance_qty = total_qty - recei_qty;
var balance_qty = total_qty - recei_qty;
 flexi.putObject("BAL_QTY",balance_qty);
var kp =String(flexi.getObject("BAL_QTY"));
//var value = parseInt(kp, 10);
//XX_ORDER_BAL_QTY.setValue(kp);
//flexi.setStatusMessage("Balance qty difference---------->"+flexi.getObject("BAL_QTY"));

      if (flexi.getObject("BAL_QTY") != null) {
        XX_BAL_LPN_RECV.setValue(String(balance_qty));
      } else {
        XX_BAL_LPN_RECV.setValue("");
      }

}

    }
}
    //End Web Service call to get balance lpn on shipment

//Call web service to get balance sku to be  received//
 GET_BAL_SKU_REC_WS.callWebService(null);
    if (GET_BAL_SKU_REC_WS.getResponseCode() == 200) {
      var task_loc_list = [];
      var sku_res = (typeof GET_BAL_SKU_REC_WS.getRawResponse() === "string" ? JSON.parse(GET_BAL_SKU_REC_WS.getRawResponse()) : GET_BAL_SKU_REC_WS.getRawResponse());
      var sku_arr = sku_res.results;
      var newHp = {};
      for(var k =0; k < sku_arr.length; k++) {
      newHp.push(sku_arr[k].item_id.get("key"));
      console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^"+newHp);
   }
 task_loc_list.push(newHp);
var sku_api_cnt =  task_loc_list.length;
console.log("**************************"+sku_api_cnt);
XX_BAL_SKU_RECV.setValue(String(sku_api_cnt));
XX_TOTAL_SKU_SHIP.setValue(String(sku_api_cnt));
     }
//End web service to get balance sku to be  received//

//Call web service to get qty to be  received//
GET_BAL_QTY_WS.callWebService(null);
if(GET_BAL_QTY_WS.getResponseCode()==200)
{
 var ship_json =(typeof GET_BAL_QTY_WS.getRawResponse() === "string" ? JSON.parse(GET_BAL_QTY_WS.getRawResponse()) : GET_BAL_QTY_WS.getRawResponse());
 var ship_arr = ship_json.results;
//NEW CODE
var reserveQty =0;
var recevQty =0;
 for(var s =0; s<ship_arr.length; s++)
 {
reserveQty += ship_arr[s].shipped_qty;
recevQty+= ship_arr[s].received_qty;

 }
//flexi.setStatusMessage("shipped qty Sum Value------>"+reserveQty);
flexi.putObject("SHIPPED_QTY_OBJ",reserveQty);
flexi.putObject("RECEIV_QTY_OBJ",recevQty);
}
/*
GET_BAL_QTY_WS.callWebService(null);
if(GET_BAL_QTY_WS.getResponseCode()==200)
{
 var rece_json =(typeof GET_BAL_QTY_WS.getRawResponse() === "string" ? JSON.parse(GET_BAL_QTY_WS.getRawResponse()) : GET_BAL_QTY_WS.getRawResponse());
 var rece_arr = rece_json.results;
//NEW CODE
var recevQty =0;
 for(var k =0; k<rece_arr.length; k++)
 {
recevQty+= rece_arr[k].received_qty;
 }
//flexi.setStatusMessage("received qty Sum Value------>"+recevQty);
flexi.putObject("RECEIV_QTY_OBJ",recevQty);
}
*/
if(flexi.getObject("SHIPPED_QTY_OBJ")!=null &&flexi.getObject("RECEIV_QTY_OBJ")!=null){
var shipp_qty = flexi.getObject("SHIPPED_QTY_OBJ");
 var rece_qty =flexi.getObject("RECEIV_QTY_OBJ");
 var bal_qty = shipp_qty - rece_qty;
 flexi.putObject("BALANCE_QTY",bal_qty);
//flexi.setStatusMessage("Qty--->"+flexi.getObject("BALANCE_QTY"));
var pp =String(flexi.getObject("BALANCE_QTY"));
XX_BAL_QTY_RECV.setValue(pp);
}

/*
//Received LPN's 
GET_REC_LPN_WS.callWebService(null);
    if (GET_REC_LPN_WS.getResponseCode() == 200) {
      var res = (typeof GET_REC_LPN_WS.getRawResponse() === "string" ? JSON.parse(GET_REC_LPN_WS.getRawResponse()) : GET_REC_LPN_WS.getRawResponse());
      var arr = res.results;
      flexi.putObject("LPN_CNT", String(res.result_count));
      //flexi.setStatusMessage("Total Balance LPN--->"+flexi.getObject("LPN_CNT"));
if (flexi.getObject("LPN_CNT") != null) {
        XX_RECEIVED_LPN.setValue(flexi.getObject("LPN_CNT"));
      } else {
        XX_RECEIVED_LPN.setValue("");
      }
}
*/
/*
//TOTAL LPNS FOR SHIPMENT
  GET_LPN_SHIPMENT_WS.callWebService(null);
    if (GET_LPN_SHIPMENT_WS.getResponseCode() == 200) {
      var lpn_res_ship = (typeof GET_LPN_SHIPMENT_WS.getRawResponse() === "string" ? JSON.parse(GET_LPN_SHIPMENT_WS.getRawResponse()) : GET_LPN_SHIPMENT_WS.getRawResponse());
      var lpn_arr_ship = lpn_res_ship.results;
      flexi.putObject("TOT_LPN_SHIP", String(lpn_res_ship.result_count));
      //flexi.setStatusMessage("Total Balance LPN--->"+flexi.getObject("TOT_LPN_SHIP"));
if (flexi.getObject("TOT_LPN_SHIP") != null) {
        XX_TOTAL_LPN_SHIP.setValue(flexi.getObject("TOT_LPN_SHIP"));
      } else {
        XX_TOTAL_LPN_SHIP.setValue("");
      }
}
*/