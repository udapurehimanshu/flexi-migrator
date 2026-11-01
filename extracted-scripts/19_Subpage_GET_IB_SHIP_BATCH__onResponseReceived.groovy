if(GET_IB_SHIP_BATCH.getResponseCode() ==200){   //==============

org.json.JSONObject json = new org.json.JSONObject(GET_IB_SHIP_BATCH.getRawResponse());
org.json.JSONArray jsonArray = json.getJSONArray("results");
JSONArray newArray = new JSONArray();
ArrayList list = new ArrayList();
ArrayList list1 = new ArrayList();
for(int i = 0; i < jsonArray.length(); i++)
{
 // list.add(jsonArray.getJSONObject(i).get("item_id").get("key"));
  list.add(jsonArray.getJSONObject(i).get("batch_nbr"));
}
for(int i=0; i<list.size();i++)
{
  for(int j=i+1;j<list.size();j++)
  {
    if(list.get(i).equals(list.get(j)))
    {
      list.remove(j);
      j--;
    }
  }
}
for(int i=0;i<list.size();i++)
{
  list1.add(list.get(i));
}
for(int i=0;i<list1.size();i++)
{
  jsonArray.getJSONObject(i).put("batch_nbr",list1.get(i));
  newArray.put(jsonArray.getJSONObject(i));
}
 
json.put("results",newArray);
json.put("result_count",newArray.length());
 
GET_IB_SHIP_BATCH.updateRawResponse(json.toString());
}
