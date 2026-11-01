/**
 * =============================================================================
 * INTELLINUM FLEXI — SSH/Groovy → PWA JavaScript Migrator
 * Verified against official Intellinum FlexiAPI JavaDoc (August 2021)
 * =============================================================================
 *
 * VERIFIED CONVERSION TABLE (from JavaDoc research):
 *
 *  SSH GROOVY                          PWA JAVASCRIPT              STATUS
 *  ─────────────────────────────────────────────────────────────────────────
 *  flexi.automate("ctrl","X")      →   flexi.backToPreviousPage()  CONFIRMED in JavaDoc
 *  flexi.automate("enter")         →   flexi.automate("enter")     KEEP AS-IS (method exists in PWA)
 *  ws.updateRawResponse(x)         →   ws.updateRawResponse(x)     KEEP AS-IS (method exists in PWA)
 *  ws.getRawResponse()             →   ws.getRawResponse()         KEEP AS-IS
 *  ws.getResponseCode()            →   ws.getResponseCode()        KEEP AS-IS
 *  flexi.putSessionObject(k,v)     →   flexi.putSessionObject(k,v) KEEP AS-IS
 *  flexi.getSessionObject(k)       →   flexi.getSessionObject(k)   KEEP AS-IS
 *  flexi.putObject(k,v)            →   flexi.putObject(k,v)        KEEP AS-IS
 *  flexi.getObject(k)              →   flexi.getObject(k)          KEEP AS-IS
 *  flexi.setStatusMessage(msg)     →   flexi.setStatusMessage(msg) KEEP AS-IS
 *  flexi.openApplication(app)      →   flexi.openApplication(app)  KEEP AS-IS
 *  field.setValue(x)               →   field.setValue(x)           KEEP AS-IS
 *  field.getValue()                →   field.getValue()            KEEP AS-IS
 *  field.setHidden(bool)           →   field.setHidden(bool)       KEEP AS-IS
 *  field.setDateTimeFormat(str)    →   field.setDateTimeFormat(str) KEEP AS-IS
 *  ─────────────────────────────────────────────────────────────────────────
 *  GROOVY/JAVA-ONLY (must convert to JavaScript equivalents):
 *  new ArrayList()                 →   []
 *  new HashSet()                   →   {}  (object-as-set)
 *  new JSONObject(str)             →   JSON.parse(str)
 *  new JSONArray()                 →   []
 *  String.valueOf(x)               →   String(x)
 *  Double.parseDouble(x)           →   parseFloat(x)
 *  Integer.parseInt(x)             →   parseInt(x, 10)
 *  list.add(x)                     →   list.push(x)
 *  list.remove(i)                  →   list.splice(i, 1)
 *  list.size()                     →   list.length
 *  list.get(i)                     →   list[i]
 *  obj.toString()                  →   String(obj)
 *  obj.equals(other)               →   obj === other
 *  obj.contains(x)                 →   obj.indexOf(x) !== -1
 *  x != void                       →   typeof x !== "undefined" && x !== null
 *  String/int/double x =           →   var x =
 *  catch(Exception e)              →   catch(e)
 *  org.json.JSONObject x =         →   var x =
 *  org.json.JSONArray x =          →   var x =
 *  .getJSONArray("key")            →   .key
 *  .getJSONObject(i)               →   [i]
 *  .getInt("key")                  →   .key
 *  .put("key", val)                →   .key = val  (on plain JS objects)
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

function convertGroovyToPwaJs(sourceCode) {
  let code = sourceCode;

  // ── 1. NAVIGATION ───────────────────────────────────────────────────────────
  // flexi.automate("ctrl","X") → flexi.backToPreviousPage()  [CONFIRMED in JavaDoc]
  code = code.replace(
    /flexi\.automate\s*\(\s*["']ctrl["']\s*,\s*["']X["']\s*\)\s*;?/g,
    'flexi.backToPreviousPage();'
  );

  // flexi.automate("enter") → KEEP as-is (method exists in PWA JavaDoc)
  // Only annotate for clarity:
  code = code.replace(
    /flexi\.automate\s*\(\s*["']enter["']\s*\)\s*;?/g,
    'flexi.automate("enter"); // PWA: automate() is supported'
  );

  // ── 2. BeanShell/Groovy VOID check ─────────────────────────────────────────
  code = code.replace(
    /(\b\w+)\s*!=\s*void\b/g,
    '(typeof $1 !== "undefined" && $1 !== null)'
  );
  code = code.replace(
    /(\b\w+)\s*==\s*void\b/g,
    '(typeof $1 === "undefined" || $1 === null)'
  );

  // ── 3. STRING EQUALITY: "literal".equals(expr) ─────────────────────────────
  // e.g. "Y".equals(flexi.getSessionObject("TXN_COMPLETED")) → (expr === "Y")
  code = code.replace(
    /"([^"]+)"\.equals\s*\(([\s\S]*?\))\)/g,
    '($2 === "$1")'
  );

  // ── 4. INSTANCE EQUALITY: obj.equals(other) ────────────────────────────────
  code = code.replace(
    /\.equals\s*\(([^)]+)\)/g,
    ' === $1'
  );

  // ── 5. CONTAINS → indexOf ──────────────────────────────────────────────────
  // string/list.contains("x") → .indexOf("x") !== -1
  code = code.replace(
    /\.contains\s*\(([^)]+)\)/g,
    '.indexOf($1) !== -1'
  );

  // ── 6. JSON — Parse raw response ───────────────────────────────────────────
  // new JSONObject(str) / new org.json.JSONObject(str) → JSON.parse(str)
  code = code.replace(
    /new\s+(?:org\.json\.)?JSONObject\s*\(([\s\S]*?\))\)/g,
    '(typeof $1 === "string" ? JSON.parse($1) : $1)'
  );

  // new JSONArray() / new org.json.JSONArray() → []
  code = code.replace(/new\s+(?:org\.json\.)?JSONArray\s*\(\s*\)/g, '[]');

  // JSONObject / JSONArray typed declarations
  code = code.replace(/\b(?:org\.json\.)?JSONObject\s+(\w+)\s*=/g, 'var $1 =');
  code = code.replace(/\b(?:org\.json\.)?JSONArray\s+(\w+)\s*=/g, 'var $1 =');

  // .getJSONArray("key") → .key
  code = code.replace(/\.getJSONArray\s*\(\s*"([^"]+)"\s*\)/g, '.$1');

  // .getJSONObject(i) → [i]
  code = code.replace(/\.getJSONObject\s*\(\s*([^)]+)\s*\)/g, '[$1]');

  // .getInt("key") → .key
  code = code.replace(/\.getInt\s*\(\s*"([^"]+)"\s*\)/g, '.$1');

  // ── 7. JAVA COLLECTIONS ────────────────────────────────────────────────────
  // ArrayList / List declarations
  code = code.replace(
    /\b(?:ArrayList|List)\s+(\w+)\s*=\s*new\s+ArrayList\s*\(\s*\)\s*;/g,
    'var $1 = [];'
  );
  // HashSet / Set declarations
  code = code.replace(
    /\b(?:HashSet|Set)\s+(\w+)\s*=\s*new\s+HashSet\s*\(\s*\)\s*;/g,
    'var $1 = {};'
  );
  // Inline new ArrayList() / new HashSet()
  code = code.replace(/new\s+ArrayList\s*\(\s*\)/g, '[]');
  code = code.replace(/new\s+HashSet\s*\(\s*\)/g, '{}');

  // .add() → .push()  (standard arrays)
  code = code.replace(/(\b\w+)\.add\s*\(([^)]+)\)/g, '$1.push($2)');

  // .remove(i) → .splice(i, 1)
  code = code.replace(/(\b\w+)\.remove\s*\(([^)]+)\)/g, '$1.splice($2, 1)');

  // .size() → .length
  code = code.replace(/(\b\w+)\.size\s*\(\s*\)/g, '$1.length');

  // ── 8. ARRAY / MAP ACCESS ──────────────────────────────────────────────────
  // .getSelectedValues().get(1) → .getSelectedValues()[1]
  code = code.replace(
    /\.getSelectedValues\s*\(\s*\)\.get\s*\(\s*(\d+)\s*\)/g,
    '.getSelectedValues()[$1]'
  );

  // list.get(i) on known array variables → list[i]
  code = code.replace(
    /\b(list|list1|ship_arr|rece_arr|sku_arr|jsonArray|newArray|lpn_arr|lpn_arrr|arr|lpn_arr_ship)\s*\.get\s*\(\s*([a-zA-Z0-9_]+)\s*\)/g,
    '$1[$2]'
  );

  // .get("key") on JSON objects → .key  (skip flexi.getObject / flexi.getSessionObject)
  code = code.replace(
    /(\b(?!flexi\b)[a-zA-Z0-9_]+(?:\[[^\]]+\])?)\.get\s*\(\s*"([^"]+)"\s*\)/g,
    '$1.$2'
  );

  // newArray.put(x) → newArray.push(x)
  code = code.replace(/(\bnewArray)\.put\s*\(([^,)]+)\)/g, '$1.push($2)');

  // json.put("key", val) → json.key = val  (on plain JS objects, not flexi.put*)
  // Also handles: jsonArray[i].put("batch_nbr", val) → jsonArray[i].batch_nbr = val
  code = code.replace(
    /(\b(?!flexi\b)[a-zA-Z0-9_]+(?:\[[^\]]+\])?)\.put\s*\(\s*"([^"]+)"\s*,\s*([^)]+)\)/g,
    '$1.$2 = $3'
  );

  // ── 9. ARRAY .length() → .length ──────────────────────────────────────────
  code = code.replace(
    /\b(sku_arr|ship_arr|rece_arr|jsonArray|newArray|lpn_arr|lpn_arrr|arr|lpn_arr_ship|list|list1)\s*\.length\s*\(\s*\)/g,
    '$1.length'
  );
  // .getValue().length() → .getValue().length
  code = code.replace(/(\.getValue\s*\(\s*\))\.length\s*\(\s*\)/g, '$1.length');

  // ── 10. NUMBER & STRING CONVERSIONS ────────────────────────────────────────
  code = code.replace(/Double\.parseDouble\s*\(([^)]+)\)/g, 'parseFloat($1)');
  code = code.replace(/Integer\.parseInt\s*\(([^)]+)\)/g, 'parseInt($1, 10)');
  code = code.replace(/String\.valueOf\s*\(([^)]+)\)/g, 'String($1)');
  code = code.replace(/\(int\)\s*(\w+)/g, 'parseInt($1, 10)');

  // updateRawResponse: use JSON.stringify for object → string conversion
  code = code.replace(
    /(\w+)\.updateRawResponse\s*\(\s*(\w+)\.toString\s*\(\s*\)\s*\)\s*;?/g,
    '$1.updateRawResponse(JSON.stringify($2));'
  );
  // Generic .toString() → String()
  code = code.replace(/(\b\w+)\.toString\s*\(\s*\)/g, 'String($1)');

  // ── 11. JAVA TYPE DECLARATIONS ─────────────────────────────────────────────
  code = code.replace(
    /\b(int|double|float|long|String|boolean)\s+(\w+)\s*=/g,
    'var $2 ='
  );

  // ── 12. EXCEPTION HANDLING ─────────────────────────────────────────────────
  code = code.replace(
    /catch\s*\(\s*(?:Exception|Throwable|RuntimeException)\s+(\w+)\s*\)/g,
    'catch ($1)'
  );

  // ── 13. LOGGER → console.log ───────────────────────────────────────────────
  code = code.replace(
    /logger\.(trace|debug|info|warn|error)\s*\(([^;]+)\);/g,
    'console.log($2);'
  );

  return code;
}

function processExportFile(inputFile, outputDir) {
  console.log(`\n${'='.repeat(64)}`);
  console.log('Intellinum Flexi SSH → PWA Migration Engine');
  console.log(`Input:  ${inputFile}`);
  console.log(`Output: ${outputDir}`);
  console.log(`${'='.repeat(64)}\n`);

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const scriptsDir = path.join(outputDir, 'converted_scripts');
  if (!fs.existsSync(scriptsDir)) fs.mkdirSync(scriptsDir, { recursive: true });

  let raw = fs.readFileSync(inputFile, 'utf8').trim();
  let hasPrefix = false;
  if (raw.startsWith('personalization=')) {
    hasPrefix = true;
    raw = raw.slice('personalization='.length);
  }

  const decodedXml = decodeURIComponent(raw.replace(/\+/g, '%20'));

  function decodeHtmlEntities(str) {
    return str.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'");
  }
  function encodeHtmlEntities(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const pznRegex = /<com\.intellinum\.miaadmin\.objects\.export\.Personalization>([\s\S]*?)<\/com\.intellinum\.miaadmin\.objects\.export\.Personalization>/g;
  let totalScreens = 0, totalScripts = 0;
  const audit = [];

  const newXml = decodedXml.replace(pznRegex, (fullBlock, inner) => {
    totalScreens++;
    const pageMatch = inner.match(/<pageName>(.*?)<\/pageName>/);
    const detailMatch = inner.match(/<personalizationDetail>([\s\S]*?)<\/personalizationDetail>/);
    const rawPage = pageMatch ? pageMatch[1] : `Screen_${totalScreens}`;
    const cleanPage = (rawPage.trim() === '' ? 'Subpage' : rawPage).replace(/[^a-zA-Z0-9_-]/g, '_');

    if (!detailMatch) return fullBlock;

    let pznData;
    try {
      pznData = JSON.parse(decodeHtmlEntities(detailMatch[1]));
    } catch (e) {
      console.error(`  [SKIP] JSON parse failed for page "${rawPage}": ${e.message}`);
      return fullBlock;
    }

    const pzn = pznData.personalization || {};
    for (const comp of Object.keys(pzn)) {
      const props = pzn[comp];
      if (typeof props !== 'object' || !props) continue;
      for (const prop of Object.keys(props)) {
        const propObj = props[prop];
        if (propObj && typeof propObj.personalize_value === 'string' && propObj.personalize_value.trim().startsWith('script:')) {
          totalScripts++;
          const rawScript = propObj.personalize_value.replace(/^\s*script:\s*/, '');
          const pwaScript = convertGroovyToPwaJs(rawScript);

          propObj.personalize_value = 'script:\r\n' + pwaScript.replace(/\r?\n/g, '\r\n');

          const safeComp = (comp === '-1' ? 'PAGE' : comp).replace(/[^a-zA-Z0-9_-]/g, '_');
          const fname = `${String(totalScripts).padStart(2, '0')}_${cleanPage}_${safeComp}_${prop}.pwa.js`;
          const fpath = path.join(scriptsDir, fname);
          const header = `/**\n * Page: ${rawPage || '(Subpage)'}\n * Component: ${comp}\n * Event: ${prop}\n */\n\n`;
          fs.writeFileSync(fpath, header + pwaScript, 'utf8');
          audit.push({ id: totalScripts, page: rawPage || '(Subpage)', comp, prop, fname, fpath });
        }
      }
    }

    return fullBlock.replace(
      detailMatch[0],
      `<personalizationDetail>${encodeHtmlEntities(JSON.stringify(pznData))}</personalizationDetail>`
    );
  });

  // Output files
  const xmlOut = path.join(outputDir, 'Personalization_PWA_Import.xml');
  fs.writeFileSync(xmlOut, newXml, 'utf8');

  const payloadOut = path.join(outputDir, 'Personalization_PWA_Payload.txt');
  fs.writeFileSync(payloadOut, (hasPrefix ? 'personalization=' : '') + encodeURIComponent(newXml).replace(/%20/g, '+'), 'utf8');

  // Syntax validation on all scripts
  let passed = 0, failed = 0;
  for (const item of audit) {
    const code = fs.readFileSync(item.fpath, 'utf8');
    try {
      new Function(code);
      passed++;
    } catch (e) {
      console.error(`  [SYNTAX FAIL] ${item.fname}: ${e.message}`);
      failed++;
    }
  }

  console.log(`Screens processed : ${totalScreens}`);
  console.log(`Scripts converted : ${totalScripts}`);
  console.log(`Syntax validation : ${passed} PASSED / ${failed} FAILED`);
  console.log(`Import XML        : ${xmlOut}`);
  console.log(`Payload TXT       : ${payloadOut}`);
  console.log(`Scripts folder    : ${scriptsDir}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

processExportFile(
  path.join(__dirname, 'work', 'raw_export.txt'),
  path.join(__dirname, 'pwa-migrated-output')
);
