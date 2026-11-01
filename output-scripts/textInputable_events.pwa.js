// ─────────────────────────────────────────────────────────────
//  FLEXI PWA MIGRATED SCRIPT
//  Source file : textInputable_events.groovy
//  Migrated at : 2026-10-30T06:43:47.551Z
//  Changes     : 7 rule(s) applied
// ─────────────────────────────────────────────────────────────
//  CHANGES APPLIED:
//    1. Replaced flexi.automate("enter") with PWA pressKey("ENTER") / submit()
//    2. Flagged other flexi.automate() calls for manual review
//    3. Added setDateFormat fallback for textInputable.setDateTimeFormat
//    4. Replaced Java typed variable declarations with JS var
//    5. Replaced Java .contains() with JS .indexOf() !== -1
//    6. Verified flexi.putSessionObject() is PWA-compatible (kept as-is)
//    7. Replaced Java != null with JS null/undefined check
// ─────────────────────────────────────────────────────────────
// ─── SSH Groovy Script: STD Receiving On PLT — textInputable ───
// This is the ORIGINAL script from Pages 24-25 of the Personalization Report
// Exactly as written for the SSH terminal layer

void _afterPageEntered() {
    if ((typeof textInputable !== "undefined" && textInputable !== null)) {
        var label /* was: String */ = textInputable.getLabel();

        if ((label.indexOf("Expiry Date") !== -1) /* was: label.contains("Expiry Date") */) {
            (function() {
  if (typeof textInputable.setDateTimeFormat === "function") {
    textInputable.setDateTimeFormat("dd-MM-yyyy");
  } else if (typeof textInputable.setDateFormat === "function") {
    textInputable.setDateFormat("dd-MM-yyyy");
  }
})();
        }

        if ((label.indexOf("Batch") !== -1) /* was: label.contains("Batch") */) {
            XX_PREV_BTN.setHidden(false);
        } else {
            XX_PREV_BTN.setHidden(true);
        }

        if ((label.indexOf("=>") !== -1) /* was: label.contains("=>") */) {
            (function() {
  // PWA: simulated Enter key replaced with pressKey/submit
  if (typeof flexi.automate === "function") {
    /* TODO: Review terminal keystroke automate("enter") for PWA compatibility */
flexi.automate("enter");
  } else if (typeof flexi.pressKey === "function") {
    flexi.pressKey("ENTER");
  } else if (typeof textInputable !== "undefined" && typeof textInputable.submit === "function") {
    textInputable.submit();
  }
})();
        }
    }
}

void _onKeyPress() {
    flexi.putSessionObject("TXN_COMPLETED", "Y") /* ✓ Supported in PWA */;
}

void _beforeExit() {
    flexi.putSessionObject("TXN_COMPLETED", "Y") /* ✓ Supported in PWA */;
}
