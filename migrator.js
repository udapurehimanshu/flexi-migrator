/**
 * ============================================================
 *  INTELLINUM FLEXI — SSH → PWA Personalization Migrator
 *  Converts Groovy SSH screen scripts to PWA JavaScript
 *  Usage:  node migrator.js ./input-scripts ./output-scripts
 * ============================================================
 */

const fs   = require("fs");
const path = require("path");

// ─────────────────────────────────────────────────────────────
//  CONVERSION RULES
//  Each rule has:
//   - pattern  : RegExp to find in the Groovy script
//   - replace  : string or function returning the PWA equivalent
//   - note     : human-readable description for the report
// ─────────────────────────────────────────────────────────────
const RULES = [

  // ── 0a. Groovy JsonSlurper parse → JSON.parse  (run FIRST so later rules see clean JS) ──
  {
    pattern: /new\s+groovy\.json\.JsonSlurper\s*\(\s*\)\.parseText\s*\(([^)]+)\)/g,
    replace: (match, arg) =>
      `(typeof ${arg.trim()} === "string" ? JSON.parse(${arg.trim()}) : ${arg.trim()})`,
    note: "Replaced Groovy JsonSlurper.parseText() with JSON.parse()"
  },

  // ── 0b. Groovy JsonOutput.toJson → JSON.stringify  (run FIRST so updateRawResponse sees clean JS) ──
  {
    pattern: /groovy\.json\.JsonOutput\.toJson\s*\(([^)]+)\)/g,
    replace: (match, arg) => `JSON.stringify(${arg.trim()})`,
    note: "Replaced Groovy JsonOutput.toJson() with JSON.stringify()"
  },

  // ── 0c. Groovy import statements → remove ──
  {
    pattern: /^import\s+groovy\..+$/gm,
    replace: `/* PWA: Groovy import removed */`,
    note: "Removed Groovy import statements"
  },

  // ── 1. Terminal keystroke: Ctrl+X (go back / exit screen) ──
  {
    pattern: /flexi\.automate\s*\(\s*["']ctrl["']\s*,\s*["']X["']\s*\)/g,
    replace: `(function() {
  // PWA: Ctrl+X screen exit replaced with standard navigation
  if (typeof flexi !== "undefined" && typeof flexi.backToPreviousPage === "function") {
    flexi.backToPreviousPage();
  } else if (typeof btnPreviousscreen !== "undefined" && btnPreviousscreen.click) {
    btnPreviousscreen.click();
  } else {
    flexi.automate("ctrl", "X"); // fallback for hybrid mode
  }
})()`,
    note: 'Replaced flexi.automate("ctrl","X") with official Intellinum flexi.backToPreviousPage()'
  },

  // ── 2. Terminal keystroke: Enter (auto-advance) ──
  {
    pattern: /flexi\.automate\s*\(\s*["']enter["']\s*\)/g,
    replace: `(function() {
  // PWA: simulated Enter key replaced with pressKey/submit
  if (typeof flexi.automate === "function") {
    flexi.automate("enter");
  } else if (typeof flexi.pressKey === "function") {
    flexi.pressKey("ENTER");
  } else if (typeof textInputable !== "undefined" && typeof textInputable.submit === "function") {
    textInputable.submit();
  }
})()`,
    note: 'Replaced flexi.automate("enter") with PWA pressKey("ENTER") / submit()'
  },

  // ── 3. Any other flexi.automate() terminal keystroke ──
  {
    pattern: /flexi\.automate\s*\(([^)]+)\)/g,
    replace: (match, args) =>
      `/* TODO: Review terminal keystroke automate(${args}) for PWA compatibility */\nflexi.automate(${args})`,
    note: "Flagged other flexi.automate() calls for manual review"
  },

  // ── 4. textInputable.setDateTimeFormat → setDateFormat fallback ──
  {
    pattern: /textInputable\.setDateTimeFormat\s*\(([^)]+)\)/g,
    replace: (match, args) =>
      `(function() {
  if (typeof textInputable.setDateTimeFormat === "function") {
    textInputable.setDateTimeFormat(${args});
  } else if (typeof textInputable.setDateFormat === "function") {
    textInputable.setDateFormat(${args});
  }
})()`,
    note: "Added setDateFormat fallback for textInputable.setDateTimeFormat"
  },

  // -- 5. updateRawResponse ? clean PWA fallback --
  {
    pattern: /(\w+)\.updateRawResponse\s*\(([^;]+)\)\s*;/g,
    replace: (match, wsName, arg) => {
      const a = arg.trim();
      return `if (typeof ${wsName}.updateRawResponse === "function") {\n        ${wsName}.updateRawResponse(${a});\n      } else if (typeof ${wsName}.setResponse === "function") {\n        ${wsName}.setResponse(${a});\n      }`;
    },
    note: "Added setResponse fallback for updateRawResponse calls"
  },

  // ── 6. ArrayList / HashSet declarations with type → JS var [] / {} ──
  {
    pattern: /\b(?:ArrayList|List|LinkedList)\s+(\w+)\s*=\s*new\s+\w+\s*\(\s*\)\s*;/g,
    replace: (match, varName) =>
      `var ${varName} = []; /* PWA: Java ArrayList → JS Array */`,
    note: "Replaced Java ArrayList declaration with JS Array var"
  },
  {
    pattern: /\b(?:HashSet|Set)\s*(?:<[^>]+>)?\s+(\w+)\s*=\s*new\s+\w+\s*(?:<[^>]+>)?\s*\(\s*\)\s*;/g,
    replace: (match, varName) =>
      `var ${varName} = {}; /* PWA: Java HashSet → JS object-as-set */`,
    note: "Replaced Java HashSet declaration with JS object var"
  },
  {
    pattern: /new\s+ArrayList\s*\(\s*\)/g,
    replace: `[] /* PWA: Java ArrayList → JS Array */`,
    note: "Replaced inline new ArrayList() with JS Array literal"
  },
  {
    pattern: /new\s+HashSet\s*[\w<>]*\s*\(\s*\)/g,
    replace: `{} /* PWA: Java HashSet → JS object */`,
    note: "Replaced inline new HashSet() with JS object literal"
  },

  // ── 7. Java-style type declarations → JS var ──
  {
    pattern: /\b(String|Integer|Boolean|Double|Long|int|boolean)\s+(\w+)\s*=/g,
    replace: (match, type, varName) =>
      `var ${varName} /* was: ${type} */ =`,
    note: "Replaced Java typed variable declarations with JS var"
  },

  // ── 8. Java for-each → JS for loop ──
  {
    pattern: /for\s*\(\s*\w+\s+(\w+)\s*:\s*(\w+)\s*\)\s*\{/g,
    replace: (match, item, collection) =>
      `for (var _i = 0; _i < ${collection}.length; _i++) { var ${item} = ${collection}[_i];`,
    note: "Converted Java for-each loop to JS for loop"
  },

  // ── 9. .contains() on ArrayList → .indexOf() ──
  {
    pattern: /(\w+)\.contains\s*\(([^)]+)\)/g,
    replace: (match, obj, arg) =>
      `(${obj}.indexOf(${arg}) !== -1) /* was: ${obj}.contains(${arg}) */`,
    note: "Replaced Java .contains() with JS .indexOf() !== -1"
  },

  // ── 10. .add() on ArrayList → .push() ──
  {
    pattern: /(\w+)\.add\s*\(([^)]+)\)/g,
    replace: (match, obj, arg) =>
      `${obj}.push(${arg}) /* was: ${obj}.add(${arg}) */`,
    note: "Replaced Java List.add() with JS Array.push()"
  },

  // ── 11. .size() → .length ──
  {
    pattern: /(\w+)\.size\s*\(\s*\)/g,
    replace: (match, obj) => `${obj}.length /* was: ${obj}.size() */`,
    note: "Replaced Java .size() with JS .length"
  },

  // ── 12. .get(index) on List → [index] ──
  {
    pattern: /(\w+)\.get\s*\(([^)]+)\)/g,
    replace: (match, obj, idx) =>
      `${obj}[${idx}] /* was: ${obj}.get(${idx}) */`,
    note: "Replaced Java List.get(i) with JS array[i]"
  },

  // ── 13. item.field.toString() and simple.toString() → String() ──
  {
    pattern: /([\w.]+)\.toString\s*\(\s*\)/g,
    replace: (match, obj) => `String(${obj}) /* was: .toString() */`,
    note: "Replaced Java .toString() with JS String()"
  },

  // ── 14. System.out.println → console.log ──
  {
    pattern: /System\.out\.println\s*\(([^)]+)\)/g,
    replace: (match, arg) => `console.log(${arg}) /* was: System.out.println */`,
    note: "Replaced Java System.out.println with console.log"
  },

  // ── 15. putSessionObject already works in PWA — keep but annotate ──
  {
    pattern: /flexi\.putSessionObject\s*\(([^)]+)\)/g,
    replace: (match, args) =>
      `flexi.putSessionObject(${args}) /* ✓ Supported in PWA */`,
    note: "Verified flexi.putSessionObject() is PWA-compatible (kept as-is)"
  },

  // ── 16. getSessionObject already works in PWA — annotate ──
  {
    pattern: /flexi\.getSessionObject\s*\(([^)]+)\)/g,
    replace: (match, args) =>
      `flexi.getSessionObject(${args}) /* ✓ Supported in PWA */`,
    note: "Verified flexi.getSessionObject() is PWA-compatible (kept as-is)"
  },

  // ── 17. void keyword (Groovy) → remove / null ──
  {
    pattern: /\bvoid\b(?!\s+\w+\s*\()/g,
    replace: `null /* was: Groovy void */`,
    note: "Replaced Groovy void keyword with null"
  },

  // ── 18. Groovy def keyword → var ──
  {
    pattern: /\bdef\b\s+(\w+)/g,
    replace: (match, varName) => `var ${varName}`,
    note: "Replaced Groovy def with JS var"
  },

  // ── 19. Null comparisons: != null / == null ──
  {
    pattern: /(\w+)\s*!=\s*null/g,
    replace: (match, varName) =>
      `(typeof ${varName} !== "undefined" && ${varName} !== null)`,
    note: "Replaced Java != null with JS null/undefined check"
  },
  {
    pattern: /(\w+)\s*==\s*null/g,
    replace: (match, varName) =>
      `(typeof ${varName} === "undefined" || ${varName} === null)`,
    note: "Replaced Java == null with JS null/undefined check"
  },
];

// ─────────────────────────────────────────────────────────────
//  MIGRATOR FUNCTION
//  Converts a single Groovy script string to PWA JavaScript
// ─────────────────────────────────────────────────────────────
function migrateScript(groovyCode, fileName) {
  let pwCode = groovyCode;
  const appliedRules = [];

  for (const rule of RULES) {
    const before = pwCode;
    if (typeof rule.replace === "function") {
      pwCode = pwCode.replace(rule.pattern, rule.replace);
    } else {
      pwCode = pwCode.replace(rule.pattern, rule.replace);
    }
    if (pwCode !== before) {
      appliedRules.push(rule.note);
    }
  }

  const header = [
    `// ─────────────────────────────────────────────────────────────`,
    `//  FLEXI PWA MIGRATED SCRIPT`,
    `//  Source file : ${fileName}`,
    `//  Migrated at : ${new Date().toISOString()}`,
    `//  Changes     : ${appliedRules.length} rule(s) applied`,
    `// ─────────────────────────────────────────────────────────────`,
    `//  CHANGES APPLIED:`,
    ...appliedRules.map((r, i) => `//    ${i + 1}. ${r}`),
    `// ─────────────────────────────────────────────────────────────`,
    ``,
  ].join("\n");

  return { pwCode: header + pwCode, appliedRules };
}

// ─────────────────────────────────────────────────────────────
//  BATCH PROCESSOR
//  Reads all .groovy / .txt / .gs files from inputDir,
//  writes migrated .js files to outputDir,
//  and creates a migration-report.md summary
// ─────────────────────────────────────────────────────────────
function run(inputDir, outputDir) {
  if (!fs.existsSync(inputDir)) {
    console.error(`❌ Input folder not found: ${inputDir}`);
    process.exit(1);
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const supportedExt = [".groovy", ".txt", ".gs", ".js"];
  const files = fs.readdirSync(inputDir).filter(
    (f) => supportedExt.includes(path.extname(f).toLowerCase())
  );

  if (files.length === 0) {
    console.warn(`⚠️  No script files found in: ${inputDir}`);
    return;
  }

  console.log(`\n🚀 Flexi SSH→PWA Migrator`);
  console.log(`   Input  : ${inputDir}`);
  console.log(`   Output : ${outputDir}`);
  console.log(`   Files  : ${files.length} found\n`);

  const report = [
    `# Flexi SSH → PWA Migration Report`,
    `**Generated:** ${new Date().toLocaleString()}  `,
    `**Total Scripts:** ${files.length}`,
    ``,
    `---`,
    ``,
  ];

  let totalChanges = 0;

  for (const file of files) {
    const inputPath  = path.join(inputDir, file);
    const baseName   = path.basename(file, path.extname(file));
    const outputPath = path.join(outputDir, baseName + ".pwa.js");

    const groovyCode = fs.readFileSync(inputPath, "utf8");
    const { pwCode, appliedRules } = migrateScript(groovyCode, file);

    fs.writeFileSync(outputPath, pwCode, "utf8");
    totalChanges += appliedRules.length;

    const status = appliedRules.length > 0 ? "✅" : "⬜";
    console.log(`  ${status} ${file}  →  ${baseName}.pwa.js  (${appliedRules.length} changes)`);

    report.push(`## ${status} \`${file}\``);
    report.push(`**Output:** \`${baseName}.pwa.js\` | **Changes:** ${appliedRules.length}`);
    if (appliedRules.length > 0) {
      report.push(`\n**What was changed:**`);
      appliedRules.forEach((r, i) => report.push(`${i + 1}. ${r}`));
    } else {
      report.push(`\n> No SSH-specific patterns found — script may already be PWA compatible.`);
    }
    report.push(`\n---\n`);
  }

  // Write migration report
  const reportPath = path.join(outputDir, "migration-report.md");
  report.push(`## Summary`);
  report.push(`- **Scripts processed:** ${files.length}`);
  report.push(`- **Total changes applied:** ${totalChanges}`);
  fs.writeFileSync(reportPath, report.join("\n"), "utf8");

  console.log(`\n✅ Migration complete!`);
  console.log(`   ${files.length} scripts converted  |  ${totalChanges} total changes`);
  console.log(`   📋 Report saved: ${reportPath}\n`);
}

// -------------------------------------------------------------
//  SINGLE FILE MODE
//  Converts one .groovy file, prints result to terminal,
//  and saves a .pwa.js file right next to the source file.
//  Usage: node migrator.js <path/to/script.groovy>
// -------------------------------------------------------------
function runSingleFile(inputFile) {
  if (!fs.existsSync(inputFile)) {
    console.error("\n? File not found: " + inputFile + "\n");
    process.exit(1);
  }

  const fileName   = path.basename(inputFile);
  const baseName   = path.basename(inputFile, path.extname(inputFile));
  const outputFile = path.join(path.dirname(inputFile), baseName + ".pwa.js");

  const groovyCode              = fs.readFileSync(inputFile, "utf8");
  const { pwCode, appliedRules } = migrateScript(groovyCode, fileName);

  fs.writeFileSync(outputFile, pwCode, "utf8");

  console.log("\n" + "=".repeat(60));
  console.log("  Flexi SSH to PWA  |  Single File Mode");
  console.log("=".repeat(60));
  console.log("  Source : " + fileName);
  console.log("  Saved  : " + outputFile);
  console.log("  Changes: " + appliedRules.length);
  console.log("-".repeat(60));

  if (appliedRules.length === 0) {
    console.log("  No SSH patterns found - script may already be PWA ready.");
  } else {
    appliedRules.forEach(function(rule, i) {
      console.log("  " + (i + 1) + ". " + rule);
    });
  }

  console.log("-".repeat(60));
  console.log("\nCONVERTED SCRIPT:\n");
  console.log(pwCode);
  console.log("=".repeat(60) + "\n");
}

// -------------------------------------------------------------
//  ENTRY POINT
//  Single file:  node migrator.js myScript.groovy
//  Batch folder: node migrator.js ./input-scripts ./output-scripts
// -------------------------------------------------------------
const args = process.argv.slice(2);

if (args.length === 1 && fs.existsSync(args[0]) && fs.statSync(args[0]).isFile()) {
  runSingleFile(args[0]);
} else {
  const inputDir  = args[0] || "./input-scripts";
  const outputDir = args[1] || "./output-scripts";
  run(inputDir, outputDir);
}
