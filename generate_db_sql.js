const fs = require('fs');
const path = require('path');

const xmlPath = path.join(__dirname, 'pwa-migrated-output', 'Personalization_PWA_Import.xml');
const xml = fs.readFileSync(xmlPath, 'utf8');

function decodeHtmlEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'");
}

const pznRegex = /<com\.intellinum\.miaadmin\.objects\.export\.Personalization>([\s\S]*?)<\/com\.intellinum\.miaadmin\.objects\.export\.Personalization>/g;
let match;
const records = [];

while ((match = pznRegex.exec(xml)) !== null) {
  const block = match[1];
  
  const getTag = (tag) => {
    const r = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>');
    const m = block.match(r);
    return m ? m[1].trim() : '';
  };

  const detailMatch = block.match(/<personalizationDetail>([\s\S]*?)<\/personalizationDetail>/);
  const detail = detailMatch ? decodeHtmlEntities(detailMatch[1]) : '';

  records.push({
    applicationName: getTag('applicationName'),
    pageName: getTag('pageName'),
    personalizationLevel: getTag('personalizationLevel'),
    personalizationValue: getTag('personalizationValue'),
    enabled: getTag('enabled'),
    detail
  });
}

console.log(`Extracted ${records.length} personalization records for DB migration:`);
records.forEach((r, i) => {
  console.log(`Record ${i + 1}: App="${r.applicationName}", Page="${r.pageName}", Level=${r.personalizationLevel}, Value="${r.personalizationValue}", Detail Length=${r.detail.length} chars`);
});

// Helper to chunk string into <= 2500 char pieces for Oracle SQL/PLSQL TO_CLOB safety
function chunkString(str, size = 2500) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

let sql = `-- =============================================================================
-- INTELLINUM FLEXI: DATABASE-DIRECT PERSONALIZATION MIGRATION (SSH -> PWA)
-- Target Application: STD - Receiving On PLT
-- Target DB: Oracle Database (Oracle WMS Cloud / LogFire Flexi Runtime)
-- Table Candidates: FLEXI_PERSONALIZATION / MIA_PERSONALIZATION
-- Generated: ${new Date().toISOString()}
-- =============================================================================
--
-- EXECUTION INSTRUCTIONS:
-- 1. Execute STEP 1 to back up current active personalizations.
-- 2. Check your environment table name:
--      SELECT table_name FROM user_tables WHERE table_name LIKE '%PERSONALIZATION%';
--    (Standard names: FLEXI_PERSONALIZATION or MIA_PERSONALIZATION).
-- 3. Execute STEP 2 (PL/SQL Blocks) in SQL Developer, SQL*Plus, Toad, or DBeaver.
-- 4. Execute STEP 3 to verify rows updated.
-- 5. COMMIT.
-- =============================================================================

SET DEFINE OFF;
SET SERVEROUTPUT ON;

-- =============================================================================
-- STEP 1: PRE-MIGRATION SAFETY BACKUP
-- =============================================================================
PROMPT Creating backup of current personalizations...

BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE BK_PZN_${new Date().toISOString().slice(0,10).replace(/-/g,'')} AS
    SELECT * FROM FLEXI_PERSONALIZATION
    WHERE APPLICATION_NAME = ''STD - Receiving On PLT''';
  DBMS_OUTPUT.PUT_LINE('Backup table created: BK_PZN_${new Date().toISOString().slice(0,10).replace(/-/g,'')}');
EXCEPTION
  WHEN OTHERS THEN
    -- If FLEXI_PERSONALIZATION doesn't exist, try MIA_PERSONALIZATION
    BEGIN
      EXECUTE IMMEDIATE '
        CREATE TABLE BK_PZN_${new Date().toISOString().slice(0,10).replace(/-/g,'')} AS
        SELECT * FROM MIA_PERSONALIZATION
        WHERE APPLICATION_NAME = ''STD - Receiving On PLT''';
      DBMS_OUTPUT.PUT_LINE('Backup table created from MIA_PERSONALIZATION');
    EXCEPTION
      WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Notice: Check table name for backup (may already exist or different table name).');
    END;
END;
/

-- =============================================================================
-- STEP 2: APPLY PWA PERSONALIZATIONS (CLOB-SAFE PL/SQL BLOCKS)
-- =============================================================================
`;

records.forEach((rec, idx) => {
  const chunks = chunkString(rec.detail, 2500);
  const pageCondition = rec.pageName.trim() === '' 
    ? `(PAGE_NAME IS NULL OR TRIM(PAGE_NAME) IS NULL OR PAGE_NAME = ' ')`
    : `PAGE_NAME = '${rec.pageName.replace(/'/g, "''")}'`;

  sql += `
-- -----------------------------------------------------------------------------
-- Record ${idx + 1} of ${records.length}: Page "${rec.pageName || '(Subpage)'}"
-- Component: ${rec.applicationName}
-- -----------------------------------------------------------------------------
DECLARE
  v_clob CLOB;
  v_updated NUMBER := 0;
  v_table_name VARCHAR2(100) := 'FLEXI_PERSONALIZATION';
BEGIN
  DBMS_LOB.CREATETEMPORARY(v_clob, TRUE);

${chunks.map((c, ci) => `  DBMS_LOB.WRITEAPPEND(v_clob, ${c.length}, q'~${c}~');`).join('\n')}

  -- Attempt update on FLEXI_PERSONALIZATION
  BEGIN
    EXECUTE IMMEDIATE '
      UPDATE FLEXI_PERSONALIZATION
      SET PERSONALIZATION_DETAIL = :1,
          ENABLED = ''${rec.enabled}''
      WHERE APPLICATION_NAME = ''${rec.applicationName.replace(/'/g, "''")}''
        AND ${pageCondition}
        AND PERSONALIZATION_LEVEL = ${rec.personalizationLevel}
        AND PERSONALIZATION_VALUE = ''${rec.personalizationValue}'''
    USING v_clob;
    
    v_updated := SQL%ROWCOUNT;
    DBMS_OUTPUT.PUT_LINE('Record ${idx + 1} [${rec.pageName || '(Subpage)'}]: Updated ' || v_updated || ' row(s) in FLEXI_PERSONALIZATION');
  EXCEPTION
    WHEN OTHERS THEN
      -- Fallback to MIA_PERSONALIZATION if FLEXI_PERSONALIZATION is not present
      EXECUTE IMMEDIATE '
        UPDATE MIA_PERSONALIZATION
        SET PERSONALIZATION_DETAIL = :1,
            ENABLED = ''${rec.enabled}''
        WHERE APPLICATION_NAME = ''${rec.applicationName.replace(/'/g, "''")}''
          AND ${pageCondition}
          AND PERSONALIZATION_LEVEL = ${rec.personalizationLevel}
          AND PERSONALIZATION_VALUE = ''${rec.personalizationValue}'''
      USING v_clob;
      
      v_updated := SQL%ROWCOUNT;
      DBMS_OUTPUT.PUT_LINE('Record ${idx + 1} [${rec.pageName || '(Subpage)'}]: Updated ' || v_updated || ' row(s) in MIA_PERSONALIZATION');
  END;

  IF v_updated = 0 THEN
    DBMS_OUTPUT.PUT_LINE('WARNING: Record ${idx + 1} [${rec.pageName || '(Subpage)'}] did not match any existing row. Check APPLICATION_NAME / PAGE_NAME.');
  END IF;

  DBMS_LOB.FREETEMPORARY(v_clob);
END;
/
`;
});

sql += `
-- =============================================================================
-- STEP 3: VERIFICATION QUERY
-- =============================================================================
PROMPT Verifying updated personalizations...

SELECT 
    APPLICATION_NAME,
    NVL(PAGE_NAME, '(Subpage)') AS PAGE_NAME,
    PERSONALIZATION_LEVEL,
    PERSONALIZATION_VALUE,
    ENABLED,
    DBMS_LOB.GETLENGTH(PERSONALIZATION_DETAIL) AS DETAIL_BYTES
FROM FLEXI_PERSONALIZATION
WHERE APPLICATION_NAME = 'STD - Receiving On PLT'
ORDER BY PAGE_NAME;

-- =============================================================================
-- STEP 4: COMMIT TRANSACTION
-- =============================================================================
-- When verified, run:
COMMIT;
PROMPT Migration successfully applied and committed!

-- If rollback is required before commit:
-- ROLLBACK;
`;

const sqlOutPath = path.join(__dirname, 'pwa-migrated-output', 'Personalization_PWA_DB_Migration.sql');
fs.writeFileSync(sqlOutPath, sql, 'utf8');

console.log(`\nSQL Script written successfully: ${sqlOutPath}`);
console.log(`File size: ${(fs.statSync(sqlOutPath).size / 1024).toFixed(2)} KB`);
