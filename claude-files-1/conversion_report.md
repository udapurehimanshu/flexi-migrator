# Conversion report

Source: Report_Personalization__17_.pdf
Output: out_payload.txt

Pages converted: 3
- STD - Receiving On PLT / STD - Receiving On PLT : 22 components, 32 fields with properties, 14 scripts
- STD - Receiving On PLT / Receiving : 1 components, 3 fields with properties, 1 scripts
- STD - Receiving On PLT / (blank page name) : 2 components, 3 fields with properties, 6 scripts

## Items needing review (5)

- **STD - Receiving On PLT/textLPN** `_afterFocus`: SEMANTIC: 'task_loc_list.length' counts the single collection pushed into it (always 1). Source logic bug (SSH has the same); count 'newHp.length' if distinct items were intended.
- **STD - Receiving On PLT/textShipment** `_beforeExit`: SEMANTIC: 'task_loc_list.length' counts the single collection pushed into it (always 1). Source logic bug (SSH has the same); count 'newHp.length' if distinct items were intended.
- **STD - Receiving On PLT/textASN** `_beforeExit`: SEMANTIC: 'task_loc_list.length' counts the single collection pushed into it (always 1). Source logic bug (SSH has the same); count 'newHp.length' if distinct items were intended.
- **STD - Receiving On PLT/textASN** `_beforeExit`: INFO: the same web service is called more than once in this script (copied from source).
- **STD - Receiving On PLT/textPlt** `_afterFocus`: SEMANTIC: 'task_loc_list.length' counts the single collection pushed into it (always 1). Source logic bug (SSH has the same); count 'newHp.length' if distinct items were intended.
- **(blank page name)**: sub-page - Flexi may not bind personalizations to a page without a name in the PWA. Test this page manually.

## Comparison with reference payload
```
Page 'STD - Receiving On PLT' vs reference 'STD - Receiving On PLT'
  note: original_value of textPlt.label = 'Plt' in reference (not present in the SSH report)
Page 'Receiving' vs reference 'Receiving'
Page '(blank)' vs reference '(blank)'

Structure/value match: 178 / 183 items identical
Script similarity to reference (whitespace-insensitive):
  textLPN                  _afterFocus          0.977   <-- differs
  textLPN                  _beforeExit          1.000
  textShipment             _beforeExit          0.978   <-- differs
  XX_LPN_AS_PLT            _beforeExit          1.000
  -1                       _afterPageEntered    1.000
  XX_HAND_TYPE             _afterFocus          1.000
  XX_HAND_TYPE             _beforeExit          1.000
  GET_SHIPMENT_WS_CPY      _onCallingRequest    1.000
  textASN                  _beforeExit          0.979   <-- differs
  GET_SHIPMENT_WS          _onCallingRequest    1.000
  textPlt                  _afterFocus          0.977   <-- differs
  textPlt                  _beforeExit          1.000
  XX_BILLING_INFO          _afterClick          1.000
  btnEndPallet             _afterClick          1.000
  btnEndLPN                _afterClick          1.000
  textInputable            _onKeyPress          1.000
  textInputable            _afterFocus          1.000
  textInputable            _beforeExit          1.000
  GET_IB_SHIP_BATCH        _onResponseReceived  0.999   <-- differs
  -1                       _afterPageEntered    1.000
  XX_PREV_BTN              _afterClick          1.000
```
