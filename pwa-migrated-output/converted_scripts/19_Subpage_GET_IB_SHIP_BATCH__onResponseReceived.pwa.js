/**
 * Page:  
 * Component: GET_IB_SHIP_BATCH
 * Event: _onResponseReceived
 */

if(GET_IB_SHIP_BATCH.getResponseCode() ==200){   //==============

var json = (typeof GET_IB_SHIP_BATCH.getRawResponse() === "string" ? JSON.parse(GET_IB_SHIP_BATCH.getRawResponse()) : GET_IB_SHIP_BATCH.getRawResponse());
var jsonArray = json.results;
var newArray = [];
var list = [];
var list1 = [];
for(var i = 0; i < jsonArray.length; i++)
{
 // list.push(jsonArray[i].item_id.get("key"));
  list.push(jsonArray[i].batch_nbr);
}
for(var i =0; i<list.length;i++)
{
  for(var j =i+1;j<list.length;j++)
  {
    if(list[i] === list[j])
    {
      list.splice(j, 1);
      j--;
    }
  }
}
for(var i =0;i<list.length;i++)
{
  list1.push(list[i]);
}
for(var i =0;i<list1.length;i++)
{
  jsonArray[i].batch_nbr = list1[i];
  newArray.push(jsonArray[i]);
}
 
json.results = newArray;
json.result_count = newArray.length;
 
GET_IB_SHIP_BATCH.updateRawResponse(JSON.stringify(json));
}
