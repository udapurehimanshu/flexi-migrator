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

    // 1. Comment continuation
    if (prev.startsWith('//') || prev.startsWith('/*')) {
      if (prev.endsWith('-') || cur.startsWith('>') || cur.startsWith('+') || (!cur.startsWith('//') && !/[;{}]$/.test(cur) && !cur.includes('('))) {
        // Continue comment
        result[prevIdx] = result[prevIdx] + (prev.endsWith('-') ? '' : ' ') + cur;
        continue;
      }
    }

    // 2. Hanging closers or operators at start of current line: e.g. "());", ");", "));", ";", "+...", ".getValue()"
    if (/^(\)+;?|\}+;?|\]+;?|;|\+|-|\.|\/|\*|==|!=|>|<|&&|\|\|)/.test(cur)) {
      result[prevIdx] = result[prevIdx] + (cur.startsWith('.') || cur.startsWith(')') || cur.startsWith(';') ? '' : ' ') + cur;
      continue;
    }

    // 3. Hanging openers or operators at end of previous line: e.g. ends with ".", "+", "(", "[", "=", etc.
    if (/[+\-*/=><.,:(]$/.test(prev)) {
      result[prevIdx] = result[prevIdx] + (prev.endsWith('.') || prev.endsWith('(') ? '' : ' ') + cur;
      continue;
    }

    // 4. Broken identifier across lines (e.g. "XX_DROP_FIE" followed by "LD..." or "getVa" followed by "lue()")
    if (/[A-Za-z0-9_]$/.test(prev) && /^[A-Za-z0-9_]+\(/.test(cur) && !prev.endsWith(';') && !prev.endsWith('{') && !prev.endsWith('}')) {
      const lastWord = prev.match(/([A-Za-z0-9_]+)$/)?.[1] || '';
      if (lastWord.length > 2 && !['var', 'return', 'else', 'new', 'if'].includes(lastWord)) {
        // e.g. "XX_HAND_TY" + "PE" or "getVa" + "lue()"
        result[prevIdx] = result[prevIdx] + cur;
        continue;
      }
    }

    // Default: new line
    result.push(line);
  }

  return result.join('\r\n');
}

// Test with textOrderNbr
const raw = [
  'flexi.putObject("ORDER_QTY_NEW",ordarr.get(0).get("ord_qty").toString',
  '());',
  'XX_ASSIGN_SKU_QTY.setValue(flexi.getObject("ORDER_QTY_NEW"))',
  ';',
  'flexi.putObject("LPN_COUNT1",String.valueOf(getRes.get("result_count")',
  '));',
  '//flexi.setStatusMessage("LPN count Object value-----',
  '>"+flexi.getObject("LPN_COUNT1"));'
];

console.log('Stitched output:\n' + stitchScriptLines(raw));

