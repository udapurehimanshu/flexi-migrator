const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = ['FlexiAPI.html', 'FlexiWebService.html', 'TextInputField.html', 'Page.html'];

for (const f of files) {
  const filePath = path.join(dir, f);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`\n=================== ${f} ===================`);
  
  // Extract method names or signatures from javadoc HTML
  // Typical JavaDoc has: <span class="memberNameLink"><a href="...">methodName</a></span>
  // or <div class="memberSignature"><span class="returnType">...
  // or table summaries
  const matches = [];
  const methodRegex = /<a href="[^"]*#([^"]+)"/g;
  let m;
  const set = new Set();
  while ((m = methodRegex.exec(content)) !== null) {
    if (m[1].includes('(')) {
      set.add(m[1].replace(/%20/g, ' '));
    }
  }
  const arr = Array.from(set);
  console.log(`Found ${arr.length} methods:`);
  console.log(arr.slice(0, 25).join('\n'));
}
