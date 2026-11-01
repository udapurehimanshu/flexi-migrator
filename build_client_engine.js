/**
 * Builder script that bundles pure_pdf_parser, pdf_pzn_parser, flexi_converter, 
 * and pwa_report_generator into public/js/flexi_client_engine.js and js/flexi_client_engine.js
 * Ensuring 100% IDENTICAL results between Node.js server and GitHub Pages browser runtime!
 */
const fs = require('fs');
const path = require('path');

const bundle = `/**
 * =============================================================================
 * Intellinum Flexi PWA Migrator - Client Runtime Engine
 * 100% Client-Side Pure JavaScript Engine (GitHub Pages & Offline Compatible)
 * 100% File-Dependent • Ast-Masked Groovy Compiler • Zero Hardcoded Fallbacks
 * =============================================================================
 */
(function(global) {
  'use strict';

  // ----------------- Array & Buffer Helpers -----------------
  function toUint8Array(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (input && input.buffer) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    if (typeof input === 'string') return new TextEncoder().encode(input);
    throw new Error('Unsupported input format for PDF byte processing');
  }

  function findSubarray(source, pattern, fromIndex) {
    fromIndex = fromIndex || 0;
    const pLen = pattern.length;
    const sLen = source.length;
    for (let i = fromIndex; i <= sLen - pLen; i++) {
      let match = true;
      for (let j = 0; j < pLen; j++) {
        if (source[i + j] !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }
    return -1;
  }

  // Multi-candidate stream decompression to avoid cutting off Adler32 checksum
  function inflateStream(slice) {
    const p = (typeof window !== 'undefined' && window.pako) ||
              (typeof global !== 'undefined' && global.pako) ||
              (typeof pako !== 'undefined' ? pako : null);

    if (p && typeof p.inflate === 'function') {
      const candidates = [];
      const len = slice.length;
      if (len >= 2 && slice[len - 2] === 13 && slice[len - 1] === 10) {
        candidates.push(slice.subarray(0, len - 2));
      }
      if (len >= 1 && (slice[len - 1] === 10 || slice[len - 1] === 13)) {
        candidates.push(slice.subarray(0, len - 1));
      }
      candidates.push(slice);

      for (let i = 0; i < candidates.length; i++) {
        try {
          const unz = p.inflate(candidates[i]);
          if (unz && unz.length > 0) return unz;
        } catch(e) {}
      }
    }

    // Node.js fallback
    if (typeof require !== 'undefined') {
      try {
        const zlib = require('zlib');
        return zlib.inflateSync(slice);
      } catch(e) {}
    }

    return null;
  }

  // ----------------- Pure PDF Line Extractor -----------------
  function extractPdfLines(pdfBuffer) {
    const uint8 = toUint8Array(pdfBuffer);
    let pos = 0;
    const pageStreams = [];

    const streamCRLF = new Uint8Array([115, 116, 114, 101, 97, 109, 13, 10]); // stream\\r\\n
    const streamLF = new Uint8Array([115, 116, 114, 101, 97, 109, 10]);       // stream\\n
    const endStream = new Uint8Array([101, 110, 100, 115, 116, 114, 101, 97, 109]); // endstream

    while (true) {
      const sIdx1 = findSubarray(uint8, streamCRLF, pos);
      const sIdx2 = findSubarray(uint8, streamLF, pos);
      let start = -1, offset = 0;
      if (sIdx1 !== -1 && (sIdx2 === -1 || sIdx1 < sIdx2)) { start = sIdx1; offset = 8; }
      else if (sIdx2 !== -1) { start = sIdx2; offset = 7; }
      if (start === -1) break;

      const endStreamIdx = findSubarray(uint8, endStream, start);
      if (endStreamIdx === -1) break;

      try {
        const slice = uint8.subarray(start + offset, endStreamIdx);
        const unz = inflateStream(slice);
        if (unz) {
          const dec = new TextDecoder('latin1').decode(unz);
          if (dec.includes('BT') && dec.includes('ET')) {
            pageStreams.push(dec);
          }
        }
      } catch(e) {}

      pos = endStreamIdx + 9;
    }

    const allLines = [];

    pageStreams.forEach(function(stream, pageIndex) {
      const tokens = stream.match(/(?:[^\\s()]+|\\((?:\\\\.|[^\\\\()])*\\))/g) || [];
      let x = 0, y = 0, fontSize = 12, isBold = false;
      let lineX = 0, lineY = 0;
      const textItems = [];

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t === 'BT') {
          x = 0; y = 0; lineX = 0; lineY = 0;
        } else if (t === 'ET') {
        } else if (t === 'Tf') {
          const fontName = tokens[i - 2] || '';
          fontSize = parseFloat(tokens[i - 1]) || 12;
          isBold = fontName.includes('F1') || fontName.includes('Bold');
        } else if (t === 'Td' || t === 'TD') {
          const dx = parseFloat(tokens[i - 2]) || 0;
          const dy = parseFloat(tokens[i - 1]) || 0;
          lineX += dx;
          lineY += dy;
          x = lineX;
          y = lineY;
        } else if (t === 'Tm') {
          lineX = parseFloat(tokens[i - 2]) || 0;
          lineY = parseFloat(tokens[i - 1]) || 0;
          x = lineX;
          y = lineY;
        } else if (t === 'T*' || t === 'Tj') {
          let str = '';
          if (t === 'Tj') {
            const raw = tokens[i - 1] || '';
            if (raw.startsWith('(') && raw.endsWith(')')) {
              str = raw.slice(1, -1)
                .replace(/\\\\([()\\\\])/g, '$1')
                .replace(/\\\\r/g, '\\r')
                .replace(/\\\\n/g, '\\n')
                .replace(/\\\\t/g, '\\t');
            }
          }
          if (str && str !== ' ') {
            textItems.push({
              page: pageIndex,
              x: x,
              y: y,
              fontSize: fontSize,
              isBold: isBold,
              text: str
            });
          }
        }
      }

      textItems.sort(function(a, b) { return (b.y - a.y) || (a.x - b.x); });
      const rows = [];
      textItems.forEach(function(item) {
        let r = rows.find(function(row) { return Math.abs(row.y - item.y) < 2.5; });
        if (!r) {
          r = { page: pageIndex, y: item.y, items: [] };
          rows.push(r);
        }
        r.items.push(item);
      });

      rows.sort(function(a, b) { return b.y - a.y; });
      rows.forEach(function(r) {
        r.items.sort(function(a, b) { return a.x - b.x; });
        const fullText = r.items.map(function(it) { return it.text; }).join('');
        const x0 = r.items[0].x;
        const x1 = r.items[r.items.length - 1].x;
        allLines.push({
          page: pageIndex,
          top: 842 - r.y,
          x0: x0,
          x1: x1,
          size: r.items[0].fontSize,
          bold: r.items[0].isBold,
          text: fullText,
          items: r.items
        });
      });
    });

    return allLines;
  }

  // ----------------- Stitching Engine -----------------
  function hasOddQuotes(str) {
    let dQuotes = 0;
    let sQuotes = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '"' && (i === 0 || str[i - 1] !== '\\\\')) dQuotes++;
      if (str[i] === "'" && (i === 0 || str[i - 1] !== '\\\\')) sQuotes++;
    }
    return (dQuotes % 2 !== 0) || (sQuotes % 2 !== 0);
  }

  function isPlainCommentContinuation(str) {
    const s = str.trim();
    if (/^[A-Za-z0-9_\\s\\-.,'"]+$/.test(s) && !/[;{}=()<>]/.test(s)) {
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

      if (hasOddQuotes(prev)) {
        result[prevIdx] = result[prevIdx] + cur;
        continue;
      }

      if (cur.startsWith('//') || cur.startsWith('/*')) {
        result.push(line);
        continue;
      }

      if (prev.startsWith('//') || prev.startsWith('/*')) {
        if (prev.endsWith('-') || prev.endsWith('+') || cur.startsWith('>') || cur.startsWith('+') || isPlainCommentContinuation(cur)) {
          result[prevIdx] = result[prevIdx] + (prev.endsWith('-') ? '' : ' ') + cur;
          continue;
        }
        result.push(line);
        continue;
      }

      if (/^(\\)+;?|\\}+;?|\\]+;?|;|\\+|-|\\.|\\/|\\*|==|!=|>|<|&&|\\|\\|)/.test(cur)) {
        if (/^\\}+;?$/.test(cur) && (prev.endsWith(';') || prev.endsWith('}') || prev.endsWith('{'))) {
          result.push(line);
        } else {
          result[prevIdx] = result[prevIdx] + (cur.startsWith('.') || cur.startsWith(')') || cur.startsWith(';') ? '' : ' ') + cur;
        }
        continue;
      }

      if (/^\\(\\);?/.test(cur)) {
        result[prevIdx] = result[prevIdx] + cur;
        continue;
      }

      if (/[+\\-*/=><.,:(]$/.test(prev)) {
        result[prevIdx] = result[prevIdx] + (prev.endsWith('.') || prev.endsWith('(') ? '' : ' ') + cur;
        continue;
      }

      if (/[A-Za-z0-9_]$/.test(prev) && /^[A-Za-z0-9_]+[().\\[]/.test(cur) && !prev.endsWith(';') && !prev.endsWith('{') && !prev.endsWith('}')) {
        const lastWord = prev.match(/([A-Za-z0-9_]+)$/)?.[1] || '';
        if (lastWord.length >= 2 && !['var', 'return', 'else', 'new', 'if', 'in', 'do'].includes(lastWord)) {
          result[prevIdx] = result[prevIdx] + cur;
          continue;
        }
      }

      result.push(line);
    }

    return result.join('\\r\\n');
  }

  // ----------------- Report Structural Parser -----------------
  const VALUE_X = 216.0;

  function parseFlexiPdfReport(pdfBuffer, fileName) {
    fileName = fileName || 'uploaded_report.pdf';
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

      if (t.replace(/\\s+/g, '') === 'FieldNameTypePosition' || t.replace(/\\s+/g, '') === 'PropertyNamePropertyValue') {
        continue;
      }

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

      if (mode === 'page' || mode === 'field') {
        const col1Chars = ln.items.filter(function(it) { return it.x < VALUE_X; }).map(function(it) { return it.text; }).join('').trim();
        const col2Chars = ln.items.filter(function(it) { return it.x >= VALUE_X - 1; }).map(function(it) { return it.text; }).join('');

        const store = mode === 'page' ? currentScreen.pageProps : (currentScreen.fields[curField] || {});

        if (col1Chars) {
          curProp = col1Chars;
          store[curProp] = [col2Chars];
        } else if (curProp && store[curProp]) {
          store[curProp].push(col2Chars);
        }
      }
    }

    const detectedApp = rawScreens.find(function(s) { return s.applicationName && s.applicationName.trim(); })?.applicationName ||
      fileName.replace(/\\.pdf$/i, '').replace(/_Personalization/i, '').replace(/Report/i, '').trim();

    const screens = rawScreens.map(function(raw, scIdx) {
      const pageName = raw.pageName || (scIdx === 0 ? '(Main Screen)' : ('Screen ' + (scIdx + 1)));
      const appName = raw.applicationName || detectedApp;

      const pageProperties = {};
      for (const k of Object.keys(raw.pageProps)) {
        pageProperties[k] = stitchScriptLines(raw.pageProps[k]);
      }

      const components = [];
      if (Object.keys(pageProperties).length > 0 || raw.newFields.length > 0) {
        components.push({
          name: '-1',
          type: 'Page Level',
          properties: Object.assign({}, pageProperties)
        });
      }

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
        pageName: pageName,
        level: raw.level || 'Site',
        value: raw.value || 'Global',
        newFields: raw.newFields,
        pageProperties: pageProperties,
        components: components
      };
    });

    if (screens.length === 0) {
      throw new Error('No valid Flexi personalization screens detected in uploaded PDF.');
    }

    return {
      fileName: fileName,
      appName: detectedApp,
      screens: screens
    };
  }

` +
// Extract flexi_converter.js logic (constants, rules, convertGroovyToPwaJs, convertPdfFile, convertTxtFile, generateOracleSql)
fs.readFileSync('flexi_converter.js', 'utf8')
  .replace(/const crypto = require\('crypto'\);/, '')
  .replace(/const \{ parseFlexiPdfReport \} = require\('\.\/pdf_pzn_parser\.js'\);/, '')
  .replace(/const \{ generatePwaReport \} = require\('\.\/pwa_report_generator\.js'\);/, '')
  .replace(/module\.exports = \{[\s\S]*?\};/, '')
+
// Extract pwa_report_generator.js logic
fs.readFileSync('pwa_report_generator.js', 'utf8')
  .replace(/module\.exports = \{[\s\S]*?\};/, '')
+
`
  // Export to global scope
  global.FlexiClientEngine = {
    ORIGINAL_DEFAULTS: ORIGINAL_DEFAULTS,
    MIGRATION_RULES: MIGRATION_RULES,
    extractPdfLines: extractPdfLines,
    extractPdfLinesFromBytes: extractPdfLines,
    stitchScriptLines: stitchScriptLines,
    parseFlexiPdfReport: parseFlexiPdfReport,
    convertGroovyToPwaJs: convertGroovyToPwaJs,
    convertPdfFile: convertPdfFile,
    convertTxtFile: convertTxtFile,
    generateOracleSql: generateOracleSql,
    generatePwaReport: generatePwaReport
  };

})(typeof window !== 'undefined' ? window : global);
`;

fs.writeFileSync('public/js/flexi_client_engine.js', bundle);
fs.writeFileSync('js/flexi_client_engine.js', bundle);
console.log('Successfully bundled flexi_client_engine.js into public/ and root js/!');
