#!/usr/bin/env python3
"""Build the self-contained RTL comparison report (light/dark, requirement explorer) from the workflow outputs.

  python3 build-report.py report.json

report.json (paths relative to data_dir unless absolute; every section except the explorer is optional):
{
  "out": "/abs/path/<customer>-comparison.html",
  "data_dir": "/abs/path/documents/<customer>/data",
  "catalogue": "catalogue.json",                 # {requirements:[{id,title,priority,description,acceptance,evidence_old}], deprecated:[]}
  "verdicts": "final_verdicts.json",             # {CANDKEY: {reqId: {verdict,evidence,gaps,operational_ready,better_than_old}}}
  "wf1": "wf1.json", "wf2": "wf2.json", "wf3": "wf3.json",   # workflow results (atlas audit / design review / plan)
  "baseline": {"label": "قدیمی (مشتری)", "id": "<id>", "dump": "dump_<id>.json"},
  "candidates": [{"key": "NEW", "label": "نسخه‌ی نو", "short": "نو", "id": "<id>", "dump": "dump_<id>.json"}],
  "domains": [["VEN", "تأمین‌کننده و سازمان"], ["GAP", "شکاف‌های کشف‌شده توسط منتقد"]],   # display order
  "new_requirement": {"prefix": "NEW", "eyebrow": "…", "title": "…", "intro": "…"},
  "text": {"page_title", "eyebrow", "h1", "lede", "date", "answers_title", "glance_title",
           "answers": [{"q": "…", "verdict": "…", "tone": "ok|part|miss", "text": "… {N} … {covered_NEW} …"}],
           "glance_rows": [["کاربرد", "<baseline>", "<cand 1>", "…"]],
           "atlas_title", "design_summary", "side_notes": [["title", "body"]], "method": ["…"], "footer": ["…"]}
}
Free text may use {placeholders} from facts() (printed at the end); numbers come out in Persian digits.
"""
import html
import json
import os
import sys
from collections import Counter

C = json.load(open(sys.argv[1]))
DIR = C["data_dir"]
T = C.get("text", {})
here = os.path.dirname(os.path.abspath(__file__))
load = lambda k: json.load(open(C[k] if os.path.isabs(C[k]) else f"{DIR}/{C[k]}")) if C.get(k) else None
loadp = lambda p: json.load(open(p if os.path.isabs(p) else f"{DIR}/{p}"))

E = lambda s: html.escape(str(s or ""), quote=True)
FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
fa = lambda n: (f"{n:,}" if isinstance(n, int) else str(n)).replace(",", "٬").translate(FA)

cat, V, wf1, wf2, wf3 = load("catalogue"), load("verdicts"), load("wf1"), load("wf2"), load("wf3")
cands = C["candidates"]
for c in cands:
    c.setdefault("short", c["label"])
base = C["baseline"]
dumps = {"base": loadp(base["dump"]), **{c["key"]: loadp(c["dump"]) for c in cands if c.get("dump")}}
DOMAINS = [tuple(d) for d in C["domains"]]
dkey = lambda i: i.rsplit("-", 1)[0]

reqs = []
for r in cat["requirements"]:
    v = {}
    for c in cands:
        x = V.get(c["key"], {}).get(r["id"])
        if x:
            v[c["key"]] = {"verdict": x["verdict"], "evidence": x.get("evidence", ""), "gaps": x.get("gaps", ""),
                           "op": x.get("operational_ready"), "better": x.get("better_than_old", "")}
    reqs.append({k: r.get(k, "") for k in ("id", "title", "priority", "description", "acceptance", "evidence_old")} | {"domain_key": dkey(r["id"]), "v": v})
missing_verdicts = [(c["key"], r["id"]) for r in reqs for c in cands if c["key"] not in r["v"]]
unknown_domains = sorted({r["domain_key"] for r in reqs} - {k for k, _ in DOMAINS})
assert not unknown_domains, f"add these prefixes to domains: {unknown_domains}"

domains = []
for k, name in DOMAINS:
    rs = [r for r in reqs if r["domain_key"] == k]
    domains.append({"key": k, "name": name, "total": len(rs),
                    "counts": {c["key"]: Counter(r["v"][c["key"]]["verdict"] for r in rs if c["key"] in r["v"]) for c in cands}})

N = len(reqs)
core = [r for r in reqs if r["priority"] == "core"]
facts = {"N": N, "core": len(core), "deprecated": len(cat.get("deprecated", []))}
for c in cands:
    k = c["key"]
    tot = Counter(r["v"][k]["verdict"] for r in reqs if k in r["v"])
    ctot = Counter(r["v"][k]["verdict"] for r in core if k in r["v"])
    for s in ("covered", "partial", "missing"):
        facts[f"{s}_{k}"] = tot[s]
        facts[f"core_{s}_{k}"] = ctot[s]
    facts[f"op_{k}"] = sum(1 for r in reqs if k in r["v"] and r["v"][k]["op"])

issues, omis = [], []
if wf1:
    audits = wf1.get("audits") or [wf1[k] for k in ("auditModel", "auditAccess") if wf1.get(k)]
    for a in filter(None, audits):
        issues += a["issues"]
        omis += a["omissions"]
    facts |= {"claims": sum(a["claims_checked"] for a in filter(None, audits)), "issues": len(issues), "omissions": len(omis),
              "high_issues": sum(i["severity"] == "high" for i in issues), "high_omissions": sum(o["importance"] == "high" for o in omis)}
items, plan = ({i["id"]: i for i in wf3["items"]}, wf3["plan"]) if wf3 else ({}, None)
cls = Counter(i["fix_class"] for i in items.values())
facts |= {"config": cls["config"], "build": cls["build"], "decision": cls["decision"], "external": cls["external"],
          "blocking": sum(1 for i in items.values() if i["blocking_launch"]), "gaps": len(items)}


class Fa(dict):
    def __missing__(self, k):
        return "{" + k + "}"


F = Fa({k: fa(v) for k, v in facts.items()})
t = lambda s: E(str(s or "").format_map(F))

dot = lambda i: f'<i class="dot k{i}"></i>'
BASEKEYS = f'<span class="basekey"><i class="dot base"></i>{E(base["label"])} <code>{E(base.get("id", "")[:8])}…</code></span>' + "".join(
    f'<span class="basekey">{dot(i)}{E(c["label"])} <code>{E(c.get("id", "")[:8])}…</code></span>' for i, c in enumerate(cands))
TONE = {"ok": "v-ok", "part": "v-part", "miss": "v-miss"}
ANSWERS = "".join(f'<div class="answer"><div class="q">{t(a["q"])}</div><div class="a"><span class="verdict {TONE.get(a.get("tone"), "v-part")}">{t(a["verdict"])}</span><p>{t(a["text"])}</p></div></div>' for a in T.get("answers", []))

cols = [("base", base)] + [(c["key"], c) for c in cands]
GLANCE_HEAD = f'<th><span class="colhead"><i class="dot base"></i>{E(base["label"])}</span></th>' + "".join(f'<th><span class="colhead">{dot(i)}{E(c["label"])}</span></th>' for i, c in enumerate(cands))


def auto_rows():
    def cell(k, f):
        d = dumps.get(k)
        return f(d) if d else "—"
    st = lambda d: f"{fa(d['stats']['tables'])} جدول · {fa(d['stats']['fields'])} فیلد · {fa(d['stats']['views'])} نما"
    def po(d):
        by = Counter(x["type"] for x in d["sides"])
        return f"{fa(len(d['sides']))} درگاه ({fa(by.get('visitor', 0))} عمومی، {fa(by.get('user', 0))} کاربر بیرونی، {fa(by.get('collaborator', 0))} داخلی) · {fa(d['stats']['pages'])} صفحه"
    au = lambda d: f"{fa(d['stats']['automations'])} خودکارسازی ({fa(d['stats']['activeAutomations'])} فعال)"
    ro = lambda d: f"{fa(len(d['roles']))} نقش · {fa(len(d['userroles']))} userrole · {fa(len(d['recordroles']))} recordrole"
    rec = lambda d: fa(d["stats"]["liveRecords"]) if "liveRecords" in d["stats"] else "—"
    return [(label, *[cell(k, f) for k, _ in cols]) for label, f in
            (("ساختار", st), ("درگاه‌ها", po), ("نقش‌ها و دسترسی", ro), ("خودکارسازی", au), ("رکورد زنده", rec))]


rows = [tuple(r) for r in T.get("glance_rows", [])] + auto_rows()
GLANCE_ROWS = "".join("<tr>" + "".join(f"<td>{t(x)}</td>" for x in r) + "</tr>" for r in rows)

KPIS = f'<div class="kpi"><b>{fa(N)}</b><span>نیازمندی فعال در کاتالوگ</span></div>' + "".join(
    f'<div class="kpi"><b>{fa(facts["covered_" + c["key"]])}/{fa(N)}</b><span>{E(c["label"])}: پوشش کامل</span></div>'
    f'<div class="kpi"><b>{fa(facts["op_" + c["key"]])}</b><span>{E(c["label"])}: همین امروز کار می‌کند</span></div>' for c in cands)

VL = {"covered": "کامل", "partial": "جزئی", "missing": "ناموجود", "not-applicable": "نامربوط"}
sections, toc = [], [("answers", "پاسخ کوتاه"), ("glance", "در یک نگاه"), ("coverage", "پوشش"), ("explorer", "همه‌ی نیازمندی‌ها")]


def section(sid, eyebrow, title, intro, inner):
    toc.append((sid, eyebrow))
    sections.append(f'<section id="{sid}"><header><span class="eyebrow">{E(eyebrow)}</span><h2>{E(title)}</h2>{f"<p>{intro}</p>" if intro else ""}</header>{inner}</section>')


nr = C.get("new_requirement")
if nr:
    k0 = cands[0]["key"]
    steps = "".join(
        f'<div class="step"><span class="n">{fa(i + 1)}</span><div class="need">{E(r["title"])}<div class="rid">{E(r["id"])}</div></div>'
        f'<div class="status"><span class="chip c-{r["v"][k0]["verdict"]}">{dot(0)}{E(cands[0]["short"])}: {VL[r["v"][k0]["verdict"]]}</span><span>{E(r["v"][k0]["gaps"])}</span></div></div>'
        for i, r in enumerate(r for r in reqs if r["domain_key"] == nr["prefix"] and k0 in r["v"]))
    section("newreq", nr["eyebrow"], nr["title"], t(nr.get("intro")), f'<div class="steps">{steps}</div>')

if wf2 and wf2.get("design"):
    WIN = {"new": cands[0]["short"], "old": "قدیمی", "tie": "برابر", "unclear": "نامشخص"}
    dims = wf2["design"]["dimensions"]
    dw = Counter(d["winner"] for d in dims)
    F.update({"dims": fa(len(dims)), "dims_new": fa(dw["new"]), "dims_old": fa(dw["old"]), "dims_tie": fa(dw["tie"])})
    rows_ = "".join(f'<tr><td><b>{E(d["dimension"])}</b></td><td><span class="win win-{d["winner"]}">{WIN[d["winner"]]}</span></td><td>{E(d["old"])}</td><td>{E(d["new"])}</td></tr>' for d in dims)
    summary = t(T.get("design_summary") or "در {dims} بُعد: {dims_new} به نفع نسخه‌ی نو، {dims_old} به نفع قدیمی، {dims_tie} برابر.")
    section("design", "کیفیت طراحی", f"قدیمی در برابر {cands[0]['label']}", summary,
            f'<div class="design"><table><thead><tr><th>بُعد</th><th>برنده</th><th>قدیمی</th><th>{E(cands[0]["label"])}</th></tr></thead><tbody>{rows_}</tbody></table></div>')

if plan:
    PRI = {"P0": "P0 · مانع راه‌اندازی", "P1": "P1", "P2": "P2"}
    FIX = {"config": "تنظیمات", "build": "ساخت", "decision": "تصمیم کارفرما", "external": "وابسته به سیستم بیرونی"}
    ws = sorted(plan["workstreams"], key=lambda w: ["P0", "P1", "P2"].index(w["priority"]))
    wsh = "".join(
        f'<details class="ws {w["priority"]}"><summary><div class="hd"><h3>{E(w["title"])}</h3><span class="tag {w["priority"]}">{PRI[w["priority"]]}</span>'
        f'<span class="tag">{E(FIX.get(w["fix_class"], w["fix_class"]))}</span><span class="tag">اندازه: {E(w["effort"])}</span><span class="tag">{fa(len(w["steps"]))} گام</span></div>'
        f'<p class="muted">{E(w["why"])}</p></summary><ol>{"".join(f"<li>{E(s)}</li>" for s in w["steps"])}</ol>'
        f'<div class="ids">{E(" · ".join(w["requirement_ids"]))}</div></details>' for w in ws)
    pc = Counter(w["priority"] for w in plan["workstreams"])
    kp = "".join(f'<div class="kpi"><b>{v}</b><span>{E(l)}</span></div>' for v, l in [
        (fa(len(plan["workstreams"])), "جریان کاری"), (fa(pc["P0"]), "جریان P0"), (fa(cls["config"]), "شکاف قابل‌رفع با تنظیمات"), (fa(facts["blocking"]), "مورد مانع راه‌اندازی")])
    li = lambda xs: "".join(f"<li>{E(x)}</li>" for x in xs)
    section("plan", "برنامه‌ی تکمیل", "برای راه‌اندازی چه باید کرد", E(plan["summary"]),
            f'<div class="kpis">{kp}</div><div class="plan">{wsh}</div><div class="twocol"><div class="panel"><h3>تصمیم‌هایی که فقط کارفرما می‌تواند بگیرد</h3><ul>{li(plan["decisions_for_customer"])}</ul></div>'
            f'<div class="panel"><h3>چک‌لیست پیش از راه‌اندازی</h3><ol>{li(plan["go_live_checklist"])}</ol></div></div>')

if wf1:
    SEV = {"high": "مهم", "medium": "متوسط", "low": "جزئی"}
    ST = {"incorrect": "نادرست", "imprecise": "نادقیق", "outdated": "کهنه", "unverifiable": "غیرقابل‌تأیید"}
    iss = "".join(
        f'<div class="issue"><span class="sec"><span class="sev sev-{i["severity"]}">{SEV[i["severity"]]} · {ST[i["status"]]}</span> {E(i["section"])}</span>'
        f'<div class="fix"><b>ادعا:</b> {E(i["claim"])}</div><div class="fix"><b>واقعیت:</b> {E(i["correction"])}</div></div>' for i in issues if i["severity"] == "high") + "".join(
        f'<div class="issue"><span class="sec"><span class="sev sev-high">جاافتادگی مهم</span> {E(o["area"])}</span><div class="fix">{E(o["what_is_missing"])}</div></div>' for o in omis if o["importance"] == "high")
    section("atlas", "صحت توصیف موجود", T.get("atlas_title", "توصیف موجود در برابر Base زنده"),
            t(T.get("atlas_summary") or "دو بازبین مستقل {claims} ادعای متنی را با دامپ زنده چک کردند: {issues} ادعای نادرست یا نادقیق و {omissions} جاافتادگی. در زیر فقط موارد مهم آمده است."),
            f'<div class="issues">{iss}</div>')

if T.get("side_notes"):
    section("side", "یافته‌های جانبی", "چیزهایی که در مسیر دیدیم", "",
            '<div class="notes">' + "".join(f'<div class="note"><b>{t(a)}</b><span>{t(b)}</span></div>' for a, b in T["side_notes"]) + "</div>")
if T.get("method"):
    section("method", "روش", "این سنجش چطور انجام شد", "", '<div class="panel"><ol>' + "".join(f"<li>{t(x)}</li>" for x in T["method"]) + "</ol></div>")

data = {"domains": domains, "reqs": reqs, "cands": [{"key": c["key"], "label": c["label"], "short": c["short"]} for c in cands]}
rep = {
    "PAGE_TITLE": E(T.get("page_title", "سنجش Base")), "EYEBROW": t(T.get("eyebrow", "") + (" · " + T["date"] if T.get("date") else "")),
    "H1": t(T.get("h1", "")), "LEDE": t(T.get("lede", "")), "BASEKEYS": BASEKEYS,
    "TOC": "".join(f'<a href="#{i}">{E(l)}</a>' for i, l in toc), "ANSWERS_TITLE": t(T.get("answers_title", "پاسخ‌ها")), "ANSWERS": ANSWERS,
    "GLANCE_TITLE": t(T.get("glance_title", "هر کدام برای چه ساخته شده‌اند")), "GLANCE_HEAD": GLANCE_HEAD, "GLANCE_ROWS": GLANCE_ROWS,
    "KPIS": KPIS, "N_REQ": fa(N), "OPTIONAL_SECTIONS": "\n".join(sections),
    "FOOTER": "".join(f"<span>{t(x)}</span>" for x in T.get("footer", ["همه‌ی بررسی‌ها فقط‌خواندنی بودند. محتوای رکوردها خوانده نشد و فقط ساختار و شمارش بررسی شد."])),
    "DATA": json.dumps(data, ensure_ascii=False).replace("</", "<\\/"),
}
H = open(f"{here}/report-template.html").read()
for k, v in rep.items():
    H = H.replace("{{" + k + "}}", v)
assert "{{" not in H, H[H.index("{{"):H.index("{{") + 40]
open(C["out"], "w").write(H)
print(C["out"], len(H), "bytes")
print("facts for {placeholders}:", json.dumps(facts, ensure_ascii=False))
if missing_verdicts:
    print(f"WARNING: {len(missing_verdicts)} (candidate, requirement) pairs have no verdict, e.g. {missing_verdicts[:5]}")
