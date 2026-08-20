# -*- coding: utf-8 -*-
"""แปลง wN-slides.md -> wN-slides.html (สไลด์เวอร์ชันเว็บ สไตล์เดียวกับ dte-mfu-incubator)
โครงหน้า: header (ตรา + ชื่อ + ตัวนับ) · เวที 16:9 กลางจอ + ปุ่ม ‹ › · แถบ thumbnail ล่าง
คีย์ลัด: ◀ ▶ เปลี่ยนหน้า · N บันทึกผู้บรรยาย · F เต็มจอ · ลิงก์เจาะหน้า #n
"""
import re, sys, html
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def esc(t):
    return html.escape(t, quote=False)


def inline(t):
    t = esc(t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    return t


def parse_front(lines):
    meta, i = {}, 0
    if lines and lines[0].strip() == "---":
        i = 1
        while i < len(lines) and lines[i].strip() != "---":
            m = re.match(r"^(\w+):\s*(.*)$", lines[i])
            if m:
                meta[m.group(1)] = m.group(2).strip().strip('"')
            i += 1
        i += 1
    return meta, i


def parse_slides(lines, start):
    slides, cur = [], None

    def push():
        nonlocal cur
        if cur:
            slides.append(cur)
        cur = None

    i = start
    while i < len(lines):
        s = lines[i].strip()
        if s.startswith("## "):
            push()
            cur = {"type": "section", "title": s[3:], "body": [], "notes": []}
        elif s.startswith("# "):
            push()
            cur = {"type": "slide", "title": s[2:], "body": [], "notes": []}
        elif s.startswith("!! "):
            push()
            cur = {"type": "big", "title": s[3:], "body": [], "notes": []}
        elif s.startswith("> note:"):
            if cur:
                cur["notes"].append(s[7:].strip())
        elif s.startswith("```"):
            kind = s[3:].strip()
            block, i2 = [], i + 1
            while i2 < len(lines) and not lines[i2].strip().startswith("```"):
                block.append(lines[i2])
                i2 += 1
            i = i2
            if cur:
                cur["body"].append(("fence", kind, block))
        elif s.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(lines[i].strip())
                i += 1
            i -= 1
            if cur:
                cur["body"].append(("table", rows))
        elif s.startswith("- "):
            if cur:
                cur["body"].append(("bullet", s[2:]))
        elif s:
            if cur:
                cur["body"].append(("text", s))
        i += 1
    push()
    return slides


def render_fence(kind, block):
    text = "\n".join(block)
    if kind.startswith("prompt"):
        label = kind[6:].strip() or "พิมพ์แบบนี้"
        body = "<br>".join(inline(l) for l in block)
        return (f'<div class="prompt"><div class="plabel">💬 {esc(label)}</div>'
                f'<div class="pbody">{body}</div></div>')
    if kind.startswith("flow"):
        mode = kind[4:].strip() or "chain"
        if mode == "compare":
            rows = []
            for l in block:
                if "::" not in l:
                    continue
                head, boxes = l.split("::", 1)
                cells = "".join(
                    f'<div class="fbox{" hot" if b.strip().startswith("*") else ""}">'
                    f'{inline(b.strip().lstrip("*"))}</div>'
                    for b in boxes.split("|"))
                rows.append(f'<div class="frow"><div class="fhead">{inline(head.strip())}</div>'
                            f'<div class="fboxes">{cells}</div></div>')
            return f'<div class="flow compare">{"".join(rows)}</div>'
        boxes = [b.strip() for b in text.replace("\n", "|").split("|") if b.strip()]
        cells = []
        for k, b in enumerate(boxes):
            if k:
                cells.append('<div class="farrow">→</div>')
            cells.append(f'<div class="fbox{" hot" if b.startswith("*") else ""}">{inline(b.lstrip("*"))}</div>')
        loop = '<div class="floop">↻ วนกลับไปเริ่มใหม่</div>' if mode == "cycle" else ""
        return f'<div class="flow"><div class="fboxes">{"".join(cells)}</div>{loop}</div>'
    return f'<pre class="codebox">{esc(text)}</pre>'


def render_table(rows):
    out, body = [], []
    for r in rows:
        cells = [c.strip() for c in r.strip("|").split("|")]
        if all(re.fullmatch(r":?-{2,}:?", c or "-") for c in cells):
            continue
        body.append(cells)
    if not body:
        return ""
    out.append("<table><thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in body[0]) + "</tr></thead><tbody>")
    for r in body[1:]:
        out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>")
    out.append("</tbody></table>")
    return "".join(out)


def render_slide(sl):
    cls = {"section": "sec", "big": "bigslide", "slide": "std", "cover": "cover"}[sl["type"]]
    parts = [f'<section class="sl {cls}">']
    if sl["type"] == "cover":
        parts.append(f'<div class="secin"><div class="covertag">{esc(sl.get("tag",""))}</div>'
                     f'<h2>{inline(sl["title"])}</h2>'
                     f'<p class="coversub">{esc(sl.get("sub",""))}</p></div>')
    elif sl["type"] == "section":
        parts.append(f'<div class="secin"><h2>{inline(sl["title"])}</h2></div>')
    elif sl["type"] == "big":
        parts.append(f'<div class="bigin">{inline(sl["title"])}</div>')
    else:
        parts.append(f"<h1>{inline(sl['title'])}</h1>")
        bl = []
        for item in sl["body"]:
            if item[0] == "bullet":
                bl.append(f"<li>{inline(item[1])}</li>")
            else:
                if bl:
                    parts.append("<ul>" + "".join(bl) + "</ul>")
                    bl = []
                if item[0] == "fence":
                    parts.append(render_fence(item[1], item[2]))
                elif item[0] == "table":
                    parts.append(render_table(item[1]))
                elif item[0] == "text":
                    parts.append(f"<p>{inline(item[1])}</p>")
        if bl:
            parts.append("<ul>" + "".join(bl) + "</ul>")
    if sl["notes"]:
        parts.append('<div class="note">🗒️ ' + "<br>".join(inline(n) for n in sl["notes"]) + "</div>")
    parts.append("</section>")
    return "".join(parts)


# ── โครงหน้าและสี ตามแบบ dte-mfu-incubator (navy + amber) ──
CSS = """
:root{
  --ground:#131A3B; --panel:#1B2452; --hairline:#2A3568;
  --text:#EEF0F8; --muted:#8E96BC; --accent:#E8A43C; --accent-ink:#1B2452;
  --paper:#ffffff; --ink:#1f2937; --navy:#1e3a5f;
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{background:var(--ground);color:var(--text);display:flex;flex-direction:column;min-height:100vh;
  font-family:'IBM Plex Sans Thai','Leelawadee UI','Sarabun','Segoe UI',sans-serif}
header{display:flex;align-items:center;gap:.75rem;padding:.8rem 1.25rem;
  border-bottom:1px solid var(--hairline);flex:none}
.mark{width:2.4rem;height:2.4rem;border-radius:50%;background:var(--accent);color:var(--accent-ink);
  display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem;flex:none}
.titles{min-width:0}
.titles h1{font-size:1rem;font-weight:700;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.titles p{font-size:.75rem;color:var(--muted);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.counter{margin-left:auto;flex:none;font-variant-numeric:tabular-nums;font-size:.85rem;color:var(--muted)}
.counter b{color:var(--accent);font-weight:700}
main{flex:1;display:flex;align-items:center;justify-content:center;gap:.6rem;padding:1rem;min-height:0}
.stage{position:relative;flex:1;aspect-ratio:16/9;container-type:inline-size;
  max-width:min(100%,calc((100vh - 13.5rem) * 16 / 9));
  border-radius:.5rem;overflow:hidden;box-shadow:0 1rem 3rem rgba(0,0,0,.45);background:var(--paper)}
.nav{flex:none;width:2.6rem;height:2.6rem;border-radius:50%;border:1px solid var(--hairline);
  background:var(--panel);color:var(--text);font-size:1.1rem;cursor:pointer;transition:background .15s,color .15s}
.nav:hover{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.nav:disabled{opacity:.3;cursor:default}
.strip{flex:none;display:flex;gap:.5rem;padding:.75rem 1.25rem 1rem;overflow-x:auto;
  border-top:1px solid var(--hairline)}
.thumb{position:relative;flex:none;padding:0;border:2px solid transparent;border-radius:.35rem;
  background:none;cursor:pointer;opacity:.55;transition:opacity .15s}
.thumb:hover{opacity:.85}
.thumb.active{opacity:1;border-color:var(--accent)}
.thumb .tno{position:absolute;right:.2rem;bottom:.2rem;background:rgba(19,26,59,.85);color:var(--muted);
  font-size:.6rem;padding:.05rem .3rem;border-radius:.2rem;font-variant-numeric:tabular-nums;z-index:2}
.thumb.active .tno{color:var(--accent)}
.tbox{width:6.1rem;aspect-ratio:16/9;container-type:inline-size;overflow:hidden;
  border-radius:.2rem;background:var(--paper);pointer-events:none}
/* ── ตัวสไลด์ (ขนาดอิงความกว้างกล่อง cqw จึงย่อเป็น thumbnail ได้จริง) ── */
.sl{width:100%;height:100%;display:flex;flex-direction:column;background:var(--paper);color:var(--ink);
  padding:3.2cqw 4cqw;gap:1.4cqw;overflow:auto}
.stage .sl{position:absolute;inset:0;display:none}
.stage .sl.on{display:flex}
h1{font-size:3cqw;color:#111827;border-bottom:.28cqw solid var(--accent);padding-bottom:.7cqw;flex:none}
.sec,.cover{background:var(--navy);justify-content:center;align-items:center;text-align:center}
.secin h2{color:#fff;font-size:3.6cqw;line-height:1.4}
.covertag{color:var(--accent);font-size:1.5cqw;letter-spacing:.15em;margin-bottom:1cqw}
.coversub{color:#cbd5e1;font-size:1.7cqw;margin-top:1.4cqw;line-height:1.6}
.bigslide{background:#111827;justify-content:center;align-items:center}
.bigin{color:var(--accent);font-size:4cqw;font-weight:700;text-align:center;max-width:82cqw;line-height:1.45}
ul{list-style:none;display:flex;flex-direction:column;gap:.9cqw}
li{font-size:1.85cqw;line-height:1.55;padding-left:1.2em;text-indent:-1.2em}
li::before{content:"•  ";color:var(--accent)}
p{font-size:1.75cqw;line-height:1.6}
code{background:#eef2f7;border-radius:.3cqw;padding:.1cqw .5cqw;font-family:Consolas,monospace;
  font-size:.9em;color:#b45309}
.codebox{background:#eef2f7;border-radius:.7cqw;padding:1.2cqw 1.6cqw;font-family:Consolas,monospace;
  font-size:1.45cqw;line-height:1.6;overflow-x:auto;white-space:pre}
.prompt{background:#fef9e7;border-left:.6cqw solid var(--accent);border-radius:0 .7cqw .7cqw 0;
  padding:1cqw 1.5cqw}
.plabel{font-size:1.3cqw;color:#92400e;font-weight:700;margin-bottom:.5cqw}
.pbody{font-size:1.7cqw;line-height:1.65}
table{border-collapse:collapse;font-size:1.5cqw;width:100%}
th{background:var(--navy);color:#fff;padding:.7cqw 1cqw;text-align:left}
td{padding:.65cqw 1cqw;border-bottom:.12cqw solid #e5e7eb;line-height:1.5}
.flow{display:flex;flex-direction:column;align-items:center;gap:1.2cqw;padding:1.2cqw 0}
.fboxes{display:flex;gap:1cqw;align-items:center;flex-wrap:wrap;justify-content:center}
.fbox{background:#fff;border:.26cqw solid var(--navy);border-radius:.8cqw;padding:1.2cqw 1.6cqw;
  font-size:1.6cqw;text-align:center;min-width:12cqw}
.fbox.hot{background:#fef3c7;border-color:var(--accent);font-weight:700}
.farrow{font-size:2.3cqw;color:var(--navy)}
.floop{font-size:1.4cqw;color:#b45309}
.flow.compare{gap:1.5cqw;width:100%}
.frow{display:flex;align-items:center;gap:1.5cqw;width:100%}
.fhead{font-size:1.6cqw;font-weight:700;min-width:22cqw}
.note{display:none;background:#111827;color:#e5e7eb;border-radius:.7cqw;padding:1cqw 1.4cqw;
  font-size:1.4cqw;line-height:1.6;margin-top:auto;flex:none}
body.notes .stage .note{display:block}
.tbox .note{display:none!important}
@media (max-width:600px){.nav{display:none}.titles p{display:none}}
"""

JS = """
const S=[...document.querySelectorAll('.stage .sl')];let i=0;
const cur=document.getElementById('cur'),strip=document.getElementById('strip');
const prev=document.getElementById('prev'),next=document.getElementById('next');
S.forEach((s,k)=>{
  const b=document.createElement('button');b.className='thumb';b.setAttribute('aria-label','หน้า '+(k+1));
  const box=document.createElement('div');box.className='tbox';
  const c=s.cloneNode(true);c.classList.remove('on');box.appendChild(c);
  const no=document.createElement('span');no.className='tno';no.textContent=k+1;
  b.appendChild(box);b.appendChild(no);
  b.addEventListener('click',()=>go(k));
  strip.appendChild(b);
});
const T=[...strip.children];
function go(n,push=true){
  i=Math.max(0,Math.min(S.length-1,n));
  S.forEach((s,k)=>s.classList.toggle('on',k===i));
  T.forEach((t,k)=>t.classList.toggle('active',k===i));
  T[i].scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
  cur.textContent=i+1;
  prev.disabled=(i===0);next.disabled=(i===S.length-1);
  if(push)history.replaceState(null,'','#'+(i+1));
}
prev.addEventListener('click',()=>go(i-1));
next.addEventListener('click',()=>go(i+1));
addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'){e.preventDefault();go(i+1);}
  else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(i-1);}
  else if(e.key==='Home')go(0);else if(e.key==='End')go(S.length-1);
  else if(e.key==='n'||e.key==='N')document.body.classList.toggle('notes');
  else if(e.key==='f'||e.key==='F'){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();}
});
addEventListener('hashchange',()=>{
  const n=(parseInt(location.hash.slice(1))||1)-1;
  if(n!==i)go(Math.max(0,n),false);
});
go(Math.max(0,(parseInt(location.hash.slice(1))||1)-1),false);
"""


def build(src: Path):
    lines = src.read_text(encoding="utf-8").splitlines()
    meta, start = parse_front(lines)
    slides = parse_slides(lines, start)
    week = meta.get("week", "")
    title = meta.get("title", src.stem)
    sub = meta.get("subtitle", "")
    date = meta.get("session_date", meta.get("date", ""))
    cover = {"type": "cover", "title": title, "body": [], "notes": [],
             "tag": sub, "sub": date}
    allslides = [cover] + slides
    body = "".join(render_slide(sl) for sl in allslides)
    out = f"""<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📚</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;700&display=swap">
<style>{CSS}</style></head><body>
<header>
  <div class="mark">W{esc(str(week))}</div>
  <div class="titles"><h1>{esc(title)}</h1><p>{esc(sub)} · {esc(date)}</p></div>
  <div class="counter"><b id="cur">1</b> / {len(allslides)}</div>
</header>
<main>
  <button class="nav" id="prev" aria-label="สไลด์ก่อนหน้า">‹</button>
  <div class="stage" id="stage">{body}</div>
  <button class="nav" id="next" aria-label="สไลด์ถัดไป">›</button>
</main>
<div class="strip" id="strip"></div>
<script>{JS}</script></body></html>"""
    dst = src.with_suffix(".html")
    dst.write_text(out, encoding="utf-8")
    print(f"✅ {dst.name}: {len(allslides)} หน้า")


if __name__ == "__main__":
    targets = [Path(a) for a in sys.argv[1:]] or sorted(Path("materials").glob("week*/w*-slides.md"))
    for t in targets:
        build(t)
