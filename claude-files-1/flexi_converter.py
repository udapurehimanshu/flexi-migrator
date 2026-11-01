#!/usr/bin/env python3
"""
Flexi SSH personalization report (PDF)  ->  PWA import file (TXT for Flexi Admin)

Pipeline:  extract (PDF -> model) -> translate (Java/BeanShell -> JS) -> build (model -> XML -> TXT) -> validate

Usage:
    python3 converter.py REPORT.pdf [-o OUT.txt] [--ref REFERENCE.txt] [--report REPORT.md]
"""
import argparse, collections, difflib, json, os, re, subprocess, sys, tempfile
import urllib.parse
from xml.sax.saxutils import escape

import pdfplumber

# ----------------------------------------------------------------------------
# 1. EXTRACTION  (PDF -> model)
# ----------------------------------------------------------------------------
VALUE_X = 216.0          # property-value column starts at x=217
NEWLINE = "\r\n"


class Ln:
    __slots__ = ("page", "top", "x0", "x1", "size", "bold", "text", "chars")

    def __init__(self, page, top, chars):
        chars = sorted(chars, key=lambda c: c["x0"])
        self.page, self.top, self.chars = page, top, chars
        self.x0, self.x1 = chars[0]["x0"], chars[-1]["x1"]
        self.size = chars[0]["size"]
        self.bold = "Bold" in chars[0]["fontname"]
        self.text = "".join(c["text"] for c in chars)


def read_lines(pdf_path):
    out = []
    with pdfplumber.open(pdf_path) as pdf:
        for pn, page in enumerate(pdf.pages):
            rows = collections.OrderedDict()
            for c in page.chars:
                key = None
                for k in rows:
                    if abs(k - c["top"]) < 1.5:
                        key = k
                        break
                rows.setdefault(c["top"] if key is None else key, []).append(c)
            for top in sorted(rows):
                out.append(Ln(pn, top, rows[top]))
    return out


def join_wrapped(vlines, right_edge):
    """vlines: [(text, x1, first_chunk_width)] for one property value.
    Re-joins PDF soft-wraps, keeps real newlines.
    A wrap is assumed only when (a) the next word would not have fitted on the previous line (greedy
    wrapping) AND (b) code-syntax sanity rules agree (scripts only)."""
    if not vlines:
        return ""
    is_script = vlines[0][0].strip().startswith("script:")
    res = [vlines[0][0]]
    for i in range(1, len(vlines)):
        prev_text, prev_x1, _ = vlines[i - 1]
        cur_text, _, cur_chunk_w = vlines[i]
        prev_s = prev_text.rstrip()
        wrapped, joiner = False, " "
        if cur_text and not cur_text[0].isspace() and prev_s:
            gap = 0.0 if prev_s.endswith("-") else 2.8
            fits = prev_x1 + gap + cur_chunk_w <= right_edge + 0.6
            if not fits:
                wrapped = True
                no_inner_space = (" " not in prev_s.strip())
                if prev_s.endswith("-") or (no_inner_space and prev_x1 > right_edge - 7):
                    joiner = ""
                if is_script:
                    ps = prev_s.strip()
                    if ps.startswith("//") or ps.startswith("/*"):
                        wrapped = ps.endswith("-")            # comment continues only on hyphen-break
                    elif cur_text.startswith(("//", "/*")):
                        wrapped = False
                    elif ps[-1] in ";{}" and not (no_inner_space and prev_x1 > right_edge - 7):
                        wrapped = False                        # statement/block ended: real newline
        if wrapped:
            res[-1] = res[-1].rstrip() + joiner + cur_text
        else:
            res.append(cur_text)
    return NEWLINE.join(s.rstrip() for s in res)


def extract(pdf_path):
    lines = read_lines(pdf_path)
    # global right edge of value column
    right_edge = max((l.x1 for l in lines if l.size < 11 and l.x0 >= VALUE_X - 1), default=542.0)

    blocks, blk = [], None
    mode, cur_field, cur_prop = None, None, None
    nf_cols = None
    for ln in lines:
        t = ln.text.strip()
        if not t and ln.size > 11:
            continue
        if t.startswith("<< Start Personalization"):
            blk = dict(app="", page="", level="", value="", new_fields=[], page_props=collections.OrderedDict(),
                       fields=collections.OrderedDict())
            blocks.append(blk)
            mode, cur_field, cur_prop = "head", None, None
            continue
        if blk is None or t.startswith("<< End Personalization"):
            if t.startswith("<< End"):
                mode, cur_prop = None, None
            continue
        if t == "FLEXI PERSONALIZATION REPORT":
            continue
        m = re.match(r"Application Name:\s*(.*)$", t)
        if m and mode == "head":
            blk["app"] = m.group(1).strip(); continue
        m = re.match(r"Page Name:\s*(.*)$", t)
        if m and mode == "head":
            blk["page"] = m.group(1).strip(); continue
        m = re.match(r"Personalization Level\s*:\s*(.*)$", t)
        if m and mode == "head":
            blk["level"] = m.group(1).strip(); continue
        m = re.match(r"Personalization Value\s*:\s*(.*)$", t)
        if m and mode == "head":
            blk["value"] = m.group(1).strip(); continue
        if ln.bold and ln.size > 11:
            if t == "New Fields":
                mode, nf_cols = "newfields", None; continue
            if t == "Page Level Properties":
                mode, cur_field, cur_prop = "page", "-1", None; continue
            if t == "Field Level Properties":
                mode, cur_prop = "await_field", None; continue
            if t == "Barcode Level Properties":
                mode, cur_prop = "barcode", None; continue
            m = re.match(r"Field Name:\s*(\S+)", t)
            if m:
                cur_field = m.group(1); mode, cur_prop = "field", None
                blk["fields"].setdefault(cur_field, collections.OrderedDict())
                continue
            if t.replace(" ", "") == "FieldNameTypePosition":
                s = ln.text
                nf_cols = (ln.chars[s.index("Type")]["x0"] - 1, ln.chars[s.index("Position")]["x0"] - 1)
                continue
            if t.replace(" ", "") == "PropertyNameProperty Value".replace(" ", ""):
                continue
        if mode == "newfields":
            if nf_cols is None or ln.size > 11:
                continue
            a = "".join(c["text"] for c in ln.chars if c["x0"] < nf_cols[0]).strip()
            b = "".join(c["text"] for c in ln.chars if nf_cols[0] <= c["x0"] < nf_cols[1]).strip()
            c_ = "".join(c["text"] for c in ln.chars if c["x0"] >= nf_cols[1]).strip()
            if a:
                blk["new_fields"].append(dict(name=a, type=b, position=c_))
            continue
        if mode in ("page", "field") and ln.size < 11:
            name = "".join(c["text"] for c in ln.chars if c["x0"] < VALUE_X and c["text"].strip()).strip()
            vch = [c for c in ln.chars if c["x0"] >= VALUE_X - 0.5]
            vtext = "".join(c["text"] for c in vch)
            # width of the first unbreakable chunk of this value line (for wrap test)
            chunk_w = 0.0
            if vch:
                first = vch[0]["x0"]
                end = first
                for c in vch:
                    if c["text"] == " ":
                        break
                    end = c["x1"]
                chunk_w = end - first
            store = blk["page_props"] if mode == "page" else blk["fields"][cur_field]
            if name:
                cur_prop = name
                store[cur_prop] = [(vtext, ln.x1, chunk_w)]
            elif cur_prop is not None:
                store[cur_prop].append((vtext, ln.x1, chunk_w))
    # collapse values
    for b in blocks:
        for store in [b["page_props"]] + list(b["fields"].values()):
            for k, v in list(store.items()):
                store[k] = join_wrapped(v, right_edge).strip("\r\n").lstrip()
    return blocks


# ----------------------------------------------------------------------------
# 2. TRANSLATION  (Java / BeanShell  ->  JavaScript)
# ----------------------------------------------------------------------------
STR = r"\x01S\d+\x01"
CHAIN = r"[\w$]+(?:\.[\w$]+|\[[^\]\[]*\]|\([^()]*\))*"


def _mask(code):
    """Replace comments and string literals by placeholders."""
    strings, comments = [], []
    out, i, n = [], 0, len(code)
    while i < n:
        ch = code[i]
        if code.startswith("//", i):
            j = code.find("\n", i)
            j = n if j < 0 else j
            comments.append(code[i:j]); out.append("\x02C%d\x02" % (len(comments) - 1)); i = j
        elif code.startswith("/*", i):
            j = code.find("*/", i + 2)
            j = n if j < 0 else j + 2
            comments.append(code[i:j]); out.append("\x02C%d\x02" % (len(comments) - 1)); i = j
        elif ch in "\"'":
            j = i + 1
            while j < n and code[j] != ch:
                j += 2 if code[j] == "\\" else 1
            j = min(j + 1, n)
            strings.append(code[i:j]); out.append("\x01S%d\x01" % (len(strings) - 1)); i = j
        else:
            out.append(ch); i += 1
    return "".join(out), strings, comments


def _unmask(code, strings, comments):
    for _ in range(3):
        code = re.sub(r"\x01S(\d+)\x01", lambda m: strings[int(m.group(1))], code)
        code = re.sub(r"\x02C(\d+)\x02", lambda m: comments[int(m.group(1))], code)
    return code


def _balanced(code, open_idx):
    """index of the ')' matching '(' at open_idx"""
    depth = 0
    for i in range(open_idx, len(code)):
        if code[i] == "(":
            depth += 1
        elif code[i] == ")":
            depth -= 1
            if depth == 0:
                return i
    return -1


def _sub_call(code, pattern, repl):
    """pattern ends with '\\(' ; repl(match, args) -> text.  Handles nested parentheses."""
    rx = re.compile(pattern)
    pos = 0
    while True:
        m = rx.search(code, pos)
        if not m:
            return code
        o = m.end() - 1
        c = _balanced(code, o)
        if c < 0:
            pos = m.end(); continue
        new = repl(m, code[o + 1:c])
        code = code[:m.start()] + new + code[c + 1:]
        pos = m.start() + len(new)


def _sval(strings, ph):
    m = re.fullmatch(r"\x01S(\d+)\x01", ph.strip())
    return strings[int(m.group(1))][1:-1] if m else None


def translate_script(src):
    """returns (js_code, warnings[])"""
    warns = []
    code, strings, comments = _mask(src)
    colls, jsons = set(), set()

    code = re.sub(r"\b(?:org\.json|java\.util)\.", "", code)

    # collection / json declarations
    def decl_coll(m):
        colls.add(m.group(2))
        return "var %s = %s" % (m.group(2), "{}" if "Map" in m.group(1) else "[]")
    code = re.sub(r"\b(ArrayList|HashSet|LinkedList|List|Set|HashMap|Map)\s*(?:<[^>;]*>)?\s+(\w+)\s*=\s*new\s+\w+\s*(?:<[^>;]*>)?\s*\(\s*\)", decl_coll, code)
    for m in re.finditer(r"\b(?:JSONObject|JSONArray)\s+(\w+)\s*=", code):
        jsons.add(m.group(1))

    # new JSONObject(x) / new JSONArray(x)
    def newjson(m, args):
        a = args.strip()
        if not a:
            return "{}" if "Object" in m.group(1) else "[]"
        return '(typeof %s === "string" ? JSON.parse(%s) : %s)' % (a, a, a)
    code = _sub_call(code, r"\bnew\s+(JSONObject|JSONArray)\s*\(", newjson)

    # equals()
    def lit_equals(m, args):
        return "(%s === %s)" % (args.strip(), m.group(1))
    code = _sub_call(code, r"(%s)\s*\.equals\(" % STR, lit_equals)
    def gen_equals(m, args):
        return "(%s === %s)" % (m.group(1), args.strip())
    for _ in range(3):
        code = _sub_call(code, r"(%s)\.equals\(" % CHAIN, gen_equals)

    # static helpers
    code = re.sub(r"\bDouble\.(?:parseDouble|valueOf)\(", "parseFloat(", code)
    code = re.sub(r"\bInteger\.(?:parseInt|valueOf)\(", "parseInt(", code)
    code = re.sub(r"\bString\.valueOf\(", "String(", code)
    code = re.sub(r"\bnew\s+(?:Double|Integer)\(", "Number(", code)

    # typed getters
    def num_getter(fn):
        def r(m):
            name = _sval(strings, m.group(2))
            acc = "." + name if name and re.fullmatch(r"[A-Za-z_]\w*", name) else "[%s]" % m.group(2)
            return "(%s(%s%s) || 0)" % (fn, m.group(1), acc)
        return r
    code = re.sub(r"(%s)\.getInt\((%s)\)" % (CHAIN, STR), num_getter("Number"), code)
    code = re.sub(r"(%s)\.getLong\((%s)\)" % (CHAIN, STR), num_getter("Number"), code)
    code = re.sub(r"(%s)\.getDouble\((%s)\)" % (CHAIN, STR), num_getter("parseFloat"), code)
    code = re.sub(r"\.getString\((%s)\)" % STR, lambda m: "." + _sval(strings, m.group(1)), code)

    def prop(m):
        name = _sval(strings, m.group(1))
        return "." + name if re.fullmatch(r"[A-Za-z_]\w*", name or "") else "[%s]" % m.group(1)
    code = re.sub(r"\.(?:getJSONArray|getJSONObject|opt|optString|optJSONArray|optJSONObject)\((%s)\)" % STR, prop, code)
    code = re.sub(r"\.getJSONObject\(([^()]+)\)", r"[\1]", code)
    code = re.sub(r"\.getJSONArray\(([^()]+)\)", r"[\1]", code)
    code = re.sub(r"\.get\((%s)\)" % STR, prop, code)
    code = re.sub(r"\.get\(([^()]+)\)", r"[\1]", code)

    # JSON put
    code = re.sub(r"\.put\((%s)\s*,\s*([^;]+?)\)\s*;" % STR,
                  lambda m: (prop(m) + " = %s;" % m.group(2)) if prop(m).startswith(".") else "[%s] = %s;" % (m.group(1), m.group(2)), code)

    code = re.sub(r"\.put\(([^,;]*)\)\s*;", r".push(\1);", code)

    # collections
    for name in colls:
        code = re.sub(r"\b%s\.add\(" % re.escape(name), "%s.push(" % name, code)
        code = re.sub(r"\b%s\.size\(\)" % re.escape(name), "%s.length" % name, code)
        code = re.sub(r"\b%s\.remove\(([^()]*)\)" % re.escape(name), r"%s.splice(\1, 1)" % name, code)
    code = re.sub(r"\.length\(\)", ".length", code)
    code = re.sub(r"\.size\(\)", ".length", code)
    code = re.sub(r"\.isEmpty\(\)", ".length === 0", code)
    code = re.sub(r"\.contains\(([^()]*)\)", r".indexOf(\1) !== -1", code)

    # toString
    def tostr(m):
        return "JSON.stringify(%s)" % m.group(1) if m.group(1) in jsons else "String(%s)" % m.group(1)
    code = re.sub(r"(%s)\.toString\(\)" % CHAIN, tostr, code)

    # typed declarations -> var
    code = re.sub(r"\b(?:final\s+)?(?:int|long|double|float|short|boolean|String|Integer|Double|Long|Boolean|Object|JSONObject|JSONArray)\s+(?=[A-Za-z_]\w*\s*(?:=|;|,|\)))", "var ", code)
    code = re.sub(r"\bcatch\s*\(\s*[\w.]+\s+(\w+)\s*\)", r"catch (\1)", code)

    # != void
    code = re.sub(r"\b(\w+)\s*(!=|==)\s*void\b",
                  lambda m: ('(typeof %s !== "undefined" && %s !== null)' if m.group(2) == "!=" else '(typeof %s === "undefined" || %s === null)') % (m.group(1), m.group(1)), code)

    # logger.* -> comment (runtime support unknown; logging is not functional)
    code = re.sub(r"^([ \t]*)(logger\.\w+\(.*\);?)[ \t]*$", r"\1//\2", code, flags=re.M)

    # learned rule (from the customer's own migrated file): Ctrl-X "previous screen"
    code = re.sub(r'flexi\.automate\(\s*(%s)\s*,\s*(%s)\s*\)' % (STR, STR),
                  lambda m: "flexi.backToPreviousPage()" if (_sval(strings, m.group(1)).lower() == "ctrl" and _sval(strings, m.group(2)).upper() == "X") else m.group(0),
                  code)

    # ------------- semantic warnings -----------------
    for lst in colls:
        for inner in colls:
            if lst != inner and re.search(r"\b%s\.push\(\s*%s\s*\)" % (lst, inner), code) and re.search(r"\b%s\.length\b" % lst, code):
                warns.append("SEMANTIC: '%s.length' counts the single collection pushed into it (always 1). Source logic bug (SSH has the same); count '%s.length' if distinct items were intended." % (lst, inner))
    if re.search(r"\bcallWebService\(null\);.*\bcallWebService\(null\);", code.replace("\n", " ")) and \
       len(set(re.findall(r"(\w+)\.callWebService", code))) < len(re.findall(r"\w+\.callWebService", code)) \
       and "/*" not in code:
        warns.append("INFO: the same web service is called more than once in this script (copied from source).")

    out = _unmask(code, strings, comments)

    # leftovers = untranslated Java
    stripped, _, _ = _mask(out)
    for pat, msg in [(r"\bnew\s+[A-Z]\w*", "'new <Type>' left"), (r"\.getJSON\w*\(", "JSON getter left"),
                     (r"\.equals\(", ".equals left"), (r"\binstanceof\b", "instanceof"),
                     (r"\(\s*(?:int|double|long)\s*\)", "Java cast"), (r"<\s*(?:String|Integer|Object)\s*>", "generics"),
                     (r"\bHashMap\b|\bTreeMap\b", "Map type")]:
        if re.search(pat, stripped):
            warns.append("UNTRANSLATED: %s -> review manually" % msg)
    return out, warns


_CAT = None


def _catalog():
    global _CAT
    if _CAT is None:
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flexi_api_catalog.json")
        _CAT = json.load(open(p)) if os.path.exists(p) else {}
    return _CAT


def _methods_of(cls):
    cat, out = _catalog(), set()
    while cls in cat:
        out |= set(cat[cls]["methods"]); cls = cat[cls]["extends"]
    return out


TYPE_CLASS = {"Text": "LOVField", "Web Service": "FlexiWebService", "Button": "Button"}


def check_api(js, receivers):
    """Verify flexi.* and field.* method names against the Intellinum JavaDoc catalog."""
    if not _catalog():
        return []
    masked, _, _ = _mask(js)
    masked = re.sub(r"\x02C\d+\x02", "", masked)
    warns, flexi_m = [], _methods_of("FlexiAPI")
    ui_union = set()
    for c in ("InputField", "TextInputField", "LOVField", "Button", "Component", "Label", "FlexiUIObject"):
        ui_union |= _methods_of(c)
    for m in re.finditer(r"\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\(", masked):
        recv, meth = m.group(1), m.group(2)
        if recv == "flexi":
            if meth not in flexi_m:
                warns.append("API: flexi.%s() is not in the Intellinum JavaDoc" % meth)
        elif recv in receivers:
            allowed = _methods_of(TYPE_CLASS[receivers[recv]]) if receivers[recv] in TYPE_CLASS else ui_union
            if meth not in allowed and meth not in ui_union:
                warns.append("API: %s.%s() is not documented for %s" % (recv, meth, receivers[recv]))
    return warns


def node_check(js):
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
            f.write("(function(){\n" + js + "\n})")
            p = f.name
        r = subprocess.run(["node", "--check", p], capture_output=True, text=True, timeout=20)
        os.unlink(p)
        return None if r.returncode == 0 else r.stderr.strip().splitlines()[-1:][0] if r.stderr.strip() else "syntax error"
    except FileNotFoundError:
        return None


# ----------------------------------------------------------------------------
# 3. BUILD  (model -> JSON -> XML -> TXT)
# ----------------------------------------------------------------------------
ORIGINAL_DEFAULTS = {"_lovSourceType": "Database", "label": "LOV", "_readOnly": "false", "lovEnabled": "false",
                     "_rendered": "default", "_lovValidation": "false", "text": "Button", "_dateFormat": "MMddYY"}
LEVELS = {"site": ("1", "Global")}


def to_pwa_value(prop, val, ctx, report, receivers=None):
    if val.startswith("script:"):
        body = val[len("script:"):].replace("\r\n", "\n").strip("\n")
        js, warns = translate_script(body)
        err = node_check(js)
        warns += check_api(js, receivers or {})
        for w in warns:
            report.append((ctx, prop, w))
        if err:
            report.append((ctx, prop, "SYNTAX ERROR after translation: %s" % err))
        return "script:" + NEWLINE + js.replace("\n", NEWLINE)
    return val


def build(blocks, report):
    items = []
    for b in blocks:
        lvl = LEVELS.get(b["level"].strip().lower())
        if lvl is None:
            report.append((b["page"] or "(blank)", "", "UNSUPPORTED LEVEL '%s' - defaulted to Global, check" % b["level"]))
            lvl = ("1", "Global")
        pz = collections.OrderedDict()
        types = {n["name"]: n["type"] for n in b["new_fields"]}
        receivers = {n: "Existing" for n in b["fields"]}
        receivers.update(types)
        for fname, props in b["fields"].items():
            d = collections.OrderedDict()
            for k, v in props.items():
                d[k] = {"original_value": ORIGINAL_DEFAULTS.get(k, ""),
                        "personalize_value": to_pwa_value(k, v, "%s/%s" % (b["page"] or "(blank)", fname), report, receivers)}
            pz[fname] = d
        page = collections.OrderedDict()
        page["additional_component"] = [{"name": n["name"], "position": n["position"], "type": n["type"]} for n in b["new_fields"]]
        for k, v in b["page_props"].items():
            page[k] = {"original_value": ORIGINAL_DEFAULTS.get(k, ""),
                       "personalize_value": to_pwa_value(k, v, "%s/(page)" % (b["page"] or "(blank)"), report, receivers)}
        pz["-1"] = page
        items.append((b, lvl, pz))
    return items


def to_xml(items):
    parts = ["<list>"]
    for b, lvl, pz in items:
        detail = json.dumps({"personalization": pz}, ensure_ascii=False, separators=(",", ":"))
        parts += ["  <com.intellinum.miaadmin.objects.export.Personalization>",
                  "    <applicationName>%s</applicationName>" % escape(b["app"]),
                  "    <pageName>%s</pageName>" % escape(b["page"] or " "),
                  "    <personalizationLevel>%s</personalizationLevel>" % lvl[0],
                  "    <personalizationValue>%s</personalizationValue>" % lvl[1],
                  "    <enabled>Y</enabled>",
                  "    <personalizationDetail>%s</personalizationDetail>" % escape(detail, {'"': "&quot;"}),
                  "  </com.intellinum.miaadmin.objects.export.Personalization>"]
    parts.append("</list>")
    return "\n".join(parts) + "\n"


def to_payload(xml):
    return "personalization=" + urllib.parse.quote_plus(xml)


# ----------------------------------------------------------------------------
# 4. VALIDATE  (against the source model and, optionally, a reference payload)
# ----------------------------------------------------------------------------
def load_payload(path):
    import xml.etree.ElementTree as ET
    raw = open(path).read().strip()
    if raw.startswith("personalization="):
        raw = urllib.parse.unquote_plus(raw[len("personalization="):])
    root = ET.fromstring(raw)
    out = []
    for p in root:
        out.append((p.find("pageName").text, json.loads(p.find("personalizationDetail").text)["personalization"]))
    return out


def norm(s):
    s = re.sub(r"\s+", "", s or "")
    return s.replace("'", '"')


def code_only(s):
    m, _, _ = _mask(s)
    return re.sub(r"\x02C\d+\x02", "", m).replace("\x01", "")


def compare(items, ref_path):
    ref = load_payload(ref_path)
    lines = []
    tot = ok = 0
    sim = []
    for (b, lvl, pz), (rpage, rpz) in zip(items, ref):
        lines.append("Page '%s' vs reference '%s'" % (b["page"] or "(blank)", (rpage or "").strip() or "(blank)"))
        miss = set(rpz) - set(pz); extra = set(pz) - set(rpz)
        if miss: lines.append("  fields missing: %s" % sorted(miss))
        if extra: lines.append("  fields extra: %s" % sorted(extra))
        for f in rpz:
            if f not in pz:
                continue
            if f == "-1":
                a = [(x["name"], x["position"], x["type"]) for x in pz[f].get("additional_component", [])]
                r = [(x["name"], x["position"], x["type"]) for x in rpz[f].get("additional_component", [])]
                tot += 1; ok += (a == r)
                if a != r: lines.append("  additional_component differs")
            for k, rv in rpz[f].items():
                if k == "additional_component":
                    continue
                tot += 1
                if k not in pz[f]:
                    lines.append("  missing prop %s.%s" % (f, k)); continue
                a, r = pz[f][k]["personalize_value"], rv["personalize_value"]
                if a.startswith("script:"):
                    ratio = difflib.SequenceMatcher(None, norm(code_only(a)), norm(code_only(r)), autojunk=False).ratio()
                    sim.append((f, k, ratio))
                    ok += ratio > 0.999
                else:
                    good = norm(a) == norm(r)
                    ok += good
                    if pz[f][k]["original_value"] != rv["original_value"]:
                        lines.append("  note: original_value of %s.%s = %r in reference (not present in the SSH report)" % (f, k, rv["original_value"]))
                    if not good:
                        lines.append("  DIFF %s.%s\n     got: %r\n     ref: %r" % (f, k, a[:160], r[:160]))
            for k in set(pz[f]) - set(rpz[f]):
                if k != "additional_component":
                    lines.append("  extra prop %s.%s" % (f, k))
    lines.append("")
    lines.append("Structure/value match: %d / %d items identical" % (ok, tot))
    lines.append("Script similarity to reference (whitespace-insensitive):")
    for f, k, r in sim:
        lines.append("  %-24s %-20s %.3f%s" % (f, k, r, "" if r > 0.999 else "   <-- differs"))
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("-o", "--out", default=None)
    ap.add_argument("--ref", default=None)
    ap.add_argument("--report", default=None)
    ap.add_argument("--xml", default=None, help="also write the decoded XML")
    a = ap.parse_args()

    blocks = extract(a.pdf)
    report = []
    items = build(blocks, report)
    xml = to_xml(items)
    payload = to_payload(xml)
    out = a.out or os.path.splitext(a.pdf)[0] + "_PWA_Payload.txt"
    open(out, "w").write(payload)
    if a.xml:
        open(a.xml, "w").write(xml)

    lines = ["# Conversion report", "", "Source: %s" % os.path.basename(a.pdf), "Output: %s" % os.path.basename(out), ""]
    lines.append("Pages converted: %d" % len(items))
    for b, lvl, pz in items:
        nscripts = sum(1 for f in pz.values() for v in f.values() if isinstance(v, dict) and v["personalize_value"].startswith("script:"))
        lines.append("- %s / %s : %d components, %d fields with properties, %d scripts" %
                     (b["app"], b["page"] or "(blank page name)", len(b["new_fields"]), len(pz) - 1, nscripts))
    lines += ["", "## Items needing review (%d)" % len(report), ""]
    seen = set()
    for ctx, prop, msg in report:
        key = (msg, ctx, prop)
        if key in seen: continue
        seen.add(key)
        lines.append("- **%s** `%s`: %s" % (ctx, prop, msg))
    for b in blocks:
        if not b["page"].strip():
            lines.append("- **(blank page name)**: sub-page - Flexi may not bind personalizations to a page without a name in the PWA. Test this page manually.")
    if a.ref:
        lines += ["", "## Comparison with reference payload", "```", compare(items, a.ref), "```"]
    rep = "\n".join(lines) + "\n"
    open(a.report or os.path.splitext(out)[0] + "_report.md", "w").write(rep)
    print(rep)


if __name__ == "__main__":
    main()
