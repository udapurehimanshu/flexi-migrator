const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'pwa-migrated-output', 'Personalization_PWA_Payload.txt');
const file = fs.readFileSync(filePath, 'utf8');

const raw = file.replace(/^personalization=/, '');
const decoded = decodeURIComponent(raw.replace(/\+/g, '%20'));

console.log('--- VERIFICATION OF CONVERTED PWA CODE INSIDE THE PAYLOAD ---');
console.log('Total file size:', (file.length / 1024).toFixed(2), 'KB');
console.log('');
console.log('Check 1: Contains flexi.backToPreviousPage()? ->', decoded.includes('flexi.backToPreviousPage()'));
console.log('Check 2: Any old ctrl+X remaining?          ->', decoded.includes('ctrl'));
console.log('Check 3: Contains JSON.parse(GET_IB_SHIP...)?->', decoded.includes('JSON.parse(GET_IB_SHIP_BATCH.getRawResponse())'));
console.log('Check 4: Any old org.json remaining?        ->', decoded.includes('new org.json'));
console.log('Check 5: Contains textInputable typeof check?->', decoded.includes('typeof textInputable !== "undefined"'));
console.log('Check 6: Contains updateRawResponse(JSON...)?->', decoded.includes('updateRawResponse(JSON.stringify(json))'));
console.log('Check 7: Contains parseFloat(TOT_LPN_CNT)?   ->', decoded.includes('parseFloat(flexi.getObject("TOT_LPN_CNT"))'));
console.log('Check 8: Total <com.intellinum...Personalization> screens:', (decoded.match(/<com\.intellinum\.miaadmin\.objects\.export\.Personalization>/g) || []).length);
