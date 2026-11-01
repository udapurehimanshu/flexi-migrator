// ─────────────────────────────────────────────────────────────
//  FLEXI PWA MIGRATED SCRIPT
//  Source file : GET_IB_SHIP_BATCH_onResponseReceived.groovy
//  Migrated at : 2026-10-30T06:43:47.549Z
//  Changes     : 12 rule(s) applied
// ─────────────────────────────────────────────────────────────
//  CHANGES APPLIED:
//    1. Replaced Groovy JsonSlurper.parseText() with JSON.parse()
//    2. Replaced Groovy JsonOutput.toJson() with JSON.stringify()
//    3. Added setResponse fallback for updateRawResponse calls
//    4. Replaced Java ArrayList declaration with JS Array var
//    5. Replaced Java typed variable declarations with JS var
//    6. Converted Java for-each loop to JS for loop
//    7. Replaced Java .contains() with JS .indexOf() !== -1
//    8. Replaced Java List.add() with JS Array.push()
//    9. Replaced Java .size() with JS .length
//    10. Replaced Java List.get(i) with JS array[i]
//    11. Replaced Java .toString() with JS String()
//    12. Replaced Groovy def with JS var
// ─────────────────────────────────────────────────────────────
// ─── SSH Groovy Script: GET_IB_SHIP_BATCH — _onResponseReceived ───
// Pages 25 of the Personalization Report — deduplication logic

void _onResponseReceived() {
    if (GET_IB_SHIP_BATCH.getResponseCode() == 200) {
        var rawResponse = GET_IB_SHIP_BATCH.getRawResponse();
        var jsonObject = (typeof rawResponse === "string" ? JSON.parse(rawResponse) : rawResponse);
        var jsonArray = jsonObject.results;

        var uniqueList = []; /* PWA: Java ArrayList → JS Array */
        var newArray = []; /* PWA: Java ArrayList → JS Array */

        for (var _i = 0; _i < jsonArray.length; _i++) { var item = jsonArray[_i];
            var batchVal /* was: String */ = String(item.batch_nbr) /* was: .toString() */;
            if (!(uniqueList.indexOf(batchVal) !== -1) /* was: uniqueList.contains(batchVal) */) {
                uniqueList.push(batchVal) /* was: uniqueList.add(batchVal) */;
            }
        }

        for (var k /* was: int */ = 0; k < uniqueList.length /* was: uniqueList.size() */; k++) {
            var obj = [batch_nbr: uniqueList[k] /* was: uniqueList.get(k) */];
            newArray.push(obj) /* was: newArray.add(obj) */;
        }

        jsonObject.results = newArray;
        jsonObject.result_count = newArray.length /* was: newArray.size() */;

        if (typeof GET_IB_SHIP_BATCH.updateRawResponse === "function") {
        GET_IB_SHIP_BATCH.updateRawResponse(JSON.stringify(jsonObject));
      } else if (typeof GET_IB_SHIP_BATCH.setResponse === "function") {
        GET_IB_SHIP_BATCH.setResponse(JSON.stringify(jsonObject));
      }
    }
}
