const fs = require('fs');
const fileB = 'flexi-migrator/claude-files-1/Personalization_PWA_Payload_GENERATED.txt';
const decode = (f) => decodeURIComponent(fs.readFileSync(f, 'utf8').replace(/^personalization=/, '').replace(/\+/g, '%20'));
const xmlB = decode(fileB);

const idx = xmlB.indexOf('GET_IB_SHIP_BATCH');
const jsonPart = xmlB.slice(idx, idx + 1800);
console.log(jsonPart.replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
