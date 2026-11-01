const fs = require('fs');
const path = require('path');

const xmlPath = path.join(__dirname, 'pwa-migrated-output', 'Personalization_PWA_Import.xml');
const xml = fs.readFileSync(xmlPath, 'utf8');

function decodeHtmlEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'");
}

const regex = /<personalizationDetail>([\s\S]*?)<\/personalizationDetail>/g;
let m;
let count = 0;
let totalScripts = 0;

while ((m = regex.exec(xml)) !== null) {
  count++;
  const jsonStr = decodeHtmlEntities(m[1]);
  const parsed = JSON.parse(jsonStr);
  const pzn = parsed.personalization || {};
  let scriptsInBlock = 0;

  for (const comp of Object.keys(pzn)) {
    for (const prop of Object.keys(pzn[comp])) {
      const val = pzn[comp][prop] ? pzn[comp][prop].personalize_value : null;
      if (typeof val === 'string' && val.trim().startsWith('script:')) {
        scriptsInBlock++;
        totalScripts++;
        const code = val.replace(/^\s*script:\s*/, '');
        new Function(code); // Throws if invalid JS
      }
    }
  }
  console.log(`Block ${count}: OK (${Object.keys(pzn).length} components, ${scriptsInBlock} scripts verified)`);
}

console.log(`\nALL ${count} BLOCKS AND ${totalScripts} SCRIPTS ARE 100% VALID!`);
