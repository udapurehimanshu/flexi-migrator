# Intellinum Flexi PWA Migrator (SSH → PWA)

A production-grade, zero-dependency Node.js platform that migrates legacy **Intellinum Flexi Personalization** configurations (Groovy / BeanShell scripts, custom fields, web services, LOVs) to modern **Flexi PWA JavaScript**.

## Key Features

- **100% Dynamic & File-Dependent**: Accepts one file at a time (`.pdf`, `.txt`, `.xml`), extracts real page counts, component hierarchies, and scripts without any hardcoded fallbacks or cross-file state leakage.
- **AST-Masked Migration Compiler**:
  - 28+ migration rules covering collection declarations, `new JSONObject()`, static type helpers, typed getters, and keystroke mappings (`flexi.automate("ctrl", "X")` $\rightarrow$ `flexi.backToPreviousPage()`).
  - AST syntax validation (`new Function(code)`) with balanced parentheses and member-chain expression parsing.
  - 100% valid JavaScript compilation across all production test reports.
- **Coordinate-Based PDF Table Extraction**: Separates Property Names (`x < 216.0`) from Values (`x >= 216.0`) and stitches line-wrapped comments/strings without corruption.
- **Intellinum Flexi PWA Standards**:
  - Automatically supplies `ORIGINAL_DEFAULTS` for all property definitions.
  - Enforces `\r\n` line endings inside `"script:\r\n..."`.
  - Attaches page-level properties and custom fields (`additional_component`) to component `"-1"`.
  - Generates official `personalization=` URL-encoded XML export payload.
- **PWA Text Payload Snippet Viewer & Downloader**: Dedicated viewer on the UI for real-time inspection, copying, and downloading the `.txt` payload.
- **Oracle PL/SQL Generator**: Outputs database-direct CLOB update scripts with safety backup table creation and `DBMS_LOB.WRITEAPPEND` chunking (2,500 characters per block).
- **Interactive Migration Studio**:
  - Screen & Component Hierarchy Inspector
  - Side-by-Side Code Diff & Live Script Editor
  - Dynamic PWA Migration Audit Report (`.md` / PDF print)
  - Live Groovy-to-PWA Scratchpad
  - Intellinum Runtime API Catalog (292 methods across `flexi`, `FlexiWebService`, `Page`, `TextInputField`)

## Getting Started

### Prerequisites
- Node.js (v18 or higher)

### Running the Application
```bash
# Start the web server
node server.js
```
Open your browser and navigate to:
```
http://localhost:3000
```

### Verification Test Suite
Run the test suite across all 8 production personalization reports:
```bash
node test_all_files.js
```

## Project Structure
- `server.js` - Native Node.js HTTP server and REST endpoints
- `pdf_pzn_parser.js` - Coordinate-based structural PDF report parser
- `pure_pdf_parser.js` - Native zlib PDF stream decoder and text layout extractor
- `flexi_converter.js` - AST-masked Groovy-to-PWA JavaScript compiler and Oracle SQL generator
- `pwa_report_generator.js` - Markdown PWA migration audit report generator
- `public/index.html` - Complete single-page Migration Studio web application
- `all_intellinum_methods.json` - Intellinum Flexi client runtime API catalog (292 methods)
- `IMS PERSONALIZATION DPW/` - Sample production personalization reports

## License
MIT

