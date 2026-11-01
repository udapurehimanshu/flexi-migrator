/**
 * =============================================================================
 * Intellinum Flexi Personalization PDF Report Parser
 * Dynamic, Coordinate-Based Structural Parser for Flexi PDF Reports
 * Zero Hardcoding • Production PWA Compliant • Single-File Session Isolated
 * =============================================================================
 */

const { extractPdfLines } = require('./pure_pdf_parser.js');

const VALUE_X = 216.0;

const KNOWN_PROPERTIES = [
  '_afterClick',
  '_afterFocus',
  '_afterPageEntered',
  '_beforeCallingRequest',
  '_beforeExit',
  '_beforePageExited',
  '_columnDisplay',
  '_columnPrompt',
  '_columnmap',
  '_contentType',
  '_dateFormat',
  '_defaultValue',
  '_description',
  '_inputParameter',
  '_lovPageTitle',
  '_lovSourceType',
  '_lovStatement',
  '_lovValidation',
  '_onCallingRequest',
  '_onKeyPress',
  '_onResponseReceived',
  '_operationType',
  '_parameterTypes',
  '_passWS',
  '_readOnly',
  '_rendered',
  '_userWS',
  '_webService',
  '_wsurl',
  'label',
  'lovEnabled'
];

function hasOddQuotes(str) {
  let dQuotes = 0;
  let sQuotes = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '"' && (i === 0 || str[i - 1] !== '\\')) dQuotes++;
    if (str[i] === "'" && (i === 0 || str[i - 1] !== '\\')) sQuotes++;
  }
  return (dQuotes % 2 !== 0) || (sQuotes % 2 !== 0);
}

function isPlainCommentContinuation(str) {
  const s = str.trim();
  if (/^[A-Za-z0-9_\s\-.,'"]+$/.test(s) && !/[;{}=()<>]/.test(s)) {
    return true;
  }
  return false;
}

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

    // 1. If previous line has an unclosed string literal, current line MUST continue it
    if (hasOddQuotes(prev)) {
      result[prevIdx] = result[prevIdx] + cur;
      continue;
    }

    // 2. If current line is an explicit new comment
    if (cur.startsWith('//') || cur.startsWith('/*')) {
      result.push(line);
      continue;
    }

    // 3. If previous line was a comment
    if (prev.startsWith('//') || prev.startsWith('/*')) {
      if (prev.endsWith('-') || prev.endsWith('+') || cur.startsWith('>') || cur.startsWith('+') || isPlainCommentContinuation(cur)) {
        result[prevIdx] = result[prevIdx] + (prev.endsWith('-') ? '' : ' ') + cur;
        continue;
      }
      result.push(line);
      continue;
    }

    // 4. Hanging operators or closers at start of current line
    if (/^(\)+;?|\}+;?|\]+;?|;|\+|-|\.|\/|\*|==|!=|>|<|&&|\|\|)/.test(cur)) {
      if (/^\}+;?$/.test(cur) && (prev.endsWith(';') || prev.endsWith('}') || prev.endsWith('{'))) {
        result.push(line);
      } else {
        result[prevIdx] = result[prevIdx] + (cur.startsWith('.') || cur.startsWith(')') || cur.startsWith(';') ? '' : ' ') + cur;
      }
      continue;
    }

    // 5. Hanging callers: e.g. "());"
    if (/^\(\);?/.test(cur)) {
      result[prevIdx] = result[prevIdx] + cur;
      continue;
    }

    // 6. Hanging openers or operators at end of previous line
    if (/[+\-*/=><.,:(]$/.test(prev)) {
      result[prevIdx] = result[prevIdx] + (prev.endsWith('.') || prev.endsWith('(') ? '' : ' ') + cur;
      continue;
    }

    // 7. Broken identifier across lines (e.g. "ar" + "rList[j]" or "getVa" + "lue()")
    if (/[A-Za-z0-9_]$/.test(prev) && /^[A-Za-z0-9_]+[().\[]/.test(cur) && !prev.endsWith(';') && !prev.endsWith('{') && !prev.endsWith('}')) {
      const lastWord = prev.match(/([A-Za-z0-9_]+)$/)?.[1] || '';
      if (lastWord.length >= 2 && !['var', 'return', 'else', 'new', 'if', 'in', 'do'].includes(lastWord)) {
        result[prevIdx] = result[prevIdx] + cur;
        continue;
      }
    }

    // Default: new line
    result.push(line);
  }

  return result.join('\r\n');
}

/**
 * Parses raw PDF buffer of an Intellinum Flexi Personalization Report
 * into structured JSON models per screen/page.
 */
function parseFlexiPdfReport(pdfBuffer, fileName = 'uploaded_report.pdf') {
  const lines = extractPdfLines(pdfBuffer);
  if (!lines || lines.length === 0) {
    throw new Error('PDF file could not be decoded or contains no readable text streams.');
  }

  const rawScreens = [];
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
      rawScreens.push(currentScreen);
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

    // Header section
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
          position: match[3].trim()
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

  // Derive master application name
  const detectedApp = rawScreens.find(s => s.applicationName && s.applicationName.trim())?.applicationName ||
    fileName.replace(/\.pdf$/i, '').replace(/_Personalization/i, '').replace(/Report/i, '').trim();

  // Convert rawScreens to unified screen model
  const screens = rawScreens.map((raw, scIdx) => {
    const pageName = raw.pageName || (scIdx === 0 ? '(Main Screen)' : `Screen ${scIdx + 1}`);
    const appName = raw.applicationName || detectedApp;

    // Stitch page properties
    const pageProperties = {};
    for (const k of Object.keys(raw.pageProps)) {
      pageProperties[k] = stitchScriptLines(raw.pageProps[k]);
    }

    // Build components list
    const components = [];

    // Component '-1' for Page Level properties and newFields
    if (Object.keys(pageProperties).length > 0 || raw.newFields.length > 0) {
      components.push({
        name: '-1',
        type: 'Page Level',
        properties: { ...pageProperties }
      });
    }

    // Field components
    for (const fName of Object.keys(raw.fields)) {
      const fieldProps = {};
      for (const k of Object.keys(raw.fields[fName])) {
        fieldProps[k] = stitchScriptLines(raw.fields[fName][k]);
      }

      components.push({
        name: fName,
        type: fName.endsWith('_WS') ? 'Web Service' : fName.startsWith('btn') ? 'Button' : fName.startsWith('text') ? 'Input' : 'Custom',
        properties: fieldProps
      });
    }

    return {
      applicationName: appName,
      pageName,
      level: raw.level || 'Site',
      value: raw.value || 'Global',
      newFields: raw.newFields,
      pageProperties,
      components
    };
  });

  if (screens.length === 0) {
    throw new Error('No valid Flexi personalization screens detected in uploaded PDF.');
  }

  return {
    fileName,
    appName: detectedApp,
    screens
  };
}

module.exports = {
  parseFlexiPdfReport,
  stitchScriptLines,
  hasOddQuotes,
  isPlainCommentContinuation,
  KNOWN_PROPERTIES
};
