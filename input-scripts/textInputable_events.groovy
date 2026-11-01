// ─── SSH Groovy Script: STD Receiving On PLT — textInputable ───
// This is the ORIGINAL script from Pages 24-25 of the Personalization Report
// Exactly as written for the SSH terminal layer

void _afterPageEntered() {
    if (textInputable != null) {
        String label = textInputable.getLabel();

        if (label.contains("Expiry Date")) {
            textInputable.setDateTimeFormat("dd-MM-yyyy");
        }

        if (label.contains("Batch")) {
            XX_PREV_BTN.setHidden(false);
        } else {
            XX_PREV_BTN.setHidden(true);
        }

        if (label.contains("=>")) {
            flexi.automate("enter");
        }
    }
}

void _onKeyPress() {
    flexi.putSessionObject("TXN_COMPLETED", "Y");
}

void _beforeExit() {
    flexi.putSessionObject("TXN_COMPLETED", "Y");
}
