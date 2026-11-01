if("Y".equals(flexi.getSessionObject("TXN_COMPLETED"))){
//Call web service to get balance lpn on shipment//
    GET_BAL_LPN_RECV_WS.callWebService(null);
    if (GET_BAL_LPN_RECV_WS.getResponseCode() == 200) {
      JSONObject lpn_res = new JSONObject(GET_BAL_LPN_RECV_WS.getRawResponse());
      JSONArray lpn_arr = lpn_res.getJSONArray("results");
      flexi.putObject("TOT_LPN_CNT", String.valueOf(lpn_res.get("result_count")));
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
      JSONObject lpn_ress = new JSONObject(GET_LPN_REC_WS.getRawResponse());
      JSONArray lpn_arrr = lpn_ress.getJSONArray("results");
      flexi.putObject("RES_LPN_CNT", String.valueOf(lpn_ress.get("result_count")));

//NEW CODE MODIFY 
	  
	  if (flexi.getObject("RES_LPN_CNT") != null) {
        XX_RECEIVED_LPN.setValue(flexi.getObject("RES_LPN_CNT"));
      } else {
        XX_RECEIVED_LPN.setValue("");
      }
      //flexi.setStatusMessage("Received Balance LPN--->"+flexi.getObject("RES_LPN_CNT"));
double total_qty = Double.parseDouble(flexi.getObject("TOT_LPN_CNT"));
 double recei_qty = Double.parseDouble(flexi.getObject("RES_LPN_CNT"));
 //double balance_qty = total_qty - recei_qty;
int balance_qty = total_qty - recei_qty;
 flexi.putObject("BAL_QTY",balance_qty);
String kp=String.valueOf(flexi.getObject("BAL_QTY"));
//int value = (int)kp;
//XX_ORDER_BAL_QTY.setValue(kp);
//flexi.setStatusMessage("Balance qty difference---------->"+flexi.getObject("BAL_QTY"));

      if (flexi.getObject("BAL_QTY") != null) {
        XX_BAL_LPN_RECV.setValue(balance_qty.toString());
      } else {
        XX_BAL_LPN_RECV.setValue("");
      }

}

    }

    //End Web Service call to get balance lpn on shipment

//Call web service to get balance sku to be  received//
 GET_BAL_SKU_REC_WS.callWebService(null);
    if (GET_BAL_SKU_REC_WS.getResponseCode() == 200) {
      ArrayList task_loc_list =new ArrayList();
      JSONObject sku_res = new JSONObject(GET_BAL_SKU_REC_WS.getRawResponse());
      JSONArray sku_arr = sku_res.getJSONArray("results");
      HashSet newHp =new HashSet();
      for(int k =0; k < sku_arr.length(); k++) {
      newHp.add(sku_arr.getJSONObject(k).get("item_id").get("key"));
      logger.trace("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^"+newHp);
   }
 task_loc_list.add(newHp);
int sku_api_cnt =  task_loc_list.size();
logger.trace("**************************"+sku_api_cnt);
XX_BAL_SKU_RECV.setValue(String.valueOf(sku_api_cnt));
XX_TOTAL_SKU_SHIP.setValue(String.valueOf(sku_api_cnt));
     }
//End web service to get balance sku to be  received//

//Call web service to get qty to be  received//
GET_BAL_QTY_WS.callWebService(null);
if(GET_BAL_QTY_WS.getResponseCode()==200)
{
 JSONObject ship_json =new JSONObject(GET_BAL_QTY_WS.getRawResponse());
 JSONArray ship_arr = ship_json.getJSONArray("results");
//NEW CODE
int reserveQty=0;
int recevQty=0;
 for(int s=0; s<ship_arr.length(); s++)
 {
reserveQty += ship_arr.get(s).getInt("shipped_qty");
recevQty+= ship_arr.get(s).getInt("received_qty");

 }
//flexi.setStatusMessage("shipped qty Sum Value------>"+reserveQty);
flexi.putObject("SHIPPED_QTY_OBJ",reserveQty);
flexi.putObject("RECEIV_QTY_OBJ",recevQty);
}
/*
GET_BAL_QTY_WS.callWebService(null);
if(GET_BAL_QTY_WS.getResponseCode()==200)
{
 JSONObject rece_json =new JSONObject(GET_BAL_QTY_WS.getRawResponse());
 JSONArray rece_arr = rece_json.getJSONArray("results");
//NEW CODE
int recevQty=0;
 for(int k=0; k<rece_arr.length(); k++)
 {
recevQty+= rece_arr.get(k).getInt("received_qty");
 }
//flexi.setStatusMessage("received qty Sum Value------>"+recevQty);
flexi.putObject("RECEIV_QTY_OBJ",recevQty);
}
*/
if(flexi.getObject("SHIPPED_QTY_OBJ")!=null &&flexi.getObject("RECEIV_QTY_OBJ")!=null){
int shipp_qty = flexi.getObject("SHIPPED_QTY_OBJ");
 int rece_qty =flexi.getObject("RECEIV_QTY_OBJ");
 int bal_qty = shipp_qty - rece_qty;
 flexi.putObject("BALANCE_QTY",bal_qty);
//flexi.setStatusMessage("Qty--->"+flexi.getObject("BALANCE_QTY"));
String pp=String.valueOf(flexi.getObject("BALANCE_QTY"));
XX_BAL_QTY_RECV.setValue(pp);
}
}
/*
//Received LPN's 
GET_REC_LPN_WS.callWebService(null);
    if (GET_REC_LPN_WS.getResponseCode() == 200) {
      JSONObject res = new JSONObject(GET_REC_LPN_WS.getRawResponse());
      JSONArray arr = res.getJSONArray("results");
      flexi.putObject("LPN_CNT", String.valueOf(res.get("result_count")));
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
      JSONObject lpn_res_ship = new JSONObject(GET_LPN_SHIPMENT_WS.getRawResponse());
      JSONArray lpn_arr_ship = lpn_res_ship.getJSONArray("results");
      flexi.putObject("TOT_LPN_SHIP", String.valueOf(lpn_res_ship.get("result_count")));
      //flexi.setStatusMessage("Total Balance LPN--->"+flexi.getObject("TOT_LPN_SHIP"));
if (flexi.getObject("TOT_LPN_SHIP") != null) {
        XX_TOTAL_LPN_SHIP.setValue(flexi.getObject("TOT_LPN_SHIP"));
      } else {
        XX_TOTAL_LPN_SHIP.setValue("");
      }
}
*/

