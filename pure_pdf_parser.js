/**
 * Pure Node.js PDF Text Extractor for Flexi Personalization Reports
 * Decodes PDF streams using built-in zlib and reconstructs lines by (y, x) coordinates.
 */
const fs = require('fs');
const zlib = require('zlib');

function extractPdfLines(pdfBuffer) {
  let pos = 0;
  const pageStreams = [];
  while (true) {
    const sIdx1 = pdfBuffer.indexOf(Buffer.from('stream\r\n'), pos);
    const sIdx2 = pdfBuffer.indexOf(Buffer.from('stream\n'), pos);
    let start = -1, offset = 0;
    if (sIdx1 !== -1 && (sIdx2 === -1 || sIdx1 < sIdx2)) { start = sIdx1; offset = 8; }
    else if (sIdx2 !== -1) { start = sIdx2; offset = 7; }
    if (start === -1) break;
    const end = pdfBuffer.indexOf(Buffer.from('endstream'), start);
    if (end === -1) break;
    try {
      const dec = zlib.inflateSync(pdfBuffer.slice(start + offset, end)).toString('latin1');
      if (dec.includes('BT') && dec.includes('ET')) {
        pageStreams.push(dec);
      }
    } catch(e) {}
    pos = end + 9;
  }

  const allLines = [];

  pageStreams.forEach((stream, pageIndex) => {
    // Parse text objects in page
    // Tracking current transformation matrix and position
    const tokens = stream.match(/(?:[^\s()]+|\((?:\\.|[^\\()])*\))/g) || [];
    let x = 0, y = 0, fontSize = 12, isBold = false;
    let lineX = 0, lineY = 0;
    const textItems = [];

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === 'BT') {
        x = 0; y = 0; lineX = 0; lineY = 0;
      } else if (t === 'ET') {
        // end text
      } else if (t === 'Tf') {
        // e.g. /F1 18 Tf
        const fontName = tokens[i - 2] || '';
        fontSize = parseFloat(tokens[i - 1]) || 12;
        isBold = fontName.includes('F1') || fontName.includes('Bold');
      } else if (t === 'Td' || t === 'TD') {
        // dx dy Td
        const dx = parseFloat(tokens[i - 2]) || 0;
        const dy = parseFloat(tokens[i - 1]) || 0;
        lineX += dx;
        lineY += dy;
        x = lineX;
        y = lineY;
      } else if (t === 'Tm') {
        // a b c d e f Tm
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
              .replace(/\\([()\\])/g, '$1')
              .replace(/\\r/g, '\r')
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t');
          }
        }
        if (str && str !== ' ') {
          textItems.push({
            page: pageIndex,
            x,
            y,
            fontSize,
            isBold,
            text: str
          });
        }
      }
    }

    // Group text items by y coordinate into lines (tolerance 2 units)
    textItems.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    textItems.forEach(item => {
      let r = rows.find(row => Math.abs(row.y - item.y) < 2.5);
      if (!r) {
        r = { page: pageIndex, y: item.y, items: [] };
        rows.push(r);
      }
      r.items.push(item);
    });

    rows.sort((a, b) => b.y - a.y);
    rows.forEach(r => {
      r.items.sort((a, b) => a.x - b.x);
      const fullText = r.items.map(it => it.text).join('');
      const x0 = r.items[0].x;
      const x1 = r.items[r.items.length - 1].x;
      allLines.push({
        page: pageIndex,
        top: 842 - r.y, // convert to top-down
        x0,
        x1,
        size: r.items[0].fontSize,
        bold: r.items[0].isBold,
        text: fullText,
        items: r.items
      });
    });
  });

  return allLines;
}

module.exports = { extractPdfLines };
