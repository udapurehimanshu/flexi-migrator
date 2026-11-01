const fs = require('fs');
const path = require('path');

const samplePath = path.join(__dirname, 'extracted-scripts', '19_Subpage_GET_IB_SHIP_BATCH__onResponseReceived.groovy');
let code = fs.readFileSync(samplePath, 'utf8');

// Replace org.json types
code = code.replace(/new\s+(?:org\.json\.)?JSONObject\s*\(([\s\S]*?\))\)/g, '(typeof $1 === "string" ? JSON.parse($1) : $1)');
code = code.replace(/new\s+(?:org\.json\.)?JSONArray\s*\(\s*\)/g, '[]');
code = code.replace(/\b(?:org\.json\.)?JSONObject\s+(\w+)\s*=/g, 'var $1 =');
code = code.replace(/\b(?:org\.json\.)?JSONArray\s+(\w+)\s*=/g, 'var $1 =');

code = code.replace(/\.getJSONArray\s*\(\s*"([^"]+)"\s*\)/g, '.$1');
code = code.replace(/\.getJSONObject\s*\(\s*([^)]+)\s*\)/g, '[$1]');

// Collections
code = code.replace(/\b(?:ArrayList|List)\s+(\w+)\s*=\s*new\s+ArrayList\s*\(\s*\)\s*;/g, 'var $1 = [];');
code = code.replace(/(\b\w+)\.add\s*\(([^)]+)\)/g, '$1.push($2)');
code = code.replace(/(\b\w+)\.remove\s*\(([^)]+)\)/g, '$1.splice($2, 1)');
code = code.replace(/(\b\w+)\.size\s*\(\s*\)/g, '$1.length');

// .get(i)
code = code.replace(/\.get\s*\(\s*([a-zA-Z0-9_]+)\s*\)/g, '[$1]');
code = code.replace(/\.get\s*\(\s*"([^"]+)"\s*\)/g, '.$1');

// .equals
code = code.replace(/\.equals\s*\(([^)]+)\)/g, ' === $1');

// put
code = code.replace(/(\b\w+)\.put\s*\(\s*([^,]+)\s*\)/g, '$1.push($2)');
code = code.replace(/\.put\s*\(\s*"([^"]+)"\s*,\s*([^)]+)\)/g, '.$1 = $2');

// length()
code = code.replace(/(\b\w+)\.length\s*\(\s*\)/g, '$1.length');

// typed variables
code = code.replace(/\b(int|double|float|long|String|boolean)\s+(\w+)\s*=/g, 'var $2 =');

// updateRawResponse
code = code.replace(/(\w+)\.updateRawResponse\s*\(\s*([\w]+)\.toString\s*\(\s*\)\s*\)\s*;?/g, 
  'if (typeof $1.updateRawResponse === "function") {\n  $1.updateRawResponse(JSON.stringify($2));\n} else if (typeof $1.setResponse === "function") {\n  $1.setResponse(JSON.stringify($2));\n}');

console.log('Resulting JS:\n', code);
// Check if valid JS
try {
  new Function(code);
  console.log('>>> SYNTAX CHECK PASSED!');
} catch (e) {
  console.error('>>> SYNTAX CHECK FAILED:', e.message);
}
