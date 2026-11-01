const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, 'work', 'raw_export.txt');
let rawContent = fs.readFileSync(rawPath, 'utf8').trim();

if (rawContent.startsWith('personalization=')) {
  rawContent = rawContent.slice('personalization='.length);
}

let decodedXml = decodeURIComponent(rawContent.replace(/\+/g, '%20'));

function decodeHtmlEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'");
}

const outDir = path.join(__dirname, 'extracted-scripts');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const pznRegex = /<com\.intellinum\.miaadmin\.objects\.export\.Personalization>([\s\S]*?)<\/com\.intellinum\.miaadmin\.objects\.export\.Personalization>/g;
let match;
let sIdx = 0;

while ((match = pznRegex.exec(decodedXml)) !== null) {
  const block = match[1];
  const pageMatch = block.match(/<pageName>(.*?)<\/pageName>/);
  const detailMatch = block.match(/<personalizationDetail>([\s\S]*?)<\/personalizationDetail>/);

  const rawPageName = pageMatch ? pageMatch[1] : 'Unknown';
  const cleanPageName = (rawPageName.trim() === '' ? 'Subpage' : rawPageName).replace(/[^a-zA-Z0-9_-]/g, '_');

  if (!detailMatch) continue;

  const pznData = JSON.parse(decodeHtmlEntities(detailMatch[1]));
  const pznObj = pznData.personalization || {};

  for (const compName of Object.keys(pznObj)) {
    const compProps = pznObj[compName];
    if (typeof compProps !== 'object' || !compProps) continue;

    for (const propName of Object.keys(compProps)) {
      const propObj = compProps[propName];
      if (propObj && propObj.personalize_value && typeof propObj.personalize_value === 'string' && propObj.personalize_value.trim().startsWith('script:')) {
        sIdx++;
        const safeComp = (compName === '-1' ? 'PAGE' : compName).replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${String(sIdx).padStart(2, '0')}_${cleanPageName}_${safeComp}_${propName}.groovy`;
        const code = propObj.personalize_value.replace(/^\s*script:\s*/, '');
        fs.writeFileSync(path.join(outDir, filename), code, 'utf8');
      }
    }
  }
}

console.log(`Extracted ${sIdx} scripts to ${outDir}`);
