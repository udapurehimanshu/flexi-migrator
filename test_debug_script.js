function stitchScriptLines(rawLines) {
  const result = [];
  
  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i].trimEnd();
    if (!line) continue;

    if (result.length === 0) {
      result.push(line);
      continue;
    }

    const prevIdx = result.length - 1;
    const prev = result[prevIdx].trim();
    const cur = line.trim();

    // If current line is a comment, it MUST be a new line (unless part of previous hyphenated comment)
    if (cur.startsWith('//') || cur.startsWith('/*')) {
      result.push(line);
      continue;
    }

    // If previous line was a comment, NEVER append code or brackets to it!
    if (prev.startsWith('//') || prev.startsWith('/*')) {
      if (prev.endsWith('-') || cur.startsWith('>') || cur.startsWith('+')) {
        result[prevIdx] = result[prevIdx] + (prev.endsWith('-') ? '' : ' ') + cur;
      } else {
        result.push(line);
      }
      continue;
    }

    // Hanging operators or closers at start of current line: e.g. "());", ");", "));", ";", "+...", ".getValue()"
    if (/^(\)+;?|\}+;?|\]+;?|;|\+|-|\.|\/|\*|==|!=|>|<|&&|\|\|)/.test(cur) && !cur.startsWith('//')) {
      result[prevIdx] = result[prevIdx] + (cur.startsWith('.') || cur.startsWith(')') || cur.startsWith(';') ? '' : ' ') + cur;
      continue;
    }

    // Hanging callers: e.g. "());"
    if (/^\(\);?/.test(cur)) {
      result[prevIdx] = result[prevIdx] + cur;
      continue;
    }

    // Hanging openers or operators at end of previous line: e.g. ends with ".", "+", "(", "[", "=", etc.
    if (/[+\-*/=><.,:(]$/.test(prev)) {
      result[prevIdx] = result[prevIdx] + (prev.endsWith('.') || prev.endsWith('(') ? '' : ' ') + cur;
      continue;
    }

    // Broken identifier across lines (e.g. "XX_DROP_FIE" followed by "LD..." or "getVa" followed by "lue()")
    if (/[A-Za-z0-9_]$/.test(prev) && /^[A-Za-z0-9_]+[().]/.test(cur) && !prev.endsWith(';') && !prev.endsWith('{') && !prev.endsWith('}')) {
      const lastWord = prev.match(/([A-Za-z0-9_]+)$/)?.[1] || '';
      if (lastWord.length > 2 && !['var', 'return', 'else', 'new', 'if'].includes(lastWord)) {
        result[prevIdx] = result[prevIdx] + cur;
        continue;
      }
    }

    // Default: new line
    result.push(line);
  }

  return result.join('\r\n');
}

const fs = require('fs');
const path = require('path');
const { extractPdfLines } = require('./pure_pdf_parser.js');

const fileContent = fs.readFileSync('test_coordinate_parser.js', 'utf8');
const fnCode = fileContent.slice(fileContent.indexOf('function maskCode'), fileContent.indexOf('// Test against all 8 files'));
eval(fnCode);

const buf = fs.readFileSync(path.join(__dirname, 'IMS PERSONALIZATION DPW', 'STD - Assign LPNPLT to 0B Report_Personalization.pdf'));
const lines = extractPdfLines(buf);
const raw = lines.slice(38, 64).map(l => l.items.filter(it => it.x >= 216 - 1).map(it => it.text).join(''));
const stitched = stitchScriptLines(raw);
const res = translateScriptToPwaJs(stitched);

console.log('--- TRANSLATED JS ---');
console.log(res.code);
console.log('\nValid AST:', res.isValid, 'Error:', res.syntaxError);
