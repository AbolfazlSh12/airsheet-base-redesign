#!/usr/bin/env python3
"""Draw a planned base before it is built: roles → portals (sides) → pages → tables, the links between tables, and
the access matrix. Self-contained HTML (inline SVG + a little JS, light/dark, RTL); click a node to trace its paths.

  python3 base-graph.py design/base-graph.json out.html          # fragment to paste into a report or design page
  python3 base-graph.py design/base-graph.json out.html --page   # standalone page

Exits 1 on a dangling or duplicate id. Prints warnings for design holes: a table no page or role reaches, a page no
side serves, a side or role with nothing, a page a role sees on a side it cannot enter, a page that lists a table its
audience has no view right on.

spec (names are what the customer reads; ids are local to this file):
{
  "title": "…",                                         # optional heading
  "tables": [{"id": "act", "name": "فعالیت", "rows": "۲٬۴۴۷", "note": "…",
              "fields": [["عنوان", "متن"], ["وزن", "فرمول"]],
              "links":  [{"to": "pm", "field": "برنامه × ماه"}]}],          # child → parent, as stored
  "roles":  [{"id": "unit", "name": "کانون اداره کل", "kind": "portal|staff|anonymous", "scope": "فقط اداره کل خودش",
              "access": {"act": "VE", "prog": "V"}}],                        # V view, C create, E edit, D delete
  "sides":  [{"id": "portal", "name": "پرتال ارزیابی", "type": "user|collaborator|visitor",
              "roles": ["unit"], "pages": ["inbox"], "note": "…"}],
  "pages":  [{"id": "inbox", "name": "کارتابل واحد", "roles": ["unit"],      # empty = everyone on the side
              "tables": ["act"], "note": "…"}]
}
"""
import html
import json
import sys

S = json.load(open(sys.argv[1]))
OUT, PAGE = sys.argv[2], "--page" in sys.argv
E = lambda s: html.escape(str(s or ""), quote=True)
FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
fa = lambda n: str(n).translate(FA)

T, R, SD, P = (S.get(k, []) for k in ("tables", "roles", "sides", "pages"))
errors, warns = [], []
ids = {}
for kind, items in (("t", T), ("r", R), ("s", SD), ("p", P)):
    seen = set()
    for x in items:
        if x["id"] in seen:
            errors.append(f"duplicate {kind} id {x['id']}")
        seen.add(x["id"])
    ids[kind] = seen


def need(kind, i, where):
    if i not in ids[kind]:
        errors.append(f"{where}: unknown {dict(t='table', r='role', s='side', p='page')[kind]} '{i}'")


for t in T:
    for l in t.get("links", []):
        need("t", l["to"], f"table {t['id']} link")
for r in R:
    for t in r.get("access", {}):
        need("t", t, f"role {r['id']} access")
for s in SD:
    [need("r", x, f"side {s['id']}") for x in s.get("roles", [])]
    [need("p", x, f"side {s['id']}") for x in s.get("pages", [])]
for p in P:
    [need("r", x, f"page {p['id']}") for x in p.get("roles", [])]
    [need("t", x, f"page {p['id']}") for x in p.get("tables", [])]
if errors:
    sys.exit("ERROR\n" + "\n".join(errors))

sides_of_page = {p["id"]: [s for s in SD if p["id"] in s.get("pages", [])] for p in P}
role = {r["id"]: r for r in R}
for p in P:
    ss = sides_of_page[p["id"]]
    if not ss:
        warns.append(f"page '{p['name']}' is on no side (nobody can open it)")
    entrants = {x for s in ss for x in s.get("roles", [])}
    for x in p.get("roles", []):
        if ss and x not in entrants:
            warns.append(f"page '{p['name']}' names role '{role[x]['name']}', who enters none of its sides")
    for x in p.get("roles") or entrants:
        for t in p.get("tables", []):
            if "V" not in role[x].get("access", {}).get(t, ""):
                warns.append(f"page '{p['name']}' lists table '{t}' but role '{role[x]['name']}' has no view right on it")
for t in T:
    if not any(t["id"] in p.get("tables", []) for p in P) and not any(t["id"] in r.get("access", {}) for r in R):
        warns.append(f"table '{t['name']}' is reached by no page and no role")
for s in SD:
    if not s.get("pages"):
        warns.append(f"side '{s['name']}' has no pages")
    if not s.get("roles") and s.get("type") != "visitor":
        warns.append(f"side '{s['name']}' has no roles (nobody enters)")
for r in R:
    if not any(r["id"] in s.get("roles", []) for s in SD):
        warns.append(f"role '{r['name']}' enters no side")

# ---- layout: four columns from the right (RTL reading order), barycenter ordering to cut crossings
NW, NH, STEP, GAP, ARC, TOP, PADR = 196, 44, 58, 84, 140, 46, 16
order = {}
order["r"] = [r["id"] for r in R]


def bary(items, parents_of, prev):
    pos = {i: n for n, i in enumerate(order[prev])}
    def key(x):
        ps = [pos[p] for p in parents_of(x) if p in pos]
        return (sum(ps) / len(ps)) if ps else 1e9
    return [x["id"] for x in sorted(items, key=key)]


order["s"] = bary(SD, lambda s: s.get("roles", []), "r")
order["p"] = bary(P, lambda p: [s["id"] for s in sides_of_page[p["id"]]], "s")
order["t"] = bary(T, lambda t: [p["id"] for p in P if t["id"] in p.get("tables", [])] or
                  [p["id"] for p in P for l in t.get("links", []) if l["to"] in p.get("tables", [])], "p")
cols = ["r", "s", "p", "t"]
H = TOP + max(len(order[c]) for c in cols) * STEP + 10
Wd = PADR + 4 * NW + 3 * GAP + ARC
pos = {}
for ci, c in enumerate(cols):
    x = Wd - PADR - ci * (NW + GAP) - NW
    off = (max(len(order[k]) for k in cols) - len(order[c])) * STEP / 2
    for n, i in enumerate(order[c]):
        pos[c + ":" + i] = (x, TOP + off + n * STEP)

KIND = {"portal": "کاربر پرتال", "staff": "همکار داخلی", "anonymous": "بازدیدکننده ناشناس"}
STYPE = {"user": "درگاه کاربری", "collaborator": "پنل داخلی", "visitor": "درگاه عمومی"}
cut = lambda s, n=24: s if len(s) <= n else s[: n - 1] + "…"
by = {"t": {t["id"]: t for t in T}, "r": role, "s": {s["id"]: s for s in SD}, "p": {p["id"]: p for p in P}}


def sub(c, x):
    if c == "t":
        return " · ".join(filter(None, [f"{x['rows']} ردیف" if x.get("rows") else "", f"{fa(len(x.get('fields', [])))} فیلد" if x.get("fields") else ""]))
    if c == "r":
        return KIND.get(x.get("kind"), x.get("kind", ""))
    if c == "s":
        return STYPE.get(x.get("type"), x.get("type", ""))
    return f"{fa(len(x.get('tables', [])))} جدول"


edges = []  # (a, b, cls, label)
for s in SD:
    edges += [(f"r:{r}", f"s:{s['id']}", "e-rs", "") for r in s.get("roles", [])]
    edges += [(f"s:{s['id']}", f"p:{p}", "e-sp", "") for p in s.get("pages", [])]
for p in P:
    edges += [(f"p:{p['id']}", f"t:{t}", "e-pt", "") for t in p.get("tables", [])]
for t in T:
    edges += [(f"t:{t['id']}", f"t:{l['to']}", "e-tt", l.get("field", "")) for l in t.get("links", [])]

svg = []
for a, b, cls, label in edges:
    (xa, ya), (xb, yb) = pos[a], pos[b]
    ya, yb = ya + NH / 2, yb + NH / 2
    if cls == "e-tt":
        d = min(ARC - 24, 34 + 0.32 * abs(ya - yb))
        path = f"M{xa},{ya} C{xa - d},{ya} {xb - d},{yb} {xb - 6},{yb}"
        lab = f'<text class="el" x="{xa - d * 0.78:.0f}" y="{(ya + yb) / 2 + 4:.0f}">{E(cut(label, 16))}</text>' if label else ""
        svg.append(f'<g class="e {cls}" data-a="{a}" data-b="{b}"><path d="{path}" marker-end="url(#bg-arr)"/>{lab}<title>{E(label)}</title></g>')
    else:
        x1, x2 = xa, xb + NW
        m = (x1 + x2) / 2
        svg.append(f'<g class="e {cls}" data-a="{a}" data-b="{b}"><path d="M{x1},{ya} C{m},{ya} {m},{yb} {x2},{yb}"/></g>')
for c in cols:
    for i in order[c]:
        x0 = by[c][i]
        x, y = pos[c + ":" + i]
        svg.append(f'<g class="n n-{c}" data-id="{c}:{i}" tabindex="0" role="button" aria-label="{E(x0["name"])}">'
                   f'<rect x="{x}" y="{y}" width="{NW}" height="{NH}" rx="8"/>'
                   f'<text class="nm" x="{x + NW / 2}" y="{y + 19}">{E(cut(x0["name"]))}</text>'
                   f'<text class="sb" x="{x + NW / 2}" y="{y + 35}">{E(sub(c, x0))}</text><title>{E(x0["name"])}</title></g>')
HEAD = {"r": "نقش‌ها", "s": "درگاه‌ها", "p": "صفحه‌ها", "t": "جدول‌ها"}
heads = "".join(f'<text class="ch" x="{pos[c + ":" + order[c][0]][0] + NW / 2 if order[c] else 0}" y="22">{HEAD[c]} ({fa(len(order[c]))})</text>' for c in cols)

LET = {"V": "مشاهده", "C": "افزودن", "E": "ویرایش", "D": "حذف"}
mat_head = "".join(f"<th>{E(t['name'])}</th>" for t in T)
mat_rows = "".join(
    f'<tr><th>{E(r["name"])}<span>{E(r.get("scope", ""))}</span></th>' + "".join(
        f'<td>{" ".join(f"<i class=a{ch}>{LET[ch]}</i>" for ch in r.get("access", {}).get(t["id"], "") if ch in LET) or "—"}</td>' for t in T) + "</tr>"
    for r in R)

data = {"t": by["t"], "r": by["r"], "s": by["s"], "p": by["p"], "KIND": KIND, "STYPE": STYPE, "LET": LET}
CSS = """
.bgraph{--g-bg:#fbfcfc;--g-fg:#17262b;--g-mu:#56676c;--g-ln:#cdd8d6;--g-r:#6a4fb3;--g-s:#0d6b6e;--g-p:#a35b00;--g-t:#2457a3;--g-card:#ffffff;--g-d:#b3261e;
 display:flex;flex-direction:column;gap:12px;color:var(--g-fg);direction:rtl}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .bgraph{--g-bg:#131c1f;--g-fg:#e2ebe9;--g-mu:#9fb1b3;--g-ln:#33454a;--g-r:#b59cf0;--g-s:#5cc6c7;--g-p:#f0b35c;--g-t:#8fb5f2;--g-card:#182429;--g-d:#f28b82}}
:root[data-theme=dark] .bgraph{--g-bg:#131c1f;--g-fg:#e2ebe9;--g-mu:#9fb1b3;--g-ln:#33454a;--g-r:#b59cf0;--g-s:#5cc6c7;--g-p:#f0b35c;--g-t:#8fb5f2;--g-card:#182429;--g-d:#f28b82}
.bgraph h3,.bgraph h4{margin:0}
.bgraph .bg-leg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:.82rem;color:var(--g-mu)}
.bgraph .bg-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-inline-end:5px;vertical-align:-1px}
.bgraph .bg-sc{overflow-x:auto;border:1px solid var(--g-ln);border-radius:10px;background:var(--g-bg)}
.bgraph svg{display:block}
.bgraph .n rect{fill:var(--g-card);stroke-width:1.6}
.bgraph .n-r rect{stroke:var(--g-r)} .bgraph .n-s rect{stroke:var(--g-s)} .bgraph .n-p rect{stroke:var(--g-p)} .bgraph .n-t rect{stroke:var(--g-t)}
.bgraph .n{cursor:pointer;outline:none} .bgraph .n:focus-visible rect{stroke-width:3}
.bgraph text{font-family:inherit;text-anchor:middle;direction:rtl;unicode-bidi:embed}
.bgraph .nm{font-size:13px;font-weight:700;fill:var(--g-fg)} .bgraph .sb{font-size:11px;fill:var(--g-mu)}
.bgraph .ch{font-size:13px;font-weight:700;fill:var(--g-mu)}
.bgraph .e path{fill:none;stroke-width:1.4;opacity:.55}
.bgraph .e-rs path{stroke:var(--g-r)} .bgraph .e-sp path{stroke:var(--g-s)} .bgraph .e-pt path{stroke:var(--g-p)} .bgraph .e-tt path{stroke:var(--g-t);stroke-dasharray:5 3}
.bgraph .el{font-size:10.5px;fill:var(--g-t);paint-order:stroke;stroke:var(--g-bg);stroke-width:4px;stroke-linejoin:round}
.bgraph #bg-arr path{fill:var(--g-t)}
.bgraph svg.dim .n:not(.on){opacity:.18} .bgraph svg.dim .e:not(.on){opacity:.06} .bgraph svg.dim .e.on path{opacity:1;stroke-width:2.2}
.bgraph .bg-det{border:1px solid var(--g-ln);border-radius:10px;padding:10px 14px;background:var(--g-card);font-size:.88rem;line-height:1.9;min-height:3em}
.bgraph .bg-det b{font-size:.95rem} .bgraph .bg-det .mu{color:var(--g-mu)}
.bgraph .bg-det ul{margin:4px 0 0;padding-inline-start:1.1rem;columns:2 220px}
.bgraph table{border-collapse:collapse;font-size:.82rem;width:100%}
.bgraph th,.bgraph td{border-bottom:1px solid var(--g-ln);padding:6px 9px;text-align:right;vertical-align:top;white-space:nowrap}
.bgraph thead th{color:var(--g-mu)} .bgraph tbody th span{display:block;font-weight:400;color:var(--g-mu);font-size:.76rem;white-space:normal;max-width:16rem}
.bgraph td i{font-style:normal;display:inline-block;padding:1px 8px;border-radius:99px;margin:1px;border:1px solid var(--g-ln)}
.bgraph td i.aV{color:var(--g-t)} .bgraph td i.aC{color:var(--g-s)} .bgraph td i.aE{color:var(--g-p)} .bgraph td i.aD{color:var(--g-d)}
"""
JS = """
(function(root){
const D=JSON.parse(root.querySelector('script[type="application/json"]').textContent);
const svg=root.querySelector('svg'),det=root.querySelector('.bg-det'),idle=det.innerHTML;
const S=Object.values(D.s),P=Object.values(D.p),R=Object.values(D.r),Tb=Object.values(D.t);
const sidesOfPage=p=>S.filter(s=>(s.pages||[]).includes(p));
const seesPage=(r,p)=>sidesOfPage(p.id).some(s=>(s.roles||[]).includes(r))&&(!(p.roles||[]).length||p.roles.includes(r));
function trace(k,i){const on=new Set([k+':'+i]),add=(c,xs)=>xs.forEach(x=>on.add(c+':'+x));
 if(k==='r'){const ps=P.filter(p=>seesPage(i,p));add('s',S.filter(s=>(s.roles||[]).includes(i)).map(s=>s.id));add('p',ps.map(p=>p.id));
  add('t',ps.flatMap(p=>p.tables||[]));add('t',Object.keys(D.r[i].access||{}));}
 if(k==='s'){const s=D.s[i];add('r',s.roles||[]);add('p',s.pages||[]);add('t',(s.pages||[]).flatMap(p=>D.p[p].tables||[]));}
 if(k==='p'){const p=D.p[i];add('s',sidesOfPage(i).map(s=>s.id));add('r',R.filter(r=>seesPage(r.id,p)).map(r=>r.id));add('t',p.tables||[]);}
 if(k==='t'){const ps=P.filter(p=>(p.tables||[]).includes(i));add('p',ps.map(p=>p.id));add('s',ps.flatMap(p=>sidesOfPage(p.id).map(s=>s.id)));
  add('r',R.filter(r=>(r.access||{})[i]||ps.some(p=>seesPage(r.id,p))).map(r=>r.id));
  add('t',(D.t[i].links||[]).map(l=>l.to));add('t',Tb.filter(t=>(t.links||[]).some(l=>l.to===i)).map(t=>t.id));}
 return on;}
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nm=(k,xs)=>(xs||[]).map(x=>esc(D[k][x].name)).join('، ')||'—';
function detail(k,i){const x=D[k][i];let h='<b>'+esc(x.name)+'</b>';
 if(k==='t'){h+=x.rows?' <span class="mu">· '+esc(x.rows)+' ردیف</span>':'';if(x.note)h+='<div>'+esc(x.note)+'</div>';
  if((x.links||[]).length)h+='<div class="mu">لینک به: '+x.links.map(l=>esc(D.t[l.to].name)+' ('+esc(l.field)+')').join('، ')+'</div>';
  if((x.fields||[]).length)h+='<ul>'+x.fields.map(f=>'<li>'+esc(f[0])+' <span class="mu">'+esc(f[1]||'')+'</span></li>').join('')+'</ul>';}
 if(k==='r'){h+=' <span class="mu">· '+esc(D.KIND[x.kind]||x.kind||'')+'</span>';if(x.scope)h+='<div>محدوده: '+esc(x.scope)+'</div>';
  h+='<div class="mu">'+Object.entries(x.access||{}).map(([t,a])=>esc(D.t[t].name)+': '+[...a].map(c=>D.LET[c]).join('، ')).join(' · ')+'</div>';}
 if(k==='s'){h+=' <span class="mu">· '+esc(D.STYPE[x.type]||x.type||'')+'</span><div>نقش‌ها: '+nm('r',x.roles)+'</div><div>صفحه‌ها: '+nm('p',x.pages)+'</div>';if(x.note)h+='<div class="mu">'+esc(x.note)+'</div>';}
 if(k==='p'){h+='<div>مخاطب: '+((x.roles||[]).length?nm('r',x.roles):'همهٔ کاربران درگاه')+'</div><div>جدول‌ها: '+nm('t',x.tables)+'</div>';if(x.note)h+='<div class="mu">'+esc(x.note)+'</div>';}
 det.innerHTML=h;}
function pick(g){const [k,i]=g.dataset.id.split(/:(.*)/);const on=trace(k,i);svg.classList.add('dim');
 svg.querySelectorAll('.n').forEach(n=>n.classList.toggle('on',on.has(n.dataset.id)));
 svg.querySelectorAll('.e').forEach(e=>e.classList.toggle('on',on.has(e.dataset.a)&&on.has(e.dataset.b)));detail(k,i);}
svg.addEventListener('click',ev=>{const g=ev.target.closest('.n');if(g)pick(g);else{svg.classList.remove('dim');det.innerHTML=idle;}});
svg.addEventListener('keydown',ev=>{const g=ev.target.closest('.n');if(g&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();pick(g);}});
})(document.currentScript.parentElement);
"""
frag = f"""<section class="bgraph">
<style>{CSS}</style>
{f'<h3>{E(S["title"])}</h3>' if S.get("title") else ""}
<div class="bg-leg"><span><i style="background:var(--g-r)"></i>نقش ← درگاهی که واردش می‌شود</span><span><i style="background:var(--g-s)"></i>درگاه ← صفحه‌های منو</span><span><i style="background:var(--g-p)"></i>صفحه ← جدول‌هایی که نشان می‌دهد</span><span><i style="background:var(--g-t)"></i>لینک جدول به جدول (فرزند ← والد)</span></div>
<div class="bg-sc"><svg viewBox="0 0 {Wd} {H:.0f}" width="{Wd}" height="{H:.0f}" direction="rtl" role="img" aria-label="گراف ساختار فضای کاری">
<defs><marker id="bg-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker></defs>
{heads}{"".join(svg)}</svg></div>
<div class="bg-det" aria-live="polite"><span class="mu">روی هر گره بزنید تا مسیرهایش (چه کسی، از کدام درگاه، در کدام صفحه، به کدام جدول) پررنگ شود و جزئیاتش این‌جا بیاید. برای برگشتن روی فضای خالی بزنید.</span></div>
<h4>ماتریس دسترسی نقش‌ها به جدول‌ها</h4>
<div class="bg-sc"><table><thead><tr><th>نقش / محدوده</th>{mat_head}</tr></thead><tbody>{mat_rows}</tbody></table></div>
<script type="application/json">{json.dumps(data, ensure_ascii=False).replace("</", "<\\/")}</script>
<script>{JS}</script>
</section>"""
if PAGE:
    frag = (f'<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{E(S.get("title", "ساختار فضای کاری"))}</title><style>:root{{color-scheme:light dark}}body{{margin:0;padding:16px;'
            f'font-family:Vazirmatn,Tahoma,sans-serif;background:Canvas;color:CanvasText}}</style></head><body>{frag}</body></html>')
open(OUT, "w").write(frag)
print(OUT, len(frag), "bytes;", " · ".join(f"{len(x)} {k}" for k, x in (("tables", T), ("roles", R), ("sides", SD), ("pages", P))))
for w in warns:
    print("WARNING:", w)
