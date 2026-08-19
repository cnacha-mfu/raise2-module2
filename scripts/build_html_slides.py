# -*- coding: utf-8 -*-
"""แปลง wN-slides.md -> wN-slides.html (สไลด์เวอร์ชันเว็บแบบโต้ตอบได้)
ใช้ต้นฉบับเดียวกับ build_slides.py — รองรับ # / ## / !! / bullet / ตาราง /
```code ```prompt ```flow / > note:
การโต้ตอบ: ลูกศร-คลิกเปลี่ยนหน้า · O ภาพรวม · N บันทึกผู้บรรยาย · ลิงก์ #n
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
        ln = lines[i]
        s = ln.strip()
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


def render_slide(sl, idx, total, meta):
    cls = {"section": "sec", "big": "bigslide", "slide": "std"}[sl["type"]]
    parts = [f'<section class="sl {cls}" id="s{idx}">']
    if sl["type"] == "section":
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


CSS = """
:root{--ink:#1f2937;--dim:#6b7280;--accent:#b45309;--bg:#f3f4f6}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;background:#0b1020;font-family:"Leelawadee UI","Sarabun","Noto Sans Thai",sans-serif}
.sl{position:absolute;inset:0;display:none;flex-direction:column;background:#fff;color:var(--ink);
  padding:6vh 7vw 9vh;gap:2.4vh;overflow:auto}
.sl.on{display:flex}
h1{font-size:5.2vh;color:#111827;border-bottom:.5vh solid #f59e0b;padding-bottom:1.2vh}
.sec{background:#1e3a5f;justify-content:center;align-items:center}
.secin h2{color:#fff;font-size:6vh;text-align:center}
.bigslide{background:#111827;justify-content:center;align-items:center}
.bigin{color:#fbbf24;font-size:7vh;font-weight:700;text-align:center;max-width:80vw;line-height:1.4}
ul{list-style:none;display:flex;flex-direction:column;gap:1.6vh}
li{font-size:3.2vh;line-height:1.55;padding-left:1.2em;text-indent:-1.2em}
li::before{content:"•  ";color:#f59e0b}
p{font-size:3vh;line-height:1.6}
code{background:#eef2f7;border-radius:.5vh;padding:.2vh .8vh;font-family:Consolas,monospace;font-size:.9em;color:#b45309}
.codebox{background:#eef2f7;border-radius:1.2vh;padding:2vh 2.6vh;font-family:Consolas,monospace;
  font-size:2.5vh;line-height:1.6;overflow-x:auto;white-space:pre}
.prompt{background:#fef9e7;border-left:1vh solid #f59e0b;border-radius:0 1.2vh 1.2vh 0;padding:1.6vh 2.4vh}
.plabel{font-size:2.2vh;color:#92400e;font-weight:700;margin-bottom:.8vh}
.pbody{font-size:2.9vh;line-height:1.65}
table{border-collapse:collapse;font-size:2.6vh;width:100%}
th{background:#1e3a5f;color:#fff;padding:1.2vh 1.6vh;text-align:left}
td{padding:1.1vh 1.6vh;border-bottom:.2vh solid #e5e7eb;line-height:1.5}
.flow{display:flex;flex-direction:column;align-items:center;gap:2vh;padding:2vh 0}
.fboxes{display:flex;gap:1.6vh;align-items:center;flex-wrap:wrap;justify-content:center}
.fbox{background:#fff;border:.45vh solid #1e3a5f;border-radius:1.4vh;padding:2vh 2.6vh;
  font-size:2.8vh;text-align:center;min-width:12vw}
.fbox.hot{background:#fef3c7;border-color:#f59e0b;font-weight:700}
.farrow{font-size:4vh;color:#1e3a5f}
.floop{font-size:2.4vh;color:var(--accent)}
.flow.compare{gap:2.6vh;width:100%}
.frow{display:flex;align-items:center;gap:2vw;width:100%}
.fhead{font-size:2.8vh;font-weight:700;min-width:22vw}
.note{display:none;background:#111827;color:#e5e7eb;border-radius:1.2vh;padding:1.8vh 2.4vh;
  font-size:2.4vh;line-height:1.6;margin-top:auto}
body.notes .note{display:block}
#bar{position:fixed;top:0;left:0;height:.8vh;background:#f59e0b;width:0;z-index:5;transition:width .25s}
#hud{position:fixed;bottom:1.6vh;right:2vw;background:rgba(17,24,39,.85);color:#e5e7eb;
  border-radius:2vh;padding:.8vh 2vh;font-size:2vh;z-index:5}
#help{position:fixed;bottom:1.6vh;left:2vw;color:#94a3b8;font-size:1.8vh;z-index:5;
  background:rgba(17,24,39,.7);border-radius:2vh;padding:.8vh 1.6vh}
#grid{position:fixed;inset:0;background:rgba(11,16,32,.97);z-index:10;display:none;
  grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;padding:20px;overflow:auto}
body.grid #grid{display:grid}
.thumb{background:#fff;border-radius:8px;height:150px;overflow:hidden;cursor:pointer;position:relative;
  border:3px solid transparent}
.thumb:hover{border-color:#f59e0b}
.thumb .tin{transform:scale(.22);transform-origin:top left;width:1000px;height:640px;pointer-events:none}
.thumb .tno{position:absolute;bottom:4px;right:8px;background:#111827;color:#fbbf24;border-radius:8px;
  padding:1px 8px;font-size:13px}
"""

JS = """
const S=[...document.querySelectorAll('.sl')];let i=0;
const bar=document.getElementById('bar'),hud=document.getElementById('hud');
function go(n,push=true){
  i=Math.max(0,Math.min(S.length-1,n));
  S.forEach((s,k)=>s.classList.toggle('on',k===i));
  bar.style.width=((i+1)/S.length*100)+'%';
  hud.textContent=(i+1)+' / '+S.length;
  if(push)history.replaceState(null,'','#'+(i+1));
  document.body.classList.remove('grid');
}
addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown')go(i+1);
  else if(e.key==='ArrowLeft'||e.key==='PageUp')go(i-1);
  else if(e.key==='Home')go(0);else if(e.key==='End')go(S.length-1);
  else if(e.key==='n'||e.key==='N')document.body.classList.toggle('notes');
  else if(e.key==='o'||e.key==='O')document.body.classList.toggle('grid');
  else if(e.key==='Escape')document.body.classList.remove('grid');
});
addEventListener('click',e=>{
  if(document.body.classList.contains('grid'))return;
  if(e.target.closest('#hud')){document.body.classList.toggle('grid');return;}
  if(e.clientX>innerWidth*.3)go(i+1);else go(i-1);
});
const grid=document.getElementById('grid');
S.forEach((s,k)=>{
  const t=document.createElement('div');t.className='thumb';
  const inn=document.createElement('div');inn.className='tin';
  inn.innerHTML=s.innerHTML;t.appendChild(inn);
  const no=document.createElement('div');no.className='tno';no.textContent=k+1;t.appendChild(no);
  t.addEventListener('click',ev=>{ev.stopPropagation();go(k);});
  grid.appendChild(t);
});
go(Math.max(0,(parseInt(location.hash.slice(1))||1)-1),false);
"""


def build(src: Path):
    lines = src.read_text(encoding="utf-8").splitlines()
    meta, start = parse_front(lines)
    slides = parse_slides(lines, start)
    cover = {"type": "section",
             "title": meta.get("title", src.stem),
             "body": [], "notes": []}
    sub = meta.get("subtitle", "")
    date = meta.get("session_date", meta.get("date", ""))
    body = [render_slide(cover, 0, 0, meta).replace(
        "</div></section>",
        f'<p style="color:#cbd5e1;font-size:2.8vh;text-align:center;margin-top:2vh">{esc(sub)}<br>{esc(date)}</p></div></section>')]
    for k, sl in enumerate(slides, 1):
        body.append(render_slide(sl, k, len(slides), meta))
    out = f"""<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(meta.get('title', src.stem))}</title>
<style>{CSS}</style></head><body>
{''.join(body)}
<div id="bar"></div><div id="hud">1</div>
<div id="help">◀ ▶ เปลี่ยนหน้า · O ภาพรวม · N บันทึกผู้บรรยาย</div>
<div id="grid"></div>
<script>{JS}</script></body></html>"""
    dst = src.with_suffix(".html")
    dst.write_text(out, encoding="utf-8")
    print(f"✅ {dst.name}: {len(slides)+1} หน้า")


if __name__ == "__main__":
    targets = [Path(a) for a in sys.argv[1:]] or sorted(Path("materials").glob("week*/w*-slides.md"))
    for t in targets:
        build(t)
