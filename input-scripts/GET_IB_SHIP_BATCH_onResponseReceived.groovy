// ─── SSH Groovy Script: GET_IB_SHIP_BATCH — _onResponseReceived ───
// Pages 25 of the Personalization Report — deduplication logic

void _onResponseReceived() {
    if (GET_IB_SHIP_BATCH.getResponseCode() == 200) {
        def rawResponse = GET_IB_SHIP_BATCH.getRawResponse();
        def jsonObject = new groovy.json.JsonSlurper().parseText(rawResponse);
        def jsonArray = jsonObject.results;

        ArrayList uniqueList = new ArrayList();
        ArrayList newArray = new ArrayList();

        for (def item : jsonArray) {
            String batchVal = item.batch_nbr.toString();
            if (!uniqueList.contains(batchVal)) {
                uniqueList.add(batchVal);
            }
        }

        for (int k = 0; k < uniqueList.size(); k++) {
            def obj = [batch_nbr: uniqueList.get(k)];
            newArray.add(obj);
        }

        jsonObject.results = newArray;
        jsonObject.result_count = newArray.size();

        GET_IB_SHIP_BATCH.updateRawResponse(groovy.json.JsonOutput.toJson(jsonObject));
    }
}
