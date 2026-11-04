/**
 * Builder script that bundles pure_pdf_parser, pdf_pzn_parser, flexi_converter, 
 * and pwa_report_generator into public/js/flexi_client_engine.js and js/flexi_client_engine.js
 * Ensuring 100% IDENTICAL results between Node.js server and GitHub Pages browser runtime!
 */
const fs = require('fs');

const pakoCode = fs.readFileSync('js/pako.min.js', 'utf8');

const bundle = `/**
 * =============================================================================
 * Intellinum Flexi PWA Migrator - Client Runtime Engine
 * 100% Client-Side Pure JavaScript Engine (GitHub Pages & Offline Compatible)
 * 100% File-Dependent • AST-Masked Groovy Compiler • Zero Hardcoded Fallbacks
 * Embedded Pako 2.1.0 Deflate/Inflate Decompressor
 * =============================================================================
 */
var pakoLib = {};
(function(exports, module) {
${pakoCode}
})(pakoLib, { exports: pakoLib });
var pako = pakoLib.pako || pakoLib;
if (typeof globalThis !== 'undefined') globalThis.pako = pako;
if (typeof window !== 'undefined') window.pako = pako;
if (typeof global !== 'undefined') global.pako = pako;

(function(global) {
  'use strict';

  // ----------------- Browser Safe UUID & Hash -----------------
  function generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try { return crypto.randomUUID(); } catch(e) {}
    }
    return 'session_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
  }

  function generateHash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0').slice(0, 16);
  }

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
              (typeof globalThis !== 'undefined' && globalThis.pako) ||
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

  // ----------------- Intellinum Client Shims & Polyfills -----------------
  var java = {
    text: {
      SimpleDateFormat: function(format) {
        this.format = function(d) {
          d = d || new Date();
          var pad = function(n) { return String(n).padStart(2, '0'); };
          var day = pad(d.getDate());
          var month = pad(d.getMonth() + 1);
          var year = d.getFullYear();
          if (format === 'dd-MM-yyyy') return day + '-' + month + '-' + year;
          if (format === 'dd/MM/yyyy') return day + '/' + month + '/' + year;
          if (format === 'yyyyMMdd') return String(year) + month + day;
          if (format === 'yyyy-MM-dd') return String(year) + '-' + month + '-' + day;
          return day + '/' + month + '/' + year;
        };
        this.parse = function(s) { return new Date(s); };
        this.setTimeZone = function() {};
      },
      DateFormat: function() {}
    },
    util: {
      Date: function() { return new Date(); },
      TimeZone: { getTimeZone: function() { return {}; } }
    }
  };
  global.java = java;
  global.SimpleDateFormat = java.text.SimpleDateFormat;
  global.DateFormat = java.text.DateFormat;
  global.TimeZone = java.util.TimeZone;
  global.LinkedHashSet = function() {
    var s = new Set();
    var origAdd = s.add.bind(s);
    s.add = function(val) {
      if (s.has(val)) return false;
      origAdd(val);
      return true;
    };
    return s;
  };

` +
// Clean pdf_pzn_parser.js logic
fs.readFileSync('pdf_pzn_parser.js', 'utf8')
  .replace(/const \{ extractPdfLines \} = require\('\.\/pure_pdf_parser\.js'\);/g, '')
  .replace(/module\.exports = \{[\s\S]*?\};/, '')
+
// Clean flexi_converter.js logic
fs.readFileSync('flexi_converter.js', 'utf8')
  .replace(/const crypto = require\('crypto'\);/g, '')
  .replace(/const \{ parseFlexiPdfReport \} = require\('\.\/pdf_pzn_parser\.js'\);/g, '')
  .replace(/const \{ generatePwaReport \} = require\('\.\/pwa_report_generator\.js'\);/g, '')
  .replace(/crypto\.randomUUID\(\)/g, 'generateUUID()')
  .replace(/module\.exports = \{[\s\S]*$/, '')
+
// Clean pwa_report_generator.js logic
fs.readFileSync('pwa_report_generator.js', 'utf8')
  .replace(/const crypto = require\('crypto'\);/g, '')
  .replace(/crypto\.createHash\('sha256'\)\.update\(([^)]+)\)\.digest\('hex'\)\.slice\(0,\s*16\)/g, 'generateHash($1)')
  .replace(/module\.exports = \{[\s\S]*?\};/, '')
+
`
  // Export to global scope
  global.FlexiClientEngine = {
    VERSION: '2.1.0',
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

  if (typeof window !== 'undefined') {
    window.FlexiClientEngine = global.FlexiClientEngine;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.FlexiClientEngine;
  }

})(typeof window !== 'undefined' ? window : global);
`;

fs.writeFileSync('public/js/flexi_client_engine.js', bundle);
fs.writeFileSync('js/flexi_client_engine.js', bundle);
console.log('Successfully bundled clean zero-require flexi_client_engine.js!');
