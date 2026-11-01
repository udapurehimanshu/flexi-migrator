// ─── SSH Groovy Script: XX_PREV_BTN — _afterClick ───
// Page 26 of the Personalization Report — back navigation

void _afterClick() {
    flexi.putSessionObject("TXN_COMPLETED", "Y");
    flexi.automate("ctrl", "X");
}
