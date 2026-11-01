const fs = require('fs');
const path = require('path');
const { extractPdfLines } = require('./pure_pdf_parser.js');

const VALUE_X = 216.0;

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

function parsePdfUsingCoordinates(pdfBuffer, fileName) {
  const lines = extractPdfLines(pdfBuffer);
  const screens = [];
  let currentScreen = null;
  let mode = null;
  let curField = null;
  let curProp = null;

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const t = ln.text.trim();
    if (!t) continue;

    if (t.startsWith('<< Start Personalization')) {
      currentScreen = {
        applicationName: '',
        pageName: '',
        level: 'Site',
        value: 'Global',
        newFields: [],
        pageProps: {},
        fields: {}
      };
      screens.push(currentScreen);
      mode = 'head';
      curField = null;
      curProp = null;
      continue;
    }

    if (!currentScreen || t.startsWith('<< End Personalization')) {
      mode = null;
      curProp = null;
      continue;
    }

    if (t === 'FLEXI PERSONALIZATION REPORT') continue;

    // Head section
    if (mode === 'head') {
      if (t.startsWith('Application Name:')) {
        currentScreen.applicationName = t.replace('Application Name:', '').trim();
        continue;
      }
      if (t.startsWith('Page Name:')) {
        currentScreen.pageName = t.replace('Page Name:', '').trim();
        continue;
      }
      if (t.startsWith('Personalization Level :') || t.startsWith('Personalization Level:')) {
        currentScreen.level = t.split(':')[1].trim();
        continue;
      }
      if (t.startsWith('Personalization Value :') || t.startsWith('Personalization Value:')) {
        currentScreen.value = t.split(':')[1].trim();
        continue;
      }
    }

    // Section headers
    if (t === 'New Fields') {
      mode = 'newfields';
      curField = null;
      curProp = null;
      continue;
    }
    if (t === 'Page Level Properties') {
      mode = 'page';
      curField = '-1';
      curProp = null;
      continue;
    }
    if (t === 'Field Level Properties') {
      mode = 'await_field';
      curProp = null;
      continue;
    }
    if (t === 'Barcode Level Properties') {
      mode = 'barcode';
      curProp = null;
      continue;
    }

    if (t.startsWith('Field Name:')) {
      curField = t.replace('Field Name:', '').trim();
      mode = 'field';
      curProp = null;
      currentScreen.fields[curField] = currentScreen.fields[curField] || {};
      continue;
    }

    if (t.replace(/\s+/g, '') === 'FieldNameTypePosition' || t.replace(/\s+/g, '') === 'PropertyNamePropertyValue') {
      continue;
    }

    // New Fields rows
    if (mode === 'newfields') {
      const match = t.match(/^([A-Za-z0-9_]+)(Text|Web Service|Button|Label|Custom|LOV)(.*)$/);
      if (match) {
        currentScreen.newFields.push({
          name: match[1],
          type: match[2],
          position: match[3]
        });
      }
      continue;
    }

    // Properties: split into Col 1 (x < 216) and Col 2 (x >= 216)
    if (mode === 'page' || mode === 'field') {
      const col1Chars = ln.items.filter(it => it.x < VALUE_X).map(it => it.text).join('').trim();
      const col2Chars = ln.items.filter(it => it.x >= VALUE_X - 1).map(it => it.text).join('');

      const store = mode === 'page' ? currentScreen.pageProps : (currentScreen.fields[curField] || {});

      if (col1Chars) {
        curProp = col1Chars;
        store[curProp] = [col2Chars];
      } else if (curProp && store[curProp]) {
        store[curProp].push(col2Chars);
      }
    }
  }

  // Join wrapped values using stitchScriptLines
  screens.forEach(s => {
    // Page props
    for (const k of Object.keys(s.pageProps)) {
      s.pageProps[k] = stitchScriptLines(s.pageProps[k]);
    }
    // Field props
    for (const f of Object.keys(s.fields)) {
      for (const k of Object.keys(s.fields[f])) {
        s.fields[f][k] = stitchScriptLines(s.fields[f][k]);
      }
    }
  });

  return screens;
}

// ----------------- Translation -----------------
function maskCode(code) {
  const strings = [];
  const comments = [];
  const out = [];
  let i = 0;
  const n = code.length;

  while (i < n) {
    if (code.startsWith('//', i)) {
      let j = code.indexOf('\n', i);
      if (j < 0) j = n;
      comments.push(code.slice(i, j));
      out.push(`\x02C${comments.length - 1}\x02`);
      i = j;
    } else if (code.startsWith('/*', i)) {
      let j = code.indexOf('*/', i + 2);
      if (j < 0) j = n;
      else j += 2;
      comments.push(code.slice(i, j));
      out.push(`\x02C${comments.length - 1}\x02`);
      i = j;
    } else if (code[i] === '"' || code[i] === "'") {
      const q = code[i];
      let j = i + 1;
      while (j < n && code[j] !== q) {
        if (code[j] === '\\') j += 2;
        else j += 1;
      }
      j = Math.min(j + 1, n);
      strings.push(code.slice(i, j));
      out.push(`\x01S${strings.length - 1}\x01`);
      i = j;
    } else {
      out.push(code[i]);
      i++;
    }
  }

  return { masked: out.join(''), strings, comments };
}

function unmaskCode(code, strings, comments) {
  let res = code;
  for (let pass = 0; pass < 3; pass++) {
    res = res.replace(/\x01S(\d+)\x01/g, (m, id) => strings[parseInt(id, 10)]);
    res = res.replace(/\x02C(\d+)\x02/g, (m, id) => comments[parseInt(id, 10)]);
  }
  return res;
}

function findBalancedParen(code, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < code.length; i++) {
    if (code[i] === '(') depth++;
    else if (code[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function subCall(code, rxPattern, replFn) {
  let pos = 0;
  let cur = code;
  while (true) {
    const rx = new RegExp(rxPattern);
    const m = rx.exec(cur.slice(pos));
    if (!m) return cur;
    const matchStart = pos + m.index;
    const matchEnd = matchStart + m[0].length;
    const openParen = matchEnd - 1;
    const closeParen = findBalancedParen(cur, openParen);
    if (closeParen < 0) {
      pos = matchEnd;
      continue;
    }
    const innerArgs = cur.slice(openParen + 1, closeParen);
    const replacement = replFn(m, innerArgs);
    cur = cur.slice(0, matchStart) + replacement + cur.slice(closeParen + 1);
    pos = matchStart + replacement.length;
  }
}

function getStringVal(strings, placeholder) {
  const m = placeholder.trim().match(/^\x01S(\d+)\x01$/);
  if (!m) return null;
  const raw = strings[parseInt(m[1], 10)];
  return raw.slice(1, -1);
}

function translateScriptToPwaJs(sourceCode) {
  let src = (sourceCode || '').trim();
  if (src.startsWith('script:')) src = src.slice(7).trim();

  const { masked, strings, comments } = maskCode(src);
  let code = masked;
  const appliedRules = [];

  // Remove java / groovy imports
  code = code.replace(/^[ \t]*import\s+(?:java|groovy)\..+;?[ \t]*$/gm, '');

  // Strip org.json. and java.util.
  code = code.replace(/\b(?:org\.json|java\.util)\./g, '');

  const colls = new Set();
  const jsons = new Set();

  // Collection declarations
  code = code.replace(/\b(ArrayList|HashSet|LinkedList|List|Set|HashMap|Map|TreeMap)\s*(?:<[^>;]*>)?\s+(\w+)\s*=\s*new\s+\w+\s*(?:<[^>;]*>)?\s*\(\s*\);?/g, (m, type, varName) => {
    colls.add(varName);
    appliedRules.push(`Collection declaration: ${varName}`);
    return `var ${varName} = ${type.includes('Map') ? '{}' : '[]'};`;
  });

  // Track JSONObject / JSONArray
  const jsonDeclRx = /\b(?:JSONObject|JSONArray)\s+(\w+)\s*=/g;
  let jdMatch;
  while ((jdMatch = jsonDeclRx.exec(code)) !== null) {
    jsons.add(jdMatch[1]);
  }

  // new JSONObject(x) / new JSONArray(x)
  code = subCall(code, '\\bnew\\s+(JSONObject|JSONArray)\\s*\\(', (m, args) => {
    const a = args.trim();
    appliedRules.push(`JSON instantiation: ${m[1]}`);
    if (!a) return m[1].includes('Object') ? '{}' : '[]';
    return `(typeof ${a} === "string" ? JSON.parse(${a}) : ${a})`;
  });

  // Standalone new ArrayList() / new HashSet() / new HashMap()
  code = code.replace(/\bnew\s+(?:ArrayList|HashSet|LinkedList|List|Set)\s*(?:<[^>;]*>)?\s*\(\s*\)/g, '[]');
  code = code.replace(/\bnew\s+(?:HashMap|Map|TreeMap)\s*(?:<[^>;]*>)?\s*\(\s*\)/g, '{}');

  // .equals() handling
  code = subCall(code, '(\\x01S\\d+\\x01)\\s*\\.equals\\(', (m, args) => {
    appliedRules.push('Literal string equality ===');
    return `(${args.trim()} === ${m[1]})`;
  });
  for (let pass = 0; pass < 3; pass++) {
    code = subCall(code, '([\\w$]+(?:\\.[\\w$]+|\\[[^\\]\\[]*\\]|\\([^()]*\\))*)\\.equals\\(', (m, args) => {
      appliedRules.push('Strict equality ===');
      return `(${m[1]} === ${args.trim()})`;
    });
  }

  // Static helpers
  code = code.replace(/\bDouble\.(?:parseDouble|valueOf)\s*\(([^)]+)\)/g, 'parseFloat($1)');
  code = code.replace(/\bInteger\.(?:parseInt|valueOf)\s*\(([^)]+)\)/g, 'parseInt($1, 10)');
  code = code.replace(/\bString\.valueOf\s*\(([^)]+)\)/g, 'String($1)');
  code = code.replace(/\bnew\s+(?:Double|Integer|Long|Float)\s*\(([^)]+)\)/g, 'Number($1)');
  code = code.replace(/\bBigDecimal\.valueOf\s*\(([^)]+)\)/g, 'Number($1)');
  code = code.replace(/\bnew\s+BigDecimal\s*\(([^)]+)\)/g, 'Number($1)');

  // Typed getters
  function numGetter(fn) {
    return (m, chain, strToken) => {
      appliedRules.push(`Typed getter ${fn}`);
      const name = getStringVal(strings, strToken);
      const acc = name && /^[A-Za-z_]\w*$/.test(name) ? `.${name}` : `[${strToken}]`;
      return `(${fn}(${chain}${acc}) || 0)`;
    };
  }

  code = code.replace(/([\w$]+(?:\.[\w$]+|\[[^\]\[]*\]|\([^()]*\))*)\.getInt\s*\(\s*(\x01S\d+\x01)\s*\)/g, numGetter('Number'));
  code = code.replace(/([\w$]+(?:\.[\w$]+|\[[^\]\[]*\]|\([^()]*\))*)\.getLong\s*\(\s*(\x01S\d+\x01)\s*\)/g, numGetter('Number'));
  code = code.replace(/([\w$]+(?:\.[\w$]+|\[[^\]\[]*\]|\([^()]*\))*)\.getDouble\s*\(\s*(\x01S\d+\x01)\s*\)/g, numGetter('parseFloat'));

  function propAccessor(m, strToken) {
    const name = getStringVal(strings, strToken);
    return name && /^[A-Za-z_]\w*$/.test(name) ? `.${name}` : `[${strToken}]`;
  }

  code = code.replace(/\.getString\s*\(\s*(\x01S\d+\x01)\s*\)/g, propAccessor);
  code = code.replace(/\.(?:getJSONArray|getJSONObject|opt|optString|optJSONArray|optJSONObject)\s*\(\s*(\x01S\d+\x01)\s*\)/g, propAccessor);
  code = code.replace(/\.getJSONObject\s*\(\s*([^()]+)\s*\)/g, '[$1]');
  code = code.replace(/\.getJSONArray\s*\(\s*([^()]+)\s*\)/g, '[$1]');
  code = code.replace(/\.get\s*\(\s*(\x01S\d+\x01)\s*\)/g, propAccessor);
  code = code.replace(/\.get\s*\(\s*([^()]+)\s*\)/g, '[$1]');

  // JSON put
  code = code.replace(/\.put\s*\(\s*(\x01S\d+\x01)\s*,\s*([^;]+?)\)\s*;/g, (m, strToken, val) => {
    const name = getStringVal(strings, strToken);
    appliedRules.push(`JSON property put`);
    return name && /^[A-Za-z_]\w*$/.test(name) ? `.${name} = ${val};` : `[${strToken}] = ${val};`;
  });
  code = code.replace(/\.put\s*\(\s*([^,;]*)\)\s*;/g, '.push($1);');

  // Collections operations
  colls.forEach(name => {
    const reAdd = new RegExp(`\\b${name}\\.add\\s*\\(`, 'g');
    code = code.replace(reAdd, `${name}.push(`);
    const reSize = new RegExp(`\\b${name}\\.size\\s*\\(\\s*\\)`, 'g');
    code = code.replace(reSize, `${name}.length`);
    const reRem = new RegExp(`\\b${name}\\.remove\\s*\\(([^()]*)\\)`, 'g');
    code = code.replace(reRem, `${name}.splice($1, 1)`);
  });

  code = code.replace(/\.length\(\)/g, '.length');
  code = code.replace(/\.size\(\)/g, '.length');
  code = code.replace(/\.isEmpty\(\)/g, '.length === 0');
  code = code.replace(/\.contains\s*\(([^()]*)\)/g, '.indexOf($1) !== -1');

  // toString()
  code = code.replace(/([\w$]+(?:\.[\w$]+|\[[^\]\[]*\]|\([^()]*\))*)\.toString\s*\(\s*\)/g, (m, chain) => {
    if (jsons.has(chain)) return `JSON.stringify(${chain})`;
    return `String(${chain})`;
  });

  // Type declarations -> var
  code = code.replace(/\b(?:final\s+)?(?:int|long|double|float|short|boolean|String|Integer|Double|Long|Boolean|Object|JSONObject|JSONArray|BigDecimal|ArrayList|List|Set|HashSet|Map|HashMap)\s+(?=[A-Za-z_]\w*\s*(?:=|;|,|\)))/g, 'var ');
  code = code.replace(/\bdef\b\s+(\w+)/g, 'var $1');
  code = code.replace(/\bcatch\s*\(\s*[\w.]+\s+(\w+)\s*\)/g, 'catch ($1)');

  // != void and == void
  code = code.replace(/\b(\w+)\s*(!=|==)\s*void\b/g, (m, varName, op) => {
    appliedRules.push(`Void check ${op} void`);
    return op === '!='
      ? `(typeof ${varName} !== "undefined" && ${varName} !== null)`
      : `(typeof ${varName} === "undefined" || ${varName} === null)`;
  });

  // Logger statements -> comment out
  code = code.replace(/^([ \t]*)(logger\.\w+\(.*?\);?)[ \t]*$/gm, '$1// $2');

  // Terminal keystroke: flexi.automate("ctrl", "X") -> flexi.backToPreviousPage()
  code = code.replace(/flexi\.automate\s*\(\s*(\x01S\d+\x01)\s*,\s*(\x01S\d+\x01)\s*\);?/g, (m, s1, s2) => {
    const v1 = (getStringVal(strings, s1) || '').toLowerCase();
    const v2 = (getStringVal(strings, s2) || '').toUpperCase();
    if (v1 === 'ctrl' && v2 === 'X') {
      appliedRules.push('Ctrl+X navigation -> flexi.backToPreviousPage()');
      return 'flexi.backToPreviousPage();';
    }
    return m;
  });

  // Restore strings and comments
  let out = unmaskCode(code, strings, comments);

  // AST Validation
  let isValid = true;
  let syntaxError = null;
  try {
    new Function(out);
  } catch (err) {
    isValid = false;
    syntaxError = err.message;
  }

  return {
    code: out,
    appliedRules: Array.from(new Set(appliedRules)),
    isValid,
    syntaxError
  };
}

module.exports = {
  stitchScriptLines,
  parsePdfUsingCoordinates,
  translateScriptToPwaJs
};

if (require.main === module) {
  // Test against all 8 files
  const folder = path.join(__dirname, 'IMS PERSONALIZATION DPW');
  const files = fs.readdirSync(folder).filter(f => f.endsWith('.pdf'));

  console.log('Testing Enhanced Coordinate Parser + PWA Translation:');
  files.forEach(f => {
    const buf = fs.readFileSync(path.join(folder, f));
    const screens = parsePdfUsingCoordinates(buf, f);
    let total = 0, valid = 0;
    screens.forEach(s => {
      // page props
      for (const p of Object.keys(s.pageProps)) {
        if (s.pageProps[p].startsWith('script:')) {
          total++;
          const res = translateScriptToPwaJs(s.pageProps[p]);
          if (res.isValid) valid++;
          else console.log(`  [AST NOTICE] ${f} Page.${p}: ${res.syntaxError}`);
        }
      }
      // field props
      for (const fld of Object.keys(s.fields)) {
        for (const p of Object.keys(s.fields[fld])) {
          if (s.fields[fld][p].startsWith('script:')) {
            total++;
            const res = translateScriptToPwaJs(s.fields[fld][p]);
            if (res.isValid) valid++;
            else console.log(`  [AST NOTICE] ${f} ${fld}.${p}: ${res.syntaxError}`);
          }
        }
      }
    });
    console.log(`  ${f}: ${valid} of ${total} scripts valid`);
  });
}
