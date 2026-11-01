const fs = require('fs');
const path = require('path');

// Read all 4 JavaDoc files and extract FULL method detail (name, return type, params, description)
function extractFullMethods(fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) return [];
  const html = fs.readFileSync(filePath, 'utf8');

  const methods = [];
  // Match detail sections: <a name="methodName-..."> ... <h4>name</h4> <pre>returnType methodName(params)</pre> optional <div class="block">desc</div>
  const detailRegex = /<a name="([^"]+)">[\s\S]*?<h4>(\w+)<\/h4>\s*<pre>([\s\S]*?)<\/pre>(?:[\s\S]*?<div class="block">([\s\S]*?)<\/div>)?/g;
  let m;
  while ((m = detailRegex.exec(html)) !== null) {
    const anchor = m[1];
    const name = m[2];
    const sigRaw = m[3].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim().replace(/\s+/g, ' ');
    const desc = m[4] ? m[4].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().replace(/\s+/g, ' ') : '';
    if (anchor.includes('-')) { // skip field/constructor noise
      methods.push({ name, signature: sigRaw, description: desc });
    }
  }
  return methods;
}

const result = {
  FlexiAPI: extractFullMethods('FlexiAPI.html'),
  FlexiWebService: extractFullMethods('FlexiWebService.html'),
  TextInputField: extractFullMethods('TextInputField.html'),
  Page: extractFullMethods('Page.html')
};

fs.writeFileSync(path.join(__dirname, 'intellinum_full_methods.json'), JSON.stringify(result, null, 2));

// Print a focused reference sheet
console.log('\n===== FlexiAPI (flexi.*) ALL METHODS =====');
result.FlexiAPI.forEach(m => {
  console.log(`  ${m.signature}${m.description ? '\n    >> ' + m.description : ''}`);
});

console.log('\n===== FlexiWebService RESPONSE/REQUEST METHODS =====');
result.FlexiWebService.filter(m =>
  /(response|request|raw|call|update|set|get)/i.test(m.name)
).forEach(m => {
  console.log(`  ${m.signature}${m.description ? '\n    >> ' + m.description : ''}`);
});

console.log('\n===== TextInputField METHODS =====');
result.TextInputField.forEach(m => {
  console.log(`  ${m.signature}${m.description ? '\n    >> ' + m.description : ''}`);
});
