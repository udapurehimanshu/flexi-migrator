// ─────────────────────────────────────────────────────────────
//  FLEXI PWA MIGRATED SCRIPT
//  Source file : XX_PREV_BTN_afterClick.groovy
//  Migrated at : 2026-10-30T06:43:47.554Z
//  Changes     : 3 rule(s) applied
// ─────────────────────────────────────────────────────────────
//  CHANGES APPLIED:
//    1. Replaced flexi.automate("ctrl","X") with PWA goBack() navigation
//    2. Flagged other flexi.automate() calls for manual review
//    3. Verified flexi.putSessionObject() is PWA-compatible (kept as-is)
// ─────────────────────────────────────────────────────────────
// ─── SSH Groovy Script: XX_PREV_BTN — _afterClick ───
// Page 26 of the Personalization Report — back navigation

void _afterClick() {
    flexi.putSessionObject("TXN_COMPLETED", "Y") /* ✓ Supported in PWA */;
    (function() {
  // PWA: Ctrl+X screen exit replaced with standard navigation
  if (typeof flexi.goBack === "function") {
    flexi.goBack();
  } else if (typeof flexi.previousScreen === "function") {
    flexi.previousScreen();
  } else if (typeof btnPreviousscreen !== "undefined" && btnPreviousscreen.click) {
    btnPreviousscreen.click();
  } else {
    /* TODO: Review terminal keystroke automate("ctrl", "X") for PWA compatibility */
flexi.automate("ctrl", "X"); // fallback for hybrid mode
  }
})();
}
