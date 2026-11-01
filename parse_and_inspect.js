const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, 'work', 'raw_export.txt');
let rawContent = fs.readFileSync(rawPath, 'utf8').trim();

if (rawContent.startsWith('personalization=')) {
  rawContent = rawContent.slice('personalization='.length);
}

// Decode URL encoding (application/x-www-form-urlencoded: + is space, %2B is +)
let decodedXml = decodeURIComponent(rawContent.replace(/\+/g, '%20'));

// Helper to decode HTML entities
function decodeHtmlEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'");
}

// Regex to match each Personalization block
const pznRegex = /<com\.intellinum\.miaadmin\.objects\.export\.Personalization>([\s\S]*?)<\/com\.intellinum\.miaadmin\.objects\.export\.Personalization>/g;
let match;
let count = 0;
const scripts = [];

while ((match = pznRegex.exec(decodedXml)) !== null) {
  count++;
  const block = match[1];
  const appMatch = block.match(/<applicationName>(.*?)<\/applicationName>/);
  const pageMatch = block.match(/<pageName>(.*?)<\/pageName>/);
  const detailMatch = block.match(/<personalizationDetail>([\s\S]*?)<\/personalizationDetail>/);

  const appName = appMatch ? appMatch[1] : 'Unknown';
  const pageName = pageMatch ? pageMatch[1] : 'Unknown';

  if (!detailMatch) continue;

  const rawDetail = detailMatch[1];
  const decodedJsonStr = decodeHtmlEntities(rawDetail);
  
  let pznData;
  try {
    pznData = JSON.parse(decodedJsonStr);
  } catch (err) {
    console.error(`Error parsing JSON for page "${pageName}":`, err.message);
    continue;
  }

  const pznObj = pznData.personalization || {};
  for (const compName of Object.keys(pznObj)) {
    const compProps = pznObj[compName];
    if (typeof compProps !== 'object' || !compProps) continue;

    for (const propName of Object.keys(compProps)) {
      const propObj = compProps[propName];
      if (propObj && typeof propObj === 'object' && propObj.personalize_value) {
        const val = propObj.personalize_value;
        if (typeof val === 'string' && val.trim().startsWith('script:')) {
          scripts.push({
            pageIndex: count,
            pageName,
            compName,
            propName,
            scriptBody: val.replace(/^\s*script:\s*/, '')
          });
        }
      }
    }
  }
}

console.log(`Found ${count} Personalization page(s). Total scripts found: ${scripts.length}\n`);
scripts.forEach((s, i) => {
  console.log(`--- [Script ${i + 1}] Page: "${s.pageName}" | Component: "${s.compName}" | Event: "${s.propName}" ---`);
  console.log(`Length: ${s.scriptBody.length} chars`);
  console.log(s.scriptBody.slice(0, 150) + (s.scriptBody.length > 150 ? '...' : ''));
  console.log('\n');
});
